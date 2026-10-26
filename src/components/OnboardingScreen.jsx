import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, 
  User, 
  Phone, 
  Building, 
  MapPin, 
  AlertCircle, 
  Sparkles,
  ArrowRight,
  LogOut,
  Eye,
  EyeOff,
  Sun,
  Moon,
  QrCode,
  ScanLine,
  CheckCircle2,
  Home,
  Check,
  Key,
  ArrowLeft,
  Radio
} from 'lucide-react';
import api, { APIError } from '../services/api';
import BarcodeScannerModal from './BarcodeScannerModal';

export default function OnboardingScreen({ user, onComplete, onLogout, theme, toggleTheme }) {
  // Navigation / Step: 'profile' (Step 1) | 'device' (Step 2)
  const [step, setStep] = useState('profile');
  const [savedOnboardingResponse, setSavedOnboardingResponse] = useState(null);

  // Step 1: Keamanan & Biodata
  const [currentPassword, setCurrentPassword] = useState('PasswordDefault123!');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [farmName, setFarmName] = useState(user?.farmName || '');
  const [farmAddress, setFarmAddress] = useState(user?.farmAddress || '');

  // Step 2: Tautkan Kumbung
  const [deviceName, setDeviceName] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [showScannerModal, setShowScannerModal] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Step 1: Submit Profile & Password, then check if device already assigned
  const handleProfileSubmit = async (e) => {
    e?.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!currentPassword) {
      setError('Kata sandi default / lama wajib diisi.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('Kata sandi baru minimal 6 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    if (!fullName.trim()) {
      setError('Nama lengkap petani wajib diisi.');
      return;
    }
    if (!farmName.trim()) {
      setError('Nama usaha / kelompok tani kumbung wajib diisi.');
      return;
    }
    if (!farmAddress.trim()) {
      setError('Alamat lengkap lokasi kumbung jamur wajib diisi.');
      return;
    }

    setLoading(true);

    try {
      // 1. Simpan perubahan profil & password ke backend
      const response = await api.auth.completeOnboarding({
        currentPassword,
        newPassword,
        fullName: fullName.trim(),
        phoneNumber: phoneNumber ? phoneNumber.trim() : '',
        farmName: farmName ? farmName.trim() : '',
        farmAddress: farmAddress ? farmAddress.trim() : '',
      });

      setSavedOnboardingResponse(response);

      // 2. Cek apakah akun petani ini sudah memiliki device yang ditautkan (misal oleh Admin/Teknisi)
      let hasDevice = false;
      try {
        const currentUserId = response?.user?.id || user?.id || api.auth.getUser()?.id;
        const deviceList = await api.devices.list();
        if (Array.isArray(deviceList) && deviceList.length > 0 && currentUserId) {
          // Hanya anggap punya device jika device tersebut benar-benar milik petani yang sedang onboarding!
          const myDevices = deviceList.filter((d) => {
            const devFarmerId = d.farmerId || d.userId || d.farmer?.id;
            return Boolean(devFarmerId && String(devFarmerId) === String(currentUserId));
          });
          if (myDevices.length > 0) {
            hasDevice = true;
          }
        }
      } catch (checkErr) {
        console.warn('[OnboardingScreen] Gagal memeriksa daftar perangkat:', checkErr);
      }

      // 3. Jika SUDAH ada device yang ditautkan -> langsung ke Dashboard!
      if (hasDevice) {
        if (onComplete) {
          onComplete(response);
        }
        return;
      }

      // 4. Jika BELUM ada device -> Lanjut ke Step 2 (Tautkan Device)
      setDeviceName(farmName.trim() ? `Kumbung ${farmName.trim()}` : 'Kumbung Utama');
      setStep('device');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('[OnboardingScreen] Error submit profil:', err);
      const message = err instanceof APIError 
        ? err.getUserMessage() 
        : (err.message || 'Gagal menyimpan profil onboarding.');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Submit Tautkan Device Mandiri
  const handleDeviceSubmit = async (e) => {
    e?.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanDeviceId = deviceId.trim();
    const cleanDeviceName = deviceName.trim();
    const cleanActivation = activationCode.trim();

    if (!cleanDeviceId) {
      setError('ID Perangkat (Device ID) wajib diisi.');
      return;
    }
    if (!cleanDeviceName) {
      setError('Nama Kumbung wajib diisi.');
      return;
    }

    setLoading(true);

    try {
      await api.devices.activate({
        deviceId: cleanDeviceId,
        name: cleanDeviceName,
        activationCode: cleanActivation || undefined,
      });

      setSuccessMsg('Perangkat berhasil ditautkan! Mengarahkan ke Dashboard...');
      setTimeout(() => {
        if (onComplete) {
          onComplete(savedOnboardingResponse);
        }
      }, 700);
    } catch (err) {
      console.error('[OnboardingScreen] Error aktivasi perangkat:', err);
      const message = err.payload?.message || err.message || err.getUserMessage?.() || 'Gagal menautkan perangkat. Pastikan ID Perangkat benar.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Skip Penautan Device (Langsung ke Dashboard)
  const handleSkipDevice = () => {
    if (onComplete) {
      onComplete(savedOnboardingResponse);
    }
  };

  // Barcode / QR Scan Callback
  const handleScanSuccess = (scanned) => {
    if (scanned?.deviceId) {
      setDeviceId(scanned.deviceId);
    }
    if (scanned?.name && !deviceName) {
      setDeviceName(scanned.name);
    }
    if (scanned?.activationCode) {
      setActivationCode(scanned.activationCode);
    }
    setShowScannerModal(false);
    setSuccessMsg(`Barcode berhasil terbaca: ${scanned.deviceId}`);
  };

  const handleAutofillExample = () => {
    setCurrentPassword('PasswordDefault123!');
    setNewPassword('PasswordRahasiaBaru2026');
    setConfirmPassword('PasswordRahasiaBaru2026');
    setFullName('Pak Budi Santoso');
    setPhoneNumber('081234567890');
    setFarmName('Kumbung Berkah Tiram Mandiri');
    setFarmAddress('Desa Cibodas RT 03 RW 02, Lembang, Jawa Barat');
    setError(null);
  };

  return (
    <div className="onboarding-canvas">
      {/* Top Bar with Brand & User Switch */}
      <header className="onboarding-topbar">
        <div className="onboarding-topbar__brand">
          <div className="onboarding-topbar__logo">
            <img src="/log.svg?v=2" alt="ShroomSync" />
          </div>
          <span className="onboarding-topbar__title">ShroomSync</span>
        </div>

        <div className="onboarding-topbar__user" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {toggleTheme && (
            <button
              type="button"
              onClick={toggleTheme}
              className="onboarding-topbar__logout-btn"
              title={theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {theme === 'dark' ? <Sun size={15} style={{ color: '#FBBF24' }} /> : <Moon size={15} style={{ color: '#4B5563' }} />}
              <span>{theme === 'dark' ? 'Terang' : 'Gelap'}</span>
            </button>
          )}
          <span className="onboarding-topbar__chip">
            <User size={14} className="text-sage" />
            <span>{user?.username || 'petani_baru'}</span>
          </span>
          {onLogout && (
            <button 
              type="button" 
              className="onboarding-topbar__logout-btn"
              onClick={onLogout}
              title="Keluar dari akun ini"
            >
              <LogOut size={16} />
              <span>Ganti Akun</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="onboarding-container">
        <motion.div 
          className="onboarding-card"
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          {/* Stepper Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'var(--sage-green)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                fontWeight: 800
              }}>
                {step === 'device' ? <Check size={16} /> : '1'}
              </div>
              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: step === 'profile' ? 'var(--text-primary)' : 'var(--sage-green)' }}>
                Data Diri & Akun
              </span>
            </div>

            <div style={{ width: '40px', height: '2px', backgroundColor: step === 'device' ? 'var(--sage-green)' : 'var(--border-color)', margin: '0 4px', transition: 'all 0.3s' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: step === 'device' ? 'var(--sage-green)' : 'var(--bg-tertiary)',
                color: step === 'device' ? '#ffffff' : 'var(--text-muted)',
                border: step === 'device' ? 'none' : '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                fontWeight: 800,
                transition: 'all 0.3s'
              }}>
                2
              </div>
              <span style={{ fontSize: '0.84rem', fontWeight: step === 'device' ? 700 : 500, color: step === 'device' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                Tautkan Kumbung
              </span>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <motion.div 
              className="login-alert login-alert--error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.2 }}
              style={{ marginBottom: '18px' }}
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Success Alert */}
          {successMsg && (
            <motion.div 
              className="login-alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.2 }}
              style={{ marginBottom: '18px', backgroundColor: 'rgba(52, 211, 153, 0.12)', borderColor: 'rgba(52, 211, 153, 0.3)', color: 'var(--sage-green)' }}
            >
              <CheckCircle2 size={18} />
              <span>{successMsg}</span>
            </motion.div>
          )}

          {/* STEP 1: FORM DATA DIRI & KEAMANAN */}
          {step === 'profile' && (
            <motion.div
              key="step-profile"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.25 }}
            >
              <div className="onboarding-header">
                <div className="onboarding-badge">
                  <Sparkles size={14} className="text-warning" />
                  <span>Langkah 1 dari 2: Biodata & Keamanan</span>
                </div>
                <h2>Lengkapi Biodata & Keamanan</h2>
                <p className="onboarding-subtitle">
                  Selamat datang di ShroomSync! Silakan ganti kata sandi default dan lengkapi data profil petani Anda di bawah ini sebelum melanjutkan ke langkah penautan kumbung.
                </p>
              </div>

              <form className="onboarding-form" onSubmit={handleProfileSubmit}>
                {/* Section 1: Keamanan */}
                <div className="onboarding-step-box">
                  <div className="onboarding-step-header">
                    <div className="step-number">1</div>
                    <div>
                      <h4>Ganti Password Default</h4>
                      <p>Ganti password default admin ke kata sandi pribadi Anda.</p>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: '14px' }}>
                    <label>Password Default Saat Ini</label>
                    <div className="input-with-icon">
                      <Lock size={18} className="input-icon" />
                      <input 
                        type="password"
                        placeholder="Password default akun Anda"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-grid-2">
                    <div className="form-group">
                      <label>Password Baru (Min. 6 Karakter)</label>
                      <div className="input-with-icon">
                        <Lock size={18} className="input-icon" />
                        <input 
                          type={showNewPassword ? 'text' : 'password'}
                          placeholder="Password baru Anda"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          tabIndex={-1}
                        >
                          {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Ulangi Password Baru</label>
                      <div className="input-with-icon">
                        <Lock size={18} className="input-icon" />
                        <input 
                          type={showNewPassword ? 'text' : 'password'}
                          placeholder="Konfirmasi password baru"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Biodata & Kumbung */}
                <div className="onboarding-step-box" style={{ marginTop: '20px' }}>
                  <div className="onboarding-step-header">
                    <div className="step-number">2</div>
                    <div>
                      <h4>Biodata & Usaha Kumbung Jamur</h4>
                      <p>Informasi pengelola dan lokasi kumbung untuk pemantauan IoT.</p>
                    </div>
                  </div>

                  <div className="form-grid-2" style={{ marginTop: '14px' }}>
                    <div className="form-group">
                      <label>Nama Lengkap Petani / Pengelola *</label>
                      <div className="input-with-icon">
                        <User size={18} className="input-icon" />
                        <input 
                          type="text"
                          placeholder="Contoh: Pak Budi Santoso"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Nomor WhatsApp / HP</label>
                      <div className="input-with-icon">
                        <Phone size={18} className="input-icon" />
                        <input 
                          type="tel"
                          placeholder="Contoh: 081234567890"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: '14px' }}>
                    <label>Nama Usaha / Kelompok Tani Kumbung *</label>
                    <div className="input-with-icon">
                      <Building size={18} className="input-icon" />
                      <input 
                        type="text"
                        placeholder="Contoh: Kumbung Berkah Tiram Mandiri"
                        value={farmName}
                        onChange={(e) => setFarmName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: '14px' }}>
                    <label>Alamat Lengkap Lokasi Kumbung *</label>
                    <div className="input-with-icon">
                      <MapPin size={18} className="input-icon" style={{ top: '14px' }} />
                      <textarea 
                        rows={2}
                        placeholder="Contoh: Desa Cibodas RT 03 RW 02, Kec. Lembang, Kab. Bandung Barat"
                        value={farmAddress}
                        onChange={(e) => setFarmAddress(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Helpers & Submit */}
                <div className="onboarding-actions" style={{ marginTop: '24px' }}>
                  <button 
                    type="button" 
                    className="secondary-button autofill-btn"
                    onClick={handleAutofillExample}
                  >
                    <Sparkles size={14} className="text-warning" />
                    <span>Contoh Isi Otomatis</span>
                  </button>

                  <button 
                    type="submit" 
                    className="primary-button cta-button login-btn"
                    style={{ flex: 1 }}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-icon" />
                        <span>Menyimpan & Memeriksa Perangkat...</span>
                      </>
                    ) : (
                      <>
                        <span>Simpan & Lanjutkan</span>
                        <ArrowRight size={18} className="arrow-icon" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* STEP 2: FORM TAUTKAN PERANGKAT SUPAKU MANDIRI */}
          {step === 'device' && (
            <motion.div
              key="step-device"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
            >
              <div className="onboarding-header">
                <div className="onboarding-badge" style={{ background: 'rgba(52, 211, 153, 0.14)', color: 'var(--sage-green)' }}>
                  <Radio size={14} />
                  <span>Langkah 2 dari 2: Tautkan Kumbung</span>
                </div>
                <h2>Tautkan Perangkat SupaKu</h2>
                <p className="onboarding-subtitle">
                  Hubungkan modul IoT SupaKu Anda untuk mulai memantau suhu, kelembaban, dan aktuator secara real-time. Jika perangkat belum dipasang, Anda dapat melewati langkah ini.
                </p>
              </div>

              {/* Box Info Cepat */}
              <div style={{ 
                backgroundColor: 'var(--bg-tertiary)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '12px', 
                padding: '14px 16px', 
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '8px', 
                  backgroundColor: 'rgba(52, 211, 153, 0.15)', 
                  color: 'var(--sage-green)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <QrCode size={18} />
                </div>
                <div style={{ fontSize: '0.82rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '2px' }}>
                    Punya Modul SupaKu di Dekat Anda?
                  </strong>
                  Pindai QR code atau barcode pada boks perangkat menggunakan kamera, atau ketik ID Perangkat (misal: <code>SS-001</code>).
                </div>
              </div>

              <form className="onboarding-form" onSubmit={handleDeviceSubmit}>
                <div className="onboarding-step-box">
                  {/* Nama Kumbung */}
                  <div className="form-group">
                    <label>Nama Kumbung / Lokasi *</label>
                    <div className="input-with-icon">
                      <Home size={18} className="input-icon" />
                      <input 
                        type="text"
                        placeholder="Contoh: Kumbung Tiram A - Sayap Timur"
                        value={deviceName}
                        onChange={(e) => setDeviceName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* ID Perangkat & Scan Button */}
                  <div className="form-group" style={{ marginTop: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ margin: 0 }}>ID Perangkat (Device ID) *</label>
                      <button
                        type="button"
                        onClick={() => setShowScannerModal(true)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--sage-green)',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '2px 4px'
                        }}
                      >
                        <QrCode size={14} />
                        <span>Buka Kamera Scanner</span>
                      </button>
                    </div>

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <div className="input-with-icon" style={{ width: '100%' }}>
                        <Radio size={18} className="input-icon" />
                        <input 
                          type="text"
                          placeholder="Contoh: SS-001 atau SUPAKU-01"
                          value={deviceId}
                          onChange={(e) => setDeviceId(e.target.value.toUpperCase())}
                          style={{ fontFamily: 'monospace', letterSpacing: '0.04em', paddingRight: '44px' }}
                          required
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowScannerModal(true)}
                        title="Scan Barcode / QR Code Fisik"
                        style={{
                          position: 'absolute',
                          right: '8px',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--sage-green)',
                          cursor: 'pointer',
                          padding: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <ScanLine size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Kode Aktivasi (Opsional) */}
                  <div className="form-group" style={{ marginTop: '14px' }}>
                    <label>Kode Aktivasi (Opsional)</label>
                    <div className="input-with-icon">
                      <Key size={18} className="input-icon" />
                      <input 
                        type="text"
                        placeholder="Contoh: ACT-XXXX atau SUPA-9921"
                        value={activationCode}
                        onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                        style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions: Tautkan & Skip */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
                  <button 
                    type="submit" 
                    className="primary-button cta-button login-btn"
                    style={{ width: '100%' }}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-icon" />
                        <span>Menautkan Perangkat...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        <span>Tautkan Perangkat & Buka Dashboard</span>
                      </>
                    )}
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setStep('profile')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 8px'
                      }}
                    >
                      <ArrowLeft size={14} />
                      <span>Kembali Edit Biodata</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSkipDevice}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '6px 8px',
                        textDecoration: 'underline'
                      }}
                    >
                      Lewati & Masuk ke Dashboard (Tautkan Nanti) &rarr;
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          )}
        </motion.div>
      </main>

      {/* Barcode / QR Scanner Camera Modal */}
      {showScannerModal && (
        <BarcodeScannerModal
          isOpen={showScannerModal}
          onClose={() => setShowScannerModal(false)}
          onScanSuccess={handleScanSuccess}
        />
      )}
    </div>
  );
}
