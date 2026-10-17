import { io } from 'socket.io-client';
import config from '../config';

class SocketService {
  constructor(wsURL = config.wsURL) {
    this.wsURL = wsURL;
    this.socket = null;
    this.listeners = new Map();

    if (config.enableSocket) {
      this.init();
    }
  }

  init() {
    if (this.socket) return this.socket;

    try {
      this.socket = io(this.wsURL, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        transports: ['websocket', 'polling'],
        autoConnect: true,
      });

      this.socket.on('error', (error) => {
        console.warn('[SocketService] Socket error:', error);
      });

      this.socket.on('connect_error', (error) => {
        console.warn('[SocketService] Connect error:', error.message);
      });
    } catch (err) {
      console.warn('[SocketService] Init error:', err);
    }

    return this.socket;
  }

  ensureSocket() {
    if (!this.socket) {
      this.init();
    }
    return this.socket;
  }

  // Subscribe to device telemetry
  onDeviceTelemetry(deviceId, callback) {
    const s = this.ensureSocket();
    if (!s) return;
    s.on(`device:${deviceId}:telemetry`, callback);
  }

  // Subscribe to device status changes
  onDeviceStatus(deviceId, callback) {
    const s = this.ensureSocket();
    if (!s) return;
    s.on(`device:${deviceId}:status`, callback);
  }

  // Unsubscribe telemetry
  offDeviceTelemetry(deviceId, callback) {
    if (!this.socket) return;
    if (callback) {
      this.socket.off(`device:${deviceId}:telemetry`, callback);
    } else {
      this.socket.off(`device:${deviceId}:telemetry`);
    }
  }

  // Unsubscribe status
  offDeviceStatus(deviceId, callback) {
    if (!this.socket) return;
    if (callback) {
      this.socket.off(`device:${deviceId}:status`, callback);
    } else {
      this.socket.off(`device:${deviceId}:status`);
    }
  }

  // Generic event listener
  on(event, callback) {
    const s = this.ensureSocket();
    if (s) s.on(event, callback);
  }

  // Generic remove listener
  off(event, callback) {
    if (this.socket) {
      if (callback) this.socket.off(event, callback);
      else this.socket.off(event);
    }
  }

  // Generic emit
  emit(event, ...args) {
    const s = this.ensureSocket();
    if (s) s.emit(event, ...args);
  }

  connect() {
    const s = this.ensureSocket();
    if (s && !s.connected) {
      s.connect();
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  get isConnected() {
    return Boolean(this.socket?.connected);
  }
}

const socketServiceInstance = new SocketService();
export default socketServiceInstance;
export { SocketService };

