const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

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

const readJson = async (res) => {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(payload.message || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.payload = payload;
    throw error;
  }
  return payload.data;
};

const api = {
  // Device Management
  devices: {
    list: () => fetch(`${BASE_URL}/devices`).then(readJson).then(data => data || []),
    get: (id) => fetch(`${BASE_URL}/devices/${id}`).then(readJson),
    create: (data) => fetch(`${BASE_URL}/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(readJson),
    delete: (id) => fetch(`${BASE_URL}/devices/${id}`, {
      method: 'DELETE'
    }).then(readJson),
  },

  // Telemetry / Monitoring
  telemetry: {
    getSensorLatest: (id) => fetch(`${BASE_URL}/devices/${id}/telemetry/sensor/latest`).then(readJson),
    getSensorHistory: (id, params) => fetch(`${BASE_URL}/devices/${id}/telemetry/sensor${buildQuery(params)}`).then(readJson).then(data => data || []),
    getHistoryLatest: (id) => fetch(`${BASE_URL}/devices/${id}/telemetry/history/latest`).then(readJson),
    getHistory: (id, params) => fetch(`${BASE_URL}/devices/${id}/telemetry/history${buildQuery(params)}`).then(readJson).then(data => data || []),
  },

  // Control Actions
  control: {
    setMode: (id, mode) => fetch(`${BASE_URL}/devices/${id}/control/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    }).then(readJson),

    setSetpoint: (id, data) => fetch(`${BASE_URL}/devices/${id}/setpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(readJson),

    setTimer: (id, data) => fetch(`${BASE_URL}/devices/${id}/timer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(readJson),

    setTimerFloor: (id, data) => fetch(`${BASE_URL}/devices/${id}/timer/floor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(readJson),

    setSchedule: (id, data) => fetch(`${BASE_URL}/devices/${id}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(readJson),

    setScheduleFloor: (id, data) => fetch(`${BASE_URL}/devices/${id}/schedule/floor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(readJson),

    setScheduleMode: (id, mode) => fetch(`${BASE_URL}/devices/${id}/schedule/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    }).then(readJson),

    controlPump: (id, data) => fetch(`${BASE_URL}/devices/${id}/actuator/pump`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(readJson),

    controlFan: (id, data) => fetch(`${BASE_URL}/devices/${id}/actuator/fan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(readJson),
  }
};

export default api;
