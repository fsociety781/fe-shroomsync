# ShroomSync Web Frontend Feature Development

Dokumen ini disiapkan untuk dipindahkan ke Trello sebagai backlog feature web frontend.
Fokus: web saja. Tidak ada scope APK, Android, Capacitor sync, atau mobile build.

## Board

Nama board:

```text
ShroomSync Web Frontend Feature Development
```

## Lists

```text
Backlog
Ready for Sprint
In Progress
Code Review
Web QA
Done
Blocked
```

## Labels

```text
P0 - Core
P1 - Important
P2 - Enhancement
Frontend
API Integration
Realtime
Responsive Web
UI/UX
QA
```

## Sprint Plan

Sprint 1:
- Dashboard Realtime Kumbung
- Manajemen Kumbung
- Monitoring Sensor & Riwayat
- Stabilitas API Client & Error Handling

Sprint 2:
- Kontrol Device
- Siklus & Panen
- QA Responsive Web

Sprint 3:
- Jadwal Otomatis Berbasis BMKG
- OTA Firmware Update via Web
- Pusat Notifikasi

Sprint 4:
- Analitik Kumbung
- Profil & Preferensi
- Web polish

## Cards

### [P0] Dashboard Realtime Kumbung

Labels:
P0 - Core, Frontend, Realtime, API Integration, Responsive Web

Description:
Membangun dashboard utama untuk melihat kondisi kumbung secara realtime, termasuk status device, sensor, grafik, dan alert.

Checklist:
- Tampilkan total kumbung aktif.
- Tampilkan jumlah kumbung online.
- Tampilkan suhu dan kelembaban terbaru.
- Tampilkan mode kontrol dan jadwal aktif.
- Integrasikan latest sensor dari API.
- Integrasikan event realtime dari socket.
- Tambahkan grafik suhu dan kelembaban.
- Tambahkan daftar notifikasi terbaru.
- Tambahkan loading state.
- Tambahkan empty state.
- Tambahkan error state.
- Pastikan layout responsive di 375px, 768px, 1366px, dan 1920px.

Acceptance criteria:
- Dashboard tetap terbaca di layar 375px.
- Data berubah otomatis saat ada event realtime.
- Jika API gagal, user mendapat pesan error yang jelas.
- Tidak ada horizontal scroll pada viewport utama.

### [P0] Manajemen Kumbung

Labels:
P0 - Core, Frontend, API Integration, Responsive Web

Description:
Membangun halaman pengelolaan kumbung untuk menambah, melihat, memilih, dan menghapus device/kumbung.

Checklist:
- Tampilkan daftar kumbung dari API.
- Tambah kumbung baru.
- Hapus kumbung dengan modal konfirmasi.
- Pilih kumbung aktif untuk halaman lain.
- Tampilkan status online/offline.
- Tampilkan hardware version dan firmware version bila tersedia.
- Tambahkan action menu: detail, monitoring, siklus, firmware.
- Refresh data setelah tambah atau hapus kumbung.
- Tambahkan loading, empty, dan error state.

Acceptance criteria:
- User bisa menambah kumbung tanpa reload manual.
- User bisa menghapus kumbung setelah konfirmasi.
- Device yang dipilih konsisten di Dashboard, Monitoring, Kontrol, dan Siklus.
- Tabel tetap usable di layar kecil.

### [P0] Monitoring Sensor & Riwayat

Labels:
P0 - Core, Frontend, Realtime, API Integration, Responsive Web

Description:
Membangun halaman monitoring sensor dan histori aktivitas device berdasarkan kumbung yang dipilih.

Checklist:
- Tampilkan suhu terbaru.
- Tampilkan kelembaban terbaru.
- Tampilkan grafik histori sensor.
- Tampilkan riwayat telemetry history.
- Tambahkan filter rentang waktu.
- Integrasikan update realtime dari socket.
- Tambahkan fallback polling jika socket tidak aktif.
- Tampilkan informasi device aktif.
- Tambahkan loading, empty, dan error state.

Acceptance criteria:
- Grafik tidak overflow di mobile web.
- Data terbaru tampil setelah API atau socket mengirim data.
- User bisa mengganti kumbung yang dimonitor.
- Riwayat aktivitas tetap terbaca pada layar kecil.

### [P0] Kontrol Device

Labels:
P0 - Core, Frontend, API Integration, UI/UX

Description:
Membangun halaman kontrol untuk mode operasi, setpoint, aktuator, timer, dan jadwal penyiraman.

Checklist:
- Pilih mode kontrol: Manual, Auto, Hybrid.
- Update setpoint suhu.
- Update setpoint kelembaban.
- Kontrol manual pump.
- Kontrol manual fan.
- Update timer spray.
- Update timer floor.
- Update jadwal spray.
- Update jadwal floor.
- Validasi input angka.
- Validasi input jam dan menit.
- Disable kontrol manual saat mode tidak mengizinkan.
- Tampilkan toast sukses dan gagal.

Acceptance criteria:
- Setiap perubahan sukses menampilkan feedback.
- Jika API gagal, state UI tidak terlihat seolah berhasil.
- Form tidak bisa submit dengan input tidak valid.
- Kontrol tetap nyaman digunakan di desktop dan mobile web.

### [P0] Siklus & Panen

Labels:
P0 - Core, Frontend, API Integration, Responsive Web

Description:
Membangun pengelolaan siklus budidaya dan pencatatan panen per kumbung.

Checklist:
- Buat siklus baru per kumbung.
- Tampilkan daftar siklus aktif.
- Tampilkan daftar siklus selesai.
- Pilih siklus aktif.
- Tampilkan ringkasan umur siklus.
- Tampilkan ringkasan produksi.
- Tambah data panen.
- Edit data panen.
- Hapus data panen.
- Selesaikan siklus dengan tanggal selesai dan catatan.
- Tambahkan loading, empty, dan error state.

Acceptance criteria:
- Semua data siklus terikat ke deviceId.
- Ringkasan panen berubah setelah tambah, edit, atau hapus panen.
- User tidak bisa mencatat panen tanpa memilih siklus.
- Layout tabel panen tetap usable di viewport kecil.

### [P0] Stabilitas API Client & Error Handling

Labels:
P0 - Core, API Integration, QA

Description:
Menstandarkan cara frontend memanggil API, membaca response, dan menampilkan error agar semua halaman lebih stabil.

Checklist:
- Standarkan unwrap response API.
- Tangani error 400.
- Tangani error 404.
- Tangani error 429.
- Tangani error 500.
- Tangani network offline.
- Tambahkan pesan error yang user-friendly.
- Pastikan loading state konsisten.
- Pastikan environment web development dan production jelas.
- Audit penggunaan service layer.

Acceptance criteria:
- Tidak ada halaman blank saat API gagal.
- Error teknis tidak bocor mentah ke user.
- Response API yang berbeda format tetap ditangani secara aman.
- Build web tetap berhasil.

### [P1] Jadwal Otomatis Berbasis BMKG

Labels:
P1 - Important, Frontend, API Integration, UI/UX

Description:
Membangun fitur rekomendasi jadwal penyiraman berdasarkan data cuaca BMKG.

Checklist:
- Ambil data cuaca BMKG berdasarkan lokasi device.
- Parsing kondisi cuaca.
- Hitung rekomendasi frekuensi penyiraman.
- Simpan cache cuaca per device.
- Tambahkan tombol refresh cuaca.
- Tampilkan sumber data cuaca.
- Tampilkan waktu update terakhir.
- Tampilkan alasan rekomendasi.
- Berikan fallback jika BMKG gagal.

Acceptance criteria:
- User bisa melihat kondisi cuaca dan rekomendasi jadwal.
- Jika BMKG gagal, kontrol jadwal manual tetap bisa digunakan.
- Rekomendasi tidak langsung mengirim perubahan tanpa konfirmasi user.

### [P1] OTA Firmware Update via Web

Labels:
P1 - Important, Frontend, API Integration

Description:
Membangun form trigger OTA firmware dari halaman web untuk device tertentu.

Checklist:
- Tambahkan form firmware per device.
- Input URL firmware.
- Input versi firmware.
- Input checksum opsional.
- Opsi force update.
- Validasi field wajib.
- Kirim trigger OTA ke API.
- Tampilkan feedback sukses dan gagal.
- Siapkan slot untuk log OTA di iterasi berikutnya.

Acceptance criteria:
- User tidak bisa submit tanpa URL dan versi firmware.
- Error API OTA tampil jelas.
- Trigger OTA hanya dikirim ke device yang dipilih.

### [P1] Pusat Notifikasi

Labels:
P1 - Important, Frontend, Realtime, UI/UX

Description:
Membangun pusat notifikasi web untuk alert sensor, status device, dan aktivitas sistem.

Checklist:
- Tampilkan notifikasi suhu tinggi.
- Tampilkan notifikasi kelembaban rendah.
- Tampilkan notifikasi device offline.
- Tampilkan notifikasi kondisi kembali normal.
- Tambahkan filter Semua.
- Tambahkan filter Warning.
- Tambahkan filter Error.
- Tambahkan filter Success.
- Hubungkan notifikasi dengan alert Dashboard.
- Tambahkan status read/unread.
- Tambahkan empty state.

Acceptance criteria:
- Notifikasi realtime muncul tanpa reload.
- Filter bekerja di desktop dan mobile web.
- User bisa membedakan notifikasi baru dan lama.

### [P1] Analitik Kumbung

Labels:
P1 - Important, Frontend, UI/UX, Responsive Web

Description:
Membangun halaman analitik untuk memahami performa kumbung, tren sensor, dan produktivitas panen.

Checklist:
- Tampilkan tren suhu per rentang waktu.
- Tampilkan tren kelembaban per rentang waktu.
- Tampilkan performa panen per siklus.
- Tampilkan perbandingan antar kumbung.
- Tambahkan metrik produktivitas.
- Tambahkan filter rentang waktu.
- Tambahkan empty state jika data belum tersedia.
- Pastikan grafik responsive.

Acceptance criteria:
- User bisa memahami performa kumbung tanpa membuka data mentah.
- Grafik tetap terbaca di desktop dan mobile web.
- Data analitik tidak rusak saat salah satu sumber data kosong.

### [P2] Profil & Preferensi

Labels:
P2 - Enhancement, Frontend, UI/UX

Description:
Membangun halaman profil dan preferensi dasar untuk user web.

Checklist:
- Tampilkan informasi profil.
- Edit informasi profil.
- Atur preferensi notifikasi.
- Atur preferensi email jika backend tersedia.
- Simpan preferensi ke API atau localStorage sesuai dukungan backend.
- Tambahkan feedback sukses dan gagal.

Acceptance criteria:
- Perubahan preferensi tersimpan setelah refresh.
- User mendapat feedback saat update berhasil atau gagal.

### [P0] QA Responsive Web

Labels:
P0 - Core, Responsive Web, QA

Description:
Melakukan QA khusus web browser untuk memastikan seluruh halaman utama stabil dan responsive.

Checklist:
- Test Dashboard di 375px, 768px, 1366px, dan 1920px.
- Test Kumbung di 375px, 768px, 1366px, dan 1920px.
- Test Monitoring di 375px, 768px, 1366px, dan 1920px.
- Test Siklus & Panen di 375px, 768px, 1366px, dan 1920px.
- Test Kontrol di 375px, 768px, 1366px, dan 1920px.
- Test Analitik di 375px, 768px, 1366px, dan 1920px.
- Test Notifikasi di 375px, 768px, 1366px, dan 1920px.
- Test Profil di 375px, 768px, 1366px, dan 1920px.
- Pastikan tidak ada horizontal scroll.
- Pastikan table responsive tetap terbaca.
- Pastikan chart tetap terbaca.
- Pastikan sidebar/menu responsive berjalan.
- Jalankan npm run lint.
- Jalankan npm run build.

Acceptance criteria:
- Web build berhasil.
- Semua halaman utama bisa digunakan di browser.
- Tidak ada task APK, Android, atau Capacitor dalam QA ini.
- Tidak ada horizontal scroll pada halaman utama.
