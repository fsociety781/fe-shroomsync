import config from '../config';
import apiClient, { APIClient, APIError } from './api-client';
import AuthService from './AuthService';
import DeviceService from './DeviceService';
import TelemetryService from './TelemetryService';
import OTAService from './OTAService';
import CycleService from './CycleService';
import SocketService from './socket-service';
import TechnicianService from './TechnicianService';
import AdminService from './AdminService';

const healthClient = new APIClient(config.baseURL.replace(/\/v1\/?$/, ''));

const unwrap = (payload, fallback = null) => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data ?? fallback;
  }
  return payload ?? fallback;
};

const asArray = (payload) => {
  const data = unwrap(payload, []);
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    if (Array.isArray(data.records)) return data.records;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.cycles)) return data.cycles;
    if (Array.isArray(data.harvests)) return data.harvests;
    if (Array.isArray(data.devices)) return data.devices;
    if (Array.isArray(data.data)) return data.data;
  }
  return [];
};

const normalizeDeviceDetail = (payload) => {
  const data = unwrap(payload);
  if (data?.device) {
    return {
      ...data.device,
      config: data.config || data.device.config || null,
    };
  }
  return data;
};

const readMinuteSecond = (dataOrMinute, second, minuteKeys, secondKeys) => {
  if (typeof dataOrMinute === 'number') {
    return { minute: dataOrMinute, second };
  }

  const data = dataOrMinute || {};
  const minute = minuteKeys.map((key) => data[key]).find((value) => value !== undefined);
  const normalizedSecond = secondKeys.map((key) => data[key]).find((value) => value !== undefined);

  return { minute, second: normalizedSecond };
};

const readFirmwarePayload = (data = {}) => ({
  firmwareUrl: data.firmwareUrl || data.url,
  firmwareVersion: data.firmwareVersion || data.version,
  hardwareVersion: data.hardwareVersion || data.hardware_version || '1.0',
  checksumSha256: data.checksumSha256 || data.checksum_sha256 || '',
  force: Boolean(data.force),
});

const api = {
  client: apiClient,
  APIError,

  health: () => healthClient.get('/health').then((payload) => unwrap(payload, payload)),

  auth: {
    login: (credentials) => AuthService.login(credentials),
    completeOnboarding: (data) => AuthService.completeOnboarding(data),
    me: () => AuthService.getMe(),
    registerFarmer: (data) => AuthService.registerFarmer(data),
    logout: () => AuthService.logout(),
    getUser: () => AuthService.getUser(),
    setUser: (user) => AuthService.setUser(user),
    getToken: () => AuthService.getToken(),
    isAuthenticated: () => AuthService.isAuthenticated(),
    updateProfile: (data) => AuthService.updateProfile(data),
    changePassword: (data) => AuthService.changePassword(data),
  },

  devices: {
    list: (limit = 50, offset = 0) => DeviceService.getAllDevices(limit, offset).then(asArray),
    get: (id) => DeviceService.getDevice(id).then(normalizeDeviceDetail),
    activate: (data) => DeviceService.activateDevice(data).then((payload) => unwrap(payload)),
    unpair: (id) => DeviceService.unpairDevice(id).then((payload) => unwrap(payload)),
    create: (data) => DeviceService.createDevice(data).then((payload) => unwrap(payload)),
    delete: (id) => DeviceService.deleteDevice(id).then((payload) => unwrap(payload)),
  },

  telemetry: {
    getSensorLatest: (id) => TelemetryService.getLatestSensor(id).then((payload) => unwrap(payload)),
    getSensorHistory: (id, params) => TelemetryService.getSensorData(id, params).then(asArray),
    getHistoryLatest: (id) => TelemetryService.getLatestHistory(id).then((payload) => unwrap(payload)),
    getHistory: (id, params) => TelemetryService.getHistory(id, params).then(asArray),
  },

  cycles: {
    list: (deviceId, params = { status: 'active', limit: 100, offset: 0 }) => (
      CycleService.getCycles(deviceId, params).then(asArray)
    ),
    get: (deviceId, cycleId) => (
      apiClient.get(`/devices/${deviceId}/cycles/${cycleId}`).then((payload) => unwrap(payload))
    ),
    create: (deviceId, data) => CycleService.createCycle(deviceId, data).then((payload) => unwrap(payload)),
    summary: (deviceId, cycleId) => (
      CycleService.getSummary(deviceId, cycleId).then((payload) => {
        const data = unwrap(payload);
        if (data && typeof data === 'object' && data.summary && typeof data.summary === 'object') {
          return { ...data, ...data.summary };
        }
        return data;
      })
    ),
    complete: (deviceId, cycleId, data) => CycleService.completeCycle(deviceId, cycleId, data).then((payload) => unwrap(payload)),
    harvests: (deviceId, cycleId, params = { limit: 100, offset: 0 }) => (
      CycleService.getHarvests(deviceId, cycleId, params).then(asArray)
    ),
    createHarvest: (deviceId, cycleId, data) => (
      CycleService.createHarvest(deviceId, cycleId, data).then((payload) => unwrap(payload))
    ),
    updateHarvest: (deviceId, cycleId, harvestId, data) => (
      CycleService.updateHarvest(deviceId, cycleId, harvestId, data).then((payload) => unwrap(payload))
    ),
    deleteHarvest: (deviceId, cycleId, harvestId) => (
      CycleService.deleteHarvest(deviceId, cycleId, harvestId).then((payload) => unwrap(payload))
    ),
  },

  control: {
    setMode: (id, mode) => DeviceService.updateControlMode(id, mode).then((payload) => unwrap(payload)),
    setSetpoint: (id, data) => DeviceService.updateSetpoint(id, data).then((payload) => unwrap(payload)),
    setTimer: (id, dataOrMinute, second) => {
      const timer = readMinuteSecond(dataOrMinute, second, ['minute', 'Menit'], ['second', 'Detik']);
      return DeviceService.updateTimer(id, timer.minute, timer.second).then((payload) => unwrap(payload));
    },
    setTimerFloor: (id, dataOrMinute, second) => {
      const timer = readMinuteSecond(dataOrMinute, second, ['minute', 'FlrMenit'], ['second', 'FlrDetik']);
      return DeviceService.updateFloorTimer(id, timer.minute, timer.second).then((payload) => unwrap(payload));
    },
    setSchedule: (id, schedule, floorSchedule = {}) => (
      Promise.all([
        Object.keys(schedule || {}).length > 0
          ? DeviceService.updateSchedule(id, schedule).then((payload) => unwrap(payload))
          : Promise.resolve(null),
        Object.keys(floorSchedule || {}).length > 0
          ? DeviceService.updateFloorSchedule(id, floorSchedule).then((payload) => unwrap(payload))
          : Promise.resolve(null),
      ]).then(([scheduleResult, floorResult]) => floorResult || scheduleResult)
    ),
    setScheduleFloor: (id, floorSchedule) => (
      DeviceService.updateFloorSchedule(id, floorSchedule).then((payload) => unwrap(payload))
    ),
    setScheduleMode: (id, mode) => DeviceService.updateScheduleMode(id, mode).then((payload) => unwrap(payload)),
    controlPump: (id, data) => DeviceService.controlPump(id, Boolean(data?.on)).then((payload) => unwrap(payload)),
    controlFan: (id, data) => DeviceService.controlFan(id, Boolean(data?.on)).then((payload) => unwrap(payload)),
  },

  ota: {
    trigger: (id, data) => {
      const firmware = readFirmwarePayload(data);
      return OTAService.triggerUpdate(
        id,
        firmware.firmwareUrl,
        firmware.firmwareVersion,
        {
          hardwareVersion: firmware.hardwareVersion,
          checksumSha256: firmware.checksumSha256,
          force: firmware.force,
        }
      ).then((payload) => unwrap(payload));
    },
    legacyTrigger: (id, data) => {
      const firmware = readFirmwarePayload(data);
      return OTAService.triggerLegacyUpdate(
        id,
        firmware.firmwareUrl,
        firmware.firmwareVersion,
        {
          hardwareVersion: firmware.hardwareVersion,
          checksumSha256: firmware.checksumSha256,
          force: firmware.force,
        }
      ).then((payload) => unwrap(payload));
    },
    broadcast: (data) => {
      const firmware = readFirmwarePayload(data);
      return OTAService.broadcastUpdate(
        firmware.firmwareUrl,
        firmware.firmwareVersion,
        {
          hardwareVersion: firmware.hardwareVersion,
          checksumSha256: firmware.checksumSha256,
          force: firmware.force,
        }
      ).then((payload) => unwrap(payload));
    },
    getLogs: (id, limit, offset) => OTAService.getUpdateLogs(id, limit, offset).then(asArray),
  },

  technician: TechnicianService,
  admin: AdminService,
  socket: SocketService,
};

export default api;
export {
  APIClient,
  APIError,
  AuthService,
  DeviceService,
  TelemetryService,
  OTAService,
  CycleService,
  SocketService,
  TechnicianService,
  AdminService,
};
