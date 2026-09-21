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
  /**
   * GET /api/v1/devices
   * Mendapatkan daftar semua perangkat kumbung (otomatis difilter per-user jika terautentikasi)
   */
  async getAllDevices(limit = 50, offset = 0) {
    return apiClient.get(`/devices${buildQuery({ limit, offset })}`);
  }

  /**
   * GET /api/v1/devices/:deviceId
   * Detail perangkat beserta konfigurasi kontrol & jadwal
   */
  async getDevice(deviceId) {
    return apiClient.get(`/devices/${deviceId}`);
  }

  /**
   * POST /api/v1/devices/activate
   * Menautkan perangkat baru ke akun petani via Device ID / Scan Barcode
   */
  async activateDevice(data) {
    const payload = typeof data === 'string'
      ? { deviceId: data.trim(), name: data.trim() }
      : { deviceId: data?.deviceId?.trim(), name: data?.name?.trim() || data?.deviceId?.trim() };

    return apiClient.post('/devices/activate', payload);
  }

  /**
   * POST /api/v1/devices/unpair/:deviceId
   * Melepaskan tautan perangkat dari akun petani
   */
  async unpairDevice(deviceId) {
    return apiClient.post(`/devices/unpair/${deviceId}`);
  }

  /**
   * POST /api/v1/devices
   * Registrasi perangkat baru (Admin / Inisialisasi)
   */
  async createDevice(device, hardwareVersion = '1.0') {
    const payload = typeof device === 'object'
      ? { hardwareVersion, ...device }
      : { deviceId: device, name: device, hardwareVersion };

    return apiClient.post('/devices', payload);
  }

  /**
   * POST /api/v1/devices/:deviceId/control/mode
   * Mode: 1=Manual, 2=Auto, 3=Hybrid
   */
  async updateControlMode(deviceId, mode) {
    return apiClient.post(`/devices/${deviceId}/control/mode`, { mode });
    return apiClient.post(`/devices/${deviceId}/control/mode`, { mode: Number(mode) });
  }

  /**
   * POST /api/v1/devices/:deviceId/setpoint
   * Setpoint suhu & kelembaban: { MinS, MidS, MinK, MidK }
   */
  async updateSetpoint(deviceId, setpoints) {
    return apiClient.post(`/devices/${deviceId}/setpoint`, setpoints);
  }

  /**
   * POST /api/v1/devices/:deviceId/timer
   * Timer kabut: { Menit, Detik }
   */
  async updateTimer(deviceId, minute, second) {
    return apiClient.post(`/devices/${deviceId}/timer`, { Menit: minute, Detik: second });
    return apiClient.post(`/devices/${deviceId}/timer`, { Menit: Number(minute), Detik: Number(second) });
  }

  /**
   * POST /api/v1/devices/:deviceId/timer/floor
   * Timer lantai: { FlrMenit, FlrDetik }
   */
  async updateFloorTimer(deviceId, minute, second) {
    return apiClient.post(`/devices/${deviceId}/timer/floor`, { FlrMenit: minute, FlrDetik: second });
    return apiClient.post(`/devices/${deviceId}/timer/floor`, { FlrMenit: Number(minute), FlrDetik: Number(second) });
  }

  /**
   * POST /api/v1/devices/:deviceId/schedule
   * Jadwal kabut: { jam1, menit1, jam2, menit2, jam3, menit3 }
   */
  async updateSchedule(deviceId, schedule = {}) {
    return apiClient.post(`/devices/${deviceId}/schedule`, compactObject(schedule));
  }

  /**
   * POST /api/v1/devices/:deviceId/schedule/floor
   * Jadwal lantai: { FlrJam, FlrMenit }
   */
  async updateFloorSchedule(deviceId, floorSchedule = {}) {
    return apiClient.post(`/devices/${deviceId}/schedule/floor`, compactObject(floorSchedule));
  }

  /**
   * POST /api/v1/devices/:deviceId/schedule/mode
   * Mode frekuensi jadwal: 1, 2, atau 3 kali sehari
   */
  async updateScheduleMode(deviceId, mode) {
    return apiClient.post(`/devices/${deviceId}/schedule/mode`, { mode });
    return apiClient.post(`/devices/${deviceId}/schedule/mode`, { mode: Number(mode) });
  }

  /**
   * POST /api/v1/devices/:deviceId/actuator/pump
   * Kontrol manual pompa kabut
   */
  async controlPump(deviceId, on) {
    return apiClient.post(`/devices/${deviceId}/actuator/pump`, { on });
    return apiClient.post(`/devices/${deviceId}/actuator/pump`, { on: Boolean(on) });
  }

  /**
   * POST /api/v1/devices/:deviceId/actuator/fan
   * Kontrol manual pompa lantai / kipas
   */
  async controlFan(deviceId, on) {
    return apiClient.post(`/devices/${deviceId}/actuator/fan`, { on });
    return apiClient.post(`/devices/${deviceId}/actuator/fan`, { on: Boolean(on) });
  }

  /**
   * DELETE /api/v1/devices/:deviceId
   * Menghapus perangkat dari sistem
   */
  async deleteDevice(deviceId) {
    return apiClient.delete(`/devices/${deviceId}`);
  }
}

export default new DeviceService();
export { DeviceService };
