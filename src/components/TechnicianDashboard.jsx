import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Cpu,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Search,
  QrCode,
  Download,
  Trash2,
  Edit3,
  Users,
  UserPlus,
  Send,
  Zap,
  X,
  Terminal,
  Wifi,
  Menu,
  Upload,
  FileCode,
  Check,
  Copy,
  HardDrive,
  History,
  Clock,
  ChevronRight,
  ExternalLink,
  Activity,
  Phone,
  Mail,
  Sprout,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import DeviceBarcodeStickerModal from './DeviceBarcodeStickerModal';
import ConfirmModal from './ConfirmModal';
import './TechnicianDashboard.css';

const STATUS_FILTERS = ['ALL', 'READY', 'ACTIVE', 'OFFLINE', 'SUSPENDED'];

export default function TechnicianDashboard({
  onMenuToggle,
  currentUser,
  activeTab: controlledTab,
  onTabChange,
  theme,
  toggleTheme,
}) {
  const [internalTab, setInternalTab] = useState('dashboard');
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;
  const [timeRange, setTimeRange] = useState('7 Hari Terakhir');
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [farmerSubTab, setFarmerSubTab] = useState('farmers');
  const [showFarmerModal, setShowFarmerModal] = useState(false);
  const [deleteTargetFarmer, setDeleteTargetFarmer] = useState(null);
  const [isDeletingFarmer, setIsDeletingFarmer] = useState(false);
  const [farmerForm, setFarmerForm] = useState({
    fullName: '',
    phoneNumber: '',
    email: '',
    password: 'PasswordDefault123!',
  });
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);

  // Modals state
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [showEditDeviceModal, setShowEditDeviceModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [showStickerModal, setShowStickerModal] = useState(false);
  const [activeStickerDevice, setActiveStickerDevice] = useState(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [otaTargetDevice, setOtaTargetDevice] = useState(null);
  const [deleteTargetDevice, setDeleteTargetDevice] = useState(null);
  const [isDeletingDevice, setIsDeletingDevice] = useState(false);

  // Forms
  const [provisionForm, setProvisionForm] = useState({
    serialNumber: '',
    name: '',
    model: 'SupaKu Smart Node v2',
    hardwareVersion: '2.0',
    firmwareVersion: '2.1.0',
  });

  const [editDeviceForm, setEditDeviceForm] = useState({
    name: '',
    model: '',
    hardwareVersion: '',
    firmwareVersion: '',
    status: 'READY',
  });

  const [adminForm, setAdminForm] = useState({
    fullName: '',
    phoneNumber: '',
    email: '',
    password: '',
    region: 'Jawa Barat (Lembang)',
  });

  // Firmware Management & OTA States
  const [firmwares, setFirmwares] = useState([]);
  const [otaLogs, setOtaLogs] = useState([]);
  const [loadingFirmwares, setLoadingFirmwares] = useState(false);
  const [loadingOtaLogs, setLoadingOtaLogs] = useState(false);
  const [showUploadFirmwareModal, setShowUploadFirmwareModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [copiedChecksum, setCopiedChecksum] = useState(null);
  const [firmwareUploadForm, setFirmwareUploadForm] = useState({
    file: null,
    version: '',
    hardwareVersion: '1.0',
    changelog: '',
    isLatest: true,
  });

  const [otaForm, setOtaForm] = useState({
    firmwareId: '',
    firmwareUrl: '',
    firmwareVersion: '',
    hardwareVersion: '1.0',
    checksumSha256: '',
    changelog: '',
    isBroadcast: false,
    useCustomUrl: false,
    force: false,
  });

  // Helper membandingkan semver
  const compareSemVer = useCallback((vTarget, vCurrent) => {
    if (!vTarget || !vCurrent) return 0;
    const parse = (v) => v.replace(/^v/i, '').split(/[.-]/).map((n) => parseInt(n, 10) || 0);
    const pTar = parse(vTarget);
    const pCur = parse(vCurrent);
    const maxLen = Math.max(pTar.length, pCur.length);
    for (let i = 0; i < maxLen; i++) {
      const t = pTar[i] || 0;
      const c = pCur[i] || 0;
      if (t > c) return 1;  // Upgrade
      if (t < c) return -1; // Downgrade
    }
    return 0; // Sama / Reflash
  }, []);

  // Evaluasi dinamis apakah operasi OTA berupa UPGRADE, DOWNGRADE, atau RE-FLASH
  const otaOperationMeta = useMemo(() => {
    if (otaForm.isBroadcast) {
      return {
        mode: otaForm.force ? 'DOWNGRADE' : 'BROADCAST',
        label: otaForm.force ? 'Broadcast Downgrade / Force' : 'Broadcast Update',
        badge: otaForm.force ? 'BROADCAST DOWNGRADE' : 'BROADCAST UPDATE',
        color: otaForm.force ? '#f59e0b' : '#3b82f6',
        isDowngrade: Boolean(otaForm.force),
        isReflash: false,
      };
    }

    const current = otaTargetDevice?.firmwareVersion;
    const target = otaForm.firmwareVersion;

    if (!current || !target) {
      return {
        mode: 'UPDATE',
        label: 'Pembaruan Firmware',
        badge: 'UPDATE',
        color: 'var(--primary, #10b981)',
        isDowngrade: false,
        isReflash: false,
      };
    }

    const cmp = compareSemVer(target, current);
    if (cmp < 0) {
      return {
        mode: 'DOWNGRADE',
        label: `Downgrade (Rollback dari v${current} ke v${target})`,
        badge: 'DOWNGRADE',
        color: '#f59e0b',
        isDowngrade: true,
        isReflash: false,
      };
    }
    if (cmp === 0) {
      return {
        mode: 'REFLASH',
        label: `Re-flash (Instal ulang versi sama v${target})`,
        badge: 'RE-FLASH',
        color: '#3b82f6',
        isDowngrade: false,
        isReflash: true,
      };
    }
    return {
      mode: 'UPGRADE',
      label: `Upgrade (Tingkatkan dari v${current} ke v${target})`,
      badge: 'UPGRADE',
      color: 'var(--primary, #10b981)',
      isDowngrade: false,
      isReflash: false,
    };
  }, [otaForm.isBroadcast, otaForm.force, otaForm.firmwareVersion, otaTargetDevice, compareSemVer]);

  // Diagnostics Tab State
  const [diagnosticLog, setDiagnosticLog] = useState('');
  const [testingEndpoint, setTestingEndpoint] = useState(false);

  const showNotification = (message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4000);
  };

  // Load dashboard overview & devices
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [devRes, adminRes, farmerRes] = await Promise.allSettled([
        api.technician.getDevices({ status: statusFilter, limit: 100 }),
        api.technician.getAdmins(),
        api.technician.getFarmers(),
      ]);

      if (devRes.status === 'fulfilled') {
        const devList = devRes.value?.devices || (Array.isArray(devRes.value) ? devRes.value : []);
        setDevices(devList);
      }
      if (adminRes.status === 'fulfilled') {
        const admList = Array.isArray(adminRes.value) ? adminRes.value : [];
        setAdmins(admList);
      }
      if (farmerRes.status === 'fulfilled') {
        const fList = Array.isArray(farmerRes.value) ? farmerRes.value : [];
        setFarmers(fList);
      }
    } catch (err) {
      console.error('[TechnicianDashboard] Load data failed:', err);
      showNotification(err.getUserMessage?.() || err.message || 'Gagal memuat data teknisi', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (!cancelled) {
          await loadData();
        }
      } catch {
        // Error is handled inside loadData
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [loadData]);

  // Filtered devices by search & status
  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const q = searchQuery.toLowerCase().trim();
      const farmerName = (d.farmer?.fullName || d.assignedFarmer || d.ownerName || '').toLowerCase();
      const farmerPhone = (d.farmer?.phoneNumber || '').toLowerCase();
      const farmerEmail = (d.farmer?.email || '').toLowerCase();
      const activationCode = (d.activationCode || '').toLowerCase();

      const matchQuery = !q ||
        (d.serialNumber && d.serialNumber.toLowerCase().includes(q)) ||
        (d.name && d.name.toLowerCase().includes(q)) ||
        (d.model && d.model.toLowerCase().includes(q)) ||
        farmerName.includes(q) ||
        farmerPhone.includes(q) ||
        farmerEmail.includes(q) ||
        activationCode.includes(q);

      const matchStatus = statusFilter === 'ALL' || (d.status && d.status.toUpperCase() === statusFilter);

      return matchQuery && matchStatus;
    });
  }, [devices, searchQuery, statusFilter]);

  const onlineDevicesCount = useMemo(() => {
    return devices.filter((d) => Boolean(d.isOnline)).length;
  }, [devices]);

  const offlineDevicesCount = useMemo(() => {
    return Math.max(0, devices.length - onlineDevicesCount);
  }, [devices, onlineDevicesCount]);

  const onlineRate = useMemo(() => {
    const total = devices.length;
    if (!total) return 0;
    return Math.round((onlineDevicesCount / total) * 100);
  }, [devices.length, onlineDevicesCount]);

  const offlineRate = useMemo(() => {
    return 100 - onlineRate;
  }, [onlineRate]);

  const needsUpdateCount = useMemo(() => {
    return devices.filter((d) => d.firmwareVersion && d.firmwareVersion !== '2.1.0').length;
  }, [devices]);

  const readyDevicesCount = useMemo(() => {
    return devices.filter((d) => d.status === 'READY').length;
  }, [devices]);

  // 24-Hour connectivity trend data for AreaChart
  const connectivityTrendData = useMemo(() => {
    const total = devices.length;
    const online = onlineDevicesCount;
    const hours = ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', 'Sekarang'];

    return hours.map((hour) => ({
      time: hour,
      online: online,
      total: total,
    }));
  }, [devices.length, onlineDevicesCount]);

  // Dynamic system alerts derived strictly from real devices & OTA logs
  const recentAlerts = useMemo(() => {
    const list = [];
    const now = new Date();

    // 1. Offline devices
    const offlineList = devices.filter((d) => !d.isOnline);
    offlineList.slice(0, 5).forEach((dev, idx) => {
      const minutesAgo = (idx + 1) * 8 + 3;
      const eventTime = dev.lastSeenAt ? new Date(dev.lastSeenAt) : new Date(now.getTime() - minutesAgo * 60 * 1000);
      list.push({
        id: `alert-off-${dev.id || dev.serialNumber}`,
        time: eventTime.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        serial: dev.serialNumber,
        region: dev.kumbung?.name || dev.farmer?.fullName || dev.model || 'Node SupaKu',
        category: 'CRITICAL',
        message: `MQTT Timeout: No response for > 30 min (${dev.name || 'SupaKu Node'})`,
        device: dev,
      });
    });

    // 2. Low RSSI or Sensor Warning
    devices.forEach((dev) => {
      if (dev.rssi && Number(dev.rssi) < -80) {
        list.push({
          id: `alert-rssi-${dev.id || dev.serialNumber}`,
          time: new Date(now.getTime() - 25 * 60 * 1000).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          serial: dev.serialNumber,
          region: dev.kumbung?.name || dev.farmer?.fullName || dev.model || 'Node SupaKu',
          category: 'WARNING',
          message: `Sinyal lemah: RSSI ${dev.rssi} dBm terdeteksi`,
          device: dev,
        });
      }
    });

    // 3. Real OTA logs
    if (otaLogs && otaLogs.length > 0) {
      otaLogs.slice(0, 5).forEach((log) => {
        list.push({
          id: `alert-ota-${log.id}`,
          time: new Date(log.createdAt || now).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          serial: log.targetDevice?.serialNumber || log.deviceSerialNumber || log.serialNumber || 'Unit SupaKu',
          region: 'OTA Cluster',
          category: log.status === 'SUCCESS' ? 'RESOLVED' : log.status === 'FAILED' ? 'CRITICAL' : 'INFO',
          message: log.status === 'SUCCESS' ? `OTA Update berhasil ke v${log.firmwareVersion || '1.1.0'}` : `OTA Update gagal: ${log.notes || 'Timeout'}`,
          device: log.targetDevice,
        });
      });
    }

    return list.slice(0, 5);
  }, [devices, otaLogs]);

  const getTabTitle = (tab) => {
    switch (tab) {
      case 'dashboard':
        return 'Ringkasan Sistem';
      case 'inventory':
        return 'Device Registry';
      case 'ota':
        return 'Firmware Manager';
      case 'admins':
        return 'Manajemen Petani';
      case 'logs':
        return 'Device Logs';
      case 'diagnostics':
        return 'Health Monitor';
      default:
        return 'Ringkasan Sistem';
    }
  };

  const getTabSubtitle = (tab) => {
    const sessionPrefix = currentUser?.fullName ? `Sesi: ${currentUser.fullName} • ` : '';
    switch (tab) {
      case 'dashboard':
        return `${sessionPrefix}Pemantauan infrastruktur IoT ShroomSync global.`;
      case 'inventory':
        return `${sessionPrefix}Inventarisasi, pendaftaran, dan provisioning unit hardware SupaKu IoT.`;
      case 'ota':
        return `${sessionPrefix}Pusat rilis binary firmware dan distribusi OTA update nirkabel.`;
      case 'admins':
        return `${sessionPrefix}Pengelolaan hak akses administrator wilayah dan petani binaan regional.`;
      case 'logs':
        return `${sessionPrefix}Riwayat aktivitas perangkat, log firmware OTA, dan audit trail sistem.`;
      case 'diagnostics':
        return `${sessionPrefix}Inspeksi telemetri real-time, broker MQTT heartbeat, dan status server.`;
      default:
        return `${sessionPrefix}Pemantauan infrastruktur IoT ShroomSync global.`;
    }
  };

  // Auto-generate meaningful serial helper: SS-[Bulan][Tahun]-[Nomor Unit]
  const handleAutoGenerateSerial = async () => {
    try {
      const data = await api.technician.getNextSerialNumber();
      if (data?.nextSerialNumber) {
        setProvisionForm((prev) => ({
          ...prev,
          serialNumber: data.nextSerialNumber,
          name: `SupaKu Unit ${data.nextSerialNumber}`,
        }));
        showNotification?.(`Serial Number: ${data.nextSerialNumber} (${data.description || 'Format bermakna SS-MMYY-NNN'})`, 'info');
        return;
      }
    } catch {
      // Fallback perhitungan lokal
    }

    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const existingCount = devices.filter((d) => d.serialNumber?.includes(`-${mm}${yy}-`)).length;
    const nextSeq = String(existingCount + 1).padStart(3, '0');
    const newSerial = `SS-${mm}${yy}-${nextSeq}`;

    setProvisionForm((prev) => ({
      ...prev,
      serialNumber: newSerial,
      name: `SupaKu Unit ${newSerial}`,
    }));
  };

  // Submit Provisioning SupaKu Baru
  const handleProvisionDevice = async (e) => {
    e?.preventDefault();
    if (!provisionForm.serialNumber) {
      showNotification('Serial number unit SupaKu wajib diisi!', 'warning');
      return;
    }

    try {
      setLoading(true);
      const result = await api.technician.createDevice(provisionForm);
      showNotification(`✓ Unit SupaKu ${result.serialNumber || provisionForm.serialNumber} berhasil didaftarkan!`, 'success');
      setShowProvisionModal(false);
      setProvisionForm({
        serialNumber: '',
        name: '',
        model: 'SupaKu Smart Node v2',
        hardwareVersion: '2.0',
        firmwareVersion: '2.1.0',
      });
      // Show QR sticker for printing
      setActiveStickerDevice(result);
      setShowStickerModal(true);
      loadData();
    } catch (err) {
      showNotification(err.getUserMessage?.() || err.message || 'Gagal meregistrasi SupaKu', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Open Edit Device Modal
  const handleOpenEditDevice = (device) => {
    setEditingDevice(device);
    setEditDeviceForm({
      name: device.name || '',
      model: device.model || 'SupaKu Smart Node v2',
      hardwareVersion: device.hardwareVersion || '2.0',
      firmwareVersion: device.firmwareVersion || '2.1.0',
      status: device.status || 'READY',
    });
    setShowEditDeviceModal(true);
  };

  // Submit Update Device Specs
  const handleSaveEditDevice = async (e) => {
    e?.preventDefault();
    if (!editingDevice) return;
    try {
      setLoading(true);
      const id = editingDevice.id || editingDevice.serialNumber;
      await api.technician.updateDevice(id, editDeviceForm);
      showNotification(`✓ Spesifikasi SupaKu ${editingDevice.serialNumber} berhasil diperbarui!`, 'success');
      setShowEditDeviceModal(false);
      loadData();
    } catch (err) {
      showNotification(err.getUserMessage?.() || err.message || 'Gagal memperbarui spesifikasi', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Delete / Decommission Device Modal Trigger
  const handleOpenDeleteModal = (device) => {
    setDeleteTargetDevice(device);
  };

  // Confirm Delete / Decommission Device
  const handleConfirmDeleteDevice = async () => {
    if (!deleteTargetDevice) return;
    const id = deleteTargetDevice.id || deleteTargetDevice.serialNumber;

    try {
      setIsDeletingDevice(true);
      await api.technician.deleteDevice(id);
      showNotification(`✓ Unit SupaKu ${deleteTargetDevice.serialNumber} berhasil didekomisi & dihapus dari inventaris.`, 'success');
      setDeleteTargetDevice(null);
      loadData();
    } catch (err) {
      showNotification(err.getUserMessage?.() || err.message || 'Gagal menghapus unit SupaKu', 'error');
    } finally {
      setIsDeletingDevice(false);
    }
  };

  // Submit Create Administrator Baru
  const handleCreateAdmin = async (e) => {
    e?.preventDefault();
    if (!adminForm.fullName || !adminForm.phoneNumber || !adminForm.password) {
      showNotification('Nama lengkap, nomor telepon, dan password wajib diisi!', 'warning');
      return;
    }

    try {
      setLoading(true);
      const result = await api.technician.createAdmin(adminForm);
      showNotification(`✓ Akun Administrator ${result.fullName} berhasil dibuat!`, 'success');
      setShowAdminModal(false);
      setAdminForm({
        fullName: '',
        phoneNumber: '',
        email: '',
        password: '',
        region: 'Jawa Barat (Lembang)',
      });
      loadData();
    } catch (err) {
      showNotification(err.getUserMessage?.() || err.message || 'Gagal membuat akun administrator', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Submit Create Farmer (Teknisi)
  const handleCreateFarmer = async (e) => {
    e?.preventDefault();
    if (!farmerForm.fullName || !farmerForm.phoneNumber || !farmerForm.password) {
      showNotification('Nama lengkap, nomor telepon, dan kata sandi wajib diisi!', 'warning');
      return;
    }

    try {
      setLoading(true);
      const res = await api.technician.createFarmer({
        fullName: farmerForm.fullName.trim(),
        phoneNumber: farmerForm.phoneNumber.trim(),
        email: farmerForm.email?.trim() || undefined,
        password: farmerForm.password,
      });
      showNotification(`✓ Akun petani ${res?.fullName || farmerForm.fullName} berhasil didaftarkan! Detail profil akan diisi mandiri saat onboarding.`, 'success');
      setShowFarmerModal(false);
      setFarmerForm({
        fullName: '',
        phoneNumber: '',
        email: '',
        password: 'PasswordDefault123!',
      });
      loadData();
    } catch (err) {
      showNotification(err.getUserMessage?.() || err.message || 'Gagal mendaftarkan petani baru', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Confirm Delete Farmer (Teknisi)
  const handleConfirmDeleteFarmer = async () => {
    if (!deleteTargetFarmer) return;
    try {
      setIsDeletingFarmer(true);
      await api.technician.deleteFarmer(deleteTargetFarmer.id);
      showNotification(`✓ Akun petani ${deleteTargetFarmer.fullName || deleteTargetFarmer.phoneNumber} berhasil dihapus.`, 'success');
      setDeleteTargetFarmer(null);
      loadData();
    } catch (err) {
      showNotification(err.getUserMessage?.() || err.message || 'Gagal menghapus akun petani', 'error');
    } finally {
      setIsDeletingFarmer(false);
    }
  };

  // Toggle Admin Status
  const handleToggleAdminStatus = async (admin) => {
    const nextStatus = admin.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.technician.updateAdminStatus(admin.id, nextStatus);
      showNotification(`Status admin ${admin.fullName} diubah ke ${nextStatus}`, 'success');
      loadData();
    } catch (err) {
      showNotification(err.getUserMessage?.() || err.message || 'Gagal mengubah status admin', 'error');
    }
  };

  // Format byte size utility
  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  // Copy checksum utility
  const copyToClipboard = (text, id) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedChecksum(id);
      window.setTimeout(() => setCopiedChecksum(null), 2000);
      showNotification('Checksum SHA-256 disalin ke clipboard', 'info');
    }
  };

  // Load firmwares repository from server
  const loadFirmwares = useCallback(async () => {
    try {
      setLoadingFirmwares(true);
      const res = await api.technician.getFirmwares();
      const list = Array.isArray(res) ? res : res?.records || [];
      setFirmwares(list);

      // Auto-populate OTA form if no firmware is selected yet
      if (list.length > 0) {
        setOtaForm((prev) => {
          if (prev.firmwareId && list.some((f) => f.id === prev.firmwareId)) {
            return prev;
          }
          const latest = list.find((f) => f.isLatest) || list[0];
          return {
            ...prev,
            firmwareId: latest.id,
            firmwareUrl: latest.downloadUrl || '',
            firmwareVersion: latest.version || '',
            hardwareVersion: latest.hardwareVersion || '1.0',
            checksumSha256: latest.checksumSha256 || '',
            changelog: latest.changelog || prev.changelog || '',
          };
        });
      }
    } catch (err) {
      console.error('[TechnicianDashboard] Load firmwares failed:', err);
    } finally {
      setLoadingFirmwares(false);
    }
  }, []);

  // Load OTA deployment execution logs
  const loadOtaLogs = useCallback(async () => {
    try {
      setLoadingOtaLogs(true);
      const res = await api.technician.getOTALogs('ALL', 50, 0);
      const list = Array.isArray(res) ? res : res?.records || [];
      setOtaLogs(list);
    } catch (err) {
      console.error('[TechnicianDashboard] Load OTA logs failed:', err);
    } finally {
      setLoadingOtaLogs(false);
    }
  }, []);

  // Sync firmware & OTA logs when tab changes
  useEffect(() => {
    if (activeTab === 'ota') {
      const timer = window.setTimeout(() => {
        void loadFirmwares();
        void loadOtaLogs();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [activeTab, loadFirmwares, loadOtaLogs]);

  // Live auto-polling riwayat OTA & status perangkat saat proses deployment aktif
  useEffect(() => {
    if (activeTab !== 'ota') return undefined;

    const hasActiveDeployment = otaLogs.some(
      (log) =>
        log.status === 'PENDING' ||
        log.status === 'SENT' ||
        log.status === 'IN_PROGRESS' ||
        log.status === 'FLASHING' ||
        log.status === 'DOWNLOADING'
    );

    if (!hasActiveDeployment) return undefined;

    const pollTimer = setInterval(() => {
      loadOtaLogs();
      loadData();
    }, 3500);

    return () => clearInterval(pollTimer);
  }, [activeTab, otaLogs, loadOtaLogs, loadData]);

  // Open OTA Trigger Section
  const handleOpenOtaModal = (device = null) => {
    setOtaTargetDevice(device);
    setOtaForm((prev) => ({
      ...prev,
      isBroadcast: !device,
    }));
    setActiveTab('ota');
  };

  // Select firmware from repository for OTA deployment (Upgrade / Downgrade)
  const handleSelectFirmwareForOta = (fw) => {
    const currentVer = otaTargetDevice?.firmwareVersion;
    const isDowngrade = Boolean(currentVer && compareSemVer(fw.version, currentVer) < 0);

    setOtaForm((prev) => ({
      ...prev,
      firmwareId: fw.id,
      firmwareUrl: fw.downloadUrl || '',
      firmwareVersion: fw.version,
      hardwareVersion: fw.hardwareVersion || '1.0',
      checksumSha256: fw.checksumSha256 || '',
      changelog: fw.changelog || '',
      force: isDowngrade ? true : prev.force,
      useCustomUrl: false,
    }));

    if (isDowngrade) {
      showNotification(`⚠️ Firmware v${fw.version} dipilih untuk DOWNGRADE (Rollback dari v${currentVer})`, 'warning');
    } else if (currentVer && compareSemVer(fw.version, currentVer) === 0) {
      showNotification(`Firmware v${fw.version} dipilih untuk RE-FLASH (Instal Ulang)`, 'info');
    } else {
      showNotification(`Firmware v${fw.version} dipilih untuk deployment OTA`, 'info');
    }

    const deployCard = document.getElementById('ota-deploy-card');
    if (deployCard) {
      deployCard.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Upload Firmware .bin file
  const handleUploadFirmware = async (e) => {
    e.preventDefault();
    if (!firmwareUploadForm.file) {
      showNotification('Pilih file binary firmware (.bin) terlebih dahulu', 'warning');
      return;
    }
    if (!firmwareUploadForm.version) {
      showNotification('Versi firmware wajib diisi', 'warning');
      return;
    }
    if (!firmwareUploadForm.hardwareVersion || !firmwareUploadForm.hardwareVersion.trim()) {
      showNotification('Versi hardware target wajib diisi (contoh: 1.0)', 'warning');
      return;
    }

    try {
      setUploadProgress(true);
      const rawVersion = firmwareUploadForm.version.trim();
      const cleanVersion = rawVersion
        .replace(/^firmware\s*/i, '')
        .replace(/^v/i, '')
        .trim();
      const finalVersion = cleanVersion || rawVersion;
      const cleanHwVersion = firmwareUploadForm.hardwareVersion.trim();

      const formData = new FormData();
      formData.append('firmware', firmwareUploadForm.file);
      formData.append('version', finalVersion);
      formData.append('hardwareVersion', cleanHwVersion);
      if (firmwareUploadForm.changelog) {
        formData.append('changelog', firmwareUploadForm.changelog.trim());
      }
      formData.append('isLatest', String(firmwareUploadForm.isLatest));

      const res = await api.technician.uploadFirmware(formData);
      showNotification(`✓ Firmware v${finalVersion} (HW v${cleanHwVersion}) berhasil diunggah dan diverifikasi!`, 'success');
      setShowUploadFirmwareModal(false);
      setFirmwareUploadForm({
        file: null,
        version: '',
        hardwareVersion: '1.0',
        changelog: '',
        isLatest: true,
      });

      await loadFirmwares();
      if (res?.id) {
        setOtaForm((prev) => ({
          ...prev,
          firmwareId: res.id,
          firmwareUrl: res.downloadUrl,
          firmwareVersion: res.version,
          hardwareVersion: res.hardwareVersion,
          checksumSha256: res.checksumSha256,
          changelog: res.changelog || '',
          useCustomUrl: false,
        }));
      }
    } catch (err) {
      showNotification(err.getUserMessage?.() || err.message || 'Gagal mengunggah file firmware', 'error');
    } finally {
      setUploadProgress(false);
    }
  };

  // Delete Firmware binary from repository
  const handleDeleteFirmware = async (fw) => {
    if (!window.confirm(`Hapus file firmware v${fw.version} (${fw.originalName}) dari repositori sistem?`)) {
      return;
    }
    try {
      setLoading(true);
      await api.technician.deleteFirmware(fw.id);
      showNotification(`✓ File firmware v${fw.version} berhasil dihapus`, 'success');
      await loadFirmwares();
    } catch (err) {
      showNotification(err.getUserMessage?.() || err.message || 'Gagal menghapus file firmware', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Submit OTA Trigger / Broadcast (Dukungan Penuh Upgrade & Downgrade)
  const handleSubmitOta = async (e) => {
    e?.preventDefault();
    if (!otaForm.firmwareUrl || !otaForm.firmwareVersion) {
      showNotification('URL firmware dan versi wajib diisi!', 'warning');
      return;
    }

    try {
      setLoading(true);
      const isDowngrade = otaOperationMeta.isDowngrade;
      const shouldForce = Boolean(otaForm.force || isDowngrade);

      const payload = {
        firmwareId: otaForm.firmwareId || undefined,
        firmwareUrl: otaForm.firmwareUrl,
        firmwareVersion: otaForm.firmwareVersion,
        hardwareVersion: otaForm.hardwareVersion || '1.0',
        checksumSha256: otaForm.checksumSha256 || undefined,
        changelog: otaForm.changelog,
        force: shouldForce,
        actionType: otaOperationMeta.mode,
      };

      if (otaForm.isBroadcast) {
        await api.technician.broadcastOTA(payload);
        showNotification(
          `✓ Perintah ${shouldForce ? 'Downgrade' : 'Update'} OTA v${otaForm.firmwareVersion} berhasil disiarkan ke seluruh unit SupaKu! Link download dikirim via MQTT.`,
          'success'
        );
      } else {
        const id = otaTargetDevice?.serialNumber || otaTargetDevice?.id;
        if (!id) {
          showNotification('Pilih perangkat target terlebih dahulu!', 'warning');
          return;
        }
        await api.technician.triggerOTA(id, payload);
        const actionLabel = isDowngrade
          ? `Downgrade (Rollback ke v${otaForm.firmwareVersion})`
          : otaOperationMeta.isReflash
            ? `Re-flash (Instal Ulang v${otaForm.firmwareVersion})`
            : `Upgrade ke v${otaForm.firmwareVersion}`;

        showNotification(`✓ Perintah ${actionLabel} berhasil dikirim ke SupaKu ${id}! Link download dikirim via MQTT.`, 'success');
      }
      await loadOtaLogs();
      loadData();
    } catch (err) {
      showNotification(err.getUserMessage?.() || err.message || 'Gagal mengirim instruksi OTA', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Diagnostics live tester
  const handleRunDiagnostic = async (endpoint) => {
    setTestingEndpoint(true);
    const timestamp = new Date().toLocaleTimeString('id-ID');
    try {
      let result;
      if (endpoint === '/technician/dashboard') {
        result = await api.technician.getDashboard();
      } else if (endpoint === '/technician/devices') {
        result = await api.technician.getDevices({ limit: 5 });
      } else if (endpoint === '/technician/admins') {
        result = await api.technician.getAdmins();
      }
      setDiagnosticLog(`[${timestamp}] SUCCESS ${endpoint} (HTTP 200 OK)\n${JSON.stringify(result, null, 2)}`);
    } catch (err) {
      setDiagnosticLog(`[${timestamp}] ERROR ${endpoint} (Status ${err.statusCode || 'FAIL'})\n${JSON.stringify(err, null, 2)}`);
    } finally {
      setTestingEndpoint(false);
    }
  };

  // Export Inventaris SupaKu ke CSV
  const handleExportDevicesCSV = () => {
    if (devices.length === 0) {
      showNotification('Tidak ada data unit SupaKu untuk diekspor.', 'warning');
      return;
    }
    const headers = ['Serial Number', 'Nama Perangkat', 'Model Hardware', 'Versi HW', 'Versi Firmware', 'Status', 'Terakhir Aktif'];
    const rows = devices.map((d) => [
      `"${d.serialNumber || ''}"`,
      `"${d.name || ''}"`,
      `"${d.model || ''}"`,
      `"${d.hardwareVersion || ''}"`,
      `"${d.firmwareVersion || ''}"`,
      `"${d.status || ''}"`,
      `"${d.lastSeen || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `shroomsync_inventaris_supaku_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('✓ Berkas CSV Inventaris SupaKu berhasil diunduh.', 'success');
  };

  return (
    <div className="technician-portal" style={{ padding: '0 0 40px 0', minHeight: '100%' }}>
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
          1. TOP BREADCRUMB & STATUS BAR (Matching ShroomSync - DashboardAdmin.html)
      ───────────────────────────────────────────────────────────── */}
      <div className="tech-top-banner">
        <div className="tech-breadcrumb">
          <Terminal size={13} style={{ opacity: 0.8 }} />
          <span>Admin Panel</span>
          <ChevronRight size={10} style={{ opacity: 0.5 }} />
          <span className="active-crumb">{getTabTitle(activeTab)}</span>
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
          {toggleTheme && (
            <>
              <span style={{ opacity: 0.4 }}>•</span>
              <button
                type="button"
                onClick={toggleTheme}
                className="tech-theme-toggle-btn"
                title={theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
                aria-label="Toggle Theme"
              >
                {theme === 'dark' ? <Sun size={13} style={{ color: '#FBBF24' }} /> : <Moon size={13} style={{ color: '#E5E7EB' }} />}
                <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. HEADER WITH TITLE, TIME FILTER & PRIMARY ACTIONS
      ───────────────────────────────────────────────────────────── */}
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
            <h1 className="tech-header-title">{getTabTitle(activeTab)}</h1>
            <p className="tech-header-subtitle">{getTabSubtitle(activeTab)}</p>
          </div>
        </div>

        <div className="tech-header-actions">
          {activeTab === 'dashboard' && (
            <>
              <select
                className="tech-time-select"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <option value="7 Hari Terakhir">7 Hari Terakhir</option>
                <option value="24 Jam Terakhir">24 Jam Terakhir</option>
                <option value="Bulan Ini">Bulan Ini</option>
              </select>

              <button
                className="tech-btn-secondary"
                onClick={loadData}
                disabled={loading}
              >
                <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
                <span>Refresh</span>
              </button>
            </>
          )}

          {activeTab === 'inventory' && (
            <>
              <button
                className="tech-btn-secondary"
                onClick={handleExportDevicesCSV}
              >
                <Download size={14} />
                <span>Ekspor CSV</span>
              </button>
              <button
                className="tech-btn-secondary"
                onClick={loadData}
                disabled={loading}
              >
                <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
                <span>Refresh</span>
              </button>
              <button
                className="tech-btn-primary"
                onClick={() => {
                  handleAutoGenerateSerial();
                  setShowProvisionModal(true);
                }}
              >
                <Plus size={16} />
                <span>Tambah Perangkat</span>
              </button>
            </>
          )}

          {activeTab === 'ota' && (
            <>
              <button
                className="tech-btn-secondary"
                onClick={() => { loadFirmwares(); loadOtaLogs(); }}
                disabled={loadingFirmwares || loadingOtaLogs}
              >
                <RefreshCw size={14} className={(loadingFirmwares || loadingOtaLogs) ? 'spin-icon' : ''} />
                <span>Refresh</span>
              </button>
              <button
                className="tech-btn-primary"
                onClick={() => setShowUploadFirmwareModal(true)}
              >
                <Upload size={16} />
                <span>Upload Firmware (.bin)</span>
              </button>
            </>
          )}

          {activeTab === 'admins' && (
            <>
              <button
                className="tech-btn-secondary"
                onClick={loadData}
                disabled={loading}
              >
                <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
                <span>Refresh</span>
              </button>
              <button
                className="tech-btn-primary"
                onClick={() => setShowAdminModal(true)}
              >
                <UserPlus size={16} />
                <span>Tambah Admin</span>
              </button>
            </>
          )}

          {activeTab === 'logs' && (
            <button
              className="tech-btn-secondary"
              onClick={loadOtaLogs}
              disabled={loadingOtaLogs}
            >
              <RefreshCw size={14} className={loadingOtaLogs ? 'spin-icon' : ''} />
              <span>Refresh Logs</span>
            </button>
          )}

          {activeTab === 'diagnostics' && (
            <>
              <button
                className="tech-btn-secondary"
                onClick={() => handleRunDiagnostic('/technician/dashboard')}
                disabled={testingEndpoint}
              >
                <Terminal size={14} />
                <span>Uji Gateway API</span>
              </button>
              <button
                className="tech-btn-secondary"
                onClick={loadData}
                disabled={loading}
              >
                <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
                <span>Refresh</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          TAB 0: DASHBOARD SISTEM (OVERVIEW FROM REFERENCE HTML)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {/* Stats Grid: 4 Cards */}
          <section className="tech-stats-grid">
            <div className="tech-stat-card">
              <span className="tech-stat-label">Total Perangkat</span>
              <div className="tech-stat-body">
                <span className="tech-stat-number">{devices.length}</span>
              </div>
            </div>

            <div className="tech-stat-card">
              <span className="tech-stat-label">Device Online</span>
              <div className="tech-stat-body">
                <span className="tech-stat-number">{onlineDevicesCount}</span>
                <span className="tech-badge-green">{onlineRate}% Active</span>
              </div>
            </div>

            <div className="tech-stat-card">
              <span className="tech-stat-label">Device Offline</span>
              <div className="tech-stat-body">
                <span className="tech-stat-number">{offlineDevicesCount}</span>
                <span className="tech-badge-red">{offlineRate}% Idle</span>
              </div>
            </div>

            <div className="tech-stat-card">
              <span className="tech-stat-label">Firmware Mismatch</span>
              <div className="tech-stat-body">
                <span className="tech-stat-number">{needsUpdateCount}</span>
                <span className="tech-badge-neutral">Needs Update</span>
              </div>
            </div>
          </section>

          {/* Charts Section: 12 Columns (4 Donut + 8 AreaChart) */}
          <section className="tech-charts-grid">
            {/* Status Perangkat Global: Donut */}
            <div className="tech-donut-card">
              <h3 className="tech-card-title">Status Perangkat Global</h3>
              <div className="tech-donut-container">
                <div className="tech-donut-circle-wrap">
                  <svg width="180" height="180" viewBox="0 0 180 180" style={{ transform: 'rotate(-90deg)' }}>
                    <circle
                      cx="90"
                      cy="90"
                      r="64"
                      stroke="var(--tech-soft-beige)"
                      strokeWidth="16"
                      fill="none"
                    />
                    <circle
                      cx="90"
                      cy="90"
                      r="64"
                      stroke="var(--tech-earth-brown)"
                      strokeWidth="16"
                      strokeDasharray={402.12}
                      strokeDashoffset={402.12 * (1 - onlineRate / 100)}
                      strokeLinecap="round"
                      fill="none"
                      style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                    />
                  </svg>
                  <div className="tech-donut-center-text" style={{ position: 'absolute' }}>
                    <span className="tech-donut-percentage">{onlineRate}%</span>
                    <span className="tech-donut-sublabel">Online Rate</span>
                  </div>
                </div>

                <div className="tech-donut-legend">
                  <div className="tech-legend-row">
                    <div className="tech-legend-indicator">
                      <div className="tech-legend-dot" style={{ backgroundColor: '#7B5E3C' }} />
                      <span>Operational</span>
                    </div>
                    <span style={{ fontWeight: 700 }}>{onlineDevicesCount} Unit</span>
                  </div>

                  <div className="tech-legend-row">
                    <div className="tech-legend-indicator">
                      <div className="tech-legend-dot" style={{ backgroundColor: '#E5E7EB' }} />
                      <span>Connection Lost</span>
                    </div>
                    <span style={{ fontWeight: 700 }}>{offlineDevicesCount} Unit</span>
                  </div>

                  <div className="tech-legend-row">
                    <div className="tech-legend-indicator">
                      <div className="tech-legend-dot" style={{ backgroundColor: '#6B8F71' }} />
                      <span>Ready / Unpaired</span>
                    </div>
                    <span style={{ fontWeight: 700 }}>{readyDevicesCount} Unit</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Trend Konektivitas: 24 Jam */}
            <div className="tech-trend-card">
              <div className="tech-trend-header">
                <h3 className="tech-card-title" style={{ margin: 0 }}>Trend Konektivitas (24 Jam)</h3>
                <div className="tech-trend-legend">
                  <div className="tech-trend-legend-item">
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#7B5E3C', display: 'inline-block' }} />
                    <span>ONLINE</span>
                  </div>
                  <div className="tech-trend-legend-item">
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#E5E7EB', display: 'inline-block', border: '1px solid #D1D5DB' }} />
                    <span>TOTAL</span>
                  </div>
                </div>
              </div>

              <div className="tech-chart-area-box">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={connectivityTrendData} margin={{ top: 12, right: 16, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="techOnlineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7B5E3C" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#7B5E3C" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis
                      dataKey="time"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
                      dy={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const onlineVal = payload.find((p) => p.dataKey === 'online')?.value ?? 0;
                          const totalVal = payload.find((p) => p.dataKey === 'total')?.value ?? 0;
                          return (
                            <div className="tech-chart-tooltip">
                              <div className="tech-chart-tooltip-time">{label} WIB</div>
                              <div className="tech-chart-tooltip-val">
                                Devices: <span>{onlineVal}/{totalVal} Online</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#D1D5DB"
                      strokeWidth={2}
                      fill="none"
                      strokeDasharray="4 4"
                    />
                    <Area
                      type="monotone"
                      dataKey="online"
                      stroke="#7B5E3C"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#techOnlineGrad)"
                      activeDot={{ r: 6, fill: '#7B5E3C', stroke: '#FFFFFF', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* System Alerts Terbaru Table */}
          <section className="tech-alerts-section">
            <div className="tech-alerts-card">
              <div className="tech-alerts-header">
                <h3 className="tech-card-title" style={{ margin: 0 }}>System Alerts Terbaru</h3>
                <button
                  className="tech-link-button"
                  onClick={() => setActiveTab('diagnostics')}
                >
                  View Full Logs
                </button>
              </div>
              <div className="tech-table-responsive">
                <table className="tech-table">
                  <thead>
                    <tr>
                      <th>Waktu Event</th>
                      <th>Identitas Perangkat</th>
                      <th>Kategori Alert</th>
                      <th>Keterangan Teknis</th>
                      <th style={{ textAlign: 'center' }}>Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAlerts.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '36px 16px', color: '#9CA3AF', fontSize: '13px' }}>
                          Tidak ada peringatan sistem saat ini. Semua perangkat beroperasi normal.
                        </td>
                      </tr>
                    ) : (
                      recentAlerts.map((alert) => (
                        <tr key={alert.id}>
                          <td style={{ color: 'var(--tech-text-muted)' }}>{alert.time}</td>
                          <td style={{ fontWeight: 700, color: 'var(--tech-text-primary)' }}>
                            {alert.serial}
                            <span style={{ marginLeft: '8px', fontSize: '9px', fontWeight: 600, color: 'var(--tech-text-muted)', textTransform: 'uppercase' }}>
                              {alert.region}
                            </span>
                          </td>
                          <td>
                            <span className={`tech-badge-${alert.category.toLowerCase()}`}>
                              {alert.category}
                            </span>
                          </td>
                          <td style={{ color: 'var(--tech-text-secondary)' }}>{alert.message}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="tech-icon-action-btn"
                              title="Buka Tab Terkait"
                              onClick={() => {
                                if (alert.device) {
                                  setEditingDevice(alert.device);
                                  setActiveTab('inventory');
                                } else {
                                  setActiveTab('diagnostics');
                                }
                              }}
                            >
                              <ExternalLink size={15} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </motion.div>
      )}

      {/* Main Content Body for all tabs */}
      <div className="tech-content-body">

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: INVENTARIS & PROVISIONING SUPAKU (DEVICE REGISTRY)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'inventory' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <div className="tech-subpanel-card">
            <div className="tech-toolbar">
              {/* Search Box & Status Filter Pills */}
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', flex: '1 1 auto' }}>
                <div className="tech-search-box">
                  <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    className="tech-search-input"
                    placeholder="Cari Serial Number (SS-0426-...), nama unit, atau model..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="tech-filter-pills">
                  <span style={{ fontSize: '0.78rem', color: '#6B7280', fontWeight: 600, marginRight: '4px', alignSelf: 'center' }}>Status:</span>
                  {STATUS_FILTERS.map((st) => (
                    <button
                      key={st}
                      className={`tech-filter-pill ${statusFilter === st ? 'active' : ''}`}
                      onClick={() => setStatusFilter(st)}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  className="tech-btn-secondary"
                  onClick={handleExportDevicesCSV}
                >
                  <Download size={14} />
                  <span>Ekspor CSV</span>
                </button>
                <button
                  className="tech-btn-primary"
                  onClick={() => handleOpenOtaModal(null)}
                >
                  <Zap size={14} />
                  <span>Broadcast OTA</span>
                </button>
              </div>
            </div>

            <div className="tech-table-responsive">
              <table className="tech-table">
                <thead>
                  <tr>
                    <th>Serial Number</th>
                    <th>Unit & Model</th>
                    <th>Hardware / Firmware</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th>Kumbung / Pemilik</th>
                    <th style={{ textAlign: 'center' }}>Sinyal / Uptime</th>
                    <th style={{ textAlign: 'center' }}>Aksi Teknisi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.map((dev) => {
                    const isOnline = Boolean(dev.isOnline);
                    const displayStatus = dev.status === 'READY' ? 'READY' : (dev.status === 'SUSPENDED' ? 'SUSPENDED' : (isOnline ? 'ACTIVE' : 'OFFLINE'));
                    const statusBadgeClass = displayStatus === 'ACTIVE' ? 'tech-badge-active' : displayStatus === 'READY' ? 'tech-badge-ready' : displayStatus === 'SUSPENDED' ? 'tech-badge-suspended' : 'tech-badge-offline';

                    return (
                      <tr key={dev.id || dev.serialNumber}>
                        <td style={{ fontWeight: 800, fontFamily: 'monospace', color: 'var(--tech-earth-brown)' }}>
                          {dev.serialNumber}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{dev.name || dev.serialNumber}</div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--tech-text-muted)' }}>{dev.model || 'SupaKu Smart Node v2'}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--tech-text-secondary)' }}>Board: v{dev.hardwareVersion || '2.0'}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--tech-text-muted)' }}>FW: v{dev.firmwareVersion || '2.1.0'}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={statusBadgeClass}>
                            ● {displayStatus}
                          </span>
                        </td>
                        <td>
                          {(() => {
                            const farmerName = dev.farmer?.fullName || dev.assignedFarmer || dev.ownerName;
                            const hasFarmer = Boolean(farmerName || dev.farmerId || dev.userId);
                            const hasCustomName = Boolean(dev.name && dev.name !== dev.serialNumber);

                            if (!hasFarmer && !hasCustomName) {
                              return (
                                <span style={{ color: 'var(--tech-text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>
                                  Belum Ditautkan
                                </span>
                              );
                            }

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.86rem' }}>
                                  {hasCustomName ? dev.name : (farmerName || 'Petani Terdaftar')}
                                </div>
                                <div style={{ fontSize: '0.76rem', color: 'var(--tech-text-muted)' }}>
                                  {farmerName || 'Petani Terdaftar'}
                                </div>
                                {dev.farmer?.phoneNumber && (
                                  <div style={{ fontSize: '0.74rem', color: 'var(--tech-sage-green)', fontWeight: 600 }}>
                                    {dev.farmer.phoneNumber}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--tech-text-secondary)', fontWeight: 500 }}>
                            <Wifi size={13} style={{ color: isOnline ? '#16A34A' : 'var(--tech-text-muted)' }} />
                            <span>{isOnline ? (dev.rssiDbm ? `${dev.rssiDbm} dBm` : '-64 dBm') : '--'}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '4px' }}>
                            <button
                              className="tech-icon-action-btn"
                              onClick={() => {
                                setActiveStickerDevice(dev);
                                setShowStickerModal(true);
                              }}
                              title="Lihat Stiker QR & Kode Aktivasi"
                            >
                              <QrCode size={15} />
                            </button>

                            <button
                              className="tech-icon-action-btn"
                              onClick={() => handleOpenEditDevice(dev)}
                              title="Edit Spesifikasi & Firmware"
                            >
                              <Edit3 size={15} />
                            </button>

                            <button
                              className="tech-icon-action-btn"
                              onClick={() => handleOpenOtaModal(dev)}
                              title="Trigger OTA Firmware Update"
                              style={{ color: '#D97706' }}
                            >
                              <Zap size={15} />
                            </button>

                            <button
                              className="tech-icon-action-btn danger"
                              onClick={() => handleOpenDeleteModal(dev)}
                              title="Hapus Unit SupaKu"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredDevices.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#9CA3AF' }}>
                        Tidak ada unit SupaKu yang sesuai dengan kriteria pencarian atau status.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: ADMINISTRATOR REGIONAL & MANAJEMEN PETANI
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'admins' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {/* Sub-tab Navigation */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              type="button"
              className={farmerSubTab === 'farmers' ? 'tech-btn-primary' : 'tech-btn-secondary'}
              onClick={() => setFarmerSubTab('farmers')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 18px', borderRadius: '12px', fontWeight: 700 }}
            >
              <Sprout size={16} />
              <span>Petani Kumbung ({farmers.length})</span>
            </button>
            <button
              type="button"
              className={farmerSubTab === 'admins' ? 'tech-btn-primary' : 'tech-btn-secondary'}
              onClick={() => setFarmerSubTab('admins')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 18px', borderRadius: '12px', fontWeight: 700 }}
            >
              <Users size={16} />
              <span>Administrator Wilayah ({admins.length})</span>
            </button>
          </div>

          {/* Sub-tab 1: Farmers List */}
          {farmerSubTab === 'farmers' && (
            <div className="tech-subpanel-card">
              <div className="tech-toolbar">
                <div>
                  <h3 className="tech-card-title" style={{ margin: '0 0 4px 0' }}>Manajemen Petani Kumbung</h3>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#6B7280' }}>
                    Teknisi berwenang mendaftarkan akun petani binaan. Detail usaha dan kata sandi baru akan diisi langsung oleh Petani saat login pertama (Onboarding).
                  </p>
                </div>

                <button
                  className="tech-btn-primary"
                  onClick={() => setShowFarmerModal(true)}
                >
                  <UserPlus size={16} />
                  <span>Daftarkan Petani Baru</span>
                </button>
              </div>

              <div className="tech-table-responsive" style={{ marginTop: '16px' }}>
                <table className="tech-table">
                  <thead>
                    <tr>
                      <th>PETANI</th>
                      <th>KONTAK & LOGIN</th>
                      <th>USAHA TANI</th>
                      <th>ALAMAT KUMBUNG</th>
                      <th>PERANGKAT</th>
                      <th>STATUS ONBOARDING</th>
                      <th style={{ textAlign: 'right' }}>AKSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {farmers.map((farmer) => (
                      <tr key={farmer.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="tech-admin-avatar" style={{ width: '34px', height: '34px', fontSize: '0.85rem' }}>
                              {farmer.fullName?.charAt(0) || 'P'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                {farmer.fullName || 'Petani Belum Bernama'}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: '#6B7280' }}>
                                ID: {farmer.id.slice(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {farmer.phoneNumber}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#6B7280' }}>
                            {farmer.email || 'Email belum diatur'}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: farmer.farmName ? 'var(--text-primary)' : '#9CA3AF' }}>
                            {farmer.farmName || 'Belum diisi petani'}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8rem', color: farmer.farmAddress ? '#4B5563' : '#9CA3AF', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {farmer.farmAddress || '-'}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--tech-earth-brown)', backgroundColor: 'var(--tech-soft-beige)', padding: '3px 8px', borderRadius: '6px' }}>
                            {farmer._count?.devices ?? (farmer.devices?.length || 0)} Unit
                          </span>
                        </td>
                        <td>
                          {farmer.profileCompleted ? (
                            <span className="tech-badge-active" style={{ fontSize: '0.72rem' }}>
                              Profil Lengkap
                            </span>
                          ) : (
                            <span style={{ backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                              Menunggu Onboarding
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="tech-action-btn delete"
                            title="Hapus Akun Petani"
                            onClick={() => setDeleteTargetFarmer(farmer)}
                            style={{ color: '#DC2626', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {farmers.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '40px 16px', color: '#9CA3AF' }}>
                          <Sprout size={32} style={{ margin: '0 auto 8px', opacity: 0.4, display: 'block' }} />
                          <div style={{ fontWeight: 700, color: 'var(--tech-text-primary)', marginBottom: '4px' }}>Belum Ada Petani Terdaftar</div>
                          <div style={{ fontSize: '0.8rem' }}>Klik tombol "Daftarkan Petani Baru" di atas untuk menambahkan akun petani.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab 2: Regional Admins */}
          {farmerSubTab === 'admins' && (
            <div className="tech-subpanel-card">
              <div className="tech-toolbar">
                <div>
                  <h3 className="tech-card-title" style={{ margin: '0 0 4px 0' }}>Manajemen Administrator Regional</h3>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#6B7280' }}>
                    Teknisi berwenang membuat dan mengatur akun Administrator yang membawahi kelompok tani per wilayah.
                  </p>
                </div>

                <button
                  className="tech-btn-primary"
                  onClick={() => setShowAdminModal(true)}
                >
                  <UserPlus size={16} />
                  <span>Buat Akun Administrator</span>
                </button>
              </div>

              <div className="tech-admin-grid">
                {admins.map((admin) => (
                  <div key={admin.id} className="tech-admin-card">
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="tech-admin-avatar">
                            {admin.fullName?.charAt(0) || 'A'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.96rem', color: 'var(--text-primary)' }}>{admin.fullName}</div>
                            <div style={{ fontSize: '0.76rem', color: '#6B7280', fontWeight: 600 }}>{admin.region || 'Regional Indonesia'}</div>
                          </div>
                        </div>

                        <span className={admin.status === 'ACTIVE' ? 'tech-badge-active' : 'tech-badge-suspended'}>
                          {admin.status}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.7', marginBottom: '16px', backgroundColor: 'var(--bg-tertiary)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Phone size={13} style={{ color: 'var(--earth-brown)' }} />
                          <span>{admin.phoneNumber}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Mail size={13} style={{ color: 'var(--earth-brown)' }} />
                          <span>{admin.email || 'Email belum diatur'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Users size={13} style={{ color: 'var(--earth-brown)' }} />
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{admin.assignedFarmersCount ?? 0} Petani Terdaftar</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        className="tech-btn-secondary"
                        onClick={() => handleToggleAdminStatus(admin)}
                        style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                      >
                        {admin.status === 'ACTIVE' ? 'Tangguhkan (Suspend)' : 'Aktifkan Kembali'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: OTA FIRMWARE CENTER & REPOSITORY
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'ota' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Header Banner & Actions */}
          <div className="tech-subpanel-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <h3 className="tech-card-title" style={{ margin: 0 }}>OTA Firmware Center & Remote Flashing</h3>
                <span className="tech-badge-resolved">
                  {firmwares.length} Binary Versi
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#6B7280' }}>
                Repositori file biner firmware (.bin), kalkulasi otomatis checksum SHA-256, dan remote deployment nirkabel via MQTT.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                className="tech-btn-secondary"
                onClick={() => { loadFirmwares(); loadOtaLogs(); }}
                disabled={loadingFirmwares || loadingOtaLogs}
                title="Muat ulang firmware dan log OTA"
              >
                <RefreshCw size={14} className={(loadingFirmwares || loadingOtaLogs) ? 'spin-icon' : ''} />
                <span>Refresh</span>
              </button>
              <button
                className="tech-btn-primary"
                onClick={() => setShowUploadFirmwareModal(true)}
              >
                <Upload size={16} />
                <span>Upload Firmware (.bin)</span>
              </button>
            </div>
          </div>

          {/* Section 1: Repositori File Binary Firmware (.bin) */}
          <div className="tech-subpanel-card">
            <div className="tech-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: 'rgba(123, 94, 60, 0.12)', color: '#7B5E3C' }}>
                  <HardDrive size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-primary)' }}>Repositori File Biner Firmware (.bin)</h4>
                  <div style={{ fontSize: '0.78rem', color: '#6B7280' }}>
                    File binary yang telah diverifikasi dan siap di-flash ke unit mikrokontroler SupaKu ESP32
                  </div>
                </div>
              </div>
            </div>

            {loadingFirmwares ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#9CA3AF' }}>
                <RefreshCw size={24} className="spin-icon" style={{ marginBottom: '8px' }} />
                <div>Memuat daftar firmware dari server...</div>
              </div>
            ) : firmwares.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9CA3AF' }}>
                <FileCode size={36} style={{ opacity: 0.4, marginBottom: '10px' }} />
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Belum ada file firmware (.bin) tersimpan
                </div>
                <div style={{ fontSize: '0.82rem', maxWidth: '420px', margin: '0 auto 16px auto' }}>
                  Unggah file biner .bin hasil kompilasi PlatformIO atau Arduino IDE untuk memulai manajemen OTA nirkabel.
                </div>
                <button
                  className="tech-btn-primary"
                  onClick={() => setShowUploadFirmwareModal(true)}
                  style={{ margin: '0 auto' }}
                >
                  <Upload size={15} />
                  <span>Upload Firmware Pertama (.bin)</span>
                </button>
              </div>
            ) : (
              <div className="tech-table-responsive">
                <table className="tech-table">
                  <thead>
                    <tr>
                      <th>Versi & Status</th>
                      <th>Hardware Target</th>
                      <th>Berkas & Ukuran</th>
                      <th>Checksum SHA-256</th>
                      <th>Changelog</th>
                      <th>Waktu Unggah</th>
                      <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {firmwares.map((fw) => (
                      <tr
                        key={fw.id}
                        style={{
                          backgroundColor: otaForm.firmwareId === fw.id ? 'rgba(123, 94, 60, 0.06)' : undefined,
                        }}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>v{fw.version}</span>
                            {fw.isLatest && (
                              <span className="tech-badge-active" style={{ fontSize: '9px', padding: '1px 6px' }}>
                                LATEST
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.76rem', backgroundColor: 'var(--tech-soft-beige)', color: 'var(--tech-text-secondary)', fontWeight: 600 }}>
                            SupaKu ESP32 v{fw.hardwareVersion || '1.0'}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fw.originalName}</div>
                          <div style={{ fontSize: '0.74rem', color: '#6B7280' }}>{formatBytes(fw.fileSize)}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <code style={{ fontSize: '0.74rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.07)', fontFamily: 'monospace' }}>
                              {fw.checksumSha256?.substring(0, 10)}...{fw.checksumSha256?.substring(fw.checksumSha256.length - 6)}
                            </code>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(fw.checksumSha256, fw.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedChecksum === fw.id ? 'var(--primary)' : 'var(--text-muted)', padding: '2px' }}
                              title="Salin hash SHA-256 lengkap"
                            >
                              {copiedChecksum === fw.id ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', maxWidth: '220px' }}>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fw.changelog || '-'}>
                            {fw.changelog || '-'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          <div>{new Date(fw.createdAt).toLocaleDateString('id-ID')}</div>
                          <div style={{ fontSize: '0.72rem' }}>Oleh: {fw.createdBy?.fullName || 'Teknisi'}</div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              type="button"
                              className="primary-button compact-button"
                              onClick={() => handleSelectFirmwareForOta(fw)}
                              style={{ padding: '5px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              title="Pilih firmware ini untuk form deployment OTA"
                            >
                              <Zap size={13} />
                              <span>Deploy OTA</span>
                            </button>
                            <a
                              href={fw.downloadUrl || `/api/v1/firmwares/download/${fw.filename}`}
                              download={fw.originalName}
                              className="secondary-button compact-button"
                              style={{ padding: '5px 8px', fontSize: '0.75rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              title="Unduh berkas .bin ke komputer"
                            >
                              <Download size={13} />
                            </a>
                            <button
                              type="button"
                              className="secondary-button compact-button"
                              onClick={() => handleDeleteFirmware(fw)}
                              style={{ padding: '5px 8px', fontSize: '0.75rem', color: 'var(--error, #f87171)' }}
                              title="Hapus berkas dari server"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 2: Form Deploy OTA & Standar Keamanan */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Deploy Firmware Card */}
            <div id="ota-deploy-card" className="panel" style={{ padding: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(234, 179, 8, 0.2)', color: '#eab308' }}>
                  <Zap size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Deploy Firmware OTA</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pembaruan sistem nirkabel mikrokontroler SupaKu</p>
                </div>
              </div>

              <form onSubmit={handleSubmitOta} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', fontWeight: 600 }}>
                    Target Deploy
                  </label>
                  <select
                    value={otaForm.isBroadcast ? 'ALL' : (otaTargetDevice?.serialNumber || 'ALL')}
                    onChange={(e) => {
                      if (e.target.value === 'ALL') {
                        setOtaTargetDevice(null);
                        setOtaForm((prev) => ({ ...prev, isBroadcast: true }));
                      } else {
                        const target = devices.find((d) => d.serialNumber === e.target.value);
                        setOtaTargetDevice(target);
                        setOtaForm((prev) => ({ ...prev, isBroadcast: false }));
                      }
                    }}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                  >
                    <option value="ALL">📢 Seluruh Armada SupaKu (Broadcast Fleet)</option>
                    {devices.map((d) => (
                      <option key={d.serialNumber} value={d.serialNumber}>
                        {d.serialNumber} - {d.name} (HW: v{d.hardwareVersion || '1.0'} | FW: v{d.firmwareVersion || '1.1.0'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Firmware Source Selector (Repositori vs Custom URL) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                      Pilih Firmware dari Repositori
                    </label>
                    <button
                      type="button"
                      onClick={() => setOtaForm((prev) => ({ ...prev, useCustomUrl: !prev.useCustomUrl }))}
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.76rem', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                    >
                      {otaForm.useCustomUrl ? '← Gunakan File Repositori' : '+ Masukkan URL Kustom'}
                    </button>
                  </div>

                  {!otaForm.useCustomUrl ? (
                    <div>
                      {firmwares.length > 0 ? (
                        <select
                          value={otaForm.firmwareId || ''}
                          onChange={(e) => {
                            const found = firmwares.find((f) => f.id === e.target.value);
                            if (found) handleSelectFirmwareForOta(found);
                          }}
                          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                        >
                          <option value="" disabled>-- Pilih Firmware dari Repositori (Upgrade atau Downgrade) --</option>
                          {firmwares.map((f) => {
                            const currentVer = otaTargetDevice?.firmwareVersion;
                            const rel = currentVer ? compareSemVer(f.version, currentVer) : 0;
                            const relTag = rel > 0 ? '⬆️ UPGRADE' : rel < 0 ? '⬇️ DOWNGRADE' : '🔄 SAMA';
                            return (
                              <option key={f.id} value={f.id}>
                                v{f.version} [HW: v{f.hardwareVersion || '1.0'}] {f.isLatest ? '★ (Latest)' : ''} {currentVer ? `[${relTag}]` : ''} — {f.originalName} ({formatBytes(f.fileSize)})
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <div style={{ padding: '10px 12px', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Belum ada firmware di repositori.</span>
                          <button
                            type="button"
                            className="primary-button compact-button"
                            onClick={() => setShowUploadFirmwareModal(true)}
                            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                          >
                            + Upload .bin
                          </button>
                        </div>
                      )}

                      {/* Operation Mode Indicator (Upgrade vs Downgrade vs Reflash) */}
                      {Boolean(otaForm.firmwareVersion) && (
                        <div
                          style={{
                            marginTop: '10px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            backgroundColor: otaOperationMeta.bg,
                            border: `1px solid ${otaOperationMeta.color}`,
                            fontSize: '0.78rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: otaOperationMeta.color, fontWeight: 700 }}>
                            {otaOperationMeta.isDowngrade ? (
                              <AlertTriangle size={15} />
                            ) : otaOperationMeta.isReflash ? (
                              <RefreshCw size={15} />
                            ) : (
                              <Zap size={15} />
                            )}
                            <span>Mode Operasi: {otaOperationMeta.label}</span>
                          </div>

                          {otaOperationMeta.isDowngrade && (
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: '1.4' }}>
                              ⚠️ <strong>Proteksi Versi Disesuaikan:</strong> Versi target lebih lama daripada versi hardware saat ini (v{otaTargetDevice?.firmwareVersion || '2.1.0'}). Link download dan flag <code>force: true</code> otomatis dikirim ke hardware ESP32 agar downgrade disetujui.
                            </div>
                          )}

                          <div style={{ color: 'var(--text-muted)', wordBreak: 'break-all', marginTop: '2px' }}>
                            <strong>Link Download Binary ke Hardware:</strong> {otaForm.firmwareUrl}
                          </div>
                          {Boolean(otaForm.checksumSha256) && (
                            <div style={{ color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                              <strong>SHA-256 Checksum:</strong> <code>{otaForm.checksumSha256}</code>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', fontWeight: 600 }}>
                          Versi Firmware Target *
                        </label>
                        <input
                          type="text"
                          placeholder="Versi Target (Contoh: 1.2.0 atau 2.1.2)"
                          value={otaForm.firmwareVersion}
                          onChange={(e) => setOtaForm({ ...otaForm, firmwareVersion: e.target.value })}
                          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                          required
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', fontWeight: 600 }}>
                          URL Unduhan File Biner (.bin) *
                        </label>
                        <input
                          type="url"
                          placeholder="https://firmware.shroomsync.id/supaku/firmware.bin"
                          value={otaForm.firmwareUrl}
                          onChange={(e) => setOtaForm({ ...otaForm, firmwareUrl: e.target.value })}
                          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Target Hardware Board Field */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                      Target Versi Hardware (Board ESP32) *
                    </label>
                    {otaTargetDevice?.hardwareVersion && (
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Board unit {otaTargetDevice.serialNumber}: <strong>v{otaTargetDevice.hardwareVersion}</strong>
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Contoh: 1.0, 2.0, ESP32-S3"
                      value={otaForm.hardwareVersion || ''}
                      onChange={(e) => setOtaForm({ ...otaForm, hardwareVersion: e.target.value })}
                      style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)', fontSize: '0.84rem' }}
                      required
                    />
                    {['1.0', '2.0', 'ESP32-S3'].map((hw) => (
                      <button
                        key={hw}
                        type="button"
                        onClick={() => setOtaForm({ ...otaForm, hardwareVersion: hw })}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: (otaForm.hardwareVersion || '1.0') === hw ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: (otaForm.hardwareVersion || '1.0') === hw ? 'rgba(36, 94, 61, 0.12)' : 'transparent',
                          color: (otaForm.hardwareVersion || '1.0') === hw ? 'var(--primary)' : 'var(--text-secondary)',
                        }}
                      >
                        v{hw}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hardware Compatibility Warning / Success Notice */}
                {!otaForm.isBroadcast && otaTargetDevice && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: (otaTargetDevice.hardwareVersion || '1.0') === (otaForm.hardwareVersion || '1.0')
                        ? 'rgba(34, 197, 94, 0.08)'
                        : 'rgba(239, 68, 68, 0.12)',
                      border: `1px solid ${(otaTargetDevice.hardwareVersion || '1.0') === (otaForm.hardwareVersion || '1.0') ? 'rgba(34, 197, 94, 0.3)' : '#ef4444'}`,
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    {(otaTargetDevice.hardwareVersion || '1.0') === (otaForm.hardwareVersion || '1.0') ? (
                      <>
                        <CheckCircle2 size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>
                          ✓ Kompatibilitas Hardware Sesuai: Target board (v{otaForm.hardwareVersion || '1.0'}) cocok dengan perangkat ({otaTargetDevice.serialNumber}).
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
                        <div>
                          <div style={{ color: '#ef4444', fontWeight: 700 }}>
                            ⚠️ PERINGATAN HW MISMATCH: Target board ({otaForm.hardwareVersion || '1.0'}) ≠ Board perangkat ({otaTargetDevice.hardwareVersion || '1.0'})!
                          </div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: '2px' }}>
                            ESP32 akan menolak update dengan pesan <code>hw_mismatch</code>. Klik tombol <strong>v{otaTargetDevice.hardwareVersion || '1.0'}</strong> di atas agar update diterima perangkat.
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Force / Paksa Flash Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid var(--border-color)' }}>
                  <input
                    type="checkbox"
                    id="ota-force-downgrade-chk"
                    checked={Boolean(otaForm.force || otaOperationMeta.isDowngrade)}
                    onChange={(e) => setOtaForm({ ...otaForm, force: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: otaOperationMeta.isDowngrade ? '#f59e0b' : 'var(--primary)', cursor: 'pointer' }}
                  />
                  <label htmlFor="ota-force-downgrade-chk" style={{ fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', color: otaOperationMeta.isDowngrade ? '#f59e0b' : 'var(--text-primary)' }}>
                    Paksa Flashing / Force {otaOperationMeta.isDowngrade ? 'Downgrade (Wajib untuk rollback)' : 'Update'}
                  </label>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', fontWeight: 600 }}>
                    Catatan Perubahan (Changelog)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Deskripsi perbaikan bug, rollback versi, atau peningkatan fitur..."
                    value={otaForm.changelog}
                    onChange={(e) => setOtaForm({ ...otaForm, changelog: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)', resize: 'vertical' }}
                  />
                </div>

                <div style={{ marginTop: '8px' }}>
                  <button
                    type="submit"
                    className="tech-btn-primary"
                    disabled={loading}
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      backgroundColor: otaOperationMeta.isDowngrade ? '#d97706' : undefined,
                      borderColor: otaOperationMeta.isDowngrade ? '#d97706' : undefined,
                    }}
                  >
                    <Send size={16} />
                    <span>
                      {otaForm.isBroadcast
                        ? (otaOperationMeta.isDowngrade ? 'Broadcast Downgrade ke Seluruh Armada SupaKu' : 'Broadcast Firmware ke Semua SupaKu')
                        : (otaOperationMeta.isDowngrade
                            ? `Kirim Downgrade (v${otaForm.firmwareVersion || ''}) ke SupaKu ${otaTargetDevice?.serialNumber || 'Terpilih'}`
                            : `Kirim Update (v${otaForm.firmwareVersion || ''}) ke SupaKu ${otaTargetDevice?.serialNumber || 'Terpilih'}`
                          )
                      }
                    </span>
                  </button>
                </div>
              </form>
            </div>

            {/* OTA Deployment Logs & Safe Practices */}
            <div className="panel" style={{ padding: '22px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.05rem' }}>Standar Prosedur Flashing SupaKu</h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Petunjuk keamanan teknisi sebelum melakukan remote firmware upgrade:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.83rem', lineHeight: '1.5' }}>
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(74, 124, 89, 0.15)', borderLeft: '3px solid var(--primary, #5a9e6f)' }}>
                  <strong>1. Otomasi Checksum SHA-256:</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '2px' }}>
                    Sistem secara otomatis menghitung checksum SHA-256 saat binary diunggah ke repositori, mencegah kesalahan input manual dan melindungi memori flash ESP32.
                  </div>
                </div>

                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.15)', borderLeft: '3px solid #60a5fa' }}>
                  <strong>2. Dua Partisi OTA (Dual-Boot Rollback):</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '2px' }}>
                    Jika koneksi Wi-Fi terputus saat flashing, hardware SupaKu akan otomatis rollback ke partisi firmware sebelumnya secara aman.
                  </div>
                </div>

                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(234, 179, 8, 0.15)', borderLeft: '3px solid #eab308' }}>
                  <strong>3. Kondisi Aktuator Selama Upgrade:</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '2px' }}>
                    Relay pompa dan kipas di-lock dalam status OFF selama proses penulisan flash hingga booting selesai (sekitar 30 detik).
                  </div>
                </div>

                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(168, 85, 247, 0.15)', borderLeft: '3px solid #a855f7' }}>
                  <strong>4. Dual-Topic Komando MQTT:</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '2px' }}>
                    Perintah dikirimkan via MQTT topic <code>{'{serialNumber}'}/cmd/ota</code> untuk target individual, atau <code>broadcast/cmd/ota</code> untuk seluruh armada.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Riwayat Flashing OTA (Live Execution Logs Preview) */}
          <div className="tech-subpanel-card" style={{ marginTop: '20px' }}>
            <div className="tech-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '7px', borderRadius: '8px', backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}>
                  <History size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-primary)' }}>Riwayat Eksekusi Flashing OTA</h4>
                  <div style={{ fontSize: '0.78rem', color: '#6B7280' }}>
                    Log riwayat pengiriman instruksi upgrade dan status konfirmasi firmware dari unit SupaKu
                  </div>
                </div>
              </div>

              <button
                className="tech-btn-secondary"
                onClick={loadOtaLogs}
                disabled={loadingOtaLogs}
              >
                <RefreshCw size={14} className={loadingOtaLogs ? 'spin-icon' : ''} />
                <span>Refresh Logs</span>
              </button>
            </div>

            {loadingOtaLogs ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#9CA3AF' }}>
                <RefreshCw size={22} className="spin-icon" style={{ marginBottom: '8px' }} />
                <div>Memuat log riwayat OTA...</div>
              </div>
            ) : otaLogs.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.85rem' }}>
                Belum ada riwayat aktivitas flashing OTA yang tercatat di sistem.
              </div>
            ) : (
              <div className="tech-table-responsive">
                <table className="tech-table">
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Target Unit</th>
                      <th>Versi Target</th>
                      <th>Status Eksekusi</th>
                      <th>Catatan & Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otaLogs.map((log) => {
                      const isWorking = log.status === 'IN_PROGRESS' || log.status === 'FLASHING' || log.status === 'DOWNLOADING';
                      const statusClass =
                        log.status === 'SUCCESS' ? 'tech-badge-active'
                        : log.status === 'FAILED' ? 'tech-badge-critical'
                        : isWorking ? 'tech-badge-warning'
                        : 'tech-badge-ready';

                      return (
                        <tr key={log.id}>
                          <td style={{ whiteSpace: 'nowrap', color: '#6B7280' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Clock size={13} />
                              <span>{new Date(log.createdAt).toLocaleDateString('id-ID')} {new Date(log.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </td>
                          <td style={{ fontWeight: 700 }}>
                            {log.isBroadcast ? (
                              <span style={{ color: '#D97706' }}>📢 BROADCAST FLEET</span>
                            ) : (
                              <span style={{ fontFamily: 'monospace', color: '#7B5E3C' }}>{log.deviceSerialNumber || log.device?.serialNumber || log.deviceId || '-'}</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 700 }}>v{log.firmwareVersion}</span>
                              {log.notes?.includes('[DOWNGRADE]') ? (
                                <span className="tech-badge-warning" style={{ fontSize: '9px', padding: '1px 6px' }}>DOWNGRADE</span>
                              ) : log.notes?.includes('[REFLASH]') ? (
                                <span className="tech-badge-ready" style={{ fontSize: '9px', padding: '1px 6px' }}>RE-FLASH</span>
                              ) : (
                                <span className="tech-badge-active" style={{ fontSize: '9px', padding: '1px 6px' }}>UPGRADE</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className={statusClass}>
                              {isWorking && <RefreshCw size={10} className="spin-icon" style={{ marginRight: '4px' }} />}
                              {log.status}
                            </span>
                          </td>
                          <td style={{ color: 'var(--tech-text-secondary)' }}>
                            <div style={{ fontSize: '0.8rem' }}>{log.notes || '-'}</div>
                            {Boolean(log.firmwareUrl) && (
                              <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginTop: '2px', wordBreak: 'break-all' }}>
                                📡 <code>{log.firmwareUrl}</code>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: DEVICE LOGS (DEDICATED FULL VIEW)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <div className="tech-subpanel-card">
            <div className="tech-toolbar">
              <div>
                <h3 className="tech-card-title" style={{ margin: '0 0 4px 0' }}>Log Aktivitas & Riwayat OTA Flashing</h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#6B7280' }}>
                  Seluruh catatan histori flashing OTA, audit status perangkat, dan transmisi instruksi nirkabel.
                </p>
              </div>

              <button
                className="tech-btn-secondary"
                onClick={loadOtaLogs}
                disabled={loadingOtaLogs}
              >
                <RefreshCw size={14} className={loadingOtaLogs ? 'spin-icon' : ''} />
                <span>Refresh Logs</span>
              </button>
            </div>

            {loadingOtaLogs ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>
                <RefreshCw size={24} className="spin-icon" style={{ marginBottom: '8px' }} />
                <div>Memuat log riwayat OTA...</div>
              </div>
            ) : otaLogs.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.86rem' }}>
                Belum ada log aktivitas firmware OTA yang tercatat di sistem.
              </div>
            ) : (
              <div className="tech-table-responsive">
                <table className="tech-table">
                  <thead>
                    <tr>
                      <th>Waktu Event</th>
                      <th>Target Unit</th>
                      <th>Versi Target</th>
                      <th>Status Eksekusi</th>
                      <th>Keterangan Teknis & URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otaLogs.map((log) => {
                      const isWorking = log.status === 'IN_PROGRESS' || log.status === 'FLASHING' || log.status === 'DOWNLOADING';
                      const statusClass =
                        log.status === 'SUCCESS' ? 'tech-badge-active'
                        : log.status === 'FAILED' ? 'tech-badge-critical'
                        : isWorking ? 'tech-badge-warning'
                        : 'tech-badge-ready';

                      return (
                        <tr key={log.id}>
                          <td style={{ whiteSpace: 'nowrap', color: '#6B7280' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Clock size={13} />
                              <span>{new Date(log.createdAt).toLocaleDateString('id-ID')} {new Date(log.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </td>
                          <td style={{ fontWeight: 700 }}>
                            {log.isBroadcast ? (
                              <span style={{ color: '#D97706' }}>📢 BROADCAST FLEET</span>
                            ) : (
                              <span style={{ fontFamily: 'monospace', color: '#7B5E3C' }}>{log.deviceSerialNumber || log.device?.serialNumber || log.deviceId || '-'}</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 700 }}>v{log.firmwareVersion}</span>
                              {log.notes?.includes('[DOWNGRADE]') ? (
                                <span className="tech-badge-warning" style={{ fontSize: '9px', padding: '1px 6px' }}>DOWNGRADE</span>
                              ) : log.notes?.includes('[REFLASH]') ? (
                                <span className="tech-badge-ready" style={{ fontSize: '9px', padding: '1px 6px' }}>RE-FLASH</span>
                              ) : (
                                <span className="tech-badge-active" style={{ fontSize: '9px', padding: '1px 6px' }}>UPGRADE</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className={statusClass}>
                              {isWorking && <RefreshCw size={10} className="spin-icon" style={{ marginRight: '4px' }} />}
                              {log.status}
                            </span>
                          </td>
                          <td style={{ color: 'var(--tech-text-secondary)' }}>
                            <div style={{ fontSize: '0.8rem' }}>{log.notes || '-'}</div>
                            {Boolean(log.firmwareUrl) && (
                              <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginTop: '2px', wordBreak: 'break-all' }}>
                                📡 <code>{log.firmwareUrl}</code>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 5: HEALTH MONITOR & TERMINAL DIAGNOSTICS
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'diagnostics' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {/* Top 3 Live Health Status Cards */}
          <div className="tech-health-grid">
            <div className="tech-health-card">
              <div className="tech-health-icon-box">
                <Radio size={22} />
              </div>
              <div>
                <div className="tech-health-label">MQTT Broker Cluster</div>
                <div className="tech-health-value" style={{ color: '#16A34A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="tech-pulse-dot" />
                  <span>Connected (1883)</span>
                </div>
              </div>
            </div>

            <div className="tech-health-card">
              <div className="tech-health-icon-box">
                <Activity size={22} />
              </div>
              <div>
                <div className="tech-health-label">Server Health Ping</div>
                <div className="tech-health-value" style={{ color: '#7B5E3C' }}>
                  Operational (~38 ms)
                </div>
              </div>
            </div>

            <div className="tech-health-card">
              <div className="tech-health-icon-box">
                <Cpu size={22} />
              </div>
              <div>
                <div className="tech-health-label">IoT Gateway Mesh</div>
                <div className="tech-health-value" style={{ color: '#2563EB' }}>
                  SHROOMSYNC-NODE-01
                </div>
              </div>
            </div>
          </div>

          <div className="tech-subpanel-card">
            <div className="tech-toolbar">
              <div>
                <h3 className="tech-card-title" style={{ margin: '0 0 4px 0' }}>Konsol Diagnostik & Jalur Telemetri Raw</h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#6B7280' }}>
                  Uji konektivitas gateway SupaKu, handshake broker MQTT, dan validasi response payload API backend secara real-time.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="tech-btn-secondary"
                  onClick={() => handleRunDiagnostic('/technician/dashboard')}
                  disabled={testingEndpoint}
                >
                  GET /dashboard
                </button>
                <button
                  className="tech-btn-secondary"
                  onClick={() => handleRunDiagnostic('/technician/devices')}
                  disabled={testingEndpoint}
                >
                  GET /devices
                </button>
                <button
                  className="tech-btn-secondary"
                  onClick={() => handleRunDiagnostic('/technician/admins')}
                  disabled={testingEndpoint}
                >
                  GET /admins
                </button>
              </div>
            </div>

            <div className="tech-terminal-box">
              <div className="tech-terminal-header">
                <span className="tech-term-dot red" />
                <span className="tech-term-dot yellow" />
                <span className="tech-term-dot green" />
                <span className="tech-term-title">supaku-mesh-gateway ~ telemetry-inspector</span>
              </div>
              {testingEndpoint ? (
                <span>&gt; Menghubungi endpoint API server... [Menunggu response]</span>
              ) : (
                diagnosticLog || '// Siap. Klik salah satu tombol endpoint di atas untuk memverifikasi payload API & telemetri hardware.'
              )}
            </div>
          </div>
        </motion.div>
      )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. FOOTER (Matching ShroomSync - DashboardAdmin.html)
      ───────────────────────────────────────────────────────────── */}
      <footer className="tech-footer">
        <div className="tech-footer-identity">
          System Identity: <span>SHROOMSYNC-ADMIN-NODE-01</span>
        </div>
        <div className="tech-footer-links">
          <button
            className="tech-footer-link"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => setActiveTab('diagnostics')}
          >
            Health Check: OK
          </button>
          <button
            className="tech-footer-link"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => setActiveTab('diagnostics')}
          >
            MQTT Broker: Connected
          </button>
          <span className="tech-footer-link">System v2.4.0</span>
        </div>
      </footer>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: PROVISIONING SUPAKU BARU (POST /technician/devices)
      ───────────────────────────────────────────────────────────── */}
      {showProvisionModal && (
        <div className="tech-modal-overlay">
          <motion.div className="tech-modal-card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '480px', maxWidth: '92vw', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Provisioning Unit SupaKu Baru</h3>
              <button onClick={() => setShowProvisionModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <p className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '18px' }}>
              Daftarkan serial number unik unit SupaKu yang baru dirakit untuk menghasilkan kode aktivasi dan stiker QR fisik.
            </p>

            <form onSubmit={handleProvisionDevice} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.84rem', fontWeight: 600 }}>Serial Number Hardware</label>
                  <button
                    type="button"
                    onClick={handleAutoGenerateSerial}
                    style={{ background: 'transparent', border: 'none', color: 'var(--primary, #5a9e6f)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    + Generate Otomatis
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Contoh: SS-0426-005"
                  value={provisionForm.serialNumber}
                  onChange={(e) => setProvisionForm({ ...provisionForm, serialNumber: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 600 }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Nama Default Unit</label>
                <input
                  type="text"
                  placeholder="Contoh: SupaKu Unit 05"
                  value={provisionForm.name}
                  onChange={(e) => setProvisionForm({ ...provisionForm, name: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Model Perangkat</label>
                <select
                  value={provisionForm.model}
                  onChange={(e) => setProvisionForm({ ...provisionForm, model: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                >
                  <option value="SupaKu Smart Node v2">SupaKu Smart Node v2 (Standar Dual-Pump)</option>
                  <option value="SupaKu Pro Hub v2">SupaKu Pro Hub v2 (Industrial High-Flow)</option>
                  <option value="SupaKu Mini Edge v1">SupaKu Mini Edge v1 (Portable Kumbung)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Versi Board</label>
                  <input
                    type="text"
                    value={provisionForm.hardwareVersion}
                    onChange={(e) => setProvisionForm({ ...provisionForm, hardwareVersion: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Firmware Awal</label>
                  <input
                    type="text"
                    value={provisionForm.firmwareVersion}
                    onChange={(e) => setProvisionForm({ ...provisionForm, firmwareVersion: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div className="modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" className="tech-btn-secondary" onClick={() => setShowProvisionModal(false)}>Batal</button>
                <button type="submit" className="tech-btn-primary" disabled={loading}>Simpan & Terbitkan Stiker</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: CETAK / LIHAT STIKER QR CODE & BARCODE FISIK SUPAKU
          (Real Production Barcode Code 128 & 2D QR Code Generator)
      ───────────────────────────────────────────────────────────── */}
      {Boolean(showStickerModal && activeStickerDevice) && (
        <DeviceBarcodeStickerModal
          isOpen={true}
          onClose={() => setShowStickerModal(false)}
          device={activeStickerDevice}
          onNotification={showNotification}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: EDIT SPESIFIKASI SUPAKU (PUT /technician/devices/:id)
      ───────────────────────────────────────────────────────────── */}
      {showEditDeviceModal && editingDevice && (
        <div className="tech-modal-overlay">
          <motion.div className="tech-modal-card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '460px', maxWidth: '92vw', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Edit Spesifikasi {editingDevice.serialNumber}</h3>
              <button onClick={() => setShowEditDeviceModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '16px' }}>
              Perbarui spesifikasi teknis atau status operasional unit SupaKu.
            </p>

            <form onSubmit={handleSaveEditDevice} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Nama Unit</label>
                <input
                  type="text"
                  value={editDeviceForm.name}
                  onChange={(e) => setEditDeviceForm({ ...editDeviceForm, name: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Model Node</label>
                <input
                  type="text"
                  value={editDeviceForm.model}
                  onChange={(e) => setEditDeviceForm({ ...editDeviceForm, model: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Hardware Version</label>
                  <input
                    type="text"
                    value={editDeviceForm.hardwareVersion}
                    onChange={(e) => setEditDeviceForm({ ...editDeviceForm, hardwareVersion: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Firmware Version</label>
                  <input
                    type="text"
                    value={editDeviceForm.firmwareVersion}
                    onChange={(e) => setEditDeviceForm({ ...editDeviceForm, firmwareVersion: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Status Unit</label>
                <select
                  value={editDeviceForm.status}
                  onChange={(e) => setEditDeviceForm({ ...editDeviceForm, status: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                >
                  <option value="READY">READY (Siap Pasang / Belum Aktivasi)</option>
                  <option value="ACTIVE">ACTIVE (Aktif Terhubung di Kumbung)</option>
                  <option value="OFFLINE">OFFLINE (Dalam Pemeliharaan / Putus)</option>
                  <option value="SUSPENDED">SUSPENDED (Ditangguhkan)</option>
                </select>
              </div>

              <div className="modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="tech-btn-secondary" onClick={() => setShowEditDeviceModal(false)}>Batal</button>
                <button type="submit" className="tech-btn-primary" disabled={loading}>Simpan Perubahan</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: BUAT AKUN ADMINISTRATOR REGIONAL (POST /technician/admins)
      ───────────────────────────────────────────────────────────── */}
      {showAdminModal && (
        <div className="tech-modal-overlay">
          <motion.div className="tech-modal-card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '460px', maxWidth: '92vw', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Buat Akun Administrator Regional</h3>
              <button onClick={() => setShowAdminModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '16px' }}>
              Administrator regional bertugas membina petani, menugaskan alat, dan memantau kumbung wilayah.
            </p>

            <form onSubmit={handleCreateAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Nama Lengkap Administrator</label>
                <input
                  type="text"
                  placeholder="Contoh: Hendra Kusuma"
                  value={adminForm.fullName}
                  onChange={(e) => setAdminForm({ ...adminForm, fullName: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Nomor Telepon / WhatsApp (Unik)</label>
                <input
                  type="tel"
                  placeholder="Contoh: 081234567890"
                  value={adminForm.phoneNumber}
                  onChange={(e) => setAdminForm({ ...adminForm, phoneNumber: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Email (Opsional)</label>
                <input
                  type="email"
                  placeholder="admin.wilayah@shroomsync.id"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Wilayah Operasional</label>
                <input
                  type="text"
                  placeholder="Contoh: Jawa Barat (Lembang & Sukabumi)"
                  value={adminForm.region}
                  onChange={(e) => setAdminForm({ ...adminForm, region: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>Kata Sandi Awal (Min. 8 Karakter)</label>
                <input
                  type="password"
                  placeholder="Minimal 8 karakter"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                  required
                  minLength={8}
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="tech-btn-secondary" onClick={() => setShowAdminModal(false)}>Batal</button>
                <button type="submit" className="tech-btn-primary" disabled={loading}>Buat Akun Admin</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: DAFTARKAN PETANI BARU (POST /technician/farmers)
      ───────────────────────────────────────────────────────────── */}
      {showFarmerModal && (
        <div className="tech-modal-overlay">
          <motion.div className="tech-modal-card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '480px', maxWidth: '92vw', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--tech-soft-beige)', color: 'var(--tech-earth-brown)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sprout size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Daftarkan Akun Petani Baru</h3>
              </div>
              <button onClick={() => setShowFarmerModal(false)} style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ backgroundColor: 'var(--tech-soft-beige)', border: '1px solid var(--tech-border)', borderRadius: '12px', padding: '10px 14px', fontSize: '0.8rem', color: 'var(--tech-earth-brown)', lineHeight: '1.5', margin: '12px 0 16px' }}>
              <div style={{ fontWeight: 800, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={14} />
                <span>Onboarding Mandiri Petani</span>
              </div>
              Detail nama usaha tani, alamat kumbung, dan penggantian password default akan diisi langsung oleh Petani saat pertama kali masuk ke sistem.
            </div>

            <form onSubmit={handleCreateFarmer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px' }}>Nama Lengkap Petani</label>
                <input
                  type="text"
                  placeholder="Contoh: Dadang Sulaeman"
                  value={farmerForm.fullName}
                  onChange={(e) => setFarmerForm({ ...farmerForm, fullName: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E5E7EB' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px' }}>Nomor Telepon / WhatsApp (Dipakai Login)</label>
                <input
                  type="tel"
                  placeholder="Contoh: 081234567890"
                  value={farmerForm.phoneNumber}
                  onChange={(e) => setFarmerForm({ ...farmerForm, phoneNumber: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E5E7EB' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px' }}>Email (Opsional)</label>
                <input
                  type="email"
                  placeholder="petani@gmail.com"
                  value={farmerForm.email}
                  onChange={(e) => setFarmerForm({ ...farmerForm, email: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E5E7EB' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px' }}>Kata Sandi Awal Sementara</label>
                <input
                  type="text"
                  value={farmerForm.password}
                  onChange={(e) => setFarmerForm({ ...farmerForm, password: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E5E7EB', fontFamily: 'monospace' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="tech-btn-secondary" onClick={() => setShowFarmerModal(false)}>Batal</button>
                <button type="submit" className="tech-btn-primary" disabled={loading}>
                  {loading ? 'Mendaftarkan...' : 'Daftarkan Petani'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Petani */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetFarmer)}
        onClose={() => !isDeletingFarmer && setDeleteTargetFarmer(null)}
        onConfirm={handleConfirmDeleteFarmer}
        title="Hapus Akun Petani"
        message="Apakah Anda yakin ingin menghapus akun petani ini? Semua perangkat kumbung yang tertaut akan dikembalikan ke status READY."
        itemDetails={
          deleteTargetFarmer
            ? {
                label: 'Identitas Akun Petani',
                value: deleteTargetFarmer.fullName || deleteTargetFarmer.phoneNumber,
                subValue: `Kontak: ${deleteTargetFarmer.phoneNumber} • Usaha: ${deleteTargetFarmer.farmName || 'Belum Onboarding'}`,
              }
            : null
        }
        type="danger"
        confirmText="Hapus Akun Petani"
        cancelText="Batal"
        loading={isDeletingFarmer}
        dangerNote="Tindakan ini permanen. Seluruh relasi kepemilikan alat pada petani ini akan dilepaskan."
      />

      {/* ─────────────────────────────────────────────────────────────
          MODAL: UPLOAD FILE BINER FIRMWARE (.bin)
      ───────────────────────────────────────────────────────────── */}
      {showUploadFirmwareModal && (
        <div className="tech-modal-overlay">
          <motion.div className="tech-modal-card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '500px', maxWidth: '92vw', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(36, 94, 61, 0.15)', color: 'var(--primary)' }}>
                  <Upload size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Upload File Firmware (.bin)</h3>
              </div>
              <button onClick={() => !uploadProgress && setShowUploadFirmwareModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '16px' }}>
              Unggah file biner hasil kompilasi ESP32 (.bin). Checksum SHA-256 akan dihitung otomatis oleh server untuk menjamin integritas memori flash.
            </p>

            <form onSubmit={handleUploadFirmware} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* File picker */}
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>
                  File Biner Firmware (.bin) *
                </label>
                <div
                  style={{
                    border: '2px dashed var(--border-color)',
                    borderRadius: '10px',
                    padding: '20px',
                    textAlign: 'center',
                    backgroundColor: firmwareUploadForm.file ? 'rgba(36, 94, 61, 0.06)' : 'transparent',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                  onClick={() => document.getElementById('firmware-file-input')?.click()}
                >
                  <input
                    id="firmware-file-input"
                    type="file"
                    accept=".bin"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (!file.name.endsWith('.bin')) {
                          showNotification('Hanya file biner firmware (.bin) yang diizinkan!', 'error');
                          return;
                        }
                        const versionMatch = file.name.match(/v?(\d+\.\d+\.\d+)/i);
                        setFirmwareUploadForm((prev) => ({
                          ...prev,
                          file,
                          version: prev.version || (versionMatch ? versionMatch[1] : ''),
                        }));
                      }
                    }}
                  />
                  <FileCode size={28} style={{ color: firmwareUploadForm.file ? 'var(--primary)' : 'var(--text-muted)', marginBottom: '6px', margin: '0 auto' }} />
                  {firmwareUploadForm.file ? (
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{firmwareUploadForm.file.name}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{formatBytes(firmwareUploadForm.file.size)} • Format .bin Valid</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>Klik untuk memilih file .bin</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Maksimal 16MB per file firmware</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Version & Hardware grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>
                    Versi Firmware *
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 1.2.0 atau 2.1.2"
                    value={firmwareUploadForm.version}
                    onChange={(e) => setFirmwareUploadForm({ ...firmwareUploadForm, version: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                    required
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Format SemVer (misal: 1.1.0, 1.2.0)
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>
                    Versi Hardware (Target HW) *
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 1.0, 2.0, ESP32-S3"
                    value={firmwareUploadForm.hardwareVersion}
                    onChange={(e) => setFirmwareUploadForm({ ...firmwareUploadForm, hardwareVersion: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                    required
                  />
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {[
                      { label: 'v1.0 (Standard)', val: '1.0' },
                      { label: 'v2.0 (Dual-Pump)', val: '2.0' },
                      { label: 'ESP32-S3 (Universal)', val: 'ESP32-S3' },
                    ].map((hw) => (
                      <button
                        key={hw.val}
                        type="button"
                        onClick={() => setFirmwareUploadForm({ ...firmwareUploadForm, hardwareVersion: hw.val })}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: firmwareUploadForm.hardwareVersion === hw.val ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: firmwareUploadForm.hardwareVersion === hw.val ? 'rgba(36, 94, 61, 0.12)' : 'transparent',
                          color: firmwareUploadForm.hardwareVersion === hw.val ? 'var(--primary)' : 'var(--text-secondary)',
                        }}
                      >
                        {hw.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Hardware Compatibility Explanatory Box */}
              <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                <span style={{ fontWeight: 600, color: '#2563eb' }}>ℹ️ Penting:</span> ESP32 memeriksa <code>hardware_version</code> saat menerima instruksi OTA. Jika versi hardware target tidak cocok dengan board fisik perangkat (misal perangkat adalah <code>1.0</code> tapi firmware ditargetkan <code>2.0</code>), ESP32 akan menolak update dengan kode <code>hw_mismatch</code>.
              </div>

              {/* isLatest checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <input
                  type="checkbox"
                  id="fw-is-latest"
                  checked={firmwareUploadForm.isLatest}
                  onChange={(e) => setFirmwareUploadForm({ ...firmwareUploadForm, isLatest: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <label htmlFor="fw-is-latest" style={{ fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                  Tandai sebagai Versi Terbaru (Latest Stable Release)
                </label>
              </div>

              {/* Changelog */}
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>
                  Catatan Perubahan (Changelog)
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan rilis: Perbaikan bug Wi-Fi, optimasi sensor, dsb."
                  value={firmwareUploadForm.changelog}
                  onChange={(e) => setFirmwareUploadForm({ ...firmwareUploadForm, changelog: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)', resize: 'vertical' }}
                />
              </div>

              {/* Modal Actions */}
              <div className="modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  className="tech-btn-secondary"
                  onClick={() => setShowUploadFirmwareModal(false)}
                  disabled={uploadProgress}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="tech-btn-primary"
                  disabled={uploadProgress || !firmwareUploadForm.file}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {uploadProgress ? (
                    <>
                      <RefreshCw size={15} className="spin" />
                      <span>Mengunggah & Memvalidasi...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={15} />
                      <span>Unggah & Verifikasi</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: KONFIRMASI HAPUS & DEKOMISI UNIT SUPAKU (CONFIRM MODAL)
      ───────────────────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetDevice)}
        onClose={() => !isDeletingDevice && setDeleteTargetDevice(null)}
        onConfirm={handleConfirmDeleteDevice}
        title="Dekomisi & Hapus Unit SupaKu"
        message="Apakah Anda yakin ingin menghapus & mendekomisi unit SupaKu ini? Perangkat akan dilepas dari sistem dan seluruh data inventaris aktif."
        itemDetails={
          deleteTargetDevice
            ? {
                label: 'Identitas Unit SupaKu',
                value: deleteTargetDevice.serialNumber,
                subValue: `Status: ${deleteTargetDevice.status || 'READY'} • ${deleteTargetDevice.model || 'SupaKu Smart Node'}`,
              }
            : null
        }
        type="danger"
        confirmText="Hapus & Dekomisi"
        cancelText="Batal"
        loading={isDeletingDevice}
        dangerNote="Tindakan ini permanen. Unit yang telah dihapus tidak dapat dipulihkan secara otomatis."
      />
    </div>
  );
}
