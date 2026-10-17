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

const normalizeParams = (limitOrParams = 100, maybeOffset = 0) => {
  if (typeof limitOrParams === 'object' && limitOrParams !== null) {
    return limitOrParams;
  }
  return { limit: limitOrParams, offset: maybeOffset };
};

class TelemetryService {
  /**
   * GET /api/v1/devices/:deviceId/telemetry/sensor
   * Mendukung overload: (deviceId, limit = 100, offset = 0) atau (deviceId, paramsObject)
   */
  async getSensorData(deviceId, limitOrParams = 100, offset = 0) {
    const params = normalizeParams(limitOrParams, offset);
    return apiClient.get(`/devices/${deviceId}/telemetry/sensor${buildQuery(params)}`);
  }

  /**
   * GET /api/v1/devices/:deviceId/telemetry/sensor/latest
   * Data sensor terkini (suhu, kelembaban, level air, status alat)
   */
  async getLatestSensor(deviceId) {
    return apiClient.get(`/devices/${deviceId}/telemetry/sensor/latest`);
  }

  /**
   * GET /api/v1/devices/:deviceId/telemetry/history
   * Mendukung overload: (deviceId, limit = 50, offset = 0) atau (deviceId, paramsObject)
   */
  async getHistory(deviceId, limitOrParams = 50, offset = 0) {
    const params = normalizeParams(limitOrParams, offset);
    return apiClient.get(`/devices/${deviceId}/telemetry/history${buildQuery(params)}`);
  }

  /**
   * GET /api/v1/devices/:deviceId/telemetry/history/latest
   * Catatan aksi / riwayat aktuasi terakhir
   */
  async getLatestHistory(deviceId) {
    return apiClient.get(`/devices/${deviceId}/telemetry/history/latest`);
  }
}

export default new TelemetryService();
export { TelemetryService };
