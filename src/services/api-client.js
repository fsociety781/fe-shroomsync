import { Capacitor, CapacitorHttp } from '@capacitor/core';
import config from '../config';

export class APIError extends Error {
  constructor(message, statusCode = 0, errors = null, originalError = null, payload = null) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.originalError = originalError;
    this.payload = payload;
    this.retryAfter = payload?.retryAfter || null;
  }

  getUserMessage() {
    const specificMessage = this.payload?.message || this.message;
    switch (this.statusCode) {
      case 400:
        return specificMessage || 'Input tidak valid. Periksa kembali data yang dikirim.';
      case 401:
        return specificMessage || 'Sesi login tidak valid atau telah berakhir. Silakan login kembali.';
      case 403:
        return specificMessage || 'Akses ditolak. Anda tidak memiliki izin untuk tindakan ini.';
      case 404:
        return specificMessage || 'Data atau perangkat tidak ditemukan.';
      case 409:
        return specificMessage || 'Data sudah ada atau sedang konflik.';
      case 429:
        return this.retryAfter
          ? `Terlalu banyak permintaan. Coba lagi setelah ${new Date(this.retryAfter).toLocaleTimeString('id-ID')}.`
          : (specificMessage || 'Terlalu banyak permintaan. Coba lagi sebentar.');
      case 500:
        return specificMessage || 'Server sedang bermasalah. Silakan coba beberapa saat lagi.';
      default:
        return specificMessage || 'Terjadi kesalahan jaringan.';
    }
  }

  getFormErrors() {
    if (!Array.isArray(this.errors)) return {};

    return this.errors.reduce((acc, err) => {
      if (err?.field) acc[err.field] = err.message;
      return acc;
    }, {});
  }
}

const getStoredAuthToken = () => {
  try {
    return localStorage.getItem('shroomsync_token') || null;
  } catch {
    return null;
  }
};

const notifyUnauthorized = () => {
  try {
    localStorage.removeItem('shroomsync_token');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('shroomsync:unauthorized'));
    }
  } catch {
    // Ignore storage/event dispatch errors
  }
};

const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class APIClient {
  constructor(baseURL = config.baseURL, options = {}) {
    this.baseURL = baseURL.replace(/\/$/, '');
    this.timeout = options.timeout ?? config.timeout;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...(config.skipTunnelWarning ? { 'X-Tunnel-Skip-AntiPhishing-Page': 'true' } : {}),
    };
  }

  buildURL(endpoint) {
    if (/^https?:\/\//i.test(endpoint)) return endpoint;
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    let base = this.baseURL;
    if (this.isNativeHttp() && (!base || !/^https?:\/\//i.test(base))) {
      base = 'https://api.shroomsync.web.id/api/v1';
    }
    return `${base}${normalizedEndpoint}`;
  }

  isNativeHttp() {
    return Capacitor.isNativePlatform();
  }

  parseNativePayload(data, headers = {}) {
    if (typeof data !== 'string') return data;

    const contentType = Object.entries(headers).find(([key]) => key.toLowerCase() === 'content-type')?.[1] || '';
    if (!String(contentType).toLowerCase().includes('application/json')) return data;

    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  async nativeRequest(endpoint, options, headers) {
    let data = options.body;
    if (data instanceof FormData) {
      throw new APIError('FormData belum didukung untuk request native.', 0);
    }

    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        // Keep non-JSON string payloads as-is.
      }
    }

    const requestTimeout = options.timeout ?? this.timeout;
    const response = await CapacitorHttp.request({
      url: this.buildURL(endpoint),
      method: options.method || 'GET',
      headers,
      data,
      responseType: 'json',
      connectTimeout: requestTimeout,
      readTimeout: requestTimeout,
    });

    const payload = response.status === 204
      ? null
      : this.parseNativePayload(response.data, response.headers);

    if (response.status === 401 && !endpoint.includes('/auth/login')) {
      notifyUnauthorized();
    }

    if (response.status < 200 || response.status >= 300) {
      const message = payload?.message || payload?.error || `Request failed with status ${response.status}`;
      throw new APIError(message, response.status, payload?.errors, null, payload);
    }

    return payload;
  }

  async fetchRequest(endpoint, options, headers) {
    const requestTimeout = options.timeout ?? this.timeout;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), requestTimeout);

    let body = options.body;
    if (body && !(body instanceof FormData) && typeof body !== 'string') {
      body = JSON.stringify(body);
    }

    try {
      const response = await fetch(this.buildURL(endpoint), {
        ...options,
        body,
        headers,
        signal: options.signal || controller.signal,
      });

      const contentType = response.headers.get('content-type') || '';
      const payload = response.status === 204
        ? null
        : contentType.includes('application/json')
          ? await response.json().catch(() => ({}))
          : await response.text();

      if (response.status === 401 && !endpoint.includes('/auth/login')) {
        notifyUnauthorized();
      }

      if (!response.ok) {
        const message = payload?.message || payload?.error || `Request failed with status ${response.status}`;
        throw new APIError(message, response.status, payload?.errors, null, payload);
      }

      return payload;
    } catch (error) {
      if (error instanceof APIError) throw error;

      const message = error.name === 'AbortError'
        ? 'Request timeout'
        : 'Network error';
      throw new APIError(message, 0, null, error);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async executeRequest(endpoint, options, headers) {
    if (this.isNativeHttp() && !(options.body instanceof FormData)) {
      return await this.nativeRequest(endpoint, options, headers);
    }
    return await this.fetchRequest(endpoint, options, headers);
  }

  async request(endpoint, options = {}, retries = 0) {
    const authToken = getStoredAuthToken();
    const authHeaders = authToken && !options.headers?.Authorization
      ? { Authorization: `Bearer ${authToken}` }
      : {};

    const headers = {
      ...this.defaultHeaders,
      ...authHeaders,
      ...options.headers,
    };

    // If sending FormData (multipart/form-data), let the browser/fetch client
    // automatically generate the multipart boundary. Explicit 'application/json'
    // will cause the backend Express JSON parser to throw INVALID_JSON syntax error.
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
      delete headers['content-type'];
    }

    try {
      return await this.executeRequest(endpoint, options, headers);
    } catch (error) {
      // Exponential backoff retry for 429 Too Many Requests (max 2 retries)
      if (error instanceof APIError && error.statusCode === 429 && retries < 2) {
        const delay = (retries + 1) * 1000;
        await waitMs(delay);
        return this.request(endpoint, options, retries + 1);
      }

      if (error instanceof APIError) throw error;

      throw new APIError(error.message || 'Network error', 0, null, error);
    }
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  patch(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

export default new APIClient();
export { APIClient };
