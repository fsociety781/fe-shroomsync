import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, 
  Lock, 
  User, 
  Phone, 
  Building, 
  MapPin, 
  CheckCircle, 
  AlertCircle, 
  Sparkles,
  ArrowRight,
  LogOut,
  Eye,
  EyeOff,
  Sprout
} from 'lucide-react';
import api, { APIError } from '../services/api';

export default function OnboardingScreen({ user, onComplete, onLogout }) {
  const [currentPassword, setCurrentPassword] = useState('PasswordDefault123!');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [farmName, setFarmName] = useState(user?.farmName || '');
  const [farmAddress, setFarmAddress] = useState(user?.farmAddress || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError(null);

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

    setLoading(true);

    try {
      const response = await api.auth.completeOnboarding({
        currentPassword,
        newPassword,
        fullName: fullName.trim(),
        phoneNumber: phoneNumber ? phoneNumber.trim() : '',
        farmName: farmName ? farmName.trim() : '',
        farmAddress: farmAddress ? farmAddress.trim() : '',
      });

      if (onComplete) {
        onComplete(response);
      }
    } catch (err) {
      console.error('[OnboardingScreen] Error:', err);
      const message = err instanceof APIError 
        ? err.getUserMessage() 
        : (err.message || 'Gagal menyimpan profil onboarding.');
      setError(message);
    } finally {
      setLoading(false);
    }
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

        <div className="onboarding-topbar__user">
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
          {/* Header */}
          <div className="onboarding-header">
            <div className="onboarding-badge">
              <Sparkles size={14} className="text-warning" />
              <span>Aktivasi Akun Petani Baru</span>
            </div>
            <h2>Lengkapi Biodata & Keamanan</h2>
            <p className="onboarding-subtitle">
              Selamat datang di ShroomSync! Demi keamanan data budidaya kumbung Anda, silakan ganti password default dan lengkapi data profil petani di bawah ini sebelum masuk ke Dashboard.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <motion.div 
              className="login-alert login-alert--error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.2 }}
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Form */}
          <form className="onboarding-form" onSubmit={handleSubmit}>
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
                <label>Nama Usaha / Kelompok Tani Kumbung</label>
                <div className="input-with-icon">
                  <Building size={18} className="input-icon" />
                  <input 
                    type="text"
                    placeholder="Contoh: Kumbung Berkah Tiram Mandiri"
                    value={farmName}
                    onChange={(e) => setFarmName(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '14px' }}>
                <label>Alamat Lengkap Lokasi Kumbung</label>
                <div className="input-with-icon">
                  <MapPin size={18} className="input-icon" style={{ top: '14px' }} />
                  <textarea 
                    rows={2}
                    placeholder="Contoh: Desa Cibodas RT 03 RW 02, Kec. Lembang, Kab. Bandung Barat"
                    value={farmAddress}
                    onChange={(e) => setFarmAddress(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Helpers & Submit */}
            <div className="onboarding-actions">
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
                    <span>Menyimpan & Menyiapkan Dashboard...</span>
                  </>
                ) : (
                  <>
                    <span>Selesaikan & Masuk ke Dashboard</span>
                    <ArrowRight size={18} className="arrow-icon" />
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </main>
    </div>
  );
}

