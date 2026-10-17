import React from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ShroomSync ErrorBoundary] Uncaught runtime exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetState = () => {
    try {
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div 
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0f1712',
            color: '#f4fbf5',
            fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
            padding: '24px',
            boxSizing: 'border-box'
          }}
        >
          <div 
            style={{
              maxWidth: '520px',
              width: '100%',
              backgroundColor: '#18241d',
              border: '1px solid rgba(82, 163, 107, 0.25)',
              borderRadius: '20px',
              padding: '36px 32px',
              textAlign: 'center',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div 
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px auto',
                border: '1px solid rgba(239, 68, 68, 0.3)'
              }}
            >
              <ShieldAlert size={32} />
            </div>

            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 10px 0', letterSpacing: '-0.3px' }}>
              Terjadi Kendala Teknis pada Sesi
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#9cb1a2', lineHeight: '1.6', margin: '0 0 24px 0' }}>
              Aplikasi mendeteksi gangguan saat memproses antarmuka. Data telemetri SupaKu tetap aman di cloud. Silakan muat ulang halaman untuk melanjutkan.
            </p>

            {this.state.error && (
              <div 
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '12px',
                  textAlign: 'left',
                  fontSize: '0.78rem',
                  color: '#f87171',
                  fontFamily: 'monospace',
                  marginBottom: '24px',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  wordBreak: 'break-all'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontWeight: 600 }}>
                  <AlertTriangle size={14} />
                  <span>Detail Pengecualian:</span>
                </div>
                {this.state.error.toString()}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  backgroundColor: '#447253',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 22px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.2s',
                  boxShadow: '0 4px 12px rgba(68, 114, 83, 0.3)'
                }}
              >
                <RefreshCw size={16} />
                <span>Muat Ulang Halaman</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetState}
                style={{
                  backgroundColor: 'transparent',
                  color: '#9cb1a2',
                  border: '1px solid rgba(156, 177, 162, 0.3)',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Home size={16} />
                <span>Kembali ke Beranda</span>
              </button>
            </div>

            <div style={{ marginTop: '28px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px', fontSize: '0.75rem', color: '#688270' }}>
              ShroomSync Enterprise Cloud Platform • v2.4.0 (Production)
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

