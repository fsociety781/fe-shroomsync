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
    };
  }

  buildURL(endpoint) {
    if (/^https?:\/\//i.test(endpoint)) return endpoint;
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.baseURL}${normalizedEndpoint}`;
  }

  async request(endpoint, options = {}) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), this.timeout);
    const headers = { ...this.defaultHeaders, ...options.headers };

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
