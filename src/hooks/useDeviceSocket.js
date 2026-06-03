import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import config from '../config';

const MAX_RECONNECT_ATTEMPTS = 5;

const withDeviceId = (payload, deviceId) => {
  if (!deviceId) return payload;

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { deviceId, data: payload };
  }

  if (payload.deviceId || payload.device_id) return payload;
  return { ...payload, deviceId };
};

const createPayload = (args, fallbackDeviceId) => {
  if (args.length >= 2 && typeof args[0] === 'string') {
    return { deviceId: fallbackDeviceId || args[0], data: args[1] };
  }

  return withDeviceId(args[0], fallbackDeviceId);
};

/**
 * Custom hook to manage Socket.IO connection for device status updates.
 * Handles connection, reconnection, and error states.
 *
 * @param {Object} options - Configuration options
 * @param {Function} options.onDeviceOnline - Callback when device comes online
 * @param {Function} options.onDeviceOffline - Callback when device goes offline
 * @param {Function} options.onDeviceStatus - Callback when device status changes
 * @param {Function} options.onSensorTelemetry - Callback when sensor telemetry arrives
 * @param {Function} options.onHistoryTelemetry - Callback when history/actuator telemetry arrives
 * @param {Function} options.onConnectionChange - Callback for connection status changes
 * @param {Function} options.onError - Callback for errors
 * @returns {Object} Socket instance and utility methods
 */
export function useDeviceSocket({
  enabled = true,
  onDeviceOnline,
  onDeviceOffline,
  onDeviceStatus,
  onSensorTelemetry,
  onHistoryTelemetry,
  onConnectionChange,
  onError,
} = {}) {
  const socketRef = useRef(null);
  const handlersRef = useRef({});
  const reconnectAttemptRef = useRef(0);

  useEffect(() => {
    handlersRef.current = {
      onDeviceOnline,
      onDeviceOffline,
      onDeviceStatus,
      onSensorTelemetry,
      onHistoryTelemetry,
      onConnectionChange,
      onError,
    };
  }, [
    onDeviceOnline,
    onDeviceOffline,
    onDeviceStatus,
    onSensorTelemetry,
    onHistoryTelemetry,
    onConnectionChange,
    onError,
  ]);

  /**
   * Initialize Socket.IO connection
   */
  const connect = useCallback(() => {
    if (!enabled) return;

    if (socketRef.current) {
      if (!socketRef.current.connected) {
        socketRef.current.connect();
      }
      return;
    }

    try {
      console.log('[Socket.IO] Connecting to', config.wsURL || 'localhost');

      const socket = io(config.wsURL || window.location.origin, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
        transports: ['websocket', 'polling'],
      });

      const notify = (handlerName, payload) => {
        handlersRef.current[handlerName]?.(payload);
      };

      const routeRealtimeEvent = (eventName, ...args) => {
        if (eventName === 'telemetry:sensor') {
          notify('onSensorTelemetry', createPayload(args));
          return;
        }

        if (eventName === 'telemetry:history') {
          notify('onHistoryTelemetry', createPayload(args));
          return;
        }

        if (eventName === 'device:status') {
          notify('onDeviceStatus', createPayload(args));
          return;
        }

        if (eventName === 'state:actuator' || eventName === 'actuator:state') {
          notify('onHistoryTelemetry', createPayload(args));
          return;
        }

        const deviceEvent = /^device:([^:]+):(.+)$/.exec(eventName);
        if (!deviceEvent) return;

        const [, deviceId, channel] = deviceEvent;
        const payload = createPayload(args, deviceId);

        if (channel === 'telemetry' || channel === 'sensor') {
          notify('onSensorTelemetry', payload);
        } else if (channel === 'history' || channel.includes('actuator')) {
          notify('onHistoryTelemetry', payload);
        } else if (channel === 'status' || channel === 'state') {
          notify('onDeviceStatus', payload);
        }
      };

      // ── Connection Events ──────────────────────────
      socket.on('connect', () => {
        console.log('[Socket.IO] Connected:', socket.id);
        reconnectAttemptRef.current = 0;
        notify('onConnectionChange', 'connected');
      });

      socket.on('disconnect', () => {
        console.log('[Socket.IO] Disconnected');
        notify('onConnectionChange', 'disconnected');
      });

      socket.on('reconnect_attempt', () => {
        reconnectAttemptRef.current += 1;
        console.log(
          `[Socket.IO] Reconnecting... (attempt ${reconnectAttemptRef.current}/${MAX_RECONNECT_ATTEMPTS})`
        );
        notify('onConnectionChange', 'reconnecting');
      });

      socket.on('connect_error', (error) => {
        console.error('[Socket.IO] Connection error:', error.message);
        notify('onError', {
          type: 'connection_error',
          message: error.message,
          attempt: reconnectAttemptRef.current,
        });
      });

      // ── Device Status Events ────────────────────────
      socket.on('device:online', ({ deviceId }) => {
        console.log(`[Socket.IO] Device ${deviceId} came online`);
        notify('onDeviceOnline', { deviceId, isOnline: true });
      });

      socket.on('device:offline', ({ deviceId }) => {
        console.log(`[Socket.IO] Device ${deviceId} went offline`);
        notify('onDeviceOffline', { deviceId, isOnline: false });
      });

      socket.onAny(routeRealtimeEvent);

      socketRef.current = socket;
    } catch (error) {
      console.error('[Socket.IO] Failed to connect:', error.message);
      handlersRef.current.onError?.({
        type: 'initialization_error',
        message: error.message,
      });
    }
  }, [enabled]);

  /**
   * Disconnect Socket.IO
   */
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      console.log('[Socket.IO] Disconnected');
    }
  }, []);

  /**
   * Join a device room to listen for its updates
   */
  const joinDevice = useCallback((deviceId) => {
    if (!socketRef.current?.connected) {
      console.warn('[Socket.IO] Not connected, cannot join device room');
      return;
    }
    socketRef.current.emit('join:device', deviceId);
    console.log(`[Socket.IO] Joined room device:${deviceId}`);
  }, []);

  /**
   * Leave a device room
   */
  const leaveDevice = useCallback((deviceId) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('leave:device', deviceId);
    console.log(`[Socket.IO] Left room device:${deviceId}`);
  }, []);

  /**
   * Get connection status
   */
  const isConnected = useCallback(() => socketRef.current?.connected ?? false, []);

  /**
   * Auto-connect on mount, disconnect on unmount
   */
  useEffect(() => {
    if (!enabled) {
      disconnect();
      return undefined;
    }

    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect, enabled]);

  return {
    connect,
    disconnect,
    joinDevice,
    leaveDevice,
    isConnected,
  };
}

export default useDeviceSocket;
