import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  Trash2, 
  AlertCircle, 
  Info, 
  CheckCircle2, 
  X, 
  Loader2 
} from 'lucide-react';
import './ConfirmModal.css';

/**
 * ConfirmModal Component
 * Accessible, elegant confirmation dialog adhering to UI/UX Pro Max guidelines.
 * Replaces browser's native window.confirm with a biophilic/tech aesthetic.
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Konfirmasi Tindakan',
  message,
  itemDetails, // { label: 'Unit', value: 'SS-0426-834', subValue?: 'Status: READY' }
  type = 'danger', // 'danger' | 'warning' | 'info' | 'success'
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  loading = false,
  dangerNote = 'Tindakan ini permanen dan tidak dapat dibatalkan.',
}) {
  const cancelBtnRef = useRef(null);

  // Auto-focus on Cancel button when modal opens (UX best practice for destructive actions)
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle ESC key to dismiss
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  // Icon mapping based on type
  const renderIcon = () => {
    switch (type) {
      case 'danger':
        return <Trash2 size={24} strokeWidth={2.2} />;
      case 'warning':
        return <AlertTriangle size={24} strokeWidth={2.2} />;
      case 'info':
        return <Info size={24} strokeWidth={2.2} />;
      case 'success':
        return <CheckCircle2 size={24} strokeWidth={2.2} />;
      default:
        return <AlertCircle size={24} strokeWidth={2.2} />;
    }
  };

  return (
    <AnimatePresence>
      <div 
        className="confirm-modal-overlay" 
        onClick={(e) => {
          if (e.target === e.currentTarget && !loading) {
            onClose();
          }
        }}
        role="presentation"
      >
        <motion.div
          className="confirm-modal-container"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          aria-describedby="confirm-modal-description"
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Mobile bottom-sheet drag handle */}
          <div className="confirm-modal-handle-bar" aria-hidden="true" />

          {/* Ambient accent strip at top */}
          <div className={`confirm-modal-accent-strip type-${type}`} />

          {/* Close button */}
          <button
            type="button"
            className="confirm-modal-close-btn"
            onClick={onClose}
            disabled={loading}
            aria-label="Tutup dialog konfirmasi"
          >
            <X size={18} />
          </button>

          <div className="confirm-modal-body">
            {/* Header row with icon & title */}
            <div className="confirm-modal-header-row">
              <div className={`confirm-modal-icon-wrapper type-${type}`}>
                {renderIcon()}
              </div>

              <div className="confirm-modal-title-block">
                <h3 id="confirm-modal-title" className="confirm-modal-title">
                  {title}
                </h3>
                <p id="confirm-modal-description" className="confirm-modal-description">
                  {message}
                </p>
              </div>
            </div>

            {/* Target Item Highlight Box (if itemDetails provided) */}
            {itemDetails && (
              <div className="confirm-modal-target-box">
                <div className="confirm-modal-target-info">
                  {itemDetails.label && (
                    <span className="confirm-modal-target-label">{itemDetails.label}</span>
                  )}
                  <span className="confirm-modal-target-value">
                    {itemDetails.value}
                  </span>
                </div>
                {itemDetails.subValue && (
                  <span className="confirm-modal-target-badge">
                    {itemDetails.subValue}
                  </span>
                )}
              </div>
            )}

            {/* Danger / Warning callout notice */}
            {dangerNote && (
              <div className={`confirm-modal-callout type-${type}`}>
                <AlertTriangle size={16} className="confirm-modal-callout-icon" />
                <span>{dangerNote}</span>
              </div>
            )}
          </div>

          {/* Action buttons footer */}
          <div className="confirm-modal-footer">
            <button
              ref={cancelBtnRef}
              type="button"
              className="confirm-btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              {cancelText}
            </button>

            <button
              type="button"
              className={`confirm-btn-action type-${type}`}
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="confirm-modal-spinner" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  {type === 'danger' && <Trash2 size={16} />}
                  <span>{confirmText}</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
