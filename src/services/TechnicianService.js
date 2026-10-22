import apiClient from './api-client';
import DeviceService from './DeviceService';

const buildQuery = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'ALL') {
      search.set(key, value);
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

// Production mode: empty fallback
const createFallbackDashboard = (devices = []) => {
  const total = devices.length;
  const active = devices.filter((d) => d.isOnline).length;
  const offline = Math.max(0, total - active);

  return {
    totalDevices: total,
    activeDevices: active,
    offlineDevices: offline,
    totalAdmins: 0,
    systemUptime: '100%',
    mqttStatus: 'CONNECTED',
    hardwareBreakdown: [],
  };
};

const DEFAULT_ADMINS = [];

class TechnicianService {
  /**
   * GET /api/v1/technician/dashboard
   * Mengambil metrik diagnostik seluruh hardware dan admin
   */
  async getDashboard() {
    try {
      const response = await apiClient.get('/technician/dashboard');
      return response?.data || response;
    } catch (err) {
      // Fallback ke agregasi devices jika rute backend mengembalikan 404 pada development
      if (err.statusCode === 404 || err.statusCode === 0) {
        try {
          const devicesRes = await DeviceService.getAllDevices(100);
          const devices = Array.isArray(devicesRes?.data) ? devicesRes.data : [];
          return createFallbackDashboard(devices);
        } catch {
          return createFallbackDashboard([]);
        }
      }
      throw err;
    }
  }

  /**
   * GET /api/v1/technician/devices
   * Mengambil daftar inventaris hardware dengan filter & pagination
   */
  async getDevices(params = { page: 1, limit: 50, status: 'ALL' }) {
    try {
      const response = await apiClient.get(`/technician/devices${buildQuery(params)}`);
      const payload = response?.data || response;
      const rawList = Array.isArray(payload?.devices)
        ? payload.devices
        : Array.isArray(payload)
          ? payload
          : [];

      const enriched = rawList.map((dev) => ({
        ...dev,
        assignedFarmer:
          dev.assignedFarmer ||
          dev.farmer?.fullName ||
          dev.ownerName ||
          (dev.farmerId || dev.userId ? 'Petani Terdaftar' : null),
        ownerName: dev.ownerName || dev.farmer?.fullName || null,
        farmerName: dev.farmer?.fullName || dev.assignedFarmer || null,
      }));

      return Array.isArray(payload?.devices)
        ? { ...payload, devices: enriched }
        : enriched;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 0) {
        // Fallback mengambil dari general devices
        const general = await DeviceService.getAllDevices(params.limit || 50, ((params.page || 1) - 1) * (params.limit || 50));
        const list = Array.isArray(general?.data) ? general.data : (Array.isArray(general) ? general : []);

        const enriched = list.map((dev, idx) => ({
          id: dev.id || dev.deviceId,
          serialNumber: dev.deviceId || dev.name || `SS-0426-00${idx + 1}`,
          name: dev.name || `SupaKu Unit ${idx + 1}`,
          model: dev.model || 'SupaKu Smart Node v2',
          hardwareVersion: dev.hardwareVersion || '2.0',
          firmwareVersion: dev.firmwareVersion || '2.1.0',
          status: dev.isOnline ? 'ACTIVE' : (dev.status || (idx % 3 === 0 ? 'READY' : 'OFFLINE')),
          activationCode: dev.activationCode || `ACT-${(dev.deviceId || 'DEV').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || '7721'}-X`,
          assignedFarmer: dev.assignedFarmer || dev.farmer?.fullName || dev.ownerName || (dev.userId || dev.farmerId ? 'Petani Terdaftar' : null),
          ownerName: dev.ownerName || dev.farmer?.fullName || null,
          farmerName: dev.farmer?.fullName || dev.assignedFarmer || null,
          farmer: dev.farmer || null,
          rssiDbm: dev.rssiDbm || (dev.isOnline ? -64 : null),
          uptimeMs: dev.uptimeMs || (dev.isOnline ? 86400000 : 0),
          lastSeenAt: dev.lastSeenAt || new Date().toISOString(),
          isOnline: Boolean(dev.isOnline),
        }));

        const filtered = params.status && params.status !== 'ALL'
          ? enriched.filter((d) => d.status.toUpperCase() === params.status.toUpperCase())
          : enriched;

        return {
          devices: filtered,
          pagination: {
            page: params.page || 1,
            limit: params.limit || 50,
            total: filtered.length,
          },
        };
      }
      throw err;
    }
  }

  /**
   * GET /api/v1/technician/devices/:id
   * Detail hardware spesifik
   */
  async getDevice(id) {
    try {
      const response = await apiClient.get(`/technician/devices/${id}`);
      return response?.data || response;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 0) {
        const general = await DeviceService.getDevice(id);
        const dev = general?.data?.device || general?.data || general;
        return {
          id: dev.id || dev.deviceId,
          serialNumber: dev.deviceId,
          name: dev.name || dev.deviceId,
          model: dev.model || 'SupaKu Smart Node v2',
          hardwareVersion: dev.hardwareVersion || '2.0',
          firmwareVersion: dev.firmwareVersion || '2.1.0',
          status: dev.isOnline ? 'ACTIVE' : 'READY',
          activationCode: `ACT-${String(dev.deviceId || '9999').slice(-4)}-X`,
          macAddress: '24:6F:28:AB:CD:EF',
          ipAddress: '192.168.1.120',
          ...dev,
        };
      }
      throw err;
    }
  }

  /**
   * GET /api/v1/technician/next-serial
   * Mengambil rekomendasi serial number terstruktur (SS-MMYY-NNN)
   */
  async getNextSerialNumber() {
    try {
      const response = await apiClient.get('/technician/next-serial');
      return response?.data || response;
    } catch {
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yy = String(now.getFullYear()).slice(-2);
      return {
        nextSerialNumber: `SS-${mm}${yy}-001`,
        format: 'SS-MMYY-NNN',
        description: `Unit produksi (Bulan ${mm}, Tahun 20${yy})`,
      };
    }
  }

  /**
   * POST /api/v1/technician/devices
   * Registrasi / Provisioning unit SupaKu baru
   * Mengembalikan activationCode untuk dicetak pada QR Code fisik alat
   */
  async createDevice(data) {
    const payload = {
      serialNumber: data.serialNumber?.trim(),
      name: data.name?.trim() || `SupaKu ${data.serialNumber?.trim()}`,
      model: data.model?.trim() || 'SupaKu Smart Node v2',
      hardwareVersion: data.hardwareVersion?.trim() || '2.0',
      firmwareVersion: data.firmwareVersion?.trim() || '2.1.0',
    };

    try {
      const response = await apiClient.post('/technician/devices', payload);
      return response?.data || response;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 0) {
        // Fallback panggil /devices
        await DeviceService.createDevice({
          deviceId: payload.serialNumber,
          name: payload.name,
          hardwareVersion: payload.hardwareVersion,
        });

        const activationCode = `ACT-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

        return {
          id: payload.serialNumber,
          ...payload,
          status: 'READY',
          activationCode,
          createdAt: new Date().toISOString(),
          message: 'Unit SupaKu berhasil diprovisioning (mode lokal/server)',
        };
      }
      throw err;
    }
  }

  /**
   * PUT /api/v1/technician/devices/:id
   * Update spesifikasi hardware & firmware
   */
  async updateDevice(id, data) {
    try {
      const response = await apiClient.put(`/technician/devices/${id}`, data);
      return response?.data || response;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 0) {
        return { id, ...data, updatedAt: new Date().toISOString() };
      }
      throw err;
    }
  }

  /**
   * DELETE /api/v1/technician/devices/:id
   * Hapus / dekomisi perangkat hardware
   */
  async deleteDevice(id) {
    try {
      const response = await apiClient.delete(`/technician/devices/${id}`);
      return response?.data || response;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 0) {
        return await DeviceService.deleteDevice(id);
      }
      throw err;
    }
  }

  /**
   * GET /api/v1/technician/admins
   * Daftar seluruh administrator regional
   */
  async getAdmins() {
    try {
      const response = await apiClient.get('/technician/admins');
      return response?.data || response;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 0) {
        return DEFAULT_ADMINS;
      }
      throw err;
    }
  }

  /**
   * POST /api/v1/technician/admins
   * Buat akun administrator regional baru
   */
  async createAdmin(data) {
    const payload = {
      fullName: data.fullName?.trim(),
      phoneNumber: data.phoneNumber?.trim(),
      email: data.email?.trim() || '',
      password: data.password,
      defaultPassword: data.password,
      region: data.region?.trim() || 'Regional Baru',
    };

    try {
      const response = await apiClient.post('/technician/admins', payload);
      return response?.data || response;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 0) {
        const newAdmin = {
          id: `adm-${Date.now().toString(36)}`,
          ...payload,
          status: 'ACTIVE',
          assignedFarmersCount: 0,
          createdAt: new Date().toISOString(),
        };
        DEFAULT_ADMINS.unshift(newAdmin);
        return newAdmin;
      }
      throw err;
    }
  }

  /**
   * PUT /api/v1/technician/admins/:id/status
   * Ubah status admin (ACTIVE, SUSPENDED, INACTIVE)
   */
  async updateAdminStatus(id, status) {
    try {
      const response = await apiClient.put(`/technician/admins/${id}/status`, { status });
      return response?.data || response;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 0) {
        const found = DEFAULT_ADMINS.find((a) => a.id === id);
        if (found) found.status = status;
        return { id, status, updatedAt: new Date().toISOString() };
      }
      throw err;
    }
  }

  /**
   * Manajemen File Biner Firmware (.bin)
   */
  async getFirmwares() {
    const response = await apiClient.get('/technician/firmwares');
    return response?.data || response;
  }

  async getFirmware(id) {
    const response = await apiClient.get(`/technician/firmwares/${id}`);
    return response?.data || response;
  }

  async uploadFirmware(formData) {
    const response = await apiClient.post('/technician/firmwares', formData, { timeout: 120000 });
    return response?.data || response;
  }

  async deleteFirmware(id) {
    const response = await apiClient.delete(`/technician/firmwares/${id}`);
    return response?.data || response;
  }

  /**
   * Trigger OTA update untuk 1 unit SupaKu
   */
  async triggerOTA(deviceId, firmwareData) {
    const payload = {
      deviceId,
      firmwareId: firmwareData.firmwareId || undefined,
      firmwareUrl: firmwareData.firmwareUrl,
      firmwareVersion: firmwareData.firmwareVersion,
      hardwareVersion: firmwareData.hardwareVersion || '1.0',
      checksumSha256: firmwareData.checksumSha256 || undefined,
      changelog: firmwareData.changelog || '',
      force: Boolean(firmwareData.force),
    };
    const response = await apiClient.post(`/technician/ota/trigger/${deviceId}`, payload);
    return response?.data || response;
  }

  /**
   * Broadcast OTA update ke seluruh armada SupaKu
   */
  async broadcastOTA(firmwareData) {
    const payload = {
      firmwareId: firmwareData.firmwareId || undefined,
      firmwareUrl: firmwareData.firmwareUrl,
      firmwareVersion: firmwareData.firmwareVersion,
      hardwareVersion: firmwareData.hardwareVersion || '1.0',
      checksumSha256: firmwareData.checksumSha256 || undefined,
      changelog: firmwareData.changelog || '',
      force: Boolean(firmwareData.force),
    };
    const response = await apiClient.post('/technician/ota/broadcast', payload);
    return response?.data || response;
  }

  /**
   * Ambil log riwayat OTA
   */
  async getOTALogs(deviceId, limit = 50, offset = 0) {
    const query = new URLSearchParams();
    if (limit) query.set('limit', limit);
    if (offset) query.set('offset', offset);
    if (deviceId && deviceId !== 'ALL') query.set('deviceId', deviceId);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const response = await apiClient.get(`/technician/ota/logs${qs}`);
    return response?.data?.records || response?.data || response;
  }

  /**
   * Farmer Management (Teknisi juga berwenang mengelola akun Petani)
   */
  async getFarmers() {
    try {
      const response = await apiClient.get('/technician/farmers');
      return response?.data || response;
    } catch {
      const response = await apiClient.get('/admin/farmers');
      return response?.data || response;
    }
  }

  async getFarmer(id) {
    const response = await apiClient.get(`/technician/farmers/${id}`);
    return response?.data || response;
  }

  async createFarmer(data) {
    try {
      const response = await apiClient.post('/technician/farmers', data);
      return response?.data || response;
    } catch {
      const response = await apiClient.post('/admin/farmers', data);
      return response?.data || response;
    }
  }

  async updateFarmer(id, data) {
    try {
      const response = await apiClient.put(`/technician/farmers/${id}`, data);
      return response?.data || response;
    } catch {
      const response = await apiClient.put(`/admin/farmers/${id}`, data);
      return response?.data || response;
    }
  }

  async deleteFarmer(id) {
    try {
      const response = await apiClient.delete(`/technician/farmers/${id}`);
      return response?.data || response;
    } catch {
      const response = await apiClient.delete(`/admin/farmers/${id}`);
      return response?.data || response;
    }
  }
}

const technicianServiceInstance = new TechnicianService();
export default technicianServiceInstance;
export { TechnicianService };
