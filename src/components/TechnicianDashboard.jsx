import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Wrench,
  Cpu,
  Radio,
  ShieldCheck,
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
} from 'lucide-react';
import api from '../services/api';
import DeviceBarcodeStickerModal from './DeviceBarcodeStickerModal';
import ConfirmModal from './ConfirmModal';
import './TechnicianDashboard.css';

const STATUS_FILTERS = ['ALL', 'READY', 'ACTIVE', 'OFFLINE', 'SUSPENDED'];

export default function TechnicianDashboard({ onMenuToggle, currentUser }) {
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'admins' | 'ota' | 'diagnostics'
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [devices, setDevices] = useState([]);
  const [admins, setAdmins] = useState([]);
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
      const [dashRes, devRes, adminRes] = await Promise.allSettled([
        api.technician.getDashboard(),
        api.technician.getDevices({ status: statusFilter, limit: 100 }),
        api.technician.getAdmins(),
      ]);

      if (dashRes.status === 'fulfilled') {
        setDashboardData(dashRes.value);
      }
      if (devRes.status === 'fulfilled') {
        const devList = devRes.value?.devices || (Array.isArray(devRes.value) ? devRes.value : []);
        setDevices(devList);
      }
      if (adminRes.status === 'fulfilled') {
        const admList = Array.isArray(adminRes.value) ? adminRes.value : [];
        setAdmins(admList);
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

    try {
      setUploadProgress(true);
      const rawVersion = firmwareUploadForm.version.trim();
      const cleanVersion = rawVersion
        .replace(/^firmware\s*/i, '')
        .replace(/^v/i, '')
        .trim();
      const finalVersion = cleanVersion || rawVersion;

      const formData = new FormData();
      formData.append('firmware', firmwareUploadForm.file);
      formData.append('version', finalVersion);
      formData.append('hardwareVersion', firmwareUploadForm.hardwareVersion);
      if (firmwareUploadForm.changelog) {
        formData.append('changelog', firmwareUploadForm.changelog.trim());
      }
      formData.append('isLatest', String(firmwareUploadForm.isLatest));

      const res = await api.technician.uploadFirmware(formData);
      showNotification(`✓ Firmware v${finalVersion} berhasil diunggah dan diverifikasi!`, 'success');
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

      {/* Top Header - Matching Farmer Dashboard Header Component */}
      <header className="header" data-page-tone="system">
        <div className="header-title">
          {onMenuToggle && (
            <button className="mobile-menu-toggle" onClick={onMenuToggle} aria-label="Toggle menu">
              <Menu size={24} />
            </button>
          )}
          <div className="header-title-badge" aria-hidden="true">
            <Wrench size={20} />
          </div>
          <div className="header-copy">
            <h2>Portal Teknisi ShroomSync</h2>
            <p>
              Sesi: <strong style={{ color: 'var(--text-primary)' }}>{currentUser?.fullName || currentUser?.name || currentUser?.username || 'Teknisi Lapangan'}</strong> • Diagnostik Armada SupaKu, Provisioning Hardware, & Admin
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
            onClick={() => {
              handleAutoGenerateSerial();
              setShowProvisionModal(true);
            }}
          >
            <Plus size={16} />
            <span>Provisioning SupaKu</span>
          </button>
        </div>
      </header>

      {/* Main Page Content - Standard ShroomSync Farmer Page Layout */}
      <div className="dashboard-content">
        {/* Overview Diagnostic Stat Cards - Identical to Farmer Dashboard */}
        <div className="stats-row">
          <div className="stat-card minimal">
            <span className="stat-title">
              Total SupaKu <Cpu size={14} className="text-earth" />
            </span>
            <div className="stat-value">{dashboardData?.totalDevices ?? devices.length}</div>
            <div className="stat-status text-earth">Armada fisik terdata</div>
          </div>

          <div className="stat-card minimal">
            <span className="stat-title">
              SupaKu Online <Radio size={14} className="text-sage" />
            </span>
            <div className="stat-value">{onlineDevicesCount}</div>
            <div className="stat-status text-sage">Heartbeat normal (&lt; 2 mnt)</div>
          </div>

          <div className="stat-card minimal">
            <span className="stat-title">
              SupaKu Offline <AlertTriangle size={14} style={{ color: 'var(--error)' }} />
            </span>
            <div className="stat-value" style={{ color: offlineDevicesCount > 0 ? 'var(--error)' : undefined }}>
              {offlineDevicesCount}
            </div>
            <div className="stat-status" style={{ color: offlineDevicesCount > 0 ? 'var(--error)' : 'var(--sage-green)' }}>
              {offlineDevicesCount > 0 ? 'Inaktif > 2 menit' : 'Semua unit aktif'}
            </div>
          </div>

          <div className="stat-card minimal">
            <span className="stat-title">
              Admin Regional <Users size={14} className="text-sage" />
            </span>
            <div className="stat-value">{admins.length || dashboardData?.totalAdmins || 3}</div>
            <div className="stat-status text-sage">Wilayah binaan regional</div>
          </div>
        </div>

        {/* Tab Navigation - Standard ShroomSync Portal Tabs */}
        <div className="portal-tabs">
          <button
            className={`portal-tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            <Cpu size={16} />
            <span>Inventaris SupaKu</span>
            <span className="portal-tab-badge">
              {devices.length}
            </span>
          </button>

          <button
            className={`portal-tab-btn ${activeTab === 'admins' ? 'active' : ''}`}
            onClick={() => setActiveTab('admins')}
          >
            <ShieldCheck size={16} />
            <span>Administrator Regional</span>
            <span className="portal-tab-badge">
              {admins.length}
            </span>
          </button>

          <button
            className={`portal-tab-btn ${activeTab === 'ota' ? 'active' : ''}`}
            onClick={() => setActiveTab('ota')}
          >
            <Zap size={16} />
            <span>OTA Firmware Center</span>
          </button>

          <button
            className={`portal-tab-btn ${activeTab === 'diagnostics' ? 'active' : ''}`}
            onClick={() => setActiveTab('diagnostics')}
          >
            <Terminal size={16} />
            <span>Diagnostik API & MQTT</span>
          </button>
        </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: INVENTARIS & PROVISIONING SUPAKU
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'inventory' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {/* Table Panel with Toolbar */}
          <div className="portal-table-panel">
            <div className="portal-toolbar">
              {/* Search Box & Filters */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', flex: '1 1 auto' }}>
                <div style={{ position: 'relative', minWidth: '260px', flex: '1 1 320px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    placeholder="Cari Serial Number (SS-0426-...), nama, atau model..."
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

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: '2px' }}>Status:</span>
                  {STATUS_FILTERS.map((st) => (
                    <button
                      key={st}
                      className={`portal-filter-btn ${statusFilter === st ? 'active' : ''}`}
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
                  className="secondary-button"
                  onClick={handleExportDevicesCSV}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={14} />
                  <span>Ekspor CSV</span>
                </button>
                <button
                  className="primary-button"
                  onClick={() => handleOpenOtaModal(null)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Zap size={14} />
                  <span>Broadcast OTA</span>
                </button>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="data-table responsive-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Serial Number</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Unit & Model</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Hardware / Firmware</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Kumbung / Pemilik</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px' }}>Sinyal / Uptime</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px' }}>Aksi Teknisi</th>
                </tr>
              </thead>
              <tbody>
                {filteredDevices.map((dev) => {
                  const isOnline = Boolean(dev.isOnline);
                  const displayStatus = dev.status === 'READY' ? 'READY' : (dev.status === 'SUSPENDED' ? 'SUSPENDED' : (isOnline ? 'ACTIVE' : 'OFFLINE'));
                  const statusColor = displayStatus === 'READY' ? '#38bdf8' : (displayStatus === 'ACTIVE' ? '#10b981' : (displayStatus === 'SUSPENDED' ? '#f59e0b' : '#ef4444'));

                  return (
                    <tr key={dev.id || dev.serialNumber} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td data-label="Serial Number" style={{ padding: '12px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary, #5a9e6f)' }}>
                        {dev.serialNumber}
                      </td>
                      <td data-label="Unit & Model" style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 600 }}>{dev.name || dev.serialNumber}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{dev.model || 'SupaKu Smart Node v2'}</div>
                      </td>
                      <td data-label="Hardware / Firmware" style={{ padding: '12px' }}>
                        <div style={{ fontSize: '0.82rem' }}>Board: v{dev.hardwareVersion || '2.0'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>FW: v{dev.firmwareVersion || '2.1.0'}</div>
                      </td>
                      <td data-label="Status" style={{ padding: '12px', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            backgroundColor: `${statusColor}22`,
                            color: statusColor,
                            border: `1px solid ${statusColor}55`,
                          }}
                        >
                          ● {displayStatus}
                        </span>
                      </td>
                      <td data-label="Kumbung / Pemilik" style={{ padding: '12px' }}>
                        {(() => {
                          const farmerName = dev.farmer?.fullName || dev.assignedFarmer || dev.ownerName;
                          const hasFarmer = Boolean(farmerName || dev.farmerId || dev.userId);
                          const hasCustomName = Boolean(dev.name && dev.name !== dev.serialNumber);

                          if (!hasFarmer && !hasCustomName) {
                            return (
                              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.82rem' }}>
                                Belum Ditautkan
                              </span>
                            );
                          }

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {hasCustomName ? (
                                <>
                                  <div style={{ fontWeight: 600, color: 'var(--text-main, #ffffff)', fontSize: '0.86rem' }}>
                                    {dev.name}
                                  </div>
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                    {farmerName || 'Petani Terdaftar'}
                                  </div>
                                </>
                              ) : (
                                <div style={{ fontWeight: 600, color: 'var(--text-main, #ffffff)', fontSize: '0.86rem' }}>
                                  {farmerName || 'Petani Terdaftar'}
                                </div>
                              )}
                              {dev.farmer?.phoneNumber && (
                                <div style={{ fontSize: '0.74rem', color: 'var(--primary, #5a9e6f)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <span>{dev.farmer.phoneNumber}</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td data-label="Sinyal / Uptime" style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          <Wifi size={13} style={{ color: isOnline ? '#10b981' : '#6b7280' }} />
                          <span>{isOnline ? (dev.rssiDbm ? `${dev.rssiDbm} dBm` : '-64 dBm') : '--'}</span>
                        </div>
                      </td>
                      <td data-label="Aksi Teknisi" style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="icon-button small-icon-button"
                            onClick={() => {
                              setActiveStickerDevice(dev);
                              setShowStickerModal(true);
                            }}
                            title="Lihat Stiker QR & Kode Aktivasi"
                            style={{ backgroundColor: 'rgba(74, 124, 89, 0.2)' }}
                          >
                            <QrCode size={15} />
                          </button>

                          <button
                            className="icon-button small-icon-button"
                            onClick={() => handleOpenEditDevice(dev)}
                            title="Edit Spesifikasi & Firmware"
                          >
                            <Edit3 size={15} />
                          </button>

                          <button
                            className="icon-button small-icon-button"
                            onClick={() => handleOpenOtaModal(dev)}
                            title="Trigger OTA Firmware Update"
                            style={{ backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}
                          >
                            <Zap size={15} />
                          </button>

                          <button
                            className="icon-button small-icon-button danger-icon-button"
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
                    <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
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
          TAB 2: ADMINISTRATOR REGIONAL
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'admins' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <div className="panel" style={{ padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Manajemen Administrator Regional</h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Teknisi berwenang membuat dan mengatur akun Administrator yang membawahi kelompok tani per wilayah.
                </p>
              </div>

              <button
                className="primary-button compact-button"
                onClick={() => setShowAdminModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <UserPlus size={16} />
                <span>Buat Akun Administrator</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              {admins.map((admin) => (
                <div
                  key={admin.id}
                  style={{
                    backgroundColor: 'var(--bg-card, var(--bg-secondary))',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(36, 94, 61, 0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem' }}>
                          {admin.fullName?.charAt(0) || 'A'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{admin.fullName}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{admin.region || 'Regional Indonesia'}</div>
                        </div>
                      </div>

                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '10px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          backgroundColor: admin.status === 'ACTIVE' ? 'rgba(36, 94, 61, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: admin.status === 'ACTIVE' ? 'var(--primary)' : 'var(--error, #f87171)',
                        }}
                      >
                        {admin.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '12px' }}>
                      <div>📱 {admin.phoneNumber}</div>
                      <div>✉️ {admin.email || 'Email belum diatur'}</div>
                      <div>🌾 {admin.assignedFarmersCount ?? 0} Petani Terdaftar</div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      className="secondary-button compact-button"
                      onClick={() => handleToggleAdminStatus(admin)}
                      style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                    >
                      {admin.status === 'ACTIVE' ? 'Tangguhkan (Suspend)' : 'Aktifkan Kembali'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ─────────────────────────────────────────────────────────────
      {/* ─────────────────────────────────────────────────────────────
          TAB 3: OTA FIRMWARE CENTER & REPOSITORY
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'ota' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Top Header Banner & Actions */}
          <div className="panel" style={{ padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>OTA Firmware Center & Remote Flashing</h3>
                <span className="portal-tab-badge" style={{ backgroundColor: 'rgba(36, 94, 61, 0.2)', color: 'var(--primary)' }}>
                  {firmwares.length} Binary Versi
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Repositori file biner firmware (.bin), kalkulasi otomatis checksum SHA-256, dan remote deployment nirkabel via MQTT.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                className="secondary-button compact-button"
                onClick={() => { loadFirmwares(); loadOtaLogs(); }}
                disabled={loadingFirmwares || loadingOtaLogs}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                title="Muat ulang firmware dan log OTA"
              >
                <RefreshCw size={15} className={(loadingFirmwares || loadingOtaLogs) ? 'spin' : ''} />
                <span>Refresh</span>
              </button>
              <button
                className="primary-button compact-button"
                onClick={() => setShowUploadFirmwareModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Upload size={16} />
                <span>Upload Firmware (.bin)</span>
              </button>
            </div>
          </div>

          {/* Section 1: Repositori File Binary Firmware (.bin) */}
          <div className="portal-table-panel">
            <div className="portal-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '7px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                  <HardDrive size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.96rem' }}>Repositori File Biner Firmware (.bin)</h4>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    File binary yang telah diverifikasi dan siap di-flash ke unit mikrokontroler SupaKu ESP32
                  </div>
                </div>
              </div>
            </div>

            {loadingFirmwares ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
                <div>Memuat daftar firmware dari server...</div>
              </div>
            ) : firmwares.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <FileCode size={36} style={{ opacity: 0.4, marginBottom: '10px' }} />
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Belum ada file firmware (.bin) tersimpan
                </div>
                <div style={{ fontSize: '0.82rem', maxWidth: '420px', margin: '0 auto 16px auto' }}>
                  Unggah file biner .bin hasil kompilasi PlatformIO atau Arduino IDE untuk memulai manajemen OTA nirkabel.
                </div>
                <button
                  className="primary-button compact-button"
                  onClick={() => setShowUploadFirmwareModal(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', margin: '0 auto' }}
                >
                  <Upload size={15} />
                  <span>Upload Firmware Pertama (.bin)</span>
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(0, 0, 0, 0.04)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Versi & Status</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Hardware Target</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Berkas & Ukuran</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Checksum SHA-256</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Changelog</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Waktu Unggah</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {firmwares.map((fw) => (
                      <tr
                        key={fw.id}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          backgroundColor: otaForm.firmwareId === fw.id ? 'rgba(36, 94, 61, 0.06)' : 'transparent',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>v{fw.version}</span>
                            {fw.isLatest && (
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', backgroundColor: 'rgba(36, 94, 61, 0.15)', color: 'var(--primary)' }}>
                                LATEST
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.76rem', backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)' }}>
                            SupaKu ESP32 v{fw.hardwareVersion || '1.0'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{fw.originalName}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{formatBytes(fw.fileSize)}</div>
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
                        {d.serialNumber} - {d.name} (FW saat ini: v{d.firmwareVersion || '2.1.0'})
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
                                v{f.version} {f.isLatest ? '★ (Latest)' : ''} {currentVer ? `[${relTag}]` : ''} — {f.originalName} ({formatBytes(f.fileSize)})
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
                        <input
                          type="text"
                          placeholder="Versi Target (Contoh: 2.1.2)"
                          value={otaForm.firmwareVersion}
                          onChange={(e) => setOtaForm({ ...otaForm, firmwareVersion: e.target.value })}
                          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                          required
                        />
                      </div>
                      <div>
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
                    className="primary-button"
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

          {/* Section 3: Riwayat Flashing OTA (Live Execution Logs) */}
          <div className="portal-table-panel">
            <div className="portal-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '7px', borderRadius: '8px', backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}>
                  <History size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.96rem' }}>Riwayat Eksekusi Flashing OTA</h4>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Log riwayat pengiriman instruksi upgrade dan status konfirmasi firmware dari unit SupaKu
                  </div>
                </div>
              </div>

              <button
                className="secondary-button compact-button"
                onClick={loadOtaLogs}
                disabled={loadingOtaLogs}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={14} className={loadingOtaLogs ? 'spin' : ''} />
                <span>Refresh Logs</span>
              </button>
            </div>

            {loadingOtaLogs ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={20} className="spin" style={{ marginBottom: '6px' }} />
                <div>Memuat log riwayat OTA...</div>
              </div>
            ) : otaLogs.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                Belum ada riwayat aktivitas flashing OTA yang tercatat di sistem.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(0, 0, 0, 0.04)' }}>
                      <th style={{ padding: '10px 14px', fontWeight: 700 }}>Waktu</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700 }}>Target Unit</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700 }}>Versi Target</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700 }}>Status Eksekusi</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700 }}>Catatan & Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otaLogs.map((log) => {
                      const isWorking = log.status === 'IN_PROGRESS' || log.status === 'FLASHING' || log.status === 'DOWNLOADING';
                      const statusColor =
                        log.status === 'SUCCESS' ? { bg: 'rgba(36, 94, 61, 0.15)', text: 'var(--primary)' }
                        : log.status === 'FAILED' ? { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171' }
                        : isWorking ? { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308' }
                        : log.status === 'SENT' ? { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' }
                        : { bg: 'rgba(107, 114, 128, 0.15)', text: '#9ca3af' };

                      return (
                        <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Clock size={13} />
                              <span>{new Date(log.createdAt).toLocaleDateString('id-ID')} {new Date(log.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {log.isBroadcast ? (
                              <span style={{ fontWeight: 700, color: '#eab308' }}>📢 BROADCAST FLEET</span>
                            ) : (
                              <span style={{ fontWeight: 600 }}>{log.deviceSerialNumber || log.device?.serialNumber || log.deviceId || '-'}</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 700 }}>v{log.firmwareVersion}</span>
                              {log.notes?.includes('[DOWNGRADE]') ? (
                                <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700, backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>
                                  DOWNGRADE
                                </span>
                              ) : log.notes?.includes('[REFLASH]') ? (
                                <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700, backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>
                                  RE-FLASH
                                </span>
                              ) : (
                                <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700, backgroundColor: 'rgba(36, 94, 61, 0.2)', color: 'var(--primary)' }}>
                                  UPGRADE
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ padding: '3px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: statusColor.bg, color: statusColor.text, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              {isWorking && <RefreshCw size={11} className="spin-icon" />}
                              {log.status}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                            <div style={{ fontSize: '0.78rem' }}>{log.notes || '-'}</div>
                            {Boolean(log.firmwareUrl) && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', wordBreak: 'break-all' }}>
                                📡 <strong>Link ke HW:</strong> <code>{log.firmwareUrl}</code>
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
          TAB 4: DIAGNOSTICS & RAW INSPECTOR
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'diagnostics' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <div className="panel" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Konsol Diagnostik & Jalur Telemetri</h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Verifikasi kesehatan jalur telemetri gateway SupaKu, handshake konektivitas, dan integritas payload.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="secondary-button compact-button"
                  onClick={() => handleRunDiagnostic('/technician/dashboard')}
                  disabled={testingEndpoint}
                >
                  GET /technician/dashboard
                </button>
                <button
                  className="secondary-button compact-button"
                  onClick={() => handleRunDiagnostic('/technician/devices')}
                  disabled={testingEndpoint}
                >
                  GET /technician/devices
                </button>
                <button
                  className="secondary-button compact-button"
                  onClick={() => handleRunDiagnostic('/technician/admins')}
                  disabled={testingEndpoint}
                >
                  GET /technician/admins
                </button>
              </div>
            </div>

            <div className="tech-terminal-window">
              <div className="tech-terminal-header">
                <span className="tech-terminal-dot tech-terminal-dot--red" />
                <span className="tech-terminal-dot tech-terminal-dot--yellow" />
                <span className="tech-terminal-dot tech-terminal-dot--green" />
                <span className="tech-terminal-title">supaku-mesh-gateway ~ raw-telemetry-inspector</span>
              </div>
              {testingEndpoint ? (
                <span>&gt; Menghubungi server endpoint... [Awaiting response]</span>
              ) : (
                diagnosticLog || '// Siap. Klik salah satu tombol endpoint di atas untuk memverifikasi payload API & telemetri hardware.'
              )}
            </div>
          </div>
        </motion.div>
      )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: PROVISIONING SUPAKU BARU (POST /technician/devices)
      ───────────────────────────────────────────────────────────── */}
      {showProvisionModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <motion.div className="modal-content panel" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '480px', maxWidth: '92vw', padding: '24px' }}>
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
                <button type="button" className="secondary-button" onClick={() => setShowProvisionModal(false)}>Batal</button>
                <button type="submit" className="primary-button" disabled={loading}>Simpan & Terbitkan Stiker</button>
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
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <motion.div className="modal-content panel" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '460px', maxWidth: '92vw', padding: '24px' }}>
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
                <button type="button" className="secondary-button" onClick={() => setShowEditDeviceModal(false)}>Batal</button>
                <button type="submit" className="primary-button" disabled={loading}>Simpan Perubahan</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: BUAT AKUN ADMINISTRATOR REGIONAL (POST /technician/admins)
      ───────────────────────────────────────────────────────────── */}
      {showAdminModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <motion.div className="modal-content panel" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '460px', maxWidth: '92vw', padding: '24px' }}>
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
                <button type="button" className="secondary-button" onClick={() => setShowAdminModal(false)}>Batal</button>
                <button type="submit" className="primary-button" disabled={loading}>Buat Akun Admin</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: UPLOAD FILE BINER FIRMWARE (.bin)
      ───────────────────────────────────────────────────────────── */}
      {showUploadFirmwareModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <motion.div className="modal-content panel" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '500px', maxWidth: '92vw', padding: '24px' }}>
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
                    placeholder="Contoh: 2.1.2"
                    value={firmwareUploadForm.version}
                    onChange={(e) => setFirmwareUploadForm({ ...firmwareUploadForm, version: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>
                    Target Hardware Board
                  </label>
                  <select
                    value={firmwareUploadForm.hardwareVersion}
                    onChange={(e) => setFirmwareUploadForm({ ...firmwareUploadForm, hardwareVersion: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                  >
                    <option value="1.0">SupaKu Node v1.0 (ESP32 Standard)</option>
                    <option value="2.0">SupaKu Node v2.0 (ESP32 Dual-Pump)</option>
                  </select>
                </div>
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
                  className="secondary-button"
                  onClick={() => setShowUploadFirmwareModal(false)}
                  disabled={uploadProgress}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="primary-button"
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
