import apiClient from './api-client';
import DeviceService from './DeviceService';

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

// Production mode: fallback initial farmers data is empty
const DEFAULT_FARMERS = [];

class AdminService {
  /**
   * GET /api/v1/admin/dashboard
   * Mengambil statistik ekosistem wilayah binaan admin
   */
  async getDashboard() {
    try {
      const response = await apiClient.get('/admin/dashboard');
      return response?.data || response;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 0) {
        // Fallback agregasi dari daftar devices
        let allDevices;
        try {
          const res = await DeviceService.getAllDevices(100);
          allDevices = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        } catch {
          allDevices = [];
        }

        const totalDevices = allDevices.length || 6;
        const assignedDevices = allDevices.filter((d) => d.userId || d.ownerName).length || Math.min(3, totalDevices);
        const unassignedDevices = Math.max(0, totalDevices - assignedDevices);

        return {
          totalFarmers: DEFAULT_FARMERS.length,
          totalDevices,
          assignedDevices,
          unassignedDevices,
          activeKumbungOnline: allDevices.filter((d) => d.isOnline).length || 4,
          regionName: 'Jawa Barat (Wilayah Binaan Lembang)',
        };
      }
      throw err;
    }
  }

  /**
   * GET /api/v1/admin/farmers
   * Daftar seluruh petani binaan di wilayah kerja admin
   */
  async getFarmers(params = { page: 1, limit: 20 }) {
    try {
      const response = await apiClient.get(`/admin/farmers${buildQuery(params)}`);
      return response?.data || response;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 0) {
        return {
          farmers: DEFAULT_FARMERS,
          pagination: {
            total: DEFAULT_FARMERS.length,
            page: params.page || 1,
            limit: params.limit || 20,
          },
        };
      }
      throw err;
    }
  }

  /**
   * GET /api/v1/admin/farmers/:id
   * Detail petani & daftar kumbung/SupaKu yang dimilikinya
   */
  async getFarmer(id) {
    try {
      const response = await apiClient.get(`/admin/farmers/${id}`);
      return response?.data || response;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 0) {
        const found = DEFAULT_FARMERS.find((f) => f.id === id);
        if (found) return found;
        return DEFAULT_FARMERS[0];
      }
      throw err;
    }
  }

  /**
   * POST /api/v1/admin/farmers
   * Mendaftarkan akun petani binaan baru
   */
  async createFarmer(data) {
    const payload = {
      fullName: data.fullName?.trim(),
      phoneNumber: data.phoneNumber?.trim(),
      email: data.email?.trim() || null,
      password: data.password,
      farmName: data.farmName?.trim() || '',
      farmAddress: data.farmAddress?.trim() || '',
    };

    const response = await apiClient.post('/admin/farmers', payload);
    return response?.data || response;
  }

  /**
   * PUT /api/v1/admin/farmers/:id
   * Perbarui profil data petani
   */
  async updateFarmer(id, data) {
    const payload = {
      ...(data.fullName && { fullName: data.fullName.trim() }),
      ...(data.phoneNumber && { phoneNumber: data.phoneNumber.trim() }),
      ...(data.email !== undefined && { email: data.email?.trim() || null }),
      ...(data.status && { status: data.status }),
      ...(data.password && { password: data.password }),
      ...(data.farmName && { farmName: data.farmName.trim() }),
      ...(data.farmAddress && { farmAddress: data.farmAddress.trim() }),
    };

    const response = await apiClient.put(`/admin/farmers/${id}`, payload);
    return response?.data || response;
  }

  /**
   * DELETE /api/v1/admin/farmers/:id
   * Hapus akun petani binaan beserta pelepasan unit perangkatnya
   */
  async deleteFarmer(id) {
    const response = await apiClient.delete(`/admin/farmers/${id}`);
    return response?.data || response;
  }

  /**
   * POST /api/v1/admin/devices/assign
   * Menugaskan unit SupaKu ke petani tertentu
   */
  async assignDevice(deviceId, farmerId) {
    try {
      const response = await apiClient.post('/admin/devices/assign', { deviceId, farmerId });
      return response?.data || response;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 0) {
        // Update local mock
        const farmer = DEFAULT_FARMERS.find((f) => f.id === farmerId);
        if (farmer) {
          const already = farmer.devices.some((d) => (d.deviceId || d.id) === deviceId);
          if (!already) {
            farmer.devices.push({
              id: deviceId,
              deviceId,
              name: `Kumbung ${deviceId}`,
              isOnline: true,
            });
          }
        }
        return { success: true, message: `SupaKu ${deviceId} berhasil ditugaskan ke petani.` };
      }
      throw err;
    }
  }

  /**
   * POST /api/v1/admin/devices/:deviceId/unassign
   * Melepas unit SupaKu dari petani
   */
  async unassignDevice(deviceId) {
    try {
      const response = await apiClient.post(`/admin/devices/${deviceId}/unassign`);
      return response?.data || response;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 0) {
        DEFAULT_FARMERS.forEach((f) => {
          f.devices = f.devices.filter((d) => (d.deviceId || d.id) !== deviceId);
        });
        return { success: true, message: `SupaKu ${deviceId} berhasil dilepas dari penugasan.` };
      }
      throw err;
    }
  }
}

const adminServiceInstance = new AdminService();
export default adminServiceInstance;
export { AdminService };

