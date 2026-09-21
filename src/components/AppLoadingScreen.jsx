import { useEffect, useState } from 'react';

const DISPLAY_DURATION_MS = 5000;
const EXIT_DURATION_MS = 450;

export default function AppLoadingScreen({ enabled = false }) {
  const [isVisible, setIsVisible] = useState(enabled);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;

    const exitTimer = window.setTimeout(() => {
      setIsExiting(true);
    }, DISPLAY_DURATION_MS);
    const removeTimer = window.setTimeout(() => {
      setIsVisible(false);
    }, DISPLAY_DURATION_MS + EXIT_DURATION_MS);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(removeTimer);
    };
  }, [enabled]);

  if (!isVisible) return null;

  return (
    <div
      className={`app-loading-screen${isExiting ? ' is-exiting' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="ShroomSync sedang dimuat"
    >
      <div className="app-loading-screen__glow app-loading-screen__glow--top" />
      <div className="app-loading-screen__glow app-loading-screen__glow--bottom" />

      <div className="app-loading-screen__content">
        <div className="app-loading-screen__brand">
          <span className="app-loading-screen__orbit" aria-hidden="true" />
          <span className="app-loading-screen__logo-frame">
            <img src="/logo.png" alt="" className="app-loading-screen__logo" />
          </span>
          <span className="app-loading-screen__pulse" aria-hidden="true" />
        </div>

        <div className="app-loading-screen__copy">
          <p className="app-loading-screen__eyebrow">Smart Mushroom Farm</p>
          <h1>ShroomSync</h1>
          <p>Menyiapkan kumbung pintar Anda</p>
        </div>

        <div className="app-loading-screen__progress" aria-hidden="true">
          <span />
        </div>
      </div>

      <p className="app-loading-screen__footer">Monitoring terhubung. Budidaya terkendali.</p>
    </div>
  );
}
