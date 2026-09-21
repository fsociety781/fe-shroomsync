# 📊 Flowchart & Diagram Arsitektur Proyek ShroomSync

Dokumen ini memuat seluruh diagram alur (*flowchart*) sistem **ShroomSync** (Smart Mushroom Cultivation Monitoring & Automation System), mencakup arsitektur end-to-end, alur autentikasi, aktivasi perangkat dengan barcode/QR, telemetri sensor, kontrol aktuator, hingga siklus budidaya & panen.

---

## 1. Flowchart Arsitektur Sistem Keseluruhan (End-to-End)

Diagram ini menggambarkan interaksi antara perangkat keras IoT di kumbung fisik, protokol komunikasi (MQTT & HTTP REST), backend server, hingga antarmuka pengguna (Mobile APK & Web App).

```mermaid
flowchart TD
    subgraph IoT_Hardware["🌿 Perangkat IoT Kumbung (Fisik)"]
        ESP32["Microcontroller ESP32"]
        Sensors["Sensor DHT22 / SHT3x<br/>(Suhu & Kelembaban)"]
        Actuators["Aktuator Relay:<br/>- Pompa Kabut (Mister)<br/>- Kipas Exhaust (Fan)<br/>- Pompa Lantai"]
        BarcodeLabel["Stiker Barcode / QR Code Fisik"]
        
        Sensors -->|Data Pembacaan| ESP32
        ESP32 -->|Kendalikan Relay ON/OFF| Actuators
        BarcodeLabel -.->|Ditempel pada Casing| ESP32
    end

    subgraph Network_Protocol["📡 Jalur Jaringan & Protokol"]
        MQTT_Broker["MQTT Broker<br/>(EMQX / Mosquitto)"]
        DevTunnel["VS Code Dev Tunnels / HTTPS<br/>(Reverse Proxy & SSL)"]
    end

    subgraph Backend_Server["🖥️ Backend API (Node.js / Express)"]
        AuthService["Auth & JWT Service"]
        DeviceService["Device & Pairing Manager"]
        TelemetryService["Telemetry Ingestion Worker"]
        ControlService["Device Control Engine"]
        CycleService["Siklus & Panen Service"]
        Database[("Database MariaDB / MySQL")]

        AuthService --- Database
        DeviceService --- Database
        TelemetryService --- Database
        ControlService --- Database
        CycleService --- Database
    end

    subgraph Client_Apps["📱 Antarmuka Pengguna (ShroomSync Frontend)"]
        MobileAPK["Aplikasi Android Native (APK)<br/>Capacitor 8 + React"]
        WebApp["Web Dashboard (Browser)<br/>Vite + React"]
        CameraScanner["Kamera HP / Scanner Barcode<br/>(html5-qrcode)"]
    end

    %% Komunikasi IoT ke Broker & Backend
    ESP32 -->|"Publish Telemetri<br/>(kumbung/{id}/telemetry)"| MQTT_Broker
    MQTT_Broker -->|"Subscribe Data Masuk"| TelemetryService
    ControlService -->|"Publish Perintah Kontrol<br/>(kumbung/{id}/command)"| MQTT_Broker
    MQTT_Broker -->|"Kirim Perintah ke ESP32"| ESP32

    %% Komunikasi Client ke Backend
    MobileAPK <-->|"REST API Request via HTTPS"| DevTunnel
    WebApp <-->|"REST API Request via HTTP/HTTPS"| DevTunnel
    DevTunnel <--> Backend_Server

    %% Scanner Barcode
    CameraScanner -->|"Pindai Stiker Barcode/QR"| BarcodeLabel
    CameraScanner -->|"Isi Otomatis Device ID"| MobileAPK
```

---

## 2. Flowchart Autentikasi & Onboarding Petani Baru

Alur logika saat pengguna masuk ke aplikasi. Jika akun baru pertama kali login (dibuat oleh admin), pengguna diarahkan ke layar penuh **Onboarding** untuk mengganti kata sandi default dan melengkapi data usaha tani.

```mermaid
flowchart TD
    Start([Pengguna Buka Aplikasi]) --> CheckToken{Cek Token JWT di LocalStorage?}
    
    CheckToken -- Ada & Masih Valid --> ValidateProfile{Profil Sudah Lengkap?}
    CheckToken -- Tidak Ada / Kedaluwarsa --> ShowLogin[Tampilkan Layar Login]
    
    ShowLogin --> SubmitLogin[Input Email/Username & Password]
    SubmitLogin --> APILogin[Kirim POST /auth/login]
    
    APILogin --> CheckLoginSuccess{Kredensial Valid?}
    CheckLoginSuccess -- Salah --> LoginError[Tampilkan Pesan Error / Kredensial Salah]
    LoginError --> ShowLogin
    
    CheckLoginSuccess -- Benar --> SaveToken[Simpan Token JWT & Data User]
    SaveToken --> CheckOnboarding{mustSetupProfile == true?}
    
    CheckOnboarding -- Ya (Akun Baru) --> ShowOnboarding[Tampilkan Layar Penuh Onboarding Petani]
    ValidateProfile -- Belum Lengkap --> ShowOnboarding
    
    ShowOnboarding --> FillOnboardingForm["Petani Mengisi Data:<br/>1. Kata Sandi Lama & Sandi Baru<br/>2. Nama Lengkap Petani<br/>3. Nomor WhatsApp<br/>4. Nama Usaha Kumbung<br/>5. Alamat Lengkap"]
    
    FillOnboardingForm --> SubmitOnboarding[Kirim POST /auth/complete-onboarding]
    SubmitOnboarding --> CheckOnboardSuccess{Validasi Berhasil?}
    
    CheckOnboardSuccess -- Gagal --> OnboardError[Tampilkan Notifikasi Error Form]
    OnboardError --> FillOnboardingForm
    
    CheckOnboardSuccess -- Berhasil --> UpdateSession[Perbarui Sesi: isProfileCompleted = true]
    UpdateSession --> GoDashboard[Arahkan ke Dashboard Utama]
    
    CheckOnboarding -- Tidak (Akun Lama) --> GoDashboard
    ValidateProfile -- Sudah Lengkap --> GoDashboard
    
    GoDashboard --> EndDashboard([Mulai Monitoring & Kelola Kumbung])
```

---

## 3. Flowchart Tambah & Aktivasi Perangkat (Scan Barcode / QR Code)

Alur penambahan kumbung IoT fisik ke akun petani, baik dengan mengetik manual maupun memindai stiker Barcode/QR Code menggunakan kamera HP.

```mermaid
flowchart TD
    StartKumbung([Petani di Halaman Kumbung Saya]) --> ChooseAddOption{Pilih Metode Tambah}
    
    ChooseAddOption -- Klik 'Scan Barcode' --> OpenScanner[Buka Barcode Scanner Modal]
    ChooseAddOption -- Klik 'Tambah Kumbung' --> OpenModal[Buka Form Tambah Kumbung]
    
    OpenModal --> OptionInsideForm{Mau Scan dari Form?}
    OptionInsideForm -- Ya --> OpenScanner
    OptionInsideForm -- Tidak (Ketik Manual) --> ManualInput[Input Nama & Device ID Manual]
    
    OpenScanner --> CheckCamPerm{Izin Kamera Diberikan?}
    CheckCamPerm -- Belum / Ditolak --> RequestPerm[Minta Izin Kamera Android OS]
    
    RequestPerm --> PermGranted{Pengguna Mengizinkan?}
    PermGranted -- Tidak --> FallbackGallery[Opsi Unggah Gambar Barcode dari Galeri]
    FallbackGallery --> ProcessImage[Decode Barcode dari File Gambar]
    
    PermGranted -- Ya --> StartCameraStream[Nyalakan Kamera Belakang / Torch]
    StartCameraStream --> PointToCode[Arahkan Kamera ke Barcode/QR ESP32]
    
    PointToCode --> DetectCode{Barcode/QR Terdeteksi?}
    DetectCode -- Belum Terbaca --> PointToCode
    
    DetectCode -- Berhasil Terbaca --> HapticFeedback[Pemicu Haptic Vibration HP]
    ProcessImage --> HapticFeedback
    
    HapticFeedback --> SmartParser["Smart Parser (parseScannedDevice):<br/>- Format JSON: ambil deviceId & name<br/>- Format URL: ekstrak query params<br/>- Format Prefix ID:SS-xxx: bersihkan prefix<br/>- Format Raw: ambil string Device ID"]
    
    SmartParser --> AutoFill[Isi Otomatis Field Device ID & Nama di Form]
    CloseScanner[Tutup Scanner Modal] --> AutoFill
    ManualInput --> ReadySubmit[Form Lengkap]
    AutoFill --> ReadySubmit
    
    ReadySubmit --> SubmitDevice[Klik 'Simpan & Aktivasi']
    SubmitDevice --> SendActivate[Kirim POST /devices/activate]
    
    SendActivate --> CheckActivateStatus{Aktivasi Berhasil?}
    CheckActivateStatus -- Gagal --> ShowToastError[Tampilkan Toast Error: ID Tidak Valid / Sudah Terpakai]
    ShowToastError --> ReadySubmit
    
    CheckActivateStatus -- Berhasil --> RefetchList[Muat Ulang Daftar Kumbung dari Server]
    RefetchList --> ShowToastSuccess[Tampilkan Toast Sukses: Kumbung Berhasil Diaktivasi]
    ShowToastSuccess --> EndPairing([Perangkat Aktif di Dashboard])
```

---

## 4. Flowchart Telemetri Sensor & Monitoring Real-Time

Alur pengiriman data pembacaan sensor suhu dan kelembaban dari kumbung jamur hingga dirender menjadi metrik dan grafik interaktif di aplikasi.

```mermaid
flowchart TD
    StartSensor([Siklus Pembacaan Sensor ESP32]) --> ReadHardware[Baca Sensor Suhu & Kelembaban]
    
    ReadHardware --> CheckSensorValid{Sensor Merespons Normal?}
    CheckSensorValid -- Error / NaN --> RetryRead[Coba Baca Ulang Sensor dalam 2 Detik]
    RetryRead --> ReadHardware
    
    CheckSensorValid -- Valid --> BuildPayload["Format JSON Telemetri:<br/>- deviceId<br/>- temperature (°C)<br/>- humidity (%RH)<br/>- uptimeMs<br/>- rssiDbm"]
    
    BuildPayload --> CheckWifi{Koneksi WiFi ESP32?}
    CheckWifi -- Terputus --> ReconnectWifi[Coba Sambung Ulang ke Router]
    ReconnectWifi --> CheckWifi
    
    CheckWifi -- Terhubung --> MqttPublish["ESP32 Publish ke MQTT Broker<br/>Topik: kumbung/{deviceId}/telemetry"]
    
    MqttPublish --> BackendSubscriber[Backend ShroomSync Menerima Pesan MQTT]
    BackendSubscriber --> ValidateDevice{Perangkat Terdaftar di DB?}
    
    ValidateDevice -- Tidak Terdaftar --> DiscardLog[Catat Log Unknown Device & Abaikan]
    ValidateDevice -- Terdaftar --> SaveTelemetry[Simpan Rekaman ke Tabel Telemetry DB]
    
    SaveTelemetry --> UpdateLastSeen[Perbarui Kolom lastSeenAt & Status Online]
    
    subgraph Frontend_App["Aplikasi Web / Android Mobile"]
        PollEngine["Interval Polling / Real-Time Sync<br/>(Setiap 2-5 Detik)"]
        PollEngine --> FetchLatest[Panggil GET /telemetry/latest & /history]
        FetchLatest --> UpdateUI["Perbarui Komponen UI:<br/>1. Kartu Suhu & Kelembaban Terkini<br/>2. Status Badge Online/Offline<br/>3. Grafik Historis Recharts (Area/Bar)<br/>4. Indikator Kualitas Lingkungan Tiram"]
    end
    
    UpdateLastSeen -.-> FetchLatest
```

---

## 5. Flowchart Kontrol Aktuator (Manual, Otomatis, & Penjadwalan)

Sistem ShroomSync mendukung 3 mode operasional kontrol aktuator untuk menjaga kondisi ideal jamur tiram:
1. **Mode Manual**: Tombol langsung ON/OFF dari aplikasi.
2. **Mode Otomatis**: Menyalakan pompa jika kelembaban di bawah batas minimum (*threshold*).
3. **Mode Terjadwal**: Menyalakan penyemprotan kabut pada jam-jam tertentu.

```mermaid
flowchart TD
    StartControl([Evaluasi Kontrol Aktuator]) --> CheckMode{Mode Kontrol Perangkat Aktif?}
    
    %% Mode 1: Manual
    CheckMode -- Mode 1: Manual --> UserToggle[Petani Menekan Toggle di Aplikasi]
    UserToggle --> SendManualCmd["Kirim POST /controls/{id}/action<br/>(payload: mister, fan, atau floorPump ON/OFF)"]
    SendManualCmd --> MqttManualPub["Backend Publish MQTT Command<br/>Topik: kumbung/{id}/command"]
    MqttManualPub --> EspReceiveManual[ESP32 Menerima Perintah]
    EspReceiveManual --> TriggerRelayManual[Ubah Status Pin Relay Aktuator]
    TriggerRelayManual --> AckManual[ESP32 Kirim Status Terkini ke Server]
    
    %% Mode 2: Otomatis
    CheckMode -- Mode 2: Otomatis (Threshold) --> CheckCurrentSensor[Ambil Data Sensor Terkini]
    CheckCurrentSensor --> EvalTempHumidity{"Evaluasi Parameter:<br/>1. Kelembaban < Min Kelembaban?<br/>2. Suhu > Max Suhu?"}
    
    EvalTempHumidity -- Kelembaban Terlalu Rendah --> ActionMistAuto[Nyalakan Pompa Kabut / Mister]
    EvalTempHumidity -- Suhu Terlalu Panas --> ActionFanAuto[Nyalakan Kipas Exhaust Fan]
    EvalTempHumidity -- Kondisi Optimal --> TurnOffAuto[Matikan Aktuator / Standby]
    
    ActionMistAuto --> AutoTimer{"Durasi Timer Aktif<br/>(Misal: 1 Menit 30 Detik)?"}
    AutoTimer -- Waktu Habis --> TurnOffAuto
    AutoTimer -- Masih Berjalan --> KeepRunning[Pertahankan Status Pompa Menyala]
    
    %% Mode 3: Terjadwal
    CheckMode -- Mode 3: Terjadwal (Schedule) --> CheckRTC[Cek Waktu Jam Real-Time RTC/NTP]
    CheckRTC --> MatchSchedule{"Cocok dengan Jadwal?<br/>(Contoh: Jam 07:00, 12:00, 16:30)"}
    
    MatchSchedule -- Tidak Cocok --> StandbySchedule[Standby Menunggu Waktu Jadwal]
    MatchSchedule -- Waktu Cocok --> TriggerScheduleMist[Nyalakan Pompa Penyemprotan Sesuai Durasi]
    TriggerScheduleMist --> WaitScheduleDuration[Hitung Mundur Durasi Timer Semprot]
    WaitScheduleDuration --> StopScheduleMist[Matikan Pompa Kabut & Reset Trigger Hari Ini]
    
    AckManual --> UpdateControlUI[Perbarui Indikator Aktuator di Halaman Kontrol Aplikasi]
    TurnOffAuto --> UpdateControlUI
    StopScheduleMist --> UpdateControlUI
```

---

## 6. Flowchart Siklus Budidaya & Pencatatan Panen

Diagram alur pengelolaan siklus tanam jamur tiram, mulai dari penempatan baglog, pemantauan fase pertumbuhan, hingga rekapitulasi hasil panen.

```mermaid
flowchart TD
    StartCycle([Petani Membuka Menu Siklus & Panen]) --> HasActiveCycle{Ada Siklus Aktif?}
    
    HasActiveCycle -- Tidak Ada --> FormNewCycle[Klik 'Mulai Siklus Baru']
    FormNewCycle --> InputCycleData["Isi Informasi Budidaya:<br/>- Nama Siklus (Batch)<br/>- Jenis Jamur (Tiram Putih/Coklat)<br/>- Jumlah Baglog (Misal: 1500 Baglog)<br/>- Tanggal Mulai Tanam<br/>- Target Estimasi Hasil (Kg)"]
    InputCycleData --> SaveNewCycle[Kirim POST /cycles]
    SaveNewCycle --> ActiveCycleCreated[Siklus Aktif Terdaftar]
    
    HasActiveCycle -- Ada Siklus Aktif --> ViewCycleDetails[Tampilkan Progres Hari & Fase Tanam]
    ActiveCycleCreated --> ViewCycleDetails
    
    ViewCycleDetails --> DailyMonitoring[Pemantauan Harian Suhu & Kelembaban Kumbung]
    DailyMonitoring --> PhaseTransition{"Fase Tanam Berjalan:"}
    
    PhaseTransition --> Phase1["Fase 1: Inkubasi Miselium (Hari 1-30)"]
    Phase1 --> Phase2["Fase 2: Pembentukan Pinhead / Primordia (Hari 31-38)"]
    Phase2 --> Phase3["Fase 3: Pertumbuhan Tubuh Buah Siap Petik"]
    
    Phase3 --> HarvestTime{Jamur Sudah Waktunya Panen?}
    HarvestTime -- Belum --> DailyMonitoring
    
    HarvestTime -- Siap Panen --> ClickAddHarvest[Klik 'Catat Hasil Panen']
    ClickAddHarvest --> InputHarvestForm["Input Data Panen:<br/>- Tanggal & Waktu Petik<br/>- Bobot Panen (Kg)<br/>- Kualitas / Grade (A / B / C)<br/>- Catatan Kondisi Tubuh Buah"]
    
    InputHarvestForm --> SaveHarvest[Kirim POST /cycles/{id}/harvests]
    SaveHarvest --> UpdateCycleStats["Sistem Menghitung Otomatis:<br/>1. Total Akumulasi Panen (Kg)<br/>2. Persentase Biological Efficiency Ratio (BER)<br/>3. Estimasi Pendapatan Penjualan"]
    
    UpdateCycleStats --> MoreHarvests{Baglog Masih Produktif (Flushes Berikutnya)?}
    MoreHarvests -- Masih Produktif (Flash 2, 3, 4) --> DailyMonitoring
    MoreHarvests -- Baglog Afkir / Habis Nutrisi --> CloseCycle[Klik 'Selesaikan Siklus Budidaya']
    
    CloseCycle --> GenerateReport[Sistem Menghasilkan Laporan Evaluasi Siklus]
    GenerateReport --> EndCycleArchive([Siklus Diarsipkan & Siap untuk Siklus Baru])
```

---

## 7. Rangkuman Entitas & Relasi Data

```mermaid
erDiagram
    USERS ||--o{ DEVICES : "memiliki / mengelola"
    USERS ||--o{ MUSHROOM_CYCLES : "mengelola"
    DEVICES ||--o{ TELEMETRY_LOGS : "mencatat"
    DEVICES ||--o| DEVICE_CONFIGS : "memiliki"
    DEVICES ||--o{ CONTROL_LOGS : "menerima perintah"
    MUSHROOM_CYCLES ||--o{ HARVEST_LOGS : "menghasilkan"

    USERS {
        string id PK
        string username
        string email
        string fullName
        string phoneNumber
        string farmName
        string farmAddress
        boolean isFirstLogin
        boolean isProfileCompleted
    }

    DEVICES {
        string id PK
        string deviceId UK
        string name
        string hardwareVersion
        string firmwareVersion
        boolean isOnline
        datetime lastSeenAt
        int rssiDbm
    }

    DEVICE_CONFIGS {
        string id PK
        string deviceId FK
        int controlMode "1:Manual, 2:Auto, 3:Schedule"
        float minSuhu
        float maxSuhu
        float minKelembaban
        float maxKelembaban
        int timerMinute
        int timerSecond
        int schedule1Hour
        int schedule1Minute
    }

    TELEMETRY_LOGS {
        string id PK
        string deviceId FK
        float temperature
        float humidity
        int uptimeMs
        datetime recordedAt
    }

    MUSHROOM_CYCLES {
        string id PK
        string userId FK
        string name
        string strain
        int baglogCount
        date startDate
        date endDate
        string status "active / completed"
    }

    HARVEST_LOGS {
        string id PK
        string cycleId FK
        date harvestDate
        float weightKg
        string grade
        string notes
    }
```

