import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sprout, 
  Activity, 
  Sliders, 
  ScanLine, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  Wifi, 
  ShieldCheck, 
  Cpu, 
  Cloud, 
  Smartphone, 
  ChevronDown, 
  Droplets, 
  Thermometer, 
  Wind, 
  TrendingUp, 
  CalendarDays, 
  HelpCircle,
  ExternalLink,
  Layers,
  BarChart3,
  Flame,
  RadioTower
} from 'lucide-react';
import './LandingPage.css';

export default function LandingPage({ onGoToLogin, onGoToDashboard, isAuthenticated }) {
  // State Simulasi Iklim Mikro Interaktif di Hero
  const [simTemp, setSimTemp] = useState(25.5);
  const [simHumid, setSimHumid] = useState(86);
  const [manualPumpOverride, setManualPumpOverride] = useState(null);

  // State Kalkulator ROI Panen
  const [baglogCount, setBaglogCount] = useState(2500);
  const [pricePerKg, setPricePerKg] = useState(22000);

  // State Accordion FAQ
  const [activeFaq, setActiveFaq] = useState(0);

  // Evaluasi Otomasi Simulasi
  const isAutoMisterActive = useMemo(() => {
    if (manualPumpOverride !== null) return manualPumpOverride;
    // Otomatis menyala jika kelembaban < 82% ATAU suhu > 28°C
    return simHumid < 82 || simTemp > 28.0;
  }, [simHumid, simTemp, manualPumpOverride]);

  const isAutoFanActive = useMemo(() => {
    // Kipas menyala jika suhu > 27.5°C
    return simTemp > 27.5;
  }, [simTemp]);

  const climateStatus = useMemo(() => {
    if (simTemp >= 24 && simTemp <= 27 && simHumid >= 80 && simHumid <= 92) {
      return { text: 'Optimal untuk Tiram', color: '#4ade80', score: 98 };
    }
    if (simTemp > 28 || simHumid < 75) {
      return { text: 'Waspada: Panas / Kering', color: '#f87171', score: 64 };
    }
    return { text: 'Kondisi Menengah', color: '#facc15', score: 82 };
  }, [simTemp, simHumid]);

  // Kalkulasi Hasil Panen
  const calcResults = useMemo(() => {
    // Estimasi bobot per baglog
    const traditionalYieldPerBaglog = 0.35; // 350 gr per baglog
    const shroomSyncYieldPerBaglog = 0.48;   // 480 gr per baglog (+37% karena iklim presisi)

    const totalTraditionalKg = Math.round(baglogCount * traditionalYieldPerBaglog);
    const totalShroomSyncKg = Math.round(baglogCount * shroomSyncYieldPerBaglog);
    const extraKg = totalShroomSyncKg - totalTraditionalKg;
    const extraRevenue = extraKg * pricePerKg;

    return {
      traditionalKg: totalTraditionalKg,
      shroomSyncKg: totalShroomSyncKg,
      extraKg,
      extraRevenue,
    };
  }, [baglogCount, pricePerKg]);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const faqs = [
    {
      q: 'Bagaimana jika koneksi WiFi di kebun / kumbung jamur terputus?',
      a: 'Perangkat SupaKu dari ShroomSync dilengkapi memori internal EEPROM/Preferences. Semua batas ambang otomatis (threshold suhu & kelembaban) serta jadwal penyemprotan tetap berjalan 100% mandiri secara offline. Saat koneksi internet tersambung kembali, data sensor akan langsung disinkronkan ke cloud.'
    },
    {
      q: 'Apakah aplikasi ShroomSync bisa dipasang di smartphone Android?',
      a: 'Ya! ShroomSync dirancang dengan arsitektur terpadu. Selain dapat diakses melalui browser laptop/PC, sistem ini juga tersedia dalam bentuk aplikasi Android Native (file APK siap pasang) yang dilengkapi fitur pemindai Barcode / QR Code kamera untuk aktivasi perangkat secara instan.'
    },
    {
      q: 'Berapa banyak kumbung yang dapat dipantau dalam satu akun petani?',
      a: 'Tidak ada batasan! Satu akun petani dapat mengelola dan memantau puluhan modul kumbung sekaligus, baik yang berada di satu lokasi maupun tersebar di beberapa perkebunan yang berbeda.'
    },
    {
      q: 'Bagaimana cara menambahkan perangkat kumbung fisik baru ke sistem?',
      a: 'Sangat mudah! Cukup buka menu Kumbung Saya pada aplikasi, klik tombol Scan Barcode, dan arahkan kamera HP ke stiker barcode/QR yang tertempel pada casing SupaKu Anda. Sistem akan mengidentifikasi ID perangkat secara otomatis.'
    },
    {
      q: 'Aktuator jenis apa saja yang didukung oleh ShroomSync?',
      a: 'Secara default, ShroomSync mengendalikan 3 aktuator utama melalui relay: Pompa Nozel Kabut (Mister) untuk menaikkan kelembaban, Kipas Pembuang Udara Panas (Exhaust Fan) untuk sirkulasi dan pendinginan, serta Pompa Pengairan Lantai untuk menjaga kestabilan lantai kumbung.'
    }
  ];

  return (
    <div className="landing-page">
      {/* Background Ambient Lighting */}
      <div className="landing-ambient-bg">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
        <div className="ambient-orb ambient-orb-3" />
      </div>
      <div className="landing-grid-pattern" />

      {/* ====================================================================
          Navigation Header
          ==================================================================== */}
      <header className="lp-navbar">
        <div className="lp-nav-container">
          <div className="lp-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="lp-logo-badge">
              <img src="/log.svg?v=2" alt="ShroomSync" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            </div>
            <div className="lp-brand-text">
              <h1>ShroomSync</h1>
              <span className="lp-brand-tag">Precision AgriTech</span>
            </div>
          </div>

          <ul className="lp-nav-links">
            <li><a className="lp-nav-link" onClick={() => scrollToSection('tentang')}>Tentang Kami</a></li>
            <li><a className="lp-nav-link" onClick={() => scrollToSection('solusi')}>Solusi IoT</a></li>
            <li><a className="lp-nav-link" onClick={() => scrollToSection('arsitektur')}>Arsitektur</a></li>
            <li><a className="lp-nav-link" onClick={() => scrollToSection('kalkulator')}>Kalkulator Panen</a></li>
            <li><a className="lp-nav-link" onClick={() => scrollToSection('faq')}>FAQ</a></li>
          </ul>

          <div className="lp-nav-cta">
            {isAuthenticated ? (
              <button className="lp-btn-login" onClick={onGoToDashboard}>
                <Layers size={16} />
                <span>Buka Dashboard</span>
              </button>
            ) : (
              <>
                <button className="lp-btn-secondary" onClick={onGoToLogin}>
                  <span>Masuk</span>
                </button>
                <button className="lp-btn-login" onClick={onGoToLogin}>
                  <span>Login Petani</span>
                  <ArrowRight size={15} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ====================================================================
          Hero Section
          ==================================================================== */}
      <section className="lp-hero-section">
        <div className="lp-hero-grid">
          {/* Kolom Kiri: Headline & Deskripsi */}
          <motion.div 
            className="lp-hero-content"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="lp-hero-badge">
              <span className="lp-hero-badge-pulse" />
              <span>Smart Cultivation IoT • Generasi Terbaru 2026</span>
            </div>

            <h1 className="lp-hero-title">
              Revolusi Otomasi & Pemantauan Kumbung Jamur{' '}
              <span className="lp-gradient-text">Masa Depan</span>
            </h1>

            <p className="lp-hero-subtitle">
              Tingkatkan produktivitas jamur tiram hingga <strong>+38%</strong> dengan pengendalian iklim mikro otomatis 
              berbasis SupaKu, pompa nozel kabut presisi, dan manajemen siklus panen cerdas.
            </p>

            <div className="lp-hero-cta-group">
              <button className="lp-btn-hero-primary" onClick={isAuthenticated ? onGoToDashboard : onGoToLogin}>
                <span>{isAuthenticated ? 'Masuk ke Dashboard' : 'Mulai Sekarang / Login'}</span>
                <ArrowRight size={18} />
              </button>
              <button className="lp-btn-hero-secondary" onClick={() => scrollToSection('solusi')}>
                <Activity size={18} />
                <span>Lihat Solusi IoT</span>
              </button>
            </div>

            {/* Metrik Kunci */}
            <div className="lp-hero-metrics">
              <div className="lp-hero-metric-item">
                <h4>99.4%</h4>
                <p>Uptime Sensor Real-Time</p>
              </div>
              <div className="lp-hero-metric-item">
                <h4>+38%</h4>
                <p>Peningkatan Bobot Panen</p>
              </div>
              <div className="lp-hero-metric-item">
                <h4>75%</h4>
                <p>Efisiensi Waktu Petani</p>
              </div>
            </div>
          </motion.div>

          {/* Kolom Kanan: Simulator Iklim Mikro Interaktif */}
          <motion.div 
            className="lp-hero-interactive"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="lp-sim-card">
              <div className="lp-sim-header">
                <div className="lp-sim-title-group">
                  <div className="lp-sim-icon-box">
                    <RadioTower size={20} />
                  </div>
                  <div>
                    <h3>Simulasi Iklim Kumbung</h3>
                    <span>SupaKu Telemetry Live Preview</span>
                  </div>
                </div>
                <div className="lp-sim-live-badge">
                  <span className="lp-hero-badge-pulse" />
                  <span>ONLINE</span>
                </div>
              </div>

              {/* Gauges Suhu & Kelembaban */}
              <div className="lp-sim-gauges-grid">
                <div className="lp-sim-gauge-box">
                  <div className="lp-sim-gauge-top">
                    <span>Suhu Ruang</span>
                    <Thermometer size={16} color="#f87171" />
                  </div>
                  <div className="lp-sim-gauge-val">{simTemp.toFixed(1)}°C</div>
                  <div className="lp-sim-gauge-status" style={{ color: simTemp > 28 ? '#f87171' : '#4ade80' }}>
                    {simTemp > 28 ? '▲ Suhu Terlalu Panas' : '✓ Rentang Sejuk Ideal'}
                  </div>
                </div>

                <div className="lp-sim-gauge-box">
                  <div className="lp-sim-gauge-top">
                    <span>Kelembaban Udara</span>
                    <Droplets size={16} color="#38bdf8" />
                  </div>
                  <div className="lp-sim-gauge-val">{simHumid}%</div>
                  <div className="lp-sim-gauge-status" style={{ color: simHumid < 80 ? '#f87171' : '#4ade80' }}>
                    {simHumid < 80 ? '▼ Kurang Lembab' : '✓ Kelembaban Sangat Baik'}
                  </div>
                </div>
              </div>

              {/* Status Aktuator Real-Time */}
              <div className="lp-sim-actuators">
                <div className="lp-sim-actuators-title">Status Respon Aktuator Otomatis</div>
                <div className="lp-sim-actuators-grid">
                  <div className={`lp-actuator-pill ${isAutoMisterActive ? 'active' : ''}`}>
                    <span className="lp-actuator-name">Pompa Kabut</span>
                    <span className="lp-actuator-state">{isAutoMisterActive ? 'MENYALA' : 'STANDBY'}</span>
                  </div>
                  <div className={`lp-actuator-pill ${isAutoFanActive ? 'active' : ''}`}>
                    <span className="lp-actuator-name">Exhaust Fan</span>
                    <span className="lp-actuator-state">{isAutoFanActive ? 'MENYALA' : 'STANDBY'}</span>
                  </div>
                  <div className="lp-actuator-pill">
                    <span className="lp-actuator-name">Skor Iklim</span>
                    <span className="lp-actuator-state" style={{ color: climateStatus.color }}>
                      {climateStatus.score}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Slider Eksperimen Interaktif */}
              <div className="lp-sim-interactive-slider">
                <div className="lp-sim-slider-label">
                  <span>Geser Simulasi Suhu:</span>
                  <strong>{simTemp.toFixed(1)}°C</strong>
                </div>
                <input 
                  type="range" 
                  min="22" 
                  max="33" 
                  step="0.5" 
                  value={simTemp}
                  onChange={(e) => setSimTemp(parseFloat(e.target.value))}
                  className="lp-sim-range-input"
                />

                <div className="lp-sim-slider-label" style={{ marginTop: '12px' }}>
                  <span>Geser Simulasi Kelembaban:</span>
                  <strong>{simHumid}%</strong>
                </div>
                <input 
                  type="range" 
                  min="65" 
                  max="98" 
                  step="1" 
                  value={simHumid}
                  onChange={(e) => setSimHumid(parseInt(e.target.value))}
                  className="lp-sim-range-input"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ====================================================================
          About & Problem vs Solution Section
          ==================================================================== */}
      <section className="lp-section" id="tentang">
        <div className="lp-section-header">
          <span className="lp-section-tag">Company Profile & Visi</span>
          <h2 className="lp-section-title">Mengapa ShroomSync Hadir?</h2>
          <p className="lp-section-desc">
            Budidaya jamur tiram sangat sensitif terhadap fluktuasi cuaca tropis. Keterlambatan menyiram 
            atau panas berlebih di siang hari seringkali menyebabkan pinhead jamur kering dan gagal panen.
          </p>
        </div>

        <div className="lp-about-grid">
          {/* Sisi Tradisional */}
          <div className="lp-comparison-card lp-comparison-traditional">
            <div className="lp-comparison-header">
              <div className="lp-comparison-icon">
                <XCircle size={26} />
              </div>
              <div>
                <h3>Metode Kumbung Tradisional</h3>
                <span style={{ fontSize: '0.78rem', color: '#f87171' }}>Rentan Gagal & Boros Tenaga</span>
              </div>
            </div>
            <ul className="lp-comparison-list">
              <li className="lp-comparison-item">
                <span>❌</span>
                <div><strong>Penyemprotan Manual Kasar:</strong> Petani menyiram memakai selang secara manual yang sering membuat baglog terlalu basah atau busuk.</div>
              </li>
              <li className="lp-comparison-item">
                <span>❌</span>
                <div><strong>Kondisi Malam Hari Tak Terpantau:</strong> Suhu dingin ekstrem atau kering dini hari tidak tertangani karena petani sedang tidur.</div>
              </li>
              <li className="lp-comparison-item">
                <span>❌</span>
                <div><strong>Catatan Panen di Kertas:</strong> Buku catatan mudah basah, hilang, dan menyulitkan evaluasi efisiensi bobot panen (BER).</div>
              </li>
              <li className="lp-comparison-item">
                <span>❌</span>
                <div><strong>Petani Terikat di Lokasi:</strong> Tidak bisa bepergian jauh karena harus selalu memeriksa kelembaban kumbung.</div>
              </li>
            </ul>
          </div>

          {/* Sisi Solusi ShroomSync */}
          <div className="lp-comparison-card lp-comparison-shroom">
            <div className="lp-comparison-header">
              <div className="lp-comparison-icon">
                <CheckCircle2 size={26} />
              </div>
              <div>
                <h3>Solusi Cerdas ShroomSync</h3>
                <span style={{ fontSize: '0.78rem', color: '#4ade80' }}>Otomatis, Presisi & Terhubung</span>
              </div>
            </div>
            <ul className="lp-comparison-list">
              <li className="lp-comparison-item">
                <span>✓</span>
                <div><strong>Otomasi Kabut Mikro Presisi:</strong> Nozel kabut menyala otomatis dalam hitungan detik saat kelembaban turun di bawah 80%.</div>
              </li>
              <li className="lp-comparison-item">
                <span>✓</span>
                <div><strong>Monitoring 24/7 Tanpa Henti:</strong> Sensor membaca suhu & kelembaban setiap waktu dan memicu exhaust fan saat udara panas.</div>
              </li>
              <li className="lp-comparison-item">
                <span>✓</span>
                <div><strong>Rekap Panen & Batch Digital:</strong> Pelacakan fase baglog dari inokulasi hingga flushes panen dengan grafik analitik.</div>
              </li>
              <li className="lp-comparison-item">
                <span>✓</span>
                <div><strong>Kendali Jarak Jauh via Smartphone:</strong> Pantau kondisi kumbung dan nyalakan pompa dari mana saja melalui HP Android Anda.</div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ====================================================================
          Core Features Pillars
          ==================================================================== */}
      <section className="lp-section" id="solusi">
        <div className="lp-section-header">
          <span className="lp-section-tag">Pilar Solusi IoT</span>
          <h2 className="lp-section-title">Fitur Unggulan Sistem ShroomSync</h2>
          <p className="lp-section-desc">
            Dirancang khusus dengan standar industri agrikultur modern untuk memberikan keandalan maksimal 
            di segala kondisi perkebunan jamur.
          </p>
        </div>

        <div className="lp-features-grid">
          {/* Fitur 1 */}
          <div className="lp-feature-card">
            <div className="lp-feature-icon-box">
              <Activity size={24} />
            </div>
            <h3>Telemetri Iklim Real-Time</h3>
            <p>
              Sensor presisi DHT22 / SHT3x mengukur suhu (°C) dan kelembaban (%RH) secara kontinu, 
              ditampilkan dalam instrumen gauge dan grafik interaktif 24 jam.
            </p>
            <span className="lp-feature-tag">Sensorik Presisi Tinggi</span>
          </div>

          {/* Fitur 2 */}
          <div className="lp-feature-card">
            <div className="lp-feature-icon-box">
              <Sliders size={24} />
            </div>
            <h3>Otomasi Aktuator 3-Mode</h3>
            <p>
              Fleksibilitas kendali penuh: <strong>Mode Manual</strong> sakelar instan, <strong>Mode Auto</strong> pemicu setpoint suhu-kelembaban, dan <strong>Mode Jadwal</strong> semprot berkala.
            </p>
            <span className="lp-feature-tag">Kendali Multi-Mode</span>
          </div>

          {/* Fitur 3 */}
          <div className="lp-feature-card">
            <div className="lp-feature-icon-box">
              <ScanLine size={24} />
            </div>
            <h3>Aktivasi Barcode SupaKu</h3>
            <p>
              Integrasi pemindai barcode kamera native pada aplikasi mobile Android. Cukup scan stiker fisik 
              SupaKu untuk menautkan kumbung ke akun dalam 3 detik.
            </p>
            <span className="lp-feature-tag">Kamera Scanner Native</span>
          </div>

          {/* Fitur 4 */}
          <div className="lp-feature-card">
            <div className="lp-feature-icon-box">
              <CalendarDays size={24} />
            </div>
            <h3>Manajemen Siklus & Panen</h3>
            <p>
              Pantau fase hidup baglog dari masa inkubasi miselium, pertumbuhan primordia, hingga pencatatan 
              bobot kilogram panen berulang (flushes) dan kalkulasi rasio efisiensi (BER).
            </p>
            <span className="lp-feature-tag">Tracking Panen Digital</span>
          </div>

          {/* Fitur 5 */}
          <div className="lp-feature-card">
            <div className="lp-feature-icon-box">
              <Cloud size={24} />
            </div>
            <h3>Over-The-Air (OTA) Updates</h3>
            <p>
              Pembaruan firmware SupaKu dapat dikirimkan secara nirkabel jarak jauh dari server 
              tanpa perlu membongkar kabel atau mendatangi kumbung fisik.
            </p>
            <span className="lp-feature-tag">Remote Firmware Update</span>
          </div>

          {/* Fitur 6 */}
          <div className="lp-feature-card">
            <div className="lp-feature-icon-box">
              <Smartphone size={24} />
            </div>
            <h3>Aplikasi Web & Android Terpadu</h3>
            <p>
              Satu sistem yang berjalan harmonis di browser laptop Anda sebagai dashboard analitik mendalam, 
              sekaligus aplikasi mobile native di HP Android petani saat beraktivitas di kebun.
            </p>
            <span className="lp-feature-tag">Cross-Platform Unified</span>
          </div>
        </div>
      </section>

      {/* ====================================================================
          Architecture & Hardware Showcase
          ==================================================================== */}
      <section className="lp-section" id="arsitektur">
        <div className="lp-section-header">
          <span className="lp-section-tag">Arsitektur Ekosistem</span>
          <h2 className="lp-section-title">Bagaimana Sistem Bekerja Bersama</h2>
          <p className="lp-section-desc">
            Komunikasi data berkecepatan tinggi dengan latensi rendah dari perkebunan fisik hingga ke layar sentuh Anda.
          </p>
        </div>

        <div className="lp-arch-card">
          <div className="lp-arch-steps">
            <div className="lp-arch-step">
              <div className="lp-arch-num">1</div>
              <h4>SupaKu (Edge IoT)</h4>
              <p>SupaKu membaca sensor suhu & kelembaban dan mengendalikan relay pompa kabut serta exhaust fan.</p>
            </div>
            <div className="lp-arch-step">
              <div className="lp-arch-num">2</div>
              <h4>Protokol MQTT</h4>
              <p>Broker MQTT mendistribusikan data telemetri secara real-time dengan konsumsi kuota data sangat hemat.</p>
            </div>
            <div className="lp-arch-step">
              <div className="lp-arch-num">3</div>
              <h4>Cloud Backend</h4>
              <p>Node.js & Express memproses logika bisnis, validasi JWT, dan menyimpan riwayat ke database MariaDB.</p>
            </div>
            <div className="lp-arch-step">
              <div className="lp-arch-num">4</div>
              <h4>Web & Mobile App</h4>
              <p>Petani memantau grafik iklim, menerima notifikasi, dan mengoperasikan kumbung dari aplikasi ShroomSync.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          Interactive Harvest ROI Calculator
          ==================================================================== */}
      <section className="lp-section" id="kalkulator">
        <div className="lp-section-header">
          <span className="lp-section-tag">Simulasi Keuntungan</span>
          <h2 className="lp-section-title">Estimasi Peningkatan Hasil Panen</h2>
          <p className="lp-section-desc">
            Hitung potensi peningkatan bobot panen dan keuntungan finansial kumbung Anda dengan stabilisasi iklim mikro ShroomSync.
          </p>
        </div>

        <div className="lp-calc-box">
          <div className="lp-calc-controls">
            <h3>Kalkulator Potensi Kumbung</h3>
            <p>Geser nilai di bawah ini sesuai dengan kapasitas populasi baglog kumbung jamur Anda:</p>

            <div className="lp-calc-slider-group">
              <div className="lp-calc-slider-header">
                <span>Populasi Baglog:</span>
                <strong>{baglogCount.toLocaleString('id-ID')} Baglog</strong>
              </div>
              <input 
                type="range" 
                min="500" 
                max="10000" 
                step="250" 
                value={baglogCount}
                onChange={(e) => setBaglogCount(parseInt(e.target.value))}
                className="lp-calc-slider"
              />
            </div>

            <div className="lp-calc-slider-group">
              <div className="lp-calc-slider-header">
                <span>Harga Jual Rata-rata per Kg:</span>
                <strong>Rp {pricePerKg.toLocaleString('id-ID')} / Kg</strong>
              </div>
              <input 
                type="range" 
                min="15000" 
                max="35000" 
                step="1000" 
                value={pricePerKg}
                onChange={(e) => setPricePerKg(parseInt(e.target.value))}
                className="lp-calc-slider"
              />
            </div>
          </div>

          <div className="lp-calc-results">
            <div className="lp-calc-metric-row">
              <span className="lp-calc-metric-label">Estimasi Panen Tradisional</span>
              <span className="lp-calc-metric-val">{calcResults.traditionalKg.toLocaleString('id-ID')} Kg</span>
            </div>
            <div className="lp-calc-metric-row">
              <span className="lp-calc-metric-label">Estimasi Panen ShroomSync (+37%)</span>
              <span className="lp-calc-metric-val" style={{ color: '#4ade80' }}>
                {calcResults.shroomSyncKg.toLocaleString('id-ID')} Kg
              </span>
            </div>
            <div className="lp-calc-metric-row">
              <span className="lp-calc-metric-label">Tambahan Bobot Panen</span>
              <span className="lp-calc-metric-val">+{calcResults.extraKg.toLocaleString('id-ID')} Kg</span>
            </div>
            <div className="lp-calc-metric-row">
              <span className="lp-calc-metric-label">Potensi Tambahan Omset / Siklus</span>
              <span className="lp-calc-metric-val highlight">
                +Rp {calcResults.extraRevenue.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          FAQ Section
          ==================================================================== */}
      <section className="lp-section" id="faq">
        <div className="lp-section-header">
          <span className="lp-section-tag">Tanya Jawab</span>
          <h2 className="lp-section-title">Pertanyaan yang Sering Diajukan</h2>
          <p className="lp-section-desc">
            Informasi penting seputar pemasangan perangkat, kebutuhan jaringan, dan penggunaan aplikasi ShroomSync.
          </p>
        </div>

        <div className="lp-faq-container">
          {faqs.map((faq, idx) => (
            <div key={idx} className="lp-faq-item">
              <div 
                className="lp-faq-question"
                onClick={() => setActiveFaq(activeFaq === idx ? -1 : idx)}
              >
                <h4>{faq.q}</h4>
                <ChevronDown 
                  size={18} 
                  style={{ 
                    transform: activeFaq === idx ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                    color: activeFaq === idx ? 'var(--lp-primary-light)' : 'var(--lp-text-muted)'
                  }} 
                />
              </div>
              <AnimatePresence>
                {activeFaq === idx && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="lp-faq-answer">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      {/* ====================================================================
          Bottom CTA Banner
          ==================================================================== */}
      <div className="lp-cta-banner">
        <h2>Siap Modernisasi Kumbung Jamur Anda?</h2>
        <p>
          Tingkatkan hasil panen jamur tiram Anda sekarang dengan sistem pemantauan dan otomatisasi 
          iklim mikro terbaik. Masuk ke dashboard untuk memulai pengelolaan.
        </p>
        <button className="lp-btn-hero-primary" onClick={isAuthenticated ? onGoToDashboard : onGoToLogin} style={{ margin: '0 auto' }}>
          <span>{isAuthenticated ? 'Buka Dashboard Sistem' : 'Buka Aplikasi ShroomSync'}</span>
          <ArrowRight size={18} />
        </button>
      </div>

      {/* ====================================================================
          Footer
          ==================================================================== */}
      <footer className="lp-footer">
        <div className="lp-footer-container">
          <div className="lp-footer-brand">
            <div className="lp-brand">
              <div className="lp-logo-badge">
                <img src="/log.svg?v=2" alt="ShroomSync" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              </div>
              <div className="lp-brand-text">
                <h1>ShroomSync</h1>
                <span className="lp-brand-tag">Precision AgriTech</span>
              </div>
            </div>
            <p>
              Platform otomatisasi iklim mikro dan manajemen budidaya jamur tiram cerdas berbasis Internet of Things (IoT).
            </p>
          </div>

          <div className="lp-footer-col">
            <h4>Navigasi</h4>
            <ul className="lp-footer-links">
              <li><a onClick={() => scrollToSection('tentang')}>Tentang Kami</a></li>
              <li><a onClick={() => scrollToSection('solusi')}>Solusi IoT</a></li>
              <li><a onClick={() => scrollToSection('arsitektur')}>Arsitektur Sistem</a></li>
              <li><a onClick={() => scrollToSection('kalkulator')}>Kalkulator Panen</a></li>
            </ul>
          </div>

          <div className="lp-footer-col">
            <h4>Fitur Sistem</h4>
            <ul className="lp-footer-links">
              <li><a onClick={() => scrollToSection('solusi')}>Telemetri Real-Time</a></li>
              <li><a onClick={() => scrollToSection('solusi')}>Otomasi 3-Mode</a></li>
              <li><a onClick={() => scrollToSection('solusi')}>Scan Barcode SupaKu</a></li>
              <li><a onClick={() => scrollToSection('solusi')}>Manajemen Siklus Panen</a></li>
            </ul>
          </div>

          <div className="lp-footer-col">
            <h4>Aplikasi</h4>
            <ul className="lp-footer-links">
              <li><a onClick={isAuthenticated ? onGoToDashboard : onGoToLogin}>{isAuthenticated ? 'Buka Dashboard' : 'Login Petani'}</a></li>
              <li><a href="/flowchart-viewer.html" target="_blank">Diagram Flowchart Sistem</a></li>
              <li><a onClick={() => scrollToSection('faq')}>Pusat Bantuan / FAQ</a></li>
            </ul>
          </div>
        </div>

        <div className="lp-footer-bottom">
          <span>&copy; {new Date().getFullYear()} ShroomSync Inc. Hak Cipta Dilindungi Undang-Undang.</span>
          <span>Versi Sistem: 1.0.0 • AgriTech Precision Farming</span>
        </div>
      </footer>
    </div>
  );
}

