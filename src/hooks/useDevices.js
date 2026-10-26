import { useCallback, useEffect, useState } from 'react';
import config from '../config';
import DeviceService from '../services/DeviceService';
import AuthService from '../services/AuthService';

const DEVICE_POLL_MS = config.polling.devicesMs;

const unwrap = (payload) => (
  payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload
);

const OFFLINE_THRESHOLD_MS = 2 * 60 * 1000;

export const isDeviceOnline = (dev, maxInactiveMs = OFFLINE_THRESHOLD_MS) => {
  if (!dev) return false;
  if (dev.status === 'OFFLINE' || dev.status === 'SUSPENDED') return false;
  if (!dev.lastSeenAt) return false;
  const lastSeenMs = new Date(dev.lastSeenAt).getTime();
  if (Number.isNaN(lastSeenMs)) return false;
  return (Date.now() - lastSeenMs) <= maxInactiveMs;
};

const normalizeDevice = (dev) => {
  if (!dev || typeof dev !== 'object') return dev;
  const online = isDeviceOnline(dev);
  return {
    ...dev,
    isOnline: online,
    status: dev.status === 'READY' ? 'READY' : (dev.status === 'SUSPENDED' ? 'SUSPENDED' : (online ? 'ACTIVE' : 'OFFLINE')),
    rssiDbm: dev.rssiDbm != null ? dev.rssiDbm : (online ? -65 : null),
    uptimeMs: dev.uptimeMs != null ? dev.uptimeMs : (online ? 3600000 : null),
  };
};

/**
 * Fetch and keep devices fresh through REST polling only.
 *
 * @param {Object} options
 * @param {boolean} options.autoRefetch - Auto-refetch devices by REST polling.
 * @returns {Object} devices, loading, error, refetch, socketConnected
 */
function useDevices(options = {}) {
  const {
    autoRefetch = true,
  } = options;

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDevices = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const result = await DeviceService.getAllDevices();
      const data = unwrap(result);
      let list = Array.isArray(data) ? data.map(normalizeDevice) : [];

      // Untuk akun petani, pastikan hanya menampilkan perangkat yang benar-benar milik petani tersebut
      const storedUser = AuthService.getUser();
      const isFarmer = (storedUser?.role || '').toUpperCase() === 'FARMER';
      if (isFarmer && storedUser?.id) {
        list = list.filter((device) => {
          const ownerId = device.farmerId || device.userId || device.farmer?.id;
          return Boolean(ownerId && String(ownerId) === String(storedUser.id));
        });
      }

      setDevices(list);
      setError(null);
      return list;
    } catch (err) {
      const errorMsg = err.getUserMessage?.() || err.message;
      setError(errorMsg);
      console.error('[useDevices] REST fetch error:', errorMsg);
      throw err;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const updateDevice = useCallback((updatedDevice) => {
    if (!updatedDevice) return;

    const updatedDeviceId = updatedDevice.deviceId || updatedDevice.id;
    if (!updatedDeviceId) return;

    setDevices((currentDevices) => {
      let found = false;
      const nextDevices = currentDevices.map((device) => {
        const deviceId = device.deviceId || device.id;
        if (deviceId !== updatedDeviceId) return device;

        found = true;
        return normalizeDevice({
          ...device,
          ...updatedDevice,
          config: updatedDevice.config || device.config || null,
        });
      });

      return found ? nextDevices : [normalizeDevice(updatedDevice), ...currentDevices];
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (!cancelled) {
          await fetchDevices();
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[useDevices] Initial REST fetch failed:', err.message);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [fetchDevices]);

  useEffect(() => {
    if (!autoRefetch) return undefined;

    const intervalId = window.setInterval(() => {
      fetchDevices({ silent: true }).catch(() => undefined);
    }, DEVICE_POLL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoRefetch, fetchDevices]);

  return {
    devices,
    loading,
    error,
    refetch: fetchDevices,
    updateDevice,
    socketConnected: false,
  };
}

export default useDevices;
