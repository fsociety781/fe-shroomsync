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
  Cpu,
  Sun,
  Moon,
  Thermometer,
  Wind,
  Sparkles
} from 'lucide-react';
import api, { APIError } from '../services/api';
import { isMobileApp } from '../utils/platform';
import './LoginScreen.css';

export default function LoginScreen({ onLoginSuccess, onBackToLanding, theme: propTheme, toggleTheme: propToggleTheme }) {
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
  
  // Theme Fallback
  const [localTheme, setLocalTheme] = useState(() => {
    return document.documentElement.getAttribute('data-theme') || localStorage.getItem('shroomsync_theme') || 'dark';
  });
  const activeTheme = propTheme || localTheme;

  const handleToggleTheme = () => {
    if (propToggleTheme) {
      propToggleTheme();
    } else {
      const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';
      setLocalTheme(nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('shroomsync_theme', nextTheme);
    }
  };

  // Modals
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
    <div className="login-canvas" data-theme={activeTheme}>
      {/* Background Ambient Lighting & IoT Grid (Synchronized with Landing Page) */}
      <div className="login-ambient-layer">
        <div className="login-orb login-orb-emerald" />
        <div className="login-orb login-orb-bronze" />
        <div className="login-orb login-orb-gold" />
      </div>
      <div className="login-grid-layer" />

      {/* Top Header Controls: Navigation, System Online Pill, and Theme Switcher */}
      <header className="login-topbar">
        {!isMobileApp() && onBackToLanding ? (
          <button 
            type="button"
            onClick={onBackToLanding}
            className="login-back-btn"
            title="Kembali ke Landing Page Beranda"
          >
            <ArrowLeft size={15} />
            <span>Kembali ke Beranda</span>
          </button>
        ) : <div />}

        <div className="login-topbar-right">
          <div className="login-status-pill">
            <span className="login-status-dot" />
            <span>Sistem Operasional Online</span>
          </div>

          <button
            type="button"
            onClick={handleToggleTheme}
            className="login-theme-btn"
            title={activeTheme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
            aria-label="Toggle Theme"
          >
            {activeTheme === 'dark' ? (
              <>
                <Sun size={15} style={{ color: '#FBBF24' }} />
                <span>Terang</span>
              </>
            ) : (
              <>
                <Moon size={15} style={{ color: '#4B5563' }} />
                <span>Gelap</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Master Login Card Architecture */}
      <div className="login-wrapper">
        <motion.div 
          className="login-card"
          initial={{ opacity: 0, y: 22, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          {/* Left Column: Enterprise IoT Showcase (Hidden on Mobile, Visible on Desktop) */}
          <div className="login-showcase-panel">
            <div>
              <div className="login-showcase-badge">
                <Sprout size={14} />
                <span>SupaKu IoT Ecosystem • v2.4</span>
              </div>

              <h2 className="login-showcase-title">
                Presisi Iklim Mikro <span>Kumbung Jamur</span> Modern
              </h2>
              <p className="login-showcase-desc">
                Portal komprehensif telemetri real-time, monitoring sensorik sub-detik, dan otomasi aktuator cerdas untuk memaksimalkan produktivitas panen jamur Anda.
              </p>

              <div className="login-features-list">
                <div className="login-feature-card">
                  <div className="login-feature-icon-box">
                    <Thermometer size={18} />
                  </div>
                  <div className="login-feature-content">
                    <strong>Telemetri Sensor Presisi Tinggi</strong>
                    <p>Monitoring suhu & RH real-time dengan sensor industri SHT40.</p>
                  </div>
                </div>

                <div className="login-feature-card">
                  <div className="login-feature-icon-box" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B' }}>
                    <Wind size={18} />
                  </div>
                  <div className="login-feature-content">
                    <strong>Otonom & Fail-Safe Actuation</strong>
                    <p>SupaKu Controller tetap menjaga sirkulasi & kabut meski offline.</p>
                  </div>
                </div>

                <div className="login-feature-card">
                  <div className="login-feature-icon-box" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38BDF8' }}>
                    <Cpu size={18} />
                  </div>
                  <div className="login-feature-content">
                    <strong>Mesh Networking & TLS 1.3</strong>
                    <p>Konektivitas stabil terdistribusi dengan enkripsi tingkat perbankan.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="login-showcase-footer">
              <span>Sistem Terverifikasi SupaKu Core</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#86efac' }}>
                <Sparkles size={13} />
                <span>Standar Industri Pertanian</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Login Form */}
          <div className="login-form-panel">
            <div className="login-header">
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

            {/* Error Notification Alert */}
            {error && (
              <motion.div 
                className="login-alert login-alert--error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.25 }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Form Input Fields */}
            <form className="login-form" onSubmit={handleSubmit}>
              <div className="login-form-group">
                <label htmlFor="login-identifier">Username atau Email Akun</label>
                <div className="login-input-wrapper">
                  <User size={18} className="login-input-icon" />
                  <input
                    id="login-identifier"
                    type="text"
                    className="login-input-field"
                    placeholder="Masukkan username atau email terdaftar..."
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    disabled={loading}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="login-form-group">
                <div className="login-label-row">
                  <label htmlFor="login-password">Kata Sandi</label>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="login-forgot-link"
                  >
                    Lupa kata sandi?
                  </button>
                </div>
                <div className="login-input-wrapper">
                  <Lock size={18} className="login-input-icon" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="login-input-field"
                    placeholder="Masukkan kata sandi akun..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="login-pw-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox & Core Status */}
              <div className="login-meta-row">
                <label className="login-checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Ingat saya di perangkat ini</span>
                </label>

                <span className="login-meta-core">
                  Terkoneksi SupaKu IoT Core
                </span>
              </div>

              {/* Action Submit Button */}
              <button 
                type="submit" 
                className="login-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="login-spinner" />
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

            {/* Security Trust Indicators */}
            <div className="login-trust-bar">
              <div className="login-trust-item">
                <Shield size={14} style={{ color: '#4ade80' }} />
                <span>TLS 1.3 Terenkripsi</span>
              </div>
              <div className="login-trust-item">
                <Cpu size={14} style={{ color: '#60a5fa' }} />
                <span>SupaKu Mesh IoT</span>
              </div>
              <div className="login-trust-item">
                <CheckCircle2 size={14} style={{ color: '#c084fc' }} />
                <span>Multi-Role RBAC</span>
              </div>
            </div>

            {/* Legal Links & Version Footer */}
            <div className="login-legal-footer">
              <div>
                <button 
                  type="button" 
                  onClick={() => setShowTermsModal(true)} 
                  className="login-legal-link"
                >
                  Syarat & Ketentuan Layanan
                </button>
                <span> • </span>
                <button 
                  type="button" 
                  onClick={() => setShowTermsModal(true)} 
                  className="login-legal-link"
                >
                  Kebijakan Privasi
                </button>
              </div>
              <div style={{ marginTop: '5px', opacity: 0.75 }}>
                © 2026 ShroomSync Technologies. Hak Cipta Dilindungi. <span style={{ marginLeft: '4px', fontSize: '0.68rem', opacity: 0.65 }}>v2.4.0</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Modal Lupa Kata Sandi */}
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

      {/* Modal Syarat & Kebijakan Privasi */}
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
