import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
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
  Trash2
} from 'lucide-react';
import api from '../services/api';
import DeviceBarcodeStickerModal from './DeviceBarcodeStickerModal';
import ConfirmModal from './ConfirmModal';
import './AdminDashboard.css';

export default function AdminDashboard({ onMenuToggle, currentUser }) {
  const [activeTab, setActiveTab] = useState('farmers'); // 'farmers' | 'assignment' | 'overview'
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [farmers, setFarmers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
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
    farmName: '',
    farmAddress: '',
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

  // Submit Create Farmer
  const handleCreateFarmer = async (e) => {
    e?.preventDefault();
    if (!farmerForm.fullName || !farmerForm.phoneNumber || !farmerForm.password) {
      showNotification('Nama lengkap, nomor telepon, dan kata sandi wajib diisi!', 'warning');
      return;
    }

    try {
      setLoading(true);
      const result = await api.admin.createFarmer(farmerForm);
      showNotification(`✓ Akun petani ${result.fullName || farmerForm.fullName} berhasil didaftarkan!`, 'success');
      setShowAddFarmerModal(false);
      setFarmerForm({
        fullName: '',
        phoneNumber: '',
        email: '',
        password: 'PasswordDefault123!',
        farmName: '',
        farmAddress: '',
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

      {/* Top Header - Matching Farmer Dashboard Header Component */}
      <header className="header" data-page-tone="system">
        <div className="header-title">
          {onMenuToggle && (
            <button className="mobile-menu-toggle" onClick={onMenuToggle} aria-label="Toggle menu">
              <Menu size={24} />
            </button>
          )}
          <div className="header-title-badge" aria-hidden="true">
            <Shield size={20} />
          </div>
          <div className="header-copy">
            <h2>Portal Administrator Regional</h2>
            <p>
              Sesi: <strong style={{ color: 'var(--text-primary)' }}>{currentUser?.fullName || currentUser?.name || 'Admin Wilayah Lembang'}</strong> • Manajemen Petani Binaan & Penugasan SupaKu
            </p>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="secondary-button"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>

          <button
            className="primary-button"
            onClick={() => setShowAddFarmerModal(true)}
          >
            <UserPlus size={16} />
            <span>Daftarkan Petani Baru</span>
          </button>
        </div>
      </header>

      {/* Main Page Content - Standard ShroomSync Farmer Page Layout */}
      <div className="dashboard-content">
        {/* Overview Stat Cards - Identical to Farmer Dashboard minimal cards */}
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
            <div className="stat-value">{dashboardData?.assignedDevices ?? 3}</div>
            <div className="stat-status text-sage">Aktif dioperasikan oleh petani</div>
          </div>

          <div className="stat-card minimal">
            <span className="stat-title">
              Tersedia di Gudang <Cpu size={14} className="text-earth" />
            </span>
            <div className="stat-value">{dashboardData?.unassignedDevices ?? Math.max(0, devices.length - 3)}</div>
            <div className="stat-status text-earth">Siap ditugaskan ke petani baru</div>
          </div>
        </div>

        {/* Tab Navigation - Standard ShroomSync Portal Tabs */}
        <div className="portal-tabs">
          <button
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
            className={`portal-tab-btn ${activeTab === 'assignment' ? 'active' : ''}`}
            onClick={() => setActiveTab('assignment')}
          >
            <Link size={16} />
            <span>Penugasan SupaKu ke Petani</span>
          </button>
        </div>

        {/* TAB 1: DAFTAR PETANI BINAAN */}
        {activeTab === 'farmers' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <div className="portal-table-panel">
              {/* Toolbar */}
              <div className="portal-toolbar">
                <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '380px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    placeholder="Cari nama petani, kontak, atau kumbung..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 36px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="secondary-button"
                    onClick={handleExportFarmersCSV}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Download size={14} />
                    <span>Ekspor CSV</span>
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => setShowAddFarmerModal(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <UserPlus size={14} />
                    <span>Tambah Petani Binaan</span>
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="table-wrapper">
                <table className="data-table responsive-table">
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '38px', height: '38px', borderRadius: '8px', backgroundColor: 'rgba(36, 94, 61, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', flexShrink: 0 }}>
                              {farmer.fullName?.charAt(0) || 'P'}
                            </div>
                            <div>
                              <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{farmer.fullName}</div>
                              <div className="text-muted" style={{ fontSize: '0.78rem' }}>{farmer.farmName || 'Kumbung Jamur Binaan'}</div>
                            </div>
                          </div>
                        </td>
                        <td data-label="Kontak">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.82rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="font-semibold">{farmer.phoneNumber}</span>
                              {farmer.phoneNumber && (
                                <a
                                  href={`https://wa.me/${farmer.phoneNumber.replace(/[^0-9]/g, '')}?text=Halo%20${encodeURIComponent(farmer.fullName)},%20kami%20dari%20Admin%20Regional%20ShroomSync`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="wa-quick-btn"
                                >
                                  <MessageSquare size={11} />
                                  <span>WA</span>
                                </a>
                              )}
                            </div>
                            {farmer.farmAddress && (
                              <span className="text-muted" style={{ fontSize: '0.76rem' }}>{farmer.farmAddress}</span>
                            )}
                          </div>
                        </td>
                        <td data-label="Unit SupaKu">
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {farmer.devices && farmer.devices.length > 0 ? (
                              farmer.devices.map((d) => (
                                <span
                                  key={d.deviceId || d.id}
                                  style={{
                                    backgroundColor: 'rgba(36, 94, 61, 0.08)',
                                    border: '1px solid rgba(36, 94, 61, 0.2)',
                                    color: 'var(--primary)',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.74rem',
                                    fontFamily: 'monospace',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                  }}
                                >
                                  <span style={{ color: d.isOnline ? 'var(--sage-green)' : 'var(--error)' }}>●</span>
                                  <span>{d.deviceId || d.id}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenUnassignModal(d.deviceId || d.id);
                                    }}
                                    title="Lepas tautan (unpair) perangkat dari petani ini"
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: 'var(--text-muted)',
                                      cursor: 'pointer',
                                      padding: '0 2px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      lineHeight: 1,
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                                  >
                                    <X size={12} />
                                  </button>
                                </span>
                              ))
                            ) : (
                              <span className="text-muted" style={{ fontSize: '0.78rem', fontStyle: 'italic' }}>
                                Belum ada unit ditugaskan
                              </span>
                            )}
                          </div>
                        </td>
                        <td data-label="Status" style={{ textAlign: 'center' }}>
                          <div className="status-badge" style={{ justifyContent: 'center' }}>
                            <span className={`status-dot ${farmer.status === 'ACTIVE' ? 'bg-sage' : 'bg-warning'}`}></span>
                            <span className={farmer.status === 'ACTIVE' ? 'text-sage' : 'text-warning'} style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                              {farmer.status === 'ACTIVE' ? 'Aktif' : 'Menunggu'}
                            </span>
                          </div>
                        </td>
                        <td data-label="Aksi" style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              className="secondary-button compact-button"
                              onClick={() => {
                                setAssignForm({ deviceId: '', farmerId: farmer.id });
                                setShowAssignModal(true);
                              }}
                              title="Tugaskan SupaKu"
                              style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                            >
                              <Link size={13} />
                              <span>Tugaskan</span>
                            </button>
                            <button
                              className="secondary-button compact-button"
                              onClick={() => handleOpenEditFarmer(farmer)}
                              title="Edit Profil"
                              style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                            >
                              <Edit3 size={13} />
                              <span>Edit</span>
                            </button>
                            <button
                              className="secondary-button compact-button"
                              onClick={() => handleOpenDeleteModal(farmer)}
                              title="Hapus Petani"
                              style={{ padding: '5px 8px', fontSize: '0.78rem', color: 'var(--error)' }}
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
                        <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                          Tidak ada data petani binaan yang cocok dengan pencarian.
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
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Penugasan Unit SupaKu Wilayah</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Petakan unit fisik ke akun petani binaan agar otomatis muncul di dashboard petani.
                  </p>
                </div>

                <button
                  className="primary-button compact-button"
                  onClick={() => setShowAssignModal(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Link size={15} />
                  <span>+ Buat Penugasan Baru</span>
                </button>
              </div>

              <div className="table-wrapper">
                <table className="data-table responsive-table">
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
                    {devices.map((d) => {
                      const assignedFarmer = farmers.find((f) =>
                        (f.id && (f.id === d.userId || f.id === d.farmerId)) ||
                        f.devices?.some((dev) => (dev.deviceId || dev.serialNumber || dev.id) === (d.deviceId || d.serialNumber || d.id))
                      );
                      const isAssigned = Boolean(assignedFarmer || d.userId || d.farmerId || d.farmer || d.assignedFarmer || d.ownerName);

                      return (
                        <tr key={d.deviceId || d.id}>
                          <td data-label="Serial Number" style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
                            {d.deviceId || d.id}
                          </td>
                          <td data-label="Model">
                            <div className="font-semibold">{d.name || d.deviceId}</div>
                            <small className="text-muted">v{d.hardwareVersion || '2.0'}</small>
                          </td>
                          <td data-label="Petani">
                            {assignedFarmer || d.farmer || d.assignedFarmer ? (
                              <div>
                                <div className="font-semibold">{assignedFarmer?.fullName || d.farmer?.fullName || d.assignedFarmer || 'Petani Terdaftar'}</div>
                                <small className="text-muted">{assignedFarmer?.farmName || d.farmer?.phoneNumber || (d.farmer?.email ? d.farmer.email : 'Binaan Aktif')}</small>
                              </div>
                            ) : (
                              <span className="text-muted" style={{ fontStyle: 'italic', fontSize: '0.82rem' }}>
                                Tersedia di Gudang (Belum Ditugaskan)
                              </span>
                            )}
                          </td>
                          <td data-label="Status" style={{ textAlign: 'center' }}>
                            <div className="status-badge" style={{ justifyContent: 'center' }}>
                              <span className={`status-dot ${isAssigned ? 'bg-sage' : 'bg-warning'}`}></span>
                              <span className={isAssigned ? 'text-sage' : 'text-warning'} style={{ fontWeight: 600, fontSize: '0.78rem' }}>
                                {isAssigned ? 'DITUGASKAN' : 'TERSEDIA'}
                              </span>
                            </div>
                          </td>
                          <td data-label="Aksi" style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                              {isAssigned ? (
                                <button
                                  className="secondary-button compact-button"
                                  onClick={() => handleOpenUnassignModal(d.deviceId || d.id)}
                                  style={{ fontSize: '0.78rem', padding: '4px 8px', color: 'var(--error)' }}
                                  title="Lepas penugasan alat dari petani"
                                >
                                  <Unlink size={13} />
                                  <span>Lepas</span>
                                </button>
                              ) : (
                                <button
                                  className="primary-button compact-button"
                                  onClick={() => {
                                    setAssignForm({ deviceId: d.deviceId || d.id, farmerId: '' });
                                    setShowAssignModal(true);
                                  }}
                                  style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                                >
                                  <Link size={13} />
                                  <span>Tugaskan</span>
                                </button>
                              )}

                              <button
                                className="icon-button small-icon-button"
                                onClick={() => setStickerDevice(d)}
                                title="Lihat & Cetak Stiker Barcode SupaKu"
                                style={{ backgroundColor: 'rgba(36, 94, 61, 0.12)' }}
                              >
                                <QrCode size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <motion.div className="modal-content panel" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '480px', maxWidth: '92vw', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Pendaftaran Petani Binaan Baru</h3>
              <button onClick={() => setShowAddFarmerModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <p className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '18px' }}>
              Admin memberikan akun awal kepada petani. Saat login pertama, petani wajib onboarding mengganti kata sandi default.
            </p>

            <form onSubmit={handleCreateFarmer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Nama Lengkap Petani</label>
                <input
                  type="text"
                  placeholder="Contoh: Dadang Sulaeman"
                  value={farmerForm.fullName}
                  onChange={(e) => setFarmerForm({ ...farmerForm, fullName: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Nomor Telepon / WhatsApp (Dipakai Login)</label>
                <input
                  type="tel"
                  placeholder="Contoh: 081234567890"
                  value={farmerForm.phoneNumber}
                  onChange={(e) => setFarmerForm({ ...farmerForm, phoneNumber: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Email (Opsional)</label>
                <input
                  type="email"
                  placeholder="petani@gmail.com"
                  value={farmerForm.email}
                  onChange={(e) => setFarmerForm({ ...farmerForm, email: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Nama Usaha Tani / Kumbung</label>
                <input
                  type="text"
                  placeholder="Contoh: Kumbung Jamur Sejahtera"
                  value={farmerForm.farmName}
                  onChange={(e) => setFarmerForm({ ...farmerForm, farmName: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Alamat Kumbung Jamur</label>
                <textarea
                  rows={2}
                  placeholder="Alamat fisik kumbung atau rumah petani..."
                  value={farmerForm.farmAddress}
                  onChange={(e) => setFarmerForm({ ...farmerForm, farmAddress: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Kata Sandi Awal Sementara</label>
                <input
                  type="text"
                  value={farmerForm.password}
                  onChange={(e) => setFarmerForm({ ...farmerForm, password: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)', fontFamily: 'monospace' }}
                  required
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="secondary-button" onClick={() => setShowAddFarmerModal(false)}>Batal</button>
                <button type="submit" className="primary-button" disabled={loading}>Daftarkan Petani</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: TUGASKAN SUPAKU (POST /admin/devices/assign)
      ───────────────────────────────────────────────────────────── */}
      {showAssignModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <motion.div className="modal-content panel" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '440px', maxWidth: '92vw', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Penugasan Unit SupaKu</h3>
              <button onClick={() => setShowAssignModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '16px' }}>
              Pilih unit SupaKu dan akun petani binaan penerima alat.
            </p>

            <form onSubmit={handleAssignDevice} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Unit SupaKu</label>
                <select
                  value={assignForm.deviceId}
                  onChange={(e) => setAssignForm({ ...assignForm, deviceId: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                  required
                >
                  <option value="">-- Pilih Unit SupaKu --</option>
                  {devices.map((d) => (
                    <option key={d.deviceId || d.id} value={d.deviceId || d.id}>
                      {d.deviceId || d.id} - {d.name || 'Unit SupaKu'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Petani Binaan Penerima</label>
                <select
                  value={assignForm.farmerId}
                  onChange={(e) => setAssignForm({ ...assignForm, farmerId: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
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

              <div className="modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="secondary-button" onClick={() => setShowAssignModal(false)}>Batal</button>
                <button type="submit" className="primary-button" disabled={loading}>Tugaskan Alat</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: EDIT PROFIL PETANI (PUT /admin/farmers/:id)
      ───────────────────────────────────────────────────────────── */}
      {showEditFarmerModal && editingFarmer && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <motion.div className="modal-content panel" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '460px', maxWidth: '92vw', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Edit Profil {editingFarmer.fullName}</h3>
              <button onClick={() => setShowEditFarmerModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditFarmer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Nama Lengkap</label>
                <input
                  type="text"
                  value={editFarmerForm.fullName}
                  onChange={(e) => setEditFarmerForm({ ...editFarmerForm, fullName: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Nomor Telepon</label>
                <input
                  type="tel"
                  value={editFarmerForm.phoneNumber}
                  onChange={(e) => setEditFarmerForm({ ...editFarmerForm, phoneNumber: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Nama Usaha Tani</label>
                <input
                  type="text"
                  value={editFarmerForm.farmName}
                  onChange={(e) => setEditFarmerForm({ ...editFarmerForm, farmName: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Alamat Kumbung</label>
                <textarea
                  rows={2}
                  value={editFarmerForm.farmAddress}
                  onChange={(e) => setEditFarmerForm({ ...editFarmerForm, farmAddress: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="secondary-button" onClick={() => setShowEditFarmerModal(false)}>Batal</button>
                <button type="submit" className="primary-button" disabled={loading}>Simpan Perubahan</button>
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

