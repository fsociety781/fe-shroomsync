import apiClient from './api-client';

const buildQuery = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, value);
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

const compactObject = (value = {}) => Object.fromEntries(
  Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null)
);

class DeviceService {
  async getAllDevices(limit = 50, offset = 0) {
    return apiClient.get(`/devices${buildQuery({ limit, offset })}`);
  }

  async getDevice(deviceId) {
    return apiClient.get(`/devices/${deviceId}`);
  }

  async createDevice(device, hardwareVersion = '1.0') {
    const payload = typeof device === 'object'
      ? { hardwareVersion, ...device }
      : { deviceId: device, name: device, hardwareVersion };

    return apiClient.post('/devices', payload);
  }

  async updateControlMode(deviceId, mode) {
    return apiClient.post(`/devices/${deviceId}/control/mode`, { mode });
  }

  async updateSetpoint(deviceId, setpoints) {
    return apiClient.post(`/devices/${deviceId}/setpoint`, setpoints);
  }

  async updateTimer(deviceId, minute, second) {
    return apiClient.post(`/devices/${deviceId}/timer`, { Menit: minute, Detik: second });
  }

  async updateFloorTimer(deviceId, minute, second) {
    return apiClient.post(`/devices/${deviceId}/timer/floor`, { FlrMenit: minute, FlrDetik: second });
  }

  async updateSchedule(deviceId, schedule = {}) {
    return apiClient.post(`/devices/${deviceId}/schedule`, compactObject(schedule));
  }

  async updateFloorSchedule(deviceId, floorSchedule = {}) {
    return apiClient.post(`/devices/${deviceId}/schedule/floor`, compactObject(floorSchedule));
  }

  async updateScheduleMode(deviceId, mode) {
    return apiClient.post(`/devices/${deviceId}/schedule/mode`, { mode });
  }

  async controlPump(deviceId, on) {
    return apiClient.post(`/devices/${deviceId}/actuator/pump`, { on });
  }

  async controlFan(deviceId, on) {
    return apiClient.post(`/devices/${deviceId}/actuator/fan`, { on });
  }

  async deleteDevice(deviceId) {
    return apiClient.delete(`/devices/${deviceId}`);
  }
}

export default new DeviceService();
