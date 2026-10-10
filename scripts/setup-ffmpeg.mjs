#!/usr/bin/env node
/**
 * scripts/setup-ffmpeg.mjs — menyiapkan binari FFmpeg statis di `bin/ffmpeg` untuk mesin server.
 *
 * Dijalankan otomatis via `postinstall`, `predev`, dan `prebuild` (termasuk build di Vercel).
 * Berkas `bin/ffmpeg` lalu di-trace ke function `/api/ytdlp` lewat `outputFileTracingIncludes`
 * di `next.config.js`. Tanpa langkah ini, FFmpeg tidak ikut ke serverless function dan
 * semua unduhan (konversi MP3/M4A/FLAC/MP4) akan dinonaktifkan.
 *
 * Urutan sumber (sama dengan runtime, lihat `ffmpegCandidates` di lib/ffmpegRuntime.mjs):
 *   1. env `FFMPEG_PATH` (jika diset)
 *   2. paket `@ffmpeg-installer/<os>-<arch>` (binari statis, cocok untuk serverless)
 *   3. PATH sistem (biasanya dinamis; hanya dipakai bila lolos verifikasi)
 *
 * Setiap kandidat HARUS lolos `ffmpeg -version` dan memiliki encoder wajib (libmp3lame, aac).
 * Skrip ini tidak pernah menggagalkan install/build (selalu exit 0); bila gagal, hanya peringatan
 * dan halaman downloader akan menonaktifkan aksi unduh dengan diagnosis yang jelas.
 */

import fs from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ffmpegCandidates, probeFfmpegBinary } from '../lib/ffmpegRuntime.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN_PATH = path.join(projectRoot, 'bin', 'ffmpeg');

async function main() {
  if (existsSync(BIN_PATH)) {
    const existing = await probeFfmpegBinary(BIN_PATH);
    if (existing.ok) {
      console.log(`[setup:ffmpeg] Siap: bin/ffmpeg (${existing.version}) sudah terpasang, dilewati.`);
      return;
    }
    console.log(`[setup:ffmpeg] bin/ffmpeg ada tapi tidak lolos verifikasi (${existing.reason}); mencari ulang.`);
    await fs.rm(BIN_PATH, { force: true });
  }

  const candidates = ffmpegCandidates({ projectRoot, cwd: projectRoot });
  const rejected = [];
  for (const candidate of candidates) {
    if (path.resolve(candidate.path) === path.resolve(BIN_PATH)) continue;
    if (!existsSync(candidate.path) || !statSync(candidate.path).isFile()) continue;
    const probe = await probeFfmpegBinary(candidate.path);
    if (!probe.ok) {
      rejected.push(`${candidate.source}: ${probe.reason}`);
      continue;
    }
    await fs.mkdir(path.dirname(BIN_PATH), { recursive: true });
    const tmp = `${BIN_PATH}.tmp-${process.pid}`;
    await fs.copyFile(candidate.path, tmp);
    await fs.chmod(tmp, 0o755);
    await fs.rename(tmp, BIN_PATH);
    const sizeMb = (statSync(BIN_PATH).size / 1024 / 1024).toFixed(1);
    console.log(`[setup:ffmpeg] Berhasil: bin/ffmpeg dari ${candidate.source} (${probe.version}, ${sizeMb} MB).`);
    return;
  }

  console.warn('[setup:ffmpeg] PERINGATAN: FFmpeg yang bisa dijalankan tidak ditemukan.');
  for (const line of rejected) console.warn(`[setup:ffmpeg]   - ditolak ${line}`);
  console.warn(
    '[setup:ffmpeg] Unduhan audio/video akan dinonaktifkan sampai bin/ffmpeg tersedia. ' +
      'Pasang paket @ffmpeg-installer/<os>-<arch> (npm install) atau set FFMPEG_PATH.'
  );
}

try {
  await main();
} catch (err) {
  console.warn(`[setup:ffmpeg] Gagal menyiapkan FFmpeg: ${err?.message || err}`);
}
