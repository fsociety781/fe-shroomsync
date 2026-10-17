import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import apiClient from './api-client';

class PushNotificationService {
  privateRegistered = false;

  async init(onNotificationReceived) {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    if (this.privateRegistered) {
      return;
    }

    try {
      // 1. Request notification permissions from Android
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('[PushNotification] Izin notifikasi tidak diberikan oleh pengguna');
        return;
      }

      // 2. Register with Apple / Google APNs / FCM
      await PushNotifications.register();
      this.privateRegistered = true;

      // 3. Listen to registration event to obtain device FCM token
      await PushNotifications.addListener('registration', async (token) => {
        console.log('[PushNotification] FCM Token didapat:', token.value?.substring(0, 15) + '...');
        try {
          // Send device token to backend
          await apiClient.post('/auth/fcm-token', {
            fcmToken: token.value,
            platform: Capacitor.getPlatform(),
          });
          console.log('[PushNotification] FCM Token berhasil didaftarkan ke server');
        } catch (err) {
          console.error('[PushNotification] Gagal mendaftarkan token ke server:', err);
        }
      });

      // 4. Listen to registration errors
      await PushNotifications.addListener('registrationError', (error) => {
        console.error('[PushNotification] Registrasi gagal:', error);
      });

      // 5. Listen to foreground notifications
      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[PushNotification] Notifikasi diterima (foreground):', notification);
        if (typeof onNotificationReceived === 'function') {
          onNotificationReceived({
            title: notification.title || 'Peringatan ShroomSync',
            body: notification.body || '',
            data: notification.data || {},
          });
        }
      });

      // 6. Listen to notification action performed (user tapped notification)
      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[PushNotification] Notifikasi diklik:', action);
      });
    } catch (err) {
      console.error('[PushNotification] Error inisialisasi push notification:', err);
    }
  }
}

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
