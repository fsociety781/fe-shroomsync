import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  X,
  Shield,
  Link,
  Unlink,
  Edit3,
  Menu,
  Download,
  MessageSquare,
  QrCode,
  Trash2,
  Terminal,
  ChevronRight,
} from 'lucide-react';
import api from '../services/api';
import DeviceBarcodeStickerModal from './DeviceBarcodeStickerModal';
import ConfirmModal from './ConfirmModal';
import './TechnicianDashboard.css';
import './AdminDashboard.css';

export default function AdminDashboard({
  onMenuToggle,
  currentUser,
  activeTab: controlledTab,
  onTabChange,
}) {
  const [internalTab, setInternalTab] = useState('dashboard');
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [farmers, setFarmers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deviceSearchQuery, setDeviceSearchQuery] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('ALL'); // 'ALL' | 'ASSIGNED' | 'UNASSIGNED'
  const [toast, setToast] = useState(null);
  const [stickerDevice, setStickerDevice] = useState(null);

  // Modals state
  const [showAddFarmerModal, setShowAddFarmerModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditFarmerModal, setShowEditFarmerModal] = useState(false);
  const [editingFarmer, setEditingFarmer] = useState(null);
  const [unassignTargetDevice, setUnassignTargetDevice] = useState(null);
  const [isUnassigning, setIsUnassigning] = useState(false);
  const [deleteTargetFarmer, setDeleteTargetFarmer] = useState(null);
  const [isDeletingFarmer, setIsDeletingFarmer] = useState(false);

  // Forms
  const [farmerForm, setFarmerForm] = useState({
    fullName: '',
    phoneNumber: '',
    email: '',
    password: 'PasswordDefault123!',
  });

  const [editFarmerForm, setEditFarmerForm] = useState({
    fullName: '',
    phoneNumber: '',
    email: '',
    farmName: '',
    farmAddress: '',
    status: 'ACTIVE',
  });

  const [assignForm, setAssignForm] = useState({
    deviceId: '',
    farmerId: '',
  });

  const showNotification = (message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4000);
  };

  // Load admin dashboard, farmers, and devices
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [dashRes, farmersRes, devRes] = await Promise.allSettled([
        api.admin.getDashboard(),
        api.admin.getFarmers({ limit: 50 }),
        api.devices.list(100),
      ]);

      if (dashRes.status === 'fulfilled') {
        setDashboardData(dashRes.value);
      }
      if (farmersRes.status === 'fulfilled') {
        const list = farmersRes.value?.farmers || (Array.isArray(farmersRes.value) ? farmersRes.value : []);
        setFarmers(list);
      }
      if (devRes.status === 'fulfilled') {
        const devList = Array.isArray(devRes.value) ? devRes.value : [];
        setDevices(devList);
      }
    } catch (err) {
      console.error('[AdminDashboard] Load data failed:', err);
      showNotification(err.getUserMessage?.() || err.message || 'Gagal memuat data administrator', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (!cancelled) {
          await loadData();
        }
      } catch {
        // Handled inside loadData
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [loadData]);

  // Dynamic device counts
  const assignedCount = useMemo(() => {
    if (dashboardData?.assignedDevices !== undefined) return dashboardData.assignedDevices;
    return devices.filter((d) => {
      const assignedFarmer = farmers.find((f) =>
        (f.id && (f.id === d.userId || f.id === d.farmerId)) ||
        f.devices?.some((dev) => (dev.deviceId || dev.serialNumber || dev.id) === (d.deviceId || d.serialNumber || d.id))
      );
      return Boolean(assignedFarmer || d.userId || d.farmerId || d.farmer || d.assignedFarmer || d.ownerName);
    }).length;
  }, [dashboardData, devices, farmers]);

  const unassignedCount = useMemo(() => {
    if (dashboardData?.unassignedDevices !== undefined) return dashboardData.unassignedDevices;
    return Math.max(0, devices.length - assignedCount);
  }, [dashboardData, devices, assignedCount]);

  // Filter farmers by search
  const filteredFarmers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return farmers;
    return farmers.filter((f) => {
      return (
        (f.fullName && f.fullName.toLowerCase().includes(q)) ||
        (f.phoneNumber && f.phoneNumber.includes(q)) ||
        (f.farmName && f.farmName.toLowerCase().includes(q)) ||
        (f.farmAddress && f.farmAddress.toLowerCase().includes(q))
      );
    });
  }, [farmers, searchQuery]);

  // Filter devices by status and search query
  const filteredDevices = useMemo(() => {
    let list = devices;
    if (deviceFilter === 'ASSIGNED') {
      list = list.filter((d) => {
        const assignedFarmer = farmers.find((f) =>
          (f.id && (f.id === d.userId || f.id === d.farmerId)) ||
          f.devices?.some((dev) => (dev.deviceId || dev.serialNumber || dev.id) === (d.deviceId || d.serialNumber || d.id))
        );
        return Boolean(assignedFarmer || d.userId || d.farmerId || d.farmer || d.assignedFarmer || d.ownerName);
      });
    } else if (deviceFilter === 'UNASSIGNED') {
      list = list.filter((d) => {
        const assignedFarmer = farmers.find((f) =>
          (f.id && (f.id === d.userId || f.id === d.farmerId)) ||
          f.devices?.some((dev) => (dev.deviceId || dev.serialNumber || dev.id) === (d.deviceId || d.serialNumber || d.id))
        );
        return !Boolean(assignedFarmer || d.userId || d.farmerId || d.farmer || d.assignedFarmer || d.ownerName);
      });
    }

    const q = deviceSearchQuery.toLowerCase().trim();
    if (!q) return list;

    return list.filter((d) => {
      const sn = (d.deviceId || d.serialNumber || d.id || '').toLowerCase();
      const name = (d.name || '').toLowerCase();
      const farmer = farmers.find((f) =>
        (f.id && (f.id === d.userId || f.id === d.farmerId)) ||
        f.devices?.some((dev) => (dev.deviceId || dev.serialNumber || dev.id) === (d.deviceId || d.serialNumber || d.id))
      );
      const farmerName = (farmer?.fullName || d.farmer?.fullName || d.assignedFarmer || '').toLowerCase();
      return sn.includes(q) || name.includes(q) || farmerName.includes(q);
    });
  }, [devices, farmers, deviceFilter, deviceSearchQuery]);

  // Submit Create Farmer
  const handleCreateFarmer = async (e) => {
    e?.preventDefault();
    if (!farmerForm.fullName || !farmerForm.phoneNumber || !farmerForm.password) {
      showNotification('Nama lengkap, nomor telepon, dan kata sandi wajib diisi!', 'warning');
      return;
    }

    try {
      setLoading(true);
      const result = await api.admin.createFarmer({
        fullName: farmerForm.fullName.trim(),
        phoneNumber: farmerForm.phoneNumber.trim(),
        email: farmerForm.email?.trim() || undefined,
        password: farmerForm.password,
      });
      showNotification(`✓ Akun petani ${result.fullName || farmerForm.fullName} berhasil didaftarkan! Detail profil akan diisi langsung oleh Petani saat onboarding.`, 'success');
      setShowAddFarmerModal(false);
      setFarmerForm({
        fullName: '',
        phoneNumber: '',
        email: '',
        password: 'PasswordDefault123!',
      });
      loadData();
    } catch (err) {
      showNotification(err.getUserMessage?.() || err.message || 'Gagal mendaftarkan petani', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Open Edit Farmer Modal
  const handleOpenEditFarmer = (farmer) => {
    setEditingFarmer(farmer);
    setEditFarmerForm({
      fullName: farmer.fullName || '',
      phoneNumber: farmer.phoneNumber || '',
      email: farmer.email || '',
      farmName: farmer.farmName || '',
      farmAddress: farmer.farmAddress || '',
      status: farmer.status || 'ACTIVE',
    });
    setShowEditFarmerModal(true);
  };

  // Submit Save Edit Farmer
  const handleSaveEditFarmer = async (e) => {
    e?.preventDefault();
    if (!editingFarmer) return;
    try {
      setLoading(true);
      await api.admin.updateFarmer(editingFarmer.id, editFarmerForm);
      showNotification(`✓ Data petani ${editFarmerForm.fullName} berhasil diperbarui!`, 'success');
      setShowEditFarmerModal(false);
      loadData();
    } catch (err) {
      showNotification(err.getUserMessage?.() || err.message || 'Gagal memperbarui profil petani', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Open Delete Farmer Modal
  const handleOpenDeleteModal = (farmer) => {
    setDeleteTargetFarmer(farmer);
  };

  // Confirm Delete Farmer
  const handleConfirmDeleteFarmer = async () => {
    if (!deleteTargetFarmer) return;

    try {
      setIsDeletingFarmer(true);
      await api.admin.deleteFarmer(deleteTargetFarmer.id);
      showNotification(`✓ Akun petani ${deleteTargetFarmer.fullName || deleteTargetFarmer.phoneNumber} berhasil dihapus.`, 'success');
      setDeleteTargetFarmer(null);
      loadData();
    } catch (err) {
      showNotification(err.getUserMessage?.() || err.message || 'Gagal menghapus akun petani', 'error');
    } finally {
      setIsDeletingFarmer(false);
    }
  };

  // Submit Assign Device
  const handleAssignDevice = async (e) => {
    e?.preventDefault();
    if (!assignForm.deviceId || !assignForm.farmerId) {
      showNotification('Pilih unit SupaKu dan Petani yang ditugaskan!', 'warning');
      return;
    }

    try {
      setLoading(true);
      await api.admin.assignDevice(assignForm.deviceId, assignForm.farmerId);
      showNotification(`✓ Unit SupaKu ${assignForm.deviceId} berhasil ditugaskan!`, 'success');
      setShowAssignModal(false);
      setAssignForm({ deviceId: '', farmerId: '' });
      loadData();
    } catch (err) {
      showNotification(err.getUserMessage?.() || err.message || 'Gagal menugaskan alat', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Unassign Device Trigger
  const handleOpenUnassignModal = (deviceId) => {
    setUnassignTargetDevice(deviceId);
  };

  // Confirm Unassign Device
  const handleConfirmUnassignDevice = async () => {
    if (!unassignTargetDevice) return;

    try {
      setIsUnassigning(true);
      await api.admin.unassignDevice(unassignTargetDevice);
      showNotification(`✓ SupaKu ${unassignTargetDevice} berhasil dilepas dari petani.`, 'success');
      setUnassignTargetDevice(null);
      loadData();
    } catch (err) {
      showNotification(err.getUserMessage?.() || err.message || 'Gagal melepas penugasan', 'error');
    } finally {
      setIsUnassigning(false);
    }
  };

  // Export Roster Petani ke CSV
  const handleExportFarmersCSV = () => {
    if (farmers.length === 0) {
      showNotification('Belum ada data petani binaan untuk diekspor.', 'warning');
      return;
    }
    const headers = ['ID', 'Nama Lengkap', 'Username', 'Telepon', 'Email', 'Nama Kumbung', 'Alamat Kumbung', 'Status', 'Jumlah SupaKu Ditugaskan'];
    const rows = farmers.map((f) => [
      `"${f.id || ''}"`,
      `"${f.fullName || ''}"`,
      `"${f.username || ''}"`,
      `"${f.phoneNumber || ''}"`,
      `"${f.email || ''}"`,
      `"${f.farmName || ''}"`,
      `"${f.farmAddress || ''}"`,
      `"${f.status || ''}"`,
      `"${f.devices?.length || f.deviceCount || 0}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `shroomsync_petani_binaan_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('✓ Berkas CSV Daftar Petani Binaan berhasil diunduh.', 'success');
  };

  return (
    <div className="admin-portal" style={{ padding: '0 0 40px 0', minHeight: '100%' }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            padding: '12px 20px',
            borderRadius: '10px',
            backgroundColor: toast.type === 'error' ? '#ef4444' : (toast.type === 'warning' ? '#f59e0b' : '#10b981'),
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.88rem',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          1. TOP BREADCRUMB & STATUS BAR
      ───────────────────────────────────────────────────────────── */}
      <div className="tech-top-banner">
        <div className="tech-breadcrumb">
          <Terminal size={13} style={{ opacity: 0.8 }} />
          <span>Admin Panel</span>
          <ChevronRight size={10} style={{ opacity: 0.5 }} />
          <span className="active-crumb">
            {activeTab === 'dashboard' ? 'Dashboard Wilayah' : activeTab === 'farmers' ? 'Daftar Petani Binaan' : 'Penugasan SupaKu'}
          </span>
        </div>
        <div className="tech-server-status">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="tech-pulse-dot" />
            <span>Wilayah: {currentUser?.region || 'Jawa Barat (Lembang)'}</span>
          </span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={13} style={{ color: '#86efac' }} />
            <span>{farmers.length} Petani Terdaftar</span>
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. HEADER WITH TITLE & PRIMARY ACTIONS
      ───────────────────────────────────────────────────────────── */}
      <header className="tech-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {onMenuToggle && (
            <button
              onClick={onMenuToggle}
              className="mobile-menu-toggle"
              style={{
                background: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: '10px',
                padding: '8px',
                color: '#374151',
                cursor: 'pointer',
              }}
              aria-label="Toggle menu"
            >
              <Menu size={20} />
            </button>
          )}
          <div>
            <h1 className="tech-header-title">Portal Administrator Regional</h1>
            <p className="tech-header-subtitle">
              Sesi: <strong style={{ color: '#111827' }}>{currentUser?.fullName || currentUser?.name || 'Admin Wilayah Lembang'}</strong> • Manajemen Petani Binaan & Penugasan SupaKu
            </p>
          </div>
        </div>

        <div className="tech-header-actions">
          <button
            type="button"
            className="tech-btn-secondary"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="tech-btn-primary"
            onClick={() => setShowAddFarmerModal(true)}
          >
            <UserPlus size={15} />
            <span>Daftarkan Petani Baru</span>
          </button>
        </div>
      </header>

      {/* Main Page Content */}
      <div className="tech-content-body">
        {/* Overview Stat Cards - Aligned with Modern Dashboard Minimal Cards */}
        <div className="stats-row">
          <div className="stat-card minimal">
            <span className="stat-title">
              Petani Binaan <Users size={14} className="text-sage" />
            </span>
            <div className="stat-value">{dashboardData?.totalFarmers ?? farmers.length}</div>
            <div className="stat-status text-sage">Wilayah binaan regional</div>
          </div>

          <div className="stat-card minimal">
            <span className="stat-title">
              Total SupaKu <Cpu size={14} className="text-earth" />
            </span>
            <div className="stat-value">{dashboardData?.totalDevices ?? devices.length}</div>
            <div className="stat-status text-earth">Alat fisik terdaftar di wilayah</div>
          </div>

          <div className="stat-card minimal">
            <span className="stat-title">
              SupaKu Ditugaskan <Link size={14} className="text-sage" />
            </span>
            <div className="stat-value">{assignedCount}</div>
            <div className="stat-status text-sage">Aktif dioperasikan oleh petani</div>
          </div>

          <div className="stat-card minimal">
            <span className="stat-title">
              Tersedia di Gudang <Cpu size={14} className="text-earth" />
            </span>
            <div className="stat-value">{unassignedCount}</div>
            <div className="stat-status text-earth">Siap ditugaskan ke petani baru</div>
          </div>
        </div>

        {/* Tab Navigation - Standard ShroomSync Portal Tabs */}
        <div className="portal-tabs">
          <button
            type="button"
            className={`portal-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard Wilayah</span>
          </button>

          <button
            type="button"
            className={`portal-tab-btn ${activeTab === 'farmers' ? 'active' : ''}`}
            onClick={() => setActiveTab('farmers')}
          >
            <Users size={16} />
            <span>Daftar Petani Binaan</span>
            <span className="portal-tab-badge">
              {farmers.length}
            </span>
          </button>

          <button
            type="button"
            className={`portal-tab-btn ${activeTab === 'assignment' ? 'active' : ''}`}
            onClick={() => setActiveTab('assignment')}
          >
            <Link size={16} />
            <span>Penugasan SupaKu ke Petani</span>
            <span className="portal-tab-badge">
              {devices.length}
            </span>
          </button>
        </div>

        {/* TAB 0: DASHBOARD WILAYAH OVERVIEW */}
        {activeTab === 'dashboard' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <div className="admin-dashboard-grid">
              {/* Left Column: Device Utilization & Recent Farmers (8 cols) */}
              <div className="admin-grid-main">
                <div className="portal-table-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#111827' }}>
                        Pemanfaatan SupaKu Wilayah
                      </h3>
                      <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#6B7280' }}>
                        Rasio unit fisik yang beroperasi di wilayah {currentUser?.region || 'Jawa Barat (Lembang)'}.
                      </p>
                    </div>
                    <span className="tech-badge-active" style={{ fontSize: '0.75rem', padding: '4px 12px' }}>
                      {devices.length > 0 ? Math.round((assignedCount / devices.length) * 100) : 100}% Ditugaskan
                    </span>
                  </div>

                  {/* Progress Bar & Breakdown */}
                  <div style={{ marginBottom: '22px' }}>
                    <div style={{ display: 'flex', height: '14px', borderRadius: '999px', overflow: 'hidden', backgroundColor: '#F3F4F6' }}>
                      <div
                        style={{
                          width: `${devices.length > 0 ? (assignedCount / devices.length) * 100 : 0}%`,
                          backgroundColor: '#7B5E3C',
                          transition: 'width 0.5s ease',
                        }}
                        title={`Ditugaskan: ${assignedCount} unit`}
                      />
                      <div
                        style={{
                          width: `${devices.length > 0 ? (unassignedCount / devices.length) * 100 : 0}%`,
                          backgroundColor: '#E7DCC5',
                          transition: 'width 0.5s ease',
                        }}
                        title={`Tersedia di Gudang: ${unassignedCount} unit`}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '0.82rem', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#7B5E3C' }} />
                        <span style={{ color: '#4B5563', fontWeight: 600 }}>Ditugaskan ke Petani:</span>
                        <strong style={{ color: '#111827' }}>{assignedCount} Unit</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#E7DCC5' }} />
                        <span style={{ color: '#4B5563', fontWeight: 600 }}>Tersedia di Gudang:</span>
                        <strong style={{ color: '#111827' }}>{unassignedCount} Unit</strong>
                      </div>
                    </div>
                  </div>

                  {/* Farmer Roster Preview */}
                  <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#374151' }}>
                        Ringkasan Petani Binaan ({farmers.length})
                      </h4>
                      <button
                        type="button"
                        onClick={() => setActiveTab('farmers')}
                        style={{ background: 'none', border: 'none', color: '#7B5E3C', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <span>Buka Roster Lengkap</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {farmers.slice(0, 4).map((f) => (
                        <div
                          key={f.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 14px',
                            borderRadius: '12px',
                            backgroundColor: '#FAFAFA',
                            border: '1px solid #F3F4F6',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="admin-farmer-avatar" style={{ width: '36px', height: '36px', fontSize: '0.85rem' }}>
                              {f.fullName?.charAt(0)?.toUpperCase() || 'P'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#111827' }}>{f.fullName}</div>
                              <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{f.farmName || 'Kumbung Binaan'} • {f.phoneNumber}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className="admin-device-chip" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                              {f.devices?.length || 0} Unit SupaKu
                            </span>
                            <span className={f.status === 'ACTIVE' ? 'tech-badge-active' : 'tech-badge-warning'} style={{ fontSize: '9px' }}>
                              {f.status === 'ACTIVE' ? 'Aktif' : 'Menunggu'}
                            </span>
                          </div>
                        </div>
                      ))}
                      {farmers.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF', fontSize: '0.84rem' }}>
                          Belum ada petani binaan terdaftar di wilayah ini.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Quick Actions & Regional Node Status (4 cols) */}
              <div className="admin-grid-side">
                {/* Quick Actions Panel */}
                <div className="portal-table-panel" style={{ padding: '22px' }}>
                  <h3 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: 800, color: '#111827' }}>
                    Aksi Cepat Wilayah
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button
                      type="button"
                      className="tech-btn-primary"
                      onClick={() => setShowAddFarmerModal(true)}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <UserPlus size={15} />
                      <span>+ Daftarkan Petani Baru</span>
                    </button>

                    <button
                      type="button"
                      className="tech-btn-secondary"
                      onClick={() => {
                        setAssignForm({ deviceId: '', farmerId: '' });
                        setShowAssignModal(true);
                      }}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <Link size={15} />
                      <span>+ Buat Penugasan SupaKu</span>
                    </button>

                    <button
                      type="button"
                      className="tech-btn-secondary"
                      onClick={handleExportFarmersCSV}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <Download size={14} />
                      <span>Ekspor CSV Petani</span>
                    </button>
                  </div>
                </div>

                {/* Regional Node Status */}
                <div className="portal-table-panel" style={{ padding: '22px', backgroundColor: '#FDFBF7', border: '1px solid rgba(231, 220, 197, 0.6)' }}>
                  <h3 style={{ margin: '0 0 14px 0', fontSize: '0.9rem', fontWeight: 800, color: '#7B5E3C', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={16} />
                    <span>Simpul Regional ShroomSync</span>
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(231, 220, 197, 0.6)', paddingBottom: '8px' }}>
                      <span style={{ color: '#6B7280' }}>Wilayah Kerja:</span>
                      <strong style={{ color: '#111827' }}>{currentUser?.region || 'Lembang, Jawa Barat'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(231, 220, 197, 0.6)', paddingBottom: '8px' }}>
                      <span style={{ color: '#6B7280' }}>Admin Bertugas:</span>
                      <strong style={{ color: '#111827' }}>{currentUser?.fullName || currentUser?.username || 'Admin'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(231, 220, 197, 0.6)', paddingBottom: '8px' }}>
                      <span style={{ color: '#6B7280' }}>Koneksi Server:</span>
                      <span className="tech-badge-active" style={{ fontSize: '9px', padding: '2px 8px' }}>OPERASIONAL</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6B7280' }}>Versi Panel:</span>
                      <strong style={{ color: '#7B5E3C', fontFamily: 'monospace' }}>v2.4.0 (Regional)</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 1: DAFTAR PETANI BINAAN */}
        {activeTab === 'farmers' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <div className="portal-table-panel">
              {/* Toolbar */}
              <div className="portal-toolbar">
                <div className="admin-search-box">
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Cari nama petani, kontak, atau kumbung..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="clear-btn"
                      onClick={() => setSearchQuery('')}
                      title="Hapus pencarian"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="tech-btn-secondary"
                    onClick={handleExportFarmersCSV}
                  >
                    <Download size={14} />
                    <span>Ekspor CSV</span>
                  </button>
                  <button
                    type="button"
                    className="tech-btn-primary"
                    onClick={() => setShowAddFarmerModal(true)}
                  >
                    <UserPlus size={14} />
                    <span>+ Tambah Petani Binaan</span>
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="table-wrapper">
                <table className="tech-table responsive-table">
                  <thead>
                    <tr>
                      <th>Petani & Kumbung</th>
                      <th>Kontak & Alamat</th>
                      <th>Unit SupaKu Ditugaskan</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th style={{ textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFarmers.map((farmer) => (
                      <tr key={farmer.id}>
                        <td data-label="Petani">
                          <div className="admin-farmer-cell">
                            <div className="admin-farmer-avatar">
                              {farmer.fullName?.charAt(0)?.toUpperCase() || 'P'}
                            </div>
                            <div>
                              <div className="admin-farmer-name">{farmer.fullName}</div>
                              <div className="admin-farmer-sub">{farmer.farmName || 'Kumbung Jamur Binaan'}</div>
                            </div>
                          </div>
                        </td>
                        <td data-label="Kontak">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.82rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 700, color: '#111827' }}>{farmer.phoneNumber}</span>
                              {farmer.phoneNumber && (
                                <a
                                  href={`https://wa.me/${farmer.phoneNumber.replace(/[^0-9]/g, '')}?text=Halo%20${encodeURIComponent(farmer.fullName)},%20kami%20dari%20Admin%20Regional%20ShroomSync`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="wa-quick-btn"
                                  title="Chat via WhatsApp"
                                >
                                  <MessageSquare size={11} />
                                  <span>WA</span>
                                </a>
                              )}
                            </div>
                            {farmer.farmAddress && (
                              <span className="admin-farmer-sub">{farmer.farmAddress}</span>
                            )}
                          </div>
                        </td>
                        <td data-label="Unit SupaKu">
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {farmer.devices && farmer.devices.length > 0 ? (
                              farmer.devices.map((d) => (
                                <span
                                  key={d.deviceId || d.id}
                                  className="admin-device-chip"
                                >
                                  <span className={`chip-dot ${d.isOnline ? 'online' : 'offline'}`} />
                                  <span>{d.deviceId || d.id}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenUnassignModal(d.deviceId || d.id);
                                    }}
                                    title="Lepas tautan unit dari petani ini"
                                    className="chip-unlink"
                                  >
                                    <X size={12} />
                                  </button>
                                </span>
                              ))
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: '#9CA3AF', fontStyle: 'italic' }}>
                                Belum ada unit ditugaskan
                              </span>
                            )}
                          </div>
                        </td>
                        <td data-label="Status" style={{ textAlign: 'center' }}>
                          <span className={farmer.status === 'ACTIVE' ? 'tech-badge-active' : 'tech-badge-warning'}>
                            {farmer.status === 'ACTIVE' ? 'Aktif' : 'Menunggu'}
                          </span>
                        </td>
                        <td data-label="Aksi" style={{ textAlign: 'center' }}>
                          <div className="admin-table-actions">
                            <button
                              type="button"
                              className="admin-btn-assign"
                              onClick={() => {
                                setAssignForm({ deviceId: '', farmerId: farmer.id });
                                setShowAssignModal(true);
                              }}
                              title="Tugaskan unit SupaKu ke petani ini"
                            >
                              <Link size={13} />
                              <span>Tugaskan</span>
                            </button>
                            <button
                              type="button"
                              className="admin-btn-edit"
                              onClick={() => handleOpenEditFarmer(farmer)}
                              title="Edit Profil Petani"
                            >
                              <Edit3 size={13} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              className="admin-btn-danger"
                              onClick={() => handleOpenDeleteModal(farmer)}
                              title="Hapus Akun Petani"
                            >
                              <Trash2 size={13} />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredFarmers.length === 0 && (
                      <tr>
                        <td colSpan={5}>
                          <div className="admin-empty-state">
                            <div className="admin-empty-icon">
                              <Users size={24} />
                            </div>
                            <p style={{ margin: 0, fontWeight: 700, color: '#374151' }}>
                              {searchQuery ? 'Tidak ada petani yang cocok dengan kata kunci pencarian.' : 'Belum ada petani binaan terdaftar.'}
                            </p>
                            {searchQuery ? (
                              <button
                                type="button"
                                className="tech-btn-secondary"
                                onClick={() => setSearchQuery('')}
                                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                              >
                                Reset Pencarian
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="tech-btn-primary"
                                onClick={() => setShowAddFarmerModal(true)}
                                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                              >
                                <UserPlus size={14} />
                                <span>Daftarkan Petani Pertama</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 2: PENUGASAN SUPAKU KE PETANI */}
        {activeTab === 'assignment' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <div className="portal-table-panel">
              <div className="portal-toolbar">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#111827' }}>Penugasan Unit SupaKu Wilayah</h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#6B7280' }}>
                      Petakan unit fisik ke akun petani binaan agar otomatis muncul di dashboard petani.
                    </p>
                  </div>
                  <div className="admin-filter-pill-group">
                    <button
                      type="button"
                      className={`admin-filter-pill ${deviceFilter === 'ALL' ? 'active' : ''}`}
                      onClick={() => setDeviceFilter('ALL')}
                    >
                      Semua ({devices.length})
                    </button>
                    <button
                      type="button"
                      className={`admin-filter-pill ${deviceFilter === 'ASSIGNED' ? 'active' : ''}`}
                      onClick={() => setDeviceFilter('ASSIGNED')}
                    >
                      Ditugaskan ({assignedCount})
                    </button>
                    <button
                      type="button"
                      className={`admin-filter-pill ${deviceFilter === 'UNASSIGNED' ? 'active' : ''}`}
                      onClick={() => setDeviceFilter('UNASSIGNED')}
                    >
                      Tersedia ({unassignedCount})
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div className="admin-search-box" style={{ maxWidth: '280px' }}>
                    <Search size={15} className="search-icon" />
                    <input
                      type="text"
                      placeholder="Cari serial / model..."
                      value={deviceSearchQuery}
                      onChange={(e) => setDeviceSearchQuery(e.target.value)}
                    />
                    {deviceSearchQuery && (
                      <button
                        type="button"
                        className="clear-btn"
                        onClick={() => setDeviceSearchQuery('')}
                        title="Hapus pencarian"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    className="tech-btn-primary"
                    onClick={() => {
                      setAssignForm({ deviceId: '', farmerId: '' });
                      setShowAssignModal(true);
                    }}
                  >
                    <Link size={14} />
                    <span>+ Buat Penugasan Baru</span>
                  </button>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="tech-table responsive-table">
                  <thead>
                    <tr>
                      <th>Serial Number SupaKu</th>
                      <th>Model & Versi</th>
                      <th>Petani Binaan Terhubung</th>
                      <th style={{ textAlign: 'center' }}>Status Unit</th>
                      <th style={{ textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDevices.map((d) => {
                      const assignedFarmer = farmers.find((f) =>
                        (f.id && (f.id === d.userId || f.id === d.farmerId)) ||
                        f.devices?.some((dev) => (dev.deviceId || dev.serialNumber || dev.id) === (d.deviceId || d.serialNumber || d.id))
                      );
                      const isAssigned = Boolean(assignedFarmer || d.userId || d.farmerId || d.farmer || d.assignedFarmer || d.ownerName);

                      return (
                        <tr key={d.deviceId || d.id}>
                          <td data-label="Serial Number">
                            <span className="admin-device-sn-badge">
                              <Cpu size={13} style={{ color: '#7B5E3C' }} />
                              <span>{d.deviceId || d.id}</span>
                            </span>
                          </td>
                          <td data-label="Model">
                            <div style={{ fontWeight: 700, color: '#111827' }}>{d.name || 'SupaKu IoT Node'}</div>
                            <small style={{ color: '#6B7280', fontSize: '0.75rem' }}>Hardware v{d.hardwareVersion || '2.0'}</small>
                          </td>
                          <td data-label="Petani">
                            {assignedFarmer || d.farmer || d.assignedFarmer ? (
                              <div>
                                <div style={{ fontWeight: 700, color: '#111827' }}>
                                  {assignedFarmer?.fullName || d.farmer?.fullName || d.assignedFarmer || 'Petani Terdaftar'}
                                </div>
                                <div className="admin-farmer-sub">
                                  {assignedFarmer?.farmName || d.farmer?.phoneNumber || (d.farmer?.email ? d.farmer.email : 'Binaan Aktif')}
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: '0.8rem' }}>
                                Tersedia di Gudang (Belum Ditugaskan)
                              </span>
                            )}
                          </td>
                          <td data-label="Status" style={{ textAlign: 'center' }}>
                            <span className={isAssigned ? 'tech-badge-active' : 'tech-badge-warning'}>
                              {isAssigned ? 'DITUGASKAN' : 'TERSEDIA'}
                            </span>
                          </td>
                          <td data-label="Aksi" style={{ textAlign: 'center' }}>
                            <div className="admin-table-actions">
                              {isAssigned ? (
                                <button
                                  type="button"
                                  className="admin-btn-danger"
                                  onClick={() => handleOpenUnassignModal(d.deviceId || d.id)}
                                  title="Lepas penugasan alat dari petani"
                                >
                                  <Unlink size={13} />
                                  <span>Lepas</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="admin-btn-assign"
                                  onClick={() => {
                                    setAssignForm({ deviceId: d.deviceId || d.id, farmerId: '' });
                                    setShowAssignModal(true);
                                  }}
                                  title="Tugaskan unit ini ke petani"
                                >
                                  <Link size={13} />
                                  <span>Tugaskan</span>
                                </button>
                              )}

                              <button
                                type="button"
                                className="tech-icon-action-btn"
                                onClick={() => setStickerDevice(d)}
                                title="Lihat & Cetak Stiker Barcode SupaKu"
                              >
                                <QrCode size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredDevices.length === 0 && (
                      <tr>
                        <td colSpan={5}>
                          <div className="admin-empty-state">
                            <div className="admin-empty-icon">
                              <Cpu size={24} />
                            </div>
                            <p style={{ margin: 0, fontWeight: 700, color: '#374151' }}>
                              {deviceSearchQuery || deviceFilter !== 'ALL'
                                ? 'Tidak ada unit SupaKu yang cocok dengan filter atau pencarian.'
                                : 'Belum ada unit SupaKu terdaftar di wilayah ini.'}
                            </p>
                            {(deviceSearchQuery || deviceFilter !== 'ALL') && (
                              <button
                                type="button"
                                className="tech-btn-secondary"
                                onClick={() => {
                                  setDeviceSearchQuery('');
                                  setDeviceFilter('ALL');
                                }}
                                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                              >
                                Reset Filter
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: DAFTARKAN PETANI BARU (POST /admin/farmers)
      ───────────────────────────────────────────────────────────── */}
      {showAddFarmerModal && (
        <div className="tech-modal-overlay">
          <motion.div className="tech-modal-card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ maxWidth: '520px' }}>
            <div className="tech-modal-header">
              <div>
                <h3 className="tech-modal-title">Pendaftaran Petani Binaan Baru</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#6B7280' }}>
                  Admin memberikan akun awal kepada petani. Saat login pertama, petani wajib onboarding mengganti kata sandi.
                </p>
              </div>
              <button 
                type="button" 
                className="tech-modal-close-btn" 
                onClick={() => setShowAddFarmerModal(false)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateFarmer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="tech-form-group">
                <label className="tech-form-label">Nama Lengkap Petani</label>
                <input
                  type="text"
                  className="tech-form-input"
                  placeholder="Contoh: Dadang Sulaeman"
                  value={farmerForm.fullName}
                  onChange={(e) => setFarmerForm({ ...farmerForm, fullName: e.target.value })}
                  required
                />
              </div>

              <div className="tech-form-group">
                <label className="tech-form-label">Nomor Telepon / WhatsApp (Dipakai Login)</label>
                <input
                  type="tel"
                  className="tech-form-input"
                  placeholder="Contoh: 081234567890"
                  value={farmerForm.phoneNumber}
                  onChange={(e) => setFarmerForm({ ...farmerForm, phoneNumber: e.target.value })}
                  required
                />
              </div>

              <div className="tech-form-group">
                <label className="tech-form-label">Email (Opsional)</label>
                <input
                  type="email"
                  className="tech-form-input"
                  placeholder="petani@gmail.com"
                  value={farmerForm.email}
                  onChange={(e) => setFarmerForm({ ...farmerForm, email: e.target.value })}
                />
              </div>

              <div style={{ backgroundColor: '#F5EFE6', border: '1px solid rgba(123, 94, 60, 0.25)', borderRadius: '12px', padding: '10px 14px', fontSize: '0.8rem', color: '#7B5E3C', lineHeight: '1.5' }}>
                <div style={{ fontWeight: 800, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} />
                  <span>Onboarding Mandiri Petani</span>
                </div>
                Detail nama usaha tani, alamat kumbung, dan penggantian kata sandi akan dilengkapi langsung oleh Petani saat pertama kali masuk ke sistem.
              </div>

              <div className="tech-form-group">
                <label className="tech-form-label">Kata Sandi Awal Sementara</label>
                <input
                  type="text"
                  className="tech-form-input"
                  value={farmerForm.password}
                  onChange={(e) => setFarmerForm({ ...farmerForm, password: e.target.value })}
                  style={{ fontFamily: 'monospace' }}
                  required
                />
              </div>

              <div className="tech-modal-actions">
                <button type="button" className="tech-btn-secondary" onClick={() => setShowAddFarmerModal(false)}>Batal</button>
                <button type="submit" className="tech-btn-primary" disabled={loading}>
                  {loading ? 'Mendaftarkan...' : 'Daftarkan Petani'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: TUGASKAN SUPAKU (POST /admin/devices/assign)
      ───────────────────────────────────────────────────────────── */}
      {showAssignModal && (
        <div className="tech-modal-overlay">
          <motion.div className="tech-modal-card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ maxWidth: '480px' }}>
            <div className="tech-modal-header">
              <div>
                <h3 className="tech-modal-title">Penugasan Unit SupaKu</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#6B7280' }}>
                  Pilih unit SupaKu dan akun petani binaan penerima alat.
                </p>
              </div>
              <button 
                type="button" 
                className="tech-modal-close-btn" 
                onClick={() => setShowAssignModal(false)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignDevice} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="tech-form-group">
                <label className="tech-form-label">Unit SupaKu</label>
                <select
                  className="tech-form-select"
                  value={assignForm.deviceId}
                  onChange={(e) => setAssignForm({ ...assignForm, deviceId: e.target.value })}
                  required
                >
                  <option value="">-- Pilih Unit SupaKu --</option>
                  {devices.map((d) => (
                    <option key={d.deviceId || d.id} value={d.deviceId || d.id}>
                      {d.deviceId || d.id} - {d.name || 'Unit SupaKu'} {d.isOnline ? '(Online)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="tech-form-group">
                <label className="tech-form-label">Petani Binaan Penerima</label>
                <select
                  className="tech-form-select"
                  value={assignForm.farmerId}
                  onChange={(e) => setAssignForm({ ...assignForm, farmerId: e.target.value })}
                  required
                >
                  <option value="">-- Pilih Petani Binaan --</option>
                  {farmers.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.fullName} ({f.farmName || f.phoneNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div className="tech-modal-actions">
                <button type="button" className="tech-btn-secondary" onClick={() => setShowAssignModal(false)}>Batal</button>
                <button type="submit" className="tech-btn-primary" disabled={loading}>
                  {loading ? 'Menugaskan...' : 'Tugaskan Alat'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: EDIT PROFIL PETANI (PUT /admin/farmers/:id)
      ───────────────────────────────────────────────────────────── */}
      {showEditFarmerModal && editingFarmer && (
        <div className="tech-modal-overlay">
          <motion.div className="tech-modal-card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ maxWidth: '480px' }}>
            <div className="tech-modal-header">
              <div>
                <h3 className="tech-modal-title">Edit Profil {editingFarmer.fullName}</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#6B7280' }}>
                  Perbarui identitas, kontak, dan alamat kumbung petani binaan.
                </p>
              </div>
              <button 
                type="button" 
                className="tech-modal-close-btn" 
                onClick={() => setShowEditFarmerModal(false)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditFarmer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="tech-form-group">
                <label className="tech-form-label">Nama Lengkap</label>
                <input
                  type="text"
                  className="tech-form-input"
                  value={editFarmerForm.fullName}
                  onChange={(e) => setEditFarmerForm({ ...editFarmerForm, fullName: e.target.value })}
                  required
                />
              </div>

              <div className="tech-form-group">
                <label className="tech-form-label">Nomor Telepon</label>
                <input
                  type="tel"
                  className="tech-form-input"
                  value={editFarmerForm.phoneNumber}
                  onChange={(e) => setEditFarmerForm({ ...editFarmerForm, phoneNumber: e.target.value })}
                  required
                />
              </div>

              <div className="tech-form-group">
                <label className="tech-form-label">Nama Usaha Tani / Kumbung</label>
                <input
                  type="text"
                  className="tech-form-input"
                  value={editFarmerForm.farmName}
                  onChange={(e) => setEditFarmerForm({ ...editFarmerForm, farmName: e.target.value })}
                />
              </div>

              <div className="tech-form-group">
                <label className="tech-form-label">Alamat Kumbung</label>
                <textarea
                  className="tech-form-input"
                  rows={2}
                  value={editFarmerForm.farmAddress}
                  onChange={(e) => setEditFarmerForm({ ...editFarmerForm, farmAddress: e.target.value })}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="tech-form-group">
                <label className="tech-form-label">Status Akses Petani</label>
                <select
                  className="tech-form-select"
                  value={editFarmerForm.status}
                  onChange={(e) => setEditFarmerForm({ ...editFarmerForm, status: e.target.value })}
                >
                  <option value="ACTIVE">Aktif (Dapat Mengakses Sistem)</option>
                  <option value="PENDING">Menunggu Verifikasi</option>
                </select>
              </div>

              <div className="tech-modal-actions">
                <button type="button" className="tech-btn-secondary" onClick={() => setShowEditFarmerModal(false)}>Batal</button>
                <button type="submit" className="tech-btn-primary" disabled={loading}>
                  {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Real Production Barcode & QR Code Modal */}
      {Boolean(stickerDevice) && (
        <DeviceBarcodeStickerModal
          isOpen={true}
          onClose={() => setStickerDevice(null)}
          device={stickerDevice}
          onNotification={showNotification}
        />
      )}

      {/* Confirmation Modal for Unassigning Device */}
      <ConfirmModal
        isOpen={Boolean(unassignTargetDevice)}
        onClose={() => !isUnassigning && setUnassignTargetDevice(null)}
        onConfirm={handleConfirmUnassignDevice}
        title="Lepas Penugasan SupaKu"
        message="Apakah Anda yakin ingin melepaskan penugasan unit SupaKu ini dari petani binaan? Unit akan kembali berstatus tersedia di inventaris wilayah."
        itemDetails={
          unassignTargetDevice
            ? {
                label: 'Serial Number Unit',
                value: unassignTargetDevice,
                subValue: 'Status: Akan dialihkan ke TERSEDIA',
              }
            : null
        }
        type="warning"
        confirmText="Lepaskan Unit"
        cancelText="Batal"
        loading={isUnassigning}
        dangerNote="Petani tidak akan lagi menerima aliran telemetri dari unit ini sampai unit ditugaskan kembali."
      />

      {/* Confirmation Modal for Deleting Farmer */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetFarmer)}
        onClose={() => !isDeletingFarmer && setDeleteTargetFarmer(null)}
        onConfirm={handleConfirmDeleteFarmer}
        title="Hapus Akun Petani Binaan"
        message={`Apakah Anda yakin ingin menghapus akun petani "${deleteTargetFarmer?.fullName || deleteTargetFarmer?.phoneNumber}"? Semua unit SupaKu yang ditugaskan ke petani ini akan otomatis dilepaskan kembali ke status tersedia.`}
        itemDetails={
          deleteTargetFarmer
            ? {
                label: 'Nama Petani',
                value: deleteTargetFarmer.fullName || deleteTargetFarmer.phoneNumber,
                subValue: `Kontak: ${deleteTargetFarmer.phoneNumber || '-'} | Unit SupaKu: ${deleteTargetFarmer.devices?.length || 0} unit`,
              }
            : null
        }
        type="danger"
        confirmText="Hapus Akun Petani"
        cancelText="Batal"
        loading={isDeletingFarmer}
        dangerNote="Tindakan ini tidak dapat dibatalkan. Data akun dan akses petani ini akan dihapus secara permanen dari sistem."
      />
    </div>
  );
}

