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

class CycleService {
  async getCycles(deviceId, params = { status: 'active', limit: 100, offset: 0 }) {
    return apiClient.get(`/devices/${deviceId}/cycles${buildQuery(params)}`);
  }

  async createCycle(deviceId, payload) {
    return apiClient.post(`/devices/${deviceId}/cycles`, payload);
  }

  async getSummary(deviceId, cycleId) {
    return apiClient.get(`/devices/${deviceId}/cycles/${cycleId}/summary`);
  }

  async completeCycle(deviceId, cycleId, payload) {
    return apiClient.post(`/devices/${deviceId}/cycles/${cycleId}/complete`, payload);
  }

  async getHarvests(deviceId, cycleId, params = { limit: 100, offset: 0 }) {
    return apiClient.get(`/devices/${deviceId}/cycles/${cycleId}/harvests${buildQuery(params)}`);
  }

  async createHarvest(deviceId, cycleId, payload) {
    return apiClient.post(`/devices/${deviceId}/cycles/${cycleId}/harvests`, payload);
  }

  async updateHarvest(deviceId, cycleId, harvestId, payload) {
    return apiClient.patch(`/devices/${deviceId}/cycles/${cycleId}/harvests/${harvestId}`, payload);
  }

  async deleteHarvest(deviceId, cycleId, harvestId) {
    return apiClient.delete(`/devices/${deviceId}/cycles/${cycleId}/harvests/${harvestId}`);
  }
}

export default new CycleService();
