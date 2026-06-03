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

const requireFirmwareFields = (firmwareUrl, version) => {
  if (!firmwareUrl || !version) {
    throw new Error('Firmware URL dan versi firmware wajib diisi.');
  }
};

const buildFirmwarePayload = (firmwareUrl, version, options = {}) => {
  requireFirmwareFields(firmwareUrl, version);

  return {
    action: options.action || 'update',
    hardware_version: options.hardwareVersion || options.hardware_version || '1.0',
    firmware_version: version,
    url: firmwareUrl,
    ...(options.checksumSha256 || options.checksum_sha256
      ? { checksum_sha256: options.checksumSha256 || options.checksum_sha256 }
      : {}),
    force: Boolean(options.force),
  };
};

class OTAService {
  async triggerUpdate(deviceId, firmwareUrl, version, options = {}) {
    return apiClient.post(
      `/ota/trigger/${deviceId}`,
      buildFirmwarePayload(firmwareUrl, version, options)
    );
  }

  async triggerLegacyUpdate(deviceId, firmwareUrl, version, options = {}) {
    return apiClient.post(
      `/ota/legacy-trigger/${deviceId}`,
      buildFirmwarePayload(firmwareUrl, version, options)
    );
  }

  async broadcastUpdate(firmwareUrl, version, options = {}) {
    return apiClient.post('/ota/broadcast', buildFirmwarePayload(firmwareUrl, version, options));
  }

  async getUpdateLogs(deviceId, limit = 20, offset = 0) {
    return apiClient.get(`/ota/logs/${deviceId}${buildQuery({ limit, offset })}`);
  }
}

export default new OTAService();
