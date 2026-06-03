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

class TelemetryService {
  async getSensorData(deviceId, params = { limit: 100, offset: 0 }) {
    return apiClient.get(`/devices/${deviceId}/telemetry/sensor${buildQuery(params)}`);
  }

  async getLatestSensor(deviceId) {
    return apiClient.get(`/devices/${deviceId}/telemetry/sensor/latest`);
  }

  async getHistory(deviceId, params = { limit: 50, offset: 0 }) {
    return apiClient.get(`/devices/${deviceId}/telemetry/history${buildQuery(params)}`);
  }

  async getLatestHistory(deviceId) {
    return apiClient.get(`/devices/${deviceId}/telemetry/history/latest`);
  }
}

export default new TelemetryService();
