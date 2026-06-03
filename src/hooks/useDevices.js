import { useCallback, useEffect, useState } from 'react';
import config from '../config';
import DeviceService from '../services/DeviceService';

const DEVICE_POLL_MS = config.polling.devicesMs;

const unwrap = (payload) => (
  payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload
);

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
      setDevices(Array.isArray(data) ? data : []);
      setError(null);
      return data;
    } catch (err) {
      const errorMsg = err.getUserMessage?.() || err.message;
      setError(errorMsg);
      console.error('[useDevices] REST fetch error:', errorMsg);
      throw err;
    } finally {
      if (!silent) setLoading(false);
    }
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
    socketConnected: false,
  };
}

export default useDevices;
