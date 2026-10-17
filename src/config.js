const API_CONFIG = {
  development: {
    baseURL: '/api/v1',
    wsURL: '',
  },
  staging: {
    baseURL: 'https://api-staging.shroomsync.com/api/v1',
    wsURL: 'https://api-staging.shroomsync.com',
  },
  production: {
    baseURL: 'https://api.shroomsync.com/api/v1',
    wsURL: 'https://api.shroomsync.com',
  },
};

const envName = import.meta.env.VITE_APP_ENV || 'development';
const envConfig = API_CONFIG[envName] || API_CONFIG.development;
const rawBaseURL = import.meta.env.VITE_API_BASE_URL || envConfig.baseURL;

const resolvedBaseURL = (() => {
  if (!rawBaseURL) return '/api/v1';
  const clean = rawBaseURL.replace(/\/+$/, '');
  if (/^https?:\/\//i.test(clean) && !clean.endsWith('/api/v1')) {
    return `${clean}/api/v1`;
  }
  return clean;
})();

const resolvedWsURL = (() => {
  const customWs = import.meta.env.VITE_WS_URL || envConfig.wsURL;
  if (customWs) return customWs.replace(/\/+$/, '');
  if (/^https?:\/\//i.test(resolvedBaseURL)) {
    try {
      const url = new URL(resolvedBaseURL);
      return url.origin;
    } catch {
      return '';
    }
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
})();

const skipTunnelWarning = import.meta.env.VITE_SKIP_TUNNEL_WARNING === 'true'
  || /devtunnels\.ms/i.test(resolvedBaseURL);

const toPositiveNumber = (value, fallback) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
};

const config = {
  ...envConfig,
  env: envName,
  baseURL: resolvedBaseURL,
  wsURL: resolvedWsURL,
  timeout: Number(import.meta.env.VITE_API_TIMEOUT_MS || 10000),
  enableSocket: import.meta.env.VITE_ENABLE_SOCKET === 'true',
  skipTunnelWarning,
  polling: {
    devicesMs: toPositiveNumber(import.meta.env.VITE_DEVICES_POLL_MS, 5000),
    dashboardLatestMs: toPositiveNumber(import.meta.env.VITE_DASHBOARD_LATEST_POLL_MS, 2000),
    dashboardHistoryMs: toPositiveNumber(import.meta.env.VITE_DASHBOARD_HISTORY_POLL_MS, 10000),
    telemetryLatestMs: toPositiveNumber(import.meta.env.VITE_TELEMETRY_LATEST_POLL_MS, 2000),
    telemetryHistoryMs: toPositiveNumber(import.meta.env.VITE_TELEMETRY_HISTORY_POLL_MS, 5000),
    controlStatusMs: toPositiveNumber(import.meta.env.VITE_CONTROL_STATUS_POLL_MS, 2000),
    controlActionGraceMs: toPositiveNumber(import.meta.env.VITE_CONTROL_ACTION_GRACE_MS, 10000),
  },
};

export default config;
