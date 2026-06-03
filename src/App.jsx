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
  Download,
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
  RadioTower,
  Router,
  Microchip,
  Sprout,
  CalendarDays,
  Pencil,
  Trash2
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './App.css';
import api from './services/api';
import config from './config';

const MONITORING_RANGES = [
  { label: '10 Menit', minutes: 10 },
  { label: '20 Menit', minutes: 20 },
  { label: '30 Menit', minutes: 30 },
];

const ANALYTICS_RANGES = ['24 Jam', '7 Hari', '30 Hari'];
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
  const rawDate = record?.createdAt || record?.recordedAt || record?.time || record?.waktu;
  return parseReadingDate(rawDate);
};

const readTemperature = (record) => record?.temperature ?? record?.suhu;
const readHumidity = (record) => record?.humidity ?? record?.kelembaban;

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
  return date ? date.toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--';
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

const chartTooltipFormatter = (value, name) => {
  const formattedValue = Number(value).toFixed(2);
  return [formattedValue, name];
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
const analyticsData = [
  { name: 'Kumbung Utama', temp: 28.6, hum: 76 },
  { name: 'Kumbung B', temp: 27.1, hum: 78 },
  { name: 'Kumbung C', temp: 29.3, hum: 72 },
  { name: 'Kumbung D', temp: 26.5, hum: 80 },
];

const notifications = [
  { id: 1, text: 'Suhu tinggi terdeteksi di Kumbung Utama', time: '10 menit yang lalu', type: 'error' },
  { id: 2, text: 'Kelembaban rendah di Kumbung B', time: '1 jam yang lalu', type: 'warning' },
  { id: 3, text: 'Kumbung C offline', time: '2 jam yang lalu', type: 'error' },
  { id: 4, text: 'Laporan mingguan telah siap', time: '1 hari yang lalu', type: 'info' },
  { id: 5, text: 'Suhu kembali normal di Kumbung Utama', time: '1 hari yang lalu', type: 'success' },
];

const MushroomGlyph = ({ className = '' }) => (
  <div className={`mushroom-glyph ${className}`} aria-hidden="true">
    <span className="mushroom-glyph__cap mushroom-glyph__cap--left" />
    <span className="mushroom-glyph__cap mushroom-glyph__cap--main" />
    <span className="mushroom-glyph__stem" />
    <span className="mushroom-glyph__cap mushroom-glyph__cap--right" />
  </div>
);

const SidebarTechAccent = () => (
  <div className="sidebar-tech-accent" aria-hidden="true">
    <div className="sidebar-tech-accent__visual">
      <MushroomGlyph />
      <div className="sidebar-tech-accent__tower">
        <RadioTower size={16} />
      </div>
    </div>
    <div className="sidebar-tech-accent__copy">
      <span>IoT Mesh</span>
      <strong>Shroom Habitat</strong>
    </div>
    <div className="sidebar-tech-accent__nodes">
      <span />
      <span />
      <span />
    </div>
  </div>
);

const OrganicTechBand = ({ onlineCount, totalDevices }) => (
  <motion.div
    className="organic-tech-band"
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, delay: 0.08 }}
  >
    <div className="organic-tech-band__growth" aria-hidden="true">
      <MushroomGlyph className="mushroom-glyph--large" />
      <Sprout size={18} />
    </div>
    <div className="organic-tech-band__circuit" aria-hidden="true">
      <span className="circuit-dot is-active" />
      <span className="circuit-line" />
      <span className="circuit-dot" />
      <span className="circuit-line" />
      <span className="circuit-dot is-pulse" />
    </div>
    <div className="organic-tech-band__chips" aria-label="Ringkasan jaringan IoT">
      <span><CircuitBoard size={16} /> Sensor loop</span>
      <span><RadioTower size={16} /> {onlineCount}/{totalDevices || 0} online</span>
      <span><Router size={16} /> MQTT ready</span>
    </div>
  </motion.div>
);

const HeaderTechAccent = () => (
  <div className="header-tech-accent" aria-hidden="true">
    <MushroomGlyph className="mushroom-glyph--mini" />
    <div className="header-tech-accent__rail">
      <span><Microchip size={14} /></span>
      <span><RadioTower size={14} /></span>
      <span><CircuitBoard size={14} /></span>
    </div>
  </div>
);

const getHeaderContext = (title = '') => {
  const loweredTitle = title.toLowerCase();
  if (loweredTitle.includes('dashboard')) return { Icon: LayoutDashboard, tone: 'dashboard' };
  if (loweredTitle.includes('kumbung')) return { Icon: Home, tone: 'farm' };
  if (loweredTitle.includes('siklus') || loweredTitle.includes('panen')) return { Icon: Sprout, tone: 'farm' };
  if (loweredTitle.includes('monitoring')) return { Icon: Activity, tone: 'sensor' };
  if (loweredTitle.includes('kontrol')) return { Icon: Sliders, tone: 'control' };
  if (loweredTitle.includes('analitik')) return { Icon: BarChart2, tone: 'analytics' };
  if (loweredTitle.includes('notifikasi')) return { Icon: Bell, tone: 'notify' };
  if (loweredTitle.includes('profil')) return { Icon: User, tone: 'profile' };
  return { Icon: CircuitBoard, tone: 'system' };
};

// --- Sidebar Component ---
const Sidebar = ({ activePage, setActivePage, isOpen, onClose }) => (
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

      <div className="sidebar-profile">
        <div className="profile-avatar">
          <User size={24} />
        </div>
        <div className="profile-info">
          <h4>Raihan Muhammad</h4>
          <p>Petani</p>
        </div>
      </div>
      <SidebarTechAccent />
      
      <nav className="nav-menu">
        <a href="#" className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('dashboard'); onClose?.(); }}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </a>
        <a href="#" className={`nav-item ${activePage === 'kumbung' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('kumbung'); onClose?.(); }}>
          <Home size={20} />
          <span>Kumbung Saya</span>
        </a>
        <a href="#" className={`nav-item ${activePage === 'monitoring' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('monitoring'); onClose?.(); }}>
          <Activity size={20} />
          <span>Monitoring</span>
        </a>
        <a href="#" className={`nav-item ${activePage === 'siklus' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('siklus'); onClose?.(); }}>
          <Sprout size={20} />
          <span>Siklus & Panen</span>
        </a>
        <a href="#" className={`nav-item ${activePage === 'kontrol' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('kontrol'); onClose?.(); }}>
          <Sliders size={20} />
          <span>Kontrol</span>
        </a>
        <a href="#" className={`nav-item ${activePage === 'analitik' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('analitik'); onClose?.(); }}>
          <BarChart2 size={20} />
          <span>Analitik</span>
        </a>
        <a href="#" className={`nav-item ${activePage === 'notifikasi' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('notifikasi'); onClose?.(); }}>
          <Bell size={20} />
          <span>Notifikasi</span>
        </a>
        <a href="#" className={`nav-item ${activePage === 'profil' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('profil'); onClose?.(); }}>
          <User size={20} />
          <span>Profil</span>
        </a>
      </nav>

      <div className="sidebar-footer">
        <a href="#" className="nav-item">
          <LogOut size={20} />
          <span>Keluar</span>
        </a>
      </div>
    </aside>
    <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
  </>
);

// --- Header Component ---
const Header = ({ title, subtitle, actions, onBack, onMenuToggle }) => {
  const { Icon: HeaderIcon, tone } = getHeaderContext(title);

  return (
    <header className="header" data-page-tone={tone}>
      <HeaderTechAccent />
      <div className="header-title">
        {onMenuToggle && (
          <button className="mobile-menu-toggle" onClick={onMenuToggle}>
            <Menu size={24} />
          </button>
        )}
        {onBack && (
          <button className="icon-button back-btn" onClick={onBack}>
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="header-title-badge" aria-hidden="true">
          <HeaderIcon size={20} />
        </div>
        <div className="header-copy">
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      <div className="header-actions">
        {actions}
      </div>
    </header>
  );
};

// --- 1. Dashboard Content ---
const DashboardContent = ({ devices, setSelectedDeviceId, setActivePage, onMenuToggle, liveSensorEvent, liveHistoryEvent }) => {
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
    dashboardHistory
      .map((record) => {
        const date = getReadingDate(record);
        return {
          ...record,
          temp: readTemperature(record),
          hum: readHumidity(record),
          readingDate: date,
          time: date ? date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--',
        };
      })
      .filter((record) => record.readingDate && record.temp != null && record.hum != null)
      .sort((a, b) => a.readingDate - b.readingDate),
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
        setLatestReadings(
          readingResults
            .map((result, index) => ({
              deviceId: currentDeviceIds[index],
              sensor: result.status === 'fulfilled' ? result.value : null,
            }))
            .filter((reading) => reading.sensor)
        );
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
  }, [deviceIdKey]);

  useEffect(() => {
    if (!activeDashboardDeviceId) return undefined;

    let cancelled = false;
    const fetchDashboardHistory = async () => {
      const from = new Date(new Date().getTime() - 10 * 60 * 1000).toISOString();

      try {
        const [historyResult, logsResult] = await Promise.all([
          api.telemetry.getSensorHistory(activeDashboardDeviceId, { from, limit: 180 }).catch(() => []),
          api.telemetry.getHistory(activeDashboardDeviceId, { limit: 6 }).catch(() => []),
        ]);

        if (cancelled) return;

        setDashboardHistory(Array.isArray(historyResult) ? historyResult : []);
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
        onMenuToggle={onMenuToggle}
        actions={
          <>
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
            <button className="icon-button notification-btn" onClick={() => setActivePage('notifikasi')}>
              <Bell size={20} />
            </button>
          </>
        }
      />
      
      <div className="dashboard-content">
        <OrganicTechBand onlineCount={onlineCount} totalDevices={devices.length} />

        <motion.div 
          className="stats-row"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="stat-card minimal">
            <span className="stat-title">Kumbung Aktif <Microchip size={14} className="text-earth" /></span>
            <div className="stat-value">{devices.length}</div>
            <div className="stat-status text-earth">Total</div>
          </div>
          <div className="stat-card minimal">
            <span className="stat-title">Kumbung Online <Wifi size={14} className="text-sage" style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'middle' }} /></span>
            <div className="stat-value">{onlineCount}</div>
            <div className="stat-status text-sage">{devices.length > 0 ? Math.round((onlineCount / devices.length) * 100) : 0}%</div>
          </div>
          <div className="stat-card minimal">
            <span className="stat-title">Suhu Rata-rata</span>
            <div className="stat-value">
              {averageTemperature.length > 0
                ? formatMetric(averageTemperature.reduce((sum, value) => sum + value, 0) / averageTemperature.length, '°C')
                : '--'}
            </div>
            <div className="stat-status text-sage">{averageTemperature.length} sensor terbaca</div>
          </div>
          <div className="stat-card minimal">
            <span className="stat-title">Kelembaban Rata-rata</span>
            <div className="stat-value">
              {averageHumidity.length > 0
                ? formatMetric(averageHumidity.reduce((sum, value) => sum + value, 0) / averageHumidity.length, '%')
                : '--'}
            </div>
            <div className="stat-status text-sage">{averageHumidity.length} sensor terbaca</div>
          </div>
          <div className="stat-card minimal">
            <span className="stat-title">Alert Aktif</span>
            <div className="stat-value">{dashboardAlerts.length}</div>
            <div className="stat-status text-earth">Peringatan</div>
          </div>
          <div className="stat-card minimal" style={{ cursor: 'pointer' }} onClick={() => setActivePage('kontrol')}>
            <span className="stat-title">
              <Clock size={14} style={{ display: 'inline', marginRight: '4px' }} />
              Status Jadwal
            </span>
            <div className="stat-value" style={{ fontSize: '1.5rem' }}>
              {activeDashboardDevice?.config?.scheduleMode === 1 ? '1x' : 
               activeDashboardDevice?.config?.scheduleMode === 2 ? '2x' : 
               activeDashboardDevice?.config?.scheduleMode === 3 ? '3x' : '-'}
            </div>
            <div className="stat-status text-sage">
              {activeDashboardDevice?.config?.controlMode === 2 ? 'Auto' : 'Manual'}
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
              <h3>Kondisi Real-time</h3>
              <div className="dropdown-small">{activeDashboardDevice?.name || 'Pilih Kumbung'} <ChevronDown size={14}/></div>
            </div>
            
            <div className="stacked-charts">
              <div className="chart-row metric-temp">
                <div className="chart-info">
                  <span className="chart-label">Suhu</span>
                  <div className="chart-current-value">{formatMetric(activeTemperature, '°C')}</div>
                  <span className={`chart-status ${temperatureStatus.className}`}>{temperatureStatus.label}</span>
                  <span className="chart-unit">°C</span>
                </div>
                <div className="chart-graph">
                  {formattedDashboardHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={formattedDashboardHistory} margin={{ top: 8, right: 12, left: -10, bottom: 8 }}>
                        <defs>
                          <linearGradient id="dashboardTempGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--chart-temp-line)" stopOpacity={0.32}/>
                            <stop offset="95%" stopColor="var(--chart-temp-line)" stopOpacity={0.02}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 6" vertical={false} stroke={chartGridStroke} />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={chartAxisTick} dy={15} minTickGap={24} />
                        <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} tickFormatter={chartAxisFormatter} domain={['dataMin - 2', 'dataMax + 2']} />
                        <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} formatter={(value) => [`${Number(value).toFixed(2)}°C`, 'Suhu']} />
                        <Area type="monotone" dataKey="temp" stroke="var(--chart-temp-line)" strokeWidth={2.5} fillOpacity={1} fill="url(#dashboardTempGradient)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--chart-temp-line)' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-chart-state">Belum ada data suhu 10 menit terakhir.</div>
                  )}
                </div>
              </div>

              <div className="chart-divider"></div>

              <div className="chart-row metric-hum">
                <div className="chart-info">
                  <span className="chart-label">Kelembaban</span>
                  <div className="chart-current-value">{formatMetric(activeHumidity, '%')}</div>
                  <span className={`chart-status ${humidityStatus.className}`}>{humidityStatus.label}</span>
                  <span className="chart-unit">%</span>
                </div>
                <div className="chart-graph">
                  {formattedDashboardHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={formattedDashboardHistory} margin={{ top: 8, right: 12, left: -10, bottom: 8 }}>
                        <defs>
                          <linearGradient id="dashboardHumGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--chart-hum-line)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--chart-hum-line)" stopOpacity={0.02}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 6" vertical={false} stroke={chartGridStroke} />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={chartAxisTick} dy={15} minTickGap={24} />
                        <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} tickFormatter={chartAxisFormatter} domain={['dataMin - 5', 'dataMax + 5']} />
                        <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Kelembaban']} />
                        <Area type="monotone" dataKey="hum" stroke="var(--chart-hum-line)" strokeWidth={2.5} fillOpacity={1} fill="url(#dashboardHumGradient)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--chart-hum-line)' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-chart-state">Belum ada data kelembaban 10 menit terakhir.</div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          <div className="lists-section">
            <motion.div 
              className="list-panel panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="panel-header">
                <h3>Status Kumbung</h3>
              </div>
              <div className="device-list">
                {devices.map((dev) => {
                  const deviceId = dev.deviceId || dev.id;
                  const reading = latestReadings.find((item) => item.deviceId === deviceId)?.sensor;
                  return (
                  <div className="device-item" key={deviceId} onClick={() => handleDeviceClick(deviceId)} style={{ cursor: 'pointer' }}>
                    <div className="device-icon">
                      <Home size={16} />
                    </div>
                    <div className="device-info">
                      <h4>{dev.name || deviceId}</h4>
                      <p>
                        {formatMetric(readTemperature(reading), '°C')} | {formatMetric(readHumidity(reading), '%')} |{' '}
                        <span className={dev.isOnline ? 'text-sage' : 'text-error'} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {dev.isOnline ? <Wifi size={14} /> : <Wifi size={14} style={{ opacity: 0.5 }} />}
                          {dev.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </p>
                    </div>
                  </div>
                )})}
                {devices.length === 0 && <p className="text-muted" style={{ padding: '12px' }}>Belum ada perangkat.</p>}
              </div>
              <a href="#" className="view-all" onClick={(e) => { e.preventDefault(); setActivePage('kumbung'); }}>Lihat Semua Kumbung</a>
            </motion.div>

            <motion.div 
              className="list-panel panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <div className="panel-header">
                <h3>Notifikasi Terbaru</h3>
              </div>
              <div className="notif-list">
                {(dashboardAlerts.length > 0 ? dashboardAlerts : dashboardLogs.slice(0, 3).map((log, index) => ({
                  id: log.id || `log-${index}`,
                  text: formatHistoryActivity(log),
                  time: formatRelativeTime(log.createdAt || log.recordedAt || log.time, dashboardNow),
                  type: 'info',
                }))).slice(0,3).map((notif) => (
                  <div className="notif-item" key={notif.id}>
                    <div className={`notif-icon ${notif.type}`}>
                      <AlertCircle size={16} />
                    </div>
                    <div className="notif-info">
                      <p>{notif.text}</p>
                      <span className="time">{notif.time}</span>
                    </div>
                  </div>
                ))}
                {dashboardAlerts.length === 0 && dashboardLogs.length === 0 && (
                  <p className="text-muted" style={{ padding: '12px' }}>Belum ada peringatan terbaru.</p>
                )}
              </div>
              <a href="#" className="view-all" onClick={(e) => { e.preventDefault(); setActivePage('notifikasi'); }}>Lihat Semua Notifikasi</a>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
};

// --- 2. Kumbung Page Content ---
const KumbungContent = ({ setActivePage, devices, refetchDevices, selectedDeviceId, setSelectedDeviceId, onMenuToggle }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [newDevice, setNewDevice] = useState({ name: '', deviceId: '' });
  const [showFirmwareModal, setShowFirmwareModal] = useState(false);
  const [firmwareTarget, setFirmwareTarget] = useState(null);
  const [firmwareForm, setFirmwareForm] = useState({
    firmwareUrl: '',
    firmwareVersion: '',
    checksumSha256: '',
    force: false,
  });
  const [toast, setToast] = useState(null);

  const handleAddDevice = async () => {
    if (!newDevice.name || !newDevice.deviceId) {
      setToast({ message: 'Nama dan ID Perangkat harus diisi', type: 'warning' });
      return;
    }
    try {
      await api.devices.create({
        deviceId: newDevice.deviceId.trim(),
        name: newDevice.name.trim(),
        hardwareVersion: '1.0',
      });
      // Refetch devices from server
      await refetchDevices();
      setToast({ message: '✓ Kumbung berhasil ditambahkan', type: 'success' });
      setShowAddModal(false);
      setNewDevice({ name: '', deviceId: '' });
    } catch (error) {
      console.error('Add failed:', error);
      setToast({ message: 'Gagal menambahkan kumbung', type: 'error' });
    }
  };

  const handleDeleteDevice = async () => {
    try {
      const id = selectedDevice.deviceId || selectedDevice.id;
      const nextDevice = devices.find((device) => (device.deviceId || device.id) !== id);
      const nextDeviceId = nextDevice ? (nextDevice.deviceId || nextDevice.id) : null;
      await api.devices.delete(id);
      // Refetch devices from server
      await refetchDevices();
      if (selectedDeviceId === id) {
        setSelectedDeviceId(nextDeviceId);
      }
      setToast({ message: '✓ Kumbung berhasil dihapus', type: 'success' });
      setShowDeleteModal(false);
      setSelectedDevice(null);
    } catch (error) {
      console.error('Delete failed:', error);
      setToast({ message: 'Gagal menghapus kumbung', type: 'error' });
    }
  };

  const handleDeleteClick = (kumbung) => {
    setSelectedDevice(kumbung);
    setShowDeleteModal(true);
    setOpenMenu(null);
  };

  const handleDetailClick = (kumbung) => {
    setSelectedDeviceId(kumbung.deviceId || kumbung.id);
    setActivePage('monitoring');
    setOpenMenu(null);
  };

  const handleUpdateFirmware = (kumbung) => {
    setFirmwareTarget(kumbung);
    setFirmwareForm({
      firmwareUrl: '',
      firmwareVersion: kumbung.firmwareVersion || '',
      checksumSha256: '',
      force: false,
    });
    setShowFirmwareModal(true);
    setOpenMenu(null);
  };

  const handleCyclesClick = (kumbung) => {
    setSelectedDeviceId(kumbung.deviceId || kumbung.id);
    setActivePage('siklus');
    setOpenMenu(null);
  };

  const handleSubmitFirmwareUpdate = async () => {
    if (!firmwareTarget) return;

    const firmwareUrl = firmwareForm.firmwareUrl.trim();
    const firmwareVersion = firmwareForm.firmwareVersion.trim();
    if (!firmwareUrl || !firmwareVersion) {
      setToast({ message: 'URL firmware dan versi wajib diisi', type: 'warning' });
      return;
    }

    try {
      const id = firmwareTarget.deviceId || firmwareTarget.id;
      setToast({ message: 'Mengirim perintah update firmware...', type: 'info' });
      await api.ota.trigger(id, {
        firmwareUrl,
        firmwareVersion,
        hardwareVersion: firmwareTarget.hardwareVersion || '1.0',
        checksumSha256: firmwareForm.checksumSha256.trim(),
        force: firmwareForm.force,
      });
      setToast({ message: '✓ Perintah update berhasil dikirim', type: 'success' });
      setShowFirmwareModal(false);
      setFirmwareTarget(null);
    } catch (error) {
      console.error('OTA trigger failed:', error);
      setToast({ message: error.getUserMessage?.() || error.message || 'Gagal mengirim perintah update', type: 'error' });
    }
  };

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <Header 
        title="Kumbung Saya" 
        subtitle="Kelola semua kumbung yang Anda miliki."
        onMenuToggle={onMenuToggle}
        actions={
          <button className="primary-button" onClick={() => setShowAddModal(true)}>
            <Plus size={18} />
            <span>Tambah Kumbung</span>
          </button>
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
                  <tr key={idx}>
                    <td data-label="Nama" className="font-semibold">{k.name}</td>
                    <td data-label="Terakhir" className="text-muted">{formatDateTime(k.lastSeenAt)}</td>
                    <td data-label="ID" className="text-muted">{k.deviceId || k.id}</td>
                    <td data-label="Jaringan" className="text-muted" style={{ fontSize: '0.9rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span title="WiFi Signal"><Wifi size={12} style={{ display: 'inline', marginRight: '4px' }}/> {formatWifi(k.rssiDbm)}</span>
                        <span title="Uptime"><Clock size={12} style={{ display: 'inline', marginRight: '4px' }}/> {formatUptime(k.uptimeMs)}</span>
                      </div>
                    </td>
                    <td data-label="Status">
                      <div className="status-badge">
                        <span className={`status-dot ${k.isOnline ? 'bg-sage' : 'bg-error'}`}></span>
                        <span className={k.isOnline ? 'text-sage' : 'text-error'}>{k.isOnline ? 'Online' : 'Offline'}</span>
                      </div>
                    </td>
                    <td data-label="Aksi" style={{ position: 'relative' }}>
                      <button className="action-button" onClick={() => setOpenMenu(openMenu === idx ? null : idx)}>
                        <MoreVertical size={18} />
                      </button>
                      {openMenu === idx && (
                        <div className="dropdown-menu" style={{ position: 'absolute', right: '40px', top: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: 'var(--shadow-md)', zIndex: 10, width: '150px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                          <button className="dropdown-item" style={{ padding: '12px 16px', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-primary)' }} onClick={() => handleDetailClick(k)}>
                            Detail Perangkat
                          </button>
                          <button className="dropdown-item" style={{ padding: '12px 16px', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-primary)' }} onClick={() => handleCyclesClick(k)}>
                            Siklus & Panen
                          </button>
                          <button className="dropdown-item" style={{ padding: '12px 16px', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-primary)' }} onClick={() => handleUpdateFirmware(k)}>
                            Update Firmware
                          </button>
                          <button className="dropdown-item text-error" style={{ padding: '12px 16px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--error)' }} onClick={() => handleDeleteClick(k)}>
                            Hapus Perangkat
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* Modal Tambah Kumbung */}
      {showAddModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <motion.div className="modal-content panel" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '400px', padding: '24px' }}>
            <h3 style={{ marginBottom: '8px' }}>Tambah Kumbung Baru</h3>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '24px' }}>Tambahkan perangkat IoT baru ke dalam sistem.</p>
            
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Nama Kumbung</label>
              <input type="text" placeholder="Masukkan nama kumbung..." value={newDevice.name} onChange={(e) => setNewDevice({...newDevice, name: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }} />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>ID Perangkat (Device ID)</label>
              <input type="text" placeholder="Misal: SS-005" value={newDevice.deviceId} onChange={(e) => setNewDevice({...newDevice, deviceId: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }} />
            </div>

            <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="secondary-button" onClick={() => setShowAddModal(false)}>Batal</button>
              <button className="primary-button" onClick={handleAddDevice}>Simpan Kumbung</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Update Firmware */}
      {showFirmwareModal && firmwareTarget && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <motion.div className="modal-content panel" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '440px', padding: '24px' }}>
            <h3 style={{ marginBottom: '8px' }}>Update Firmware</h3>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '24px' }}>{firmwareTarget.name} ({firmwareTarget.deviceId || firmwareTarget.id})</p>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>URL Firmware</label>
              <input
                type="url"
                placeholder="https://example.com/firmware.bin"
                value={firmwareForm.firmwareUrl}
                onChange={(e) => setFirmwareForm({ ...firmwareForm, firmwareUrl: e.target.value })}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Versi Firmware</label>
              <input
                type="text"
                placeholder="1.1.0"
                value={firmwareForm.firmwareVersion}
                onChange={(e) => setFirmwareForm({ ...firmwareForm, firmwareVersion: e.target.value })}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Checksum SHA-256</label>
              <input
                type="text"
                placeholder="Opsional"
                value={firmwareForm.checksumSha256}
                onChange={(e) => setFirmwareForm({ ...firmwareForm, checksumSha256: e.target.value })}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
              />
            </div>

            <label className="form-group" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={firmwareForm.force}
                onChange={(e) => setFirmwareForm({ ...firmwareForm, force: e.target.checked })}
              />
              Paksa update walau versi sama
            </label>

            <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="secondary-button" onClick={() => setShowFirmwareModal(false)}>Batal</button>
              <button className="primary-button" onClick={handleSubmitFirmwareUpdate}>Kirim Update</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Hapus Kumbung */}
      {showDeleteModal && selectedDevice && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <motion.div className="modal-content panel" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '400px', padding: '24px' }}>
            <h3 style={{ marginBottom: '8px', color: 'var(--error)' }}>Hapus Kumbung</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '24px' }}>
              Apakah Anda yakin ingin menghapus <strong>{selectedDevice.name}</strong> ({selectedDevice.deviceId || selectedDevice.id})? Semua pengaturan dan riwayat telemetri perangkat ini akan dihapus permanen.
            </p>
            
            <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="secondary-button" onClick={() => setShowDeleteModal(false)}>Batal</button>
              <button className="primary-button" style={{ backgroundColor: 'var(--error)', borderColor: 'var(--error)', color: '#fff' }} onClick={handleDeleteDevice}>Ya, Hapus</button>
            </div>
          </motion.div>
        </div>
      )}
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

  const selectedCycle = useMemo(
    () => cycles.find((cycle) => readEntityId(cycle) === selectedCycleId) || null,
    [cycles, selectedCycleId]
  );
  const dailyBreakdown = Array.isArray(summary?.dailyBreakdown) ? summary.dailyBreakdown : [];
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
    if (!selectedDeviceId) {
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
      const data = sortCycles(await api.cycles.list(selectedDeviceId, params));
      setCycles(data);
      setSelectedCycleId((currentId) => (
        data.some((cycle) => readEntityId(cycle) === currentId)
          ? currentId
          : readEntityId(data[0])
      ));
      return data;
    } catch (error) {
      console.error('Cycles fetch failed:', error);
      setCyclesError(error.getUserMessage?.() || error.message || 'Gagal memuat daftar siklus.');
      return [];
    } finally {
      setCyclesLoading(false);
    }
  }, [cycleStatusFilter, selectedDeviceId, sortCycles]);

  const loadCycleDetail = useCallback(async () => {
    if (!selectedDeviceId || !selectedCycleId) {
      setSummary(null);
      setHarvests([]);
      return;
    }

    setDetailLoading(true);
    setDetailError(null);

    try {
      const [summaryResult, harvestResult] = await Promise.all([
        api.cycles.summary(selectedDeviceId, selectedCycleId),
        api.cycles.harvests(selectedDeviceId, selectedCycleId, { limit: 100, offset: 0 }),
      ]);
      setSummary(summaryResult);
      setHarvests(Array.isArray(harvestResult) ? harvestResult : []);
    } catch (error) {
      console.error('Cycle detail fetch failed:', error);
      setDetailError(error.getUserMessage?.() || error.message || 'Gagal memuat detail siklus.');
    } finally {
      setDetailLoading(false);
    }
  }, [selectedCycleId, selectedDeviceId]);

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

    if (!selectedDeviceId) {
      setToast({ message: 'Pilih kumbung terlebih dahulu', type: 'warning' });
      return;
    }

    if (!cycleForm.startedAt) {
      setToast({ message: 'Tanggal mulai siklus wajib diisi', type: 'warning' });
      return;
    }

    const baglogCount = cycleForm.baglogCount === '' ? undefined : Number(cycleForm.baglogCount);
    if (baglogCount !== undefined && (!Number.isFinite(baglogCount) || baglogCount < 0)) {
      setToast({ message: 'Jumlah baglog harus berupa angka positif', type: 'warning' });
      return;
    }

    setSubmittingCycle(true);
    try {
      const cycleName = cycleForm.name.trim()
        || `Siklus ${formatReadableDate(cycleForm.startedAt)} - ${selectedDevice?.name || selectedDeviceId}`;
      const createdCycle = await api.cycles.create(selectedDeviceId, compactPayload({
        name: cycleName,
        mushroomType: cycleForm.mushroomType.trim() || 'Jamur Tiram',
        strain: cycleForm.strain.trim(),
        baglogCount,
        startedAt: cycleForm.startedAt,
        expectedEndedAt: cycleForm.expectedEndedAt,
        notes: cycleForm.notes.trim(),
      }));
      setCycleForm(createDefaultCycleForm());
      setToast({ message: '✓ Siklus baru berhasil dibuat', type: 'success' });
      const nextFilter = cycleStatusFilter === 'active' ? 'active' : cycleStatusFilter;
      await loadCycles(nextFilter);
      const createdId = readEntityId(createdCycle);
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

    if (!selectedDeviceId || !selectedCycleId) {
      setToast({ message: 'Pilih siklus terlebih dahulu', type: 'warning' });
      return;
    }

    const weightKg = Number(harvestForm.weightKg);
    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      setToast({ message: 'Berat panen wajib diisi dan harus lebih dari 0 kg', type: 'warning' });
      return;
    }

    const pricePerKg = harvestForm.pricePerKg === '' ? undefined : Number(harvestForm.pricePerKg);
    if (pricePerKg !== undefined && (!Number.isFinite(pricePerKg) || pricePerKg < 0)) {
      setToast({ message: 'Harga per kg harus berupa angka positif', type: 'warning' });
      return;
    }

    setSubmittingHarvest(true);
    try {
      const payload = compactPayload({
        harvestedAt: harvestForm.harvestedAt
          ? new Date(harvestForm.harvestedAt).toISOString()
          : new Date().toISOString(),
        weightKg,
        pricePerKg,
        grade: harvestForm.grade.trim(),
        notes: harvestForm.notes.trim(),
      });

      if (editingHarvestId) {
        await api.cycles.updateHarvest(selectedDeviceId, selectedCycleId, editingHarvestId, payload);
        setToast({ message: '✓ Data panen berhasil diperbarui', type: 'success' });
      } else {
        await api.cycles.createHarvest(selectedDeviceId, selectedCycleId, payload);
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

  const handleDeleteHarvest = async (harvest) => {
    const harvestId = readEntityId(harvest);
    if (!selectedDeviceId || !selectedCycleId || !harvestId) return;
    if (!window.confirm('Hapus catatan panen ini?')) return;

    try {
      await api.cycles.deleteHarvest(selectedDeviceId, selectedCycleId, harvestId);
      setToast({ message: '✓ Catatan panen dihapus', type: 'success' });
      await refreshSelectedCycle();
    } catch (error) {
      console.error('Delete harvest failed:', error);
      setToast({ message: error.getUserMessage?.() || 'Gagal menghapus panen', type: 'error' });
    }
  };

  const handleCompleteCycle = async (event) => {
    event.preventDefault();
    if (!selectedDeviceId || !selectedCycleId) return;

    if (!completeForm.endedAt) {
      setToast({ message: 'Tanggal selesai siklus wajib diisi', type: 'warning' });
      return;
    }

    setCompletingCycle(true);
    try {
      await api.cycles.complete(selectedDeviceId, selectedCycleId, compactPayload({
        endedAt: completeForm.endedAt,
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
        onMenuToggle={onMenuToggle}
        actions={
          <div className="kumbung-selector">
            <select
              value={selectedDeviceId || ''}
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
        {!selectedDeviceId ? (
          <div className="panel empty-state">
            <Sprout size={28} className="text-sage" />
            <h3>Pilih kumbung terlebih dahulu</h3>
            <p className="text-muted">Siklus dan panen selalu dicatat berdasarkan deviceId.</p>
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
                  <h3>{selectedDevice?.name || selectedDeviceId}</h3>
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
                      {selectedDevice?.name || selectedDeviceId}
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
                                  <button className="icon-button small-icon-button danger-icon-button" type="button" onClick={() => handleDeleteHarvest(harvest)} title="Hapus panen">
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

  const selectedRange = MONITORING_RANGES.find((range) => range.label === timeRange) || MONITORING_RANGES[0];
  const latestReadingTime = sensorHistory.reduce((latest, record) => {
    const date = getReadingDate(record);
    return date ? Math.max(latest, date.getTime()) : latest;
  }, 0);
  const rangeStartTime = latestReadingTime ? latestReadingTime - selectedRange.minutes * 60 * 1000 : 0;
  const formattedChartData = downsampleData(
    sensorHistory
      .map((record) => {
        const date = getReadingDate(record);
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
        return record.readingDate.getTime() >= rangeStartTime && record.temperature != null && record.humidity != null;
      })
      .sort((a, b) => a.readingDate - b.readingDate)
  );
  const mistPumpOn = isActiveValue(selectedDevice?.pumpStatus);
  const floorPumpOn = isActiveValue(selectedDevice?.floorPumpStatus);
  const canToggleHistoryLogs = historyLogs.length > 10;
  const visibleHistoryLogs = showAllHistoryLogs ? historyLogs : historyLogs.slice(0, 10);

  useEffect(() => {
    const resetId = window.setTimeout(() => {
      setShowAllHistoryLogs(false);
    }, 0);

    return () => window.clearTimeout(resetId);
  }, [selectedDeviceId]);

  useEffect(() => {
    if (!selectedDeviceId) return;

    const fetchLatest = async () => {
      try {
        const sensor = await api.telemetry.getSensorLatest(selectedDeviceId);
        if (sensor) setLatestSensor(sensor);
      } catch (error) {
        console.error('Latest telemetry fetch failed:', error);
      }
    };

    fetchLatest();
    const interval = setInterval(fetchLatest, TELEMETRY_LATEST_REFRESH_MS);
    return () => clearInterval(interval);
  }, [selectedDeviceId]);

  useEffect(() => {
    if (!selectedDeviceId) return;

    const fetchHistory = async () => {
      try {
        const from = new Date(Date.now() - selectedRange.minutes * 60 * 1000).toISOString();
        const [history, logs] = await Promise.allSettled([
          api.telemetry.getSensorHistory(selectedDeviceId, { from, limit: 300 }),
          api.telemetry.getHistory(selectedDeviceId)
        ]);

        if (history.status === 'fulfilled' && Array.isArray(history.value)) setSensorHistory(history.value);
        if (logs.status === 'fulfilled' && Array.isArray(logs.value)) setHistoryLogs(logs.value);
      } catch (error) {
        console.error('Telemetry history fetch failed:', error);
      }
    };

    fetchHistory();
    const interval = setInterval(fetchHistory, TELEMETRY_HISTORY_REFRESH_MS);
    return () => clearInterval(interval);
  }, [selectedDeviceId, selectedRange.minutes]);

  useEffect(() => {
    if (!selectedDeviceId || liveSensorEvent?.deviceId !== selectedDeviceId) return;

    window.setTimeout(() => {
      setLatestSensor(liveSensorEvent.record);
      setSensorHistory((prevHistory) => (
        mergeRealtimeRecord(prevHistory, liveSensorEvent.record, { limit: REALTIME_SENSOR_HISTORY_LIMIT })
      ));
    }, 0);
  }, [liveSensorEvent, selectedDeviceId]);

  useEffect(() => {
    if (!selectedDeviceId || liveHistoryEvent?.deviceId !== selectedDeviceId) return;

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
  }, [liveHistoryEvent, selectedDeviceId]);

  return (
    <>
      <Header 
        title={`Monitoring - ${selectedDevice?.name || '---'}`}
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
              value={selectedDeviceId || ''} 
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
              <div className="stat-value">{formatMetric(readTemperature(latestSensor), '°C')}</div>
              <div className="stat-status text-sage font-semibold">Normal</div>
            </div>
          </div>

          <div className="stat-card minimal sensor-card-horizontal">
            <div className="sensor-icon-large bg-blue-light">
              <Droplets size={28} className="text-blue" />
            </div>
            <div className="sensor-card-content">
              <span className="stat-title">Kelembaban</span>
              <div className="stat-value">{formatMetric(readHumidity(latestSensor), '%')}</div>
              <div className="stat-status text-sage font-semibold">Normal</div>
            </div>
          </div>

          <div className="stat-card minimal sensor-card-horizontal">
            <div className="sensor-icon-large bg-earth-light">
              <Wifi size={28} className="text-earth" />
            </div>
            <div className="sensor-card-content">
              <span className="stat-title">Jaringan & Sistem</span>
              <div className="stat-value" style={{ fontSize: '1.2rem' }}>{formatWifi(selectedDevice?.rssiDbm)}</div>
              <div className="stat-status text-muted font-semibold" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> {formatUptime(selectedDevice?.uptimeMs)}
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
                        <Area type="monotone" dataKey="temperature" stroke="var(--chart-temp-line)" strokeWidth={2.5} fillOpacity={1} fill="url(#monitoringTempGradient)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--chart-temp-line)' }} />
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
                        <Area type="monotone" dataKey="humidity" stroke="var(--chart-hum-line)" strokeWidth={2.5} fillOpacity={1} fill="url(#monitoringHumGradient)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--chart-hum-line)' }} />
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
                <span className="info-value font-semibold">{selectedDevice?.name || '---'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">ID Perangkat:</span>
                <span className="info-value text-muted">{selectedDevice?.deviceId || selectedDevice?.id || '---'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Status:</span>
                <span className={`info-value ${selectedDevice?.isOnline ? 'text-sage' : 'text-error'}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {selectedDevice?.isOnline ? <Wifi size={16} /> : <Wifi size={16} style={{ opacity: 0.5 }} />}
                  {selectedDevice?.isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Terakhir Terlihat:</span>
                <span className="info-value text-muted">{formatDateTime(selectedDevice?.lastSeenAt)}</span>
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
                  <tr key={idx}>
                    <td data-label="Waktu" className="text-muted">{formatHistoryTime(log)}</td>
                    <td data-label="Kategori" className="font-semibold">{log.category || log.actuator || (log.mode ? `Mode ${log.mode}` : 'Sistem')}</td>
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

// --- 4. Analitik Content ---
const AnalitikContent = ({ onMenuToggle }) => {
  const [analyticsRange, setAnalyticsRange] = useState('24 Jam');

  return (
    <>
      <Header 
        title="Analitik Kumbung" 
        subtitle="Bandingkan performa dan kondisi antar kumbung Anda."
        onMenuToggle={onMenuToggle}
        actions={
          <button className="primary-button outline">
            <Download size={18} />
            <span>Ekspor Laporan</span>
          </button>
        }
      />
      
      <div className="page-content">
        <motion.div 
          className="filter-bar"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="filter-group">
            <span className="filter-label">Rentang Waktu</span>
            <div className="toggle-group">
              {ANALYTICS_RANGES.map((range) => (
                <button
                  key={range}
                  className={`toggle-btn ${analyticsRange === range ? 'active' : ''}`}
                  onClick={() => setAnalyticsRange(range)}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div 
          className="panel"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="panel-header">
            <div>
              <h3>Perbandingan Rata-rata Suhu & Kelembaban</h3>
              <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                Ringkasan performa untuk rentang {analyticsRange.toLowerCase()}.
              </p>
            </div>
          </div>
          <div className="analytics-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData} margin={{ top: 20, right: 30, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="4 6" vertical={false} stroke={chartGridStroke} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxisTick} dy={10} />
                <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={chartAxisTick} tickFormatter={chartAxisFormatter} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={chartAxisTick} tickFormatter={chartAxisFormatter} />
                <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} cursor={{fill: 'rgba(231, 220, 198, 0.04)'}} formatter={chartTooltipFormatter} />
                <Legend wrapperStyle={{ paddingTop: '20px', color: 'var(--text-primary)', fontSize: '0.8rem' }} />
                <Bar yAxisId="left" name="Rata-rata Suhu (°C)" dataKey="temp" fill="var(--chart-temp-line)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar yAxisId="right" name="Rata-rata Kelembaban (%)" dataKey="hum" fill="var(--chart-hum-line)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </>
  );
};

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
                  {notif.type === 'success' && <Info size={24} />}
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
const ProfilContent = ({ onMenuToggle }) => {
  return (
    <>
      <Header 
        title="Profil Pengguna"
        onMenuToggle={onMenuToggle}
        subtitle="Kelola informasi akun dan preferensi aplikasi Anda."
      />
      
      <div className="page-content">
        <div className="dashboard-grid">
          <motion.div 
            className="panel"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="profile-card">
              <div className="profile-card-header">
                <div className="profile-avatar-large">
                  <User size={48} />
                  <button className="edit-avatar-btn">
                    <Camera size={14} />
                  </button>
                </div>
                <div className="profile-card-info">
                  <h3>Raihan Muhammad</h3>
                  <p className="text-sage font-semibold">Petani Utama</p>
                </div>
              </div>
              
              <div className="profile-details">
                <div className="profile-detail-item">
                  <Mail size={18} className="text-muted" />
                  <span>raihan.muhammad@shroomsync.id</span>
                </div>
                <div className="profile-detail-item">
                  <Phone size={18} className="text-muted" />
                  <span>+62 812 3456 7890</span>
                </div>
              </div>

              <button className="secondary-button" style={{ marginTop: '24px' }}>
                Edit Informasi Profil
              </button>
            </div>
          </motion.div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <motion.div 
              className="panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="panel-header">
                <h3>Pengaturan Keamanan & Privasi</h3>
              </div>
              
              <div className="settings-list">
                <div className="settings-item">
                  <div className="settings-info">
                    <div className="settings-icon"><Key size={18} /></div>
                    <div>
                      <h4>Ganti Kata Sandi</h4>
                      <p>Perbarui kata sandi Anda secara berkala.</p>
                    </div>
                  </div>
                  <button className="action-button"><ChevronDown size={18} style={{ transform: 'rotate(-90deg)' }} /></button>
                </div>
                
                <div className="settings-item">
                  <div className="settings-info">
                    <div className="settings-icon"><Shield size={18} /></div>
                    <div>
                      <h4>Autentikasi Dua Langkah</h4>
                      <p>Tambahkan lapisan keamanan ekstra ke akun Anda.</p>
                    </div>
                  </div>
                  <div className="toggle-switch active"></div>
                </div>

                <div className="settings-item">
                  <div className="settings-info">
                    <div className="settings-icon"><Bell size={18} /></div>
                    <div>
                      <h4>Notifikasi Email</h4>
                      <p>Terima laporan mingguan dan peringatan kritis.</p>
                    </div>
                  </div>
                  <div className="toggle-switch active"></div>
                </div>
              </div>
            </motion.div>

            <motion.div 
              className="panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
                {/* Sistem & Pembaruan panel removed per request */}
            </motion.div>
          </div>
        </div>
      </div>
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
        onMenuToggle={onMenuToggle}
        subtitle="Konfigurasi logika aktuator berdasarkan spesifikasi firmware ESP32."
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
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [liveSensorEvent, setLiveSensorEvent] = useState(null);
  const [liveHistoryEvent, setLiveHistoryEvent] = useState(null);

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

  const connectionError = !devicesLoading && devicesError && !socketConnected
    ? 'Koneksi API bermasalah. Menampilkan data terakhir yang berhasil dibaca.'
    : null;

  const selectedDevice = devices.find(d => (d.deviceId || d.id) === selectedDeviceId);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="app-container">
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        isOpen={sidebarOpen}
        onClose={closeSidebar}
      />
      <main className="main-content">
        {connectionError && (
          <div className="connection-warning" role="status">
            {connectionError}
          </div>
        )}
        {activePage === 'dashboard' && <DashboardContent devices={devices} setSelectedDeviceId={setSelectedDeviceId} setActivePage={setActivePage} onMenuToggle={toggleSidebar} liveSensorEvent={liveSensorEvent} liveHistoryEvent={liveHistoryEvent} />}
        {activePage === 'kumbung' && <KumbungContent setActivePage={setActivePage} devices={devices} refetchDevices={refetch} selectedDeviceId={selectedDeviceId} setSelectedDeviceId={setSelectedDeviceId} onMenuToggle={toggleSidebar} />}
        {activePage === 'monitoring' && <MonitoringContent setActivePage={setActivePage} selectedDeviceId={selectedDeviceId} setSelectedDeviceId={setSelectedDeviceId} devices={devices} selectedDevice={selectedDevice} onMenuToggle={toggleSidebar} liveSensorEvent={liveSensorEvent} liveHistoryEvent={liveHistoryEvent} />}
        {activePage === 'siklus' && <SiklusPanenContent selectedDeviceId={selectedDeviceId} setSelectedDeviceId={setSelectedDeviceId} devices={devices} selectedDevice={selectedDevice} onMenuToggle={toggleSidebar} />}
        {activePage === 'kontrol' && <KontrolContent selectedDeviceId={selectedDeviceId} setSelectedDeviceId={setSelectedDeviceId} devices={devices} updateDevice={updateDevice} onMenuToggle={toggleSidebar} />}
        {activePage === 'analitik' && <AnalitikContent onMenuToggle={toggleSidebar} />}
        {activePage === 'notifikasi' && <NotifikasiContent onMenuToggle={toggleSidebar} />}
        {activePage === 'profil' && <ProfilContent onMenuToggle={toggleSidebar} />}
      </main>
    </div>
  );
}
export default App;
