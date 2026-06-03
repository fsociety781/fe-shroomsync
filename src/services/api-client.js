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
    switch (this.statusCode) {
      case 400:
        return 'Input tidak valid. Periksa kembali data yang dikirim.';
      case 404:
        return 'Data tidak ditemukan.';
      case 409:
        return 'Data sudah ada atau sedang konflik.';
      case 429:
        return this.retryAfter
          ? `Terlalu banyak permintaan. Coba lagi setelah ${new Date(this.retryAfter).toLocaleTimeString('id-ID')}.`
          : 'Terlalu banyak permintaan. Coba lagi sebentar.';
      case 500:
        return 'Server sedang bermasalah.';
      default:
        return this.message || 'Terjadi kesalahan jaringan.';
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
    return `${this.baseURL}${normalizedEndpoint}`;
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

    const response = await CapacitorHttp.request({
      url: this.buildURL(endpoint),
      method: options.method || 'GET',
      headers,
      data,
      responseType: 'json',
      connectTimeout: this.timeout,
      readTimeout: this.timeout,
    });

    const payload = response.status === 204
      ? null
      : this.parseNativePayload(response.data, response.headers);

    if (response.status < 200 || response.status >= 300) {
      const message = payload?.message || payload?.error || `Request failed with status ${response.status}`;
      throw new APIError(message, response.status, payload?.errors, null, payload);
    }

    return payload;
  }

  async fetchRequest(endpoint, options, headers) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), this.timeout);

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

  async request(endpoint, options = {}) {
    const headers = { ...this.defaultHeaders, ...options.headers };

    try {
      if (this.isNativeHttp()) {
        return await this.nativeRequest(endpoint, options, headers);
      }

      return await this.fetchRequest(endpoint, options, headers);
    } catch (error) {
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
