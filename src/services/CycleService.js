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
  /**
   * GET /api/v1/devices/:deviceId/cycles
   * Ambil daftar siklus budidaya untuk suatu kumbung/device
   */
  async getCycles(deviceId, params = { status: 'active', limit: 100, offset: 0 }) {
    const query = typeof params === 'object' && params !== null ? buildQuery(params) : '';
    return apiClient.get(`/devices/${deviceId}/cycles${query}`);
  }

  /**
   * POST /api/v1/devices/:deviceId/cycles
   * Buka siklus budidaya baru
   */
  async createCycle(deviceId, payload) {
    return apiClient.post(`/devices/${deviceId}/cycles`, payload);
  }

  // Alias for guide consistency
  async startCycle(deviceId, payload) {
    return this.createCycle(deviceId, payload);
  }

  /**
   * GET /api/v1/devices/:deviceId/cycles/:cycleId/summary
   * Ambil metrik produktivitas siklus (Yield per Baglog, Total Panen, Omzet, Peak Day)
   */
  async getSummary(deviceId, cycleId) {
    return apiClient.get(`/devices/${deviceId}/cycles/${cycleId}/summary`);
  }

  // Alias for guide consistency
  async getCycleSummary(deviceId, cycleId) {
    return this.getSummary(deviceId, cycleId);
  }

  /**
   * POST /api/v1/devices/:deviceId/cycles/:cycleId/complete
   * Menyelesaikan / menutup siklus budidaya
   */
  async completeCycle(deviceId, cycleId, payload = {}) {
    return apiClient.post(`/devices/${deviceId}/cycles/${cycleId}/complete`, payload);
  }

  /**
   * GET /api/v1/devices/:deviceId/cycles/:cycleId/harvests
   * Ambil daftar panen harian dalam suatu siklus
   */
  async getHarvests(deviceId, cycleId, params = { limit: 100, offset: 0 }) {
    const query = typeof params === 'object' && params !== null ? buildQuery(params) : '';
    return apiClient.get(`/devices/${deviceId}/cycles/${cycleId}/harvests${query}`);
  }

  /**
   * POST /api/v1/devices/:deviceId/cycles/:cycleId/harvests
   * Catat panen harian baru
   */
  async createHarvest(deviceId, cycleId, payload) {
    return apiClient.post(`/devices/${deviceId}/cycles/${cycleId}/harvests`, payload);
  }

  // Alias for guide consistency
  async logHarvest(deviceId, cycleId, payload) {
    return this.createHarvest(deviceId, cycleId, payload);
  }

  /**
   * PATCH /api/v1/devices/:deviceId/cycles/:cycleId/harvests/:harvestId
   * Perbarui catatan panen
   */
  async updateHarvest(deviceId, cycleId, harvestId, payload) {
    return apiClient.patch(`/devices/${deviceId}/cycles/${cycleId}/harvests/${harvestId}`, payload);
  }

  /**
   * DELETE /api/v1/devices/:deviceId/cycles/:cycleId/harvests/:harvestId
   * Hapus catatan panen
   */
  async deleteHarvest(deviceId, cycleId, harvestId) {
    return apiClient.delete(`/devices/${deviceId}/cycles/${cycleId}/harvests/${harvestId}`);
  }

  // Static aliases matching Section "Cultivation Cycles & Harvest Workflow"
  static getCycles(...args) { return cycleServiceInstance.getCycles(...args); }
  static startCycle(...args) { return cycleServiceInstance.startCycle(...args); }
  static createCycle(...args) { return cycleServiceInstance.createCycle(...args); }
  static getCycleSummary(...args) { return cycleServiceInstance.getCycleSummary(...args); }
  static getSummary(...args) { return cycleServiceInstance.getSummary(...args); }
  static logHarvest(...args) { return cycleServiceInstance.logHarvest(...args); }
  static createHarvest(...args) { return cycleServiceInstance.createHarvest(...args); }
  static completeCycle(...args) { return cycleServiceInstance.completeCycle(...args); }
  static getHarvests(...args) { return cycleServiceInstance.getHarvests(...args); }
  static updateHarvest(...args) { return cycleServiceInstance.updateHarvest(...args); }
  static deleteHarvest(...args) { return cycleServiceInstance.deleteHarvest(...args); }
}

const cycleServiceInstance = new CycleService();
export default cycleServiceInstance;
export { CycleService };
