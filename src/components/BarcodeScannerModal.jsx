import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Camera, 
  CameraOff, 
  X, 
  Zap, 
  ZapOff, 
  Upload, 
  RotateCw, 
  ScanLine, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

/**
 * Smart parser untuk barcode / QR perangkat ShroomSync:
 * Mendukung JSON payload, URL query parameter, format prefix, maupun raw Device ID.
 */
export const parseScannedDevice = (rawText) => {
  if (!rawText || typeof rawText !== 'string') {
    return { deviceId: '', name: '' };
  }

  const text = rawText.trim();

  // 1. Format JSON: {"deviceId": "SS-001", "name": "Kumbung 1"}
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      const deviceId = parsed.deviceId || parsed.id || parsed.serialNumber || '';
      const name = parsed.name || parsed.deviceName || '';
      if (deviceId) {
        return { deviceId: String(deviceId).trim(), name: String(name).trim() };
      }
    } catch {
      // bukan JSON valid, lanjutkan ke aturan berikutnya
    }
  }

  // 2. Format URL query string: https://shroomsync.web.id/activate?deviceId=SS-001&name=Kumbung
  try {
    const urlMatch = text.match(/[?&](?:deviceId|id)=([^&]+)/i);
    if (urlMatch) {
      const deviceId = decodeURIComponent(urlMatch[1]);
      const nameMatch = text.match(/[?&]name=([^&]+)/i);
      const name = nameMatch ? decodeURIComponent(nameMatch[1]) : '';
      return { deviceId: deviceId.trim(), name: name.trim() };
    }
  } catch {
    // abaikan error regex URL
  }

  // 3. Format Prefix: "ID:SS-001", "DEVICE:SS-001", "SN:SS-001"
  const prefixMatch = text.match(/^(?:DEVICE|ID|SN|SERIAL)[:=\s_-]+(.+)$/i);
  if (prefixMatch && prefixMatch[1]) {
    return { deviceId: prefixMatch[1].trim(), name: '' };
  }

  // 4. Default: Raw string (misal: "SS-001", "ESP32-KUMBUNG-A")
  return { deviceId: text, name: '' };
};

const BarcodeScannerModal = ({ isOpen, onClose, onScanSuccess }) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' | 'user'
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const containerId = 'shroomsync-barcode-scanner';

  const stopScannerSafe = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('Scanner stop error:', err);
      } finally {
        scannerRef.current = null;
        setCameraActive(false);
        setTorchOn(false);
      }
    }
  };

  const handleScanHit = (decodedText) => {
    if (!decodedText || scanResult) return;

    // Trigger haptic feedback jika didukung perangkat
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([80, 50, 80]);
      } catch {
        // abaikan jika tidak diizinkan
      }
    }

    const parsed = parseScannedDevice(decodedText);
    setScanResult(parsed);

    // Hentikan kamera dan teruskan hasil ke parent
    stopScannerSafe();

    setTimeout(() => {
      onScanSuccess(parsed);
      onClose();
    }, 900);
  };

  const startScanner = async () => {
    setErrorMessage(null);
    setScanResult(null);

    // Pastikan elemen DOM sudah siap
    const element = document.getElementById(containerId);
    if (!element) return;

    try {
      await stopScannerSafe();

      const html5QrCode = new Html5Qrcode(containerId, { verbose: false });
      scannerRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          // Ukuran dinamis ramah layar HP
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const edge = Math.max(Math.floor(minEdge * 0.72), 220);
          return { width: edge, height: edge };
        },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        { facingMode: facingMode },
        config,
        (decodedText) => {
          handleScanHit(decodedText);
        },
        () => {
          // Frame tidak mengandung barcode/QR, abaikan
        }
      );

      setCameraActive(true);

      // Cek apakah kamera mendukung fitur torch/flashlight
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities?.();
        if (capabilities && capabilities.torch) {
          setTorchSupported(true);
        } else {
          setTorchSupported(false);
        }
      } catch {
        setTorchSupported(false);
      }
    } catch (err) {
      console.error('Kamera scanner error:', err);
      let msg = 'Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan di perangkat Anda.';
      if (err?.name === 'NotAllowedError' || String(err).includes('Permission denied')) {
        msg = 'Izin kamera ditolak. Silakan berikan izin akses kamera di pengaturan aplikasi HP Anda.';
      } else if (err?.name === 'NotFoundError') {
        msg = 'Kamera tidak ditemukan pada perangkat ini.';
      }
      setErrorMessage(msg);
      setCameraActive(false);
    }
  };

  const toggleCamera = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !torchSupported) return;
    try {
      const nextTorch = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch (err) {
      console.warn('Gagal mengubah senter/torch:', err);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setErrorMessage(null);

    try {
      await stopScannerSafe();
      const html5QrCode = new Html5Qrcode(containerId, { verbose: false });
      const decodedText = await html5QrCode.scanFile(file, true);
      handleScanHit(decodedText);
    } catch (err) {
      console.error('File scan error:', err);
      setErrorMessage('Barcode atau QR Code tidak terdeteksi pada gambar yang diunggah.');
      // Restart scanner kamera setelah gagal scan gambar
      setTimeout(() => {
        startScanner();
      }, 1500);
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Lifecycle efek: Start saat modal dibuka, Stop saat modal ditutup
  useEffect(() => {
    if (isOpen) {
      // Beri sedikit jeda agar DOM render
      const timer = setTimeout(() => {
        startScanner();
      }, 200);
      return () => {
        clearTimeout(timer);
        stopScannerSafe();
      };
    } else {
      stopScannerSafe();
    }
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="barcode-modal-overlay"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(10, 15, 12, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px',
        }}
      >
        <motion.div
          className="barcode-modal-container"
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={{
            width: '100%',
            maxWidth: '440px',
            backgroundColor: 'var(--bg-secondary, #18221c)',
            border: '1px solid rgba(74, 124, 89, 0.35)',
            borderRadius: '24px',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {/* Header Modal */}
          <div 
            style={{
              padding: '18px 20px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div 
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(74, 124, 89, 0.18)',
                  color: 'var(--primary, #5a9e6f)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(74, 124, 89, 0.3)',
                }}
              >
                <ScanLine size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary, #e6f0ea)' }}>
                  Scan Barcode Perangkat
                </h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary, #94a399)' }}>
                  Arahkan kamera ke stiker atau layar QR ESP32
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary, #cbd5e1)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              title="Tutup Pemindai"
            >
              <X size={18} />
            </button>
          </div>

          {/* Area Viewfinder Scanner */}
          <div 
            style={{
              position: 'relative',
              width: '100%',
              minHeight: '320px',
              backgroundColor: '#0a0f0d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {/* HTML5 QR Container */}
            <div 
              id={containerId} 
              style={{
                width: '100%',
                height: '100%',
                overflow: 'hidden',
              }}
            />

            {/* Visual Reticle Overlay saat kamera aktif dan belum ada hasil */}
            {cameraActive && !scanResult && (
              <div 
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Kotak Reticle Target */}
                <div 
                  style={{
                    position: 'relative',
                    width: '240px',
                    height: '240px',
                    borderRadius: '16px',
                    border: '2px dashed rgba(74, 124, 89, 0.45)',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                  }}
                >
                  {/* Garis Laser Animasi */}
                  <div 
                    style={{
                      position: 'absolute',
                      left: '5%',
                      width: '90%',
                      height: '2px',
                      background: 'linear-gradient(90deg, transparent, #4ade80, transparent)',
                      boxShadow: '0 0 12px #4ade80',
                      animation: 'scanBeam 2s infinite ease-in-out',
                    }}
                  />
                  {/* Sudut-sudut Reticle */}
                  <div style={{ position: 'absolute', top: '-2px', left: '-2px', width: '22px', height: '22px', borderTop: '3px solid #4ade80', borderLeft: '3px solid #4ade80', borderTopLeftRadius: '14px' }} />
                  <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '22px', height: '22px', borderTop: '3px solid #4ade80', borderRight: '3px solid #4ade80', borderTopRightRadius: '14px' }} />
                  <div style={{ position: 'absolute', bottom: '-2px', left: '-2px', width: '22px', height: '22px', borderBottom: '3px solid #4ade80', borderLeft: '3px solid #4ade80', borderBottomLeftRadius: '14px' }} />
                  <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '22px', height: '22px', borderBottom: '3px solid #4ade80', borderRight: '3px solid #4ade80', borderBottomRightRadius: '14px' }} />
                </div>
              </div>
            )}

            {/* Animasi Sukses saat Barcode Berhasil Terdeteksi */}
            {scanResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(20, 42, 28, 0.92)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px',
                  zIndex: 20,
                  textAlign: 'center',
                }}
              >
                <div 
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(74, 222, 128, 0.2)',
                    color: '#4ade80',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <CheckCircle2 size={38} />
                </div>
                <h4 style={{ color: '#ffffff', fontSize: '1.2rem', margin: '0 0 6px' }}>
                  Barcode Berhasil Terbaca!
                </h4>
                <div 
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.4)',
                    padding: '8px 18px',
                    borderRadius: '10px',
                    border: '1px solid rgba(74, 222, 128, 0.3)',
                    marginTop: '8px',
                  }}
                >
                  <span style={{ fontSize: '0.9rem', color: '#94a399' }}>ID Perangkat: </span>
                  <strong style={{ color: '#4ade80', fontSize: '1rem', letterSpacing: '0.5px' }}>
                    {scanResult.deviceId}
                  </strong>
                  {scanResult.name && (
                    <div style={{ fontSize: '0.82rem', color: '#e6f0ea', marginTop: '4px' }}>
                      Nama: {scanResult.name}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Pesan Error / Izin Ditolak */}
            {errorMessage && !scanResult && (
              <div 
                style={{
                  position: 'absolute',
                  inset: '20px',
                  backgroundColor: 'rgba(38, 20, 20, 0.9)',
                  borderRadius: '16px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  zIndex: 15,
                }}
              >
                <AlertCircle size={36} color="#ef4444" style={{ marginBottom: '12px' }} />
                <p style={{ fontSize: '0.85rem', color: '#fca5a5', margin: '0 0 16px', lineHeight: 1.4 }}>
                  {errorMessage}
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    onClick={startScanner}
                    className="primary-button"
                    style={{ fontSize: '0.82rem', padding: '8px 16px' }}
                  >
                    Coba Lagi
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="secondary-button"
                    style={{ fontSize: '0.82rem', padding: '8px 16px' }}
                  >
                    Unggah dari Galeri
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Kontrol Cepat Pemindai (Torch, Switch Camera, Upload Gambar) */}
          <div 
            style={{
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            {/* Tombol Kamera Switch */}
            <button
              onClick={toggleCamera}
              className="scanner-control-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-secondary, #cbd5e1)',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
              title="Ganti Kamera Depan/Belakang"
            >
              <RotateCw size={15} />
              <span>{facingMode === 'environment' ? 'Kamera Belakang' : 'Kamera Depan'}</span>
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
              {/* Tombol Flash / Torch jika didukung */}
              {torchSupported && (
                <button
                  onClick={toggleTorch}
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: torchOn ? 'rgba(250, 204, 21, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    color: torchOn ? '#facc15' : 'var(--text-secondary, #cbd5e1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  title={torchOn ? 'Matikan Senter' : 'Nyalakan Senter'}
                >
                  {torchOn ? <Zap size={16} /> : <ZapOff size={16} />}
                </button>
              )}

              {/* Tombol Scan dari Gambar / Galeri */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingFile}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(74, 124, 89, 0.3)',
                  background: 'rgba(74, 124, 89, 0.15)',
                  color: 'var(--primary, #5a9e6f)',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: isProcessingFile ? 'wait' : 'pointer',
                }}
                title="Pilih gambar barcode dari galeri"
              >
                <Upload size={15} />
                <span>{isProcessingFile ? 'Memproses...' : 'Dari Galeri'}</span>
              </button>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* Footer Bantuan */}
          <div 
            style={{
              padding: '12px 20px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              textAlign: 'center',
              borderTop: '1px solid rgba(255, 255, 255, 0.04)',
            }}
          >
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #6b7280)' }}>
              Mendukung Barcode 1D (Code 128, EAN) & 2D QR Code perangkat ShroomSync
            </span>
          </div>
        </motion.div>

        {/* Global Keyframes Animation untuk Laser Scanner */}
        <style>{`
          @keyframes scanBeam {
            0% { top: 6%; opacity: 0.8; }
            50% { top: 92%; opacity: 1; }
            100% { top: 6%; opacity: 0.8; }
          }
          #${containerId} video {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            border-radius: 0 !important;
          }
          #${containerId} img {
            display: none !important;
          }
        `}</style>
      </div>
    </AnimatePresence>
  );
};

export default BarcodeScannerModal;

