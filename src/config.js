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
const rawBaseURL = envName === 'development'
  ? envConfig.baseURL
  : (import.meta.env.VITE_API_BASE_URL || envConfig.baseURL);

const resolvedBaseURL = (() => {
  if (!rawBaseURL) return '/api/v1';
  const clean = rawBaseURL.replace(/\/+$/, '');
  if (/^https?:\/\//i.test(clean) && !clean.endsWith('/api/v1')) {
    return `${clean}/api/v1`;
  }
  return clean;
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
  wsURL: '',
  timeout: Number(import.meta.env.VITE_API_TIMEOUT_MS || 10000),
  enableSocket: false,
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
