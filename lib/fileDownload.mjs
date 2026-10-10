/**
 * lib/fileDownload.mjs — unduh berkas dari browser (tanpa server).
 * Hanya dipakai di sisi klien.
 *
 * Setiap unduhan otomatis menampilkan overlay tunggu global
 * (lihat lib/downloadTask.mjs + components/DownloadOverlay.js) dengan animasi
 * indeterminate + durasi berjalan, karena progres unduhan umumnya tak diketahui.
 * Jika unduhan ini merupakan bagian dari tugas yang sudah dimulai lewat
 * startDownloadTask/runDownloadTask (mis. unduhan yt-dlp atau pembuatan DOCX),
 * overlay yang ada dipakai ulang — tidak ada animasi ganda.
 */

import {
  isDownloadTaskActive,
  startDownloadTask,
  updateDownloadTask,
} from './downloadTask.mjs';

/**
 * @param {object} [options]
 * @param {boolean} [options.quiet] Lewati overlay tunggu (untuk alur yang sudah
 * punya animasi progresnya sendiri, mis. antrean playlist berurutan).
 */
export function downloadBlob(blob, filename, options = {}) {
  let end = null;
  if (!options.quiet) {
    const joined = isDownloadTaskActive();
    end = joined ? null : startDownloadTask(`Mengunduh ${filename}`, 'Menyimpan file ke perangkatmu…');
    if (joined) updateDownloadTask({ detail: 'Menyimpan file ke perangkatmu…' });
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  if (end) end(true);
}

export function downloadText(text, filename, mime = 'text/plain;charset=utf-8') {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

/** Nama berkas aman: huruf kecil, angka, tanda hubung. */
export function safeFileName(value, fallback = 'nawa-editor') {
  const cleaned = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return cleaned || fallback;
}
