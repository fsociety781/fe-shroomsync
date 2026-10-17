import { useState, useEffect, useCallback } from 'react';
import DeviceService from '../services/DeviceService';

const unwrap = (payload) => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }
  return payload;
};

/**
 * Hook to manage a single SupaKu device.
 * Diadopsi dari FRONTEND_INTEGRATION_GUIDE.md Section "Common Patterns".
 *
 * @param {string} deviceId - SupaKu Device ID
 * @param {number} refreshInterval - Auto-refresh interval dalam ms (default: 30000)
 */
export function useDevice(deviceId, refreshInterval = 30000) {
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(Boolean(deviceId));
  const [error, setError] = useState(null);

  const fetchDevice = useCallback(async () => {
    if (!deviceId) return null;
    try {
      setLoading(true);
      const result = await DeviceService.getDevice(deviceId);
      const data = unwrap(result);
      const normalized = data?.device
        ? { ...data.device, config: data.config || data.device.config || null }
        : data;
      setDevice(normalized);
      setError(null);
      return normalized;
    } catch (err) {
      const message = err.getUserMessage?.() || err.message;
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  const updateMode = useCallback(async (mode) => {
    if (!deviceId) return;
    try {
      await DeviceService.updateControlMode(deviceId, mode);
      setDevice((prev) => (prev ? {
        ...prev,
        config: { ...(prev.config || {}), controlMode: mode },
      } : prev));
    } catch (err) {
      const message = err.getUserMessage?.() || err.message;
      setError(message);
      throw err;
    }
  }, [deviceId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (!cancelled) {
          await fetchDevice();
        }
      } catch {
        // Error is handled inside fetchDevice
      }
    };

    load();

    if (!refreshInterval || refreshInterval <= 0) {
      return () => {
        cancelled = true;
      };
    }

    const intervalId = window.setInterval(() => {
      if (!cancelled) {
        fetchDevice();
      }
    }, refreshInterval);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [fetchDevice, refreshInterval]);

  const isOnline = Boolean(device?.isOnline);

  return {
    device,
    loading,
    error,
    isOnline,
    updateMode,
    refetch: fetchDevice,
  };
}

export default useDevice;
