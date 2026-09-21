import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const TRELLO_API_BASE = 'https://api.trello.com/1';

const boardName = 'ShroomSync Web Frontend Feature Development';
const listNames = [
  'Backlog',
  'Ready for Sprint',
  'In Progress',
  'Code Review',
  'Web QA',
  'Done',
  'Blocked',
];

const labelConfig = {
  'P0 - Core': 'red',
  'P1 - Important': 'orange',
  'P2 - Enhancement': 'yellow',
  Frontend: 'blue',
  'API Integration': 'purple',
  Realtime: 'green',
  'Responsive Web': 'sky',
  'UI/UX': 'pink',
  QA: 'black',
};

const cards = [
  {
    title: '[P0] Dashboard Realtime Kumbung',
    labels: ['P0 - Core', 'Frontend', 'Realtime', 'API Integration', 'Responsive Web'],
    description:
      'Membangun dashboard utama untuk melihat kondisi kumbung secara realtime, termasuk status device, sensor, grafik, dan alert.',
    checklist: [
      'Tampilkan total kumbung aktif.',
      'Tampilkan jumlah kumbung online.',
      'Tampilkan suhu dan kelembaban terbaru.',
      'Tampilkan mode kontrol dan jadwal aktif.',
      'Integrasikan latest sensor dari API.',
      'Integrasikan event realtime dari socket.',
      'Tambahkan grafik suhu dan kelembaban.',
      'Tambahkan daftar notifikasi terbaru.',
      'Tambahkan loading state.',
      'Tambahkan empty state.',
      'Tambahkan error state.',
      'Pastikan layout responsive di 375px, 768px, 1366px, dan 1920px.',
    ],
    acceptance: [
      'Dashboard tetap terbaca di layar 375px.',
      'Data berubah otomatis saat ada event realtime.',
      'Jika API gagal, user mendapat pesan error yang jelas.',
      'Tidak ada horizontal scroll pada viewport utama.',
    ],
  },
  {
    title: '[P0] Manajemen Kumbung',
    labels: ['P0 - Core', 'Frontend', 'API Integration', 'Responsive Web'],
    description:
      'Membangun halaman pengelolaan kumbung untuk menambah, melihat, memilih, dan menghapus device/kumbung.',
    checklist: [
      'Tampilkan daftar kumbung dari API.',
      'Tambah kumbung baru.',
      'Hapus kumbung dengan modal konfirmasi.',
      'Pilih kumbung aktif untuk halaman lain.',
      'Tampilkan status online/offline.',
      'Tampilkan hardware version dan firmware version bila tersedia.',
      'Tambahkan action menu: detail, monitoring, siklus, firmware.',
      'Refresh data setelah tambah atau hapus kumbung.',
      'Tambahkan loading, empty, dan error state.',
    ],
    acceptance: [
      'User bisa menambah kumbung tanpa reload manual.',
      'User bisa menghapus kumbung setelah konfirmasi.',
      'Device yang dipilih konsisten di Dashboard, Monitoring, Kontrol, dan Siklus.',
      'Tabel tetap usable di layar kecil.',
    ],
  },
  {
    title: '[P0] Monitoring Sensor & Riwayat',
    labels: ['P0 - Core', 'Frontend', 'Realtime', 'API Integration', 'Responsive Web'],
    description:
      'Membangun halaman monitoring sensor dan histori aktivitas device berdasarkan kumbung yang dipilih.',
    checklist: [
      'Tampilkan suhu terbaru.',
      'Tampilkan kelembaban terbaru.',
      'Tampilkan grafik histori sensor.',
      'Tampilkan riwayat telemetry history.',
      'Tambahkan filter rentang waktu.',
      'Integrasikan update realtime dari socket.',
      'Tambahkan fallback polling jika socket tidak aktif.',
      'Tampilkan informasi device aktif.',
      'Tambahkan loading, empty, dan error state.',
    ],
    acceptance: [
      'Grafik tidak overflow di mobile web.',
      'Data terbaru tampil setelah API atau socket mengirim data.',
      'User bisa mengganti kumbung yang dimonitor.',
      'Riwayat aktivitas tetap terbaca pada layar kecil.',
    ],
  },
  {
    title: '[P0] Kontrol Device',
    labels: ['P0 - Core', 'Frontend', 'API Integration', 'UI/UX'],
    description:
      'Membangun halaman kontrol untuk mode operasi, setpoint, aktuator, timer, dan jadwal penyiraman.',
    checklist: [
      'Pilih mode kontrol: Manual, Auto, Hybrid.',
      'Update setpoint suhu.',
      'Update setpoint kelembaban.',
      'Kontrol manual pump.',
      'Kontrol manual fan.',
      'Update timer spray.',
      'Update timer floor.',
      'Update jadwal spray.',
      'Update jadwal floor.',
      'Validasi input angka.',
      'Validasi input jam dan menit.',
      'Disable kontrol manual saat mode tidak mengizinkan.',
      'Tampilkan toast sukses dan gagal.',
    ],
    acceptance: [
      'Setiap perubahan sukses menampilkan feedback.',
      'Jika API gagal, state UI tidak terlihat seolah berhasil.',
      'Form tidak bisa submit dengan input tidak valid.',
      'Kontrol tetap nyaman digunakan di desktop dan mobile web.',
    ],
  },
  {
    title: '[P0] Siklus & Panen',
    labels: ['P0 - Core', 'Frontend', 'API Integration', 'Responsive Web'],
    description: 'Membangun pengelolaan siklus budidaya dan pencatatan panen per kumbung.',
    checklist: [
      'Buat siklus baru per kumbung.',
      'Tampilkan daftar siklus aktif.',
      'Tampilkan daftar siklus selesai.',
      'Pilih siklus aktif.',
      'Tampilkan ringkasan umur siklus.',
      'Tampilkan ringkasan produksi.',
      'Tambah data panen.',
      'Edit data panen.',
      'Hapus data panen.',
      'Selesaikan siklus dengan tanggal selesai dan catatan.',
      'Tambahkan loading, empty, dan error state.',
    ],
    acceptance: [
      'Semua data siklus terikat ke deviceId.',
      'Ringkasan panen berubah setelah tambah, edit, atau hapus panen.',
      'User tidak bisa mencatat panen tanpa memilih siklus.',
      'Layout tabel panen tetap usable di viewport kecil.',
    ],
  },
  {
    title: '[P0] Stabilitas API Client & Error Handling',
    labels: ['P0 - Core', 'API Integration', 'QA'],
    description:
      'Menstandarkan cara frontend memanggil API, membaca response, dan menampilkan error agar semua halaman lebih stabil.',
    checklist: [
      'Standarkan unwrap response API.',
      'Tangani error 400.',
      'Tangani error 404.',
      'Tangani error 429.',
      'Tangani error 500.',
      'Tangani network offline.',
      'Tambahkan pesan error yang user-friendly.',
      'Pastikan loading state konsisten.',
      'Pastikan environment web development dan production jelas.',
      'Audit penggunaan service layer.',
    ],
    acceptance: [
      'Tidak ada halaman blank saat API gagal.',
      'Error teknis tidak bocor mentah ke user.',
      'Response API yang berbeda format tetap ditangani secara aman.',
      'Build web tetap berhasil.',
    ],
  },
  {
    title: '[P1] Jadwal Otomatis Berbasis BMKG',
    labels: ['P1 - Important', 'Frontend', 'API Integration', 'UI/UX'],
    description: 'Membangun fitur rekomendasi jadwal penyiraman berdasarkan data cuaca BMKG.',
    checklist: [
      'Ambil data cuaca BMKG berdasarkan lokasi device.',
      'Parsing kondisi cuaca.',
      'Hitung rekomendasi frekuensi penyiraman.',
      'Simpan cache cuaca per device.',
      'Tambahkan tombol refresh cuaca.',
      'Tampilkan sumber data cuaca.',
      'Tampilkan waktu update terakhir.',
      'Tampilkan alasan rekomendasi.',
      'Berikan fallback jika BMKG gagal.',
    ],
    acceptance: [
      'User bisa melihat kondisi cuaca dan rekomendasi jadwal.',
      'Jika BMKG gagal, kontrol jadwal manual tetap bisa digunakan.',
      'Rekomendasi tidak langsung mengirim perubahan tanpa konfirmasi user.',
    ],
  },
  {
    title: '[P1] OTA Firmware Update via Web',
    labels: ['P1 - Important', 'Frontend', 'API Integration'],
    description: 'Membangun form trigger OTA firmware dari halaman web untuk device tertentu.',
    checklist: [
      'Tambahkan form firmware per device.',
      'Input URL firmware.',
      'Input versi firmware.',
      'Input checksum opsional.',
      'Opsi force update.',
      'Validasi field wajib.',
      'Kirim trigger OTA ke API.',
      'Tampilkan feedback sukses dan gagal.',
      'Siapkan slot untuk log OTA di iterasi berikutnya.',
    ],
    acceptance: [
      'User tidak bisa submit tanpa URL dan versi firmware.',
      'Error API OTA tampil jelas.',
      'Trigger OTA hanya dikirim ke device yang dipilih.',
    ],
  },
  {
    title: '[P1] Pusat Notifikasi',
    labels: ['P1 - Important', 'Frontend', 'Realtime', 'UI/UX'],
    description:
      'Membangun pusat notifikasi web untuk alert sensor, status device, dan aktivitas sistem.',
    checklist: [
      'Tampilkan notifikasi suhu tinggi.',
      'Tampilkan notifikasi kelembaban rendah.',
      'Tampilkan notifikasi device offline.',
      'Tampilkan notifikasi kondisi kembali normal.',
      'Tambahkan filter Semua.',
      'Tambahkan filter Warning.',
      'Tambahkan filter Error.',
      'Tambahkan filter Success.',
      'Hubungkan notifikasi dengan alert Dashboard.',
      'Tambahkan status read/unread.',
      'Tambahkan empty state.',
    ],
    acceptance: [
      'Notifikasi realtime muncul tanpa reload.',
      'Filter bekerja di desktop dan mobile web.',
      'User bisa membedakan notifikasi baru dan lama.',
    ],
  },
  {
    title: '[P1] Analitik Kumbung',
    labels: ['P1 - Important', 'Frontend', 'UI/UX', 'Responsive Web'],
    description:
      'Membangun halaman analitik untuk memahami performa kumbung, tren sensor, dan produktivitas panen.',
    checklist: [
      'Tampilkan tren suhu per rentang waktu.',
      'Tampilkan tren kelembaban per rentang waktu.',
      'Tampilkan performa panen per siklus.',
      'Tampilkan perbandingan antar kumbung.',
      'Tambahkan metrik produktivitas.',
      'Tambahkan filter rentang waktu.',
      'Tambahkan empty state jika data belum tersedia.',
      'Pastikan grafik responsive.',
    ],
    acceptance: [
      'User bisa memahami performa kumbung tanpa membuka data mentah.',
      'Grafik tetap terbaca di desktop dan mobile web.',
      'Data analitik tidak rusak saat salah satu sumber data kosong.',
    ],
  },
  {
    title: '[P2] Profil & Preferensi',
    labels: ['P2 - Enhancement', 'Frontend', 'UI/UX'],
    description: 'Membangun halaman profil dan preferensi dasar untuk user web.',
    checklist: [
      'Tampilkan informasi profil.',
      'Edit informasi profil.',
      'Atur preferensi notifikasi.',
      'Atur preferensi email jika backend tersedia.',
      'Simpan preferensi ke API atau localStorage sesuai dukungan backend.',
      'Tambahkan feedback sukses dan gagal.',
    ],
    acceptance: [
      'Perubahan preferensi tersimpan setelah refresh.',
      'User mendapat feedback saat update berhasil atau gagal.',
    ],
  },
  {
    title: '[P0] QA Responsive Web',
    labels: ['P0 - Core', 'Responsive Web', 'QA'],
    description:
      'Melakukan QA khusus web browser untuk memastikan seluruh halaman utama stabil dan responsive.',
    checklist: [
      'Test Dashboard di 375px, 768px, 1366px, dan 1920px.',
      'Test Kumbung di 375px, 768px, 1366px, dan 1920px.',
      'Test Monitoring di 375px, 768px, 1366px, dan 1920px.',
      'Test Siklus & Panen di 375px, 768px, 1366px, dan 1920px.',
      'Test Kontrol di 375px, 768px, 1366px, dan 1920px.',
      'Test Analitik di 375px, 768px, 1366px, dan 1920px.',
      'Test Notifikasi di 375px, 768px, 1366px, dan 1920px.',
      'Test Profil di 375px, 768px, 1366px, dan 1920px.',
      'Pastikan tidak ada horizontal scroll.',
      'Pastikan table responsive tetap terbaca.',
      'Pastikan chart tetap terbaca.',
      'Pastikan sidebar/menu responsive berjalan.',
      'Jalankan npm run lint.',
      'Jalankan npm run build.',
    ],
    acceptance: [
      'Web build berhasil.',
      'Semua halaman utama bisa digunakan di browser.',
      'Tidak ada task APK, Android, atau Capacitor dalam QA ini.',
      'Tidak ada horizontal scroll pada halaman utama.',
    ],
  },
];

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};

  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).reduce((env, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return env;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) return env;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
    return env;
  }, {});
};

const localEnv = parseEnvFile(path.resolve(process.cwd(), '.env.trello.local'));
const env = { ...localEnv, ...process.env };

const requiredEnv = ['TRELLO_KEY', 'TRELLO_TOKEN'];
const missingEnv = requiredEnv.filter((key) => !env[key]);

if (missingEnv.length > 0) {
  console.error(`Missing required env: ${missingEnv.join(', ')}`);
  console.error('Create .env.trello.local from .env.trello.example, then run again.');
  process.exit(1);
}

const dryRun = env.TRELLO_DRY_RUN === '1' || env.TRELLO_DRY_RUN === 'true';
const requestTimeoutMs = Number(env.TRELLO_TIMEOUT_MS || 20000);
const retryableStatusCodes = new Set([429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const describeFetchCause = (error) => {
  const cause = error?.cause;
  if (!cause) return error.message;

  const parts = [
    cause.code,
    cause.syscall,
    cause.hostname ? `host=${cause.hostname}` : null,
    cause.address ? `address=${cause.address}` : null,
    cause.port ? `port=${cause.port}` : null,
    cause.message,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' | ') : error.message;
};

const apiRequest = async (method, resource, params = {}, options = {}) => {
  const url = new URL(`${TRELLO_API_BASE}${resource}`);
  url.searchParams.set('key', env.TRELLO_KEY);
  url.searchParams.set('token', env.TRELLO_TOKEN);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  if (dryRun && method !== 'GET') {
    console.log(`[dry-run] ${method} ${resource}`);
    return { id: `dry-run-${Math.random().toString(36).slice(2)}`, name: params.name };
  }

  const maxAttempts = options.attempts || 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : null;

      if (!response.ok) {
        const message = data?.message || data || response.statusText;
        const error = new Error(`${method} ${resource} failed (${response.status}): ${message}`);
        error.status = response.status;
        throw error;
      }

      return data;
    } catch (error) {
      const isAbort = error.name === 'AbortError';
      const isRetryableStatus = retryableStatusCodes.has(error.status);
      const isNetworkError = error.message === 'fetch failed' || error.cause || isAbort;
      lastError = error;

      if (attempt >= maxAttempts || (!isNetworkError && !isRetryableStatus)) {
        const reason = isAbort ? `timeout after ${requestTimeoutMs}ms` : describeFetchCause(error);
        throw new Error(`${method} ${resource} request failed: ${reason}`);
      }

      const waitMs = 750 * attempt;
      console.log(`${method} ${resource} failed, retrying in ${waitMs}ms (${attempt}/${maxAttempts})`);
      await sleep(waitMs);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
};

const getOrCreateBoard = async () => {
  if (env.TRELLO_BOARD_ID) {
    const board = await apiRequest('GET', `/boards/${env.TRELLO_BOARD_ID}`, {
      fields: 'id,name,url',
    });
    console.log(`Using existing board: ${board.name}`);
    return board;
  }

  const targetBoardName = env.TRELLO_BOARD_NAME || boardName;
  const existingBoards = dryRun
    ? []
    : await apiRequest('GET', '/members/me/boards', {
      fields: 'id,name,url',
      filter: 'open',
    });
  const existingBoard = existingBoards.find((board) => board.name === targetBoardName);

  if (existingBoard) {
    console.log(`Using existing board by name: ${existingBoard.name}`);
    return existingBoard;
  }

  const board = await apiRequest('POST', '/boards', {
    name: targetBoardName,
    defaultLists: 'false',
    idOrganization: env.TRELLO_WORKSPACE_ID,
  });
  console.log(`Created board: ${board.name}`);
  return board;
};

const getOrCreateLists = async (boardId) => {
  const existingLists = dryRun
    ? []
    : await apiRequest('GET', `/boards/${boardId}/lists`, { fields: 'id,name', filter: 'open' });
  const listsByName = new Map(existingLists.map((list) => [list.name, list]));

  for (const name of listNames) {
    if (!listsByName.has(name)) {
      const list = await apiRequest('POST', '/lists', { idBoard: boardId, name, pos: 'bottom' });
      listsByName.set(name, list);
      console.log(`Created list: ${name}`);
    } else {
      console.log(`List exists: ${name}`);
    }
  }

  return listsByName;
};

const getOrCreateLabels = async (boardId) => {
  const existingLabels = dryRun
    ? []
    : await apiRequest('GET', `/boards/${boardId}/labels`, { fields: 'id,name,color', limit: 1000 });
  const labelsByName = new Map(existingLabels.filter((label) => label.name).map((label) => [label.name, label]));

  for (const [name, color] of Object.entries(labelConfig)) {
    if (!labelsByName.has(name)) {
      const label = await apiRequest('POST', '/labels', { idBoard: boardId, name, color });
      labelsByName.set(name, label);
      console.log(`Created label: ${name}`);
    } else {
      console.log(`Label exists: ${name}`);
    }
  }

  return labelsByName;
};

const createChecklist = async (cardId, name, items) => {
  const checklist = await apiRequest('POST', `/cards/${cardId}/checklists`, { name });

  for (const item of items) {
    await apiRequest('POST', `/checklists/${checklist.id}/checkItems`, {
      name: item,
      pos: 'bottom',
    });
  }
};

const createCards = async ({ boardId, backlogListId, labelsByName }) => {
  const existingCards = dryRun
    ? []
    : await apiRequest('GET', `/boards/${boardId}/cards`, { fields: 'id,name', filter: 'open' });
  const existingCardTitles = new Set(existingCards.map((card) => card.name));

  for (const card of cards) {
    if (existingCardTitles.has(card.title)) {
      console.log(`Card exists, skipped: ${card.title}`);
      continue;
    }

    const idLabels = card.labels
      .map((labelName) => labelsByName.get(labelName)?.id)
      .filter(Boolean)
      .join(',');
    const createdCard = await apiRequest('POST', '/cards', {
      idList: backlogListId,
      name: card.title,
      desc: card.description,
      idLabels,
      pos: 'bottom',
    });

    await createChecklist(createdCard.id, 'Checklist', card.checklist);
    await createChecklist(createdCard.id, 'Acceptance criteria', card.acceptance);
    console.log(`Created card: ${card.title}`);
  }
};

try {
  const board = await getOrCreateBoard();
  const listsByName = await getOrCreateLists(board.id);
  const labelsByName = await getOrCreateLabels(board.id);
  await createCards({
    boardId: board.id,
    backlogListId: listsByName.get('Backlog').id,
    labelsByName,
  });

  console.log(`Done. Board URL: ${board.url || `https://trello.com/b/${board.id}`}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
