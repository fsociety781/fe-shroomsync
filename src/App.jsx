import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Home, 
  Server, 
  Activity, 
  BarChart2, 
  Bell, 
  User, 
  LogOut,
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
  Fan,
  Droplet,
  Power
} from 'lucide-react';
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './App.css';

// --- Dummy Data ---
const chartData = [
  { time: '00:00', temp: 24, hum: 75 },
  { time: '04:00', temp: 28, hum: 72 },
  { time: '08:00', temp: 25, hum: 78 },
  { time: '12:00', temp: 30, hum: 70 },
  { time: '16:00', temp: 29, hum: 73 },
  { time: '20:00', temp: 26, hum: 76 },
  { time: '24:00', temp: 25, hum: 77 },
];

const analyticsData = [
  { name: 'Kumbung Utama', temp: 28.6, hum: 76 },
  { name: 'Kumbung B', temp: 27.1, hum: 78 },
  { name: 'Kumbung C', temp: 29.3, hum: 72 },
  { name: 'Kumbung D', temp: 26.5, hum: 80 },
];

const latestKumbungs = [
  { id: 'Kumbung Utama', status: 'Online', temp: '28.6°C', hum: '76%' },
  { id: 'Kumbung B', status: 'Online', temp: '27.1°C', hum: '78%' },
  { id: 'Kumbung C', status: 'Offline', temp: '29.3°C', hum: '72%' },
];

const notifications = [
  { id: 1, text: 'Suhu tinggi terdeteksi di Kumbung Utama', time: '10 menit yang lalu', type: 'error' },
  { id: 2, text: 'Kelembaban rendah di Kumbung B', time: '1 jam yang lalu', type: 'warning' },
  { id: 3, text: 'Kumbung C offline', time: '2 jam yang lalu', type: 'error' },
  { id: 4, text: 'Laporan mingguan telah siap', time: '1 hari yang lalu', type: 'info' },
  { id: 5, text: 'Suhu kembali normal di Kumbung Utama', time: '1 hari yang lalu', type: 'success' },
];

const kumbungList = [
  { name: 'Kumbung Utama', location: 'Lembang, Bandung', device: 'SS-001', status: 'Online' },
  { name: 'Kumbung B', location: 'Ciwidey, Bandung', device: 'SS-002', status: 'Online' },
  { name: 'Kumbung C', location: 'Pangalengan', device: 'SS-003', status: 'Online' },
  { name: 'Kumbung D', location: 'Rancabali, Bandung', device: 'SS-004', status: 'Offline' },
];

// --- Sidebar Component ---
const Sidebar = ({ activePage, setActivePage }) => (
  <aside className="sidebar">
    <div className="logo-container">
      <div className="logo-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
          <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
          <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z" />
        </svg>
      </div>
      <h1 className="logo-text">shroomsync</h1>
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
      <a href="#" className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('dashboard'); }}>
        <LayoutDashboard size={20} />
        <span>Dashboard</span>
      </a>
      <a href="#" className={`nav-item ${activePage === 'kumbung' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('kumbung'); }}>
        <Home size={20} />
        <span>Kumbung Saya</span>
      </a>
      <a href="#" className={`nav-item ${activePage === 'monitoring' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('monitoring'); }}>
        <Activity size={20} />
        <span>Monitoring</span>
      </a>
      <a href="#" className={`nav-item ${activePage === 'kontrol' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('kontrol'); }}>
        <Sliders size={20} />
        <span>Kontrol</span>
      </a>
      <a href="#" className={`nav-item ${activePage === 'analitik' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('analitik'); }}>
        <BarChart2 size={20} />
        <span>Analitik</span>
      </a>
      <a href="#" className={`nav-item ${activePage === 'notifikasi' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('notifikasi'); }}>
        <Bell size={20} />
        <span>Notifikasi</span>
      </a>
      <a href="#" className={`nav-item ${activePage === 'profil' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('profil'); }}>
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
);

// --- Header Component ---
const Header = ({ title, subtitle, actions, onBack }) => (
  <header className="header">
    <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
const DashboardContent = () => (
  <>
    <Header 
      title="Dashboard" 
      subtitle="Ringkasan kondisi kumbung Anda hari ini." 
      actions={
        <>
          <div className="kumbung-selector">
            <span>Semua Kumbung</span>
            <ChevronDown size={16} className="chevron-icon" />
          </div>
          <button className="icon-button notification-btn">
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
          <div className="stat-value">4</div>
          <div className="stat-status text-earth">Total</div>
        </div>
        <div className="stat-card minimal">
          <span className="stat-title">Kumbung Online <span className="stat-icon-mini text-sage">●</span></span>
          <div className="stat-value">3</div>
          <div className="stat-status text-sage">75%</div>
        </div>
        <div className="stat-card minimal">
          <span className="stat-title">Suhu Rata-rata</span>
          <div className="stat-value">28.6°C</div>
          <div className="stat-status text-sage">Normal</div>
        </div>
        <div className="stat-card minimal">
          <span className="stat-title">Kelembaban Rata-rata</span>
          <div className="stat-value">76%</div>
          <div className="stat-status text-sage">Normal</div>
        </div>
        <div className="stat-card minimal">
          <span className="stat-title">Alert Aktif</span>
          <div className="stat-value">2</div>
          <div className="stat-status text-earth">Peringatan</div>
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
            <div className="dropdown-small">Kumbung Utama <ChevronDown size={14}/></div>
          </div>
          
          <div className="stacked-charts">
            <div className="chart-row">
              <div className="chart-info">
                <span className="chart-label">Suhu</span>
                <div className="chart-current-value">28.6°C</div>
                <span className="chart-status text-sage">Normal</span>
              </div>
              <div className="chart-graph">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                    <defs>
                      <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6B8F71" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#6B8F71" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 10}} dy={15} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 10}} domain={[20, 32]} ticks={[24, 26, 28, 30]} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-sm)' }} />
                    <Area type="monotone" dataKey="temp" stroke="#6B8F71" strokeWidth={2} fillOpacity={1} fill="url(#colorTemp)" dot={{r: 3, fill: '#6B8F71', strokeWidth: 1, stroke: '#fff'}} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-divider"></div>

            <div className="chart-row">
              <div className="chart-info">
                <span className="chart-label">Kelembaban</span>
                <div className="chart-current-value">76%</div>
                <span className="chart-status text-sage">Normal</span>
              </div>
              <div className="chart-graph">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                    <defs>
                      <linearGradient id="colorHum" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4A90E2" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#4A90E2" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 10}} dy={15} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 10}} domain={[60, 90]} ticks={[60, 70, 80, 90]} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-sm)' }} />
                    <Area type="monotone" dataKey="hum" stroke="#4A90E2" strokeWidth={2} fillOpacity={1} fill="url(#colorHum)" dot={{r: 3, fill: '#4A90E2', strokeWidth: 1, stroke: '#fff'}} />
                  </AreaChart>
                </ResponsiveContainer>
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
              {latestKumbungs.map((dev, idx) => (
                <div className="device-item" key={idx}>
                  <div className="device-icon">
                    <Home size={16} />
                  </div>
                  <div className="device-info">
                    <h4>{dev.id}</h4>
                    <p>{dev.temp} | {dev.hum} | <span className={dev.status === 'Online' ? 'text-sage' : 'text-error'}>● {dev.status}</span></p>
                  </div>
                </div>
              ))}
            </div>
            <a href="#" className="view-all">Lihat Semua Kumbung</a>
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
              {notifications.slice(0,3).map((notif) => (
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
            </div>
            <a href="#" className="view-all">Lihat Semua Notifikasi</a>
          </motion.div>
        </div>
      </div>
    </div>
  </>
);

// --- 2. Kumbung Page Content ---
const KumbungContent = ({ setActivePage }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);

  const handleDeleteClick = (kumbung) => {
    setSelectedDevice(kumbung);
    setShowDeleteModal(true);
    setOpenMenu(null);
  };

  const handleDetailClick = (kumbung) => {
    setActivePage('monitoring');
    setOpenMenu(null);
  };

  return (
    <>
      <Header 
        title="Kumbung Saya" 
        subtitle="Kelola semua kumbung yang Anda miliki." 
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
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama Kumbung</th>
                <th>Lokasi</th>
                <th>ID Perangkat</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {kumbungList.map((k, idx) => (
                <tr key={idx}>
                  <td className="font-semibold">{k.name}</td>
                  <td className="text-muted">{k.location}</td>
                  <td className="text-muted">{k.device}</td>
                  <td>
                    <div className="status-badge">
                      <span className={`status-dot ${k.status === 'Online' ? 'bg-sage' : 'bg-error'}`}></span>
                      <span className={k.status === 'Online' ? 'text-sage' : 'text-error'}>{k.status}</span>
                    </div>
                  </td>
                  <td style={{ position: 'relative' }}>
                    <button className="action-button" onClick={() => setOpenMenu(openMenu === idx ? null : idx)}>
                      <MoreVertical size={18} />
                    </button>
                    {openMenu === idx && (
                      <div className="dropdown-menu" style={{ position: 'absolute', right: '40px', top: '10px', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: 'var(--shadow-md)', zIndex: 10, width: '150px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <button className="dropdown-item" style={{ padding: '12px 16px', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-primary)' }} onClick={() => handleDetailClick(k)}>
                          Detail Perangkat
                        </button>
                        <button className="dropdown-item text-error" style={{ padding: '12px 16px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--error-color)' }} onClick={() => handleDeleteClick(k)}>
                          Hapus Perangkat
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <input type="text" placeholder="Masukkan nama kumbung..." style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }} />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>ID Perangkat (Device ID)</label>
              <input type="text" placeholder="Misal: SS-005" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }} />
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Lokasi</label>
              <input type="text" placeholder="Lokasi Kumbung" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }} />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="secondary-button" onClick={() => setShowAddModal(false)}>Batal</button>
              <button className="primary-button" onClick={() => setShowAddModal(false)}>Simpan Kumbung</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Hapus Kumbung */}
      {showDeleteModal && selectedDevice && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <motion.div className="modal-content panel" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '400px', padding: '24px' }}>
            <h3 style={{ marginBottom: '8px', color: 'var(--error-color)' }}>Hapus Kumbung</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '24px' }}>
              Apakah Anda yakin ingin menghapus <strong>{selectedDevice.name}</strong> ({selectedDevice.device})? Semua pengaturan dan riwayat telemetri perangkat ini akan dihapus permanen.
            </p>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="secondary-button" onClick={() => setShowDeleteModal(false)}>Batal</button>
              <button className="primary-button" style={{ backgroundColor: 'var(--error-color)', borderColor: 'var(--error-color)', color: '#fff' }} onClick={() => setShowDeleteModal(false)}>Ya, Hapus</button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

// --- 3. Monitoring Content ---
const MonitoringContent = ({ setActivePage }) => {
  const [timeRange, setTimeRange] = useState('24 Jam');

  return (
    <>
      <Header 
        title="Monitoring - Kumbung Utama" 
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
            <div className="dropdown-small">Kumbung Utama <ChevronDown size={14}/></div>
          </div>
          <div className="toggle-group">
            {['24 Jam', '7 Hari', '30 Hari'].map(t => (
              <button 
                key={t} 
                className={`toggle-btn ${timeRange === t ? 'active' : ''}`}
                onClick={() => setTimeRange(t)}
              >
                {t}
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
              <div className="stat-value">28.6°C</div>
              <div className="stat-status text-sage font-semibold">Normal</div>
            </div>
          </div>

          <div className="stat-card minimal sensor-card-horizontal">
            <div className="sensor-icon-large bg-blue-light">
              <Droplets size={28} className="text-blue" />
            </div>
            <div className="sensor-card-content">
              <span className="stat-title">Kelembaban</span>
              <div className="stat-value">76%</div>
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
              <h3>Grafik Suhu & Kelembaban</h3>
            </div>
            
            <div className="chart-graph" style={{ height: '320px', marginTop: '16px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 12}} dy={10} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 12}} domain={[10, 40]} ticks={[10, 20, 30, 40]} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 12}} domain={[50, 100]} ticks={[50, 60, 70, 80, 90, 100]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)', backgroundColor: '#fff' }}
                    itemStyle={{ fontWeight: 600 }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '0.85rem', paddingTop: '10px' }} />
                  <Line yAxisId="left" name="Suhu (°C)" type="monotone" dataKey="temp" stroke="var(--earth-brown)" strokeWidth={3} dot={{r: 4, fill: 'var(--earth-brown)', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                  <Line yAxisId="right" name="Kelembaban (%)" type="monotone" dataKey="hum" stroke="#4A90E2" strokeWidth={3} dot={{r: 4, fill: '#4A90E2', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                </LineChart>
              </ResponsiveContainer>
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
                <span className="info-value font-semibold">Kumbung Utama</span>
              </div>
              <div className="info-item">
                <span className="info-label">ID Perangkat:</span>
                <span className="info-value text-muted">SS-1001</span>
              </div>
              <div className="info-item">
                <span className="info-label">Terakhir Online:</span>
                <span className="info-value text-muted">2 menit lalu</span>
              </div>
              <div className="info-item">
                <span className="info-label">Firmware:</span>
                <span className="info-value text-muted">v1.2.4</span>
              </div>
              <div className="info-item">
                <span className="info-label">Baterai / Daya:</span>
                <span className="info-value text-muted">AC Power</span>
              </div>
            </div>

            <button className="secondary-button" style={{ marginTop: 'auto' }}>
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
                  <div className="font-semibold" style={{ fontSize: '1.2rem' }}>OFF</div>
                </div>
             </div>
             <div className="stat-card minimal" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px' }}>
                <div className="sensor-icon-large bg-blue-light">
                  <Fan size={28} className="text-blue" />
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: '0.85rem' }}>Pompa Lantai</div>
                  <div className="font-semibold" style={{ fontSize: '1.2rem' }}>ON</div>
                </div>
             </div>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Kategori</th>
                <th>Aktivitas</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-muted">Hari ini, 13:45</td>
                <td className="font-semibold">Pompa Lantai</td>
                <td>Pompa diaktifkan (Siklus Timer)</td>
                <td><span className="text-sage font-semibold">ON</span></td>
              </tr>
              <tr>
                <td className="text-muted">Hari ini, 12:30</td>
                <td className="font-semibold">Pompa Kabut</td>
                <td>Suhu mencapai batas atas (29°C)</td>
                <td><span className="text-sage font-semibold">ON</span></td>
              </tr>
              <tr>
                <td className="text-muted">Hari ini, 12:00</td>
                <td className="font-semibold">Sistem</td>
                <td>Sinkronisasi parameter kontrol</td>
                <td><span className="text-sage font-semibold">OK</span></td>
              </tr>
            </tbody>
          </table>
          <button className="secondary-button" style={{ width: '100%', marginTop: '16px', justifyContent: 'center' }}>Lihat Riwayat Lengkap</button>
        </motion.div>
      </div>
    </>
  );
}

// --- 4. Analitik Content ---
const AnalitikContent = () => (
  <>
    <Header 
      title="Analitik Kumbung" 
      subtitle="Bandingkan performa dan kondisi antar kumbung Anda." 
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
          <div className="dropdown-small">Bulan Ini <ChevronDown size={14}/></div>
        </div>
      </motion.div>

      <motion.div 
        className="panel"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="panel-header">
          <h3>Perbandingan Rata-rata Suhu & Kelembaban</h3>
        </div>
        <div style={{ height: '400px', marginTop: '24px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analyticsData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)'}} dy={10} />
              <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)'}} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)'}} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} cursor={{fill: 'rgba(123, 94, 60, 0.05)'}} />
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

// --- 5. Notifikasi Content ---
const NotifikasiContent = () => {
  const [filter, setFilter] = useState('Semua');

  return (
    <>
      <Header 
        title="Pusat Notifikasi" 
        subtitle="Riwayat peringatan dan aktivitas sistem Anda." 
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
const ProfilContent = () => (
// ... Profil Content code is unmodified, jumping to the end of ProfilContent

  <>
    <Header 
      title="Profil Pengguna" 
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
const KontrolContent = () => {
  const [opMode, setOpMode] = useState(2); // 1=Manual, 2=Auto, 3=Schedule

  // Auto States
  const [minS, setMinS] = useState(26.0);
  const [midS, setMidS] = useState(28.0);
  const [minK, setMinK] = useState(80);
  const [midK, setMidK] = useState(90);

  // Manual States
  const [pumpOn, setPumpOn] = useState(false);
  const [fanOn, setFanOn] = useState(false);

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
  const [scheduleFreq, setScheduleFreq] = useState(3); // 1, 2, or 3 times a day

  return (
    <>
      <Header 
        title="Kontrol & Pengaturan" 
        subtitle="Konfigurasi logika aktuator berdasarkan spesifikasi firmware ESP32." 
      />
      
      <div className="page-content">
        <motion.div 
          className="filter-bar"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="filter-group">
            <span className="filter-label">Pilih Kumbung</span>
            <div className="dropdown-small">Kumbung Utama <ChevronDown size={14}/></div>
          </div>
        </motion.div>

        <motion.div 
          className="panel"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ marginBottom: '24px' }}
        >
          <div className="panel-header">
            <h3>Mode Operasi Sistem</h3>
          </div>
          <div className="mode-selector">
            <button className={`mode-btn ${opMode === 1 ? 'active' : ''}`} onClick={() => setOpMode(1)}>Mode Manual</button>
            <button className={`mode-btn ${opMode === 2 ? 'active' : ''}`} onClick={() => setOpMode(2)}>Mode Auto (Fuzzy)</button>
            <button className={`mode-btn ${opMode === 3 ? 'active' : ''}`} onClick={() => setOpMode(3)}>Mode Jadwal/Timer</button>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          key={opMode}
          transition={{ duration: 0.3 }}
        >
          {opMode === 1 && (
            <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="panel">
                <div className="panel-header">
                  <h3>Kontrol Manual Aktuator</h3>
                </div>
                <div className="actuator-list">
                  <div className="actuator-card">
                    <div className="actuator-info">
                      <div className={`actuator-icon ${fanOn ? 'active fan' : ''}`}><Fan size={24} /></div>
                      <div>
                        <h4>Pompa Lantai (Floor Pump)</h4>
                        <p className="text-muted">Mensirkulasi udara & menurunkan suhu.</p>
                      </div>
                    </div>
                    <div className={`toggle-switch large ${fanOn ? 'active' : ''}`} onClick={() => setFanOn(!fanOn)}></div>
                  </div>

                  <div className="actuator-card">
                    <div className="actuator-info">
                      <div className={`actuator-icon ${pumpOn ? 'active pump' : ''}`}><Droplet size={24} /></div>
                      <div>
                        <h4>Pompa Kabut (Mist Pump)</h4>
                        <p className="text-muted">Meningkatkan kelembaban ruang.</p>
                      </div>
                    </div>
                    <div className={`toggle-switch large ${pumpOn ? 'active' : ''}`} onClick={() => setPumpOn(!pumpOn)}></div>
                  </div>
                </div>
                <div className="info-alert" style={{ marginTop: '24px', padding: '16px' }}>
                  <Info size={20} className="info-icon" style={{ marginTop: '0' }} />
                  <p style={{ fontSize: '0.85rem' }}>Dalam Mode Manual, pembacaan sensor SHT20 hanya berfungsi sebagai monitoring dan tidak mempengaruhi status aktuator.</p>
                </div>
              </div>
            </div>
          )}

          {opMode === 2 && (
            <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="panel">
                <div className="panel-header">
                  <h3>SetPoint Suhu (°C)</h3>
                </div>
                
                <div className="control-group">
                  <div className="control-header">
                    <span className="control-label">Min Suhu (MinS)</span>
                    <span className="control-value">{minS.toFixed(1)} °C</span>
                  </div>
                  <input type="range" className="control-slider temp-slider" min="20" max="35" step="0.1" value={minS} onChange={(e) => setMinS(parseFloat(e.target.value))} />
                </div>

                <div className="control-group" style={{ marginTop: '24px' }}>
                  <div className="control-header">
                    <span className="control-label">Mid Suhu (MidS)</span>
                    <span className="control-value">{midS.toFixed(1)} °C</span>
                  </div>
                  <input type="range" className="control-slider temp-slider" min="20" max="35" step="0.1" value={midS} onChange={(e) => setMidS(parseFloat(e.target.value))} />
                </div>
                <button className="primary-button outline" style={{ marginTop: '24px', width: '100%', justifyContent: 'center' }}>Simpan Parameter Suhu</button>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h3>SetPoint Kelembaban (%)</h3>
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
                <button className="primary-button outline" style={{ marginTop: '24px', width: '100%', justifyContent: 'center' }}>Simpan Parameter Kelembaban</button>
              </div>
            </div>
          )}

          {opMode === 3 && (
            <>
              <motion.div className="panel" style={{ marginBottom: '24px' }}>
                <div className="panel-header">
                  <h3>Frekuensi Penyiraman Harian</h3>
                </div>
                <div className="toggle-group" style={{ width: '100%', display: 'flex' }}>
                  <button className={`toggle-btn ${scheduleFreq === 1 ? 'active' : ''}`} style={{flex: 1}} onClick={() => setScheduleFreq(1)}>1x Sehari</button>
                  <button className={`toggle-btn ${scheduleFreq === 2 ? 'active' : ''}`} style={{flex: 1}} onClick={() => setScheduleFreq(2)}>2x Sehari</button>
                  <button className={`toggle-btn ${scheduleFreq === 3 ? 'active' : ''}`} style={{flex: 1}} onClick={() => setScheduleFreq(3)}>3x Sehari</button>
                </div>
                <button className="primary-button outline" style={{ width: '100%', justifyContent: 'center', marginTop: '20px' }}>Simpan Jadwal</button>
              </motion.div>

              <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                
                {/* Kolom Kiri: Pompa Kabut */}
                <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="panel-header">
                    <h3>Pengaturan Pompa Kabut</h3>
                  </div>

                  <div className="control-section" style={{ marginTop: '8px' }}>
                    <h4 style={{ fontSize: '0.95rem', marginBottom: '16px' }}>Siklus Timer</h4>
                    <div className="time-inputs" style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                      <div className="input-group" style={{ flex: 1 }}>
                        <label className="filter-label" style={{ display: 'block', marginBottom: '8px' }}>Menit</label>
                        <input type="number" min="0" max="59" value={timerMenit} onChange={(e) => setTimerMenit(parseInt(e.target.value))} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }} />
                      </div>
                      <div className="input-group" style={{ flex: 1 }}>
                        <label className="filter-label" style={{ display: 'block', marginBottom: '8px' }}>Detik</label>
                        <input type="number" min="0" max="59" value={timerDetik} onChange={(e) => setTimerDetik(parseInt(e.target.value))} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }} />
                      </div>
                    </div>
                  </div>
                  <button className="primary-button outline" style={{ width: '100%', justifyContent: 'center', marginTop: '12px' }}>Simpan Timer Kabut</button>

                  <div className="control-section" style={{ marginTop: '16px', paddingTop: '24px', borderTop: '1px dashed var(--border-color)' }}>
                    <h4 style={{ fontSize: '0.95rem', marginBottom: '16px' }}>Jadwal Penyiraman RTC</h4>
                    
                    <div className="slot-item" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                      <span className="font-semibold" style={{ width: '64px' }}>Jadwal 1</span>
                      <input type="number" min="0" max="23" value={jam1} onChange={(e) => setJam1(parseInt(e.target.value))} style={{ width: '80px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }} />
                      <span className="font-semibold">:</span>
                      <input type="number" min="0" max="59" value={menit1} onChange={(e) => setMenit1(parseInt(e.target.value))} style={{ width: '80px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }} />
                    </div>

                    <div className="slot-item" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', opacity: scheduleFreq >= 2 ? 1 : 0.4, pointerEvents: scheduleFreq >= 2 ? 'auto' : 'none' }}>
                      <span className="font-semibold" style={{ width: '64px' }}>Jadwal 2</span>
                      <input type="number" min="0" max="23" value={jam2} onChange={(e) => setJam2(parseInt(e.target.value))} style={{ width: '80px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }} />
                      <span className="font-semibold">:</span>
                      <input type="number" min="0" max="59" value={menit2} onChange={(e) => setMenit2(parseInt(e.target.value))} style={{ width: '80px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }} />
                    </div>

                    <div className="slot-item" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', opacity: scheduleFreq === 3 ? 1 : 0.4, pointerEvents: scheduleFreq === 3 ? 'auto' : 'none' }}>
                      <span className="font-semibold" style={{ width: '64px' }}>Jadwal 3</span>
                      <input type="number" min="0" max="23" value={jam3} onChange={(e) => setJam3(parseInt(e.target.value))} style={{ width: '80px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }} />
                      <span className="font-semibold">:</span>
                      <input type="number" min="0" max="59" value={menit3} onChange={(e) => setMenit3(parseInt(e.target.value))} style={{ width: '80px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }} />
                    </div>
                  </div>
                  <button className="primary-button outline" style={{ width: '100%', justifyContent: 'center', marginTop: '12px' }}>Simpan Jadwal Kabut</button>
                </div>

                {/* Kolom Kanan: Pompa Lantai */}
                <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="panel-header">
                    <h3>Pengaturan Pompa Lantai</h3>
                  </div>

                  <div className="control-section" style={{ marginTop: '8px' }}>
                    <h4 style={{ fontSize: '0.95rem', marginBottom: '16px' }}>Siklus Timer</h4>
                    <div className="time-inputs" style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                      <div className="input-group" style={{ flex: 1 }}>
                        <label className="filter-label" style={{ display: 'block', marginBottom: '8px' }}>FlrMenit</label>
                        <input type="number" min="0" max="59" value={flrMenit} onChange={(e) => setFlrMenit(parseInt(e.target.value))} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }} />
                      </div>
                      <div className="input-group" style={{ flex: 1 }}>
                        <label className="filter-label" style={{ display: 'block', marginBottom: '8px' }}>FlrDetik</label>
                        <input type="number" min="0" max="59" value={flrDetik} onChange={(e) => setFlrDetik(parseInt(e.target.value))} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }} />
                      </div>
                    </div>
                  </div>
                  <button className="primary-button outline" style={{ width: '100%', justifyContent: 'center', marginTop: '12px' }}>Simpan Timer Lantai</button>

                  <div className="control-section" style={{ marginTop: '16px', paddingTop: '24px', borderTop: '1px dashed var(--border-color)' }}>
                    <h4 style={{ fontSize: '0.95rem', marginBottom: '8px' }}>Jadwal Penyiraman RTC</h4>
                    <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '16px' }}>(Maksimal 1 Jadwal)</p>
                    
                    <div className="slot-item" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                      <span className="font-semibold" style={{ width: '64px' }}>Jadwal 1</span>
                      <input type="number" min="0" max="23" value={flrJam1} onChange={(e) => setFlrJam1(parseInt(e.target.value))} style={{ width: '80px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }} />
                      <span className="font-semibold">:</span>
                      <input type="number" min="0" max="59" value={flrMenit1} onChange={(e) => setFlrMenit1(parseInt(e.target.value))} style={{ width: '80px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }} />
                    </div>
                  </div>
                  <button className="primary-button outline" style={{ width: '100%', justifyContent: 'center', marginTop: '12px' }}>Simpan Jadwal Lantai</button>
                </div>
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
  const [activePage, setActivePage] = useState('kontrol');

  return (
    <div className="app-container">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <main className="main-content">
        {activePage === 'dashboard' && <DashboardContent />}
        {activePage === 'kumbung' && <KumbungContent setActivePage={setActivePage} />}
        {activePage === 'monitoring' && <MonitoringContent setActivePage={setActivePage} />}
        {activePage === 'kontrol' && <KontrolContent />}
        {activePage === 'analitik' && <AnalitikContent />}
        {activePage === 'notifikasi' && <NotifikasiContent />}
        {activePage === 'profil' && <ProfilContent />}
      </main>
    </div>
  );
}

export default App;
