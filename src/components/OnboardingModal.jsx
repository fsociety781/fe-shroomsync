import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  ArrowRight
} from 'lucide-react';
import api, { APIError } from '../services/api';

export default function OnboardingModal({ isOpen, user, onComplete }) {
  const [currentPassword, setCurrentPassword] = useState('PasswordDefault123!');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [farmName, setFarmName] = useState(user?.farmName || '');
  const [farmAddress, setFarmAddress] = useState(user?.farmAddress || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

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
        phoneNumber: phoneNumber.trim(),
        farmName: farmName.trim(),
        farmAddress: farmAddress.trim(),
      });

      if (onComplete) {
        onComplete(response);
      }
    } catch (err) {
      console.error('[OnboardingModal] Error:', err);
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
    <AnimatePresence>
      <div className="modal-overlay" style={{ zIndex: 9999 }}>
        <motion.div 
          className="modal-container onboarding-modal"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.35 }}
        >
          {/* Header */}
          <div className="modal-header onboarding-modal__header">
            <div className="onboarding-modal__icon-wrap">
              <Sparkles size={24} className="text-warning" />
            </div>
            <div>
              <h3>Aktivasi Profil Petani & Keamanan</h3>
              <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '2px' }}>
                Selamat datang! Karena ini login pertama kali, silakan ganti password default dan lengkapi data usaha kumbung Anda.
              </p>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="login-alert login-alert--error" style={{ margin: '0 24px 16px 24px' }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form className="modal-form" onSubmit={handleSubmit} style={{ maxHeight: '72vh', overflowY: 'auto' }}>
            <div className="onboarding-section-title">
              <Lock size={16} className="text-sage" />
              <span>1. Perbarui Kata Sandi Akun</span>
            </div>

            <div className="form-group">
              <label>Password Default Saat Ini</label>
              <input 
                type="password"
                className="control-input"
                placeholder="Password default dari admin"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Password Baru</label>
                <input 
                  type="password"
                  className="control-input"
                  placeholder="Min. 6 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Ulangi Password Baru</label>
                <input 
                  type="password"
                  className="control-input"
                  placeholder="Konfirmasi password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="onboarding-section-title" style={{ marginTop: '16px' }}>
              <Building size={16} className="text-sage" />
              <span>2. Biodata & Usaha Kumbung Jamur</span>
            </div>

            <div className="form-group">
              <label>Nama Lengkap Petani / Pengelola *</label>
              <div className="input-with-icon">
                <User size={18} className="input-icon" />
                <input 
                  type="text"
                  className="control-input"
                  placeholder="Contoh: Budi Santoso"
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
                  className="control-input"
                  placeholder="Contoh: 081234567890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Nama Kumbung / Usaha Budidaya</label>
              <div className="input-with-icon">
                <Building size={18} className="input-icon" />
                <input 
                  type="text"
                  className="control-input"
                  placeholder="Contoh: Kumbung Berkah Tiram Mandiri"
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Alamat Lokasi Kumbung</label>
              <div className="input-with-icon">
                <MapPin size={18} className="input-icon" />
                <textarea 
                  className="control-input"
                  rows={2}
                  placeholder="Contoh: Desa Cibodas RT 03 RW 02, Lembang, Jawa Barat"
                  value={farmAddress}
                  onChange={(e) => setFarmAddress(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
              <button 
                type="button" 
                className="secondary-button" 
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                onClick={handleAutofillExample}
              >
                Contoh Isi Otomatis
              </button>
            </div>

            {/* Modal Actions */}
            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button 
                type="submit" 
                className="primary-button full-button"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-icon" />
                    <span>Menyimpan & Mengaktifkan...</span>
                  </>
                ) : (
                  <>
                    <span>Selesaikan & Masuk Dashboard</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

