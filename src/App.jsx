import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  CloudRain,
  Sun,
  CloudSun,
  Calendar,
  Clock,
  Menu
} from 'lucide-react';
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './App.css';
import api from './services/api';

const MONITORING_RANGES = [
  { label: '10 Menit', minutes: 10 },
  { label: '20 Menit', minutes: 20 },
  { label: '30 Menit', minutes: 30 },
];

const ANALYTICS_RANGES = ['24 Jam', '7 Hari', '30 Hari'];

const getReadingDate = (record) => {
  const rawDate = record?.createdAt || record?.recordedAt || record?.time;
  const date = rawDate ? new Date(rawDate) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const readTemperature = (record) => record?.temperature ?? record?.suhu;
const readHumidity = (record) => record?.humidity ?? record?.kelembaban;

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

// Weather Service for BMKG API
const weatherService = {
  // Fetch weather forecast from BMKG API
  // BMKG provides public weather API at data.bmkg.go.id
  getForecast: async (lat, lon) => {
    try {
      // Using BMKG public API endpoint
      // Note: In production, use your own proxy or backend to avoid CORS
      const response = await fetch(`https://api.bmkg.go.id/publik/prakiraan-cuaca?lat=${lat}&lon=${lon}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) throw new Error('Weather fetch failed');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Weather API error:', error);
      // Return mock data for Rancaekek Wetan, Bandung
      return {
        lokasi: { 
          provinsi: 'Jawa Barat', 
          kota: 'Bandung', 
          kecamatan: 'Rancaekek',
          desa: 'Rancaekek Wetan'
        },
        data: [{
          cuaca: [{ 
            weather: 'Berawan', 
            tempMin: 22, 
            tempMax: 30, 
            humidity: 75 
          }]
        }]
      };
    }
  },
  
  // Parse weather condition and determine optimal schedule
  parseWeatherCondition: (weatherData) => {
    if (!weatherData || !weatherData.data || !weatherData.data[0]) return null;
    
    const current = weatherData.data[0].cuaca[0];
    const weather = current.weather.toLowerCase();
    const humidity = current.humidity || 70;
    const tempMax = current.tempMax || 30;
    
    // Determine weather type and schedule
    let condition = 'normal';
    if (weather.includes('hujan') || weather.includes('rain')) {
      condition = humidity > 80 ? 'heavy_rain' : 'light_rain';
    } else if (weather.includes('berawan') || weather.includes('cloudy')) {
      condition = 'cloudy';
    } else if (weather.includes('cerah') || weather.includes('clear')) {
      condition = tempMax > 32 ? 'hot_sunny' : 'sunny';
    }
    
    return { condition, humidity, tempMax, weatherDesc: current.weather };
  },
  
  // Calculate optimal schedule based on weather
  calculateOptimalSchedule: (weatherCondition) => {
    const { condition, humidity, tempMax } = weatherCondition;
    
    // Default schedule
    let schedule = {
      freq: 2,
      jam1: 7, menit1: 0,
      jam2: 16, menit2: 0,
      jam3: 0, menit3: 0,
      flrJam: 8, flrMenit: 0,
      timerMenit: 1, timerDetik: 30,
      flrMenit: 2, flrDetik: 0,
      reason: 'Jadwal standar'
    };
    
    switch (condition) {
      case 'heavy_rain':
        // Heavy rain: minimal spraying, focus on floor only
        schedule = {
          freq: 1,
          jam1: 14, menit1: 0,
          jam2: 0, menit2: 0,
          jam3: 0, menit3: 0,
          flrJam: 10, flrMenit: 0,
          timerMenit: 0, timerDetik: 45,
          flrMenit: 1, flrDetik: 0,
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
          flrJam: 9, flrMenit: 0,
          timerMenit: 1, timerDetik: 0,
          flrMenit: 1, flrDetik: 30,
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
          flrJam: 9, flrMenit: 0,
          timerMenit: 1, timerDetik: 30,
          flrMenit: 2, flrDetik: 0,
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
          flrJam: 7, flrMenit: 30,
          timerMenit: 2, timerDetik: 0,
          flrMenit: 3, flrDetik: 0,
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
          flrJam: 8, flrMenit: 0,
          timerMenit: 1, timerDetik: 30,
          flrMenit: 2, flrDetik: 0,
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
    
    return schedule;
  }
};

const formatMetric = (value, suffix, decimalPlaces = 2) => (
  value == null ? '--' : `${Number(value).toFixed(decimalPlaces)}${suffix}`
);

const chartTooltipFormatter = (value, name) => {
  const formattedValue = Number(value).toFixed(2);
  return [formattedValue, name];
};

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
const Header = ({ title, subtitle, actions, onBack, onMenuToggle }) => (
  <header className="header">
    <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
    <div className="header-actions">
      {actions}
    </div>
  </header>
);

// --- 1. Dashboard Content ---
const DashboardContent = ({ devices, setSelectedDeviceId, setActivePage, onMenuToggle }) => {
  const onlineCount = devices.filter(d => d.isOnline).length;
  const [dashboardDeviceId, setDashboardDeviceId] = useState(null);
  const [latestReadings, setLatestReadings] = useState([]);
  const [dashboardHistory, setDashboardHistory] = useState([]);
  const [dashboardLogs, setDashboardLogs] = useState([]);
  const [dashboardNow, setDashboardNow] = useState(new Date().getTime());

  const deviceIds = devices.map((device) => device.deviceId || device.id);
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
    if (devices.length === 0 || !activeDashboardDeviceId) return;

    const fetchDashboardData = async () => {
      const currentDeviceIds = devices.map((device) => device.deviceId || device.id);
      const from = new Date(new Date().getTime() - 10 * 60 * 1000).toISOString();

      try {
        const [readingResults, historyResult, logsResult] = await Promise.all([
          Promise.allSettled(
            currentDeviceIds.map((deviceId) => api.telemetry.getSensorLatest(deviceId))
          ),
          api.telemetry.getSensorHistory(activeDashboardDeviceId, { from, limit: 180 }).catch(() => []),
          api.telemetry.getHistory(activeDashboardDeviceId, { limit: 6 }).catch(() => []),
        ]);

        setDashboardNow(new Date().getTime());
        setLatestReadings(
          readingResults
            .map((result, index) => ({
              deviceId: currentDeviceIds[index],
              sensor: result.status === 'fulfilled' ? result.value : null,
            }))
            .filter((reading) => reading.sensor)
        );
        setDashboardHistory(Array.isArray(historyResult) ? historyResult : []);
        setDashboardLogs(Array.isArray(logsResult) ? logsResult : []);
      } catch (error) {
        console.error('Dashboard fetch failed:', error);
      }
    };

    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, [devices, activeDashboardDeviceId]);

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
        <motion.div 
          className="stats-row"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="stat-card minimal">
            <span className="stat-title">Kumbung Aktif</span>
            <div className="stat-value">{devices.length}</div>
            <div className="stat-status text-earth">Total</div>
          </div>
          <div className="stat-card minimal">
            <span className="stat-title">Kumbung Online <span className="stat-icon-mini text-sage">●</span></span>
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
              <div className="chart-row">
                <div className="chart-info">
                  <span className="chart-label">Suhu</span>
                  <div className="chart-current-value">{formatMetric(activeTemperature, '°C')}</div>
                  <span className={`chart-status ${temperatureStatus.className}`}>{temperatureStatus.label}</span>
                </div>
                <div className="chart-graph">
                  {formattedDashboardHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={formattedDashboardHistory} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                        <defs>
                          <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6B8F71" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#6B8F71" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 10}} dy={15} minTickGap={24} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 10}} domain={['dataMin - 2', 'dataMax + 2']} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-sm)' }} formatter={(value) => [`${Number(value).toFixed(2)}°C`, 'Suhu']} />
                        <Area type="monotone" dataKey="temp" stroke="#6B8F71" strokeWidth={2} fillOpacity={1} fill="url(#colorTemp)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-chart-state">Belum ada data suhu 10 menit terakhir.</div>
                  )}
                </div>
              </div>

              <div className="chart-divider"></div>

              <div className="chart-row">
                <div className="chart-info">
                  <span className="chart-label">Kelembaban</span>
                  <div className="chart-current-value">{formatMetric(activeHumidity, '%')}</div>
                  <span className={`chart-status ${humidityStatus.className}`}>{humidityStatus.label}</span>
                </div>
                <div className="chart-graph">
                  {formattedDashboardHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={formattedDashboardHistory} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                        <defs>
                          <linearGradient id="colorHum" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4A90E2" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#4A90E2" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 10}} dy={15} minTickGap={24} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 10}} domain={['dataMin - 5', 'dataMax + 5']} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-sm)' }} formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Kelembaban']} />
                        <Area type="monotone" dataKey="hum" stroke="#4A90E2" strokeWidth={2} fillOpacity={1} fill="url(#colorHum)" dot={false} />
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
                        <span className={dev.isOnline ? 'text-sage' : 'text-error'}>● {dev.isOnline ? 'Online' : 'Offline'}</span>
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
const KumbungContent = ({ setActivePage, devices, setDevices, setSelectedDeviceId, onMenuToggle }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [newDevice, setNewDevice] = useState({ name: '', deviceId: '' });
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
      });
      const data = await api.devices.list();
      if (Array.isArray(data)) {
        setDevices(data);
        setSelectedDeviceId((currentId) => currentId || data[0]?.deviceId || data[0]?.id || null);
      }
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
      await api.devices.delete(id);
      const data = await api.devices.list();
      if (Array.isArray(data)) {
        setDevices(data);
        setSelectedDeviceId((currentId) => {
          if (currentId !== id) return currentId;
          return data[0]?.deviceId || data[0]?.id || null;
        });
      }
      setToast({ message: '✓ Kumbung berhasil dihapus', type: 'success' });
      setShowDeleteModal(false);
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

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="secondary-button" onClick={() => setShowAddModal(false)}>Batal</button>
              <button className="primary-button" onClick={handleAddDevice}>Simpan Kumbung</button>
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
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="secondary-button" onClick={() => setShowDeleteModal(false)}>Batal</button>
              <button className="primary-button" style={{ backgroundColor: 'var(--error)', borderColor: 'var(--error)', color: '#fff' }} onClick={handleDeleteDevice}>Ya, Hapus</button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

// --- 3. Monitoring Content ---
const MonitoringContent = ({ setActivePage, selectedDeviceId, setSelectedDeviceId, devices, selectedDevice, onMenuToggle }) => {
  const [timeRange, setTimeRange] = useState('10 Menit');
  const [latestSensor, setLatestSensor] = useState({ temperature: '--', humidity: '--' });
  const [sensorHistory, setSensorHistory] = useState([]);
  const [actuatorLatest, setActuatorLatest] = useState({ mistPump: false, floorPump: false });
  const [historyLogs, setHistoryLogs] = useState([]);

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
  const mistPumpOn = isActiveValue(actuatorLatest.mistPump ?? actuatorLatest.pump ?? actuatorLatest.pumpStatus);
  const floorPumpOn = isActiveValue(actuatorLatest.floorPump ?? actuatorLatest.fan ?? actuatorLatest.floorPumpStatus);

  useEffect(() => {
    if (!selectedDeviceId) return;

    const fetchData = async () => {
      try {
        const from = new Date(Date.now() - selectedRange.minutes * 60 * 1000).toISOString();
        const [sensor, history, actuator, logs] = await Promise.allSettled([
          api.telemetry.getSensorLatest(selectedDeviceId),
          api.telemetry.getSensorHistory(selectedDeviceId, { from, limit: 300 }),
          api.telemetry.getHistoryLatest(selectedDeviceId),
          api.telemetry.getHistory(selectedDeviceId)
        ]);

        if (sensor.status === 'fulfilled' && sensor.value) setLatestSensor(sensor.value);
        if (history.status === 'fulfilled' && Array.isArray(history.value)) setSensorHistory(history.value);
        if (actuator.status === 'fulfilled' && actuator.value) setActuatorLatest(actuator.value);
        if (logs.status === 'fulfilled' && Array.isArray(logs.value)) setHistoryLogs(logs.value);
      } catch (error) {
        console.error('Fetch failed:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [selectedDeviceId, selectedRange.minutes]);

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
              <div className="chart-row">
                <div className="chart-info">
                  <span className="chart-label">Suhu (°C)</span>
                  <div className="chart-current-value">{formatMetric(readTemperature(latestSensor), '°C')}</div>
                </div>
                <div className="chart-graph" style={{ height: '200px' }}>
                  {formattedChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={formattedChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 10}} dy={10} minTickGap={28} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 10}} domain={['dataMin - 2', 'dataMax + 2']} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-sm)', backgroundColor: '#fff' }}
                          formatter={(value) => [`${Number(value).toFixed(2)}°C`, 'Suhu']}
                        />
                        <Line type="monotone" dataKey="temperature" stroke="var(--earth-brown)" strokeWidth={2.5} dot={false} activeDot={{r: 5}} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-chart-state">Belum ada data suhu.</div>
                  )}
                </div>
              </div>

              <div className="chart-divider"></div>

              {/* Kelembaban Chart */}
              <div className="chart-row">
                <div className="chart-info">
                  <span className="chart-label">Kelembaban (%)</span>
                  <div className="chart-current-value">{formatMetric(readHumidity(latestSensor), '%')}</div>
                </div>
                <div className="chart-graph" style={{ height: '200px' }}>
                  {formattedChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={formattedChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 10}} dy={10} minTickGap={28} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 10}} domain={['dataMin - 5', 'dataMax + 5']} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-sm)', backgroundColor: '#fff' }}
                          formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Kelembaban']}
                        />
                        <Line type="monotone" dataKey="humidity" stroke="#4A90E2" strokeWidth={2.5} dot={false} activeDot={{r: 5}} />
                      </LineChart>
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
                <span className={`info-value ${selectedDevice?.isOnline ? 'text-sage' : 'text-error'}`}>
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
          className="panel"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          style={{ marginTop: '24px' }}
        >
          <div className="panel-header">
            <h3>Status Aktuator & Riwayat Sistem</h3>
          </div>
          
          <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px', marginTop: '16px' }}>
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
                {historyLogs.slice(0, 10).map((log, idx) => (
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
          <button className="secondary-button" style={{ width: '100%', marginTop: '16px', justifyContent: 'center' }}>Lihat Riwayat Lengkap</button>
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
          <div style={{ height: '400px', marginTop: '24px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)'}} dy={10} />
                <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)'}} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)'}} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} cursor={{fill: 'rgba(123, 94, 60, 0.05)'}} formatter={chartTooltipFormatter} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar yAxisId="left" name="Rata-rata Suhu (°C)" dataKey="temp" fill="var(--earth-brown)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar yAxisId="right" name="Rata-rata Kelembaban (%)" dataKey="hum" fill="#4A90E2" radius={[4, 4, 0, 0]} maxBarSize={40} />
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

  return (
    <>
      <Header 
        title="Pusat Notifikasi" 
        subtitle="Riwayat peringatan dan aktivitas sistem Anda."
        onMenuToggle={onMenuToggle}
        actions={
          <button className="icon-button">
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
            {notifications.map((notif) => (
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
          </div>
        </motion.div>
      </div>
    </>
  );
}

// --- 6. Profil Content ---
const ProfilContent = ({ onMenuToggle }) => (
// ... Profil Content code is unmodified, jumping to the end of ProfilContent

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
      </div>
    </div>
  </>
);

// --- 7. Kontrol Content ---
const KontrolContent = ({ selectedDeviceId, setSelectedDeviceId, devices, onMenuToggle }) => {
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

  // Manual States
  const [pumpOn, setPumpOn] = useState(false);
  const [fanOn, setFanOn] = useState(false);

  // Track last user action time to prevent polling overwrite (grace period: 3s)
  const [lastActionTime, setLastActionTime] = useState(0);

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
  const [deviceLocation, setDeviceLocation] = useState({ 
    lat: -6.95, 
    lon: 107.75, 
    city: 'Rancaekek Wetan',
    district: 'Rancaekek',
    province: 'Jawa Barat'
  }); // Rancaekek Wetan, Bandung

  useEffect(() => {
    if (!selectedDeviceId) return;

    let cancelled = false;
    const loadControlConfig = async () => {
      try {
        const device = await api.devices.get(selectedDeviceId);
        if (cancelled || !device?.config) return;

        const { config } = device;
        setOpMode(config.controlMode ?? 2);
        setScheduleFreq(config.scheduleMode ?? 1);
        const loadedMinS = config.minS ?? 26;
        const loadedMidS = config.midS ?? 28;
        const loadedMinK = config.minK ?? 80;
        const loadedMidK = config.midK ?? 90;
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
  }, [selectedDeviceId]);

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

  // Reload saved states when selectedDeviceId changes
  useEffect(() => {
    if (selectedDeviceId) {
      const savedAuto = localStorage.getItem(`shroomsync_scheduleAuto_${selectedDeviceId}`);
      if (savedAuto !== null) {
        setScheduleAuto(JSON.parse(savedAuto));
      }
      const savedWeather = localStorage.getItem(`shroomsync_weatherData_${selectedDeviceId}`);
      if (savedWeather !== null) {
        setWeatherData(JSON.parse(savedWeather));
      }
    }
  }, [selectedDeviceId]);

  // Sync actuator status from device (for Manual/Hybrid mode)
  useEffect(() => {
    if (!selectedDeviceId) return;
    if (opMode !== 1 && opMode !== 3) return; // Only poll in Manual (1) or Hybrid (3) mode

    let cancelled = false;
    const syncActuatorStatus = async () => {
      try {
        // Skip update if user just performed action (grace period: 3 seconds)
        const timeSinceLastAction = Date.now() - lastActionTime;
        if (timeSinceLastAction < 3000) return;

        const latest = await api.telemetry.getHistoryLatest(selectedDeviceId);
        if (cancelled || !latest) return;

        // Read actuator states from device telemetry (handles various field names)
        const pumpStatus = latest?.pumpStatus ?? latest?.mistPump ?? latest?.pump ?? latest?.actuator?.pump;
        const fanStatus = latest?.floorPumpStatus ?? latest?.floorPump ?? latest?.fan ?? latest?.actuator?.fan;

        setPumpOn(isActiveValue(pumpStatus));
        setFanOn(isActiveValue(fanStatus));
      } catch (error) {
        // Silent fail - don't spam errors for background sync
      }
    };

    syncActuatorStatus(); // Initial sync
    const interval = setInterval(syncActuatorStatus, 3000); // Poll every 3 seconds
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedDeviceId, opMode, lastActionTime]);

  const handleSaveMode = async (mode) => {
    if (!selectedDeviceId) {
      setToast({ message: 'Pilih kumbung terlebih dahulu', type: 'warning' });
      return;
    }
    try {
      await api.control.setMode(selectedDeviceId, mode);
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
      setOriginalSetpoints(prev => ({ ...prev, ...data }));

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
        await api.control.setTimer(selectedDeviceId, { Menit: timerMenit, Detik: timerDetik });
        setToast({ message: `✓ Timer Kabut: ${timerMenit}m ${timerDetik}s tersimpan`, type: 'success' });
      } else {
        await api.control.setTimerFloor(selectedDeviceId, { FlrMenit: flrMenit, FlrDetik: flrDetik });
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
        const data = {};
        if (flrJam1 !== originalSchedule.flrJam1) data.FlrJam = flrJam1;
        if (flrMenit1 !== originalSchedule.flrMenit1) data.FlrMenit = flrMenit1;

        // If no changes, show message and return
        if (Object.keys(data).length === 0) {
          setToast({ message: 'Tidak ada perubahan jadwal lantai yang perlu disimpan', type: 'info' });
          return;
        }

        await api.control.setScheduleFloor(selectedDeviceId, data);

        // Update original values after successful save
        setOriginalSchedule(prev => ({ ...prev, flrJam1, flrMenit1 }));

        // Show which parameters were saved
        const changedParams = Object.keys(data).join(', ');
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
  const fetchWeatherAndApplySchedule = async () => {
    if (!selectedDeviceId) {
      setToast({ message: 'Pilih kumbung terlebih dahulu', type: 'warning' });
      return;
    }
    
    setWeatherLoading(true);
    try {
      // Fetch weather data from BMKG
      const weather = await weatherService.getForecast(deviceLocation.lat, deviceLocation.lon);
      setWeatherData(weather);
      
      // Parse weather condition
      const condition = weatherService.parseWeatherCondition(weather);
      if (!condition) {
        setToast({ message: 'Gagal membaca data cuaca', type: 'error' });
        return;
      }
      
      // Calculate optimal schedule
      const optimalSchedule = weatherService.calculateOptimalSchedule(condition);
      
      // Apply schedule to states
      setScheduleFreq(optimalSchedule.freq);
      setJam1(optimalSchedule.jam1);
      setMenit1(optimalSchedule.menit1);
      setJam2(optimalSchedule.jam2);
      setMenit2(optimalSchedule.menit2);
      setJam3(optimalSchedule.jam3);
      setMenit3(optimalSchedule.menit3);

      // Update original schedule values
      setOriginalSchedule(prev => ({
        ...prev,
        jam1: optimalSchedule.jam1,
        menit1: optimalSchedule.menit1,
        jam2: optimalSchedule.jam2,
        menit2: optimalSchedule.menit2,
        jam3: optimalSchedule.jam3,
        menit3: optimalSchedule.menit3
      }));
      setFlrJam1(optimalSchedule.flrJam);
      setFlrMenit1(optimalSchedule.flrMenit);
      setTimerMenit(optimalSchedule.timerMenit);
      setTimerDetik(optimalSchedule.timerDetik);
      setFlrMenit(optimalSchedule.flrMenit);
      setFlrDetik(optimalSchedule.flrDetik);

      // Update original floor schedule values
      setOriginalSchedule(prev => ({
        ...prev,
        flrJam1: optimalSchedule.flrJam,
        flrMenit1: optimalSchedule.flrMenit
      }));
      
      // Save to device - only send changed parameters
      // Build schedule data with only changed values
      const scheduleData = {};
      if (optimalSchedule.jam1 !== originalSchedule.jam1) scheduleData.jam1 = optimalSchedule.jam1;
      if (optimalSchedule.menit1 !== originalSchedule.menit1) scheduleData.menit1 = optimalSchedule.menit1;
      if (optimalSchedule.freq >= 2) {
        if (optimalSchedule.jam2 !== originalSchedule.jam2) scheduleData.jam2 = optimalSchedule.jam2;
        if (optimalSchedule.menit2 !== originalSchedule.menit2) scheduleData.menit2 = optimalSchedule.menit2;
      }
      if (optimalSchedule.freq === 3) {
        if (optimalSchedule.jam3 !== originalSchedule.jam3) scheduleData.jam3 = optimalSchedule.jam3;
        if (optimalSchedule.menit3 !== originalSchedule.menit3) scheduleData.menit3 = optimalSchedule.menit3;
      }

      // Build floor schedule data with only changed values
      const floorScheduleData = {};
      if (optimalSchedule.flrJam !== originalSchedule.flrJam1) floorScheduleData.FlrJam = optimalSchedule.flrJam;
      if (optimalSchedule.flrMenit !== originalSchedule.flrMenit1) floorScheduleData.FlrMenit = optimalSchedule.flrMenit;

      // Only call APIs if there are changes
      if (Object.keys(scheduleData).length > 0) {
        await api.control.setSchedule(selectedDeviceId, scheduleData);
      }
      if (Object.keys(floorScheduleData).length > 0) {
        await api.control.setScheduleFloor(selectedDeviceId, floorScheduleData);
      }
      await api.control.setScheduleMode(selectedDeviceId, optimalSchedule.freq);
      await api.control.setTimer(selectedDeviceId, {
        Menit: optimalSchedule.timerMenit, Detik: optimalSchedule.timerDetik
      });
      await api.control.setTimerFloor(selectedDeviceId, {
        FlrMenit: optimalSchedule.flrMenit, FlrDetik: optimalSchedule.flrDetik
      });
      
      setToast({ 
        message: `✓ Jadwal otomatis: ${optimalSchedule.reason}`, 
        type: 'success' 
      });
    } catch (error) {
      console.error('Weather schedule error:', error);
      setToast({ message: 'Gagal mengambil data cuaca', type: 'error' });
    } finally {
      setWeatherLoading(false);
    }
  };

  const toggleAutoSchedule = async () => {
    const newAutoState = !scheduleAuto;
    setScheduleAuto(newAutoState);
    
    if (newAutoState) {
      // Enable auto - fetch weather and apply
      await fetchWeatherAndApplySchedule();
    } else {
      // Disable auto - user can now manually edit
      setToast({ message: 'Mode manual aktif - silakan atur jadwal sendiri', type: 'info' });
    }
  };

  const handleActuator = async (actuator, currentState) => {
    if (!selectedDeviceId) {
      setToast({ message: 'Pilih kumbung terlebih dahulu', type: 'warning' });
      return;
    }
    // Mark user action time to prevent polling overwrite during grace period
    setLastActionTime(Date.now());
    try {
      const newState = !currentState;
      if (actuator === 'pump') {
        await api.control.controlPump(selectedDeviceId, { on: newState });
        setPumpOn(newState);
        setToast({ message: `✓ Pompa Kabut ${newState ? 'ON' : 'OFF'}`, type: 'success' });
      } else {
        await api.control.controlFan(selectedDeviceId, { on: newState });
        setFanOn(newState);
        setToast({ message: `✓ Pompa Lantai ${newState ? 'ON' : 'OFF'}`, type: 'success' });
      }
    } catch (e) {
      console.error(e);
      setToast({ message: `Gagal mengontrol ${actuator === 'pump' ? 'pompa kabut' : 'pompa lantai'}`, type: 'error' });
    }
  };

  const selectedControlDevice = devices.find((device) => (device.deviceId || device.id) === selectedDeviceId);
  const modeDescriptions = {
    1: 'Kontrol aktuator sepenuhnya melalui switch manual.',
    2: 'Sistem menjalankan aktuator berdasarkan setpoint suhu dan kelembaban.',
    3: 'Otomatis berdasarkan setpoint, namun operator tetap dapat override aktuator.',
  };

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
                    <p>Mode saat ini: {opMode === 1 ? 'Manual' : opMode === 2 ? 'Auto' : 'Hybrid'}</p>
                  </div>
                </div>
                <div className="mode-selector">
                  <button className={`mode-btn ${opMode === 1 ? 'active' : ''}`} onClick={() => handleSaveMode(1)}>
                    <span>Manual</span>
                    <small>Switch aktuator langsung</small>
                  </button>
                  <button className={`mode-btn ${opMode === 2 ? 'active' : ''}`} onClick={() => handleSaveMode(2)}>
                    <span>Auto</span>
                    <small>Ikuti setpoint sensor</small>
                  </button>
                  <button className={`mode-btn ${opMode === 3 ? 'active' : ''}`} onClick={() => handleSaveMode(3)}>
                    <span>Hybrid</span>
                    <small>Auto dengan override</small>
                  </button>
                </div>
                <div className="info-alert control-note">
                  <Info size={16} className="info-icon" />
                  <p>{modeDescriptions[opMode]}</p>
                </div>
              </section>

              <div className={`control-layout ${opMode === 1 ? 'manual-only' : ''} ${opMode === 2 ? 'auto-only' : ''} ${opMode === 3 ? 'hybrid' : ''}`}>
                {(opMode === 1 || opMode === 3) && (
                  <section className="control-card">
                    <div className="control-card-header">
                      <div>
                        <h3>Kontrol Manual Aktuator</h3>
                        <p>Override perangkat secara langsung.</p>
                      </div>
                    </div>
                    <div className="actuator-list">
                      <div className="actuator-card">
                        <div className="actuator-info">
                          <div className={`actuator-icon ${fanOn ? 'active floor' : ''}`}><Waves size={24} /></div>
                          <div>
                            <h4>Pompa Lantai (Floor Pump)</h4>
                            <p className="text-muted">{fanOn ? 'Aktif' : 'Nonaktif'} untuk membasahi lantai kumbung.</p>
                          </div>
                        </div>
                        <button type="button" className={`toggle-switch large ${fanOn ? 'active' : ''}`} aria-pressed={fanOn} onClick={() => handleActuator('fan', fanOn)}></button>
                      </div>

                      <div className="actuator-card">
                        <div className="actuator-info">
                          <div className={`actuator-icon ${pumpOn ? 'active pump' : ''}`}><Droplet size={24} /></div>
                          <div>
                            <h4>Pompa Kabut (Mist Pump)</h4>
                            <p className="text-muted">{pumpOn ? 'Aktif' : 'Nonaktif'} untuk menaikkan kelembaban ruang.</p>
                          </div>
                        </div>
                        <button type="button" className={`toggle-switch large ${pumpOn ? 'active' : ''}`} aria-pressed={pumpOn} onClick={() => handleActuator('pump', pumpOn)}></button>
                      </div>
                    </div>
                  </section>
                )}

                {(opMode === 2 || opMode === 3) && (
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
                    border: '1px solid var(--border-color)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <Cloud size={24} className="text-blue" />
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1rem' }}>
                          {weatherData?.lokasi?.desa || deviceLocation.city}
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {weatherData?.lokasi?.kecamatan || deviceLocation.district}, {weatherData?.lokasi?.provinsi || deviceLocation.province}
                        </p>
                      </div>
                    </div>
                    {weatherData?.data?.[0]?.cuaca?.[0] && (
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(3, 1fr)', 
                        gap: '12px',
                        fontSize: '0.85rem'
                      }}>
                        <div style={{ textAlign: 'center', padding: '8px', background: 'white', borderRadius: '8px' }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Cuaca</div>
                          <div style={{ fontWeight: 600 }}>{weatherData.data[0].cuaca[0].weather}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '8px', background: 'white', borderRadius: '8px' }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Suhu</div>
                          <div style={{ fontWeight: 600 }}>{weatherData.data[0].cuaca[0].tempMax}°C</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '8px', background: 'white', borderRadius: '8px' }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Kelembaban</div>
                          <div style={{ fontWeight: 600 }}>{weatherData.data[0].cuaca[0].humidity}%</div>
                        </div>
                      </div>
                    )}
                    <div className="info-alert control-note" style={{ marginTop: '12px' }}>
                      <Info size={14} className="info-icon" />
                      <p style={{ fontSize: '0.8rem' }}>
                        Jadwal telah disesuaikan otomatis berdasarkan kondisi cuaca. 
                        {scheduleFreq === 1 && ' Hujan lebat - penyiraman minimal.'}
                        {scheduleFreq === 2 && ' Kondisi normal - penyiraman standar.'}
                        {scheduleFreq === 3 && ' Panas terik - penyiraman intensif.'}
                      </p>
                    </div>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Settings size={18} />
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Status Settingan Aktif</h4>
                  </div>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
                    gap: '10px',
                    fontSize: '0.8rem'
                  }}>
                    {/* Mode Jadwal */}
                    <div style={{ 
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
                    <div style={{ 
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
                    <div style={{ 
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
                    <div style={{ 
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
                    <div style={{ 
                      background: 'rgba(255,255,255,0.2)', 
                      padding: '10px', 
                      borderRadius: '8px',
                      backdropFilter: 'blur(4px)',
                      gridColumn: '1 / -1'
                    }}>
                      <div style={{ opacity: 0.9, fontSize: '0.7rem', marginBottom: '4px' }}>Jadwal Penyiraman</div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
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
                    <div style={{ 
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
                      <p>{scheduleAuto ? 'Jadwal otomatis aktif' : 'Timer siklus dan jadwal RTC.'}</p>
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
                    <h4>Jadwal Penyiraman RTC</h4>
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
                      <p>{scheduleAuto ? 'Jadwal otomatis aktif' : 'Timer siklus dan satu jadwal RTC.'}</p>
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
                    <h4>Jadwal Penyiraman RTC</h4>
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
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const data = await api.devices.list();
        if (Array.isArray(data)) {
          setDevices(data);
          setSelectedDeviceId((currentId) => {
            if (data.length === 0) return null;
            const currentStillExists = data.some((device) => (device.deviceId || device.id) === currentId);
            return currentStillExists ? currentId : (data[0].deviceId || data[0].id);
          });
        }
      } catch (error) {
        console.error('Failed to fetch devices:', error);
      }
    };
    fetchDevices();
  }, []);

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
        {activePage === 'dashboard' && <DashboardContent devices={devices} setSelectedDeviceId={setSelectedDeviceId} setActivePage={setActivePage} onMenuToggle={toggleSidebar} />}
        {activePage === 'kumbung' && <KumbungContent setActivePage={setActivePage} devices={devices} setDevices={setDevices} setSelectedDeviceId={setSelectedDeviceId} onMenuToggle={toggleSidebar} />}
        {activePage === 'monitoring' && <MonitoringContent setActivePage={setActivePage} selectedDeviceId={selectedDeviceId} setSelectedDeviceId={setSelectedDeviceId} devices={devices} selectedDevice={selectedDevice} onMenuToggle={toggleSidebar} />}
        {activePage === 'kontrol' && <KontrolContent selectedDeviceId={selectedDeviceId} setSelectedDeviceId={setSelectedDeviceId} devices={devices} onMenuToggle={toggleSidebar} />}
        {activePage === 'analitik' && <AnalitikContent onMenuToggle={toggleSidebar} />}
        {activePage === 'notifikasi' && <NotifikasiContent onMenuToggle={toggleSidebar} />}
        {activePage === 'profil' && <ProfilContent onMenuToggle={toggleSidebar} />}
      </main>
    </div>
  );
}

export default App;
