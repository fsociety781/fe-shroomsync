# 🌐 ShroomSync — Frontend Integration Guide
# 🌐 Panduan Resmi Integrasi Frontend ShroomSync (Production Contract)

Panduan lengkap untuk Frontend Developer yang mengintegrasikan ShroomSync API ke aplikasi web/mobile mereka.
Dokumen ini adalah **kontrak dan panduan teknis integrasi resmi** ShroomSync Backend API Service v2.0.0 untuk tim pengembang antarmuka (Web Dashboard & Mobile App). 

---
Dokumen ini memuat alur kerja nyata, skema data presisi, aturan otorisasi, dan parameter integrasi untuk seluruh 3 peran: **TEKNISI**, **ADMINISTRATOR**, dan **PETANI**.

## 📋 Quick Navigation

1. [Setup & Configuration](#setup-configuration)
2. [API Client Setup](#api-client-setup)
3. [Common Patterns](#common-patterns)
4. [Error Handling](#error-handling)
5. [Real-time Updates](#real-time-updates)
6. [Rate Limit Handling](#rate-limit-handling)
7. [Complete Examples](#complete-examples)

---

## Setup & Configuration
## 📌 Standar Komunikasi & Arsitektur

### Base URL & Environment
### 1. Base URL
- **Local Development**: `http://localhost:3000/api/v1`
- **Swagger UI Interactive**: `http://localhost:3000/api/docs`

```javascript
// config.js
const API_CONFIG = {
  development: {
    baseURL: 'http://localhost:3000/api/v1',
    wsURL: 'http://localhost:3000',
  },
  staging: {
    baseURL: 'https://api-staging.shroomsync.com/api/v1',
    wsURL: 'https://api-staging.shroomsync.com',
  },
  production: {
    baseURL: 'https://api.shroomsync.com/api/v1',
    wsURL: 'https://api.shroomsync.com',
  },
};

const config = API_CONFIG[process.env.REACT_APP_ENV || 'development'];
export default config;
### 2. Standar Headers
Setiap request wajib menyertakan:
```http
Content-Type: application/json
Accept: application/json
```

### Initialize API Client

#### Using Fetch API (vanilla JavaScript)
```javascript
// api-client.js
class APIClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...this.defaultHeaders, ...options.headers },
      });

      const data = await response.json();

      // Handle non-2xx responses
      if (!response.ok) {
        throw new APIError(data.message, response.status, data.errors);
      }

      return data;
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError('Network error', 0, null, error);
    }
  }

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

class APIError extends Error {
  constructor(message, statusCode, errors, originalError) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.originalError = originalError;
  }
}

export default APIClient;
Untuk endpoint terproteksi, wajib menyertakan token JWT:
```http
Authorization: Bearer <jwt_token>
```

#### Using Axios
```javascript
// api-client.js
import axios from 'axios';
### 3. Struktur Amplop Respon (Response Envelope)

const apiClient = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  response => response.data, // Return only data
  error => {
    const { response } = error;
    if (response) {
      // API error response
      return Promise.reject({
        message: response.data.message,
        status: response.status,
        errors: response.data.errors,
      });
    }
    // Network error
    return Promise.reject(error);
#### A. Respon Berhasil (HTTP 200 / 201)
```json
{
  "status": "success",
  "message": "Deskripsi hasil operasi",
  "data": { ... },
  "pagination": {
    "total": 50,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
);

export default apiClient;
```

---

## API Client Setup

### Service Layer Pattern (Recommended)

```javascript
// services/DeviceService.js
import apiClient from '../api-client';

class DeviceService {
  // Get all devices
  async getAllDevices(limit = 50, offset = 0) {
    return apiClient.get(`/devices?limit=${limit}&offset=${offset}`);
  }

  // Get single device
  async getDevice(deviceId) {
    return apiClient.get(`/devices/${deviceId}`);
  }

  // Register new device
  async createDevice(name, hardwareVersion = '1.0') {
    return apiClient.post('/devices', {
      deviceId: name, // Usually same as name for registration
      name,
      hardwareVersion,
    });
  }

  // Update device control mode
  async updateControlMode(deviceId, mode) {
    return apiClient.post(`/devices/${deviceId}/control/mode`, { mode });
  }

  // Set temperature/humidity setpoints
  async updateSetpoint(deviceId, setpoints) {
    return apiClient.post(`/devices/${deviceId}/setpoint`, setpoints);
  }

  // Update spray timer
  async updateTimer(deviceId, minute, second) {
    return apiClient.post(`/devices/${deviceId}/timer`, { minute, second });
  }

  // Update floor pump timer
  async updateFloorTimer(deviceId, minute, second) {
    return apiClient.post(`/devices/${deviceId}/timer/floor`, { minute, second });
  }

  // Update daily schedule
  async updateSchedule(deviceId, schedule, floorSchedule) {
    return apiClient.post(`/devices/${deviceId}/schedule/update`, {
      schedule,
      floorSchedule,
    });
  }

  // Control pump
  async controlPump(deviceId, on) {
    return apiClient.post(`/devices/${deviceId}/actuator/pump`, { on });
  }

  // Delete device
  async deleteDevice(deviceId) {
    return apiClient.delete(`/devices/${deviceId}`);
  }
}

export default new DeviceService();
```
*(Properti `pagination` bersifat kondisional, hanya hadir pada endpoint berhalaman).*

```javascript
// services/TelemetryService.js
import apiClient from '../api-client';

class TelemetryService {
  // Get sensor history
  async getSensorData(deviceId, limit = 100, offset = 0) {
    return apiClient.get(
      `/devices/${deviceId}/telemetry/sensor?limit=${limit}&offset=${offset}`
    );
  }

  // Get latest sensor reading
  async getLatestSensor(deviceId) {
    return apiClient.get(`/devices/${deviceId}/telemetry/sensor/latest`);
  }

  // Get system history
  async getHistory(deviceId, limit = 50, offset = 0) {
    return apiClient.get(
      `/devices/${deviceId}/telemetry/history?limit=${limit}&offset=${offset}`
    );
  }

  // Get latest system action
  async getLatestHistory(deviceId) {
    return apiClient.get(`/devices/${deviceId}/telemetry/history/latest`);
  }
#### B. Respon Gagal (HTTP 4xx / 5xx)
```json
{
  "status": "error",
  "message": "Pesan deskripsi kegagalan",
  "code": "KODE_ERROR_UNIK",
  "errors": [ ... ],
  "timestamp": "2026-10-12T16:00:00.000Z"
}

export default new TelemetryService();
```

```javascript
// services/OTAService.js
import apiClient from '../api-client';

class OTAService {
  // Trigger update for single device
  async triggerUpdate(deviceId, firmwareUrl, version, changelog = '') {
    return apiClient.post(`/ota/trigger/${deviceId}`, {
      firmwareUrl,
      firmwareVersion: version,
      changelog,
    });
  }

  // Broadcast update to all devices
  async broadcastUpdate(firmwareUrl, version) {
    return apiClient.post('/ota/broadcast', {
      firmwareUrl,
      firmwareVersion: version,
    });
  }

  // Get OTA update logs
  async getUpdateLogs(deviceId, limit = 20, offset = 0) {
    return apiClient.get(
      `/ota/logs/${deviceId}?limit=${limit}&offset=${offset}`
    );
  }
}

export default new OTAService();
```

---

## Common Patterns
## 🔐 MODUL 1: AUTENTIKASI GLOBAL & ONBOARDING

### React Hooks Pattern
### 1. Login Akun (Semua Role: Petani, Teknisi, Admin)
- **Endpoint:** `POST /auth/login`
- **Akses:** Publik (Rate limit: 15 req / 15 menit)
- **Request Body:**
  | Field | Type | Wajib | Keterangan |
  |---|---|---|---|
  | `identifier` | string | Ya | Nomor telepon (`08...`) atau email pengguna |
  | `password` | string | Ya | Kata sandi akun |

```javascript
// hooks/useDevices.js
import { useState, useEffect } from 'react';
import DeviceService from '../services/DeviceService';

function useDevices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        setLoading(true);
        const result = await DeviceService.getAllDevices();
        setDevices(result.data || []);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
- **Response Data (HTTP 200):**
  ```json
  {
    "status": "success",
    "message": "Login berhasil",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "cuid-user",
        "name": "Budi Santoso",
        "phoneNumber": "081234567890",
        "email": "petani@shroomsync.id",
        "role": "FARMER",
        "status": "ACTIVE",
        "profileCompleted": false,
        "mustChangePassword": true
      }
    };

    fetchDevices();

    // Poll every 30 seconds
    const interval = setInterval(fetchDevices, 30000);
    return () => clearInterval(interval);
  }, []);

  return { devices, loading, error, refetch: async () => {
    const result = await DeviceService.getAllDevices();
    setDevices(result.data || []);
  } };
}

export default useDevices;
```

```javascript
// hooks/useTelemetry.js
import { useState, useEffect } from 'react';
import TelemetryService from '../services/TelemetryService';

function useTelemetry(deviceId, interval = 10000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!deviceId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await TelemetryService.getLatestSensor(deviceId);
        setData(result.data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    // Fetch immediately
    fetchData();

    // Then poll at intervals
    const intervalId = setInterval(fetchData, interval);
    return () => clearInterval(intervalId);
  }, [deviceId, interval]);

  return { data, loading, error };
}

export default useTelemetry;
```

### Vue 3 Composition API

```javascript
// composables/useDevice.js
import { ref, onMounted, computed } from 'vue';
import DeviceService from '@/services/DeviceService';

export function useDevice(deviceId) {
  const device = ref(null);
  const loading = ref(false);
  const error = ref(null);

  const fetchDevice = async () => {
    try {
      loading.value = true;
      const result = await DeviceService.getDevice(deviceId);
      device.value = result.data;
      error.value = null;
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };
  }
  ```

  const isOnline = computed(() => device.value?.isOnline || false);
### 2. Aturan Navigasi Setelah Login (Routing Logic di Frontend)
Segera setelah login berhasil:
1. Simpan `token` di Secure Storage / LocalStorage dan lampirkan ke Header `Authorization`.
2. Periksa properti `role`:
   - Jika `role === "TECHNICIAN"` ➡️ Arahkan ke Portal Teknisi.
   - Jika `role === "ADMIN"` ➡️ Arahkan ke Portal Administrator.
   - Jika `role === "FARMER"`:
     - Jika `mustChangePassword === true` atau `profileCompleted === false` ➡️ **WAJIB kunci navigasi dan tampilkan layar Onboarding**.
     - Jika sudah lengkap ➡️ Arahkan ke Dashboard Petani.

  const updateMode = async (mode) => {
    try {
      await DeviceService.updateControlMode(deviceId, mode);
      device.value.config.controlMode = mode;
    } catch (err) {
      error.value = err.message;
    }
  };
### 3. Selesaikan Onboarding Petani (Complete Onboarding)
- **Endpoint:** `POST /auth/complete-onboarding`
- **Akses:** Khusus Petani (`Authorization: Bearer <token>`)
- **Request Body:**
  | Field | Type | Wajib | Keterangan |
  |---|---|---|---|
  | `newPassword` | string | Ya | Kata sandi baru (minimal 8 karakter) |
  | `name` | string | Tidak | Nama lengkap petani |
  | `address` | string | Tidak | Lokasi / alamat kumbung |
  | `farmName` | string | Tidak | Nama usaha / kelompok tani |
  | `mushroomType` | string | Tidak | Jenis varietas utama (misal: Jamur Tiram Putih) |

  onMounted(() => {
    fetchDevice();
    // Auto-refresh every 30s
    setInterval(fetchDevice, 30000);
  });
- **Response (HTTP 200):** Menghasilkan profil pengguna yang telah berstatus `profileCompleted: true` dan `mustChangePassword: false`.

  return { device, loading, error, isOnline, updateMode };
}
```
### 4. Ambil Profil Sesi Aktif
- **Endpoint:** `GET /auth/me`
- **Akses:** Semua Role terautentikasi.

---

## Error Handling
## 🔧 MODUL 2: INTEGRASI FITUR TEKNISI (PORTAL TEKNISI)
> Seluruh rute teknisi berada di bawah `/api/v1/technician/*` dan membutuhkan token dengan `role: "TECHNICIAN"`.

### Comprehensive Error Handler
### Alur Kerja Teknisi:
1. Mendaftarkan unit mikrokontroler ESP32 baru yang selesai dirakit ke sistem.
2. Mendapatkan Serial Number dan Kode Aktivasi untuk dicetak pada stiker QR fisik alat.
3. Memantau kesehatan koneksi jaringan dan telemetri hardware.
4. Membuat dan mengelola akun Administrator regional.

```javascript
// utils/error-handler.js
class APIError extends Error {
  constructor(message, statusCode, errors, originalError) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.originalError = originalError;
  }
### 1. Dashboard Diagnostik Hardware
- **Endpoint:** `GET /technician/dashboard`
- **Response Data (HTTP 200):**
  - `totalDevices`: Total seluruh alat yang terdaftar.
  - `activeDevices`: Jumlah alat yang terhubung aktif.
  - `offlineDevices`: Jumlah alat yang tidak mengirim heartbeat.
  - `totalAdmins`: Jumlah administrator aktif.
  - `hardwareBreakdown`: Distribusi versi hardware dan firmware.

  // User-friendly message
  getUserMessage() {
    switch (this.statusCode) {
      case 400:
        return 'Invalid input - please check your entries';
      case 404:
        return 'Resource not found';
      case 409:
        return 'This record already exists';
      case 429:
        return 'Too many requests - please wait before trying again';
      case 500:
        return 'Server error - please contact support';
      default:
        return this.message;
    }
  }
### 2. Registrasi / Provisioning Alat Baru
- **Endpoint:** `POST /technician/devices`
- **Request Body:**
  | Field | Type | Wajib | Keterangan |
  |---|---|---|---|
  | `serialNumber` | string | Ya | ID unik fisik (misal: `SS-0426-001`) |
  | `name` | string | Tidak | Nama unit default (misal: `Kumbung A`) |
  | `model` | string | Ya | Model node (misal: `ShroomSync Smart Node v2`) |
  | `hardwareVersion` | string | Tidak | Versi board (default: `1.0`) |
  | `firmwareVersion` | string | Tidak | Versi firmware ESP32 (default: `2.1.0`) |

  // Format errors for form display
  getFormErrors() {
    if (!this.errors || !Array.isArray(this.errors)) {
      return {};
    }
- **Response Data (HTTP 201):**
  Mengembalikan objek alat lengkap dengan `activationCode` yang dihasilkan otomatis untuk di-*generate* menjadi stiker QR Code pada kotak mikrokontroler.

    return this.errors.reduce((acc, err) => {
      acc[err.field] = err.message;
      return acc;
    }, {});
  }
}
### 3. Daftar Inventaris Seluruh Hardware
- **Endpoint:** `GET /technician/devices?page=1&limit=20&status=READY`
- **Filter Query:** `status` (`READY`, `ACTIVE`, `OFFLINE`, `SUSPENDED`).

// Usage in React
function MyComponent() {
  const [errors, setErrors] = useState({});
### 4. Detail Hardware
- **Endpoint:** `GET /technician/devices/:id`

  const handleSubmit = async (data) => {
    try {
      await DeviceService.updateSetpoint(deviceId, data);
    } catch (error) {
      if (error instanceof APIError) {
        setErrors(error.getFormErrors());
        toast.error(error.getUserMessage());
      }
    }
  };
### 5. Update Spesifikasi / Firmware Hardware
- **Endpoint:** `PUT /technician/devices/:id`
- **Request Body:** `name`, `model`, `hardwareVersion`, `firmwareVersion`, `status`.

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="minSuhu"
        aria-invalid={!!errors.minSuhu}
      />
      {errors.minSuhu && (
        <span className="error">{errors.minSuhu}</span>
      )}
    </form>
  );
}
```
### 6. Hapus Hardware
- **Endpoint:** `DELETE /technician/devices/:id`

---
### 7. Buat Akun Administrator Baru
- **Endpoint:** `POST /technician/admins`
- **Request Body:**
  | Field | Type | Wajib | Keterangan |
  |---|---|---|---|
  | `fullName` | string | Ya | Nama administrator |
  | `phoneNumber` | string | Ya | Nomor telepon unik |
  | `email` | string | Tidak | Email admin |
  | `password` | string | Ya | Kata sandi awal (min 8 karakter) |

## Real-time Updates
### 8. Daftar Seluruh Administrator
- **Endpoint:** `GET /technician/admins`

### Polling Strategy (Simple)
### 9. Ubah Status Aktif Administrator
- **Endpoint:** `PUT /technician/admins/:id/status`
- **Request Body:** `status: "ACTIVE" | "SUSPENDED" | "INACTIVE"`

```javascript
// Best for: Dashboard with 10-30s refresh interval
function DeviceDashboard({ deviceId }) {
  const [data, setData] = useState(null);
---

  useEffect(() => {
    // Fetch immediately
    const fetchData = () => {
      DeviceService.getDevice(deviceId)
        .then(res => setData(res.data))
        .catch(err => console.error(err));
    };
## 👑 MODUL 3: INTEGRASI FITUR ADMINISTRATOR (PORTAL ADMIN)
> Seluruh rute admin berada di bawah `/api/v1/admin/*` dan membutuhkan token dengan `role: "ADMIN"` atau `"TECHNICIAN"`.

    fetchData();
### Alur Kerja Admin:
1. Mendaftarkan petani binaan baru dan memberikan kredensial awal.
2. Memetakan dan menugaskan alat ESP32 kumbung ke petani tertentu.
3. Memantau statistik adopsi dan status operasional seluruh kumbung binaan.

    // Then poll every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [deviceId]);
### 1. Dashboard Statistik Ekosistem
- **Endpoint:** `GET /admin/dashboard`
- **Response Data (HTTP 200):**
  - `totalFarmers`: Jumlah total petani binaan terdaftar.
  - `totalDevices`: Total alat di wilayah binaan.
  - `assignedDevices`: Alat yang sudah aktif ditautkan ke petani.
  - `unassignedDevices`: Alat yang masih tersedia di gudang/belum diklaim.

  if (!data) return <Loading />;
  return <DeviceCard device={data} />;
}
```
### 2. Pendaftaran Akun Petani Baru
- **Endpoint:** `POST /admin/farmers`
- **Request Body:**
  | Field | Type | Wajib | Keterangan |
  |---|---|---|---|
  | `fullName` | string | Ya | Nama petani |
  | `phoneNumber` | string | Ya | Nomor telepon unik (dipakai untuk login petani) |
  | `email` | string | Tidak | Email petani |
  | `password` | string | Ya | Kata sandi sementara (wajib diganti petani saat onboarding) |

### Socket.IO Real-time (Advanced)
### 3. Daftar Petani Binaan
- **Endpoint:** `GET /admin/farmers?limit=20&page=1`

```javascript
// socket-service.js
import io from 'socket.io-client';
import config from './config';
### 4. Detail Petani & Daftar Kumbung yang Dimilikinya
- **Endpoint:** `GET /admin/farmers/:id`

class SocketService {
  constructor() {
    this.socket = io(config.wsURL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });
### 5. Update Data Profil Petani
- **Endpoint:** `PUT /admin/farmers/:id`
- **Request Body:** `fullName`, `phoneNumber`, `email`, `status`.

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
### 6. Penugasan Alat ke Petani (Assign Device)
- **Endpoint:** `POST /admin/devices/assign`
- **Request Body:**
  ```json
  {
    "deviceId": "uuid-device-atau-serial",
    "farmerId": "uuid-farmer"
  }
  ```

  // Subscribe to device telemetry
  onDeviceTelemetry(deviceId, callback) {
    this.socket.on(`device:${deviceId}:telemetry`, callback);
  }
### 7. Pelepasan Alat dari Petani (Unassign Device)
- **Endpoint:** `POST /admin/devices/:deviceId/unassign`

  // Subscribe to device status changes
  onDeviceStatus(deviceId, callback) {
    this.socket.on(`device:${deviceId}:status`, callback);
  }
---

  // Unsubscribe
  offDeviceTelemetry(deviceId) {
    this.socket.off(`device:${deviceId}:telemetry`);
  }
## 🌾 MODUL 4: INTEGRASI FITUR PETANI (APLIKASI PETANI)
> Akses menggunakan token dengan `role: "FARMER"`. Rute terpasang di `/api/v1/devices/*` dan `/api/v1/farmer/*`.

  disconnect() {
    this.socket.disconnect();
  }
}
### Alur Kerja Petani:
1. Login dan aktivasi mandiri kumbung (scan QR atau ketik serial number).
2. Memantau dashboard multi-kumbung (suhu dalam/luar, kelembaban, pompa, status koneksi).
3. Mengatur kontrol (mode otomatis, setpoint varietas, durasi timer semprot, saklar manual).
4. Membuka siklus budidaya baru, memantau umur baglog, dan mencatat hasil panen harian.
5. Membaca ringkasan performa (*productivity yield per baglog*, panen puncak, omset).

export default new SocketService();
```

```javascript
// Usage in React
function RealTimeDashboard({ deviceId }) {
  const [telemetry, setTelemetry] = useState(null);

  useEffect(() => {
    SocketService.onDeviceTelemetry(deviceId, (data) => {
      setTelemetry(data);
    });

    return () => SocketService.offDeviceTelemetry(deviceId);
  }, [deviceId]);

  return (
    <div>
      <p>Temperature: {telemetry?.suhu}°C</p>
      <p>Humidity: {telemetry?.kelembaban}%</p>
    </div>
  );
}
```

---

## Rate Limit Handling
### A. Manajemen Kumbung Petani

Backend default menonaktifkan rate limiter (`RATE_LIMIT_ENABLED=false`) supaya dashboard bisa polling dan mengirim command secara kontinu. Gunakan pola berikut hanya kalau rate limiter sengaja diaktifkan di environment backend.

### Exponential Backoff Retry

```javascript
// utils/retry.js
async function retryWithBackoff(
  fn,
  maxRetries = 3,
  initialDelay = 1000
) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if it's a rate limit error
      if (error.statusCode === 429 && i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.warn(`Rate limited, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
#### 1. Daftar Kumbung Milik Petani
- **Endpoint:** `GET /devices`
- **Headers:** `Authorization: Bearer <token>`
- **Response Data (HTTP 200):**
  Array daftar perangkat yang otomatis difilter hanya milik petani yang sedang login:
  ```json
  {
    "status": "success",
    "data": [
      {
        "id": "cuid-device",
        "deviceId": "SS-0426-001",
        "name": "Kumbung Barat - Tiram Putih",
        "hardwareVersion": "2.0",
        "firmwareVersion": "2.1.0",
        "isOnline": true,
        "rssiDbm": -65,
        "signalStrength": "Good",
        "uptimeMs": 3600000,
        "pumpStatus": "OFF",
        "floorPumpStatus": "OFF",
        "fanStatus": "OFF",
        "activatedAt": "2026-10-01T08:00:00.000Z",
        "lastSeenAt": "2026-10-12T16:20:00.000Z"
      }
    }
    ]
  }
  ```

  throw lastError;
}
#### 2. Aktivasi / Tautkan Kumbung Baru (Scan QR / Input Serial Number)
- **Endpoint:** `POST /devices/activate`
- **Request Body:**
  | Field | Type | Wajib | Keterangan |
  |---|---|---|---|
  | `deviceId` | string | Ya | Serial number dari barcode/QR (misal: `SS-0426-001`) |
  | `name` | string | Tidak | Nama kustom kumbung dari petani |

// Usage
try {
  const result = await retryWithBackoff(
    () => DeviceService.getAllDevices(),
    3,
    1000
  );
} catch (error) {
  console.error('Failed after retries:', error);
}
```
- **Response Gagal Jika Sudah Dimiliki Petani Lain (HTTP 409):**
  `message: "Perangkat ini sudah diaktivasi oleh akun petani lain. Hubungi admin sistem."`

### Rate Limit Queue
#### 3. Lepaskan Tautan Kumbung (Unpair)
- **Endpoint:** `POST /devices/unpair/:deviceId` (atau `POST /devices/:deviceId/unpair`)

```javascript
// utils/request-queue.js
class RequestQueue {
  constructor(maxConcurrent = 5) {
    this.queue = [];
    this.running = 0;
    this.maxConcurrent = maxConcurrent;
  }
#### 4. Detail Kumbung & Konfigurasi Aktif
- **Endpoint:** `GET /devices/:deviceId`
- **Response Data (HTTP 200):** Mengembalikan objek status hardware beserta konfigurasi setting (`minTemperature`, `maxTemperature`, `minHumidity`, `maxHumidity`, `timerDurationSeconds`, `controlMode`).

  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  async process() {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      this.running++;
      const { fn, resolve, reject } = this.queue.shift();

      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        this.running--;
        this.process();
      }
    }
  }
}

const queue = new RequestQueue(5);

// Usage
queue.add(() => DeviceService.getAllDevices())
  .then(result => console.log(result))
  .catch(error => console.error(error));
```

---

## Complete Examples
### B. Kontrol Otomasi & Aktuator IoT
> Setiap instruksi yang dikirim otomatis disimpan di database dan di-broadcast ke broker MQTT (`{serialNumber}/cmd/*`).

### React Dashboard Component
#### 1. Ubah Mode Operasi Kumbung
- **Endpoint:** `POST /devices/:deviceId/control/mode`
- **Request Body:**
  | Field | Type | Pilihan Nilai | Keterangan |
  |---|---|---|---|
  | `controlMode` | integer / string | `1` / `"MANUAL"`<br>`2` / `"AUTO"`<br>`3` / `"SCHEDULE"` | Mode kontrol perangkat |

```javascript
// components/DeviceDashboard.jsx
import React, { useState, useEffect } from 'react';
import DeviceService from '../services/DeviceService';
import TelemetryService from '../services/TelemetryService';
#### 2. Perbarui Ambang Setpoint Suhu & Kelembaban (Mode Otomatis)
- **Endpoint:** `POST /devices/:deviceId/setpoint`
- **Request Body:**
  | Field | Type | Wajib | Keterangan |
  |---|---|---|---|
  | `minSuhu` | number | Ya | Ambang suhu minimal (°C) |
  | `midSuhu` | number | Ya | Ambang suhu maksimal/target pemadaman (°C) |
  | `minKelembaban` | number | Ya | Ambang kelembaban minimal (%) |
  | `midKelembaban` | number | Ya | Ambang kelembaban maksimal (%) |

function DeviceDashboard() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
#### 3. Durasi Timer Penyemprotan Pompa
- **Pompa Kabut Atas:** `POST /devices/:deviceId/timer`
  ```json
  { "timerMinute": 2, "timerSecond": 30 }
  ```
- **Pompa Sirkulasi Lantai:** `POST /devices/:deviceId/timer/floor` (alias: `.../floor-timer`)
  ```json
  { "floorTimerMinute": 1, "floorTimerSecond": 0 }
  ```

  // Fetch devices on mount
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const result = await DeviceService.getAllDevices();
        setDevices(result.data);
        if (result.data.length > 0) {
          setSelectedDevice(result.data[0]);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
#### 4. Saklar Override Manual Aktuator (Pompa & Kipas)
- **Saklar Pompa:** `POST /devices/:deviceId/actuator/pump` (alias: `.../control/pump`)
  ```json
  { "state": "ON" } atau { "state": "OFF" }
  ```
  *(Dapat juga menerima boolean: `{ "on": true }` / `{ "on": false }`)*
- **Saklar Kipas / Pengabutan:** `POST /devices/:deviceId/actuator/fan` (alias: `.../control/fan`)
  ```json
  { "state": "ON" } atau { "state": "OFF" }
  ```

    fetchDevices();
    const interval = setInterval(fetchDevices, 30000);
    return () => clearInterval(interval);
  }, []);
#### 5. Pemadaman Darurat (Emergency Stop)
- **Endpoint:** `POST /farmer/devices/:deviceId/emergency-stop`
- **Fungsi:** Mematikan seluruh aktuator seketika jika terjadi anomali kelistrikan/pipa bocor.

  // Fetch telemetry for selected device
  useEffect(() => {
    if (!selectedDevice) return;
---

    const fetchTelemetry = async () => {
      try {
        const result = await TelemetryService.getLatestSensor(
          selectedDevice.deviceId
        );
        setTelemetry(result.data);
      } catch (err) {
        console.error('Failed to fetch telemetry:', err);
      }
    };
### C. Monitoring Telemetri Sensor

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 10000);
    return () => clearInterval(interval);
  }, [selectedDevice]);

  const handleModeChange = async (mode) => {
    try {
      await DeviceService.updateControlMode(selectedDevice.deviceId, mode);
      setSelectedDevice({
        ...selectedDevice,
        config: { ...selectedDevice.config, controlMode: mode },
      });
    } catch (err) {
      alert(`Failed to update mode: ${err.message}`);
#### 1. Pembacaan Sensor Real-Time Terkini
- **Endpoint:** `GET /devices/:deviceId/telemetry/sensor/latest`
- **Response Data (HTTP 200):**
  ```json
  {
    "status": "success",
    "data": {
      "temperature": 25.4,
      "humidity": 88.5,
      "recordedAt": "2026-10-12T16:20:00.000Z",
      "isOnline": true
    }
  };
  }
  ```

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
#### 2. Riwayat Sensor (Grafik & Rentang Waktu)
- **Endpoint:** `GET /devices/:deviceId/telemetry/sensor?from=2026-10-01T00:00:00.000Z&to=2026-10-12T23:59:59.000Z&limit=100`
- **Query Params:**
  - `from` (ISO Date): Batas awal riwayat.
  - `to` (ISO Date): Batas akhir riwayat.
  - `limit` (number, default: 50, max: 1000).

  return (
    <div className="dashboard">
      <div className="sidebar">
        <h2>Devices</h2>
        {devices.map(device => (
          <div
            key={device.id}
            className={`device-item ${
              selectedDevice?.id === device.id ? 'active' : ''
            }`}
            onClick={() => setSelectedDevice(device)}
          >
            <div className="device-name">{device.name}</div>
            <div className={`status ${device.isOnline ? 'online' : 'offline'}`}>
              {device.isOnline ? '🟢 Online' : '🔴 Offline'} • Wi-Fi: {device.signalStrength || 'Good'} ({device.rssiDbm || -65} dBm)
            </div>
            <small style={{ color: '#888' }}>Firmware v{device.firmwareVersion || '1.0.0'}</small>
          </div>
        ))}
      </div>

      <div className="main-content">
        {selectedDevice && (
          <>
            <h1>{selectedDevice.name}</h1>

            <div className="telemetry-section">
              {telemetry && (
                <>
                  <div className="metric">
                    <span>Temperature</span>
                    <strong>{telemetry.suhu}°C</strong>
                  </div>
                  <div className="metric">
                    <span>Humidity</span>
                    <strong>{telemetry.kelembaban}%</strong>
                  </div>
                </>
              )}
            </div>

            <div className="control-section">
              <h3>Controls</h3>
              <div className="mode-selector">
                <label>Mode</label>
                <select
                  value={selectedDevice.config?.controlMode || 1}
                  onChange={(e) =>
                    handleModeChange(parseInt(e.target.value))
                  }
                >
                  <option value={1}>Manual</option>
                  <option value={2}>Auto</option>
                  <option value={3}>Schedule</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default DeviceDashboard;
```

---

## Alur Login, Onboarding Akun Baru & Aktivasi Perangkat (Barcode / ID)
### D. Manajemen Siklus Budidaya Jamur (Cultivation Cycles)

Berikut adalah panduan arsitektur frontend untuk alur pengguna:
#### 1. Memulai Siklus Baru
- **Endpoint:** `POST /devices/:deviceId/cycles`
- **Request Body:**
  | Field | Type | Wajib | Keterangan |
  |---|---|---|---|
  | `name` | string | Ya | Nama siklus (misal: `Siklus Oktober 2026`) |
  | `mushroomType` | string | Ya | Jenis jamur (misal: `Jamur Tiram`) |
  | `strain` | string | Tidak | Varietas spesifik (misal: `Tiram Putih Florida`) |
  | `baglogCount` | integer | Ya | Jumlah total baglog yang dimasukkan |
  | `startedAt` | string (ISO Date) | Ya | Tanggal mulai pembibitan |
  | `expectedEndedAt` | string (ISO Date) | Tidak | Perkiraan tanggal pembongkaran baglog |
  | `notes` | string | Tidak | Catatan tambahan |

### 1. Alur Login & Deteksi Akun Baru
```javascript
// Login handler di halaman Login.jsx
async function handleLogin(identifier, password) {
  const res = await apiClient.post('/auth/login', { identifier, password });
  const { token, mustSetupProfile, nextStep } = res.data;
#### 2. Daftar Siklus Budidaya
- **Endpoint:** `GET /devices/:deviceId/cycles?status=active`

  // Simpan token JWT
  localStorage.setItem('shroomsync_token', token);
#### 3. Update Detail Siklus
- **Endpoint:** `PUT /devices/:deviceId/cycles/:cycleId` (atau `PATCH`)

  // Jika akun baru, arahkan ke halaman setup data diri & ganti password
  if (mustSetupProfile || nextStep === 'complete_profile') {
    navigate('/complete-onboarding');
  } else {
    navigate('/dashboard');
#### 4. Tandai Siklus Selesai
- **Endpoint:** `POST /devices/:deviceId/cycles/:cycleId/complete`
- **Request Body:**
  ```json
  {
    "endedAt": "2026-11-30T00:00:00.000Z",
    "notes": "Siklus selesai 4 flush, kumbung disterilkan."
  }
}
```
  ```

### 2. Form Onboarding (Ganti Password & Data Diri)
```javascript
// Onboarding.jsx
async function handleSubmitOnboarding(formData) {
  await apiClient.post('/auth/complete-onboarding', {
    currentPassword: formData.currentPassword, // Password default dari admin
    newPassword: formData.newPassword,         // Password baru pribadi
    fullName: formData.fullName,
    phoneNumber: formData.phoneNumber,
    farmName: formData.farmName,
    farmAddress: formData.farmAddress,
  });

  alert('Profil berhasil diatur! Selamat datang di dashboard Anda.');
  navigate('/dashboard');
}
```

### 3. Aktivasi Perangkat Baru (Input Serial atau Scan Barcode)
```javascript
// ActivateDeviceModal.jsx
// Petani dapat memasukkan ID manual atau menggunakan kamera ponsel / scanner barcode
async function handleActivateDevice(scannedDeviceId, kumbungName) {
  try {
    const res = await apiClient.post('/devices/activate', {
      deviceId: scannedDeviceId, // contoh: "SS-0426-001" dari hasil scan kamera
      name: kumbungName || `Kumbung ${scannedDeviceId}`,
    });

    alert('Kumbung jamur berhasil diaktivasi!');
    // Refresh daftar perangkat user
    loadUserDevices();
  } catch (err) {
    alert(err.message); // Menampilkan pesan jika device sudah diklaim akun lain
#### 5. Ringkasan & Analisis Performa Siklus (Summary Analytics)
- **Endpoint:** `GET /devices/:deviceId/cycles/:cycleId/summary`
- **Response Data (HTTP 200):**
  ```json
  {
    "status": "success",
    "data": {
      "cycle": {
        "id": "cuid-siklus",
        "deviceId": "SS-0426-001",
        "name": "Siklus Oktober 2026",
        "mushroomType": "Jamur Tiram",
        "baglogCount": 1200,
        "startedAt": "2026-10-01T00:00:00.000Z",
        "status": "active",
        "_count": { "harvests": 4 }
      },
      "summary": {
        "totalHarvests": 4,
        "totalWeightKg": 82.5,
        "totalRevenue": 1485000,
        "cycleAgeDays": 25,
        "harvestDays": 4,
        "averageWeightPerHarvestKg": 20.625,
        "averageWeightPerCycleDayKg": 3.3,
        "averageWeightPerHarvestDayKg": 20.625,
        "yieldPerBaglogKg": 0.0688,
        "firstHarvestAt": "2026-10-05T08:00:00.000Z",
        "latestHarvestAt": "2026-10-12T08:30:00.000Z",
        "peakHarvestDay": {
          "date": "2026-10-12",
          "weightKg": 25.4
        }
      }
    }
  }
}
```
  ```

---

## Debugging Tips
### E. Pencatatan Hasil Panen Harian (Harvest Records)

### Network Request Inspector
#### 1. Catat Timbangan Panen Baru
- **Endpoint:** `POST /devices/:deviceId/cycles/:cycleId/harvests`
- **Request Body:**
  | Field | Type | Wajib | Keterangan |
  |---|---|---|---|
  | `weightKg` | number | Ya | Berat panen dalam Kilogram (misal: `18.75`) |
  | `pricePerKg` | number | Tidak | Harga jual per kg (dipakai kalkulasi omset) |
  | `harvestedAt` | string (ISO Date) | Tidak | Waktu petik (default: waktu sekarang) |
  | `grade` | string | Tidak | Kualitas (misal: `A`, `B`, `Super`) |
  | `notes` | string | Tidak | Catatan (misal: `Panen pagi flush ke-2`) |

```javascript
// Add this to intercept all API calls
const originalFetch = window.fetch;
window.fetch = function(...args) {
  console.log('API Call:', args[0], args[1]);
  return originalFetch.apply(this, args)
    .then(response => {
      console.log('Response:', response.status);
      return response;
    });
};
```
#### 2. Ambil Daftar Catatan Panen
- **Endpoint:** `GET /devices/:deviceId/cycles/:cycleId/harvests?limit=50&offset=0`

### Check Rate Limit Status
#### 3. Edit Catatan Panen
- **Endpoint:** `PUT /devices/:deviceId/cycles/:cycleId/harvests/:harvestId` (atau `PATCH`)

```javascript
async function checkRateLimit() {
  try {
    const response = await fetch('http://localhost:3000/api/v1/devices');
    console.log({
      limit: response.headers.get('RateLimit-Limit'),
      remaining: response.headers.get('RateLimit-Remaining'),
      reset: response.headers.get('RateLimit-Reset'),
    });
  } catch (error) {
    console.error(error);
  }
}
```
#### 4. Hapus Catatan Panen
- **Endpoint:** `DELETE /devices/:deviceId/cycles/:cycleId/harvests/:harvestId`

---

## Cultivation Cycles & Harvest Workflow
### F. Preset Varietas Cerdas (Mushroom Presets)

Fitur utama bagi petani (*farmer*) adalah manajemen siklus budidaya kumbung dan pencatatan panen harian:
#### 1. Ambil Rekomendasi Parameter Budidaya
- **Endpoint:** `GET /farmer/presets`
- **Data Tersedia:** Standar agronomi resmi untuk varietas:
  - `tiram_putih` (Suhu: 24-28°C, RH: 80-95%)
  - `tiram_cokelat` (Suhu: 26-30°C, RH: 80-90%)
  - `jamur_kuping` (Suhu: 26-32°C, RH: 85-95%)
  - `shiitake` (Suhu: 18-24°C, RH: 80-90%)
  - `kancing` (Suhu: 16-20°C, RH: 85-92%)

```javascript
// services/CycleService.js
class CycleService {
  // Ambil daftar siklus budidaya untuk suatu kumbung/device
  static async getCycles(deviceId) {
    return apiClient.get(`/devices/${deviceId}/cycles`);
  }
#### 2. Terapkan Preset Sekali Klik
- **Endpoint:** `POST /farmer/devices/:deviceId/apply-preset`
- **Request Body:**
  ```json
  { "presetKey": "tiram_putih" }
  ```
  *(Otomatis memperbarui database setpoint dan mengirim perintah setpoint baru ke mikrokontroler via MQTT).*

  // Buka siklus budidaya baru
  static async startCycle(deviceId, data) {
    return apiClient.post(`/devices/${deviceId}/cycles`, {
      name: data.name,                // Contoh: "Siklus Tiram Putih 01"
      mushroomType: data.mushroomType, // Default: "Jamur Tiram"
      strain: data.strain,            // Contoh: "Florida White"
      baglogCount: data.baglogCount,  // Jumlah baglog
      startedAt: data.startedAt,      // ISO date
      expectedEndedAt: data.expectedEndedAt,
      notes: data.notes,
    });
  }
---

  // Ambil metrik produktivitas siklus (Yield per Baglog, Total Panen, Omzet, Peak Day)
  static async getCycleSummary(deviceId, cycleId) {
    return apiClient.get(`/devices/${deviceId}/cycles/${cycleId}/summary`);
  }
## 🛑 DAFTAR KODE KESALAHAN & HTTP STATUS

  // Catat panen harian baru
  static async logHarvest(deviceId, cycleId, harvestData) {
    return apiClient.post(`/devices/${deviceId}/cycles/${cycleId}/harvests`, {
      harvestedAt: harvestData.harvestedAt || new Date().toISOString(),
      weightKg: harvestData.weightKg,       // Berat panen (kg)
      pricePerKg: harvestData.pricePerKg,   // Harga per kg (Rp)
      grade: harvestData.grade || 'Grade A',
      notes: harvestData.notes,
    });
  }
}
Frontend wajib menangani kode status berikut:

export default CycleService;
```

## Need Help?

- **API Documentation:** See [API_DOCUMENTATION.md](../API_DOCUMENTATION.md)
- **MQTT Details:** See [MQTT Protocol](../API_DOCUMENTATION.md#mqtt-protocol)
- **Issues:** Contact backend team or create issue
- **Features:** Submit feature request via GitHub

---

**Last Updated:** 2026-05-14  
**Version:** 1.0.0
| HTTP Status | Kode / Kondisi | Keterangan untuk UI |
|---|---|---|
| **400** | `VALIDATION_ERROR` | Format input salah (nomor HP tidak valid, angka minus, dsb). Tampilkan pesan validasi pada form. |
| **401** | `UNAUTHORIZED` | Token kadaluarsa / tidak ada token. Arahkan user ke halaman Login. |
| **403** | `FORBIDDEN` | Akses ditolak karena role akun tidak sesuai (misal Petani mencoba akses rute Teknisi). |
| **404** | `NOT_FOUND` | Perangkat, siklus, atau data tidak ditemukan. |
| **409** | `CONFLICT` | Nomor HP sudah terdaftar, atau Serial Number sudah diklaim oleh petani lain. |
| **429** | `RATE_LIMIT_EXCEEDED` | Batas request terlampaui. Tampilkan pemberitahuan agar menunggu beberapa saat. |
| **503** | `SERVICE_UNAVAILABLE` | Database atau MQTT sedang dalam pemeliharaan. |
