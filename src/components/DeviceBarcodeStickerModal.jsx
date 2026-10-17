import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { 
  X, 
  Copy, 
  Check, 
  Printer, 
  Download, 
  QrCode, 
  ScanLine, 
  ShieldCheck, 
  Layers,
  FileJson
} from 'lucide-react';
import './DeviceBarcodeStickerModal.css';

/**
 * DeviceBarcodeStickerModal
 * Real Production Barcode (Code 128) & 2D QR Code Generator
 * Kompatibel 100% dengan BarcodeScannerModal kamera ShroomSync & alat scanner fisik.
 */
export default function DeviceBarcodeStickerModal({ 
  isOpen, 
  onClose, 
  device, 
  onNotification 
}) {
  const [stickerMode, setStickerMode] = useState('full'); // 'full' | 'qr' | 'barcode'
  const [qrFormat, setQrFormat] = useState('json'); // 'json' | 'serial' | 'url'
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isGeneratingPng, setIsGeneratingPng] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);

  const barcodeSvgRef = useRef(null);
  const stickerRef = useRef(null);
  const canvasHiddenRef = useRef(null);

  const serialNumber = device?.serialNumber || device?.deviceId || device?.id || 'SS-UNKNOWN';
  const activationCode = device?.activationCode || 'ACT-8821-X';
  const deviceName = device?.name || 'SupaKu Smart Node';
  const hwVersion = device?.hardwareVersion || '2.0';
  const fwVersion = device?.firmwareVersion || '1.1.0';
  const macAddress = device?.deviceIdentity?.mac_address || device?.macAddress || '';
  const manufacturedAt = device?.deviceIdentity?.manufactured_at || (device?.createdAt ? new Date(device.createdAt).toISOString() : new Date().toISOString());

  const deviceIdentity = device?.deviceIdentity || {
    device_id: serialNumber,
    hardware_version: hwVersion,
    firmware_version: fwVersion,
    mac_address: macAddress,
    manufactured_at: manufacturedAt,
  };
  const productionDate = device?.createdAt 
    ? new Date(device.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })
    : new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });

  // Siapkan payload QR Code sesuai mode
  const getQrPayload = useCallback(() => {
    if (qrFormat === 'serial') {
      return serialNumber;
    }
    if (qrFormat === 'url') {
      return `https://shroomsync.id/activate?deviceId=${encodeURIComponent(serialNumber)}&code=${encodeURIComponent(activationCode)}`;
    }
    // Default: Standar JSON ShroomSync (terbaca otomatis oleh parser kamera)
    return JSON.stringify({
      deviceId: serialNumber,
      name: deviceName,
      activationCode: activationCode,
      hw: `v${hwVersion}`,
      fw: `v${fwVersion}`
    });
  }, [qrFormat, serialNumber, activationCode, deviceName, hwVersion, fwVersion]);

  // Generate Real Production QR Code
  useEffect(() => {
    if (!isOpen || !device) return undefined;

    let active = true;
    const generateQr = async () => {
      try {
        const payload = getQrPayload();
        const url = await QRCode.toDataURL(payload, {
          width: 320,
          margin: 1,
          color: {
            dark: '#111827',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'M',
        });
        if (active) {
          setQrDataUrl(url);
        }
      } catch (err) {
        console.error('Failed to generate real QR Code:', err);
      }
    };

    generateQr();
    return () => { active = false; };
  }, [isOpen, device, getQrPayload]);

  // Generate Real Production 1D Barcode (Code 128)
  useEffect(() => {
    if (!isOpen || !device || !barcodeSvgRef.current) return;

    try {
      JsBarcode(barcodeSvgRef.current, serialNumber, {
        format: 'CODE128',
        lineColor: '#111827',
        width: 2.1,
        height: 48,
        displayValue: true,
        font: 'monospace',
        fontSize: 13,
        fontOptions: 'bold',
        textMargin: 4,
        background: '#ffffff',
        margin: 4
      });
    } catch (err) {
      console.error('Failed to generate real 1D Barcode:', err);
    }
  }, [isOpen, device, serialNumber, stickerMode]);

    // Unduh File JSON Identitas ESP32
  const handleDownloadIdentityJson = () => {
    try {
      const blob = new Blob([JSON.stringify(deviceIdentity, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${serialNumber}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onNotification?.(`V File identitas ${serialNumber}.json berhasil diunduh untuk di-inject ke ESP32!`, 'success');
    } catch (err) {
      console.error('Failed to download identity JSON:', err);
      onNotification?.('Gagal mengunduh file JSON identitas.', 'error');
    }
  };

  // Salin JSON Identitas ESP32
  const handleCopyIdentityJson = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(JSON.stringify(deviceIdentity, null, 2));
      setJsonCopied(true);
      setTimeout(() => setJsonCopied(false), 2000);
      onNotification?.(`V JSON identitas ${serialNumber} disalin ke clipboard! Siap di-inject ke ESP32.`, 'success');
    }
  };

  // Salin Serial Number & Kode Aktivasi
  const handleCopy = () => {
    const textToCopy = `SERIAL: ${serialNumber}\nAKTIVASI: ${activationCode}\nMODEL: ${deviceName}\nFIRMWARE: v${fwVersion}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
      onNotification?.('✓ Data Serial Number & Kode Aktivasi disalin ke clipboard.', 'success');
    }
  };

  // Cetak Stiker Fisik (Khusus thermal label printer / printer standard)
  const handlePrint = () => {
    window.print();
  };

  // Unduh Stiker Sebagai Gambar PNG Resolusi Tinggi (300 DPI Ready)
  const handleDownloadPng = async () => {
    setIsGeneratingPng(true);
    try {
      const canvas = canvasHiddenRef.current || document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const width = 640;
      const height = stickerMode === 'full' ? 820 : 540;
      canvas.width = width;
      canvas.height = height;

      // Background Putih
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Border Stiker
      ctx.strokeStyle = '#245e3d';
      ctx.lineWidth = 6;
      ctx.strokeRect(16, 16, width - 32, height - 32);

      // Dashed inner border
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(28, 28, width - 56, height - 56);
      ctx.setLineDash([]);

      // Header Brand
      ctx.fillStyle = '#245e3d';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('SHROOMSYNC INDUSTRIAL IOT', 44, 68);

      ctx.fillStyle = '#111827';
      ctx.font = '900 28px sans-serif';
      ctx.fillText('SupaKu Smart Node', 44, 102);

      // QC Passed Badge
      ctx.fillStyle = '#ecfdf5';
      ctx.fillRect(width - 190, 48, 146, 36);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(width - 190, 48, 146, 36);

      ctx.fillStyle = '#047857';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('QC PASSED', width - 170, 72);

      // Divider Line
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(44, 122);
      ctx.lineTo(width - 44, 122);
      ctx.stroke();

      let currentY = 145;

      // Draw QR Code
      if ((stickerMode === 'full' || stickerMode === 'qr') && qrDataUrl) {
        const qrImg = new Image();
        qrImg.crossOrigin = 'anonymous';
        await new Promise((resolve) => {
          qrImg.onload = resolve;
          qrImg.src = qrDataUrl;
        });

        const qrSize = stickerMode === 'qr' ? 260 : 210;
        const qrX = (width - qrSize) / 2;
        ctx.drawImage(qrImg, qrX, currentY, qrSize, qrSize);
        currentY += qrSize + 15;
      }

      // Draw 1D Barcode
      if ((stickerMode === 'full' || stickerMode === 'barcode') && barcodeSvgRef.current) {
        const svgElement = barcodeSvgRef.current;
        const svgString = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const URL = window.URL || window.webkitURL || window;
        const blobURL = URL.createObjectURL(svgBlob);

        const barcodeImg = new Image();
        await new Promise((resolve) => {
          barcodeImg.onload = resolve;
          barcodeImg.src = blobURL;
        });

        const bcWidth = 420;
        const bcHeight = 70;
        const bcX = (width - bcWidth) / 2;
        ctx.drawImage(barcodeImg, bcX, currentY, bcWidth, bcHeight);
        currentY += bcHeight + 15;
        URL.revokeObjectURL(blobURL);
      }

      // Serial Number
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(serialNumber, width / 2, currentY + 18);
      currentY += 34;

      // Activation Code Box
      ctx.fillStyle = '#f0fdf4';
      ctx.fillRect(width / 2 - 160, currentY, 320, 36);
      ctx.strokeStyle = '#86efac';
      ctx.strokeRect(width / 2 - 160, currentY, 320, 36);

      ctx.fillStyle = '#065f46';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`KODE AKTIVASI: ${activationCode}`, width / 2, currentY + 24);
      currentY += 56;

      // Footer Specs & Date
      ctx.fillStyle = '#6b7280';
      ctx.font = '13px sans-serif';
      ctx.fillText(`HW: v${hwVersion} • FW: v${fwVersion} • Prod: ${productionDate}`, width / 2, currentY);
      ctx.font = 'italic 11px sans-serif';
      ctx.fillText('Pindai dengan kamera ShroomSync untuk aktivasi instan', width / 2, currentY + 20);

      // Download Trigger
      const downloadLink = document.createElement('a');
      downloadLink.download = `stiker_supaku_${serialNumber}.png`;
      downloadLink.href = canvas.toDataURL('image/png');
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      onNotification?.(`✓ Stiker fisik SupaKu (${serialNumber}) berhasil diunduh dalam format PNG.`, 'success');
    } catch (err) {
      console.error('Error generating sticker PNG:', err);
      onNotification?.('Gagal mengunduh gambar stiker. Silakan coba lagi.', 'error');
    } finally {
      setIsGeneratingPng(false);
    }
  };

  if (!isOpen || !device) {
    return null;
  }

  return (
    <div className="modal-overlay sticker-modal-overlay">
      <motion.div 
        className="modal-content sticker-modal-dialog"
        initial={{ opacity: 0, scale: 0.94 }} 
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header Modal */}
        <div className="sticker-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="sticker-icon-badge">
              <QrCode size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Stiker Fisik & Barcode Alat SupaKu</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Real production generator (Barcode Code 128 & QR Code 2D) siap cetak thermal/label.
              </p>
            </div>
          </div>
          <button 
            className="icon-button small-icon-button"
            onClick={onClose}
            aria-label="Tutup Modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar Pengaturan Stiker */}
        <div className="sticker-controls-bar">
          <div className="sticker-mode-tabs">
            <button 
              className={`sticker-tab-btn ${stickerMode === 'full' ? 'active' : ''}`}
              onClick={() => setStickerMode('full')}
            >
              <Layers size={14} />
              <span>Stiker Lengkap (QR + Barcode)</span>
            </button>
            <button 
              className={`sticker-tab-btn ${stickerMode === 'qr' ? 'active' : ''}`}
              onClick={() => setStickerMode('qr')}
            >
              <QrCode size={14} />
              <span>Hanya QR 2D</span>
            </button>
            <button 
              className={`sticker-tab-btn ${stickerMode === 'barcode' ? 'active' : ''}`}
              onClick={() => setStickerMode('barcode')}
            >
              <ScanLine size={14} />
              <span>Hanya Barcode 1D</span>
            </button>
            <button 
              className={`sticker-tab-btn ${stickerMode === 'identity' ? 'active' : ''}`}
              onClick={() => setStickerMode('identity')}
            >
              <FileJson size={14} />
              <span>JSON Identitas (ESP32)</span>
            </button>
          </div>

          {(stickerMode === 'full' || stickerMode === 'qr') && (
            <div className="sticker-format-selector">
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>Payload QR:</span>
              <select 
                value={qrFormat} 
                onChange={(e) => setQrFormat(e.target.value)}
                className="sticker-select"
              >
                <option value="json">JSON ShroomSync (Rekomendasi App)</option>
                <option value="serial">Serial Number Murni</option>
                <option value="url">URL Aktivasi Web Direct</option>
              </select>
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            AREA STIKER FISIK (SIAP DICETAK & EXPORT)
        ───────────────────────────────────────────────────────────── */}
        <div className="sticker-preview-wrapper">
          {stickerMode === 'identity' ? (
            <div style={{ padding: '20px', background: '#0f172a', borderRadius: '14px', border: '1px solid #1e293b', color: '#f8fafc', textAlign: 'left', fontFamily: 'Consolas, monospace', fontSize: '0.86rem', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>
                <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.84rem' }}>📄 {serialNumber}.json (ESP32 Identity)</span>
                <button
                  type="button"
                  onClick={handleCopyIdentityJson}
                  style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38bdf8', color: '#38bdf8', borderRadius: '6px', padding: '4px 10px', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  {jsonCopied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{jsonCopied ? 'Tersalin!' : 'Salin JSON'}</span>
                </button>
              </div>
              <pre style={{ margin: 0, overflowX: 'auto', lineHeight: '1.5', color: '#67e8f9', background: '#020617', padding: '14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                {JSON.stringify(deviceIdentity, null, 2)}
              </pre>
              <p style={{ marginTop: '14px', marginBottom: 0, fontSize: '0.76rem', color: '#94a3b8', lineHeight: '1.4' }}>
                💡 <strong>Injeksi ESP32:</strong> Simpan file ini ke filesystem internal ESP32 (LittleFS/SPIFFS/SD Card) sebagai identitas hardware mikrokontroler saat booting.
              </p>
            </div>
          ) : (
          <div 
            ref={stickerRef}
            className="supaku-physical-sticker supaku-sticker-print-area"
          >
            {/* Header Stiker */}
            <div className="sticker-header-band">
              <div className="sticker-brand">
                <span className="sticker-brand-sub">SHROOMSYNC INDUSTRIAL IOT</span>
                <span className="sticker-brand-title">SupaKu Smart Node</span>
              </div>
              <div className="sticker-qc-badge">
                <ShieldCheck size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
                <span>QC PASSED</span>
              </div>
            </div>

            {/* QR Code 2D Nyata */}
            {(stickerMode === 'full' || stickerMode === 'qr') && (
              <div className="sticker-qr-block">
                {qrDataUrl ? (
                  <img 
                    src={qrDataUrl} 
                    alt={`Real QR Code untuk ${serialNumber}`} 
                    className="sticker-qr-img" 
                  />
                ) : (
                  <div className="sticker-qr-placeholder">Membuat QR Code...</div>
                )}
              </div>
            )}

            {/* Barcode 1D (Code 128) Nyata */}
            {(stickerMode === 'full' || stickerMode === 'barcode') && (
              <div className="sticker-barcode-block">
                <svg ref={barcodeSvgRef} className="sticker-barcode-svg"></svg>
              </div>
            )}

            {/* Serial Number & Aktivasi */}
            <div className="sticker-meta-block">
              <div className="sticker-serial-text">{serialNumber}</div>
              <div className="sticker-activation-chip">
                <span>KODE AKTIVASI:</span>
                <strong>{activationCode}</strong>
              </div>
            </div>

            {/* Footer Stiker */}
            <div className="sticker-footer-band">
              <div className="sticker-specs">
                <span>HW: v{hwVersion}</span> • <span>FW: v{fwVersion}</span> • <span>Batch: {productionDate}</span>
              </div>
              <div className="sticker-guide-text">
                Pindai dengan kamera aplikasi ShroomSync untuk aktivasi instan
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Canvas Tersembunyi untuk Ekspor PNG 300 DPI */}
        <canvas ref={canvasHiddenRef} style={{ display: 'none' }} />

        {/* Modal Actions */}
        <div className="sticker-modal-actions">
          <button 
            type="button" 
            className="secondary-button"
            onClick={handleDownloadIdentityJson}
            style={{ background: 'rgba(36, 94, 61, 0.12)', borderColor: 'var(--primary)', color: 'var(--primary)', fontWeight: 600 }}
            title="Unduh file JSON identitas untuk di-inject ke ESP32"
          >
            <FileJson size={16} />
            <span>Unduh {serialNumber}.json</span>
          </button>
          <button 
            type="button" 
            className="secondary-button"
            onClick={handleCopy}
            title="Salin Serial Number dan Kode Aktivasi"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'Tersalin!' : 'Salin Serial & Kode'}</span>
          </button>

          <button 
            type="button" 
            className="secondary-button"
            onClick={handleDownloadPng}
            disabled={isGeneratingPng}
            title="Unduh stiker dalam format gambar PNG resolusi tinggi"
          >
            <Download size={16} />
            <span>{isGeneratingPng ? 'Memproses...' : 'Unduh PNG HD'}</span>
          </button>

          <button 
            type="button" 
            className="primary-button"
            onClick={handlePrint}
            title="Cetak langsung ke printer label atau printer dokumen"
          >
            <Printer size={16} />
            <span>Cetak Stiker</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
