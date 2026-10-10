/**
 * lib/downloadTask.mjs — keadaan global overlay "menunggu unduhan / menyiapkan berkas".
 *
 * Dipakai semua fitur Nawa Editor setiap kali ada file yang disiapkan atau diunduh
 * (yt-dlp, DOCX/XLSX, CSV, stiker, berkas SIM, cadangan JSON, dsb). Progres unduhan
 * umumnya tidak bisa diketahui persis, jadi overlay menampilkan animasi
 * indeterminate + durasi berjalan; kalau progresnya kebetulan diketahui
 * (mis. antrean playlist) field `progress` 0..1 bisa diisi dan bar deterministik muncul.
 *
 * Hanya sisi klien. Komponennya: <DownloadOverlay /> — dimount sekali di app/layout.js.
 */

export const DOWNLOAD_TASK_TIMING = {
  /** Durasi minimum animasi "working" sebelum beralih ke state sukses/gagal. */
  minWorkMs: 1100,
  /** Seberapa lama state sukses ditahan sebelum overlay tertutup. */
  doneHoldMs: 1500,
  /** Seberapa lama state error ditahan sebelum overlay tertutup. */
  errorHoldMs: 2400,
};

let task = null;
const listeners = new Set();

function emit() {
  for (const listener of listeners) {
    try {
      listener(task);
    } catch {
      /* error listener tidak boleh mengganggu alur unduhan */
    }
  }
}

function setTask(next) {
  task = next;
  emit();
}

function clampProgress(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(1, Math.max(0, n));
}

export function getDownloadTask() {
  return task;
}

export function subscribeDownloadTask(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** true saat ada tugas aktif berfase 'working' (animasi tunggu sedang berjalan). */
export function isDownloadTaskActive() {
  return Boolean(task && task.phase === 'working');
}

/**
 * Mulai overlay "menyiapkan / mengunduh file".
 * @param {string} [label]  Judul utama, mis. `Mengunduh "Lagu.mp3"…`
 * @param {string} [detail] Teks pelengkap, mis. sumber atau nama file.
 * @param {number|null} [progress] Progres yang diketahui (0..1); null = indeterminate.
 * @param {string} [doneDetail] Teks sukses custom (mis. "Media siap diunduh");
 *                              default = "File siap — cek folder Download".
 * @returns {(ok?: boolean) => void} fungsi penutup; panggil sekali (default sukses).
 */
export function startDownloadTask(label = 'Mengunduh file…', detail = '', progress = null, doneDetail = '') {
  setTask({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: String(label || 'Mengunduh file…'),
    detail: String(detail || ''),
    progress: clampProgress(progress),
    doneDetail: String(doneDetail || ''),
    phase: 'working',
    startedAt: Date.now(),
  });
  const current = task;
  return (ok = true) => endTaskOf(current, ok);
}

/**
 * Perbarui overlay yang sedang aktif (label / detail / progress, sebagian boleh).
 * Diabaikan halus bila tidak ada tugas aktif.
 */
export function updateDownloadTask(patch = {}) {
  if (!task || task.phase !== 'working') return;
  setTask({
    ...task,
    label: patch.label !== undefined ? String(patch.label) : task.label,
    detail: patch.detail !== undefined ? String(patch.detail) : task.detail,
    progress: patch.progress === undefined ? task.progress : clampProgress(patch.progress),
    doneDetail: patch.doneDetail !== undefined ? String(patch.doneDetail) : task.doneDetail,
  });
}

function endTaskOf(current, ok) {
  if (task !== current || current.phase !== 'working') return;
  const { minWorkMs, doneHoldMs, errorHoldMs } = DOWNLOAD_TASK_TIMING;
  const wait = Math.max(minWorkMs - (Date.now() - current.startedAt), 0);
  setTimeout(() => {
    // Task lain mungkin sudah menggantikan (klik unduhan berikutnya) — jangan ganggu.
    if (task !== current) return;
    const finished = { ...current, phase: ok ? 'done' : 'error', endedAt: Date.now() };
    setTask(finished);
    setTimeout(() => {
      if (task === finished) setTask(null);
    }, ok ? doneHoldMs : errorHoldMs);
  }, wait);
}

/** Tutup overlay aktif; ok=false menampilkan animasi error sebentar. */
export function endDownloadTask(ok = true) {
  if (!task) return;
  endTaskOf(task, ok);
}

/**
 * Jalankan tugas asinkron dengan overlay tunggu otomatis.
 * Sukses → animasi selesai; gagal → animasi error lalu error di-throw kembali
 * supaya pemanggil tetap bisa menampilkan toast-nya seperti biasa.
 */
export async function runDownloadTask(label, worker, detail = '', doneDetail = '') {
  const end = startDownloadTask(label, detail, null, doneDetail);
  try {
    const result = await worker(end);
    end(true);
    return result;
  } catch (error) {
    end(false);
    throw error;
  }
}

/** Helper khusus test: kembalikan state ke kondisi awal. */
export function __resetDownloadTask() {
  setTask(null);
}
