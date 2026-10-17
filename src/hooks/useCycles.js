import { useState, useEffect, useCallback } from 'react';
import CycleService from '../services/CycleService';

const unwrap = (payload) => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }
  return payload;
};

/**
 * Hook to manage cultivation cycles & harvest records.
 * Diadopsi dari FRONTEND_INTEGRATION_GUIDE.md Section "Cultivation Cycles & Harvest Workflow".
 *
 * @param {string} deviceId - SupaKu Device ID
 */
export function useCycles(deviceId) {
  const [cycles, setCycles] = useState([]);
  const [activeCycle, setActiveCycle] = useState(null);
  const [loading, setLoading] = useState(Boolean(deviceId));
  const [error, setError] = useState(null);

  const fetchCycles = useCallback(async () => {
    if (!deviceId) {
      setCycles([]);
      setActiveCycle(null);
      setLoading(false);
      return [];
    }

    try {
      setLoading(true);
      const result = await CycleService.getCycles(deviceId);
      const data = unwrap(result);
      const list = Array.isArray(data) ? data : [];
      setCycles(list);

      const active = list.find((c) => c.status === 'active') || list[0] || null;
      setActiveCycle(active);
      setError(null);
      return list;
    } catch (err) {
      const message = err.getUserMessage?.() || err.message;
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (!cancelled) {
          await fetchCycles();
        }
      } catch {
        // Error handled inside fetchCycles
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [fetchCycles]);

  const startCycle = useCallback(async (payload) => {
    if (!deviceId) throw new Error('Device ID diperlukan untuk membuka siklus.');
    const result = await CycleService.startCycle(deviceId, payload);
    await fetchCycles();
    return unwrap(result);
  }, [deviceId, fetchCycles]);

  const completeCycle = useCallback(async (cycleId, payload) => {
    if (!deviceId || !cycleId) throw new Error('Device ID dan Cycle ID diperlukan.');
    const result = await CycleService.completeCycle(deviceId, cycleId, payload);
    await fetchCycles();
    return unwrap(result);
  }, [deviceId, fetchCycles]);

  const getCycleSummary = useCallback(async (cycleId) => {
    if (!deviceId || !cycleId) return null;
    const result = await CycleService.getCycleSummary(deviceId, cycleId);
    return unwrap(result);
  }, [deviceId]);

  const logHarvest = useCallback(async (cycleId, harvestData) => {
    if (!deviceId || !cycleId) throw new Error('Device ID dan Cycle ID diperlukan.');
    const result = await CycleService.logHarvest(deviceId, cycleId, harvestData);
    return unwrap(result);
  }, [deviceId]);

  return {
    cycles,
    activeCycle,
    loading,
    error,
    refetch: fetchCycles,
    startCycle,
    completeCycle,
    getCycleSummary,
    logHarvest,
  };
}

export default useCycles;
