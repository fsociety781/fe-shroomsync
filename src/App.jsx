import { useCallback, useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import useDevices from './hooks/useDevices';
import { 
  LayoutDashboard, 
  Home, 
  Activity, 
  BarChart2, 
  Bell, 
  User, 
  LogOut,
  Settings,
  ChevronDown,
  AlertCircle,
  MoreVertical,
  Plus,
  Info,
  ArrowLeft,
  Thermometer,
  Droplets,
  Filter,
  Camera,
  Mail,
  Phone,
  Shield,
  Key,
  Sliders,
  Waves,
  Droplet,
  Check,
  X,
  Cloud,
  Clock,
  Menu,
  Wifi,
  RefreshCw,
  CircuitBoard,
  Sprout,
  CalendarDays,
  Pencil,
  Trash2,
  ScanLine,
  QrCode,
  Wrench,
  Cpu,
  Zap,
  Users,
  Terminal,
  Radio,
  ChevronRight,
  Link,
  Sun,
  Moon,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './App.css';
import './components/TechnicianDashboard.css';
import api from './services/api';
import config from './config';
import LoginScreen from './components/LoginScreen';
import OnboardingScreen from './components/OnboardingScreen';
import BarcodeScannerModal from './components/BarcodeScannerModal';
import LandingPage from './components/LandingPage';
import TechnicianDashboard from './components/TechnicianDashboard';
import AdminDashboard from './components/AdminDashboard';
import ConfirmModal from './components/ConfirmModal';
import { isMobileApp } from './utils/platform';
import pushNotificationService from './services/PushNotificationService';

const MONITORING_RANGES = [
  { label: '10 Menit', minutes: 10 },
  { label: '20 Menit', minutes: 20 },
  { label: '30 Menit', minutes: 30 },
];

const DASHBOARD_LATEST_REFRESH_MS = config.polling.dashboardLatestMs;
const DASHBOARD_HISTORY_REFRESH_MS = config.polling.dashboardHistoryMs;
const TELEMETRY_LATEST_REFRESH_MS = config.polling.telemetryLatestMs;
const TELEMETRY_HISTORY_REFRESH_MS = config.polling.telemetryHistoryMs;
const REALTIME_SENSOR_HISTORY_LIMIT = 300;
const REALTIME_LOG_LIMIT = 60;

const parseReadingDate = (value) => {
  if (!value) return null;
  const normalizedValue = typeof value === 'string' && value.includes('/')
    ? value.replace(/\//g, '-').replace(' ', 'T')
    : value;
  const date = new Date(normalizedValue);
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const getReadingDate = (record) => {
  const rawDate = record?.createdAt || record?.recordedAt || record?.time || record?.waktu || record?.timestamp;
  return parseReadingDate(rawDate);
};

const readTemperature = (record) => {
  const val = record?.temperature ?? record?.suhu ?? record?.temp;
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
};

const readHumidity = (record) => {
  const val = record?.humidity ?? record?.kelembaban ?? record?.hum;
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
};

const asPlainObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

const unwrapRealtimeData = (payload) => {
  const envelope = asPlainObject(payload);
  const candidates = [envelope.sensor, envelope.history, envelope.telemetry, envelope.data];
  const nested = candidates.find((candidate) => (
    candidate && typeof candidate === 'object' && !Array.isArray(candidate)
  ));

  return nested || envelope;
};

const readRealtimeDeviceId = (payload, record) => {
  const envelope = asPlainObject(payload);
  return envelope.deviceId
    || envelope.device_id
    || record.deviceId
    || record.device_id
    || null;
};

const normalizeRealtimeRecord = (payload) => {
  const recordData = unwrapRealtimeData(payload);
  const record = { ...recordData };
  const deviceId = readRealtimeDeviceId(payload, record);

  if (!deviceId || Object.keys(record).length === 0) return null;

  record.deviceId = deviceId;
  if (record.waktu && !record.recordedAt) record.recordedAt = record.waktu;
  if (!record.createdAt) record.createdAt = asPlainObject(payload).createdAt || new Date().toISOString();
  if (record.uptime_ms != null && record.uptimeMs == null) record.uptimeMs = record.uptime_ms;
  if (asPlainObject(payload).seq != null && record.seq == null) record.seq = asPlainObject(payload).seq;

  return record;
};

const createRealtimeEvent = (payload) => {
  const record = normalizeRealtimeRecord(payload);
  if (!record) return null;

  return {
    deviceId: record.deviceId,
    record,
    receivedAt: Date.now(),
  };
};

const getRealtimeRecordKey = (record) => (
  record?.id
  || `${record?.deviceId || 'device'}-${record?.createdAt || record?.recordedAt || record?.time || record?.waktu || record?.seq || Date.now()}`
);

const mergeRealtimeRecord = (records, record, { limit = REALTIME_SENSOR_HISTORY_LIMIT, newestFirst = false } = {}) => {
  if (!record) return records;

  const byKey = new Map();
  [...records, record].forEach((item) => {
    byKey.set(getRealtimeRecordKey(item), item);
  });

  const merged = Array.from(byKey.values())
    .sort((a, b) => {
      const firstTime = getReadingDate(a)?.getTime() ?? 0;
      const secondTime = getReadingDate(b)?.getTime() ?? 0;
      return firstTime - secondTime;
    })
    .slice(-limit);

  return newestFirst ? merged.reverse() : merged;
};

const upsertLatestReading = (readings, deviceId, sensor) => {
  const exists = readings.some((reading) => reading.deviceId === deviceId);
  if (!exists) return [...readings, { deviceId, sensor }];

  return readings.map((reading) => (
    reading.deviceId === deviceId ? { deviceId, sensor } : reading
  ));
};

const hasActuatorState = (record) => (
  record?.pumpStatus != null
  || record?.floorPumpStatus != null
  || record?.mistPump != null
  || record?.floorPump != null
  || record?.pump != null
  || record?.fan != null
  || record?.actuator != null
);

const isActiveValue = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return ['on', '1', 'true', 'aktif'].includes(value.toLowerCase());
  return false;
};

const formatHistoryActivity = (record) => {
  if (record.activity || record.message) return record.activity || record.message;

  const details = [];
  const temperature = readTemperature(record);
  const humidity = readHumidity(record);
  if (temperature != null) details.push(`Suhu ${Number(temperature).toFixed(2)}°C`);
  if (humidity != null) details.push(`Kelembaban ${Number(humidity).toFixed(2)}%`);
  if (record.pumpStatus != null) details.push(`Pompa kabut ${record.pumpStatus}`);
  if (record.floorPumpStatus != null) details.push(`Pompa lantai ${record.floorPumpStatus}`);
  return details.join(' | ') || '--';
};

const formatHistoryTime = (record) => {
  const date = getReadingDate(record);
  if (!date) return '--';
  const now = new Date();
  const isToday = now.toDateString() === date.toDateString();
  return isToday
    ? date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const formatDateTime = (value) => {
  if (!value) return 'Belum tersedia';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Belum tersedia';
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatRelativeTime = (value, nowTime) => {
  if (!value) return 'Belum ada data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Belum ada data';

  const diffMinutes = Math.max(0, Math.round((nowTime - date.getTime()) / 60000));
  if (diffMinutes < 1) return 'Baru saja';
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} hari lalu`;
};

const formatUptime = (ms) => {
  if (ms == null) return '--';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}h ${hours}j`;
  if (hours > 0) return `${hours}j ${minutes}m`;
  return `${minutes}m`;
};

const formatWifi = (rssi) => {
  if (rssi == null) return '--';
  let quality;
  if (rssi >= -60) quality = 'Sangat Baik';
  else if (rssi >= -70) quality = 'Baik';
  else if (rssi >= -80) quality = 'Cukup';
  else quality = 'Lemah';
  return `${rssi} dBm (${quality})`;
};

const toFiniteNumber = (value, fallback = null) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const readForecastDescription = (entry = {}) => (
  entry.weather_desc
  || entry.weatherDesc
  || entry.weather
  || entry.weather_desc_en
  || entry.desc
  || 'Tidak tersedia'
);

const getForecastDate = (entry = {}) => {
  const rawDate = entry.local_datetime || entry.datetime || entry.utc_datetime;
  if (!rawDate) return null;

  const date = new Date(String(rawDate).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeForecastEntry = (entry = {}) => ({
  raw: entry,
  weather: readForecastDescription(entry),
  humidity: toFiniteNumber(entry.hu ?? entry.humidity ?? entry.rh, 70),
  temp: toFiniteNumber(entry.t ?? entry.tempMax ?? entry.temperature ?? entry.temp, 30),
  localDatetime: entry.local_datetime || entry.datetime || entry.utc_datetime || null,
  date: getForecastDate(entry),
});

const flattenWeatherEntries = (weatherData) => {
  const forecastGroups = weatherData?.data?.[0]?.cuaca;
  if (!Array.isArray(forecastGroups)) return [];

  return forecastGroups
    .flatMap((group) => (Array.isArray(group) ? group : [group]))
    .filter(Boolean)
    .map(normalizeForecastEntry);
};

const averageNumbers = (values, fallback = 0) => {
  const validValues = values.filter((value) => Number.isFinite(value));
  if (validValues.length === 0) return fallback;
  return validValues.reduce((total, value) => total + value, 0) / validValues.length;
};

const getCurrentForecastEntry = (weatherData) => {
  const entries = flattenWeatherEntries(weatherData);
  if (entries.length === 0) return null;

  const now = Date.now();
  return entries.find((entry) => entry.date && entry.date.getTime() >= now) || entries[0];
};

// Weather Service for BMKG API
const weatherService = {
  // Fetch weather forecast from BMKG API
  // BMKG provides public weather API at data.bmkg.go.id.
  getForecast: async (locationOrLat, lon) => {
    const location = typeof locationOrLat === 'object'
      ? locationOrLat
      : { lat: locationOrLat, lon };

    try {
      const params = new URLSearchParams();
      if (location.adm4) {
        params.set('adm4', location.adm4);
      } else {
        params.set('lat', location.lat);
        params.set('lon', location.lon);
      }

      const response = await fetch(`https://api.bmkg.go.id/publik/prakiraan-cuaca?${params.toString()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) throw new Error('Weather fetch failed');
      const data = await response.json();
      // Add timestamp to data
      if (data) data.lastUpdated = new Date().toISOString();
      return data;
    } catch (error) {
      console.error('Weather API error:', error);
      // Fallback with timestamp
      return {
        lastUpdated: new Date().toISOString(),
        lokasi: { 
          provinsi: 'Jawa Barat', 
          kotkab: 'Bandung',
          kecamatan: 'Rancaekek',
          desa: 'Rancaekek Wetan',
          adm4: '32.04.28.2001',
        },
        data: [{
          cuaca: [[{ 
            local_datetime: new Date().toISOString().slice(0, 19).replace('T', ' '),
            weather_desc: 'Berawan (Offline Mode)',
            weather: 'Berawan (Offline Mode)',
            t: 30,
            hu: 75,
          }]]
        }]
      };
    }
  },

  getCurrentForecast: (weatherData) => getCurrentForecastEntry(weatherData),
  
  // Parse weather condition and determine optimal schedule
  parseWeatherCondition: (weatherData) => {
    console.log('parseWeatherCondition - input:', weatherData);
    const forecastEntries = flattenWeatherEntries(weatherData);
    const current = getCurrentForecastEntry(weatherData);

    if (!current || forecastEntries.length === 0) {
      console.error('parseWeatherCondition - Missing weather forecast data');
      return null;
    }

    const now = Date.now();
    const nextDay = now + (24 * 60 * 60 * 1000);
    const upcomingEntries = forecastEntries.filter((entry) => (
      !entry.date || (entry.date.getTime() >= now && entry.date.getTime() <= nextDay)
    ));
    const analysisEntries = upcomingEntries.length > 0 ? upcomingEntries : forecastEntries.slice(0, 8);
    const descriptions = analysisEntries.map((entry) => entry.weather.toLowerCase());
    const humidity = Math.round(averageNumbers(
      analysisEntries.map((entry) => entry.humidity),
      current.humidity
    ));
    const tempMax = Math.max(...analysisEntries.map((entry) => entry.temp).filter(Number.isFinite), current.temp);
    const rainEntries = descriptions.filter((weather) => (
      weather.includes('hujan')
      || weather.includes('rain')
      || weather.includes('petir')
      || weather.includes('thunder')
    ));
    const hasHeavyRain = descriptions.some((weather) => (
      weather.includes('hujan lebat')
      || weather.includes('hujan sedang')
      || weather.includes('petir')
      || weather.includes('heavy rain')
      || weather.includes('moderate rain')
      || weather.includes('thunder')
    ));
    const cloudyCount = descriptions.filter((weather) => (
      weather.includes('berawan') || weather.includes('cloudy')
    )).length;

    console.log('Parsed BMKG values:', {
      weather: current.weather,
      humidity,
      tempMax,
      forecastCount: analysisEntries.length,
    });

    let condition = 'sunny';
    if (hasHeavyRain || (rainEntries.length >= 3 && humidity > 80)) {
      condition = 'heavy_rain';
    } else if (rainEntries.length > 0) {
      condition = 'light_rain';
    } else if (tempMax > 32) {
      condition = 'hot_sunny';
    } else if (cloudyCount >= Math.ceil(analysisEntries.length / 2)) {
      condition = 'cloudy';
    }
    
    console.log('Determined BMKG condition:', condition);
    return {
      condition,
      humidity,
      tempMax,
      weatherDesc: current.weather,
      currentForecast: current,
      forecastCount: analysisEntries.length,
    };
  },
  
  // Calculate optimal schedule based on weather
  calculateOptimalSchedule: (weatherCondition) => {
    console.log('📋 calculateOptimalSchedule - input condition:', weatherCondition);
    const { condition, humidity } = weatherCondition;
    
    let schedule;
    
    switch (condition) {
      case 'heavy_rain':
        // Heavy rain: minimal spraying, focus on floor only
        schedule = {
          freq: 1,
          jam1: 14, menit1: 0,
          jam2: 0, menit2: 0,
          jam3: 0, menit3: 0,
          floorScheduleHour: 10, floorScheduleMinute: 0,
          timerMenit: 0, timerDetik: 45,
          floorTimerMenit: 1, floorTimerDetik: 0,
          reason: 'Hujan lebat - penyiraman minimal'
        };
        break;
        
      case 'light_rain':
        // Light rain: reduced schedule
        schedule = {
          freq: 2,
          jam1: 9, menit1: 30,
          jam2: 15, menit2: 30,
          jam3: 0, menit3: 0,
          floorScheduleHour: 9, floorScheduleMinute: 0,
          timerMenit: 1, timerDetik: 0,
          floorTimerMenit: 1, floorTimerDetik: 30,
          reason: 'Hujan ringan - penyiraman dikurangi'
        };
        break;
        
      case 'cloudy':
        // Cloudy: moderate schedule
        schedule = {
          freq: 2,
          jam1: 8, menit1: 0,
          jam2: 16, menit2: 30,
          jam3: 0, menit3: 0,
          floorScheduleHour: 9, floorScheduleMinute: 0,
          timerMenit: 1, timerDetik: 30,
          floorTimerMenit: 2, floorTimerDetik: 0,
          reason: 'Berawan - jadwal normal'
        };
        break;
        
      case 'hot_sunny':
        // Hot sunny: frequent spraying
        schedule = {
          freq: 3,
          jam1: 6, menit1: 30,
          jam2: 12, menit2: 0,
          jam3: 17, menit3: 30,
          floorScheduleHour: 7, floorScheduleMinute: 30,
          timerMenit: 2, timerDetik: 0,
          floorTimerMenit: 3, floorTimerDetik: 0,
          reason: 'Panas terik - penyiraman intensif'
        };
        break;
        
      case 'sunny':
      default:
        // Normal sunny: standard schedule
        schedule = {
          freq: 2,
          jam1: 7, menit1: 0,
          jam2: 16, menit2: 0,
          jam3: 0, menit3: 0,
          floorScheduleHour: 8, floorScheduleMinute: 0,
          timerMenit: 1, timerDetik: 30,
          floorTimerMenit: 2, floorTimerDetik: 0,
          reason: 'Cerah - jadwal standar'
        };
    }
    
    // Adjust based on humidity
    if (humidity > 90) {
      schedule.freq = Math.max(1, schedule.freq - 1);
      schedule.reason += ' (kelembaban tinggi)';
    } else if (humidity < 60) {
      schedule.freq = Math.min(3, schedule.freq + 1);
      schedule.reason += ' (kelembaban rendah)';
    }
    
    console.log('✅ calculateOptimalSchedule - returning:', schedule);
    return schedule;
  }
};

const formatMetric = (value, suffix, decimalPlaces = 2) => (
  value == null ? '--' : `${Number(value).toFixed(decimalPlaces)}${suffix}`
);

const formatKg = (value, decimalPlaces = 2) => (
  value == null || value === '' ? '--' : `${Number(value).toFixed(decimalPlaces)} kg`
);

const formatCurrency = (value) => (
  value == null || value === ''
    ? '--'
    : new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(Number(value))
);

const formatReadableDate = (value, includeTime = false) => {
  if (!value) return '--';
  const date = parseReadingDate(value);
  if (!date) return '--';

  return date.toLocaleString('id-ID', includeTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' });
};

const toDateInputValue = (value = new Date()) => {
  const date = value instanceof Date ? value : parseReadingDate(value);
  if (!date) return '';
  return date.toISOString().slice(0, 10);
};

const toDatetimeLocalValue = (value = new Date()) => {
  const date = value instanceof Date ? value : parseReadingDate(value);
  if (!date) return '';
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
};

const compactPayload = (payload = {}) => Object.fromEntries(
  Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== '')
);

const readEntityId = (entity = {}) => entity.id || entity.cycleId || entity.harvestId;

const readDeviceFromResponse = (payload) => {
  const candidate = payload?.data?.data?.device
    || payload?.data?.device
    || payload?.device
    || payload;

  return candidate && (candidate.deviceId || candidate.id) ? candidate : null;
};

const chartAxisTick = {
  fill: 'var(--text-primary)',
  fontSize: 11,
  fontFamily: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace',
};

const chartAxisFormatter = (value) => Number(value).toFixed(2);

const chartTooltipStyle = {
  backgroundColor: '#FFFFFF',
  border: '1px solid rgba(123, 94, 60, 0.15)',
  borderRadius: '8px',
  boxShadow: '0 18px 36px rgba(123, 94, 60, 0.08)',
  color: '#2E2E2E',
};

const chartTooltipLabelStyle = {
  color: 'var(--text-primary)',
  fontWeight: 700,
};

const chartGridStroke = 'rgba(231, 220, 198, 0.1)';

const getSensorLabel = (type, value) => {
  if (value == null) return { label: 'Belum ada data', className: 'text-muted' };
  if (type === 'temperature') {
    if (value < 20 || value > 32) return { label: 'Perlu dicek', className: 'text-error' };
    if (value < 24 || value > 30) return { label: 'Waspada', className: 'text-earth' };
    return { label: 'Normal', className: 'text-sage' };
  }
  if (value < 65 || value > 95) return { label: 'Perlu dicek', className: 'text-error' };
  if (value < 75 || value > 90) return { label: 'Waspada', className: 'text-earth' };
  return { label: 'Normal', className: 'text-sage' };
};

const createDashboardAlerts = (devices, readings, nowTime) => {
  const alerts = [];
  const readingByDevice = new Map(readings.map((reading) => [reading.deviceId, reading]));

  devices.forEach((device) => {
    const deviceId = device.deviceId || device.id;
    const name = device.name || deviceId;
    const reading = readingByDevice.get(deviceId);
    const temperature = readTemperature(reading?.sensor);
    const humidity = readHumidity(reading?.sensor);

    if (!device.isOnline) {
      alerts.push({
        id: `${deviceId}-offline`,
        text: `${name} sedang offline`,
        time: formatRelativeTime(device.lastSeenAt, nowTime),
        type: 'error',
      });
      return;
    }

    if (temperature != null && (temperature < 20 || temperature > 32)) {
      alerts.push({
        id: `${deviceId}-temp`,
        text: `Suhu ${name} di luar batas (${Number(temperature).toFixed(2)}°C)`,
        time: formatRelativeTime(reading?.sensor?.createdAt || reading?.sensor?.recordedAt, nowTime),
        type: 'warning',
      });
    }

    if (humidity != null && (humidity < 65 || humidity > 95)) {
      alerts.push({
        id: `${deviceId}-hum`,
        text: `Kelembaban ${name} di luar batas (${Number(humidity).toFixed(2)}%)`,
        time: formatRelativeTime(reading?.sensor?.createdAt || reading?.sensor?.recordedAt, nowTime),
        type: 'warning',
      });
    }
  });

  return alerts;
};

const downsampleData = (data, maxPoints = 48) => {
  if (data.length <= maxPoints) return data;
  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, index) => index % step === 0 || index === data.length - 1);
};

// --- Toast Notification Component ---
const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = {
    success: 'bg-sage',
    error: 'bg-error',
    warning: 'bg-amber-500',
    info: 'bg-blue'
  }[type];

  const icon = {
    success: <Check size={20} />,
    error: <X size={20} />,
    warning: <AlertCircle size={20} />,
    info: <Info size={20} />
  }[type];

  return (
    <motion.div
      className={`toast-notification ${bgColor}`}
      initial={{ opacity: 0, y: -20, x: 20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: -20, x: 20 }}
      transition={{ duration: 0.3 }}
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        borderRadius: '8px',
        color: '#fff',
        fontSize: '0.9rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        fontWeight: '500'
      }}
    >
      {icon}
      {message}
    </motion.div>
  );
};

// --- Dummy Data ---
const notifications = [
  { id: 1, text: 'Suhu tinggi terdeteksi di Kumbung Utama', time: '10 menit yang lalu', type: 'error' },
  { id: 2, text: 'Kelembaban rendah di Kumbung B', time: '1 jam yang lalu', type: 'warning' },
  { id: 3, text: 'Kumbung C offline', time: '2 jam yang lalu', type: 'error' },
  { id: 4, text: 'Laporan mingguan telah siap', time: '1 hari yang lalu', type: 'info' },
  { id: 5, text: 'Suhu kembali normal di Kumbung Utama', time: '1 hari yang lalu', type: 'success' },
];

const getHeaderContext = (title = '') => {
  const loweredTitle = title.toLowerCase();
  if (loweredTitle.includes('dashboard')) return { Icon: LayoutDashboard, tone: 'dashboard' };
  if (loweredTitle.includes('kumbung')) return { Icon: Home, tone: 'farm' };
  if (loweredTitle.includes('siklus') || loweredTitle.includes('panen')) return { Icon: Sprout, tone: 'farm' };
  if (loweredTitle.includes('monitoring')) return { Icon: Activity, tone: 'sensor' };
  if (loweredTitle.includes('kontrol')) return { Icon: Sliders, tone: 'control' };
  if (loweredTitle.includes('notifikasi')) return { Icon: Bell, tone: 'notify' };
  if (loweredTitle.includes('profil')) return { Icon: User, tone: 'profile' };
  if (loweredTitle.includes('teknisi')) return { Icon: Wrench, tone: 'system' };
  if (loweredTitle.includes('admin')) return { Icon: Shield, tone: 'system' };
  return { Icon: CircuitBoard, tone: 'system' };
};

// Daftar rute halaman yang valid di aplikasi ShroomSync per peran
const FARMER_PAGES = [
  'dashboard',
  'kumbung',
  'monitoring',
  'siklus',
  'kontrol',
  'notifikasi',
  'profil',
];

const ADMIN_PAGES = ['admin', 'profil'];
const TECHNICIAN_PAGES = ['technician', 'profil'];

// Helper untuk membaca target halaman awal dari URL bar atau storage dengan proteksi peran
const resolveInitialPage = () => {
  try {
    const storedUser = api.auth.getUser();
    const role = storedUser?.role?.toUpperCase();

    let path = '';
    let hash = '';
    if (typeof window !== 'undefined') {
      path = window.location.pathname.replace(/^\/+/, '').split('/')[0].toLowerCase();
      hash = window.location.hash.replace(/^#\/?/, '').split('/')[0].toLowerCase();
    }
    const urlTarget = path || hash;
    const saved = localStorage.getItem('shroomsync_active_page')?.toLowerCase();

    // ADMIN: HANYA portal admin atau profil
    if (role === 'ADMIN') {
      if (urlTarget && ADMIN_PAGES.includes(urlTarget)) return urlTarget;
      if (saved && ADMIN_PAGES.includes(saved)) return saved;
      return 'admin';
    }

    // TECHNICIAN: HANYA portal teknisi atau profil
    if (role === 'TECHNICIAN') {
      if (urlTarget && TECHNICIAN_PAGES.includes(urlTarget)) return urlTarget;
      if (saved && TECHNICIAN_PAGES.includes(saved)) return saved;
      return 'technician';
    }

    // FARMER: HANYA halaman-halaman petani (tidak bisa buka admin/technician)
    if (urlTarget && FARMER_PAGES.includes(urlTarget) && urlTarget !== 'admin' && urlTarget !== 'technician') {
      return urlTarget;
    }
    if (saved && FARMER_PAGES.includes(saved) && saved !== 'admin' && saved !== 'technician') {
      return saved;
    }
  } catch {
    // ignore
  }
  return 'dashboard';
};

// --- Sidebar Component ---
const Sidebar = ({ activePage, setActivePage, activeTechTab = 'dashboard', setActiveTechTab, activeAdminTab = 'dashboard', setActiveAdminTab, isOpen, onClose, currentUser, onLogout, theme, toggleTheme }) => {
  const storedUser = api.auth.getUser();
  const rawRole = currentUser?.role || storedUser?.role || 'FARMER';
  const role = String(rawRole).toUpperCase();

  const isTechUser = role === 'TECHNICIAN';
  const isAdminUser = role === 'ADMIN';
  const isFarmerUser = !isTechUser && !isAdminUser;

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="logo-container">
          <div className="logo-icon" style={{ width: '50px', height: '50px', minWidth: '50px', minHeight: '50px' }}>
            <img src="/log.svg?v=2" alt="ShroomSync" style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'contain',
              display: 'block'
            }} />
          </div>
          <h1 className="logo-text">ShroomSync</h1>
        </div>

        <div className="sidebar-profile" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '12px 14px' }}>
          <div className="profile-avatar" style={{
            background: isTechUser ? 'var(--earth-brown)' : isAdminUser ? 'var(--earth-brown)' : 'var(--sage-deep)',
            color: '#FFFFFF'
          }}>
            {isTechUser ? <Wrench size={20} /> : isAdminUser ? <Shield size={20} /> : <Sprout size={20} />}
          </div>
          <div className="profile-info">
            <h4 title={currentUser?.fullName || currentUser?.username} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)', fontWeight: 700 }}>
              {currentUser?.fullName || currentUser?.username || (isTechUser ? 'Teknisi Utama' : isAdminUser ? 'Admin Wilayah' : 'Petani Mitra')}
            </h4>
            {isTechUser ? (
              <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: 'var(--earth-brown)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                ADMIN PUSAT
              </p>
            ) : isAdminUser ? (
              <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: 'var(--earth-brown)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                ADMIN WILAYAH
              </p>
            ) : (
              <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: 'var(--sage-green)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                PETANI KUMBUNG
              </p>
            )}
          </div>
        </div>

        <nav className="nav-menu">
          {/* Petani Navigation - Khusus Petani */}
          {isFarmerUser && (
            <>
              <a href="#" className={`nav-item tech-nav ${activePage === 'dashboard' ? 'tech-active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('dashboard'); onClose?.(); }}>
                <LayoutDashboard size={20} />
                <span>Dashboard</span>
              </a>
              <a href="#" className={`nav-item tech-nav ${activePage === 'kumbung' ? 'tech-active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('kumbung'); onClose?.(); }}>
                <Home size={20} />
                <span>Kumbung Saya</span>
              </a>
              <a href="#" className={`nav-item tech-nav ${activePage === 'monitoring' ? 'tech-active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('monitoring'); onClose?.(); }}>
                <Activity size={20} />
                <span>Monitoring</span>
              </a>
              <a href="#" className={`nav-item tech-nav ${activePage === 'siklus' ? 'tech-active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('siklus'); onClose?.(); }}>
                <Sprout size={20} />
                <span>Siklus & Panen</span>
              </a>
              <a href="#" className={`nav-item tech-nav ${activePage === 'kontrol' ? 'tech-active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('kontrol'); onClose?.(); }}>
                <Sliders size={20} />
                <span>Kontrol</span>
              </a>
              <a href="#" className={`nav-item tech-nav ${activePage === 'notifikasi' ? 'tech-active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('notifikasi'); onClose?.(); }}>
                <Bell size={20} />
                <span>Notifikasi</span>
              </a>
            </>
          )}

          {/* Teknisi Navigation - Khusus Teknisi (Aligned with ShroomSync - DashboardAdmin.html) */}
          {isTechUser && (
            <>
              <a 
                href="#" 
                className={`nav-item tech-nav ${activePage === 'technician' && (activeTechTab === 'dashboard' || !activeTechTab) ? 'tech-active' : ''}`} 
                onClick={(e) => { e.preventDefault(); setActivePage('technician'); setActiveTechTab?.('dashboard'); onClose?.(); }}
              >
                <LayoutDashboard size={20} />
                <span>Dashboard Sistem</span>
              </a>
              <a 
                href="#" 
                className={`nav-item tech-nav ${activePage === 'technician' && activeTechTab === 'inventory' ? 'tech-active' : ''}`} 
                onClick={(e) => { e.preventDefault(); setActivePage('technician'); setActiveTechTab?.('inventory'); onClose?.(); }}
              >
                <Cpu size={20} />
                <span>Device Registry</span>
              </a>
              <a 
                href="#" 
                className={`nav-item tech-nav ${activePage === 'technician' && activeTechTab === 'ota' ? 'tech-active' : ''}`} 
                onClick={(e) => { e.preventDefault(); setActivePage('technician'); setActiveTechTab?.('ota'); onClose?.(); }}
              >
                <Zap size={20} />
                <span>Firmware Manager</span>
              </a>
              <a 
                href="#" 
                className={`nav-item tech-nav ${activePage === 'technician' && activeTechTab === 'admins' ? 'tech-active' : ''}`} 
                onClick={(e) => { e.preventDefault(); setActivePage('technician'); setActiveTechTab?.('admins'); onClose?.(); }}
              >
                <Users size={20} />
                <span>Manajemen Petani</span>
              </a>
              <a 
                href="#" 
                className={`nav-item tech-nav ${activePage === 'technician' && activeTechTab === 'logs' ? 'tech-active' : ''}`} 
                onClick={(e) => { e.preventDefault(); setActivePage('technician'); setActiveTechTab?.('logs'); onClose?.(); }}
              >
                <Terminal size={20} />
                <span>Device Logs</span>
              </a>
              <a 
                href="#" 
                className={`nav-item tech-nav ${activePage === 'technician' && activeTechTab === 'diagnostics' ? 'tech-active' : ''}`} 
                onClick={(e) => { e.preventDefault(); setActivePage('technician'); setActiveTechTab?.('diagnostics'); onClose?.(); }}
              >
                <Activity size={20} />
                <span>Health Monitor</span>
              </a>
            </>
          )}

          {/* Admin Navigation - Khusus Admin Wilayah (Aligned with Technician Sidebar Pattern) */}
          {isAdminUser && (
            <>
              <a 
                href="#" 
                className={`nav-item tech-nav ${activePage === 'admin' && (activeAdminTab === 'dashboard' || !activeAdminTab) ? 'tech-active' : ''}`} 
                onClick={(e) => { e.preventDefault(); setActivePage('admin'); setActiveAdminTab?.('dashboard'); onClose?.(); }}
              >
                <LayoutDashboard size={20} />
                <span>Dashboard Wilayah</span>
              </a>
              <a 
                href="#" 
                className={`nav-item tech-nav ${activePage === 'admin' && activeAdminTab === 'farmers' ? 'tech-active' : ''}`} 
                onClick={(e) => { e.preventDefault(); setActivePage('admin'); setActiveAdminTab?.('farmers'); onClose?.(); }}
              >
                <Users size={20} />
                <span>Petani Binaan</span>
              </a>
              <a 
                href="#" 
                className={`nav-item tech-nav ${activePage === 'admin' && activeAdminTab === 'assignment' ? 'tech-active' : ''}`} 
                onClick={(e) => { e.preventDefault(); setActivePage('admin'); setActiveAdminTab?.('assignment'); onClose?.(); }}
              >
                <Link size={20} />
                <span>Penugasan SupaKu</span>
              </a>
            </>
          )}

          {/* Menu Umum: Profil */}
          <a 
            href="#" 
            className={`nav-item tech-nav ${activePage === 'profil' ? 'tech-active' : ''}`} 
            onClick={(e) => { e.preventDefault(); setActivePage('profil'); onClose?.(); }}
          >
            <User size={20} />
            <span>Profil</span>
          </a>
        </nav>

        <div className="sidebar-footer">
          {isTechUser && (
            <div style={{ padding: '8px 16px 12px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px' }}>
              <Info size={14} style={{ color: 'var(--earth-brown)' }} />
              <span>System v2.4.0</span>
            </div>
          )}
          {isAdminUser && (
            <div style={{ padding: '8px 16px 12px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px' }}>
              <Shield size={14} style={{ color: 'var(--earth-brown)' }} />
              <span>Regional Portal</span>
            </div>
          )}
          {isFarmerUser && (
            <div style={{ padding: '8px 16px 12px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px' }}>
              <Sprout size={14} style={{ color: 'var(--sage-green)' }} />
              <span>Farmer Portal</span>
            </div>
          )}
          {toggleTheme && (
            <button 
              type="button" 
              className="sidebar-theme-toggle" 
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
            >
              {theme === 'dark' ? <Sun size={17} style={{ color: 'var(--accent, #F59E0B)' }} /> : <Moon size={17} style={{ color: 'var(--earth-brown)' }} />}
              <span>{theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</span>
            </button>
          )}
          <a href="#" className="nav-item" onClick={(e) => { e.preventDefault(); onLogout?.(); onClose?.(); }}>
            <LogOut size={20} />
            <span>Keluar Sesi</span>
          </a>
        </div>
      </aside>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
    </>
  );
};

// --- Header Component ---
const Header = ({ title, subtitle, actions, onBack, onMenuToggle, breadcrumb, statusBadge }) => {
  const { Icon: HeaderIcon, tone } = getHeaderContext(title);

  return (
    <header className="header" data-page-tone={tone}>
      <div className="header-title">
        {onMenuToggle && (
          <button className="mobile-menu-toggle" onClick={onMenuToggle} aria-label="Buka menu navigasi">
            <Menu size={24} />
          </button>
        )}
        {onBack && (
          <button className="icon-button back-btn" onClick={onBack} aria-label="Kembali">
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="header-title-badge" aria-hidden="true">
          <HeaderIcon size={20} />
        </div>
        <div className="header-copy">
          {breadcrumb && breadcrumb.length > 0 && (
            <div className="header-breadcrumb">
              {breadcrumb.map((crumb, idx) => (
                <span key={idx} className="breadcrumb-segment">
                  {idx > 0 && <ChevronRight size={10} className="breadcrumb-separator" />}
                  <span className={idx === breadcrumb.length - 1 ? 'active-crumb' : 'crumb-item'}>
                    {crumb}
                  </span>
                </span>
              ))}
            </div>
          )}
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      <div className="header-actions">
        {statusBadge}
        {actions}
      </div>
    </header>
  );
};

// --- 1. Dashboard Content ---
const DashboardContent = ({ devices, setSelectedDeviceId, setActivePage, onMenuToggle, liveSensorEvent, liveHistoryEvent, theme, toggleTheme }) => {
  const onlineCount = devices.filter(d => d.isOnline).length;
  const [dashboardDeviceId, setDashboardDeviceId] = useState(null);
  const [latestReadings, setLatestReadings] = useState([]);
  const [dashboardHistory, setDashboardHistory] = useState([]);
  const [dashboardLogs, setDashboardLogs] = useState([]);
  const [dashboardNow, setDashboardNow] = useState(new Date().getTime());

  const deviceIds = devices.map((device) => device.deviceId || device.id);
  const deviceIdKey = deviceIds.join('|');
  const deviceIdSet = new Set(deviceIds);
  const validLatestReadings = latestReadings.filter((reading) => deviceIdSet.has(reading.deviceId));
  const activeDashboardDeviceId = dashboardDeviceId || devices[0]?.deviceId || devices[0]?.id || null;
  const activeDashboardDevice = devices.find((device) => (device.deviceId || device.id) === activeDashboardDeviceId);
  const activeReading = validLatestReadings.find((reading) => reading.deviceId === activeDashboardDeviceId)?.sensor;
  const activeTemperature = readTemperature(activeReading);
  const activeHumidity = readHumidity(activeReading);
  const temperatureStatus = getSensorLabel('temperature', activeTemperature);
  const humidityStatus = getSensorLabel('humidity', activeHumidity);
  const averageTemperature = validLatestReadings
    .map((reading) => readTemperature(reading.sensor))
    .filter((value) => value != null);
  const averageHumidity = validLatestReadings
    .map((reading) => readHumidity(reading.sensor))
    .filter((value) => value != null);
  const dashboardAlerts = createDashboardAlerts(devices, validLatestReadings, dashboardNow);
  const formattedDashboardHistory = activeDashboardDeviceId ? downsampleData(
    (() => {
      let records = [...dashboardHistory];
      if (records.length === 0 && activeReading) {
        records = [{ ...activeReading, deviceId: activeDashboardDeviceId }];
      }
      const mapped = records
        .map((record) => {
          const date = getReadingDate(record) || new Date();
          return {
            ...record,
            temp: readTemperature(record),
            hum: readHumidity(record),
            readingDate: date,
            time: date ? date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--',
          };
        })
        .filter((record) => record.readingDate && record.temp != null && record.hum != null)
        .sort((a, b) => a.readingDate - b.readingDate);

      if (mapped.length === 1) {
        const single = mapped[0];
        const prevDate = new Date(single.readingDate.getTime() - 60 * 1000);
        return [
          {
            ...single,
            readingDate: prevDate,
            time: prevDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          },
          single,
        ];
      }
      return mapped;
    })(),
    36
  ) : [];
  
  const handleDeviceClick = (deviceId) => {
    setSelectedDeviceId(deviceId);
    setActivePage('monitoring');
  };

  useEffect(() => {
    if (!deviceIdKey) return undefined;

    let cancelled = false;
    const fetchDashboardLatest = async () => {
      const currentDeviceIds = deviceIdKey.split('|').filter(Boolean);

      try {
        const readingResults = await Promise.allSettled(
          currentDeviceIds.map((deviceId) => api.telemetry.getSensorLatest(deviceId))
        );

        if (cancelled) return;

        setDashboardNow(new Date().getTime());
        const validReadings = readingResults
          .map((result, index) => ({
            deviceId: currentDeviceIds[index],
            sensor: result.status === 'fulfilled' ? result.value : null,
          }))
          .filter((reading) => reading.sensor);

        setLatestReadings(validReadings);

        const currentActiveSensor = validReadings.find((r) => r.deviceId === activeDashboardDeviceId)?.sensor;
        if (currentActiveSensor) {
          setDashboardHistory((prevHistory) => (
            mergeRealtimeRecord(prevHistory, {
              ...currentActiveSensor,
              deviceId: activeDashboardDeviceId,
            }, { limit: REALTIME_SENSOR_HISTORY_LIMIT })
          ));
        }
      } catch (error) {
        console.error('Dashboard latest fetch failed:', error);
      }
    };

    fetchDashboardLatest();
    const interval = setInterval(fetchDashboardLatest, DASHBOARD_LATEST_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeDashboardDeviceId, deviceIdKey]);

  useEffect(() => {
    if (!activeReading || !activeDashboardDeviceId) return undefined;
    const timeoutId = window.setTimeout(() => {
      setDashboardHistory((prevHistory) => (
        mergeRealtimeRecord(prevHistory, {
          ...activeReading,
          deviceId: activeDashboardDeviceId,
        }, { limit: REALTIME_SENSOR_HISTORY_LIMIT })
      ));
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [activeDashboardDeviceId, activeReading]);

  useEffect(() => {
    if (!activeDashboardDeviceId) return undefined;

    let cancelled = false;
    const fetchDashboardHistory = async () => {
      try {
        const from = new Date(new Date().getTime() - 10 * 60 * 1000).toISOString();

        let [historyResult, logsResult] = await Promise.all([
          api.telemetry.getSensorHistory(activeDashboardDeviceId, { from, limit: 180 }).catch(() => []),
          api.telemetry.getHistory(activeDashboardDeviceId, { limit: 6 }).catch(() => []),
        ]);

        // Fallback: Jika data 10 menit terakhir kosong (misal sensor jeda kirim atau baru aktif),
        // otomatis ambil riwayat sensor terkini tanpa parameter 'from'
        if (!Array.isArray(historyResult) || historyResult.length === 0) {
          historyResult = await api.telemetry.getSensorHistory(activeDashboardDeviceId, { limit: 60 }).catch(() => []);
        }

        if (cancelled) return;

        if (Array.isArray(historyResult) && historyResult.length > 0) {
          setDashboardHistory((prevHistory) => {
            let merged = [...historyResult];
            prevHistory.forEach((item) => {
              merged = mergeRealtimeRecord(merged, item, { limit: REALTIME_SENSOR_HISTORY_LIMIT });
            });
            return merged;
          });
        }
        setDashboardLogs(Array.isArray(logsResult) ? logsResult : []);
      } catch (error) {
        console.error('Dashboard history fetch failed:', error);
      }
    };

    fetchDashboardHistory();
    const interval = setInterval(fetchDashboardHistory, DASHBOARD_HISTORY_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeDashboardDeviceId]);

  useEffect(() => {
    if (!liveSensorEvent?.record) return;
    const currentDeviceIds = deviceIdKey ? deviceIdKey.split('|') : [];
    if (!currentDeviceIds.includes(liveSensorEvent.deviceId)) return;

    window.setTimeout(() => {
      setDashboardNow(liveSensorEvent.receivedAt);
      setLatestReadings((prevReadings) => (
        upsertLatestReading(prevReadings, liveSensorEvent.deviceId, liveSensorEvent.record)
      ));

      if (liveSensorEvent.deviceId === activeDashboardDeviceId) {
        setDashboardHistory((prevHistory) => (
          mergeRealtimeRecord(prevHistory, liveSensorEvent.record, { limit: REALTIME_SENSOR_HISTORY_LIMIT })
        ));
      }
    }, 0);
  }, [activeDashboardDeviceId, deviceIdKey, liveSensorEvent]);

  useEffect(() => {
    if (!liveHistoryEvent?.record) return;
    const currentDeviceIds = deviceIdKey ? deviceIdKey.split('|') : [];
    if (!currentDeviceIds.includes(liveHistoryEvent.deviceId)) return;

    window.setTimeout(() => {
      if (readTemperature(liveHistoryEvent.record) != null || readHumidity(liveHistoryEvent.record) != null) {
        setLatestReadings((prevReadings) => (
          upsertLatestReading(prevReadings, liveHistoryEvent.deviceId, liveHistoryEvent.record)
        ));
      }

      if (liveHistoryEvent.deviceId !== activeDashboardDeviceId) return;

      setDashboardLogs((prevLogs) => (
        mergeRealtimeRecord(prevLogs, liveHistoryEvent.record, { limit: REALTIME_LOG_LIMIT, newestFirst: true })
      ));

      if (readTemperature(liveHistoryEvent.record) != null || readHumidity(liveHistoryEvent.record) != null) {
        setDashboardHistory((prevHistory) => (
          mergeRealtimeRecord(prevHistory, liveHistoryEvent.record, { limit: REALTIME_SENSOR_HISTORY_LIMIT })
        ));
      }
    }, 0);
  }, [activeDashboardDeviceId, deviceIdKey, liveHistoryEvent]);

  return (
    <>
      <Header 
        title="Dashboard" 
        subtitle="Ringkasan kondisi kumbung Anda hari ini."
        breadcrumb={['Petani Panel', 'Dashboard Kumbung']}
        onMenuToggle={onMenuToggle}
        actions={
          <>
            <div className="header-status-badge">
              <span className="header-pulse-dot" />
              <span>Kumbung Aktif: <strong>{onlineCount}/{devices.length} Online</strong></span>
            </div>
            <div className="kumbung-selector">
              <select
                value={activeDashboardDeviceId || ''}
                onChange={(event) => setDashboardDeviceId(event.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer', fontWeight: 700, color: 'var(--text-primary)' }}
              >
                {devices.length === 0 && <option value="">Belum ada kumbung</option>}
                {devices.map((device) => (
                  <option key={device.deviceId || device.id} value={device.deviceId || device.id}>
                    {device.name || device.deviceId || device.id}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="chevron-icon" />
            </div>
            {toggleTheme && (
              <button 
                type="button" 
                className="icon-button header-theme-toggle" 
                onClick={toggleTheme} 
                title={theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
                aria-label="Toggle Theme"
              >
                {theme === 'dark' ? <Sun size={18} style={{ color: '#FBBF24' }} /> : <Moon size={18} style={{ color: 'var(--earth-brown)' }} />}
              </button>
            )}
            <button className="icon-button notification-btn" onClick={() => setActivePage('notifikasi')} title="Pusat Notifikasi" aria-label="Buka notifikasi">
              <Bell size={20} />
            </button>
          </>
        }
      />
      
      <div className="dashboard-content">
        <motion.div 
          className="stats-row"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Card 1: Total Kumbung */}
          <div className="stat-card minimal">
            <span className="stat-title">
              <span>Total Kumbung</span>
              <Home size={14} style={{ color: 'var(--earth-brown, #7B5E3C)' }} />
            </span>
            <div className="stat-value">{devices.length}</div>
            <div className="stat-status text-earth">Terdaftar di akun</div>
          </div>

          {/* Card 2: Kumbung Online */}
          <div className="stat-card minimal">
            <span className="stat-title">
              <span>Kumbung Online</span>
              <Wifi size={14} style={{ color: '#059669' }} />
            </span>
            <div className="stat-value">{onlineCount}</div>
            <div className="stat-status text-sage">{devices.length > 0 ? Math.round((onlineCount / devices.length) * 100) : 0}% terhubung aktif</div>
          </div>

          {/* Card 3: Status Operasi & Jadwal */}
          <div className="stat-card minimal" style={{ cursor: 'pointer' }} onClick={() => setActivePage('kontrol')} title="Buka kontrol & parameter">
            <span className="stat-title">
              <span>Mode Operasi</span>
              <Clock size={14} style={{ color: 'var(--sage-green, #10B981)' }} />
            </span>
            <div className="stat-value">
              {activeDashboardDevice?.config?.controlMode === 1 ? 'Manual' : 
               activeDashboardDevice?.config?.controlMode === 3 ? 'Hybrid' : 'Otomatis'}
            </div>
            <div className="stat-status text-sage">
              {activeDashboardDevice?.config?.controlMode === 1 
                ? 'Aktuator Langsung' 
                : activeDashboardDevice?.config?.scheduleMode 
                ? `${activeDashboardDevice.config.scheduleMode}x Sehari` 
                : 'Sensor Setpoint'}
            </div>
          </div>

          {/* Card 4: Suhu Rata-rata */}
          <div className="stat-card minimal">
            <span className="stat-title">
              <span>Suhu Rata-rata</span>
              <Thermometer size={14} style={{ color: '#E07A5F' }} />
            </span>
            <div className="stat-value">
              {averageTemperature.length > 0
                ? formatMetric(averageTemperature.reduce((sum, value) => sum + value, 0) / averageTemperature.length, '°C')
                : '--'}
            </div>
            <div className="stat-status text-sage">{averageTemperature.length} sensor aktif</div>
          </div>

          {/* Card 5: Kelembaban Rata-rata */}
          <div className="stat-card minimal">
            <span className="stat-title">
              <span>Kelembaban Rata-rata</span>
              <Droplets size={14} style={{ color: '#2D6F6A' }} />
            </span>
            <div className="stat-value">
              {averageHumidity.length > 0
                ? formatMetric(averageHumidity.reduce((sum, value) => sum + value, 0) / averageHumidity.length, '%')
                : '--'}
            </div>
            <div className="stat-status text-sage">{averageHumidity.length} sensor aktif</div>
          </div>

          {/* Card 6: Alert Aktif */}
          <div className="stat-card minimal" style={{ cursor: dashboardAlerts.length > 0 ? 'pointer' : 'default' }} onClick={() => dashboardAlerts.length > 0 && setActivePage('notifikasi')}>
            <span className="stat-title">
              <span>Status Peringatan</span>
              <AlertCircle size={14} style={{ color: dashboardAlerts.length > 0 ? '#DC2626' : '#059669' }} />
            </span>
            <div className="stat-value" style={{ color: dashboardAlerts.length > 0 ? '#DC2626' : 'var(--text-primary)' }}>
              {dashboardAlerts.length}
            </div>
            <div className="stat-status font-semibold" style={{ color: dashboardAlerts.length > 0 ? '#DC2626' : '#059669' }}>
              {dashboardAlerts.length > 0 ? 'Perlu Tindakan' : 'Semua Normal'}
            </div>
          </div>
        </motion.div>

        <div className="dashboard-grid">
          <motion.div 
            className="chart-section panel"
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            style={{ padding: '20px 24px' }}
          >
            <div className="panel-header" style={{ padding: '0 0 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>Kondisi Real-time Sensor</h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {activeDashboardDevice?.name || 'Kumbung Terpilih'} · Pemantauan suhu & kelembaban
                </p>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                <Activity size={13} style={{ color: 'var(--earth-brown)' }} />
                <span>{activeDashboardDevice?.name || 'Pilih Kumbung'}</span>
              </div>
            </div>

            {/* Metrik ringkas suhu & kelembaban */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', margin: '16px 0' }}>
              <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#E07A5F' }}>Suhu Terkini</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: '2px 0', lineHeight: 1.2 }}>{formatMetric(activeTemperature, '°C')}</div>
                <span className={`chart-status ${temperatureStatus.className}`} style={{ fontSize: '0.76rem', fontWeight: 600 }}>{temperatureStatus.label}</span>
              </div>
              <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--sage-green)' }}>Kelembaban Terkini</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: '2px 0', lineHeight: 1.2 }}>{formatMetric(activeHumidity, '%')}</div>
                <span className={`chart-status ${humidityStatus.className}`} style={{ fontSize: '0.76rem', fontWeight: 600 }}>{humidityStatus.label}</span>
              </div>
            </div>
            
            {formattedDashboardHistory.length > 0 ? (
              <div className="stacked-charts" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Grafik Suhu */}
                <div className="chart-row metric-temp">
                  <div className="chart-graph" style={{ height: '170px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={formattedDashboardHistory} margin={{ top: 8, right: 12, left: -10, bottom: 4 }}>
                        <defs>
                          <linearGradient id="dashboardTempGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--chart-temp-line)" stopOpacity={0.32}/>
                            <stop offset="95%" stopColor="var(--chart-temp-line)" stopOpacity={0.02}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 6" vertical={false} stroke={chartGridStroke} />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={chartAxisTick} dy={6} minTickGap={24} />
                        <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} tickFormatter={chartAxisFormatter} domain={['dataMin - 2', 'dataMax + 2']} />
                        <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} formatter={(value) => [`${Number(value).toFixed(2)}°C`, 'Suhu']} />
                        <Area 
                          type="monotone" 
                          dataKey="temp" 
                          stroke="var(--chart-temp-line)" 
                          strokeWidth={2.5} 
                          fillOpacity={1} 
                          fill="url(#dashboardTempGradient)" 
                          dot={formattedDashboardHistory.length <= 4 ? { r: 3.5, fill: 'var(--chart-temp-line)' } : false} 
                          activeDot={{ r: 5, strokeWidth: 0, fill: 'var(--chart-temp-line)' }} 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="chart-divider" style={{ height: '1px', backgroundColor: 'var(--border-color)' }}></div>

                {/* Grafik Kelembaban */}
                <div className="chart-row metric-hum">
                  <div className="chart-graph" style={{ height: '170px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={formattedDashboardHistory} margin={{ top: 8, right: 12, left: -10, bottom: 4 }}>
                        <defs>
                          <linearGradient id="dashboardHumGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--chart-hum-line)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--chart-hum-line)" stopOpacity={0.02}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 6" vertical={false} stroke={chartGridStroke} />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={chartAxisTick} dy={6} minTickGap={24} />
                        <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} tickFormatter={chartAxisFormatter} domain={['dataMin - 5', 'dataMax + 5']} />
                        <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Kelembaban']} />
                        <Area 
                          type="monotone" 
                          dataKey="hum" 
                          stroke="var(--chart-hum-line)" 
                          strokeWidth={2.5} 
                          fillOpacity={1} 
                          fill="url(#dashboardHumGradient)" 
                          dot={formattedDashboardHistory.length <= 4 ? { r: 3.5, fill: 'var(--chart-hum-line)' } : false} 
                          activeDot={{ r: 5, strokeWidth: 0, fill: 'var(--chart-hum-line)' }} 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: '14px',
                border: '1px dashed var(--border-color)',
                margin: '10px 0',
              }}>
                <Activity size={32} style={{ color: 'var(--earth-brown)', opacity: 0.5, margin: '0 auto 8px', display: 'block' }} />
                <h4 style={{ margin: '0 0 4px', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Belum Ada Riwayat Data Sensor
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Grafik telemetri suhu dan kelembaban akan tampil otomatis saat sensor SupaKu aktif mengirim data.
                </p>
              </div>
            )}
          </motion.div>

          <div className="lists-section">
            <motion.div 
              className="list-panel panel"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              style={{ padding: '20px 24px' }}
            >
              <div className="panel-header" style={{ padding: '0 0 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Status Kumbung</h3>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--earth-brown)', backgroundColor: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '6px' }}>
                  {devices.length} Unit
                </span>
              </div>
              <div className="device-list" style={{ marginTop: '14px', gap: '10px' }}>
                {devices.map((dev) => {
                  const deviceId = dev.deviceId || dev.id;
                  const reading = latestReadings.find((item) => item.deviceId === deviceId)?.sensor;
                  return (
                  <div className="device-item" key={deviceId} onClick={() => handleDeviceClick(deviceId)} style={{ cursor: 'pointer', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                    <div className="device-icon" style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--earth-brown)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Home size={16} />
                    </div>
                    <div className="device-info">
                      <h4 style={{ margin: '0 0 2px', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>{dev.name || deviceId}</h4>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {formatMetric(readTemperature(reading), '°C')} · {formatMetric(readHumidity(reading), '%')} ·{' '}
                        <span className={dev.isOnline ? 'text-sage' : 'text-error'} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 700 }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dev.isOnline ? '#10B981' : '#EF4444' }} />
                          {dev.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </p>
                    </div>
                  </div>
                )})}
                {devices.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--text-muted)' }}>
                    <Home size={28} style={{ margin: '0 auto 6px', opacity: 0.35, display: 'block' }} />
                    <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 2px' }}>Belum ada kumbung</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Tautkan kumbung Anda di menu Kumbung Saya</p>
                  </div>
                )}
              </div>
              <a href="#" className="view-all" style={{ marginTop: 'auto', paddingTop: '10px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--earth-brown)' }} onClick={(e) => { e.preventDefault(); setActivePage('kumbung'); }}>
                Lihat Semua Kumbung &rarr;
              </a>
            </motion.div>

            <motion.div 
              className="list-panel panel"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              style={{ padding: '20px 24px' }}
            >
              <div className="panel-header" style={{ padding: '0 0 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Notifikasi Terbaru</h3>
                <Bell size={15} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div className="notif-list" style={{ marginTop: '14px', gap: '10px' }}>
                {(dashboardAlerts.length > 0 ? dashboardAlerts : dashboardLogs.slice(0, 3).map((log, index) => ({
                  id: log.id || `log-${index}`,
                  text: formatHistoryActivity(log),
                  time: formatRelativeTime(log.createdAt || log.recordedAt || log.time, dashboardNow),
                  type: 'info',
                }))).slice(0,3).map((notif) => (
                  <div className="notif-item" key={notif.id} style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                    <div className={`notif-icon ${notif.type}`} style={{ width: '32px', height: '32px', borderRadius: '8px' }}>
                      <AlertCircle size={15} />
                    </div>
                    <div className="notif-info">
                      <p style={{ margin: '0 0 2px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{notif.text}</p>
                      <span className="time" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{notif.time}</span>
                    </div>
                  </div>
                ))}
                {dashboardAlerts.length === 0 && dashboardLogs.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--text-muted)' }}>
                    <Bell size={28} style={{ margin: '0 auto 6px', opacity: 0.35, display: 'block' }} />
                    <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 2px' }}>Semua kondisi normal</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Tidak ada peringatan aktif saat ini</p>
                  </div>
                )}
              </div>
              <a href="#" className="view-all" style={{ marginTop: 'auto', paddingTop: '10px', fontSize: '0.82rem', fontWeight: 700, color: '#7B5E3C' }} onClick={(e) => { e.preventDefault(); setActivePage('notifikasi'); }}>
                Lihat Semua Notifikasi &rarr;
              </a>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
};

// --- 2. Kumbung Page Content ---
const KumbungContent = ({ setActivePage, devices, refetchDevices, setSelectedDeviceId, onMenuToggle }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: '', deviceId: '', activationCode: '' });
  const [toast, setToast] = useState(null);

  const handleScanSuccess = (scanned) => {
    setNewDevice((prev) => ({
      name: scanned.name || prev.name || (scanned.deviceId ? `Kumbung ${scanned.deviceId}` : ''),
      deviceId: scanned.deviceId || prev.deviceId,
      activationCode: scanned.activationCode || prev.activationCode || '',
    }));
    setShowAddModal(true);
    setToast({ 
      message: `✓ Barcode terbaca: ${scanned.deviceId}${scanned.name ? ` (${scanned.name})` : ''}`, 
      type: 'success' 
    });
  };

  const handleAddDevice = async () => {
    if (!newDevice.name || !newDevice.deviceId) {
      setToast({ message: 'Nama dan ID Perangkat harus diisi', type: 'warning' });
      return;
    }
    try {
      const deviceId = newDevice.deviceId.trim();
      const name = newDevice.name.trim();
      const activationCode = newDevice.activationCode?.trim() || undefined;

      if (!api.auth.isAuthenticated()) {
        setToast({ 
          message: 'Silakan login dengan akun petani Anda terlebih dahulu untuk menautkan kumbung.', 
          type: 'warning' 
        });
        return;
      }

      await api.devices.activate({
        deviceId,
        name,
        activationCode,
      });

      // Refetch devices from server
      await refetchDevices();
      setToast({ message: '✓ Perangkat kumbung berhasil diaktivasi', type: 'success' });
      setShowAddModal(false);
      setNewDevice({ name: '', deviceId: '', activationCode: '' });
    } catch (error) {
      console.error('Activation failed:', error);
      const msg = error.payload?.message || error.message || error.getUserMessage?.() || 'Gagal menambahkan kumbung';
      setToast({ message: msg, type: 'error' });
    }
  };

  const handleDetailClick = (kumbung) => {
    setSelectedDeviceId(kumbung.deviceId || kumbung.id);
    setActivePage('monitoring');
  };

  const handleCyclesClick = (kumbung) => {
    setSelectedDeviceId(kumbung.deviceId || kumbung.id);
    setActivePage('siklus');
  };

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <Header 
        title="Kumbung Saya" 
        subtitle="Kelola semua kumbung yang Anda miliki."
        breadcrumb={['Petani Panel', 'Kumbung Saya']}
        onMenuToggle={onMenuToggle}
        actions={
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button 
              type="button"
              className="secondary-button" 
              onClick={() => setShowScannerModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '9px 16px',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.15s ease',
              }}
              title="Scan Barcode / QR SupaKu"
            >
              <ScanLine size={16} style={{ color: 'var(--earth-brown)' }} />
              <span>Scan Barcode</span>
            </button>
            <button 
              type="button"
              className="primary-button" 
              onClick={() => setShowAddModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#7B5E3C',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '12px',
                padding: '9px 18px',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(123, 94, 60, 0.25)',
                transition: 'all 0.15s ease',
              }}
            >
              <Plus size={16} />
              <span>Tambah Kumbung</span>
            </button>
          </div>
        }
      />
      
      <div className="page-content">
        <motion.div 
          className="table-panel"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="table-wrapper">
            <table className="data-table responsive-table">
              <thead>
                <tr>
                  <th>Nama Kumbung</th>
                  <th>Terakhir Terlihat</th>
                  <th>ID Perangkat</th>
                  <th>Jaringan & Uptime</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((k, idx) => (
                  <tr key={k.deviceId || k.id || idx}>
                    <td data-label="Nama" className="font-semibold" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                      {k.name}
                    </td>
                    <td data-label="Terakhir" className="text-muted" style={{ fontSize: '0.82rem', color: '#6B7280' }}>
                      {formatDateTime(k.lastSeenAt)}
                    </td>
                    <td data-label="ID">
                      <span style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-secondary)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        letterSpacing: '0.04em'
                      }}>
                        {k.deviceId || k.id}
                      </span>
                    </td>
                    <td data-label="Jaringan" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <Wifi size={12} style={{ color: k.isOnline ? '#059669' : '#9CA3AF' }} />
                          {k.isOnline ? formatWifi(k.rssiDbm) : '--'}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <Clock size={12} style={{ color: '#9CA3AF' }} />
                          {k.isOnline ? formatUptime(k.uptimeMs) : '--'}
                        </span>
                      </div>
                    </td>
                    <td data-label="Status">
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: k.isOnline ? '#ECFDF5' : '#FEF2F2',
                        color: k.isOnline ? '#059669' : '#DC2626',
                        border: `1px solid ${k.isOnline ? '#A7F3D0' : '#FECACA'}`,
                      }}>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: k.isOnline ? '#10B981' : '#EF4444',
                        }} />
                        {k.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td data-label="Aksi">
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleDetailClick(k)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: '#F5EFE6',
                            color: '#7B5E3C',
                            border: '1px solid rgba(123, 94, 60, 0.25)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#7B5E3C'; e.currentTarget.style.color = '#FFFFFF'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F5EFE6'; e.currentTarget.style.color = '#7B5E3C'; }}
                          title="Buka Monitoring Sensor Kumbung"
                        >
                          <Activity size={13} />
                          <span>Monitoring</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCyclesClick(k)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--earth-brown)'; e.currentTarget.style.color = 'var(--earth-brown)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                          title="Buka Siklus & Panen"
                        >
                          <Sprout size={13} />
                          <span>Siklus</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {devices.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                      <Home size={32} style={{ margin: '0 auto 8px', opacity: 0.35, display: 'block' }} />
                      <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', margin: '0 0 4px' }}>Belum ada kumbung terdaftar</p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Gunakan tombol "Tambah Kumbung" atau "Scan Barcode" untuk menautkan perangkat SupaKu Anda.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* Modal Tambah & Aktivasi Kumbung */}
      {showAddModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <motion.div className="modal-content" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '440px', maxWidth: '92vw', padding: '24px', backgroundColor: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--earth-brown)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>Aktivasi & Tautkan Kumbung</h3>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}
                title="Tutup"
              >
                <X size={20} />
              </button>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 18px 46px' }}>
              Tautkan serial number / Device ID SupaKu fisik ke akun kumbung Anda.
            </p>
            
            {/* Banner Tombol Cepat Scan Barcode */}
            <div 
              onClick={() => setShowScannerModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '14px',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px dashed var(--border-color-strong)',
                marginBottom: '18px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--earth-brown)', boxShadow: 'var(--shadow-sm)' }}>
                  <ScanLine size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Scan Barcode / QR Fisik
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Pindai stiker atau QR SupaKu
                  </div>
                </div>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--earth-brown)', fontWeight: 700 }}>
                Buka Kamera &rarr;
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nama Kumbung</label>
              <input 
                type="text" 
                placeholder="Misal: Kumbung A - Sayap Timur" 
                value={newDevice.name} 
                onChange={(e) => setNewDevice({...newDevice, name: e.target.value})} 
                style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none' }} 
              />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>ID Perangkat (Device ID)</label>
                <button
                  type="button"
                  onClick={() => setShowScannerModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--earth-brown)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '2px 4px',
                  }}
                >
                  <QrCode size={13} />
                  <span>Scan</span>
                </button>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="Misal: SS-005" 
                  value={newDevice.deviceId} 
                  onChange={(e) => setNewDevice({...newDevice, deviceId: e.target.value})} 
                  style={{ width: '100%', padding: '11px 42px 11px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', fontFamily: 'monospace' }} 
                />
                <button
                  type="button"
                  onClick={() => setShowScannerModal(true)}
                  title="Scan Barcode / QR Code"
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--earth-brown)',
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ScanLine size={18} />
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '22px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <Key size={13} style={{ color: 'var(--earth-brown)' }} />
                <span>Kode Aktivasi (Opsional)</span>
              </label>
              <input 
                type="text" 
                placeholder="Misal: ACT-XXXX atau SUPA-9921" 
                value={newDevice.activationCode || ''} 
                onChange={(e) => setNewDevice({...newDevice, activationCode: e.target.value.toUpperCase()})} 
                style={{ 
                  width: '100%', 
                  padding: '11px 14px', 
                  borderRadius: '10px', 
                  border: '1px solid var(--border-color)', 
                  backgroundColor: 'var(--bg-tertiary)', 
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  letterSpacing: '0.05em',
                  fontFamily: 'monospace',
                  outline: 'none'
                }} 
              />
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                *Terisi otomatis saat scan QR stiker fisik alat, atau ketik manual jika ada kode keamanan.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
              <button 
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Batal
              </button>
              <button 
                type="button"
                onClick={handleAddDevice}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#7B5E3C',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(123, 94, 60, 0.25)',
                }}
              >
                Simpan & Aktivasi
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Barcode & QR Scanner Modal */}
      <BarcodeScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onScanSuccess={handleScanSuccess}
      />

    </>
  );
};

// --- 3. Siklus & Panen Content ---
const SiklusPanenContent = ({ selectedDeviceId, setSelectedDeviceId, devices, selectedDevice, onMenuToggle }) => {
  const createDefaultCycleForm = () => ({
    name: '',
    mushroomType: 'Jamur Tiram',
    strain: 'Tiram Putih',
    baglogCount: '',
    startedAt: toDateInputValue(),
    expectedEndedAt: '',
    notes: '',
  });

  const createDefaultHarvestForm = () => ({
    harvestedAt: toDatetimeLocalValue(),
    weightKg: '',
    pricePerKg: '',
    grade: 'A',
    notes: '',
  });

  const [cycleStatusFilter, setCycleStatusFilter] = useState('active');
  const [cycles, setCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [harvests, setHarvests] = useState([]);
  const [cycleForm, setCycleForm] = useState(createDefaultCycleForm);
  const [harvestForm, setHarvestForm] = useState(createDefaultHarvestForm);
  const [completeForm, setCompleteForm] = useState({ endedAt: toDateInputValue(), notes: '' });
  const [editingHarvestId, setEditingHarvestId] = useState(null);
  const [cyclesLoading, setCyclesLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cyclesError, setCyclesError] = useState(null);
  const [detailError, setDetailError] = useState(null);
  const [submittingCycle, setSubmittingCycle] = useState(false);
  const [submittingHarvest, setSubmittingHarvest] = useState(false);
  const [completingCycle, setCompletingCycle] = useState(false);
  const [toast, setToast] = useState(null);
  const [deleteHarvestTarget, setDeleteHarvestTarget] = useState(null);
  const [isDeletingHarvest, setIsDeletingHarvest] = useState(false);

  const activeDeviceId = selectedDeviceId || devices[0]?.deviceId || devices[0]?.id || null;

  useEffect(() => {
    if (!selectedDeviceId && activeDeviceId) {
      setSelectedDeviceId(activeDeviceId);
    }
  }, [activeDeviceId, selectedDeviceId, setSelectedDeviceId]);

  const selectedCycle = useMemo(
    () => cycles.find((cycle) => readEntityId(cycle) === selectedCycleId) || null,
    [cycles, selectedCycleId]
  );
  const dailyBreakdown = useMemo(() => {
    if (Array.isArray(summary?.dailyBreakdown) && summary.dailyBreakdown.length > 0) {
      return summary.dailyBreakdown;
    }
    if (!Array.isArray(harvests) || harvests.length === 0) return [];

    const dailyMap = new Map();
    for (const h of harvests) {
      const date = parseReadingDate(h.harvestedAt) || new Date();
      const dayKey = date.toISOString().slice(0, 10);
      const existing = dailyMap.get(dayKey) || {
        date: dayKey,
        harvestCount: 0,
        totalWeightKg: 0,
        totalRevenue: 0,
      };
      existing.harvestCount += 1;
      existing.totalWeightKg += Number(h.weightKg) || 0;
      if (h.pricePerKg) {
        existing.totalRevenue += (Number(h.weightKg) || 0) * Number(h.pricePerKg);
      }
      dailyMap.set(dayKey, existing);
    }

    return Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [summary, harvests]);

  const isSelectedCycleActive = selectedCycle?.status === 'active';
  const activeCycleCount = cycles.filter((cycle) => cycle.status === 'active').length;
  const harvestTrendData = dailyBreakdown.slice(-14);
  const trendMaxWeight = Math.max(
    ...harvestTrendData.map((day) => Number(day.totalWeightKg) || 0),
    1
  );
  const cycleStartedAt = parseReadingDate(selectedCycle?.startedAt);
  const cycleExpectedEndedAt = parseReadingDate(selectedCycle?.expectedEndedAt);
  const cycleEndedAt = parseReadingDate(selectedCycle?.endedAt) || new Date();
  const cycleDurationMs = cycleStartedAt && cycleExpectedEndedAt
    ? Math.max(1, cycleExpectedEndedAt.getTime() - cycleStartedAt.getTime())
    : 0;
  const cycleElapsedMs = cycleStartedAt
    ? Math.max(0, Math.min(cycleEndedAt.getTime() - cycleStartedAt.getTime(), cycleDurationMs || 0))
    : 0;
  const cycleProgressPercent = cycleDurationMs
    ? Math.round((cycleElapsedMs / cycleDurationMs) * 100)
    : null;

  const sortCycles = useCallback((items = []) => (
    [...items].sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      const first = parseReadingDate(a.startedAt)?.getTime() ?? 0;
      const second = parseReadingDate(b.startedAt)?.getTime() ?? 0;
      return second - first;
    })
  ), []);

  const loadCycles = useCallback(async (statusFilter = cycleStatusFilter) => {
    const targetDeviceId = selectedDeviceId || devices[0]?.deviceId || devices[0]?.id;
    if (!targetDeviceId) {
      setCycles([]);
      setSelectedCycleId(null);
      return [];
    }

    setCyclesLoading(true);
    setCyclesError(null);

    try {
      const params = statusFilter === 'active'
        ? { status: 'active', limit: 100, offset: 0 }
        : { limit: 100, offset: 0 };
      const rawData = await api.cycles.list(targetDeviceId, params);
      const data = sortCycles(rawData);
      setCycles(data);
      setSelectedCycleId((currentId) => (
        data.some((cycle) => readEntityId(cycle) === currentId)
          ? currentId
          : (readEntityId(data[0]) || null)
      ));
      return data;
    } catch (error) {
      console.error('Cycles fetch failed:', error);
      setCyclesError(error.getUserMessage?.() || error.message || 'Gagal memuat daftar siklus.');
      return [];
    } finally {
      setCyclesLoading(false);
    }
  }, [cycleStatusFilter, devices, selectedDeviceId, sortCycles]);

  const loadCycleDetail = useCallback(async () => {
    const targetDeviceId = selectedDeviceId || devices[0]?.deviceId || devices[0]?.id;
    if (!targetDeviceId || !selectedCycleId) {
      setSummary(null);
      setHarvests([]);
      return;
    }

    setDetailLoading(true);
    setDetailError(null);

    try {
      const [summaryResult, harvestResult] = await Promise.all([
        api.cycles.summary(targetDeviceId, selectedCycleId),
        api.cycles.harvests(targetDeviceId, selectedCycleId, { limit: 100, offset: 0 }),
      ]);
      setSummary(summaryResult);
      setHarvests(Array.isArray(harvestResult) ? harvestResult : []);
    } catch (error) {
      console.error('Cycle detail fetch failed:', error);
      setDetailError(error.getUserMessage?.() || error.message || 'Gagal memuat detail siklus.');
    } finally {
      setDetailLoading(false);
    }
  }, [devices, selectedCycleId, selectedDeviceId]);

  useEffect(() => {
    const loadId = window.setTimeout(() => {
      loadCycles();
    }, 0);
    return () => window.clearTimeout(loadId);
  }, [loadCycles]);

  useEffect(() => {
    const loadId = window.setTimeout(() => {
      loadCycleDetail();
    }, 0);
    return () => window.clearTimeout(loadId);
  }, [loadCycleDetail]);

  const refreshSelectedCycle = async (statusFilter = cycleStatusFilter) => {
    await Promise.all([
      loadCycles(statusFilter),
      loadCycleDetail(),
    ]);
  };

  const updateCycleForm = (field, value) => {
    setCycleForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateHarvestForm = (field, value) => {
    setHarvestForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateCycle = async (event) => {
    event.preventDefault();
    const targetDeviceId = selectedDeviceId || devices[0]?.deviceId || devices[0]?.id;

    if (!targetDeviceId) {
      setToast({ message: 'Pilih kumbung terlebih dahulu', type: 'warning' });
      return;
    }

    if (!cycleForm.startedAt) {
      setToast({ message: 'Tanggal mulai siklus wajib diisi', type: 'warning' });
      return;
    }

    let baglogCount = undefined;
    if (cycleForm.baglogCount !== '' && cycleForm.baglogCount != null) {
      const parsed = parseInt(cycleForm.baglogCount, 10);
      if (isNaN(parsed) || parsed <= 0) {
        setToast({ message: 'Jumlah baglog harus berupa bilangan bulat positif', type: 'warning' });
        return;
      }
      baglogCount = parsed;
    }

    setSubmittingCycle(true);
    try {
      const cycleName = cycleForm.name.trim()
        || `Siklus ${formatReadableDate(cycleForm.startedAt)} - ${selectedDevice?.name || targetDeviceId}`;
      const payload = compactPayload({
        name: cycleName,
        mushroomType: cycleForm.mushroomType.trim() || 'Jamur Tiram',
        strain: cycleForm.strain.trim(),
        baglogCount,
        startedAt: new Date(cycleForm.startedAt).toISOString(),
        expectedEndedAt: cycleForm.expectedEndedAt ? new Date(cycleForm.expectedEndedAt).toISOString() : undefined,
        notes: cycleForm.notes.trim(),
      });

      const createdCycle = await api.cycles.create(targetDeviceId, payload);
      setCycleForm(createDefaultCycleForm());
      setToast({ message: '✓ Siklus baru berhasil dibuat', type: 'success' });
      const nextFilter = cycleStatusFilter === 'active' ? 'active' : cycleStatusFilter;
      const reloadedCycles = await loadCycles(nextFilter);
      const createdId = readEntityId(createdCycle) || (reloadedCycles[0] ? readEntityId(reloadedCycles[0]) : null);
      if (createdId) setSelectedCycleId(createdId);
    } catch (error) {
      console.error('Create cycle failed:', error);
      setToast({ message: error.getUserMessage?.() || 'Gagal membuat siklus', type: 'error' });
    } finally {
      setSubmittingCycle(false);
    }
  };

  const handleSubmitHarvest = async (event) => {
    event.preventDefault();
    const targetDeviceId = selectedDeviceId || devices[0]?.deviceId || devices[0]?.id;

    if (!targetDeviceId || !selectedCycleId) {
      setToast({ message: 'Pilih siklus terlebih dahulu', type: 'warning' });
      return;
    }

    const weightKg = Number(harvestForm.weightKg);
    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      setToast({ message: 'Berat panen wajib diisi dan harus lebih dari 0 kg', type: 'warning' });
      return;
    }

    let pricePerKg = undefined;
    if (harvestForm.pricePerKg !== '' && harvestForm.pricePerKg != null) {
      const parsedPrice = Number(harvestForm.pricePerKg);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        setToast({ message: 'Harga per kg harus berupa angka positif', type: 'warning' });
        return;
      }
      pricePerKg = Math.round(parsedPrice);
    }

    setSubmittingHarvest(true);
    try {
      const payload = compactPayload({
        harvestedAt: harvestForm.harvestedAt
          ? new Date(harvestForm.harvestedAt).toISOString()
          : new Date().toISOString(),
        weightKg,
        pricePerKg,
        grade: harvestForm.grade.trim() || 'A',
        notes: harvestForm.notes.trim(),
      });

      if (editingHarvestId) {
        await api.cycles.updateHarvest(targetDeviceId, selectedCycleId, editingHarvestId, payload);
        setToast({ message: '✓ Data panen berhasil diperbarui', type: 'success' });
      } else {
        await api.cycles.createHarvest(targetDeviceId, selectedCycleId, payload);
        setToast({ message: '✓ Panen harian berhasil dicatat', type: 'success' });
      }

      setHarvestForm(createDefaultHarvestForm());
      setEditingHarvestId(null);
      await refreshSelectedCycle();
    } catch (error) {
      console.error('Harvest submit failed:', error);
      setToast({ message: error.getUserMessage?.() || 'Gagal menyimpan panen', type: 'error' });
    } finally {
      setSubmittingHarvest(false);
    }
  };

  const handleEditHarvest = (harvest) => {
    setEditingHarvestId(readEntityId(harvest));
    setHarvestForm({
      harvestedAt: toDatetimeLocalValue(harvest.harvestedAt),
      weightKg: harvest.weightKg ?? '',
      pricePerKg: harvest.pricePerKg ?? '',
      grade: harvest.grade || '',
      notes: harvest.notes || '',
    });
  };

  const handleCancelEditHarvest = () => {
    setEditingHarvestId(null);
    setHarvestForm(createDefaultHarvestForm());
  };

  // Trigger Delete Harvest Confirmation Modal
  const handleOpenDeleteHarvest = (harvest) => {
    setDeleteHarvestTarget(harvest);
  };

  // Confirm Delete Harvest
  const handleConfirmDeleteHarvest = async () => {
    if (!deleteHarvestTarget) return;
    const harvestId = readEntityId(deleteHarvestTarget);
    const targetDeviceId = selectedDeviceId || devices[0]?.deviceId || devices[0]?.id;
    if (!targetDeviceId || !selectedCycleId || !harvestId) return;

    try {
      setIsDeletingHarvest(true);
      await api.cycles.deleteHarvest(targetDeviceId, selectedCycleId, harvestId);
      setToast({ message: '✓ Catatan panen dihapus', type: 'success' });
      setDeleteHarvestTarget(null);
      await refreshSelectedCycle();
    } catch (error) {
      console.error('Delete harvest failed:', error);
      setToast({ message: error.getUserMessage?.() || 'Gagal menghapus panen', type: 'error' });
    } finally {
      setIsDeletingHarvest(false);
    }
  };

  const handleCompleteCycle = async (event) => {
    event.preventDefault();
    const targetDeviceId = selectedDeviceId || devices[0]?.deviceId || devices[0]?.id;
    if (!targetDeviceId || !selectedCycleId) return;

    if (!completeForm.endedAt) {
      setToast({ message: 'Tanggal selesai siklus wajib diisi', type: 'warning' });
      return;
    }

    setCompletingCycle(true);
    try {
      await api.cycles.complete(targetDeviceId, selectedCycleId, compactPayload({
        endedAt: new Date(completeForm.endedAt).toISOString(),
        notes: completeForm.notes.trim(),
      }));
      setToast({ message: '✓ Siklus ditandai selesai', type: 'success' });
      setCycleStatusFilter('all');
      await loadCycles('all');
      await loadCycleDetail();
    } catch (error) {
      console.error('Complete cycle failed:', error);
      setToast({ message: error.getUserMessage?.() || 'Gagal menyelesaikan siklus', type: 'error' });
    } finally {
      setCompletingCycle(false);
    }
  };

  const peakHarvestDay = summary?.peakHarvestDay;
  const formattedPeakHarvestDay = peakHarvestDay && typeof peakHarvestDay === 'object'
    ? `${formatReadableDate(peakHarvestDay.date || peakHarvestDay.harvestedAt)} · ${formatKg(peakHarvestDay.totalWeightKg ?? peakHarvestDay.weightKg)}`
    : formatReadableDate(peakHarvestDay);

  const summaryCards = [
    { label: 'Total Panen', value: summary?.totalHarvests ?? '--', helper: 'kali panen' },
    { label: 'Total Berat', value: formatKg(summary?.totalWeightKg), helper: 'akumulasi siklus' },
    { label: 'Total Revenue', value: formatCurrency(summary?.totalRevenue), helper: 'opsional dari harga/kg' },
    { label: 'Umur Siklus', value: summary?.cycleAgeDays ?? '--', helper: 'hari sejak mulai' },
    { label: 'Hari Panen', value: summary?.harvestDays ?? '--', helper: 'hari aktif panen' },
    { label: 'Rata-rata / Panen', value: formatKg(summary?.averageWeightPerHarvestKg, 3), helper: 'kg tiap catatan' },
    { label: 'Rata-rata / Hari Siklus', value: formatKg(summary?.averageWeightPerCycleDayKg, 3), helper: 'kg/hari siklus' },
    { label: 'Rata-rata / Hari Panen', value: formatKg(summary?.averageWeightPerHarvestDayKg, 3), helper: 'kg/hari panen' },
    { label: 'Yield / Baglog', value: formatKg(summary?.yieldPerBaglogKg, 3), helper: 'kg per baglog' },
    { label: 'Panen Pertama', value: formatReadableDate(summary?.firstHarvestAt), helper: 'tanggal pertama' },
    { label: 'Panen Terakhir', value: formatReadableDate(summary?.latestHarvestAt), helper: 'tanggal terbaru' },
    { label: 'Puncak Panen', value: formattedPeakHarvestDay, helper: 'hari performa tertinggi' },
  ];

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <Header
        title="Siklus & Panen"
        subtitle="Mulai siklus budidaya, catat panen harian, dan baca performa per kumbung."
        breadcrumb={['Petani Panel', 'Siklus & Panen']}
        onMenuToggle={onMenuToggle}
        actions={
          <div className="kumbung-selector">
            <select
              value={activeDeviceId || ''}
              onChange={(event) => setSelectedDeviceId(event.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer', fontWeight: 700, color: 'var(--text-primary)' }}
            >
              {devices.length === 0 && <option value="">Belum ada kumbung</option>}
              {devices.map((device) => (
                <option key={device.deviceId || device.id} value={device.deviceId || device.id}>
                  {device.name || device.deviceId || device.id}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="chevron-icon" />
          </div>
        }
      />

      <div className="page-content cycles-page">
        {!activeDeviceId ? (
          <div className="panel empty-state">
            <Sprout size={28} className="text-sage" />
            <h3>Belum ada kumbung terdaftar</h3>
            <p className="text-muted">Tambahkan atau tautkan SupaKu terlebih dahulu di menu Kumbung Saya untuk mulai mencatat siklus budidaya.</p>
          </div>
        ) : (
          <>
            <motion.section
              className="cycle-overview-band"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div className="cycle-overview-band__identity">
                <div className="cycle-overview-band__icon">
                  <Sprout size={28} />
                </div>
                <div>
                  <span className="cycle-eyebrow">Produksi Kumbung</span>
                  <h3>{selectedDevice?.name || activeDeviceId}</h3>
                  <p>{selectedCycle ? selectedCycle.name || 'Siklus aktif' : 'Pilih atau buat siklus untuk mulai mencatat panen.'}</p>
                </div>
              </div>

              <div className="cycle-overview-band__metrics">
                <div>
                  <span>Siklus Aktif</span>
                  <strong>{activeCycleCount}</strong>
                </div>
                <div>
                  <span>Total Berat</span>
                  <strong>{formatKg(summary?.totalWeightKg)}</strong>
                </div>
                <div>
                  <span>Revenue</span>
                  <strong>{formatCurrency(summary?.totalRevenue)}</strong>
                </div>
              </div>

              <div className="cycle-progress-card">
                <div className="cycle-progress-card__head">
                  <span>Progress Siklus</span>
                  <strong>{cycleProgressPercent == null ? '--' : `${cycleProgressPercent}%`}</strong>
                </div>
                <div className="cycle-progress-track">
                  <span style={{ width: `${cycleProgressPercent ?? 0}%` }} />
                </div>
                <div className="cycle-progress-card__dates">
                  <span>{formatReadableDate(selectedCycle?.startedAt)}</span>
                  <span>{formatReadableDate(selectedCycle?.expectedEndedAt)}</span>
                </div>
              </div>
            </motion.section>

            <div className="cycle-shell">
              <motion.section
                className="panel cycle-list-panel"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
              >
                <div className="panel-header">
                  <div>
                    <h3>Daftar Siklus</h3>
                    <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                      {selectedDevice?.name || activeDeviceId}
                    </p>
                  </div>
                  <div className="toggle-group compact-toggle">
                    <button
                      className={`toggle-btn ${cycleStatusFilter === 'active' ? 'active' : ''}`}
                      onClick={() => setCycleStatusFilter('active')}
                    >
                      Aktif
                    </button>
                    <button
                      className={`toggle-btn ${cycleStatusFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setCycleStatusFilter('all')}
                    >
                      Semua
                    </button>
                  </div>
                </div>

                {cyclesLoading && <p className="text-muted">Memuat siklus...</p>}
                {cyclesError && <div className="info-alert error-alert"><AlertCircle size={16} /> <p>{cyclesError}</p></div>}
                {!cyclesLoading && cycles.length === 0 && (
                  <div className="empty-state compact">
                    <Sprout size={26} />
                    <h4>Belum ada siklus {cycleStatusFilter === 'active' ? 'aktif' : ''}</h4>
                    <p>Mulai siklus baru untuk mencatat panen harian.</p>
                  </div>
                )}

                <div className="cycle-card-list">
                  {cycles.map((cycle) => {
                    const cycleId = readEntityId(cycle);
                    return (
                      <button
                        type="button"
                        key={cycleId}
                        className={`cycle-list-card ${selectedCycleId === cycleId ? 'active' : ''}`}
                        onClick={() => setSelectedCycleId(cycleId)}
                      >
                        <div className="cycle-list-card__head">
                          <strong>{cycle.name || 'Siklus tanpa nama'}</strong>
                          <span className={`cycle-status ${cycle.status}`}>{cycle.status || '--'}</span>
                        </div>
                        <div className="cycle-list-card__meta">
                          <span>{cycle.mushroomType || 'Jamur Tiram'}</span>
                          <span>{cycle.strain || 'Strain belum diisi'}</span>
                        </div>
                        <div className="cycle-list-card__timeline">
                          <span>{formatReadableDate(cycle.startedAt)}</span>
                          <span>{formatReadableDate(cycle.expectedEndedAt)}</span>
                        </div>
                        <div className="cycle-list-card__stats">
                          <span>{cycle.baglogCount ?? '--'} baglog</span>
                          <span>{cycle._count?.harvests ?? 0} panen</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.section>

              <motion.section
                className="panel cycle-form-panel"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 }}
              >
                <div className="panel-header">
                  <div>
                    <h3>Mulai Siklus Baru</h3>
                    <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                      Default cocok untuk jamur tiram 3-4 bulan.
                    </p>
                  </div>
                  <CalendarDays size={20} className="text-sage" />
                </div>

                <form className="cycle-form" onSubmit={handleCreateCycle}>
                  <label>
                    <span>Nama Siklus</span>
                    <input value={cycleForm.name} onChange={(event) => updateCycleForm('name', event.target.value)} placeholder="Siklus Mei 2026 - Kumbung A" />
                  </label>
                  <div className="form-grid-2">
                    <label>
                      <span>Jenis Jamur</span>
                      <input value={cycleForm.mushroomType} onChange={(event) => updateCycleForm('mushroomType', event.target.value)} placeholder="Jamur Tiram" />
                    </label>
                    <label>
                      <span>Strain</span>
                      <input value={cycleForm.strain} onChange={(event) => updateCycleForm('strain', event.target.value)} placeholder="Tiram Putih" />
                    </label>
                  </div>
                  <div className="form-grid-3">
                    <label>
                      <span>Baglog</span>
                      <input type="number" min="0" value={cycleForm.baglogCount} onChange={(event) => updateCycleForm('baglogCount', event.target.value)} placeholder="1200" />
                    </label>
                    <label>
                      <span>Mulai</span>
                      <input type="date" value={cycleForm.startedAt} onChange={(event) => updateCycleForm('startedAt', event.target.value)} required />
                    </label>
                    <label>
                      <span>Estimasi Selesai</span>
                      <input type="date" value={cycleForm.expectedEndedAt} onChange={(event) => updateCycleForm('expectedEndedAt', event.target.value)} />
                    </label>
                  </div>
                  <label>
                    <span>Catatan</span>
                    <textarea value={cycleForm.notes} onChange={(event) => updateCycleForm('notes', event.target.value)} placeholder="Catatan opsional" rows={3} />
                  </label>
                  <button className="primary-button full-button" type="submit" disabled={submittingCycle}>
                    <Plus size={18} />
                    <span>{submittingCycle ? 'Menyimpan...' : 'Buat Siklus'}</span>
                  </button>
                </form>
              </motion.section>
            </div>

            {selectedCycle && (
              <section className="cycle-detail-section">
                <div className="cycle-detail-header">
                  <div>
                    <span className={`cycle-status ${selectedCycle.status}`}>{selectedCycle.status || '--'}</span>
                    <h3>{selectedCycle.name || 'Siklus tanpa nama'}</h3>
                    <p className="text-muted">
                      {selectedCycle.mushroomType || 'Jamur Tiram'} · {selectedCycle.strain || 'Strain belum diisi'} · {selectedCycle.baglogCount ?? '--'} baglog
                    </p>
                  </div>
                  <div className="cycle-date-strip">
                    <span>Mulai: {formatReadableDate(selectedCycle.startedAt)}</span>
                    <span>Estimasi: {formatReadableDate(selectedCycle.expectedEndedAt)}</span>
                    <span>Selesai: {formatReadableDate(selectedCycle.endedAt)}</span>
                  </div>
                </div>

                {detailLoading && <p className="text-muted">Memuat summary dan panen...</p>}
                {detailError && <div className="info-alert error-alert"><AlertCircle size={16} /> <p>{detailError}</p></div>}

                <div className="cycle-summary-grid">
                  {summaryCards.map((card, index) => (
                    <div className={`stat-card minimal cycle-stat-card cycle-stat-card--${index % 4}`} key={card.label}>
                      <span className="stat-title">{card.label}</span>
                      <strong>{card.value}</strong>
                      <small>{card.helper}</small>
                    </div>
                  ))}
                </div>

                <div className="cycle-detail-grid">
                  <section className="cycle-subpanel">
                    <div className="panel-header">
                      <div>
                        <h3>Catat Panen</h3>
                        <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                          {editingHarvestId ? 'Edit catatan panen terpilih.' : 'Input panen harian per siklus.'}
                        </p>
                      </div>
                      {editingHarvestId && (
                        <button className="secondary-button compact-button" type="button" onClick={handleCancelEditHarvest}>
                          <X size={16} />
                          <span>Batal Edit</span>
                        </button>
                      )}
                    </div>

                    <form className="cycle-form" onSubmit={handleSubmitHarvest}>
                      <div className="form-grid-2">
                        <label>
                          <span>Waktu Panen</span>
                          <input type="datetime-local" value={harvestForm.harvestedAt} onChange={(event) => updateHarvestForm('harvestedAt', event.target.value)} />
                        </label>
                        <label>
                          <span>Berat (kg)</span>
                          <input type="number" min="0" step="0.001" value={harvestForm.weightKg} onChange={(event) => updateHarvestForm('weightKg', event.target.value)} placeholder="18.75" required />
                        </label>
                      </div>
                      <div className="form-grid-2">
                        <label>
                          <span>Harga / kg</span>
                          <input type="number" min="0" step="100" value={harvestForm.pricePerKg} onChange={(event) => updateHarvestForm('pricePerKg', event.target.value)} placeholder="18000" />
                        </label>
                        <label>
                          <span>Grade</span>
                          <input value={harvestForm.grade} onChange={(event) => updateHarvestForm('grade', event.target.value)} placeholder="A" />
                        </label>
                      </div>
                      <label>
                        <span>Catatan</span>
                        <textarea value={harvestForm.notes} onChange={(event) => updateHarvestForm('notes', event.target.value)} placeholder="Panen pagi" rows={3} />
                      </label>
                      <button className="primary-button full-button" type="submit" disabled={submittingHarvest}>
                        <Check size={18} />
                        <span>{submittingHarvest ? 'Menyimpan...' : editingHarvestId ? 'Update Panen' : 'Simpan Panen'}</span>
                      </button>
                    </form>
                  </section>

                  <section className="cycle-subpanel">
                    <div className="panel-header">
                      <div>
                        <h3>Daily Breakdown</h3>
                        <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                          Akumulasi per tanggal panen.
                        </p>
                      </div>
                      <BarChart2 size={20} className="text-earth" />
                    </div>
                    {harvestTrendData.length > 0 && (
                      <div className="harvest-trend" aria-label="Tren berat panen harian">
                        {harvestTrendData.map((day) => {
                          const barHeight = Math.max(10, ((Number(day.totalWeightKg) || 0) / trendMaxWeight) * 100);
                          return (
                            <div className="harvest-trend__bar" key={day.date}>
                              <span style={{ height: `${barHeight}%` }} title={`${formatReadableDate(day.date)} · ${formatKg(day.totalWeightKg)}`} />
                              <small>{parseReadingDate(day.date)?.toLocaleDateString('id-ID', { day: '2-digit' }) || '--'}</small>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="table-wrapper compact-table-wrapper">
                      <table className="data-table responsive-table">
                        <thead>
                          <tr>
                            <th>Tanggal</th>
                            <th>Jumlah</th>
                            <th>Total Berat</th>
                            <th>Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dailyBreakdown.map((day) => (
                            <tr key={day.date}>
                              <td data-label="Tanggal">{formatReadableDate(day.date)}</td>
                              <td data-label="Jumlah">{day.harvestCount ?? 0}</td>
                              <td data-label="Total Berat">{formatKg(day.totalWeightKg)}</td>
                              <td data-label="Revenue">{formatCurrency(day.totalRevenue)}</td>
                            </tr>
                          ))}
                          {dailyBreakdown.length === 0 && (
                            <tr>
                              <td colSpan="4" className="text-muted" style={{ textAlign: 'center', padding: '20px' }}>Belum ada breakdown harian.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>

                <section className="cycle-subpanel harvest-table-panel">
                  <div className="panel-header">
                    <div>
                      <h3>Daftar Harvest</h3>
                      <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                        {harvests.length} catatan panen dalam siklus ini.
                      </p>
                    </div>
                    <button className="secondary-button compact-button" type="button" onClick={loadCycleDetail}>
                      <RefreshCw size={16} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  <div className="table-wrapper">
                    <table className="data-table responsive-table">
                      <thead>
                        <tr>
                          <th>Waktu Panen</th>
                          <th>Berat</th>
                          <th>Harga/kg</th>
                          <th>Grade</th>
                          <th>Catatan</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {harvests.map((harvest) => {
                          const harvestId = readEntityId(harvest);
                          return (
                            <tr key={harvestId}>
                              <td data-label="Waktu">{formatReadableDate(harvest.harvestedAt, true)}</td>
                              <td data-label="Berat">{formatKg(harvest.weightKg, 3)}</td>
                              <td data-label="Harga/kg">{formatCurrency(harvest.pricePerKg)}</td>
                              <td data-label="Grade">{harvest.grade || '--'}</td>
                              <td data-label="Catatan">{harvest.notes || '--'}</td>
                              <td data-label="Aksi">
                                <div className="row-actions">
                                  <button className="icon-button small-icon-button" type="button" onClick={() => handleEditHarvest(harvest)} title="Edit panen">
                                    <Pencil size={15} />
                                  </button>
                                  <button className="icon-button small-icon-button danger-icon-button" type="button" onClick={() => handleOpenDeleteHarvest(harvest)} title="Hapus panen">
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {harvests.length === 0 && (
                          <tr>
                            <td colSpan="6" className="text-muted" style={{ textAlign: 'center', padding: '24px' }}>Belum ada catatan panen.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                {isSelectedCycleActive && (
                  <section className="cycle-subpanel complete-cycle-panel">
                    <div className="panel-header">
                      <div>
                        <h3>Selesaikan Siklus</h3>
                        <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                          Tutup siklus ketika masa produksi selesai.
                        </p>
                      </div>
                    </div>
                    <form className="cycle-form complete-cycle-form" onSubmit={handleCompleteCycle}>
                      <label>
                        <span>Tanggal Selesai</span>
                        <input type="date" value={completeForm.endedAt} onChange={(event) => setCompleteForm((prev) => ({ ...prev, endedAt: event.target.value }))} required />
                      </label>
                      <label>
                        <span>Catatan Penutup</span>
                        <input value={completeForm.notes} onChange={(event) => setCompleteForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Siklus selesai" />
                      </label>
                      <button className="primary-button outline" type="submit" disabled={completingCycle}>
                        <Check size={18} />
                        <span>{completingCycle ? 'Memproses...' : 'Complete Cycle'}</span>
                      </button>
                    </form>
                  </section>
                )}
              </section>
            )}
          </>
        )}
      </div>

      {/* Confirmation Modal for Deleting Harvest */}
      <ConfirmModal
        isOpen={Boolean(deleteHarvestTarget)}
        onClose={() => !isDeletingHarvest && setDeleteHarvestTarget(null)}
        onConfirm={handleConfirmDeleteHarvest}
        title="Hapus Catatan Panen"
        message="Apakah Anda yakin ingin menghapus data catatan panen ini? Akumulasi hasil panen dan pendapatan siklus akan dihitung ulang."
        itemDetails={
          deleteHarvestTarget
            ? {
                label: 'Catatan Panen',
                value: `${formatKg(deleteHarvestTarget.weightKg, 3)} (${deleteHarvestTarget.grade || 'Grade Standar'})`,
                subValue: formatReadableDate(deleteHarvestTarget.harvestedAt, true),
              }
            : null
        }
        type="danger"
        confirmText="Hapus Catatan"
        cancelText="Batal"
        loading={isDeletingHarvest}
        dangerNote="Tindakan ini permanen. Catatan panen akan dihapus dari histori siklus."
      />
    </>
  );
};

// --- 4. Monitoring Content ---
const MonitoringContent = ({ setActivePage, selectedDeviceId, setSelectedDeviceId, devices, selectedDevice, onMenuToggle, liveSensorEvent, liveHistoryEvent }) => {
  const [timeRange, setTimeRange] = useState('10 Menit');
  const [latestSensor, setLatestSensor] = useState({ temperature: '--', humidity: '--' });
  const [sensorHistory, setSensorHistory] = useState([]);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [showAllHistoryLogs, setShowAllHistoryLogs] = useState(false);

  const activeDeviceId = selectedDeviceId || devices[0]?.deviceId || devices[0]?.id || null;
  const activeDevice = selectedDevice || devices.find(d => (d.deviceId || d.id) === activeDeviceId) || devices[0] || null;

  const isOnline = Boolean(activeDevice?.isOnline);

  const currentRssi = isOnline
    ? (activeDevice?.rssiDbm ?? latestSensor?.rssi ?? latestSensor?.rssiDbm ?? latestSensor?.rssi_dbm ?? -65)
    : null;

  const currentUptime = isOnline
    ? (activeDevice?.uptimeMs ?? latestSensor?.uptimeMs ?? latestSensor?.uptime_ms ?? latestSensor?.uptime ?? 3600000)
    : null;

  useEffect(() => {
    if (!selectedDeviceId && activeDeviceId) {
      setSelectedDeviceId(activeDeviceId);
    }
  }, [activeDeviceId, selectedDeviceId, setSelectedDeviceId]);

  const selectedRange = MONITORING_RANGES.find((range) => range.label === timeRange) || MONITORING_RANGES[0];
  const latestReadingTime = sensorHistory.reduce((latest, record) => {
    const date = getReadingDate(record);
    return date ? Math.max(latest, date.getTime()) : latest;
  }, 0);
  const rangeStartTime = latestReadingTime ? latestReadingTime - selectedRange.minutes * 60 * 1000 : 0;

  const formattedChartData = downsampleData(
    (() => {
      let records = [...sensorHistory];
      if (records.length === 0 && latestSensor && (latestSensor.temperature !== '--' || latestSensor.suhu !== undefined)) {
        records = [{ ...latestSensor, deviceId: activeDeviceId }];
      }
      const mapped = records
        .map((record) => {
          const date = getReadingDate(record) || new Date();
          return {
            ...record,
            temperature: readTemperature(record),
            humidity: readHumidity(record),
            readingDate: date,
            time: date ? date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--',
          };
        })
        .filter((record) => {
          if (!record.readingDate) return false;
          return (rangeStartTime ? record.readingDate.getTime() >= rangeStartTime : true) && record.temperature != null && record.humidity != null;
        })
        .sort((a, b) => a.readingDate - b.readingDate);

      if (mapped.length === 0 && records.length > 0) {
        const fallbackMapped = records
          .map((record) => {
            const date = getReadingDate(record) || new Date();
            return {
              ...record,
              temperature: readTemperature(record),
              humidity: readHumidity(record),
              readingDate: date,
              time: date ? date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--',
            };
          })
          .filter((record) => record.temperature != null && record.humidity != null)
          .sort((a, b) => a.readingDate - b.readingDate);

        if (fallbackMapped.length === 1) {
          const single = fallbackMapped[0];
          const prevDate = new Date(single.readingDate.getTime() - 60 * 1000);
          return [
            {
              ...single,
              readingDate: prevDate,
              time: prevDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            },
            single,
          ];
        }
        return fallbackMapped;
      }

      if (mapped.length === 1) {
        const single = mapped[0];
        const prevDate = new Date(single.readingDate.getTime() - 60 * 1000);
        return [
          {
            ...single,
            readingDate: prevDate,
            time: prevDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          },
          single,
        ];
      }
      return mapped;
    })()
  );

  const mistPumpOn = isActiveValue(activeDevice?.pumpStatus);
  const floorPumpOn = isActiveValue(activeDevice?.floorPumpStatus);
  const canToggleHistoryLogs = historyLogs.length > 10;
  const visibleHistoryLogs = showAllHistoryLogs ? historyLogs : historyLogs.slice(0, 10);

  const currentTemp = readTemperature(latestSensor);
  const currentHum = readHumidity(latestSensor);

  const tempStatus = currentTemp == null 
    ? { text: 'Menunggu Data', color: 'var(--text-muted)' }
    : currentTemp >= 24 && currentTemp <= 28 
    ? { text: 'Optimal (24-28°C)', color: '#15803D' }
    : currentTemp > 28 
    ? { text: 'Suhu Tinggi (>28°C)', color: '#DC2626' }
    : { text: 'Suhu Rendah (<24°C)', color: '#D97706' };

  const humStatus = currentHum == null 
    ? { text: 'Menunggu Data', color: 'var(--text-muted)' }
    : currentHum >= 80 && currentHum <= 95 
    ? { text: 'Optimal (80-95%)', color: '#15803D' }
    : currentHum < 80 
    ? { text: 'Kering (<80%)', color: '#DC2626' }
    : { text: 'Sangat Lembab (>95%)', color: '#D97706' };

  useEffect(() => {
    const resetId = window.setTimeout(() => {
      setShowAllHistoryLogs(false);
    }, 0);

    return () => window.clearTimeout(resetId);
  }, [activeDeviceId]);

  useEffect(() => {
    if (!activeDeviceId) return;

    const fetchLatest = async () => {
      try {
        const sensor = await api.telemetry.getSensorLatest(activeDeviceId);
        if (sensor) {
          setLatestSensor(sensor);
          setSensorHistory((prevHistory) => (
            mergeRealtimeRecord(prevHistory, {
              ...sensor,
              deviceId: activeDeviceId,
            }, { limit: REALTIME_SENSOR_HISTORY_LIMIT })
          ));
        }
      } catch (error) {
        console.error('Latest telemetry fetch failed:', error);
      }
    };

    fetchLatest();
    const interval = setInterval(fetchLatest, TELEMETRY_LATEST_REFRESH_MS);
    return () => clearInterval(interval);
  }, [activeDeviceId]);

  useEffect(() => {
    if (!activeDeviceId) return;

    const fetchHistory = async () => {
      try {
        const from = new Date(Date.now() - selectedRange.minutes * 60 * 1000).toISOString();
        let [history, logs] = await Promise.allSettled([
          api.telemetry.getSensorHistory(activeDeviceId, { from, limit: 300 }),
          api.telemetry.getHistory(activeDeviceId, { limit: 50 })
        ]);

        let historyData = history.status === 'fulfilled' && Array.isArray(history.value) ? history.value : [];
        if (historyData.length === 0) {
          historyData = await api.telemetry.getSensorHistory(activeDeviceId, { limit: 100 }).catch(() => []);
        }

        if (Array.isArray(historyData) && historyData.length > 0) {
          setSensorHistory((prevHistory) => {
            let merged = [...historyData];
            prevHistory.forEach((item) => {
              merged = mergeRealtimeRecord(merged, item, { limit: REALTIME_SENSOR_HISTORY_LIMIT });
            });
            return merged;
          });
        }

        let logsData = logs.status === 'fulfilled' && Array.isArray(logs.value) ? logs.value : [];
        if (logsData.length === 0 && historyData.length > 0) {
          logsData = historyData;
        }
        if (logsData.length > 0) {
          setHistoryLogs(logsData);
        }
      } catch (error) {
        console.error('Telemetry history fetch failed:', error);
      }
    };

    fetchHistory();
    const interval = setInterval(fetchHistory, TELEMETRY_HISTORY_REFRESH_MS);
    return () => clearInterval(interval);
  }, [activeDeviceId, selectedRange.minutes]);

  useEffect(() => {
    if (!activeDeviceId || liveSensorEvent?.deviceId !== activeDeviceId) return;

    window.setTimeout(() => {
      setLatestSensor(liveSensorEvent.record);
      setSensorHistory((prevHistory) => (
        mergeRealtimeRecord(prevHistory, liveSensorEvent.record, { limit: REALTIME_SENSOR_HISTORY_LIMIT })
      ));
    }, 0);
  }, [liveSensorEvent, activeDeviceId]);

  useEffect(() => {
    if (!activeDeviceId || liveHistoryEvent?.deviceId !== activeDeviceId) return;

    window.setTimeout(() => {
      setHistoryLogs((prevLogs) => (
        mergeRealtimeRecord(prevLogs, liveHistoryEvent.record, { limit: REALTIME_LOG_LIMIT, newestFirst: true })
      ));

      if (readTemperature(liveHistoryEvent.record) != null || readHumidity(liveHistoryEvent.record) != null) {
        setLatestSensor(liveHistoryEvent.record);
        setSensorHistory((prevHistory) => (
          mergeRealtimeRecord(prevHistory, liveHistoryEvent.record, { limit: REALTIME_SENSOR_HISTORY_LIMIT })
        ));
      }
    }, 0);
  }, [liveHistoryEvent, activeDeviceId]);

  return (
    <>
      <Header 
        title={`Monitoring - ${activeDevice?.name || '---'}`}
        subtitle="Grafik parameter suhu, kelembaban, dan data telemetri real-time."
        breadcrumb={['Petani Panel', 'Monitoring Sensor']}
        onMenuToggle={onMenuToggle}
        onBack={() => setActivePage('dashboard')}
      />
      
      <div className="page-content">
        <motion.div 
          className="filter-bar"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="filter-group">
            <span className="filter-label">Pilih Kumbung</span>
            <select 
              className="dropdown-small" 
              value={activeDeviceId || ''} 
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {devices.map(d => (
                <option key={d.deviceId || d.id} value={d.deviceId || d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="toggle-group">
            {MONITORING_RANGES.map(({ label }) => (
              <button 
                key={label} 
                className={`toggle-btn ${timeRange === label ? 'active' : ''}`}
                onClick={() => setTimeRange(label)}
              >
                {label}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div 
          className="sensor-row"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="stat-card minimal sensor-card-horizontal">
            <div className="sensor-icon-large bg-sage-light">
              <Thermometer size={28} className="text-sage" />
            </div>
            <div className="sensor-card-content">
              <span className="stat-title">Suhu (°C)</span>
              <div className="stat-value">{formatMetric(currentTemp, '°C')}</div>
              <div className="stat-status font-semibold" style={{ color: tempStatus.color }}>{tempStatus.text}</div>
            </div>
          </div>

          <div className="stat-card minimal sensor-card-horizontal">
            <div className="sensor-icon-large bg-blue-light">
              <Droplets size={28} className="text-blue" />
            </div>
            <div className="sensor-card-content">
              <span className="stat-title">Kelembaban</span>
              <div className="stat-value">{formatMetric(currentHum, '%')}</div>
              <div className="stat-status font-semibold" style={{ color: humStatus.color }}>{humStatus.text}</div>
            </div>
          </div>

          <div className="stat-card minimal sensor-card-horizontal">
            <div className={`sensor-icon-large ${isOnline ? 'bg-earth-light' : 'bg-red-light'}`}>
              <Wifi size={28} className={isOnline ? 'text-earth' : 'text-error'} />
            </div>
            <div className="sensor-card-content">
              <span className="stat-title">Jaringan & Sistem</span>
              <div className="stat-value" style={{ fontSize: '1.2rem', color: isOnline ? undefined : 'var(--error, #ef4444)' }}>
                {isOnline ? formatWifi(currentRssi) : 'Offline'}
              </div>
              <div className="stat-status text-muted font-semibold" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> {isOnline ? formatUptime(currentUptime) : 'Tidak ada sinyal'}
              </div>
            </div>
          </div>
        </motion.div>

        <div className="dashboard-grid">
          <motion.div 
            className="chart-section panel"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="panel-header">
              <div>
                <h3>Grafik Suhu & Kelembaban</h3>
                <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                  Menampilkan {formattedChartData.length} titik data terakhir dalam {timeRange.toLowerCase()}.
                </p>
              </div>
            </div>
            
            <div className="stacked-charts" style={{ marginTop: '16px' }}>
              {/* Suhu Chart */}
              <div className="chart-row metric-temp">
                <div className="chart-info">
                  <span className="chart-label">Suhu (°C)</span>
                  <div className="chart-current-value">{formatMetric(readTemperature(latestSensor), '°C')}</div>
                  <span className="chart-unit">°C</span>
                </div>
                <div className="chart-graph" style={{ height: '200px' }}>
                  {formattedChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={formattedChartData} margin={{ top: 8, right: 12, left: -10, bottom: 8 }}>
                        <defs>
                          <linearGradient id="monitoringTempGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--chart-temp-line)" stopOpacity={0.32}/>
                            <stop offset="95%" stopColor="var(--chart-temp-line)" stopOpacity={0.02}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 6" vertical={false} stroke={chartGridStroke} />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={chartAxisTick} dy={10} minTickGap={28} />
                        <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} tickFormatter={chartAxisFormatter} domain={['dataMin - 2', 'dataMax + 2']} />
                        <Tooltip 
                          contentStyle={chartTooltipStyle}
                          labelStyle={chartTooltipLabelStyle}
                          formatter={(value) => [`${Number(value).toFixed(2)}°C`, 'Suhu']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="temperature" 
                          stroke="var(--chart-temp-line)" 
                          strokeWidth={2.5} 
                          fillOpacity={1} 
                          fill="url(#monitoringTempGradient)" 
                          dot={formattedChartData.length <= 4 ? { r: 3.5, fill: 'var(--chart-temp-line)' } : false} 
                          activeDot={{ r: 5, strokeWidth: 0, fill: 'var(--chart-temp-line)' }} 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-chart-state">Belum ada data suhu.</div>
                  )}
                </div>
              </div>

              <div className="chart-divider"></div>

              {/* Kelembaban Chart */}
              <div className="chart-row metric-hum">
                <div className="chart-info">
                  <span className="chart-label">Kelembaban (%)</span>
                  <div className="chart-current-value">{formatMetric(readHumidity(latestSensor), '%')}</div>
                  <span className="chart-unit">%</span>
                </div>
                <div className="chart-graph" style={{ height: '200px' }}>
                  {formattedChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={formattedChartData} margin={{ top: 8, right: 12, left: -10, bottom: 8 }}>
                        <defs>
                          <linearGradient id="monitoringHumGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--chart-hum-line)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--chart-hum-line)" stopOpacity={0.02}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 6" vertical={false} stroke={chartGridStroke} />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={chartAxisTick} dy={10} minTickGap={28} />
                        <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} tickFormatter={chartAxisFormatter} domain={['dataMin - 5', 'dataMax + 5']} />
                        <Tooltip 
                          contentStyle={chartTooltipStyle}
                          labelStyle={chartTooltipLabelStyle}
                          formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Kelembaban']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="humidity" 
                          stroke="var(--chart-hum-line)" 
                          strokeWidth={2.5} 
                          fillOpacity={1} 
                          fill="url(#monitoringHumGradient)" 
                          dot={formattedChartData.length <= 4 ? { r: 3.5, fill: 'var(--chart-hum-line)' } : false} 
                          activeDot={{ r: 5, strokeWidth: 0, fill: 'var(--chart-hum-line)' }} 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-chart-state">Belum ada data kelembaban.</div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            className="info-panel panel"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="panel-header">
              <h3>Informasi Kumbung & Perangkat</h3>
            </div>
            
            <div className="info-list">
              <div className="info-item">
                <span className="info-label">Nama Kumbung:</span>
                <span className="info-value font-semibold">{activeDevice?.name || '---'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">ID Perangkat:</span>
                <span className="info-value text-muted">{activeDevice?.deviceId || activeDevice?.id || '---'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Status:</span>
                <span className={`info-value ${isOnline ? 'text-sage' : 'text-error'}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wifi size={16} style={{ opacity: isOnline ? 1 : 0.5 }} />
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Terakhir Terlihat:</span>
                <span className="info-value text-muted">{formatDateTime(activeDevice?.lastSeenAt)}</span>
              </div>
            </div>

            <button className="secondary-button" style={{ marginTop: 'auto' }} onClick={() => setActivePage('kontrol')}>
              Detail Pengaturan
            </button>
          </motion.div>
        </div>

        <motion.div 
          className="panel chart-section analytics-panel"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          style={{ marginTop: '24px' }}
        >
          <div className="panel-header">
            <h3>Status Aktuator & Riwayat Sistem</h3>
          </div>
          
          <div className="actuator-summary-grid">
             <div className="stat-card minimal" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px' }}>
                <div className="sensor-icon-large bg-sage-light">
                  <Droplet size={28} className="text-sage" />
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: '0.85rem' }}>Pompa Kabut</div>
                  <div className="font-semibold" style={{ fontSize: '1.2rem' }}>{mistPumpOn ? 'ON' : 'OFF'}</div>
                </div>
             </div>
             <div className="stat-card minimal" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px' }}>
                <div className="sensor-icon-large bg-blue-light">
                  <Waves size={28} className="text-blue" />
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: '0.85rem' }}>Pompa Lantai</div>
                  <div className="font-semibold" style={{ fontSize: '1.2rem' }}>{floorPumpOn ? 'ON' : 'OFF'}</div>
                </div>
             </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table responsive-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Kategori</th>
                  <th>Aktivitas</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleHistoryLogs.map((log, idx) => (
                  <tr key={log.id || idx}>
                    <td data-label="Waktu" className="text-muted">{formatHistoryTime(log)}</td>
                    <td data-label="Kategori" className="font-semibold">{log.category || log.actuator || (log.mode ? `Mode ${log.mode}` : 'Sensor')}</td>
                    <td data-label="Aktivitas">{formatHistoryActivity(log)}</td>
                    <td data-label="Status"><span className="text-sage font-semibold">{log.status || 'OK'}</span></td>
                  </tr>
                ))}
                {historyLogs.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '24px' }} className="text-muted">Belum ada riwayat aktivitas.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <button
            className="secondary-button"
            style={{ width: '100%', marginTop: '16px', justifyContent: 'center' }}
            onClick={() => setShowAllHistoryLogs((current) => !current)}
            disabled={!canToggleHistoryLogs}
          >
            {showAllHistoryLogs ? 'Tampilkan Lebih Sedikit' : 'Lihat Riwayat Lengkap'}
          </button>
        </motion.div>
      </div>
    </>
  );
}

// --- 5. Notifikasi Content ---
const NotifikasiContent = ({ onMenuToggle }) => {
  const [filter, setFilter] = useState('Semua');
  const filteredNotifications = notifications.filter((notif) => {
    if (filter === 'Semua') return true;
    if (filter === 'Peringatan') return ['error', 'warning'].includes(notif.type);
    return ['info', 'success'].includes(notif.type);
  });

  return (
    <>
      <Header 
        title="Pusat Notifikasi" 
        subtitle="Riwayat peringatan dan aktivitas sistem Anda."
        breadcrumb={['Petani Panel', 'Pusat Notifikasi']}
        onMenuToggle={onMenuToggle}
        actions={
          <button className="icon-button" onClick={() => setFilter('Semua')} aria-label="Reset filter notifikasi">
            <Filter size={20} />
          </button>
        }
      />
      
      <div className="page-content">
        <motion.div 
          className="toggle-group"
          style={{ alignSelf: 'flex-start', marginBottom: '8px' }}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
        >
          {['Semua', 'Peringatan', 'Informasi'].map(t => (
            <button 
              key={t} 
              className={`toggle-btn ${filter === t ? 'active' : ''}`}
              onClick={() => setFilter(t)}
            >
              {t}
            </button>
          ))}
        </motion.div>

        <motion.div 
          className="panel"
          style={{ padding: '0' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="notif-page-list">
            {filteredNotifications.map((notif) => (
              <div className="notif-page-item" key={notif.id}>
                <div className={`notif-icon-large ${notif.type}`}>
                  {notif.type === 'error' && <AlertCircle size={24} />}
                  {notif.type === 'warning' && <AlertCircle size={24} />}
                  {notif.type === 'info' && <Info size={24} />}
                  {notif.type === 'success' && <Check size={24} />}
                </div>
                <div className="notif-page-content">
                  <h4>{notif.text}</h4>
                  <p className="text-muted">Terkait dengan operasional kumbung dan sensor.</p>
                </div>
                <div className="notif-page-time">
                  {notif.time}
                </div>
                <button className="action-button">
                  <MoreVertical size={18} />
                </button>
              </div>
            ))}
            {filteredNotifications.length === 0 && (
              <div className="empty-state" style={{ padding: '24px' }}>
                Tidak ada notifikasi untuk filter ini.
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
}

// --- 6. Profil Content ---
const ProfilContent = ({ onMenuToggle, currentUser, setCurrentUser, onLogout }) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: currentUser?.fullName || '',
    phoneNumber: currentUser?.phoneNumber || '',
    farmName: currentUser?.farmName || '',
    farmAddress: currentUser?.farmAddress || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const userRole = (currentUser?.role || '').toUpperCase();
  const isTechUser = userRole === 'TECHNICIAN';
  const isAdminUser = userRole === 'ADMIN';

  const userHandle = currentUser?.username 
    || (currentUser?.email ? currentUser.email.split('@')[0] : (isTechUser ? 'teknisi' : isAdminUser ? 'admin' : 'petani'));

  const roleDisplayName = isTechUser
    ? 'Teknisi Lapangan & Sistem IoT SupaKu'
    : isAdminUser
    ? 'Administrator Wilayah ShroomSync'
    : 'Petani Kumbung Jamur';

  const roleBadgeLabel = isTechUser ? 'ADMIN PUSAT' : isAdminUser ? 'ADMIN WILAYAH' : 'PETANI MITRA';

  const handleOpenEdit = () => {
    setEditForm({
      fullName: currentUser?.fullName || '',
      phoneNumber: currentUser?.phoneNumber || '',
      farmName: currentUser?.farmName || '',
      farmAddress: currentUser?.farmAddress || '',
    });
    setShowEditModal(true);
  };

  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    if (!editForm.fullName || !editForm.fullName.trim()) {
      setToast({ message: 'Nama lengkap wajib diisi', type: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const profileData = {
        fullName: editForm.fullName.trim(),
        phoneNumber: editForm.phoneNumber.trim(),
        farmName: editForm.farmName.trim(),
        farmAddress: editForm.farmAddress.trim(),
      };

      const updatedUser = await api.auth.updateProfile(profileData);
      if (typeof setCurrentUser === 'function') {
        setCurrentUser(updatedUser);
      }
      setShowEditModal(false);
      setToast({ message: '✓ Informasi profil berhasil diperbarui', type: 'success' });
    } catch (err) {
      console.error(err);
      setToast({ message: err?.getUserMessage?.() || err?.message || 'Gagal memperbarui profil', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePassword = async (e) => {
    e?.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setToast({ message: 'Kata sandi saat ini dan baru wajib diisi', type: 'warning' });
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setToast({ message: 'Kata sandi baru minimal 6 karakter', type: 'warning' });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setToast({ message: 'Konfirmasi kata sandi tidak cocok', type: 'warning' });
      return;
    }

    setLoading(true);
    try {
      await api.auth.changePassword({
        oldPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setShowPasswordModal(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setToast({ message: '✓ Kata sandi berhasil diperbarui', type: 'success' });
    } catch (err) {
      console.error(err);
      setToast({ message: err?.getUserMessage?.() || err?.message || 'Gagal mengubah kata sandi', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {isTechUser ? (
        <>
          {/* Status Bar & Breadcrumb khusus Teknisi */}
          <div className="tech-top-banner">
            <div className="tech-breadcrumb">
              <Terminal size={13} style={{ opacity: 0.8 }} />
              <span>Admin Panel</span>
              <ChevronRight size={10} style={{ opacity: 0.5 }} />
              <span className="active-crumb">Profil Pengguna</span>
            </div>
            <div className="tech-server-status">
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="tech-pulse-dot" />
                <span>Server Status: Operational</span>
              </span>
              <span style={{ opacity: 0.4 }}>•</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Radio size={13} style={{ color: '#86efac' }} />
                <span>MQTT Broker: Connected</span>
              </span>
            </div>
          </div>

          <header className="tech-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {onMenuToggle && (
                <button
                  onClick={onMenuToggle}
                  className="mobile-menu-toggle"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '8px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                  aria-label="Toggle Navigation Menu"
                >
                  <Menu size={20} />
                </button>
              )}
              <div>
                <h1 className="tech-header-title">Profil Pengguna</h1>
                <p className="tech-header-subtitle">Kelola informasi akun teknisi, kredensial, dan preferensi keamanan sistem.</p>
              </div>
            </div>
            <div className="tech-header-actions">
              <button 
                type="button"
                className="tech-btn-primary"
                onClick={handleOpenEdit}
              >
                <Pencil size={14} />
                <span>Edit Profil</span>
              </button>
            </div>
          </header>
        </>
      ) : (
        <Header 
          title="Profil Pengguna"
          onMenuToggle={onMenuToggle}
          breadcrumb={['Petani Panel', 'Profil Pengguna']}
          subtitle="Kelola informasi akun dan preferensi aplikasi Anda."
        />
      )}
      
      <div className={isTechUser ? "tech-content-body" : "page-content"} style={{ maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
        <div className="profile-layout-grid">
          {/* KARTU 1: Profil Akun */}
          <motion.div 
            className="tech-profile-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Header: Avatar, Name, Role Badge, Subtitle */}
            <div className="tech-profile-header">
              <div className="tech-profile-avatar">
                {isTechUser ? <Wrench size={30} /> : <User size={32} />}
                <button 
                  type="button"
                  className="tech-profile-avatar-badge" 
                  onClick={handleOpenEdit} 
                  aria-label="Edit avatar / profil"
                  title="Edit Profil"
                >
                  <Camera size={13} />
                </button>
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {currentUser?.fullName || currentUser?.username || (isTechUser ? 'Teknisi ShroomSync' : 'Petani Jamur')}
                  </h3>
                  <span 
                    style={{
                      fontSize: '9.5px',
                      fontWeight: 800,
                      letterSpacing: '0.08em',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--earth-brown)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    {roleBadgeLabel}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.84rem', fontWeight: 600, color: 'var(--earth-brown)' }}>
                  {roleDisplayName}
                </p>
              </div>
            </div>

            {/* List 4 Info Cards (Matching Right Card) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              <div className="tech-profile-item">
                <div className="tech-profile-item-icon">
                  <User size={18} />
                </div>
                <div className="tech-profile-item-content">
                  <div className="tech-profile-item-label">Username Akun</div>
                  <div className="tech-profile-item-value">@{userHandle}</div>
                </div>
              </div>

              <div className="tech-profile-item">
                <div className="tech-profile-item-icon">
                  <Mail size={18} />
                </div>
                <div className="tech-profile-item-content">
                  <div className="tech-profile-item-label">Email Terdaftar</div>
                  <div className="tech-profile-item-value" title={currentUser?.email || 'teknisi@shroomsync.local'}>
                    {currentUser?.email || 'teknisi@shroomsync.local'}
                  </div>
                </div>
              </div>

              <div className="tech-profile-item">
                <div className="tech-profile-item-icon">
                  <Phone size={18} />
                </div>
                <div className="tech-profile-item-content">
                  <div className="tech-profile-item-label">Kontak WhatsApp / HP</div>
                  <div className="tech-profile-item-value">
                    {currentUser?.phoneNumber || '081234567890'}
                  </div>
                </div>
              </div>

              <div className="tech-profile-item">
                <div className="tech-profile-item-icon">
                  {isTechUser ? <Wrench size={18} /> : isAdminUser ? <Shield size={18} /> : <Home size={18} />}
                </div>
                <div className="tech-profile-item-content">
                  <div className="tech-profile-item-label">
                    {isTechUser ? 'Penugasan Divisi' : isAdminUser ? 'Wilayah Operasional' : 'Lokasi Kumbung'}
                  </div>
                  <div className="tech-profile-item-value">
                    {isTechUser 
                      ? 'Divisi Hardware & Firmware SupaKu' 
                      : isAdminUser 
                      ? 'Otoritas Manajemen Wilayah ShroomSync' 
                      : (currentUser?.farmAddress || 'Kumbung Jamur Utama')}
                  </div>
                </div>
              </div>
            </div>

            {/* Clean Edit Profile Button at the bottom */}
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              <button 
                type="button"
                className="tech-btn-secondary" 
                style={{ width: '100%', justifyContent: 'center', height: '42px', gap: '8px', fontWeight: 600 }} 
                onClick={handleOpenEdit}
              >
                <Pencil size={15} />
                <span>Edit Informasi Profil</span>
              </button>
            </div>
          </motion.div>

          {/* KARTU 2: Pengaturan Keamanan & Akun */}
          <motion.div 
            className="tech-profile-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.08 }}
          >
            {/* Header: Title & Subtitle with matching height/border as Left Card */}
            <div className="tech-profile-header">
              <div className="tech-profile-item-icon" style={{ backgroundColor: 'var(--sage-soft)', color: 'var(--sage-green)', width: '48px', height: '48px', borderRadius: '14px' }}>
                <Shield size={24} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Keamanan & Akses
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  Kredensial login, sesi aktif, dan kendali akun
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              <div 
                className="tech-profile-item" 
                onClick={() => setShowPasswordModal(true)} 
                style={{ cursor: 'pointer' }}
              >
                <div className="tech-profile-item-icon" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--earth-brown)' }}>
                  <Key size={18} />
                </div>
                <div className="tech-profile-item-content">
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Ganti Kata Sandi</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Perbarui kata sandi akun secara berkala</div>
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  <ChevronDown size={18} style={{ transform: 'rotate(-90deg)' }} />
                </div>
              </div>
              
              <div className="tech-profile-item">
                <div className="tech-profile-item-icon" style={{ backgroundColor: 'var(--sage-soft)', color: 'var(--sage-green)' }}>
                  <Shield size={18} />
                </div>
                <div className="tech-profile-item-content">
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Status Akun</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {currentUser?.isFirstLogin ? 'Akun Baru Terdaftar' : 'Akun Terverifikasi Aktif'}
                  </div>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px', backgroundColor: 'var(--sage-soft)', border: '1px solid var(--border-color-strong)' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--sage-green)' }}></span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--sage-green)' }}>Aktif</span>
                </div>
              </div>

              <div className="tech-profile-item">
                <div className="tech-profile-item-icon" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                  <Terminal size={18} />
                </div>
                <div className="tech-profile-item-content">
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Keamanan Sesi</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Terotentikasi via JWT Bearer Token</div>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '999px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Aman
                </div>
              </div>

              <div 
                className="tech-profile-item" 
                onClick={onLogout} 
                style={{ cursor: 'pointer', backgroundColor: 'rgba(254, 242, 242, 0.5)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
              >
                <div className="tech-profile-item-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#EF4444' }}>
                  <LogOut size={18} />
                </div>
                <div className="tech-profile-item-content">
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#DC2626' }}>Keluar dari Aplikasi</div>
                  <div style={{ fontSize: '0.78rem', color: '#6B7280' }}>Hapus sesi masuk pada perangkat ini</div>
                </div>
                <div style={{ color: '#EF4444' }}>
                  <ChevronDown size={18} style={{ transform: 'rotate(-90deg)' }} />
                </div>
              </div>
            </div>

            {/* Quick action button matching Left Card bottom */}
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #F3F4F6' }}>
              <button 
                type="button"
                className="tech-btn-secondary" 
                style={{ width: '100%', justifyContent: 'center', height: '42px', gap: '8px', fontWeight: 600 }} 
                onClick={() => setShowPasswordModal(true)}
              >
                <Key size={15} />
                <span>Ganti Kata Sandi Akun</span>
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Modal Edit Profil */}
      {showEditModal && (
        <div className="tech-modal-overlay">
          <motion.div 
            className="tech-modal-card" 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="tech-modal-header">
              <div>
                <h3 className="tech-modal-title">Edit Informasi Profil</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#6B7280' }}>
                  {isTechUser 
                    ? 'Perbarui data identitas dan kontak akun teknisi Anda.' 
                    : isAdminUser
                    ? 'Perbarui data identitas administrator wilayah.'
                    : 'Perbarui data kontak dan usaha kumbung jamur Anda.'}
                </p>
              </div>
              <button 
                type="button" 
                className="tech-modal-close-btn" 
                onClick={() => setShowEditModal(false)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="tech-form-group">
                <label className="tech-form-label">Nama Lengkap</label>
                <input 
                  type="text" 
                  className="tech-form-input"
                  value={editForm.fullName} 
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} 
                  placeholder="Nama Lengkap"
                  required 
                />
              </div>

              <div className="tech-form-group">
                <label className="tech-form-label">Nomor WhatsApp / HP</label>
                <input 
                  type="tel" 
                  className="tech-form-input"
                  value={editForm.phoneNumber} 
                  onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })} 
                  placeholder="08xxxxxxxxxx"
                />
              </div>

              {!isTechUser && !isAdminUser && (
                <>
                  <div className="tech-form-group">
                    <label className="tech-form-label">Nama Kumbung / Usaha</label>
                    <input 
                      type="text" 
                      className="tech-form-input"
                      value={editForm.farmName} 
                      onChange={(e) => setEditForm({ ...editForm, farmName: e.target.value })} 
                      placeholder="Nama Kumbung"
                    />
                  </div>
                  <div className="tech-form-group">
                    <label className="tech-form-label">Alamat Lokasi Kumbung</label>
                    <textarea 
                      className="tech-form-input"
                      rows={2}
                      value={editForm.farmAddress} 
                      onChange={(e) => setEditForm({ ...editForm, farmAddress: e.target.value })} 
                      placeholder="Alamat Lokasi Kumbung"
                    />
                  </div>
                </>
              )}

              <div className="tech-modal-actions">
                <button type="button" className="tech-btn-secondary" onClick={() => setShowEditModal(false)}>Batal</button>
                <button type="submit" className="tech-btn-primary" disabled={loading}>
                  {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal Ganti Password */}
      {showPasswordModal && (
        <div className="tech-modal-overlay">
          <motion.div 
            className="tech-modal-card" 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="tech-modal-header">
              <div>
                <h3 className="tech-modal-title">Ganti Kata Sandi</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#6B7280' }}>
                  Pastikan kata sandi baru Anda minimal 6 karakter.
                </p>
              </div>
              <button 
                type="button" 
                className="tech-modal-close-btn" 
                onClick={() => setShowPasswordModal(false)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSavePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="tech-form-group">
                <label className="tech-form-label">Kata Sandi Saat Ini</label>
                <input 
                  type="password" 
                  className="tech-form-input"
                  placeholder="Masukkan kata sandi lama"
                  value={passwordForm.currentPassword} 
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} 
                  required 
                />
              </div>

              <div className="tech-form-group">
                <label className="tech-form-label">Kata Sandi Baru</label>
                <input 
                  type="password" 
                  className="tech-form-input"
                  placeholder="Minimal 6 karakter"
                  value={passwordForm.newPassword} 
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} 
                  required 
                />
              </div>

              <div className="tech-form-group">
                <label className="tech-form-label">Ulangi Kata Sandi Baru</label>
                <input 
                  type="password" 
                  className="tech-form-input"
                  placeholder="Konfirmasi kata sandi baru"
                  value={passwordForm.confirmPassword} 
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} 
                  required 
                />
              </div>

              <div className="tech-modal-actions">
                <button type="button" className="tech-btn-secondary" onClick={() => setShowPasswordModal(false)}>Batal</button>
                <button type="submit" className="tech-btn-primary" disabled={loading}>
                  {loading ? 'Menyimpan...' : 'Ganti Password'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </>
  );
};

// --- 7. Kontrol Content ---
const KontrolContent = ({ selectedDeviceId, setSelectedDeviceId, devices, updateDevice, onMenuToggle }) => {
  const [opMode, setOpMode] = useState(2); // 1=Manual, 2=Auto, 3=Hybrid
  const [activeTab, setActiveTab] = useState(() => {
    // Load saved tab from localStorage
    const savedTab = localStorage.getItem('shroomsync_activeTab');
    return savedTab || 'parameter'; // 'parameter' or 'jadwal'
  });
  const [toast, setToast] = useState(null);

  // Auto States
  const [minS, setMinS] = useState(26);
  const [midS, setMidS] = useState(28);
  const [minK, setMinK] = useState(80);
  const [midK, setMidK] = useState(90);

  // Track original setpoint values to send only changed parameters
  const [originalSetpoints, setOriginalSetpoints] = useState({
    minS: 26, midS: 28, minK: 80, midK: 90
  });

  // Manual actuator request state
  const [pendingActuators, setPendingActuators] = useState({ pump: false, fan: false });

  // Schedule States
  const [timerMenit, setTimerMenit] = useState(1);
  const [timerDetik, setTimerDetik] = useState(30);
  const [flrMenit, setFlrMenit] = useState(2);
  const [flrDetik, setFlrDetik] = useState(0);
  const [jam1, setJam1] = useState(7);
  const [menit1, setMenit1] = useState(0);
  const [jam2, setJam2] = useState(12);
  const [menit2, setMenit2] = useState(0);
  const [jam3, setJam3] = useState(16);
  const [menit3, setMenit3] = useState(30);
  const [flrJam1, setFlrJam1] = useState(8);
  const [flrMenit1, setFlrMenit1] = useState(0);
  const [scheduleFreq, setScheduleFreq] = useState(3);

  // Track original schedule values to send only changed parameters
  const [originalSchedule, setOriginalSchedule] = useState({
    jam1: 7, menit1: 0,
    jam2: 12, menit2: 0,
    jam3: 16, menit3: 0,
    flrJam1: 8, flrMenit1: 0
  });

  // Auto Weather Schedule States
  const [scheduleAuto, setScheduleAuto] = useState(() => {
    // Load from localStorage on initial render
    const saved = localStorage.getItem(`shroomsync_scheduleAuto_${selectedDeviceId || 'default'}`);
    return saved ? JSON.parse(saved) : false;
  });
  const [weatherData, setWeatherData] = useState(() => {
    // Load cached weather data from localStorage
    const savedWeather = localStorage.getItem(`shroomsync_weatherData_${selectedDeviceId || 'default'}`);
    return savedWeather ? JSON.parse(savedWeather) : null;
  });
  const [weatherLoading, setWeatherLoading] = useState(false);
  const deviceLocation = useMemo(() => ({ 
    lat: -6.95, 
    lon: 107.75, 
    adm4: '32.04.28.2001',
    city: 'Rancaekek Wetan',
    district: 'Rancaekek',
    province: 'Jawa Barat'
  }), []); // Rancaekek Wetan, Bandung

  const selectedControlDevice = useMemo(
    () => devices.find((device) => (device.deviceId || device.id) === selectedDeviceId),
    [devices, selectedDeviceId]
  );
  const currentControlMode = selectedControlDevice?.config?.controlMode ?? opMode;
  const actuatorControlsAvailable = currentControlMode === 1 || currentControlMode === 3;
  const pumpOn = isActiveValue(selectedControlDevice?.pumpStatus);
  const fanOn = isActiveValue(selectedControlDevice?.floorPumpStatus);
  const actuatorUpdatedLabel = selectedControlDevice?.actuatorUpdatedAt
    ? formatDateTime(selectedControlDevice.actuatorUpdatedAt)
    : 'Belum tersedia';

  useEffect(() => {
    if (!selectedDeviceId) return;

    let cancelled = false;
    const loadControlConfig = async () => {
      try {
        const device = await api.devices.get(selectedDeviceId);
        if (cancelled) return;
        if (device) updateDevice(device);
        if (!device?.config) return;

        const { config } = device;
        setOpMode(config.controlMode ?? 2);
        setScheduleFreq(config.scheduleMode ?? 1);
        const loadedMinS = config.minSuhu ?? config.minS ?? 26;
        const loadedMidS = config.midSuhu ?? config.midS ?? 28;
        const loadedMinK = config.minKelembaban ?? config.minK ?? 80;
        const loadedMidK = config.midKelembaban ?? config.midK ?? 90;
        setMinS(loadedMinS);
        setMidS(loadedMidS);
        setMinK(loadedMinK);
        setMidK(loadedMidK);
        // Save original values to track changes
        setOriginalSetpoints({
          minS: loadedMinS,
          midS: loadedMidS,
          minK: loadedMinK,
          midK: loadedMidK
        });
        setTimerMenit(config.timerMinute ?? 1);
        setTimerDetik(config.timerSecond ?? 30);
        setFlrMenit(config.floorTimerMinute ?? 2);
        setFlrDetik(config.floorTimerSecond ?? 0);
        const loadedJam1 = config.schedule1Hour ?? 7;
        const loadedMenit1 = config.schedule1Minute ?? 0;
        const loadedJam2 = config.schedule2Hour ?? 12;
        const loadedMenit2 = config.schedule2Minute ?? 0;
        const loadedJam3 = config.schedule3Hour ?? 16;
        const loadedMenit3 = config.schedule3Minute ?? 30;
        const loadedFlrJam1 = config.floorScheduleHour ?? 8;
        const loadedFlrMenit1 = config.floorScheduleMinute ?? 0;

        setJam1(loadedJam1);
        setMenit1(loadedMenit1);
        setJam2(loadedJam2);
        setMenit2(loadedMenit2);
        setJam3(loadedJam3);
        setMenit3(loadedMenit3);
        setFlrJam1(loadedFlrJam1);
        setFlrMenit1(loadedFlrMenit1);

        // Save original schedule values to track changes
        setOriginalSchedule({
          jam1: loadedJam1, menit1: loadedMenit1,
          jam2: loadedJam2, menit2: loadedMenit2,
          jam3: loadedJam3, menit3: loadedMenit3,
          flrJam1: loadedFlrJam1, flrMenit1: loadedFlrMenit1
        });
      } catch (error) {
        console.error('Failed to load control config:', error);
      }
    };

    loadControlConfig();
    return () => {
      cancelled = true;
    };
  }, [selectedDeviceId, updateDevice]);

  // Save scheduleAuto state to localStorage whenever it changes
  useEffect(() => {
    if (selectedDeviceId) {
      localStorage.setItem(`shroomsync_scheduleAuto_${selectedDeviceId}`, JSON.stringify(scheduleAuto));
    }
  }, [scheduleAuto, selectedDeviceId]);

  // Save activeTab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('shroomsync_activeTab', activeTab);
  }, [activeTab]);

  // Save weatherData to localStorage whenever it changes
  useEffect(() => {
    if (selectedDeviceId && weatherData) {
      localStorage.setItem(`shroomsync_weatherData_${selectedDeviceId}`, JSON.stringify(weatherData));
    }
  }, [weatherData, selectedDeviceId]);

  const handleSaveMode = async (mode) => {
    if (!selectedDeviceId) {
      setToast({ message: 'Pilih kumbung terlebih dahulu', type: 'warning' });
      return;
    }
    try {
      const result = await api.control.setMode(selectedDeviceId, mode);
      const updatedDevice = readDeviceFromResponse(result);
      if (updatedDevice) {
        updateDevice(updatedDevice);
      } else {
        const refreshedDevice = await api.devices.get(selectedDeviceId);
        updateDevice(refreshedDevice);
      }
      setOpMode(mode);
      const modeNames = { 1: 'Manual', 2: 'Auto', 3: 'Hybrid' };
      setToast({ message: `✓ Mode berubah ke ${modeNames[mode]}`, type: 'success' });
    } catch (e) {
      console.error(e);
      setToast({ message: 'Gagal mengubah mode', type: 'error' });
    }
  };

  const handleSaveSetpoint = async (type) => {
    if (!selectedDeviceId) {
      setToast({ message: 'Pilih kumbung terlebih dahulu', type: 'warning' });
      return;
    }
    try {
      // Build data object with only changed parameters
      const data = {};

      // For temperature (suhu), only send changed temperature-related params
      if (type === 'suhu') {
        if (minS !== originalSetpoints.minS) data.MinS = minS;
        if (midS !== originalSetpoints.midS) data.MidS = midS;
      }

      // For humidity (kelembaban), only send changed humidity-related params
      if (type === 'kelembaban') {
        if (minK !== originalSetpoints.minK) data.MinK = minK;
        if (midK !== originalSetpoints.midK) data.MidK = midK;
      }

      // If no changes, show message and return
      if (Object.keys(data).length === 0) {
        setToast({ message: 'Tidak ada perubahan yang perlu disimpan', type: 'info' });
        return;
      }

      await api.control.setSetpoint(selectedDeviceId, data);

      // Update original values after successful save
      setOriginalSetpoints(prev => ({
        ...prev,
        ...(data.MinS !== undefined ? { minS: data.MinS } : {}),
        ...(data.MidS !== undefined ? { midS: data.MidS } : {}),
        ...(data.MinK !== undefined ? { minK: data.MinK } : {}),
        ...(data.MidK !== undefined ? { midK: data.MidK } : {}),
      }));

      // Show which parameters were saved
      const changedParams = Object.keys(data).join(', ');
      setToast({ message: `✓ Parameter ${changedParams} tersimpan`, type: 'success' });
    } catch (e) {
      console.error(e);
      setToast({ message: `Gagal menyimpan parameter ${type === 'suhu' ? 'suhu' : 'kelembaban'}`, type: 'error' });
    }
  };

  const handleSaveTimer = async (type) => {
    if (!selectedDeviceId) {
      setToast({ message: 'Pilih kumbung terlebih dahulu', type: 'warning' });
      return;
    }
    try {
      if (type === 'mist') {
        await api.control.setTimer(selectedDeviceId, timerMenit, timerDetik);
        setToast({ message: `✓ Timer Kabut: ${timerMenit}m ${timerDetik}s tersimpan`, type: 'success' });
      } else {
        await api.control.setTimerFloor(selectedDeviceId, flrMenit, flrDetik);
        setToast({ message: `✓ Timer Lantai: ${flrMenit}m ${flrDetik}s tersimpan`, type: 'success' });
      }
    } catch (e) {
      console.error(e);
      setToast({ message: `Gagal menyimpan timer ${type === 'mist' ? 'kabut' : 'lantai'}`, type: 'error' });
    }
  };

  const handleSaveSchedule = async (type) => {
    if (!selectedDeviceId) {
      setToast({ message: 'Pilih kumbung terlebih dahulu', type: 'warning' });
      return;
    }
    try {
      if (type === 'mist') {
        // Build data object with only changed schedule parameters
        const data = {};

        // Only include schedule slots that have changed and are active based on frequency
        if (jam1 !== originalSchedule.jam1) data.jam1 = jam1;
        if (menit1 !== originalSchedule.menit1) data.menit1 = menit1;

        // Only include slot 2 if frequency >= 2 and values changed
        if (scheduleFreq >= 2) {
          if (jam2 !== originalSchedule.jam2) data.jam2 = jam2;
          if (menit2 !== originalSchedule.menit2) data.menit2 = menit2;
        }

        // Only include slot 3 if frequency === 3 and values changed
        if (scheduleFreq === 3) {
          if (jam3 !== originalSchedule.jam3) data.jam3 = jam3;
          if (menit3 !== originalSchedule.menit3) data.menit3 = menit3;
        }

        // If no changes, show message and return
        if (Object.keys(data).length === 0) {
          setToast({ message: 'Tidak ada perubahan jadwal yang perlu disimpan', type: 'info' });
          return;
        }

        await api.control.setSchedule(selectedDeviceId, data);

        // Update original values after successful save
        setOriginalSchedule(prev => ({ ...prev, ...data }));

        // Show which parameters were saved
        const changedParams = Object.keys(data).join(', ');
        setToast({ message: `✓ Jadwal ${changedParams} tersimpan`, type: 'success' });
      } else {
        // For floor schedule
        const changedFields = [];
        if (flrJam1 !== originalSchedule.flrJam1) changedFields.push('FlrJam');
        if (flrMenit1 !== originalSchedule.flrMenit1) changedFields.push('FlrMenit');

        // If no changes, show message and return
        if (changedFields.length === 0) {
          setToast({ message: 'Tidak ada perubahan jadwal lantai yang perlu disimpan', type: 'info' });
          return;
        }

        const data = {
          FlrJam: flrJam1,
          FlrMenit: flrMenit1
        };

        await api.control.setScheduleFloor(selectedDeviceId, data);

        // Update original values after successful save
        setOriginalSchedule(prev => ({ ...prev, flrJam1, flrMenit1 }));

        // Show which parameters were saved
        const changedParams = changedFields.join(', ');
        setToast({ message: `✓ Jadwal Lantai ${changedParams} tersimpan`, type: 'success' });
      }
    } catch (e) {
      console.error(e);
      setToast({ message: `Gagal menyimpan jadwal ${type === 'mist' ? 'kabut' : 'lantai'}`, type: 'error' });
    }
  };

  const handleSaveScheduleFreq = async () => {
    if (!selectedDeviceId) {
      setToast({ message: 'Pilih kumbung terlebih dahulu', type: 'warning' });
      return;
    }
    try {
      await api.control.setScheduleMode(selectedDeviceId, scheduleFreq);
      const freqText = { 1: '1x Sehari', 2: '2x Sehari', 3: '3x Sehari' }[scheduleFreq];
      setToast({ message: `✓ Setting jadwal: ${freqText}`, type: 'success' });
    } catch (e) {
      console.error(e);
      setToast({ message: 'Gagal mengubah frekuensi penyiraman', type: 'error' });
    }
  };

  // Weather-based Auto Schedule Functions
  const fetchWeatherAndApplySchedule = useCallback(async (isManual = true) => {
    console.log('fetchWeatherAndApplySchedule called with isManual=', isManual);
    console.log('selectedDeviceId:', selectedDeviceId);
    
    if (!selectedDeviceId) {
      console.warn('selectedDeviceId is not set');
      setToast({ message: 'Pilih kumbung terlebih dahulu', type: 'warning' });
      return false;
    }
    
    setWeatherLoading(true);
    try {
      console.log('Fetching weather from BMKG...');
      // Fetch weather data from BMKG
      const weather = await weatherService.getForecast(deviceLocation);
      console.log('Weather data received:', weather);
      
      // Parse weather condition
      const condition = weatherService.parseWeatherCondition(weather);
      console.log('Parsed weather condition:', condition);
      
      if (!condition) {
        console.error('Failed to parse weather condition');
        setWeatherData(weather);
        setToast({ message: 'Gagal membaca data cuaca', type: 'error' });
        return false;
      }
      
      // Calculate optimal schedule
      const optimalSchedule = weatherService.calculateOptimalSchedule(condition);
      console.log('Calculated optimal schedule:', optimalSchedule);

      const scheduleData = {
        jam1: optimalSchedule.jam1,
        menit1: optimalSchedule.menit1,
        jam2: optimalSchedule.jam2,
        menit2: optimalSchedule.menit2,
        jam3: optimalSchedule.jam3,
        menit3: optimalSchedule.menit3,
      };
      const floorScheduleData = {
        FlrJam: optimalSchedule.floorScheduleHour,
        FlrMenit: optimalSchedule.floorScheduleMinute,
      };

      console.log('Recommendation payloads:', {
        schedule: scheduleData,
        floorSchedule: floorScheduleData,
        scheduleMode: optimalSchedule.freq,
        timer: { Menit: optimalSchedule.timerMenit, Detik: optimalSchedule.timerDetik },
        floorTimer: { FlrMenit: optimalSchedule.floorTimerMenit, FlrDetik: optimalSchedule.floorTimerDetik },
      });

      await Promise.all([
        api.control.setSchedule(selectedDeviceId, scheduleData),
        api.control.setScheduleFloor(selectedDeviceId, floorScheduleData),
        api.control.setScheduleMode(selectedDeviceId, optimalSchedule.freq),
        api.control.setTimer(selectedDeviceId, optimalSchedule.timerMenit, optimalSchedule.timerDetik),
        api.control.setTimerFloor(selectedDeviceId, optimalSchedule.floorTimerMenit, optimalSchedule.floorTimerDetik),
      ]);

      setWeatherData({
        ...weather,
        recommendation: {
          ...optimalSchedule,
          weatherCondition: condition.condition,
          weatherDesc: condition.weatherDesc,
          humidity: condition.humidity,
          tempMax: condition.tempMax,
        },
      });

      // Now update local state AFTER sending to API
      setScheduleFreq(optimalSchedule.freq);
      setJam1(optimalSchedule.jam1);
      setMenit1(optimalSchedule.menit1);
      setJam2(optimalSchedule.jam2);
      setMenit2(optimalSchedule.menit2);
      setJam3(optimalSchedule.jam3);
      setMenit3(optimalSchedule.menit3);

      setFlrJam1(optimalSchedule.floorScheduleHour);
      setFlrMenit1(optimalSchedule.floorScheduleMinute);
      setTimerMenit(optimalSchedule.timerMenit);
      setTimerDetik(optimalSchedule.timerDetik);
      setFlrMenit(optimalSchedule.floorTimerMenit);
      setFlrDetik(optimalSchedule.floorTimerDetik);

      // Update original values after the backend accepts the recommendation.
      setOriginalSchedule({
        flrJam1: optimalSchedule.floorScheduleHour,
        flrMenit1: optimalSchedule.floorScheduleMinute,
        jam1: optimalSchedule.jam1,
        menit1: optimalSchedule.menit1,
        jam2: optimalSchedule.jam2,
        menit2: optimalSchedule.menit2,
        jam3: optimalSchedule.jam3,
        menit3: optimalSchedule.menit3,
      });
      
      if (isManual) {
        setToast({ 
          message: `✓ Jadwal otomatis: ${optimalSchedule.reason}`, 
          type: 'success' 
        });
      }
      
      console.log('Weather recommendation saved successfully');
      return true;
    } catch (error) {
      console.error('Weather schedule error:', error);
      setToast({ message: 'Gagal menyimpan rekomendasi BMKG ke database', type: 'error' });
      return false;
    } finally {
      setWeatherLoading(false);
    }
  }, [
    deviceLocation,
    selectedDeviceId,
  ]);

  // Reload saved states when selectedDeviceId changes
  useEffect(() => {
    if (!selectedDeviceId) return undefined;

    let cancelled = false;
    const syncSavedStates = async () => {
      await Promise.resolve();
      if (cancelled) return;

      const savedWeather = localStorage.getItem(`shroomsync_weatherData_${selectedDeviceId}`);
      let isWeatherFresh = false;
      if (savedWeather !== null) {
        const parsedWeather = JSON.parse(savedWeather);
        setWeatherData(parsedWeather);

        if (parsedWeather.lastUpdated) {
          const lastUpdate = new Date(parsedWeather.lastUpdated).getTime();
          isWeatherFresh = Date.now() - lastUpdate < 30 * 60 * 1000;
        }
      }

      const savedAuto = localStorage.getItem(`shroomsync_scheduleAuto_${selectedDeviceId}`);
      const autoEnabled = savedAuto === 'true';
      setScheduleAuto(autoEnabled);
      if (autoEnabled && !isWeatherFresh) {
        fetchWeatherAndApplySchedule(false);
      }
    };

    syncSavedStates();
    return () => {
      cancelled = true;
    };
  }, [fetchWeatherAndApplySchedule, selectedDeviceId]);

  const toggleAutoSchedule = async () => {
    console.log('🔄 toggleAutoSchedule called, current scheduleAuto:', scheduleAuto);
    const newAutoState = !scheduleAuto;
    console.log('📍 Setting scheduleAuto to:', newAutoState);
    setScheduleAuto(newAutoState);
    
    if (newAutoState) {
      // Enable auto - fetch weather and apply
      console.log('Auto mode enabled, calling fetchWeatherAndApplySchedule...');
      const saved = await fetchWeatherAndApplySchedule();
      if (!saved) setScheduleAuto(false);
    } else {
      // Disable auto - user can now manually edit
      console.log('Auto mode disabled');
      setToast({ message: 'Mode manual aktif - silakan atur jadwal sendiri', type: 'info' });
    }
  };

  const handleActuator = async (actuator, currentState) => {
    if (!selectedDeviceId) {
      setToast({ message: 'Pilih kumbung terlebih dahulu', type: 'warning' });
      return;
    }

    if (!actuatorControlsAvailable) {
      setToast({ message: 'Kontrol manual aktuator hanya tersedia di mode Manual atau Hybrid', type: 'warning' });
      return;
    }

    if (pendingActuators[actuator]) return;

    const newState = !currentState;
    const label = actuator === 'pump' ? 'Pompa Kabut' : 'Pompa Lantai';

    setPendingActuators((prev) => ({ ...prev, [actuator]: true }));
    setToast({ message: `${label} ${newState ? 'ON' : 'OFF'} sedang dikirim...`, type: 'info' });

    try {
      const result = actuator === 'pump'
        ? await api.control.controlPump(selectedDeviceId, { on: newState })
        : await api.control.controlFan(selectedDeviceId, { on: newState });

      const updatedDevice = readDeviceFromResponse(result);
      if (updatedDevice) {
        updateDevice(updatedDevice);
      } else {
        const refreshedDevice = await api.devices.get(selectedDeviceId);
        updateDevice(refreshedDevice);
      }
      setToast({ message: `✓ ${label} ${newState ? 'ON' : 'OFF'}`, type: 'success' });
    } catch (e) {
      console.error(e);
      setToast({ message: `Gagal mengontrol ${label.toLowerCase()}`, type: 'error' });
    } finally {
      setPendingActuators((prev) => ({ ...prev, [actuator]: false }));
    }
  };

  const modeDescriptions = {
    1: 'Kontrol aktuator sepenuhnya melalui switch manual.',
    2: 'Sistem menjalankan aktuator berdasarkan setpoint suhu dan kelembaban.',
    3: 'Mode auto berdasarkan setpoint dengan opsi override aktuator manual.',
  };
  const currentWeather = weatherService.getCurrentForecast(weatherData);
  const weatherLocation = weatherData?.lokasi || {};
  const weatherRecommendationReason = weatherData?.recommendation?.reason;

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <Header 
        title="Kontrol & Pengaturan"
        subtitle="Konfigurasi logika aktuator berdasarkan spesifikasi firmware SupaKu."
        breadcrumb={['Petani Panel', 'Kontrol & Parameter']}
        onMenuToggle={onMenuToggle}
      />
      
      <div className="page-content">
        <motion.div 
          className="control-toolbar"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="control-device-picker">
            <span className="filter-label">Kumbung Aktif</span>
            <select 
              className="control-select" 
              value={selectedDeviceId || ''} 
              onChange={(e) => setSelectedDeviceId(e.target.value)}
            >
              {devices.length === 0 && <option value="">Belum ada kumbung</option>}
              {devices.map(d => (
                <option key={d.deviceId || d.id} value={d.deviceId || d.id}>{d.name || d.deviceId || d.id}</option>
              ))}
            </select>
            <span className={`control-device-status ${selectedControlDevice?.isOnline ? 'online' : 'offline'}`}>
              {selectedControlDevice?.isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          <div className="toggle-group control-tabs">
            <button className={`toggle-btn ${activeTab === 'parameter' ? 'active' : ''}`} onClick={() => setActiveTab('parameter')}>Parameter Kontrol</button>
            <button className={`toggle-btn ${activeTab === 'jadwal' ? 'active' : ''}`} onClick={() => setActiveTab('jadwal')}>Jadwal & Timer</button>
          </div>
        </motion.div>

        <motion.div 
          className="control-surface"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {activeTab === 'parameter' && (
            <>
              <section className="control-card mode-card">
                <div className="control-card-header">
                  <div>
                    <h3>Mode Operasi Sistem</h3>
                    <p>Mode saat ini: {currentControlMode === 1 ? 'Manual' : currentControlMode === 2 ? 'Auto' : 'Hybrid'}</p>
                  </div>
                </div>
                <div className="mode-selector">
                  <button className={`mode-btn ${currentControlMode === 1 ? 'active' : ''}`} onClick={() => handleSaveMode(1)}>
                    <span>Manual</span>
                    <small>Switch aktuator langsung</small>
                  </button>
                  <button className={`mode-btn ${currentControlMode === 2 ? 'active' : ''}`} onClick={() => handleSaveMode(2)}>
                    <span>Auto</span>
                    <small>Ikuti setpoint sensor</small>
                  </button>
                  <button className={`mode-btn ${currentControlMode === 3 ? 'active' : ''}`} onClick={() => handleSaveMode(3)}>
                    <span>Hybrid</span>
                    <small>Auto dengan override</small>
                  </button>
                </div>
                <div className="info-alert control-note">
                  <Info size={16} className="info-icon" />
                  <p>{modeDescriptions[currentControlMode]}</p>
                </div>
              </section>

              <div className={`control-layout ${currentControlMode === 1 ? 'manual-only' : ''} ${currentControlMode === 2 ? 'auto-only' : ''} ${currentControlMode === 3 ? 'hybrid' : ''}`}>
                {actuatorControlsAvailable && (
                  <section className="control-card">
                    <div className="control-card-header">
                      <div>
                        <h3>Kontrol Manual Aktuator</h3>
                        <p>Status terakhir: {actuatorUpdatedLabel}</p>
                      </div>
                    </div>
                    <div className="actuator-list">
                      <div className="actuator-card">
                        <div className="actuator-info">
                          <div className={`actuator-icon ${fanOn ? 'active floor' : ''}`}><Waves size={24} /></div>
                          <div>
                            <h4>Pompa Lantai (Floor Pump)</h4>
                            <p className="text-muted">{pendingActuators.fan ? 'Mengirim perintah...' : fanOn ? 'Aktif' : 'Nonaktif'} untuk membasahi lantai kumbung.</p>
                          </div>
                        </div>
                        <button type="button" className={`toggle-switch large ${fanOn ? 'active' : ''} ${pendingActuators.fan ? 'pending' : ''}`} aria-pressed={fanOn} aria-busy={pendingActuators.fan} disabled={pendingActuators.fan} onClick={() => handleActuator('fan', fanOn)}></button>
                      </div>

                      <div className="actuator-card">
                        <div className="actuator-info">
                          <div className={`actuator-icon ${pumpOn ? 'active pump' : ''}`}><Droplet size={24} /></div>
                          <div>
                            <h4>Pompa Kabut (Mist Pump)</h4>
                            <p className="text-muted">{pendingActuators.pump ? 'Mengirim perintah...' : pumpOn ? 'Aktif' : 'Nonaktif'} untuk menaikkan kelembaban ruang.</p>
                          </div>
                        </div>
                        <button type="button" className={`toggle-switch large ${pumpOn ? 'active' : ''} ${pendingActuators.pump ? 'pending' : ''}`} aria-pressed={pumpOn} aria-busy={pendingActuators.pump} disabled={pendingActuators.pump} onClick={() => handleActuator('pump', pumpOn)}></button>
                      </div>
                    </div>
                  </section>
                )}

                {(currentControlMode === 2 || currentControlMode === 3) && (
                  <section className="setpoint-grid">
                    <div className="control-card setpoint-card">
                      <div className="control-card-header">
                        <div>
                          <h3>SetPoint Suhu</h3>
                          <p>Batas kerja aktuator suhu.</p>
                        </div>
                        <Thermometer size={20} className="text-sage" />
                      </div>
                      <div className="control-group">
                        <div className="control-header">
                          <span className="control-label">Min Suhu (MinS)</span>
                          <span className="control-value">{minS} °C</span>
                        </div>
                        <input type="range" className="control-slider temp-slider" min="20" max="35" step="1" value={minS} onChange={(e) => setMinS(parseInt(e.target.value, 10))} />
                      </div>
                      <div className="control-group" style={{ marginTop: '24px' }}>
                        <div className="control-header">
                          <span className="control-label">Mid Suhu (MidS)</span>
                          <span className="control-value">{midS} °C</span>
                        </div>
                        <input type="range" className="control-slider temp-slider" min="20" max="35" step="1" value={midS} onChange={(e) => setMidS(parseInt(e.target.value, 10))} />
                      </div>
                      <button className="primary-button outline full-button" onClick={() => handleSaveSetpoint('suhu')}>Simpan Parameter Suhu</button>
                    </div>

                    <div className="control-card setpoint-card">
                      <div className="control-card-header">
                        <div>
                          <h3>SetPoint Kelembaban</h3>
                          <p>Batas kerja pompa kabut.</p>
                        </div>
                        <Droplets size={20} className="text-blue" />
                      </div>
                      <div className="control-group">
                        <div className="control-header">
                          <span className="control-label">Min Kelembaban (MinK)</span>
                          <span className="control-value">{minK} %</span>
                        </div>
                        <input type="range" className="control-slider hum-slider" min="50" max="100" step="1" value={minK} onChange={(e) => setMinK(parseInt(e.target.value))} />
                      </div>
                      <div className="control-group" style={{ marginTop: '24px' }}>
                        <div className="control-header">
                          <span className="control-label">Mid Kelembaban (MidK)</span>
                          <span className="control-value">{midK} %</span>
                        </div>
                        <input type="range" className="control-slider hum-slider" min="50" max="100" step="1" value={midK} onChange={(e) => setMidK(parseInt(e.target.value))} />
                      </div>
                      <button className="primary-button outline full-button" onClick={() => handleSaveSetpoint('kelembaban')}>Simpan Parameter Kelembaban</button>
                    </div>
                  </section>
                )}

              </div>
            </>
          )}

          {activeTab === 'jadwal' && (
            <>
              {/* Auto/Manual Schedule Toggle */}
              <section className="control-card mode-card">
                <div className="control-card-header">
                  <div>
                    <h3>Mode Jadwal Penyiraman</h3>
                    <p>{scheduleAuto ? 'Jadwal otomatis berdasarkan prakiraan cuaca BMKG' : 'Atur jadwal secara manual'}</p>
                  </div>
                </div>
                <div className="mode-selector">
                  <button 
                    className={`mode-btn ${!scheduleAuto ? 'active' : ''}`} 
                    onClick={() => !scheduleAuto ? null : toggleAutoSchedule()}
                    disabled={!scheduleAuto}
                  >
                    <span>Manual</span>
                    <small>Atur jadwal sendiri</small>
                  </button>
                  <button 
                    className={`mode-btn ${scheduleAuto ? 'active' : ''}`} 
                    onClick={toggleAutoSchedule}
                    disabled={weatherLoading}
                  >
                    <span>Otomatis</span>
                    <small>{weatherLoading ? 'Memuat cuaca...' : 'Berdasarkan cuaca BMKG'}</small>
                  </button>
                </div>
                
                {/* Weather Info Display */}
                {scheduleAuto && weatherData && (
                  <div className="weather-info-card" style={{ 
                    marginTop: '16px', 
                    padding: '16px', 
                    background: 'var(--bg-secondary)', 
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    position: 'relative'
                  }}>
                    <button 
                      onClick={() => fetchWeatherAndApplySchedule(true)}
                      style={{ position: 'absolute', top: '12px', right: '12px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                      title="Refresh Cuaca"
                      disabled={weatherLoading}
                    >
                      <RefreshCw size={14} className={weatherLoading ? 'animate-spin' : ''} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <Cloud size={24} className="text-blue" />
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1rem' }}>
                          {weatherLocation.desa || deviceLocation.city}
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {weatherLocation.kecamatan || deviceLocation.district}, {weatherLocation.kotkab || weatherLocation.kota || weatherLocation.provinsi || deviceLocation.province}
                        </p>
                      </div>
                    </div>
                    {currentWeather && (
                      <div className="weather-metrics-grid" style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(3, 1fr)', 
                        gap: '12px',
                        fontSize: '0.85rem'
                      }}>
                        <div className="weather-metric" style={{ textAlign: 'center', padding: '8px', background: 'white', borderRadius: '8px' }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Cuaca</div>
                          <div style={{ fontWeight: 600 }}>{currentWeather.weather}</div>
                        </div>
                        <div className="weather-metric" style={{ textAlign: 'center', padding: '8px', background: 'white', borderRadius: '8px' }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Suhu</div>
                          <div style={{ fontWeight: 600 }}>{currentWeather.temp}°C</div>
                        </div>
                        <div className="weather-metric" style={{ textAlign: 'center', padding: '8px', background: 'white', borderRadius: '8px' }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Kelembaban</div>
                          <div style={{ fontWeight: 600 }}>{currentWeather.humidity}%</div>
                        </div>
                      </div>
                    )}
                    <div className="info-alert control-note" style={{ marginTop: '12px' }}>
                      <Info size={14} className="info-icon" />
                      <p style={{ fontSize: '0.8rem' }}>
                        Jadwal telah disesuaikan otomatis berdasarkan kondisi cuaca. 
                        {weatherRecommendationReason || (scheduleFreq === 1 && 'Hujan lebat - penyiraman minimal.')}
                        {!weatherRecommendationReason && scheduleFreq === 2 && 'Kondisi normal - penyiraman standar.'}
                        {!weatherRecommendationReason && scheduleFreq === 3 && 'Panas terik - penyiraman intensif.'}
                      </p>
                    </div>
                    {weatherData?.lastUpdated && (
                      <p style={{ margin: '8px 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                        Sumber BMKG, update terakhir: {new Date(weatherData.lastUpdated).toLocaleTimeString('id-ID')}
                      </p>
                    )}
                  </div>
                )}
                
                <div className="info-alert control-note" style={{ marginTop: '12px' }}>
                  <Info size={16} className="info-icon" />
                  <p>{scheduleAuto 
                    ? 'Mode otomatis: Jadwal akan menyesuaikan dengan prakiraan cuaca BMKG setiap hari.' 
                    : 'Mode manual: Anda dapat mengatur jadwal penyiraman sesuai kebutuhan.'}
                  </p>
                </div>

                {/* Status Settingan Card */}
                <div className="status-settings-card" style={{ 
                  marginTop: '16px', 
                  padding: '16px', 
                  background: 'linear-gradient(135deg, var(--sage-green) 0%, var(--earth-brown) 100%)', 
                  borderRadius: '12px',
                  color: 'white'
                }}>
                  <div className="status-settings-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Settings size={18} />
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Status Settingan Aktif</h4>
                  </div>
                  
                  <div className="status-settings-grid" style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
                    gap: '10px',
                    fontSize: '0.8rem'
                  }}>
                    {/* Mode Jadwal */}
                    <div className="status-settings-item" style={{ 
                      background: 'rgba(255,255,255,0.15)', 
                      padding: '10px', 
                      borderRadius: '8px',
                      backdropFilter: 'blur(4px)'
                    }}>
                      <div style={{ opacity: 0.9, fontSize: '0.7rem', marginBottom: '2px' }}>Mode Jadwal</div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {scheduleAuto ? '🌤️ Otomatis (BMKG)' : '✏️ Manual'}
                      </div>
                    </div>

                    {/* Frekuensi */}
                    <div className="status-settings-item" style={{ 
                      background: 'rgba(255,255,255,0.15)', 
                      padding: '10px', 
                      borderRadius: '8px',
                      backdropFilter: 'blur(4px)'
                    }}>
                      <div style={{ opacity: 0.9, fontSize: '0.7rem', marginBottom: '2px' }}>Frekuensi Kabut</div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {scheduleFreq}x Sehari
                      </div>
                    </div>

                    {/* Timer Kabut */}
                    <div className="status-settings-item" style={{ 
                      background: 'rgba(255,255,255,0.15)', 
                      padding: '10px', 
                      borderRadius: '8px',
                      backdropFilter: 'blur(4px)'
                    }}>
                      <div style={{ opacity: 0.9, fontSize: '0.7rem', marginBottom: '2px' }}>Timer Kabut</div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {timerMenit}m {timerDetik}s
                      </div>
                    </div>

                    {/* Timer Lantai */}
                    <div className="status-settings-item" style={{ 
                      background: 'rgba(255,255,255,0.15)', 
                      padding: '10px', 
                      borderRadius: '8px',
                      backdropFilter: 'blur(4px)'
                    }}>
                      <div style={{ opacity: 0.9, fontSize: '0.7rem', marginBottom: '2px' }}>Timer Lantai</div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {flrMenit}m {flrDetik}s
                      </div>
                    </div>

                    {/* Jadwal Berikutnya */}
                    <div className="status-settings-item status-settings-schedule" style={{ 
                      background: 'rgba(255,255,255,0.2)', 
                      padding: '10px', 
                      borderRadius: '8px',
                      backdropFilter: 'blur(4px)',
                      gridColumn: '1 / -1'
                    }}>
                      <div style={{ opacity: 0.9, fontSize: '0.7rem', marginBottom: '4px' }}>Jadwal Penyiraman</div>
                      <div className="status-settings-schedule-row" style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <span>🌫️ Kabut: {jam1.toString().padStart(2,'0')}:{menit1.toString().padStart(2,'0')}
                          {scheduleFreq >= 2 && `, ${jam2.toString().padStart(2,'0')}:${menit2.toString().padStart(2,'0')}`}
                          {scheduleFreq === 3 && `, ${jam3.toString().padStart(2,'0')}:${menit3.toString().padStart(2,'0')}`}
                        </span>
                        <span>|</span>
                        <span>🌊 Lantai: {flrJam1.toString().padStart(2,'0')}:{flrMenit1.toString().padStart(2,'0')}</span>
                      </div>
                    </div>
                  </div>

                  {scheduleAuto && (
                    <div className="auto-adjust-note" style={{ 
                      marginTop: '10px', 
                      padding: '8px 12px', 
                      background: 'rgba(255,255,255,0.25)', 
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      textAlign: 'center'
                    }}>
                      <span style={{ fontWeight: 600 }}>🤖 Auto-Adjust Aktif:</span> Jadwal menyesuaikan cuaca {deviceLocation.city}
                    </div>
                  )}
                </div>
              </section>

              <section className={`control-card schedule-frequency-card ${scheduleAuto ? 'disabled' : ''}`}>
                <div className="control-card-header">
                  <div>
                    <h3>Frekuensi Penyiraman Harian</h3>
                    <p>Jumlah jadwal aktif untuk pompa kabut.</p>
                  </div>
                </div>
                <div className="toggle-group frequency-toggle">
                  <button className={`toggle-btn ${scheduleFreq === 1 ? 'active' : ''}`} onClick={() => setScheduleFreq(1)} disabled={scheduleAuto}>1x Sehari</button>
                  <button className={`toggle-btn ${scheduleFreq === 2 ? 'active' : ''}`} onClick={() => setScheduleFreq(2)} disabled={scheduleAuto}>2x Sehari</button>
                  <button className={`toggle-btn ${scheduleFreq === 3 ? 'active' : ''}`} onClick={() => setScheduleFreq(3)} disabled={scheduleAuto}>3x Sehari</button>
                </div>
                <button className="primary-button outline full-button" onClick={handleSaveScheduleFreq} disabled={scheduleAuto}>Setting Jadwal</button>
              </section>

              <div className="schedule-grid">
                <section className={`control-card schedule-card ${scheduleAuto ? 'disabled' : ''}`}>
                  <div className="control-card-header">
                    <div>
                      <h3>Pompa Kabut</h3>
                      <p>{scheduleAuto ? 'Jadwal otomatis aktif' : 'Durasi siklus dan jadwal penyiraman kabut.'}</p>
                    </div>
                    <Droplet size={20} className="text-blue" />
                  </div>
                  <div className={`control-section ${scheduleAuto ? 'disabled' : ''}`}>
                    <h4>Siklus Timer</h4>
                    <div className="time-inputs">
                      <div className="input-group">
                        <label className="filter-label">Menit</label>
                        <input className="control-input" type="number" min="0" max="59" value={timerMenit} onChange={(e) => setTimerMenit(parseInt(e.target.value))} disabled={scheduleAuto} />
                      </div>
                      <div className="input-group">
                        <label className="filter-label">Detik</label>
                        <input className="control-input" type="number" min="0" max="59" value={timerDetik} onChange={(e) => setTimerDetik(parseInt(e.target.value))} disabled={scheduleAuto} />
                      </div>
                    </div>
                  </div>
                  <button className="primary-button outline full-button" onClick={() => handleSaveTimer('mist')} disabled={scheduleAuto}>Simpan Timer Kabut</button>

                  <div className={`control-section divided ${scheduleAuto ? 'disabled' : ''}`}>
                    <h4>Jadwal Penyiraman Kabut</h4>
                    <div className="slot-item">
                      <span className="font-semibold">Jadwal 1</span>
                      <input className="control-input compact" type="number" min="0" max="23" value={jam1} onChange={(e) => setJam1(parseInt(e.target.value))} disabled={scheduleAuto} />
                      <span className="font-semibold">:</span>
                      <input className="control-input compact" type="number" min="0" max="59" value={menit1} onChange={(e) => setMenit1(parseInt(e.target.value))} disabled={scheduleAuto} />
                    </div>
                    <div className={`slot-item ${scheduleFreq >= 2 ? '' : 'disabled'}`}>
                      <span className="font-semibold">Jadwal 2</span>
                      <input className="control-input compact" type="number" min="0" max="23" value={jam2} onChange={(e) => setJam2(parseInt(e.target.value))} disabled={scheduleAuto} />
                      <span className="font-semibold">:</span>
                      <input className="control-input compact" type="number" min="0" max="59" value={menit2} onChange={(e) => setMenit2(parseInt(e.target.value))} disabled={scheduleAuto} />
                    </div>
                    <div className={`slot-item ${scheduleFreq === 3 ? '' : 'disabled'}`}>
                      <span className="font-semibold">Jadwal 3</span>
                      <input className="control-input compact" type="number" min="0" max="23" value={jam3} onChange={(e) => setJam3(parseInt(e.target.value))} disabled={scheduleAuto} />
                      <span className="font-semibold">:</span>
                      <input className="control-input compact" type="number" min="0" max="59" value={menit3} onChange={(e) => setMenit3(parseInt(e.target.value))} disabled={scheduleAuto} />
                    </div>
                  </div>
                  <button className="primary-button outline full-button" onClick={() => handleSaveSchedule('mist')} disabled={scheduleAuto}>Simpan Jadwal Kabut</button>
                </section>

                <section className={`control-card schedule-card ${scheduleAuto ? 'disabled' : ''}`}>
                  <div className="control-card-header">
                    <div>
                      <h3>Pompa Lantai</h3>
                      <p>{scheduleAuto ? 'Jadwal otomatis aktif' : 'Durasi siklus dan jadwal penyiraman lantai.'}</p>
                    </div>
                    <Waves size={20} className="text-sage" />
                  </div>
                  <div className={`control-section ${scheduleAuto ? 'disabled' : ''}`}>
                    <h4>Siklus Timer</h4>
                    <div className="time-inputs">
                      <div className="input-group">
                        <label className="filter-label">Menit</label>
                        <input className="control-input" type="number" min="0" max="59" value={flrMenit} onChange={(e) => setFlrMenit(parseInt(e.target.value))} disabled={scheduleAuto} />
                      </div>
                      <div className="input-group">
                        <label className="filter-label">Detik</label>
                        <input className="control-input" type="number" min="0" max="59" value={flrDetik} onChange={(e) => setFlrDetik(parseInt(e.target.value))} disabled={scheduleAuto} />
                      </div>
                    </div>
                  </div>
                  <button className="primary-button outline full-button" onClick={() => handleSaveTimer('floor')} disabled={scheduleAuto}>Simpan Timer Lantai</button>

                  <div className={`control-section divided ${scheduleAuto ? 'disabled' : ''}`}>
                    <h4>Jadwal Penyiraman Lantai</h4>
                    <p className="text-muted schedule-hint">Maksimal 1 jadwal aktif.</p>
                    <div className="slot-item">
                      <span className="font-semibold">Jadwal 1</span>
                      <input className="control-input compact" type="number" min="0" max="23" value={flrJam1} onChange={(e) => setFlrJam1(parseInt(e.target.value))} disabled={scheduleAuto} />
                      <span className="font-semibold">:</span>
                      <input className="control-input compact" type="number" min="0" max="59" value={flrMenit1} onChange={(e) => setFlrMenit1(parseInt(e.target.value))} disabled={scheduleAuto} />
                    </div>
                  </div>
                  <button className="primary-button outline full-button" onClick={() => handleSaveSchedule('floor')} disabled={scheduleAuto}>Simpan Jadwal Lantai</button>
                </section>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </>
  );
}

// --- Main App Component ---
function App() {
  const [currentUser, setCurrentUser] = useState(() => api.auth.getUser());
  const [activePage, setActivePage] = useState(() => resolveInitialPage());
  const [activeTechTab, setActiveTechTab] = useState('dashboard');
  const [activeAdminTab, setActiveAdminTab] = useState('dashboard');

  // Unified Theme System (Deep Forest Obsidian Dark default, synchronized with Landing Page)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('shroomsync_theme') || localStorage.getItem('shroomsync_lp_theme') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('shroomsync_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleSetActivePage = useCallback((newPage) => {
    const storedUser = api.auth.getUser();
    const role = (storedUser?.role || 'FARMER').toUpperCase();

    let target = newPage;
    if (role === 'ADMIN') {
      if (!ADMIN_PAGES.includes(newPage)) target = 'admin';
    } else if (role === 'TECHNICIAN') {
      if (!TECHNICIAN_PAGES.includes(newPage)) target = 'technician';
    } else {
      if (newPage === 'admin' || newPage === 'technician' || !FARMER_PAGES.includes(newPage)) {
        target = 'dashboard';
      }
    }

    setActivePage(target);
    try {
      localStorage.setItem('shroomsync_active_page', target);
      if (typeof window !== 'undefined') {
        const targetPath = (target === 'dashboard' || (role === 'ADMIN' && target === 'admin') || (role === 'TECHNICIAN' && target === 'technician'))
          ? (target === 'dashboard' ? '/' : `/${target}`)
          : `/${target}`;
        if (window.location.pathname !== targetPath) {
          window.history.replaceState({ page: target }, '', targetPath);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Listen for browser Back/Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const pageFromUrl = resolveInitialPage();
      if (pageFromUrl) {
        setActivePage(pageFromUrl);
        try {
          localStorage.setItem('shroomsync_active_page', pageFromUrl);
        } catch {
          // ignore storage access error
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [connectionNotice, setConnectionNotice] = useState(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [liveSensorEvent, setLiveSensorEvent] = useState(null);
  const [liveHistoryEvent, setLiveHistoryEvent] = useState(null);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(() => api.auth.isAuthenticated());
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    const user = api.auth.getUser();
    const role = (user?.role || '').toUpperCase();
    return role === 'FARMER' && Boolean(user?.mustSetupProfile || user?.nextStep === 'complete_profile' || user?.mustChangePassword || user?.profileCompleted === false);
  });
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    if (isMobileApp()) return api.auth.isAuthenticated() ? 'app' : 'login';
    return api.auth.isAuthenticated() ? 'app' : 'landing';
  });

  const handleSensorTelemetry = useCallback((payload) => {
    const event = createRealtimeEvent(payload);
    if (!event) return;

    setLiveSensorEvent(event);
    if (hasActuatorState(event.record)) {
      setLiveHistoryEvent(event);
    }
  }, []);

  const handleHistoryTelemetry = useCallback((payload) => {
    const event = createRealtimeEvent(payload);
    if (!event) return;

    setLiveHistoryEvent(event);
  }, []);

  // REST polling only for local web/dev testing.
  const { devices, loading: devicesLoading, error: devicesError, refetch, updateDevice, socketConnected } = useDevices({
    enableSocket: false,
    onSensorTelemetry: handleSensorTelemetry,
    onHistoryTelemetry: handleHistoryTelemetry,
  });

  // Verify auth session on boot
  useEffect(() => {
    let cancelled = false;
    const verifyAuth = async () => {
      if (!api.auth.isAuthenticated()) {
        if (!cancelled) {
          setIsAuthenticated(false);
          setIsAuthChecking(false);
          setViewMode(isMobileApp() ? 'login' : 'landing');
        }
        return;
      }

      try {
        const profile = await api.auth.me();
        if (!cancelled) {
          setCurrentUser(profile);
          setIsAuthenticated(true);
          setViewMode('app');
          const currentRole = profile?.role?.toUpperCase();
          if (currentRole === 'FARMER' && (profile.mustSetupProfile || profile.nextStep === 'complete_profile' || profile.mustChangePassword || profile.profileCompleted === false)) {
            setShowOnboarding(true);
          } else {
            setShowOnboarding(false);
          }
          if (isMobileApp() && currentRole !== 'FARMER') {
            console.warn('[App] Non-farmer session blocked on mobile app:', currentRole);
            api.auth.logout();
            if (!cancelled) {
              setIsAuthenticated(false);
              setCurrentUser(null);
              setViewMode('login');
              setConnectionNotice('Aplikasi mobile ShroomSync dikhususkan untuk Petani. Administrator dan Teknisi dapat menggunakan portal web.');
            }
            return;
          }

          const currentTarget = resolveInitialPage();

          if (currentRole === 'ADMIN') {
            if (currentTarget === 'profil') {
              handleSetActivePage('profil');
            } else {
              handleSetActivePage('admin');
            }
          } else if (currentRole === 'TECHNICIAN') {
            if (currentTarget === 'profil') {
              handleSetActivePage('profil');
            } else {
              handleSetActivePage('technician');
            }
          } else {
            if (currentTarget && currentTarget !== 'admin' && currentTarget !== 'technician') {
              handleSetActivePage(currentTarget);
            } else {
              handleSetActivePage('dashboard');
            }
          }
        }
      } catch (err) {
        console.warn('[App] Verify auth warning:', err.message);
        if (err.statusCode === 401) {
          api.auth.logout();
          if (!cancelled) {
            setIsAuthenticated(false);
            setCurrentUser(null);
            setViewMode(isMobileApp() ? 'login' : 'landing');
          }
        }
      } finally {
        if (!cancelled) setIsAuthChecking(false);
      }
    };

    verifyAuth();

    const handleUnauthorized = () => {
      api.auth.logout();
      setIsAuthenticated(false);
      setCurrentUser(null);
      setViewMode(isMobileApp() ? 'login' : 'landing');
    };

    window.addEventListener('shroomsync:unauthorized', handleUnauthorized);
    return () => {
      cancelled = true;
      window.removeEventListener('shroomsync:unauthorized', handleUnauthorized);
    };
  }, [handleSetActivePage]);

  // Inisialisasi Firebase Push Notification di perangkat Mobile
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      pushNotificationService.init((notification) => {
        setConnectionNotice(`🔔 ${notification.title}: ${notification.body}`);
        window.setTimeout(() => setConnectionNotice(null), 6000);
      });
    }
  }, [isAuthenticated, currentUser]);

  const handleLoginSuccess = (loginResponse) => {
    const loginRole = loginResponse?.user?.role?.toUpperCase();
    if (isMobileApp() && loginRole !== 'FARMER') {
      api.auth.logout();
      setIsAuthenticated(false);
      setCurrentUser(null);
      setViewMode('login');
      return;
    }

    setCurrentUser(loginResponse.user);
    setIsAuthenticated(true);
    setViewMode('app');
    const isNewFarmer = loginRole === 'FARMER' && Boolean(
      loginResponse?.mustSetupProfile ||
      loginResponse?.nextStep === 'complete_profile' ||
      loginResponse?.user?.mustChangePassword ||
      loginResponse?.user?.profileCompleted === false
    );
    if (isNewFarmer) {
      setShowOnboarding(true);
    } else {
      setShowOnboarding(false);
    }
    if (loginRole === 'TECHNICIAN') {
      handleSetActivePage('technician');
    } else if (loginRole === 'ADMIN') {
      handleSetActivePage('admin');
    } else {
      handleSetActivePage('dashboard');
    }
    refetch();
  };

  const handleOnboardingComplete = (onboardingResponse) => {
    const updatedUser = onboardingResponse?.user 
      ? { ...onboardingResponse.user, mustSetupProfile: false, profileCompleted: true, mustChangePassword: false } 
      : { ...currentUser, mustSetupProfile: false, profileCompleted: true, mustChangePassword: false };
    setCurrentUser(updatedUser);
    setShowOnboarding(false);
    handleSetActivePage('dashboard');
    refetch();
  };

  const handleRequestLogout = () => {
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    handleLogout();
  };

  const handleLogout = () => {
    api.auth.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setShowOnboarding(false);
    handleSetActivePage('dashboard');
    setViewMode(isMobileApp() ? 'login' : 'landing');
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/');
    }
  };

  // Auto-select first device
  useEffect(() => {
    const updateId = window.setTimeout(() => {
      setSelectedDeviceId((currentId) => {
        if (devices.length === 0) return null;
        if (currentId) {
          const currentStillExists = devices.some((device) => (device.deviceId || device.id) === currentId);
          return currentStillExists ? currentId : (devices[0].deviceId || devices[0].id);
        }
        return devices[0].deviceId || devices[0].id;
      });
    }, 0);

    return () => window.clearTimeout(updateId);
  }, [devices]);

  const connectionError = connectionNotice || (!devicesLoading && devicesError && !socketConnected
    ? 'Koneksi API bermasalah. Menampilkan data terakhir yang berhasil dibaca.'
    : null);

  const selectedDevice = devices.find(d => (d.deviceId || d.id) === selectedDeviceId);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  // If auth is still checking on initial load, show a smooth loader
  if (isAuthChecking) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f1712',
        color: '#86efac',
        fontFamily: "'Plus Jakarta Sans', sans-serif"
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#9cb1a2' }}>Memuat ShroomSync...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated
  if (!isAuthenticated) {
    if (!isMobileApp() && viewMode === 'landing') {
      return (
        <LandingPage 
          onGoToLogin={() => setViewMode('login')}
          onGoToDashboard={() => setViewMode('login')}
          isAuthenticated={false}
        />
      );
    }

    return (
      <LoginScreen 
        onLoginSuccess={handleLoginSuccess}
        onBackToLanding={!isMobileApp() ? () => setViewMode('landing') : undefined}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    );
  }

  // If authenticated user specifically views Landing Page / Company Profile
  if (viewMode === 'landing') {
    return (
      <LandingPage 
        onGoToLogin={() => setViewMode('app')}
        onGoToDashboard={() => {
          setViewMode('app');
          handleSetActivePage('dashboard');
        }}
        isAuthenticated={true}
      />
    );
  }

  const userRole = (currentUser?.role || api.auth.getUser()?.role || 'FARMER').toUpperCase();

  // If user must setup profile (new farmer onboarding only), show dedicated full-page OnboardingScreen
  if (userRole === 'FARMER' && (showOnboarding || currentUser?.mustSetupProfile || currentUser?.nextStep === 'complete_profile' || currentUser?.mustChangePassword || currentUser?.profileCompleted === false)) {
    return (
      <OnboardingScreen 
        user={currentUser} 
        onComplete={handleOnboardingComplete} 
        onLogout={handleLogout}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    );
  }

  return (
    <div className="app-container">
      <Sidebar 
        activePage={activePage} 
        setActivePage={handleSetActivePage} 
        activeTechTab={activeTechTab}
        setActiveTechTab={setActiveTechTab}
        activeAdminTab={activeAdminTab}
        setActiveAdminTab={setActiveAdminTab}
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        currentUser={currentUser}
        onLogout={handleRequestLogout}
        theme={theme}
        toggleTheme={toggleTheme}
      />
      <main className="main-content">
        {connectionError && (
          <div className="connection-warning" role="status">
            {connectionError}
          </div>
        )}

        {/* 1. Portal Khusus Admin: Mandiri & Tidak bisa mengakses dashboard farmer */}
        {userRole === 'ADMIN' && (
          activePage === 'profil' ? (
            <ProfilContent onMenuToggle={toggleSidebar} currentUser={currentUser} setCurrentUser={setCurrentUser} devices={devices} onLogout={handleRequestLogout} />
          ) : (
            <AdminDashboard 
              onMenuToggle={toggleSidebar} 
              currentUser={currentUser}
              activeTab={activeAdminTab}
              onTabChange={setActiveAdminTab}
              theme={theme}
              toggleTheme={toggleTheme}
            />
          )
        )}

        {/* 2. Portal Khusus Teknisi: Mandiri & Tidak bisa mengakses dashboard farmer */}
        {userRole === 'TECHNICIAN' && (
          activePage === 'profil' ? (
            <ProfilContent onMenuToggle={toggleSidebar} currentUser={currentUser} setCurrentUser={setCurrentUser} devices={devices} onLogout={handleRequestLogout} />
          ) : (
            <TechnicianDashboard 
              onMenuToggle={toggleSidebar} 
              currentUser={currentUser} 
              activeTab={activeTechTab}
              onTabChange={setActiveTechTab}
              theme={theme}
              toggleTheme={toggleTheme}
            />
          )
        )}

        {/* 3. Portal Khusus Petani: Dashboard Farmer */}
        {userRole !== 'ADMIN' && userRole !== 'TECHNICIAN' && (
          <div className="farmer-portal-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', flex: 1 }}>
            {activePage === 'dashboard' && (
              <DashboardContent 
                devices={devices} 
                setSelectedDeviceId={setSelectedDeviceId} 
                setActivePage={handleSetActivePage} 
                onMenuToggle={toggleSidebar} 
                liveSensorEvent={liveSensorEvent} 
                liveHistoryEvent={liveHistoryEvent} 
                theme={theme}
                toggleTheme={toggleTheme}
              />
            )}
            {activePage === 'kumbung' && <KumbungContent setActivePage={handleSetActivePage} devices={devices} refetchDevices={refetch} selectedDeviceId={selectedDeviceId} setSelectedDeviceId={setSelectedDeviceId} onMenuToggle={toggleSidebar} />}
            {activePage === 'monitoring' && <MonitoringContent setActivePage={handleSetActivePage} selectedDeviceId={selectedDeviceId} setSelectedDeviceId={setSelectedDeviceId} devices={devices} selectedDevice={selectedDevice} onMenuToggle={toggleSidebar} liveSensorEvent={liveSensorEvent} liveHistoryEvent={liveHistoryEvent} />}
            {activePage === 'siklus' && <SiklusPanenContent selectedDeviceId={selectedDeviceId} setSelectedDeviceId={setSelectedDeviceId} devices={devices} selectedDevice={selectedDevice} onMenuToggle={toggleSidebar} />}
            {activePage === 'kontrol' && <KontrolContent selectedDeviceId={selectedDeviceId} setSelectedDeviceId={setSelectedDeviceId} devices={devices} updateDevice={updateDevice} onMenuToggle={toggleSidebar} />}
            {activePage === 'notifikasi' && <NotifikasiContent onMenuToggle={toggleSidebar} />}
            {activePage === 'profil' && <ProfilContent onMenuToggle={toggleSidebar} currentUser={currentUser} setCurrentUser={setCurrentUser} devices={devices} onLogout={handleRequestLogout} />}
          </div>
        )}
      </main>

      {/* Modal Konfirmasi Logout Petani */}
      <ConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
        title="Keluar dari Akun"
        message="Apakah Anda yakin ingin keluar dari akun ShroomSync? Anda akan diminta memasukkan kata sandi saat masuk kembali."
        itemDetails={
          currentUser
            ? {
                label: 'Akun Petani Aktif',
                value: currentUser.farmName || currentUser.fullName || currentUser.username || 'Petani Kumbung',
                subValue: currentUser.phoneNumber || currentUser.email || 'Terdaftar',
              }
            : null
        }
        type="warning"
        confirmText="Ya, Keluar"
        cancelText="Tetap Masuk"
        dangerNote=""
      />
    </div>
  );
}
export default App;
