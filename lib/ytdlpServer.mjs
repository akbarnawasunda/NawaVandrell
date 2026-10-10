/**
 * lib/ytdlpServer.mjs — eksekutor server-side yt-dlp + FFmpeg untuk Nawa Editor.
 *
 * Menangani:
 *  1. Penyiapan & VERIFIKASI binari `yt-dlp` dan `ffmpeg` di `/tmp/nawa-ytdlp-bin`
 *     (setiap kandidat dijalankan dulu; berkas yang ada tapi tidak bisa dieksekusi ditolak).
 *  2. Pemeriksaan metadata (`inspectWithYtdlp`) untuk lagu tunggal, video, maupun playlist.
 *  3. Pengunduhan (`downloadWithYtdlp`) dengan tiga jalur yang JELAS dan TERPISAH:
 *       - Demo eksplisit (`demo:*`) → aset contoh yang dibuat FFmpeg, diberi label demo.
 *       - Stream nyata dari browser (`clientStreamBase64`) → dikonversi FFmpeg langsung.
 *         Lagu dari pencarian/Spotify memakai pratinjau 30 detik dari iTunes dan diberi label Preview.
 *       - URL publik → yt-dlp langsung. Bila gagal, error NYATA dikembalikan (tanpa fallback sintetis).
 *  4. Pengemasan hasil: satu berkas, atau ZIP + .m3u8 + .csv + metadata untuk banyak item.
 *
 * Aturan keras:
 *  - Tidak ada media sintetis sebagai pengganti URL nyata.
 *  - Spotify: hanya metadata/tracklist/pratinjau berlabel; audio penuh tidak diunduh.
 *  - Klien tidak boleh menentukan berkas lokal server (field `customFile` dibuang).
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import { existsSync, createReadStream, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

import { assertPublicHttpUrl, UnsafeUrlError } from './safeUrl.mjs';
import {
  AUDIO_FORMATS,
  VIDEO_FORMATS,
  OTHER_FORMATS,
  parseMediaInput,
  sanitizeYtdlpOptions,
  sanitizeSafeFilename,
  buildYtdlpArgs,
  normalizeMediaInfo,
  buildM3u8Playlist,
  buildPlaylistCsv,
  detectPlatform,
} from './ytdlp.mjs';
import {
  ffmpegCandidates,
  probeFfmpegBinary,
  probeInputWithFfmpeg,
  buildConversionArgs,
  runFfmpeg,
  audioQualityToBitrate,
  platformKey,
  resolveInstallerBinary,
} from './ffmpegRuntime.mjs';

const execFileAsync = promisify(execFile);
/**
 * Akar proyek saat runtime. Bundel Next membekukan `import.meta.url` ke path BUILD (mis. /vercel/path0),
 * yang tidak ada di function (/var/task). Karena itu cwd (yang berisi package.json + bin/ hasil trace)
 * diutamakan; `import.meta.url` hanya fallback bila cwd bukan akar proyek.
 */
export function resolveProjectRoot() {
  const cwd = process.cwd();
  if (existsSync(path.join(cwd, 'package.json'))) return cwd;
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}
const projectRoot = resolveProjectRoot();

const BIN_DIR = '/tmp/nawa-ytdlp-bin';
const DEMO_DIR = '/tmp/nawa-ytdlp-demo-assets';

/** Batas ukuran satu stream dari browser (byte, setelah decode base64). */
export const MAX_STREAM_BYTES = 8 * 1024 * 1024;
const MAX_STREAM_BASE64_CHARS = Math.ceil(MAX_STREAM_BYTES / 3) * 4 + 16;
const MAX_TRACKS_META = 200;
const PREVIEW_LABEL = 'Preview 30 detik';
const RUNTIME_FAILURE_TTL_MS = 60 * 1000;

export const FFMPEG_UNAVAILABLE_MESSAGE =
  'Unduhan dinonaktifkan: FFmpeg belum tersedia di server. Pastikan `npm run setup:ffmpeg` dijalankan saat build '
  + 'dan berkas bin/ffmpeg ikut ter-bundle ke function (outputFileTracingIncludes), atau set FFMPEG_PATH. '
  + 'Inspeksi metadata tetap bisa dipakai.';

let cachedRuntime = null;
let cachedRuntimeAt = 0;
let runtimeInFlight = null;

export const DEMO_TRACKS = [
  {
    id: '1',
    slug: 'demo:track-1',
    title: 'Senja di Jakarta (Acoustic Session)',
    uploader: 'Nawa Studio',
    album: 'Album Harmoni Nusantara',
    duration: 4,
    freqs: [261.63, 329.63, 392.0], // C major triad
    color: '#4f46e5',
    lyrics: '00:00.000 --> 00:02.000\nSenja turun perlahan di ufuk Jakarta\n\n00:02.000 --> 00:04.000\nMenyimpan cerita di balik nada akustik\n',
  },
  {
    id: '2',
    slug: 'demo:track-2',
    title: 'Langkah Baru (Lo-Fi Instrumental)',
    uploader: 'Nawa Studio',
    album: 'Album Harmoni Nusantara',
    duration: 4,
    freqs: [220.0, 261.63, 329.63], // A minor triad
    color: '#047857',
    lyrics: '00:00.000 --> 00:02.000\nDetak hujan menemani langkah pagi\n\n00:02.000 --> 00:04.000\nKetukan lo-fi menenangkan pikiran\n',
  },
  {
    id: '3',
    slug: 'demo:track-3',
    title: 'Nusantara Harmoni (Synthwave Mix)',
    uploader: 'Nawa Studio',
    album: 'Album Harmoni Nusantara',
    duration: 5,
    freqs: [196.0, 246.94, 293.66], // G major triad
    color: '#b45309',
    lyrics: '00:00.000 --> 00:02.500\nCahaya neon menyinari malam nusantara\n\n00:02.500 --> 00:05.000\nHarmoni synthwave berpadu tanpa batas\n',
  },
];

/** Galat berkode agar route dapat memetakan status HTTP dan kode pesan dengan tepat. */
export class MediaEngineError extends Error {
  constructor(code, message, { status = 400, extra = {} } = {}) {
    super(message);
    this.name = 'MediaEngineError';
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

function makeSvgThumbnailDataUri(title, subtitle, bg = '#4f46e5') {
  const safeTitle = String(title || 'Nawa Audio').replace(/[<>&"']/g, '');
  const safeSub = String(subtitle || 'yt-dlp Engine').replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
    <rect width="320" height="320" rx="28" fill="${bg}"/>
    <circle cx="160" cy="130" r="56" fill="rgba(255,255,255,0.16)"/>
    <circle cx="160" cy="130" r="20" fill="#ffffff"/>
    <text x="160" y="232" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-weight="700" font-size="16">${safeTitle.slice(0, 28)}</text>
    <text x="160" y="258" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-family="monospace" font-size="12">${safeSub.slice(0, 32)}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Mengosongkan cache runtime (berguna untuk pengujian).
 */
export function resetYtdlpRuntimeCache() {
  cachedRuntime = null;
  cachedRuntimeAt = 0;
  runtimeInFlight = null;
}

async function copyExecutable(src, dst) {
  const tmp = `${dst}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  await fs.copyFile(src, tmp);
  await fs.chmod(tmp, 0o755);
  // rename bersifat atomik: proses lain yang sedang mengeksekusi berkas lama tidak terganggu.
  await fs.rename(tmp, dst);
}

function isSameExecutable(src, dst) {
  try {
    const a = statSync(src);
    const b = statSync(dst);
    return a.size === b.size && (b.mode & 0o100) !== 0;
  } catch {
    return false;
  }
}

/**
 * Menyalin kandidat ke BIN_DIR lalu memverifikasinya dengan menjalankannya.
 * Mengembalikan kandidat pertama yang lolos; mencatat alasan setiap kandidat yang ditolak.
 */
async function stageVerifiedBinary({ name, candidates, probe, log, shortPath }) {
  const target = path.join(BIN_DIR, name);
  for (const candidate of candidates) {
    const entry = { source: candidate.source, path: shortPath(candidate.path) };
    if (!existsSync(candidate.path)) {
      log.push({ ...entry, result: 'tidak ada' });
      continue;
    }
    let size;
    try {
      const st = statSync(candidate.path);
      if (!st.isFile()) {
        log.push({ ...entry, result: 'bukan berkas biasa' });
        continue;
      }
      size = st.size;
    } catch (err) {
      log.push({ ...entry, result: `tidak dapat dibaca (${err.message})` });
      continue;
    }
    const sameAsTarget = path.resolve(candidate.path) === path.resolve(target);
    try {
      if (!sameAsTarget && !isSameExecutable(candidate.path, target)) {
        await copyExecutable(candidate.path, target);
      }
    } catch (err) {
      log.push({ ...entry, result: `gagal disalin ke ${BIN_DIR} (${err.message})` });
      continue;
    }
    const result = await probe(target);
    if (result.ok) {
      log.push({ ...entry, result: 'ok', sizeMb: Number((size / 1024 / 1024).toFixed(1)), version: result.version });
      return { ok: true, path: target, source: candidate.source, sourcePath: shortPath(candidate.path), ...result };
    }
    log.push({ ...entry, result: `ditolak: ${result.reason}` });
    if (!sameAsTarget) await fs.rm(target, { force: true }).catch(() => {});
  }
  return { ok: false, path: null, source: null, reason: log.filter((l) => l.result !== 'tidak ada').map((l) => l.result).join('; ') || 'tidak ada kandidat' };
}

function buildDiagnosis({ ready, ytdlp, ff, ffprobeAvailable, ffprobeVersion, ffmpegLog, platform }) {
  const items = [];
  const env = process.env.VERCEL ? 'vercel' : 'local';
  items.push({ id: 'runtime', level: 'info', message: `Platform ${platform}, Node ${process.version}, lingkungan ${env}.` });

  if (ready) {
    items.push({ id: 'ytdlp', level: 'ok', message: `yt-dlp v${ytdlp.version} siap (sumber: ${ytdlp.source}).` });
  } else {
    items.push({
      id: 'ytdlp',
      level: 'error',
      message: 'yt-dlp belum siap di server.',
      action: 'Jalankan `npm run setup:ytdlp` saat build, atau izinkan unduhan runtime (YTDLP_RUNTIME_DOWNLOAD) dengan akses ke github.com.',
    });
  }

  if (ff.ok) {
    items.push({ id: 'ffmpeg', level: 'ok', message: `FFmpeg siap: ${ff.version || 'versi tidak terbaca'} (sumber: ${ff.source}).` });
  } else {
    const lastTries = ffmpegLog.filter((l) => l.result !== 'tidak ada').slice(-3).map((l) => `${l.source}: ${l.result}`);
    items.push({
      id: 'ffmpeg',
      level: 'error',
      message: 'FFmpeg tidak bisa dijalankan di server, sehingga unduhan audio/video dinonaktifkan.',
      action: 'Pastikan `npm run setup:ffmpeg` berjalan saat build dan bin/ffmpeg ikut ter-trace ke function /api/ytdlp, '
        + 'atau set env FFMPEG_PATH ke binari FFmpeg statis yang bisa dieksekusi.',
      detail: lastTries.length ? lastTries : ['tidak ada kandidat FFmpeg ditemukan'],
    });
  }

  items.push(
    ffprobeAvailable
      ? { id: 'ffprobe', level: 'ok', message: `ffprobe siap (${ffprobeVersion || 'versi tidak terbaca'}).` }
      : { id: 'ffprobe', level: 'info', message: 'ffprobe tidak tersedia. Tidak wajib: konversi memakai ffmpeg saja.' }
  );

  items.push(
    ready && ff.ok
      ? { id: 'download', level: 'ok', message: 'Unduhan audio/video diaktifkan.' }
      : { id: 'download', level: 'error', message: 'Unduhan dinonaktifkan sampai yt-dlp dan FFmpeg siap. Inspeksi metadata tetap berjalan.' }
  );
  return items;
}

/**
 * Menyiapkan binari `yt-dlp` dan `ffmpeg` (+ `ffprobe` bila ada) di `/tmp/nawa-ytdlp-bin`.
 *
 * Dirancang untuk serverless (mis. Vercel): filesystem read-only kecuali `/tmp`.
 *  - FFmpeg: kandidat diurutkan `FFMPEG_PATH` → `bin/ffmpeg` hasil build → paket @ffmpeg-installer → PATH.
 *  - yt-dlp: `YTDLP_PATH` → `bin/yt-dlp` hasil build → python3 -m yt_dlp → unduhan runtime.
 * Setiap kandidat disalin ke /tmp lalu DIJALANKAN untuk verifikasi.
 *
 * @param {object} [options]
 * @param {boolean} [options.allowRuntimeDownload]
 * @param {Array<{source:string,path:string}>} [options.ffmpegCandidates] ganti daftar kandidat (tes/diagnosis)
 * @param {boolean} [options.force] abaikan cache
 */
export async function ensureYtdlpRuntime(options = {}) {
  if (!options.force && cachedRuntime && cachedRuntime.ready && cachedRuntime.ffmpegAvailable
    && existsSync(cachedRuntime.ytdlpPath) && existsSync(cachedRuntime.ffmpegPath)) {
    return cachedRuntime;
  }
  if (!options.force && cachedRuntime && Date.now() - cachedRuntimeAt < RUNTIME_FAILURE_TTL_MS) {
    return cachedRuntime;
  }
  if (!runtimeInFlight) {
    runtimeInFlight = buildYtdlpRuntime(options)
      .then((rt) => {
        cachedRuntime = rt;
        cachedRuntimeAt = Date.now();
        return rt;
      })
      .finally(() => {
        runtimeInFlight = null;
      });
  }
  return runtimeInFlight;
}

async function buildYtdlpRuntime(options) {
  const allowRuntimeDownload = options.allowRuntimeDownload
    ?? process.env.YTDLP_RUNTIME_DOWNLOAD !== '0';
  await fs.mkdir(BIN_DIR, { recursive: true });
  const diagnostics = { checked: [], source: null, python: null, runtimeDownload: null, errors: [] };
  const shortPath = (p) => String(p || '').replace(projectRoot, '<app>');
  const platform = platformKey();

  // ---- FFmpeg (wajib untuk unduhan) ----
  const ffmpegLog = [];
  const ffCandidates = options.ffmpegCandidates
    ?? ffmpegCandidates({ projectRoot, cwd: process.cwd() });
  const ff = await stageVerifiedBinary({
    name: 'ffmpeg',
    candidates: ffCandidates,
    probe: (p) => probeFfmpegBinary(p),
    log: ffmpegLog,
    shortPath,
  });

  // ---- ffprobe (opsional, hanya diagnosis) ----
  let ffprobeVersion = null;
  let ffprobeAvailable = false;
  const ffprobeLog = [];
  const ffprobeCandidates = [
    { source: '@ffprobe-installer', path: resolveInstallerBinary('@ffprobe-installer', 'ffprobe') },
    { source: 'bin/ffprobe (build)', path: path.join(projectRoot, 'bin', 'ffprobe') },
  ].filter((c) => c.path);
  const ffprobe = await stageVerifiedBinary({
    name: 'ffprobe',
    candidates: ffprobeCandidates,
    probe: async (p) => {
      try {
        const { stdout } = await execFileAsync(p, ['-hide_banner', '-version'], { timeout: 15000 });
        return { ok: true, version: String(stdout).split('\n')[0].replace(/^ffprobe version\s*/i, '').split(' Copyright')[0] };
      } catch (err) {
        return { ok: false, reason: String(err.message || err).split('\n')[0] };
      }
    },
    log: ffprobeLog,
    shortPath,
  });
  if (ffprobe.ok) {
    ffprobeAvailable = true;
    ffprobeVersion = ffprobe.version;
  }

  // ---- yt-dlp ----
  const verifyBinary = async (binPath) => {
    try {
      const { stdout } = await execFileAsync(binPath, ['--version'], { timeout: 12000 });
      const ver = String(stdout || '').trim().split('\n')[0];
      return ver || null;
    } catch {
      return null;
    }
  };

  const candidates = [
    process.env.YTDLP_PATH || null,
    path.join(projectRoot, 'bin', 'yt-dlp'),
    path.join(process.cwd(), 'bin', 'yt-dlp'),
    path.join(projectRoot, 'public', 'ocr', 'yt-dlp'),
    path.join(BIN_DIR, 'yt-dlp'),
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    path.join(process.env.HOME || '/tmp', '.local', 'bin', 'yt-dlp'),
  ].filter(Boolean);

  let ytdlpPath = null;
  let version = null;
  const stagedPath = path.join(BIN_DIR, 'yt-dlp');
  for (const candidate of [...new Set(candidates)]) {
    diagnostics.checked.push(shortPath(candidate));
    if (!existsSync(candidate)) continue;
    try {
      // Salin ke /tmp yang writable + executable (serverless read-only di luar /tmp).
      if (path.resolve(candidate) !== path.resolve(stagedPath)) {
        await copyExecutable(candidate, stagedPath);
      }
    } catch (err) {
      diagnostics.errors.push(`${shortPath(candidate)}: gagal disalin (${err.message})`);
      continue;
    }
    const ver = await verifyBinary(stagedPath);
    if (ver) {
      ytdlpPath = stagedPath;
      version = ver;
      diagnostics.source = shortPath(candidate);
      break;
    }
    diagnostics.errors.push(`${shortPath(candidate)}: verifikasi --version gagal`);
    await fs.rm(stagedPath, { force: true }).catch(() => {});
  }

  // Fallback 1: modul pip `yt_dlp` langsung (VPS/lokal dengan python3).
  if (!ytdlpPath) {
    try {
      const { stdout } = await execFileAsync('python3', ['-m', 'yt_dlp', '--version'], { timeout: 12000 });
      const pipVer = String(stdout || '').trim().split('\n')[0];
      diagnostics.python = pipVer ? `python3 + yt-dlp ${pipVer}` : 'python3 tanpa modul yt_dlp';
      if (pipVer) {
        await fs.writeFile(stagedPath, '#!/bin/sh\nexec python3 -m yt_dlp "$@"\n');
        await fs.chmod(stagedPath, 0o755);
        const rever = await verifyBinary(stagedPath);
        if (rever) {
          ytdlpPath = stagedPath;
          version = rever;
          diagnostics.source = 'python3 -m yt_dlp';
        }
      }
    } catch (err) {
      diagnostics.python = 'python3 tidak tersedia';
      diagnostics.errors.push(`python3 -m yt_dlp: ${String(err.message || err).split('\n')[0]}`);
    }
  }

  // Fallback 2: unduh binari statis ke /tmp saat runtime (sekali per instance hangat).
  if (!ytdlpPath && allowRuntimeDownload) {
    try {
      const tag = (process.env.YTDLP_VERSION || 'latest').trim() || 'latest';
      const url = tag === 'latest'
        ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux'
        : `https://github.com/yt-dlp/yt-dlp/releases/download/${tag}/yt-dlp_linux`;
      diagnostics.runtimeDownload = `mengunduh ${url}`;
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(45000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 10 * 1024 * 1024 || buf[0] !== 0x7f || buf[1] !== 0x45 || buf[2] !== 0x4c || buf[3] !== 0x46) {
        throw new Error(`berkas tidak valid (${buf.length} byte)`);
      }
      await fs.writeFile(stagedPath, buf);
      await fs.chmod(stagedPath, 0o755);
      const downVer = await verifyBinary(stagedPath);
      if (!downVer) throw new Error('verifikasi --version gagal');
      ytdlpPath = stagedPath;
      version = downVer;
      diagnostics.source = 'runtime-download';
      diagnostics.runtimeDownload = `berhasil (v${downVer})`;
    } catch (err) {
      diagnostics.runtimeDownload = `gagal: ${String(err.message || err).split('\n')[0]}`;
      diagnostics.errors.push(`runtime-download: ${diagnostics.runtimeDownload}`);
      await fs.rm(stagedPath, { force: true }).catch(() => {});
    }
  }

  const ready = Boolean(ytdlpPath && version);
  const ffmpegAvailable = Boolean(ff.ok);
  const diagnosis = buildDiagnosis({
    ready,
    ytdlp: { version, source: diagnostics.source },
    ff: { ok: ffmpegAvailable, version: ff.version, source: ff.source },
    ffprobeAvailable,
    ffprobeVersion,
    ffmpegLog,
    platform,
  });

  return {
    ready,
    ytdlpPath,
    ytdlpVersion: version,
    ytdlpSource: diagnostics.source,
    ffmpegAvailable,
    ffmpegDir: ffmpegAvailable ? BIN_DIR : null,
    ffmpegPath: ffmpegAvailable ? ff.path : null,
    ffmpegVersion: ff.version || null,
    ffmpegSource: ff.source || null,
    ffmpegEncoders: ff.encoders || [],
    ffprobeAvailable,
    ffprobeVersion,
    downloadEnabled: ready && ffmpegAvailable,
    platform,
    environment: process.env.VERCEL ? 'vercel' : 'local',
    diagnosis,
    diagnostics: { ...diagnostics, ffmpeg: ffmpegLog, ffprobe: ffprobeLog },
    setupHint: ready
      ? null
      : 'Binari yt-dlp tidak ditemukan di server. Pastikan proses build menjalankan "node scripts/setup-ytdlp.mjs" '
        + 'sehingga berkas "bin/yt-dlp" tersedia dan ikut ter-bundle (lihat next.config.js), '
        + 'atau izinkan unduhan runtime dengan akses internet keluar ke github.com.',
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Menyiapkan berkas media contoh (3 lagu/video MP4 + cover JPG + subtitle VTT) dengan FFmpeg.
 * Hanya dipakai oleh demo eksplisit (`demo:*`). Tidak pernah dipakai untuk URL nyata.
 */
export async function ensureDemoMediaAssets(runtime = null) {
  const rt = runtime || await ensureYtdlpRuntime();
  if (!rt.ffmpegAvailable) {
    throw new MediaEngineError(
      'FFMPEG_UNAVAILABLE',
      'Demo memerlukan FFmpeg, dan FFmpeg belum tersedia di server. Gunakan URL atau stream nyata setelah FFmpeg siap.',
      { status: 503, extra: { diagnosis: rt.diagnosis } }
    );
  }
  const ffmpegBin = rt.ffmpegPath;
  const demoReady = DEMO_TRACKS.every((t) => existsSync(path.join(DEMO_DIR, `track-${t.id}.mp4`))
    && existsSync(path.join(DEMO_DIR, `cover-${t.id}.jpg`))
    && existsSync(path.join(DEMO_DIR, `sub-${t.id}.vtt`)));
  if (demoReady) return DEMO_DIR;

  await fs.mkdir(DEMO_DIR, { recursive: true });
  for (const track of DEMO_TRACKS) {
    const mp4Path = path.join(DEMO_DIR, `track-${track.id}.mp4`);
    const jpgPath = path.join(DEMO_DIR, `cover-${track.id}.jpg`);
    const vttPath = path.join(DEMO_DIR, `sub-${track.id}.vtt`);

    if (!existsSync(mp4Path)) {
      const [f1, f2, f3] = track.freqs;
      const d = track.duration;
      const audioExpr = `0.3*sin(2*PI*${f1}*t)+0.25*sin(2*PI*${f2}*t)+0.2*sin(2*PI*${f3}*t)`;
      await runFfmpeg(ffmpegBin, [
        '-y',
        '-f', 'lavfi',
        '-i', `testsrc=duration=${d}:size=640x360:rate=24`,
        '-f', 'lavfi',
        '-i', `aevalsrc='${audioExpr}':d=${d}:s=44100`,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '160k',
        '-movflags', '+faststart',
        '-metadata', `title=${track.title}`,
        '-metadata', `artist=${track.uploader}`,
        '-metadata', `album=${track.album}`,
        '-metadata', `track=${track.id}/3`,
        mp4Path,
      ]);
    }

    if (!existsSync(jpgPath)) {
      await runFfmpeg(ffmpegBin, [
        '-y',
        '-f', 'lavfi',
        '-i', `color=c=${track.color}:s=320x320:d=1`,
        '-frames:v', '1',
        jpgPath,
      ]);
    }

    if (!existsSync(vttPath)) {
      await fs.writeFile(vttPath, `WEBVTT\n\n${track.lyrics}`, 'utf8');
    }
  }
  return DEMO_DIR;
}

/**
 * Server HTTP loopback sementara yang menyajikan RSS dan media DEMO agar yt-dlp dapat
 * memprosesnya seperti playlist nyata. Hanya untuk `demo:*`.
 */
async function withDemoMediaServer(runtime, callback) {
  await ensureDemoMediaAssets(runtime);
  let port = 0;

  const buildRssXml = (tracks, channelTitle, channelDesc) => {
    const itemsXml = tracks
      .map((t) => {
        const mp4Size = statSync(path.join(DEMO_DIR, `track-${t.id}.mp4`)).size;
        return `
        <item>
          <guid isPermaLink="false">nawa-track-${t.id}</guid>
          <title>${t.title.replace(/[<>&]/g, '')}</title>
          <itunes:author>${t.uploader.replace(/[<>&]/g, '')}</itunes:author>
          <itunes:duration>${t.duration}</itunes:duration>
          <itunes:image href="http://127.0.0.1:${port}/cover/${t.id}.jpg" />
          <enclosure url="http://127.0.0.1:${port}/media/${t.id}.mp4" type="video/mp4" length="${mp4Size}" />
        </item>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>${String(channelTitle || 'Album Harmoni Nusantara').replace(/[<>&]/g, '')}</title>
    <description>${String(channelDesc || 'Playlist Demo Nawa Editor').replace(/[<>&]/g, '')}</description>
    ${itemsXml}
  </channel>
</rss>`;
  };

  const server = http.createServer((req, res) => {
    const reqUrl = new URL(req.url || '/', `http://127.0.0.1:${port}`);
    const pathname = reqUrl.pathname;

    if (pathname === '/playlist.rss') {
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
      res.end(buildRssXml(DEMO_TRACKS, DEMO_TRACKS[0].album, 'Full Playlist Demo Nawa Editor'));
      return;
    }

    const singleRssMatch = pathname.match(/^\/track-(\d)\.rss$/);
    if (singleRssMatch) {
      const track = DEMO_TRACKS.find((t) => t.id === singleRssMatch[1]) || DEMO_TRACKS[0];
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
      res.end(buildRssXml([track], track.title, track.album));
      return;
    }

    const coverMatch = pathname.match(/^\/cover\/(\d)\.jpg$/);
    if (coverMatch) {
      const file = path.join(DEMO_DIR, `cover-${coverMatch[1]}.jpg`);
      if (existsSync(file)) {
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': statSync(file).size });
        createReadStream(file).pipe(res);
        return;
      }
    }

    const mediaMatch = pathname.match(/^\/media\/(\d)\.mp4$/);
    if (mediaMatch) {
      const file = path.join(DEMO_DIR, `track-${mediaMatch[1]}.mp4`);
      if (existsSync(file)) {
        const st = statSync(file);
        const range = req.headers.range;
        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10) || 0;
          const end = parts[1] ? parseInt(parts[1], 10) : st.size - 1;
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${st.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': end - start + 1,
            'Content-Type': 'video/mp4',
          });
          createReadStream(file, { start, end }).pipe(res);
        } else {
          res.writeHead(200, { 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Content-Type': 'video/mp4' });
          createReadStream(file).pipe(res);
        }
        return;
      }
    }

    res.writeHead(404);
    res.end('Not found');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;

  try {
    return await callback(port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function mapDemoSlugToLocalUrl(slug, port) {
  const clean = String(slug || '').trim().toLowerCase();
  if (clean === 'demo:playlist') return `http://127.0.0.1:${port}/playlist.rss`;
  if (clean === 'demo:song' || clean === 'demo:track-1') return `http://127.0.0.1:${port}/track-1.rss`;
  if (clean === 'demo:track-2') return `http://127.0.0.1:${port}/track-2.rss`;
  if (clean === 'demo:video' || clean === 'demo:track-3') return `http://127.0.0.1:${port}/track-3.rss`;
  return `http://127.0.0.1:${port}/track-1.rss`;
}

/**
 * Memastikan setiap URL eksternal aman dari SSRF sebelum diteruskan ke yt-dlp.
 */
async function validateExternalTargets(items) {
  for (const item of items) {
    if (/^demo:/i.test(item)) continue;
    if (/^(ytsearch|scsearch)\d*:/i.test(item)) continue;
    await assertPublicHttpUrl(item);
  }
}

/**
 * Mengambil informasi lengkap (judul, durasi, daftar lagu playlist, resolusi) menggunakan `yt-dlp`.
 * Metadata inspeksi tidak memerlukan FFmpeg.
 */
export async function inspectWithYtdlp(rawInput, rawOptions = {}) {
  const parsed = parseMediaInput(rawInput);
  if (!parsed.valid) {
    throw new Error(parsed.error || 'Input tidak valid.');
  }

  const runtime = await ensureYtdlpRuntime();
  if (!runtime.ready) {
    throw new Error(`Mesin yt-dlp belum siap di server. ${runtime.setupHint || ''}`.trim());
  }

  // 1. Demo eksplisit (`demo:playlist`, `demo:song`, `demo:video`, `demo:track-*`)
  if (parsed.kind === 'demo' || /^demo:track-\d$/i.test(parsed.primaryUrl)) {
    return await withDemoMediaServer(runtime, async (port) => {
      const localUrl = mapDemoSlugToLocalUrl(parsed.primaryUrl, port);
      const ffArgs = runtime.ffmpegDir ? ['--ffmpeg-location', runtime.ffmpegDir] : [];
      const { stdout } = await execFileAsync(
        runtime.ytdlpPath,
        [...ffArgs, '--dump-single-json', '--no-warnings', localUrl],
        { timeout: 20000, maxBuffer: 15 * 1024 * 1024 }
      );
      const rawJson = JSON.parse(stdout);
      const info = normalizeMediaInfo(rawJson, parsed.primaryUrl);

      info.isPlaylist = parsed.primaryUrl.toLowerCase() === 'demo:playlist';
      info.sourceUrl = parsed.primaryUrl;
      info.extractor = 'yt-dlp (Demo Lokal)';
      info.isDemo = true;
      info.hasSubtitles = true;
      info.availableQualities = [
        { height: 1080, label: '1080p Full HD', ext: 'mp4' },
        { height: 720, label: '720p HD', ext: 'mp4' },
        { height: 480, label: '480p SD', ext: 'mp4' },
        { height: 360, label: '360p Ringan', ext: 'mp4' },
      ];
      const singleDemoTrack = parsed.primaryUrl === 'demo:video' || parsed.primaryUrl === 'demo:track-3'
        ? DEMO_TRACKS[2]
        : parsed.primaryUrl === 'demo:track-2'
          ? DEMO_TRACKS[1]
          : DEMO_TRACKS[0];
      info.entries = info.entries.map((entry, idx) => {
        const trackMeta = info.isPlaylist ? (DEMO_TRACKS[idx] || DEMO_TRACKS[0]) : singleDemoTrack;
        return {
          ...entry,
          index: idx + 1,
          title: trackMeta.title,
          uploader: trackMeta.uploader,
          album: trackMeta.album,
          duration: trackMeta.duration,
          durationText: `00:0${trackMeta.duration}`,
          url: trackMeta.slug,
          thumbnail: makeSvgThumbnailDataUri(trackMeta.title, trackMeta.uploader, trackMeta.color),
        };
      });
      info.totalDuration = info.entries.reduce((s, e) => s + e.duration, 0);
      info.totalDurationText = `00:${String(info.totalDuration).padStart(2, '0')}`;
      info.thumbnail = info.entries[0]?.thumbnail || makeSvgThumbnailDataUri(info.title, 'Nawa Studio');
      if (!info.isPlaylist) {
        const t = info.entries[0];
        info.title = t.title;
        info.uploader = t.uploader;
      }

      return {
        status: true,
        engine: 'yt-dlp',
        ytdlpVersion: runtime.ytdlpVersion,
        info,
      };
    });
  }

  // 2. Batch banyak link (dipisah baris baru)
  if (parsed.kind === 'batch') {
    await validateExternalTargets(parsed.items);
    const entries = parsed.items.map((itemUrl, idx) => ({
      index: idx + 1,
      id: `batch-${idx + 1}`,
      title: itemUrl.startsWith('ytsearch')
        ? itemUrl.replace(/^ytsearch\d*:/i, '')
        : itemUrl,
      uploader: detectPlatform(itemUrl)?.toUpperCase() || 'Batch Link',
      album: 'Batch Antrean Unduhan',
      // Durasi belum diketahui untuk batch (tidak diambil yt-dlp); tampilkan tanpa angka palsu.
      duration: 0,
      durationText: '—',
      thumbnail: makeSvgThumbnailDataUri(`Track #${idx + 1}`, detectPlatform(itemUrl) || 'Media'),
      url: itemUrl,
      extractor: detectPlatform(itemUrl) || 'generic',
    }));
    return {
      status: true,
      engine: 'yt-dlp-batch',
      ytdlpVersion: runtime.ytdlpVersion,
      info: {
        isPlaylist: true,
        id: 'batch-queue',
        title: `Daftar Antrean Batch (${entries.length} Item)`,
        uploader: 'Multi-Platform',
        description: 'Daftar link yang siap diunduh berurutan maupun sekaligus. Durasi dan judul final ditentukan saat unduhan.',
        thumbnail: entries[0]?.thumbnail || null,
        sourceUrl: parsed.primaryUrl,
        platform: parsed.platform,
        extractor: 'yt-dlp Batch',
        trackCount: entries.length,
        totalDuration: 0,
        totalDurationText: '—',
        entries,
        availableQualities: [
          { height: 1080, label: '1080p Full HD', ext: 'mp4' },
          { height: 720, label: '720p HD', ext: 'mp4' },
          { height: 480, label: '480p SD', ext: 'mp4' },
        ],
        hasSubtitles: true,
        chapters: [],
      },
    };
  }

  // 3. Validasi keamanan URL eksternal (SSRF protection)
  await validateExternalTargets(parsed.items);

  // 4. Jalankan yt-dlp pada target eksternal dengan timeout cepat agar responsif
  const opts = sanitizeYtdlpOptions(rawOptions);
  const ytdlpInspectArgs = [
    ...(runtime.ffmpegDir ? ['--ffmpeg-location', runtime.ffmpegDir] : []),
    '--dump-single-json',
    '--no-warnings',
    '--ignore-errors',
    '--socket-timeout', '4',
    '--retries', '1',
    '--extractor-retries', '1',
  ];

  if (parsed.isPlaylist && opts.playlistMode !== 'single') {
    ytdlpInspectArgs.push('--flat-playlist', '--yes-playlist');
    if (opts.playlistMode === 'range' && opts.playlistRange) {
      ytdlpInspectArgs.push('--playlist-items', opts.playlistRange);
    }
  } else {
    ytdlpInspectArgs.push('--no-playlist');
  }

  ytdlpInspectArgs.push('--', parsed.primaryUrl);

  try {
    const { stdout } = await execFileAsync(runtime.ytdlpPath, ytdlpInspectArgs, {
      timeout: 8000,
      maxBuffer: 25 * 1024 * 1024,
    });
    const rawJson = JSON.parse(stdout);
    if (rawJson && (rawJson.id || Array.isArray(rawJson.entries))) {
      const info = normalizeMediaInfo(rawJson, parsed.primaryUrl);
      if (info.entries && info.entries.length > 0) {
        return {
          status: true,
          engine: 'yt-dlp',
          ytdlpVersion: runtime.ytdlpVersion,
          info,
        };
      }
    }
  } catch (err) {
    const stderr = String(err.stderr || err.message || '');
    const isNetworkBlocked = isNetworkErrorText(stderr);

    const fallbackInfo = buildStructuredFallbackInfo(parsed, isNetworkBlocked ? 'hybrid-resolver' : 'assisted');
    return {
      status: true,
      engine: 'yt-dlp-hybrid',
      ytdlpVersion: runtime.ytdlpVersion,
      serverNetworkRestricted: isNetworkBlocked,
      info: fallbackInfo,
    };
  }

  const fallbackInfo = buildStructuredFallbackInfo(parsed, 'hybrid-resolver');
  return {
    status: true,
    engine: 'yt-dlp-hybrid',
    ytdlpVersion: runtime.ytdlpVersion,
    serverNetworkRestricted: true,
    info: fallbackInfo,
  };
}

/**
 * Metadata kerangka saat server tidak dapat memverifikasi URL (jaringan dibatasi).
 * SENGAJA ditandai `unverified: true` agar UI menampilkan bahwa judul/durasi belum terverifikasi.
 * Unduhan tidak memakai data kerangka ini; unduhan memakai stream nyata dari browser atau yt-dlp.
 */
function buildStructuredFallbackInfo(parsed, reason) {
  const url = parsed.primaryUrl;
  const platform = parsed.platform || 'youtube';
  let title = url;
  let id = 'media-item';

  if (parsed.kind === 'search') {
    title = parsed.searchQuery || url.replace(/^(ytsearch|scsearch)\d*:/i, '');
    id = `search-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`;
  } else {
    try {
      const u = new URL(url);
      const v = u.searchParams.get('v') || u.searchParams.get('list') || u.pathname.split('/').filter(Boolean).pop() || 'media';
      id = v.slice(0, 32);
      title = parsed.isPlaylist
        ? `Playlist ${platform.toUpperCase()} (${id})`
        : `${platform.toUpperCase()} Media (${id})`;
    } catch {}
  }

  if (parsed.isPlaylist) {
    return {
      isPlaylist: true,
      id,
      title,
      uploader: platform.toUpperCase(),
      description: 'Metadata belum terverifikasi. Pilih item dari hasil pencarian browser atau unduh langsung.',
      thumbnail: null,
      sourceUrl: url,
      platform,
      extractor: `yt-dlp (${reason})`,
      unverified: true,
      trackCount: 0,
      totalDuration: 0,
      totalDurationText: '—',
      entries: [],
      // Spotify hanya audio/metadata: jangan tampilkan pilihan resolusi video.
      availableQualities: platform === 'spotify' ? [] : [
        { height: 2160, label: '2160p 4K', ext: 'mp4' },
        { height: 1080, label: '1080p Full HD', ext: 'mp4' },
        { height: 720, label: '720p HD', ext: 'mp4' },
        { height: 480, label: '480p SD', ext: 'mp4' },
      ],
      hasSubtitles: platform !== 'spotify',
      chapters: [],
    };
  }

  const thumb = platform === 'youtube' && /^[a-zA-Z0-9_-]{11}$/.test(id)
    ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
    : makeSvgThumbnailDataUri(title, platform.toUpperCase());

  const singleEntry = {
    index: 1,
    id,
    title,
    uploader: platform.toUpperCase(),
    album: '',
    duration: 0,
    durationText: '—',
    thumbnail: thumb,
    url,
    extractor: platform,
  };

  return {
    isPlaylist: false,
    id,
    title,
    uploader: platform.toUpperCase(),
    description: 'Metadata belum terverifikasi.',
    thumbnail: thumb,
    sourceUrl: url,
    platform,
    extractor: `yt-dlp (${reason})`,
    unverified: true,
    trackCount: 1,
    totalDuration: 0,
    totalDurationText: '—',
    entries: [singleEntry],
    availableQualities: platform === 'spotify' ? [] : [
      { height: 2160, label: '2160p 4K', ext: 'mp4' },
      { height: 1080, label: '1080p Full HD', ext: 'mp4' },
      { height: 720, label: '720p HD', ext: 'mp4' },
      { height: 480, label: '480p SD', ext: 'mp4' },
      { height: 360, label: '360p Ringan', ext: 'mp4' },
    ],
    hasSubtitles: platform !== 'spotify',
    chapters: [],
  };
}

function getMimeByExtension(filename) {
  const ext = path.extname(filename).replace(/^\./, '').toLowerCase();
  const audioMatch = AUDIO_FORMATS.find((f) => f.ext === ext || f.id === ext);
  if (audioMatch) return audioMatch.mime;
  const videoMatch = VIDEO_FORMATS.find((f) => f.ext === ext || f.id === ext);
  if (videoMatch) return videoMatch.mime;
  const otherMatch = OTHER_FORMATS.find((o) => o.ext === ext);
  if (otherMatch) return otherMatch.mime;
  if (ext === 'vtt') return 'text/vtt; charset=utf-8';
  if (ext === 'srt') return 'text/plain; charset=utf-8';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'json') return 'application/json; charset=utf-8';
  if (ext === 'zip') return 'application/zip';
  return 'application/octet-stream';
}

/**
 * Membersihkan `tracksMeta` dari klien. Field `customFile` SELALU dibuang: klien tidak boleh
 * menunjuk berkas lokal server. Stream base64 divalidasi ukurannya.
 */
export function sanitizeTracksMeta(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw.slice(0, MAX_TRACKS_META).map((t, idx) => {
    const item = t && typeof t === 'object' ? t : {};
    const duration = Number(item.duration);
    return {
      index: idx + 1,
      title: String(item.title || '').slice(0, 300),
      uploader: String(item.uploader || '').slice(0, 200),
      album: String(item.album || '').slice(0, 300),
      duration: Number.isFinite(duration) && duration > 0 ? Math.min(duration, 36000) : 0,
      url: String(item.url || '').slice(0, 2000),
      extractor: String(item.extractor || '').slice(0, 80),
      isPreview: item.isPreview === true,
      streamBase64: typeof item.streamBase64 === 'string' && item.streamBase64.length <= MAX_STREAM_BASE64_CHARS
        ? item.streamBase64
        : null,
    };
  });
}

/**
 * Mengumpulkan stream nyata yang dikirim browser. Satu stream untuk unduhan tunggal,
 * atau per-item `tracksMeta[i].streamBase64` untuk antrean/ZIP.
 */
function collectBrowserStreams(rawOptions, tracksMeta, parsed) {
  const single = typeof rawOptions.clientStreamBase64 === 'string' && rawOptions.clientStreamBase64.length > 0
    ? rawOptions.clientStreamBase64
    : null;
  const streams = [];
  if (tracksMeta && tracksMeta.length > 0) {
    tracksMeta.forEach((t, i) => {
      const b64 = t.streamBase64 || (single && tracksMeta.length === 1 && i === 0 ? single : null);
      if (!b64) return;
      streams.push({
        index: i + 1,
        base64: b64,
        title: t.title || rawOptions.customTitle || `Track ${i + 1}`,
        uploader: t.uploader || rawOptions.customUploader || '',
        album: t.album || rawOptions.customAlbum || '',
        duration: t.duration || null,
        isPreview: t.isPreview === true || (tracksMeta.length === 1 && rawOptions.isPreview === true),
      });
    });
  } else if (single) {
    streams.push({
      index: 1,
      base64: single,
      title: rawOptions.customTitle || parsed.searchQuery || 'Media Unduhan',
      uploader: rawOptions.customUploader || 'Nawa Editor',
      album: rawOptions.customAlbum || 'Nawa Downloader',
      duration: null,
      isPreview: rawOptions.isPreview === true,
    });
  }
  return streams;
}

/** Decode base64 dan validasi ukuran. Melempar MediaEngineError bila tidak valid. */
function decodeStreamBase64(base64) {
  if (!/^[A-Za-z0-9+/=\s]+$/.test(base64)) {
    throw new MediaEngineError('STREAM_INVALID', 'Data stream dari browser tidak valid (bukan base64).');
  }
  const buf = Buffer.from(base64, 'base64');
  if (buf.length <= 256) {
    throw new MediaEngineError('STREAM_INVALID', 'Stream dari browser terlalu kecil untuk dikonversi.');
  }
  if (buf.length > MAX_STREAM_BYTES) {
    throw new MediaEngineError('STREAM_TOO_LARGE', 'Stream dari browser melebihi batas 8 MB.');
  }
  return buf;
}

function outputExtension(opts) {
  if (opts.mode === 'video') return opts.videoFormat;
  const fmt = AUDIO_FORMATS.find((f) => f.id === opts.audioFormat);
  return fmt ? fmt.ext : 'mp3';
}

/**
 * Mengonversi stream nyata dari browser memakai FFmpeg. Tidak memakai demo, tidak memakai placeholder.
 * Item yang gagal dicatat di `failures`, item lain tetap diproses.
 */
async function convertBrowserStreams({ streams, jobDir, opts, runtime, rawOptions }) {
  const outputs = [];
  const failures = [];
  const ext = outputExtension(opts);
  const bitrate = audioQualityToBitrate(opts.audioQuality);
  const clipStart = opts.clipStartSeconds;
  const clipEnd = opts.clipEndSeconds;

  for (const s of streams) {
    const inputPath = path.join(jobDir, `_in_${s.index}.bin`);
    try {
      const buf = decodeStreamBase64(s.base64);
      await fs.writeFile(inputPath, buf);
      const info = await probeInputWithFfmpeg(runtime.ffmpegPath, inputPath);
      if (opts.mode === 'video' ? !(info.hasVideo || info.hasAudio) : !info.hasAudio) {
        throw new MediaEngineError('STREAM_INVALID', 'Stream dari browser tidak berisi audio yang bisa dibaca FFmpeg.');
      }

      const baseTitle = String(s.title || `Track ${s.index}`).trim();
      const displayTitle = s.isPreview ? `${baseTitle} (${PREVIEW_LABEL})` : baseTitle;
      const outName = sanitizeSafeFilename(
        streams.length > 1 ? `${String(s.index).padStart(2, '0')} - ${displayTitle}` : displayTitle,
        `track-${s.index}`,
        ext
      );
      const outPath = path.join(jobDir, outName);
      const args = buildConversionArgs({
        input: inputPath,
        output: outPath,
        mode: opts.mode,
        audioFormat: opts.audioFormat,
        audioBitrate: bitrate,
        videoFormat: opts.videoFormat,
        info,
        metadata: {
          title: displayTitle,
          artist: s.uploader,
          album: s.album,
          comment: s.isPreview ? `${PREVIEW_LABEL} dari sumber publik. Bukan audio penuh.` : '',
          track: streams.length > 1 ? `${s.index}/${streams.length}` : '',
        },
        clipStart: clipStart,
        clipEnd: clipEnd,
      });
      await runFfmpeg(runtime.ffmpegPath, args);
      const st = await fs.stat(outPath);
      if (st.size < 512) {
        throw new MediaEngineError('CONVERT_EMPTY', 'Hasil konversi FFmpeg terlalu kecil; kemungkinan stream kosong.');
      }
      outputs.push({
        filename: outName,
        isPreview: s.isPreview,
        entry: {
          index: outputs.length + 1,
          title: displayTitle,
          uploader: s.uploader || rawOptions.customUploader || 'Nawa Editor',
          duration: s.duration || 0,
          durationText: s.duration ? `00:${String(Math.round(s.duration)).padStart(2, '0')}` : '—',
          filename: outName,
          url: s.isPreview ? 'preview-30s' : (rawOptions.url || ''),
        },
      });
    } catch (err) {
      failures.push({ index: s.index, title: s.title || `Track ${s.index}`, reason: String(err.message || err).slice(0, 300) });
    } finally {
      await fs.rm(inputPath, { force: true }).catch(() => {});
    }
  }

  if (outputs.length === 0) {
    const reason = failures[0]?.reason || 'Tidak ada stream yang bisa dikonversi.';
    throw new MediaEngineError('STREAM_CONVERT_FAILED', reason, { status: 422, extra: { failures } });
  }
  return { outputs, failures };
}

/**
 * Mengemas hasil: satu berkas langsung, atau ZIP + .m3u8 + .csv + metadata.json.
 */
async function packageResults({ jobDir, files, entries, bundleAsZip, opts, rawOptions, runtime, isPreview, failures = [], isDemo = false, zipBaseName }) {
  if (files.length === 0) {
    throw new MediaEngineError('NO_OUTPUT', 'Tidak ada file media yang dihasilkan.', { status: 422 });
  }
  if (bundleAsZip || files.length > 1) {
    const zip = new JSZip();
    for (const fname of files) {
      zip.file(fname, await fs.readFile(path.join(jobDir, fname)));
    }
    const ext = path.extname(files[0]).replace(/^\./, '') || opts.audioFormat || 'mp3';
    zip.file('00 - Daftar Putar.m3u8', buildM3u8Playlist(entries, { ext }));
    zip.file('00 - Info Playlist.csv', buildPlaylistCsv(entries));
    zip.file(
      '00 - Metadata.json',
      JSON.stringify(
        {
          generator: 'Nawa Editor yt-dlp/FFmpeg Engine',
          ytdlpVersion: runtime.ytdlpVersion,
          ffmpegVersion: runtime.ffmpegVersion,
          downloadedAt: new Date().toISOString(),
          mode: opts.mode,
          format: opts.mode === 'audio' ? opts.audioFormat : opts.videoFormat,
          trackCount: files.length,
          previewOnly: Boolean(isPreview),
          demo: Boolean(isDemo),
          skipped: failures,
          tracks: entries,
        },
        null,
        2
      )
    );
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    const zipFilename = sanitizeSafeFilename(
      rawOptions.customTitle || zipBaseName || (isDemo ? 'Album Harmoni Nusantara (Full Playlist)' : 'Nawa-Playlist-Bundle'),
      'nawa-playlist',
      'zip'
    );
    return {
      buffer: zipBuffer,
      filename: zipFilename,
      mimeType: 'application/zip',
      size: zipBuffer.length,
      isZip: true,
      fileCount: files.length,
      files,
      isPreview: Boolean(isPreview),
      skippedCount: failures.length,
      demo: Boolean(isDemo),
    };
  }

  const singleFile = files[0];
  const buffer = await fs.readFile(path.join(jobDir, singleFile));
  const ext = path.extname(singleFile).replace(/^\./, '').toLowerCase();
  const finalName = rawOptions.customTitle && !isPreview
    ? sanitizeSafeFilename(rawOptions.customTitle, 'nawa-media', ext)
    : sanitizeSafeFilename(singleFile, 'nawa-media', ext);
  return {
    buffer,
    filename: finalName,
    mimeType: getMimeByExtension(singleFile),
    size: buffer.length,
    isZip: false,
    fileCount: 1,
    files: [finalName],
    isPreview: Boolean(isPreview),
    skippedCount: failures.length,
    demo: Boolean(isDemo),
  };
}

function listJobFiles(jobDir) {
  return fs.readdir(jobDir).then((names) => names
    .filter((f) => !f.startsWith('_in_') && !f.endsWith('.part') && !f.endsWith('.ytdl') && !f.endsWith('.tmp'))
    .sort());
}

/**
 * Mengunduh & mengonversi media (lagu tunggal, video, subtitle, cover, atau Full Playlist ZIP).
 * Lihat header berkas untuk aturan jalur.
 */
/** Deteksi galat jaringan keluar (TLS/DNS/timeout) dari keluaran yt-dlp. Dipakai route & runtime. */
export const NETWORK_ERROR_RE = /SSL_ERROR_SYSCALL|SSLError|TLS\/SSL connection|Connection reset|Connection refused|timed out|Unable to download (webpage|API page)|Name or service not known|Failed to resolve|getaddrinfo|Network is unreachable|Max retries exceeded|TransportError/i;
export function isNetworkErrorText(text) {
  return NETWORK_ERROR_RE.test(String(text || ''));
}

export async function downloadWithYtdlp(rawOptions = {}) {
  const parsedRaw = parseMediaInput(rawOptions.url || rawOptions.input || '');
  const tracksMeta = sanitizeTracksMeta(rawOptions.tracksMeta);
  const hasBrowserStream = Boolean(
    (tracksMeta && tracksMeta.some((t) => t.streamBase64))
    || (typeof rawOptions.clientStreamBase64 === 'string' && rawOptions.clientStreamBase64.length > 0)
  );
  // Stream dari browser sudah cukup untuk konversi; URL hanya wajib bila tidak ada stream.
  if (!parsedRaw.valid && !hasBrowserStream) {
    throw new MediaEngineError('INVALID_INPUT', parsedRaw.error || 'Target unduhan tidak valid.');
  }
  const parsed = parsedRaw.valid
    ? parsedRaw
    : { valid: false, kind: 'none', items: [], primaryUrl: '', platform: null, isPlaylist: false, searchQuery: '' };

  const runtime = await ensureYtdlpRuntime();
  if (!runtime.ready) {
    throw new MediaEngineError(
      'YTDLP_UNAVAILABLE',
      `Mesin yt-dlp belum tersedia di server. ${runtime.setupHint || ''}`.trim(),
      { status: 503, extra: { diagnosis: runtime.diagnosis } }
    );
  }
  if (!runtime.ffmpegAvailable) {
    throw new MediaEngineError('FFMPEG_UNAVAILABLE', FFMPEG_UNAVAILABLE_MESSAGE, {
      status: 503,
      extra: { diagnosis: runtime.diagnosis },
    });
  }

  const opts = sanitizeYtdlpOptions(rawOptions);
  const bundleAsZip = Boolean(rawOptions.bundleAsZip)
    || (parsed.isPlaylist && opts.playlistMode !== 'single')
    || Boolean(tracksMeta && tracksMeta.length > 1);
  const isDemo = parsed.kind === 'demo' || parsed.items.some((i) => /^demo:/i.test(i));
  const streams = isDemo ? [] : collectBrowserStreams(rawOptions, tracksMeta, parsed);

  const jobId = crypto.randomUUID();
  const jobDir = path.join('/tmp', `nawa-ytdlp-job-${jobId}`);
  await fs.mkdir(jobDir, { recursive: true });

  try {
    // JALUR 1 — Demo eksplisit (diberi label demo oleh server).
    if (isDemo) {
      return await downloadDemo({ parsed, rawOptions, opts, runtime, tracksMeta, bundleAsZip, jobDir });
    }

    // JALUR 2 — Stream nyata dari browser (lagu pencarian/Spotify memakai pratinjau 30 detik berlabel).
    if (streams.length > 0) {
      const { outputs, failures: convertFailures } = await convertBrowserStreams({ streams, jobDir, opts, runtime, rawOptions });
      // Item antrean tanpa stream dicatat sebagai dilewati (bukan dihilangkan diam-diam).
      const missingFailures = (tracksMeta || [])
        .filter((t) => tracksMeta.length > 1 && !t.streamBase64)
        .map((t) => ({
          index: t.index,
          title: t.title || `Track ${t.index}`,
          reason: 'Tidak ada stream audio dari browser untuk item ini.',
        }));
      const failures = [...missingFailures, ...convertFailures];
      const isZip = bundleAsZip || outputs.length > 1;
      const files = outputs.map((o) => o.filename);
      const entries = outputs.map((o) => o.entry);
      return await packageResults({
        jobDir,
        files,
        entries,
        bundleAsZip: isZip,
        opts,
        rawOptions,
        runtime,
        isPreview: outputs.some((o) => o.isPreview),
        failures,
      });
    }

    // Spotify: tidak ada jalur audio penuh. Hanya metadata/tracklist/pratinjau (lihat jalur 2).
    if (parsed.platform === 'spotify') {
      throw new MediaEngineError(
        'SPOTIFY_FULL_AUDIO_UNSUPPORTED',
        'Spotify hanya menyediakan metadata dan pratinjau 30 detik. Unduhan audio penuh dari Spotify tidak didukung. Gunakan hasil pencarian berlabel Preview atau ekspor tracklist.',
        { status: 422 }
      );
    }

    // JALUR 3 — URL publik lewat yt-dlp. Kegagalan dikembalikan apa adanya (tanpa fallback sintetis).
    await validateExternalTargets(parsed.items);
    return await downloadDirect({ parsed, rawOptions, opts, runtime, bundleAsZip, jobDir });
  } finally {
    await fs.rm(jobDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function runYtdlpWithEmbedFallback(runtime, ytdlpArgs) {
  await execFileAsync(runtime.ytdlpPath, ytdlpArgs, { timeout: 60000, maxBuffer: 25 * 1024 * 1024 }).catch(async (err) => {
    if (ytdlpArgs.includes('--embed-thumbnail')) {
      const fallbackArgs = ytdlpArgs.filter(
        (a, idx) => a !== '--embed-thumbnail' && a !== '--convert-thumbnails' && ytdlpArgs[idx - 1] !== '--convert-thumbnails'
      );
      await execFileAsync(runtime.ytdlpPath, fallbackArgs, { timeout: 60000, maxBuffer: 25 * 1024 * 1024 });
      return;
    }
    throw err;
  });
}

async function downloadDirect({ parsed, rawOptions, opts, runtime, bundleAsZip, jobDir }) {
  const outputTemplate = bundleAsZip
    ? path.join(jobDir, '%(playlist_index)02d - %(title)s.%(ext)s')
    : path.join(jobDir, '%(title)s.%(ext)s');

  const ytdlpArgs = [
    '--socket-timeout', '5',
    ...buildYtdlpArgs(
      { ...opts, url: parsed.items.join('\n') },
      { ffmpegLocation: runtime.ffmpegDir, outputTemplate, isPlaylist: bundleAsZip }
    ),
  ];

  await runYtdlpWithEmbedFallback(runtime, ytdlpArgs);
  const files = await listJobFiles(jobDir);
  if (files.length === 0) {
    throw new MediaEngineError('NO_OUTPUT', 'yt-dlp selesai tetapi tidak menghasilkan berkas media.', { status: 422 });
  }
  const entries = files.map((f, i) => ({
    index: i + 1,
    title: path.basename(f, path.extname(f)),
    uploader: rawOptions.customUploader || 'yt-dlp',
    duration: 0,
    durationText: '—',
    filename: f,
    url: parsed.items[i] || parsed.primaryUrl,
  }));
  return await packageResults({ jobDir, files, entries, bundleAsZip, opts, rawOptions, runtime, isPreview: false });
}

async function downloadDemo({ parsed, rawOptions, opts, runtime, tracksMeta, bundleAsZip, jobDir }) {
  return await withDemoMediaServer(runtime, async (port) => {
    const targetTracks = tracksMeta && tracksMeta.length > 0
      ? tracksMeta.map((t, i) => ({ ...t, title: t.title || DEMO_TRACKS[i % 3].title, uploader: t.uploader || DEMO_TRACKS[i % 3].uploader }))
      : bundleAsZip
        ? DEMO_TRACKS
        : [{
          id: '1',
          title: rawOptions.customTitle || (parsed.primaryUrl === 'demo:video' ? DEMO_TRACKS[2].title : DEMO_TRACKS[0].title),
          uploader: rawOptions.customUploader || 'Nawa Studio',
          album: rawOptions.customAlbum || 'Album Harmoni Nusantara',
          duration: parsed.primaryUrl === 'demo:video' ? 5 : 4,
        }];

    if (opts.mode === 'other' && (opts.otherFormat === 'subtitles' || opts.otherFormat === 'thumbnail')) {
      for (let i = 0; i < targetTracks.length; i += 1) {
        const tr = targetTracks[i];
        const baseId = String((i % 3) + 1);
        const prefix = targetTracks.length > 1 ? `${String(i + 1).padStart(2, '0')} - ` : '';
        if (opts.otherFormat === 'subtitles') {
          const vttContent = await fs.readFile(path.join(DEMO_DIR, `sub-${baseId}.vtt`), 'utf8');
          const srtContent = vttContent
            .replace(/^WEBVTT\s+/i, '')
            .trim()
            .split(/\n\n+/)
            .map((block, idx) => `${idx + 1}\n${block.replace(/\./g, ',')}`)
            .join('\n\n');
          const outName = sanitizeSafeFilename(`${prefix}${tr.title || `Track ${i + 1}`}`, `subtitle-${i + 1}`, 'srt');
          await fs.writeFile(path.join(jobDir, outName), `${srtContent}\n`, 'utf8');
        } else {
          const jpgBuf = await fs.readFile(path.join(DEMO_DIR, `cover-${baseId}.jpg`));
          const outName = sanitizeSafeFilename(`${prefix}${tr.title || `Track ${i + 1}`}`, `cover-${i + 1}`, 'jpg');
          await fs.writeFile(path.join(jobDir, outName), jpgBuf);
        }
      }
    } else {
      const localTargetUrl = targetTracks.length > 1 || (bundleAsZip && parsed.primaryUrl === 'demo:playlist')
        ? `http://127.0.0.1:${port}/playlist.rss`
        : mapDemoSlugToLocalUrl(parsed.primaryUrl, port);
      const outputTemplate = bundleAsZip
        ? path.join(jobDir, '%(playlist_index)02d - %(title)s.%(ext)s')
        : path.join(jobDir, '%(title)s.%(ext)s');
      const ytdlpArgs = buildYtdlpArgs(
        { ...opts, url: localTargetUrl },
        { ffmpegLocation: runtime.ffmpegDir, outputTemplate, isPlaylist: bundleAsZip }
      );
      await runYtdlpWithEmbedFallback(runtime, ytdlpArgs);
    }

    const files = await listJobFiles(jobDir);
    const entries = files.map((f, i) => {
      const meta = targetTracks[i] || DEMO_TRACKS[i % 3];
      return {
        index: i + 1,
        title: meta.title || path.basename(f, path.extname(f)),
        uploader: meta.uploader || 'Nawa Studio',
        duration: meta.duration || 4,
        durationText: `00:0${meta.duration || 4}`,
        filename: f,
        url: meta.slug || meta.url || parsed.primaryUrl,
      };
    });
    return await packageResults({ jobDir, files, entries, bundleAsZip, opts, rawOptions, runtime, isPreview: false, isDemo: true });
  });
}
