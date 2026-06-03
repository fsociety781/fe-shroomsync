import { useEffect, useState } from 'react';
import TelemetryService from '../services/TelemetryService';

const unwrap = (payload) => (
  payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload
);

function useTelemetry(deviceId, refreshInterval = 30000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(deviceId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!deviceId) {
      let cancelled = false;
      Promise.resolve().then(() => {
        if (!cancelled) {
          setData(null);
          setLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await TelemetryService.getLatestSensor(deviceId);
        if (!cancelled) {
          setData(unwrap(result));
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.getUserMessage?.() || err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    const intervalId = window.setInterval(fetchData, refreshInterval);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [deviceId, refreshInterval]);

  return { data, loading, error };
}

export default useTelemetry;
