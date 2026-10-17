import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ArrowLeft,
  AlertCircle, 
  Sprout, 
  HelpCircle,
  X,
  MessageSquare,
  Mail,
  Shield,
  CheckCircle2,
  Cpu
} from 'lucide-react';
import api, { APIError } from '../services/api';
import { isMobileApp } from '../utils/platform';

export default function LoginScreen({ onLoginSuccess, onBackToLanding }) {
  const [identifier, setIdentifier] = useState(() => {
    return localStorage.getItem('shroomsync_saved_identifier') || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('shroomsync_remember_me') === 'true';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Professional Modals
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  useEffect(() => {
    if (rememberMe && identifier) {
      localStorage.setItem('shroomsync_saved_identifier', identifier);
      localStorage.setItem('shroomsync_remember_me', 'true');
    } else if (!rememberMe) {
      localStorage.removeItem('shroomsync_saved_identifier');
      localStorage.removeItem('shroomsync_remember_me');
    }
  }, [rememberMe, identifier]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Harap masukkan username/email dan kata sandi Anda.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.auth.login({
        identifier: identifier.trim(),
        password,
      });

      const userRole = (response?.user?.role || '').toUpperCase();
      if (isMobileApp() && userRole !== 'FARMER') {
        api.auth.logout();
        setError('Akses Ditolak: Aplikasi mobile ShroomSync dikhususkan untuk Petani Kumbung. Administrator dan Teknisi dapat mengakses portal melalui browser web di komputer/laptop.');
        return;
      }

      if (rememberMe) {
        localStorage.setItem('shroomsync_saved_identifier', identifier.trim());
      }

      if (onLoginSuccess) {
        onLoginSuccess(response);
      }
    } catch (err) {
      console.error('[LoginScreen] Login error:', err);
      const message = err instanceof APIError 
        ? err.getUserMessage() 
        : (err.message || 'Kredensial tidak valid. Periksa kembali identifier atau kata sandi Anda.');
      setError(message);
    } finally {
      setLoading(false);
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
          {/* Header Navigation: Kembali ke Beranda (Hanya di Web Desktop) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            {!isMobileApp() && onBackToLanding ? (
              <button 
                type="button"
                onClick={onBackToLanding}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(82, 163, 107, 0.25)',
                  color: 'var(--text-secondary, #9cb1a2)',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                }}
              >
                <ArrowLeft size={14} />
                <span>Kembali ke Beranda</span>
              </button>
            ) : <div />}

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#86efac' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block', boxShadow: '0 0 8px #22c55e' }} />
              <span>Sistem Operasional Online</span>
            </div>
          </div>

          {/* Header & Brand Identitas Resmi */}
          <div className="login-header">
            <div className="login-badge">
              <span className="login-badge-dot" />
              <Sprout size={14} className="text-sage" />
              <span>{isMobileApp() ? 'Aplikasi Mobile Petani Kumbung' : 'Enterprise Smart Cultivation IoT'}</span>
            </div>

            <div className="login-brand">
              <div className="login-logo-container">
                <img 
                  src="/log.svg?v=2" 
                  alt="ShroomSync" 
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <h1>ShroomSync</h1>
            </div>

            <p className="login-subtitle">
              {isMobileApp() 
                ? 'Portal Mandiri Petani — Monitoring & Kontrol Kumbung Jamur' 
                : 'Portal Manajemen & Kendali Otomasi Ekosistem Kumbung Jamur'}
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

          {/* Form Login Resmi */}
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="login-identifier">Username atau Email Akun</label>
              <div className="input-with-icon">
                <User size={18} className="input-icon" />
                <input
                  id="login-identifier"
                  type="text"
                  placeholder="Masukkan username atau email terdaftar..."
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
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary, #5a9e6f)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Lupa kata sandi?
                </button>
              </div>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan kata sandi akun..."
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

            {/* Remember Me Option */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 16px 0', fontSize: '0.82rem', color: 'var(--text-secondary, #9cb1a2)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ accentColor: '#447253', width: '15px', height: '15px', cursor: 'pointer' }}
                />
                <span>Ingat saya di perangkat ini</span>
              </label>

              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Terkoneksi SupaKu IoT Core
              </span>
            </div>

            <button 
              type="submit" 
              className="primary-button full-button login-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-icon" />
                  <span>Mengautentikasi Sesi...</span>
                </>
              ) : (
                <>
                  <span>Masuk ke Dashboard</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Security & Reliability Trust Indicators */}
          <div style={{
            marginTop: '24px',
            paddingTop: '18px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            fontSize: '0.74rem',
            color: 'var(--text-muted, #7c9383)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Shield size={14} style={{ color: '#4ade80' }} />
              <span>TLS 1.3 Terenkripsi</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Cpu size={14} style={{ color: '#60a5fa' }} />
              <span>SupaKu Mesh IoT</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <CheckCircle2 size={14} style={{ color: '#c084fc' }} />
              <span>Multi-Role RBAC</span>
            </div>
          </div>

          {/* Footer Legal & Version */}
          <div style={{
            marginTop: '16px',
            textAlign: 'center',
            fontSize: '0.72rem',
            color: 'var(--text-muted, #6f8275)'
          }}>
            <div>
              <button 
                type="button" 
                onClick={() => setShowTermsModal(true)} 
                style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: '0 4px', fontSize: 'inherit' }}
              >
                Syarat & Ketentuan Layanan
              </button>
              <span> • </span>
              <button 
                type="button" 
                onClick={() => setShowTermsModal(true)} 
                style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: '0 4px', fontSize: 'inherit' }}
              >
                Kebijakan Privasi
              </button>
            </div>
            <div style={{ marginTop: '4px', opacity: 0.7 }}>
              © 2026 ShroomSync Technologies. Hak Cipta Dilindungi. <span style={{ marginLeft: '6px', fontSize: '0.68rem', opacity: 0.6 }}>v2.4.0</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Modal Lupa Kata Sandi Resmi */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="modal-overlay" onClick={() => setShowForgotModal(false)} style={{ zIndex: 10000 }}>
            <motion.div 
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{ maxWidth: '460px', padding: '24px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(82, 163, 107, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#86efac' }}>
                    <HelpCircle size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Pemulihan Kata Sandi</h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Prosedur Pengaturan Ulang Kredensial</p>
                  </div>
                </div>
                <button type="button" className="icon-button" onClick={() => setShowForgotModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>
                Demi keamanan ekosistem otomasi kumbung, reset kata sandi dilakukan melalui verifikasi oleh <strong>Administrator Regional</strong> atau tim teknis ShroomSync.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                <a
                  href="https://wa.me/6281234567890?text=Halo%20Admin%20ShroomSync,%20saya%20ingin%20mengajukan%20permohonan%20reset%20kata%20sandi%20akun%20kumbung%20saya."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="primary-button"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none', padding: '12px', borderRadius: '10px' }}
                >
                  <MessageSquare size={16} />
                  <span>Hubungi Hotline WhatsApp Admin</span>
                </a>

                <a
                  href="mailto:support@shroomsync.id?subject=Permohonan%20Reset%20Password%20ShroomSync"
                  className="secondary-button"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none', padding: '10px', borderRadius: '10px' }}
                >
                  <Mail size={16} />
                  <span>Kirim Email ke support@shroomsync.id</span>
                </a>
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.5', backgroundColor: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <HelpCircle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px', color: 'var(--primary, #5a9e6f)' }} /> <em>Catatan:</em> Pastikan Anda menyiapkan username serta Nomor Seri <strong>SupaKu</strong> yang terpasang pada kumbung Anda untuk proses verifikasi kepemilikan.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Syarat & Privasi Resmi */}
      <AnimatePresence>
        {showTermsModal && (
          <div className="modal-overlay" onClick={() => setShowTermsModal(false)} style={{ zIndex: 10000 }}>
            <motion.div 
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{ maxWidth: '520px', padding: '24px', maxHeight: '80vh', overflowY: 'auto' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Kebijakan & Privasi Layanan</h3>
                <button type="button" className="icon-button" onClick={() => setShowTermsModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p>
                  <strong>1. Kerahasiaan Data Telemetri</strong><br />
                  Semua data sensor suhu, kelembaban, dan jadwal aktuasi yang dikirimkan oleh unit <strong>SupaKu</strong> dienkripsi secara end-to-end dan hanya dapat diakses oleh pemilik kumbung serta personel berwenang.
                </p>
                <p>
                  <strong>2. Keandalan Otomasi Perangkat</strong><br />
                  Sistem otomasi lokal pada unit SupaKu didesain untuk tetap bekerja secara otonom (*fail-safe*) bahkan ketika konektivitas internet sedang terputus, guna menjaga keberlangsungan siklus jamur tiram Anda.
                </p>
                <p>
                  <strong>3. Tanggung Jawab Akun</strong><br />
                  Pengguna bertanggung jawab atas kerahasiaan kata sandi akun masing-masing. Selalu amankan kredensial Anda dan segera laporkan jika terdapat indikasi aktivitas tidak sah.
                </p>
              </div>

              <div style={{ marginTop: '20px', textAlign: 'right' }}>
                <button type="button" className="primary-button" onClick={() => setShowTermsModal(false)} style={{ padding: '8px 20px' }}>
                  Saya Mengerti
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
