import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  Sprout, 
  ShieldCheck, 
  Sparkles,
  Radio
} from 'lucide-react';
import api, { APIError } from '../services/api';

export default function LoginScreen({ onLoginSuccess, onGuestContinue }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Masukkan identifier (username/email) dan kata sandi Anda.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.auth.login({
        identifier: identifier.trim(),
        password,
      });

      if (onLoginSuccess) {
        onLoginSuccess(response);
      }
    } catch (err) {
      console.error('[LoginScreen] Login error:', err);
      const message = err instanceof APIError 
        ? err.getUserMessage() 
        : (err.message || 'Gagal masuk. Periksa kembali akun Anda.');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (userType) => {
    setError(null);
    if (userType === 'new') {
      setIdentifier('petani_baru');
      setPassword('PasswordDefault123!');
    } else {
      setIdentifier('petani_sukamaju');
      setPassword('PasswordRahasiaBaru2026');
    }
  };

  return (
    <div className="login-canvas">
      <div className="login-wrapper">
        <motion.div 
          className="login-card"
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          {/* Header & Brand */}
          <div className="login-header">
            <div className="login-badge">
              <span className="login-badge-dot" />
              <Sprout size={14} className="text-sage" />
              <span>Smart Cultivation IoT</span>
            </div>

            <div className="login-brand">
              <div className="login-logo-container">
                <img 
                  src="/log.svg?v=2" 
                  alt="ShroomSync" 
                  onError={(e) => {
                    // Fallback if svg missing
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <h1>ShroomSync</h1>
            </div>

            <p className="login-subtitle">
              Sistem Otomasi & Monitoring Kumbung Jamur Berbasis IoT
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <motion.div 
              className="login-alert login-alert--error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.25 }}
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Form */}
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="login-identifier">Username atau Email Petani</label>
              <div className="input-with-icon">
                <User size={18} className="input-icon" />
                <input
                  id="login-identifier"
                  type="text"
                  placeholder="Contoh: petani_sukamaju atau email@domain.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={loading}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <div className="form-label-row">
                <label htmlFor="login-password">Kata Sandi</label>
                <span className="form-hint">Password akun kumbung</span>
              </div>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan kata sandi..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="primary-button full-button login-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-icon" />
                  <span>Memverifikasi Akun...</span>
                </>
              ) : (
                <>
                  <span>Masuk ke Dashboard</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Fill Buttons for Testing */}
          <div className="login-demo-section">
            <div className="demo-divider">
              <span>Akun Uji Coba Cepat (Testing)</span>
            </div>
            <div className="demo-chips">
              <button 
                type="button" 
                className="demo-chip"
                onClick={() => handleQuickFill('new')}
                title="Akun baru dengan password default (memicu onboarding)"
              >
                <Sparkles size={14} className="text-warning" />
                <span>Akun Baru (First Time)</span>
              </button>
              <button 
                type="button" 
                className="demo-chip"
                onClick={() => handleQuickFill('old')}
                title="Akun petani aktif langsung ke dashboard"
              >
                <ShieldCheck size={14} className="text-sage" />
                <span>Akun Lama (Normal)</span>
              </button>
            </div>
          </div>

          {/* Optional Guest / Demo Access */}
          {onGuestContinue && (
            <div className="login-footer-actions">
              <button 
                type="button" 
                className="guest-link-btn"
                onClick={onGuestContinue}
              >
                <Radio size={14} />
                <span>Lanjut Mode Demo / Tamu (Offline)</span>
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

