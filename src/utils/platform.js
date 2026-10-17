import { Capacitor } from '@capacitor/core';

/**
 * Checks if the application is running inside the Capacitor Native App
 * or was built for mobile mode (VITE_APP_ENV === 'mobile').
 */
export const isMobileApp = () => {
  return (
    import.meta.env.VITE_APP_ENV === 'mobile' ||
    Capacitor.isNativePlatform()
  );
};

/**
 * Checks if screen is mobile-sized (<= 768px) or running on native mobile.
 */
export const isMobileScreen = () => {
  if (typeof window === 'undefined') return false;
  return isMobileApp() || window.innerWidth <= 768;
};
