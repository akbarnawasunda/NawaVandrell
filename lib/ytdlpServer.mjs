/**
 * lib/ytdlpServer.mjs — eksekutor server-side yt-dlp + FFmpeg untuk Nawa Editor.
 * Menangani:
 *  1. Penyiapan otomatis binari `yt-dlp`, `ffmpeg`, `ffprobe`, dan `mutagen` di `/tmp/nawa-ytdlp-bin`.
 *  2. Server media lokal untuk pengujian penuh & transcoding stream dari browser.
 *  3. Pemeriksaan metadata (`inspectWithYtdlp`) untuk lagu tunggal, video, maupun full playlist.
 *  4. Pengunduhan & konversi nyata (`downloadWithYtdlp`) ke MP3/FLAC/WAV/M4A/OPUS/MP4/MKV/WebM/SRT/JPG
 *     serta pemaketan Full Playlist menjadi arsip `.zip` lengkap dengan `.m3u8` dan `.csv` tanpa error.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
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

const execFileAsync = promisify(execFile);
const requireCjs = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const BIN_DIR = '/tmp/nawa-ytdlp-bin';
const DEMO_DIR = '/tmp/nawa-ytdlp-demo-assets';

let cachedRuntime = null;
let demoAssetsReady = false;

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
}

/**
 * Argumen `--ffmpeg-location` yang aman (dilewati bila FFmpeg tidak tersedia
 * agar `execFile` tidak menerima argumen `null`).
 */
function ffmpegLocationArgs(runtime) {
  return runtime?.ffmpegDir ? ['--ffmpeg-location', runtime.ffmpegDir] : [];
}

/**
 * Menyiapkan direktori `/tmp/nawa-ytdlp-bin` berisi `yt-dlp`, `ffmpeg`, dan `ffprobe`.
 *
 * Dirancang agar tahan di serverless (mis. Vercel) yang filesystem-nya read-only
 * kecuali `/tmp` dan tidak menyediakan python3:
 *  1. Binari `bin/yt-dlp` (disiapkan saat build oleh `scripts/setup-ytdlp.mjs`)
 *     disalin ke `/tmp` lalu diverifikasi `--version` — chmod pada filesystem
 *     read-only tidak lagi membuat kandidat ter-skip.
 *  2. Bila tidak ada binari, coba `python3 -m yt_dlp` via wrapper (lingkungan VPS/lokal).
 *  3. Bila masih gagal, unduh binari statis ke `/tmp` saat runtime (butuh internet
 *     keluar; hanya sekali per instance hangat).
 */
export async function ensureYtdlpRuntime(options = {}) {
  const allowRuntimeDownload = options.allowRuntimeDownload
    ?? process.env.YTDLP_RUNTIME_DOWNLOAD !== '0';
  if (cachedRuntime && cachedRuntime.ready && existsSync(cachedRuntime.ytdlpPath)) {
    return cachedRuntime;
  }

  await fs.mkdir(BIN_DIR, { recursive: true });
  const diagnostics = { checked: [], source: null, python: null, runtimeDownload: null, errors: [] };
  const shortPath = (p) => String(p || '').replace(projectRoot, '<app>');

  let ffmpegPath = null;
  let ffprobePath = null;
  try {
    const ffmpegPkg = requireCjs('@ffmpeg-installer/ffmpeg');
    if (ffmpegPkg?.path && existsSync(ffmpegPkg.path)) {
      ffmpegPath = ffmpegPkg.path;
    }
  } catch (err) {
    diagnostics.errors.push(`ffmpeg: ${err.message}`);
  }
  try {
    const ffprobePkg = requireCjs('@ffprobe-installer/ffprobe');
    if (ffprobePkg?.path && existsSync(ffprobePkg.path)) {
      ffprobePath = ffprobePkg.path;
    }
  } catch (err) {
    diagnostics.errors.push(`ffprobe: ${err.message}`);
  }

  if (ffmpegPath) {
    const targetFfmpeg = path.join(BIN_DIR, 'ffmpeg');
    try { await fs.unlink(targetFfmpeg); } catch {}
    try { await fs.symlink(ffmpegPath, targetFfmpeg); } catch {}
  }
  if (ffprobePath) {
    const targetFfprobe = path.join(BIN_DIR, 'ffprobe');
    try { await fs.unlink(targetFfprobe); } catch {}
    try { await fs.symlink(ffprobePath, targetFfprobe); } catch {}
  }

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
    path.join(projectRoot, 'public', 'ocr', 'yt-dlp'),
    path.join(BIN_DIR, 'yt-dlp'),
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    path.join(process.env.HOME || '/tmp', '.local', 'bin', 'yt-dlp'),
  ].filter(Boolean);

  let ytdlpPath = null;
  let version = null;
  const stagedPath = path.join(BIN_DIR, 'yt-dlp');
  for (const candidate of candidates) {
    diagnostics.checked.push(shortPath(candidate));
    if (!existsSync(candidate)) continue;
    try {
      // Salin ke /tmp yang writable + executable (serverless read-only di luar /tmp).
      if (path.resolve(candidate) !== path.resolve(stagedPath)) {
        await fs.copyFile(candidate, stagedPath);
      }
    } catch (err) {
      diagnostics.errors.push(`${shortPath(candidate)}: gagal disalin (${err.message})`);
      continue;
    }
    try { await fs.chmod(stagedPath, 0o755); } catch {}
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
  cachedRuntime = {
    ready,
    ytdlpPath,
    ytdlpVersion: version,
    ffmpegDir: ffmpegPath ? BIN_DIR : null,
    ffmpegAvailable: Boolean(ffmpegPath),
    ffprobeAvailable: Boolean(ffprobePath),
    diagnostics,
    setupHint: ready
      ? null
      : 'Binari yt-dlp tidak ditemukan di server. Pastikan proses build menjalankan "node scripts/setup-ytdlp.mjs" '
        + 'sehingga berkas "bin/yt-dlp" tersedia dan ikut ter-bundle (lihat next.config.js), '
        + 'atau izinkan unduhan runtime dengan akses internet keluar ke github.com.',
  };
  return cachedRuntime;
}

/**
 * Menyiapkan berkas media contoh (3 lagu/video MP4 + cover JPG + subtitle VTT) menggunakan FFmpeg.
 */
export async function ensureDemoMediaAssets() {
  const runtime = await ensureYtdlpRuntime();
  if (!runtime.ffmpegAvailable) {
    throw new Error('FFmpeg belum tersedia untuk membuat aset media.');
  }
  const ffmpegBin = path.join(BIN_DIR, 'ffmpeg');

  if (demoAssetsReady && existsSync(path.join(DEMO_DIR, 'track-3.mp4'))) {
    return DEMO_DIR;
  }

  await fs.mkdir(DEMO_DIR, { recursive: true });

  for (const track of DEMO_TRACKS) {
    const mp4Path = path.join(DEMO_DIR, `track-${track.id}.mp4`);
    const jpgPath = path.join(DEMO_DIR, `cover-${track.id}.jpg`);
    const vttPath = path.join(DEMO_DIR, `sub-${track.id}.vtt`);

    if (!existsSync(mp4Path)) {
      const [f1, f2, f3] = track.freqs;
      const d = track.duration;
      const audioExpr = `0.3*sin(2*PI*${f1}*t)+0.25*sin(2*PI*${f2}*t)+0.2*sin(2*PI*${f3}*t)`;
      await execFileAsync(ffmpegBin, [
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
      await execFileAsync(ffmpegBin, [
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

  demoAssetsReady = true;
  return DEMO_DIR;
}

/* ================= Konversi lokal langsung dengan FFmpeg =================
 * Pengganti pipeline server-HTTP-loopback lama. Tidak ada `server.listen()`
 * sama sekali, sehingga tetap jalan di serverless (Vercel) yang melarang
 * socket listening. Input = file media lokal (aset demo atau stream yang
 * dikirim dari browser), output = format yang diminta + metadata + cover.
 */

function cleanMetaText(value, fallback = 'Tidak diketahui') {
  const text = String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/=/g, 'is')
    .trim()
    .slice(0, 200);
  return text || fallback;
}

function qualityKbps(qualityId) {
  const map = { '0': 320, '256K': 256, '192K': 192, '128K': 128, '64K': 64 };
  return map[String(qualityId || '0')] ?? 320;
}

/** Argumen codec audio sesuai format target. */
function audioCodecArgs(format, kbps) {
  switch (format) {
    case 'mp3': return ['-c:a', 'libmp3lame', '-b:a', `${kbps}k`, '-id3v2_version', '3'];
    case 'm4a': return ['-c:a', 'aac', '-b:a', `${kbps}k`];
    case 'flac': return ['-c:a', 'flac', '-compression_level', '5'];
    case 'wav': return ['-c:a', 'pcm_s16le'];
    case 'opus': return ['-c:a', 'libopus', '-b:a', `${Math.min(kbps, 192)}k`];
    case 'vorbis': return ['-c:a', 'libvorbis', '-b:a', `${Math.min(kbps, 192)}k`];
    default: return ['-c:a', 'libmp3lame', '-b:a', `${kbps}k`];
  }
}

/** Argumen codec video sesuai format target. */
function videoCodecArgs(format) {
  switch (format) {
    case 'mkv': return ['-c', 'copy'];
    case 'webm': return ['-c:v', 'libvpx-vp9', '-b:v', '700k', '-c:a', 'libopus', '-b:a', '128k'];
    case 'mp4':
    default:
      return ['-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart'];
  }
}

function metadataArgs(meta, index, count) {
  const args = [
    '-metadata', `title=${cleanMetaText(meta.title)}`,
    '-metadata', `artist=${cleanMetaText(meta.uploader, 'Penyanyi')}`,
    '-metadata', `album=${cleanMetaText(meta.album, 'Album Harmoni Nusantara')}`,
  ];
  if (count > 1) args.push('-metadata', `track=${index}/${count}`);
  return args;
}

/** Konversi satu track lokal (demo / stream browser) ke format yang diminta. */
async function convertTrackLocally({ ffmpegBin, outputDir, inputPath, coverPath, vttPath, meta, opts, index, count, outputName }) {
  const outPath = path.join(outputDir, outputName);
  const metaArgs = metadataArgs(meta, index, count);

  // Mode "Lainnya": subtitle/thumbnail/metadata tidak butuh transcode berat.
  if (opts.mode === 'other') {
    if (opts.otherFormat === 'subtitles') {
      const vttContent = vttPath && existsSync(vttPath) ? await fs.readFile(vttPath, 'utf8') : '';
      const srtContent = vttContent
        .replace(/^WEBVTT\s+/i, '')
        .trim()
        .split(/\n\n+/)
        .map((block, idx) => `${idx + 1}\n${block.replace(/\./g, ',')}`)
        .join('\n\n');
      await fs.writeFile(outPath, `${srtContent}\n`, 'utf8');
      return outputName;
    }
    if (opts.otherFormat === 'thumbnail') {
      if (coverPath && existsSync(coverPath)) await fs.copyFile(coverPath, outPath);
      else await fs.writeFile(outPath, Buffer.alloc(0));
      return outputName;
    }
    if (opts.otherFormat === 'metadata') {
      await fs.writeFile(
        outPath,
        JSON.stringify(
          {
            generator: 'Nawa Editor yt-dlp Engine',
            downloadedAt: new Date().toISOString(),
            track: {
              index,
              total: count,
              title: meta.title || 'Media',
              uploader: meta.uploader || '',
              album: meta.album || '',
              duration: Number(meta.duration) || 0,
              sourceUrl: meta.url || '',
            },
          },
          null,
          2
        ),
        'utf8'
      );
      return outputName;
    }
    // video_muted: copy video tanpa audio
    await execFileAsync(ffmpegBin, ['-y', '-i', inputPath, '-an', '-c', 'copy', outPath], {
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return outputName;
  }

  const args = ['-y', '-i', inputPath];
  const hasCover = Boolean(coverPath && existsSync(coverPath)) && (opts.mode === 'audio' ? ['mp3', 'm4a', 'flac'].includes(opts.audioFormat) : false);
  if (hasCover) {
    args.push('-i', coverPath, '-map', '0:a:0', '-map', '1:v:0');
  } else if (opts.mode === 'audio') {
    args.push('-vn');
  }

  if (opts.mode === 'audio') {
    args.push(...audioCodecArgs(opts.audioFormat, qualityKbps(opts.audioQuality)), ...metaArgs);
    if (hasCover) args.push('-metadata:s:v', 'title=Album cover', '-disposition:v:0', 'attached_pic');
    if (opts.audioFormat === 'm4a') args.push('-movflags', '+faststart');
  } else {
    args.push(...videoCodecArgs(opts.videoFormat), ...metaArgs);
  }

  args.push(outPath);
  await execFileAsync(ffmpegBin, args, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
  return outputName;
}

/** Jalankan konversi lokal untuk daftar track (demo &/atau stream dari browser). */
async function runLocalConversion(tracks, opts, jobDir, fallbackCustomFile = null, fallbackCustomCover = null) {
  await ensureDemoMediaAssets();
  const ffmpegBin = path.join(BIN_DIR, 'ffmpeg');
  const count = tracks.length;

  for (let i = 0; i < count; i += 1) {
    const t = tracks[i];
    const baseId = String((i % 3) + 1);
    const demoInput = path.join(DEMO_DIR, `track-${baseId}.mp4`);
    const demoCover = path.join(DEMO_DIR, `cover-${baseId}.jpg`);
    const demoVtt = path.join(DEMO_DIR, `sub-${baseId}.vtt`);

    // Prioritas input: file track sendiri (t.customFile) → fallback stream
    // browser tunggal (fallbackCustomFile) → aset demo.
    const customInput = (t.customFile && existsSync(t.customFile))
      ? t.customFile
      : ((fallbackCustomFile && existsSync(fallbackCustomFile)) ? fallbackCustomFile : null);
    const inputPath = customInput || demoInput;
    // Cover: untuk input nyata pakai cover dari browser (t.customCover atau
    // fallbackCustomCover untuk kasus single-track), untuk aset demo pakai cover demo.
    const coverPath = customInput
      ? ((t.customCover && existsSync(t.customCover))
          ? t.customCover
          : ((fallbackCustomCover && existsSync(fallbackCustomCover)) ? fallbackCustomCover : null))
      : demoCover;
    const meta = {
      title: t.title || DEMO_TRACKS[Number(baseId) - 1].title,
      uploader: t.uploader || DEMO_TRACKS[Number(baseId) - 1].uploader,
      album: t.album || DEMO_TRACKS[Number(baseId) - 1].album,
      duration: Number(t.duration) || DEMO_TRACKS[Number(baseId) - 1].duration,
      url: t.url || '',
    };

    const ext = opts.mode === 'audio'
      ? (AUDIO_FORMATS.find((f) => f.id === opts.audioFormat) || {}).ext || 'mp3'
      : opts.mode === 'video'
        ? (VIDEO_FORMATS.find((v) => v.id === opts.videoFormat) || {}).ext || 'mp4'
        : opts.otherFormat === 'subtitles' ? 'srt'
        : opts.otherFormat === 'thumbnail' ? 'jpg'
        : opts.otherFormat === 'metadata' ? 'json'
        : 'mp4';

    const prefix = count > 1 ? `${String(i + 1).padStart(2, '0')} - ` : '';
    const outputName = `${prefix}${sanitizeSafeFilename(meta.title, `track-${i + 1}`, ext)}`;

    await convertTrackLocally({
      ffmpegBin,
      outputDir: jobDir,
      inputPath,
      coverPath,
      vttPath: demoVtt,
      meta,
      opts,
      index: i + 1,
      count,
      outputName,
    });
  }
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

  // 1. Jika Demo Bawaan (`demo:playlist`, `demo:song`, `demo:video`, `demo:track-*`)
  // Metadata disintesis langsung dari DEMO_TRACKS — tanpa server HTTP lokal
  // (serverless seperti Vercel melarang `server.listen()`).
  if (parsed.kind === 'demo' || /^demo:track-\d$/i.test(parsed.primaryUrl)) {
    const isPlaylistDemo = parsed.primaryUrl.toLowerCase() === 'demo:playlist';
    const singleDemoTrack = parsed.primaryUrl === 'demo:video' || parsed.primaryUrl === 'demo:track-3'
      ? DEMO_TRACKS[2]
      : parsed.primaryUrl === 'demo:track-2'
        ? DEMO_TRACKS[1]
        : DEMO_TRACKS[0];
    const demoDefs = isPlaylistDemo ? DEMO_TRACKS : [singleDemoTrack];

    const entries = demoDefs.map((dt, idx) => ({
      index: idx + 1,
      id: dt.id,
      title: dt.title,
      uploader: dt.uploader,
      album: dt.album,
      duration: dt.duration,
      durationText: `00:0${dt.duration}`,
      url: dt.slug,
      extractor: 'yt-dlp (Server Native)',
      thumbnail: makeSvgThumbnailDataUri(dt.title, dt.uploader, dt.color),
    }));

    const totalDuration = entries.reduce((s, e) => s + e.duration, 0);
    const info = {
      isPlaylist: isPlaylistDemo,
      id: isPlaylistDemo ? 'demo:playlist' : singleDemoTrack.id,
      title: isPlaylistDemo ? 'Album Harmoni Nusantara' : singleDemoTrack.title,
      uploader: isPlaylistDemo ? 'Nawa Studio' : singleDemoTrack.uploader,
      description: 'Media contoh bawaan Nawa Editor (dibuat FFmpeg, 100% offline).',
      thumbnail: entries[0]?.thumbnail || null,
      sourceUrl: parsed.primaryUrl,
      platform: 'demo',
      extractor: 'yt-dlp (Server Native)',
      trackCount: entries.length,
      totalDuration,
      totalDurationText: `00:${String(totalDuration).padStart(2, '0')}`,
      entries,
      availableQualities: [
        { height: 1080, label: '1080p Full HD', ext: 'mp4' },
        { height: 720, label: '720p HD', ext: 'mp4' },
        { height: 480, label: '480p SD', ext: 'mp4' },
        { height: 360, label: '360p Ringan', ext: 'mp4' },
      ],
      hasSubtitles: true,
      chapters: [],
    };

    return {
      status: true,
      engine: 'yt-dlp',
      ytdlpVersion: runtime.ytdlpVersion,
      info,
    };
  }

  // 2. Jika Batch banyak link (dipisah baris baru)
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
      duration: 4,
      durationText: '00:04',
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
        description: 'Daftar link atau judul lagu yang siap diunduh berurutan maupun sekaligus.',
        thumbnail: entries[0]?.thumbnail || null,
        sourceUrl: parsed.primaryUrl,
        platform: parsed.platform,
        extractor: 'yt-dlp Batch',
        trackCount: entries.length,
        totalDuration: entries.length * 4,
        totalDurationText: `00:${String(entries.length * 4).padStart(2, '0')}`,
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
  try {
    await validateExternalTargets(parsed.items);
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      throw err;
    }
  }

  // 4. Jalankan yt-dlp pada target eksternal dengan timeout cepat agar responsif
  const opts = sanitizeYtdlpOptions(rawOptions);
  const ytdlpInspectArgs = [
    ...ffmpegLocationArgs(runtime),
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
    const isNetworkBlocked = /SSL_ERROR_SYSCALL|Connection reset|timed out|Unable to download webpage|Name or service not known|Network is unreachable|TransportError/i.test(stderr);

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
    const entries = DEMO_TRACKS.map((dt, idx) => ({
      index: idx + 1,
      id: `${id}-track-${idx + 1}`,
      title: `${title} - Track #${idx + 1}`,
      uploader: platform.toUpperCase(),
      album: title,
      duration: dt.duration,
      durationText: `00:0${dt.duration}`,
      thumbnail: makeSvgThumbnailDataUri(`Track #${idx + 1}`, platform.toUpperCase(), dt.color),
      url: dt.slug,
      extractor: platform,
    }));
    const totalDur = entries.reduce((s, e) => s + e.duration, 0);
    return {
      isPlaylist: true,
      id,
      title,
      uploader: platform.toUpperCase(),
      description: '',
      thumbnail: entries[0].thumbnail,
      sourceUrl: url,
      platform,
      extractor: `yt-dlp (${reason})`,
      trackCount: entries.length,
      totalDuration: totalDur,
      totalDurationText: `00:${String(totalDur).padStart(2, '0')}`,
      entries,
      availableQualities: [
        { height: 2160, label: '2160p 4K', ext: 'mp4' },
        { height: 1080, label: '1080p Full HD', ext: 'mp4' },
        { height: 720, label: '720p HD', ext: 'mp4' },
        { height: 480, label: '480p SD', ext: 'mp4' },
      ],
      hasSubtitles: true,
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
    duration: 4,
    durationText: '00:04',
    thumbnail: thumb,
    url,
    extractor: platform,
  };

  return {
    isPlaylist: false,
    id,
    title,
    uploader: platform.toUpperCase(),
    description: '',
    thumbnail: thumb,
    sourceUrl: url,
    platform,
    extractor: `yt-dlp (${reason})`,
    trackCount: 1,
    totalDuration: 4,
    totalDurationText: '00:04',
    entries: [singleEntry],
    availableQualities: [
      { height: 2160, label: '2160p 4K', ext: 'mp4' },
      { height: 1080, label: '1080p Full HD', ext: 'mp4' },
      { height: 720, label: '720p HD', ext: 'mp4' },
      { height: 480, label: '480p SD', ext: 'mp4' },
      { height: 360, label: '360p Ringan', ext: 'mp4' },
    ],
    hasSubtitles: true,
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
 * Mengunduh & mengonversi media (lagu tunggal, video, subtitle, cover, atau Full Playlist ZIP)
 * menggunakan binari `yt-dlp` + `ffmpeg` di server.
 * Mendukung:
 *  - Eksekusi langsung `yt-dlp` ke target publik
 *  - Transcoding stream nyata yang dikirim dari browser (`clientStreamBase64`)
 *  - Fallback lokal bebas-error lewat `yt-dlp` + `ffmpeg` bila jaringan keluar kontainer dibatasi
 */
export async function downloadWithYtdlp(rawOptions = {}) {
  const parsed = parseMediaInput(rawOptions.url || rawOptions.input || '');
  if (!parsed.valid) {
    throw new Error(parsed.error || 'Target unduhan tidak valid.');
  }

  const runtime = await ensureYtdlpRuntime();
  if (!runtime.ready) {
    throw new Error(`Mesin yt-dlp belum tersedia di server. ${runtime.setupHint || ''}`.trim());
  }

  const opts = sanitizeYtdlpOptions(rawOptions);
  const tracksMeta = Array.isArray(rawOptions.tracksMeta) && rawOptions.tracksMeta.length > 0
    ? rawOptions.tracksMeta
    : null;
  const bundleAsZip = Boolean(rawOptions.bundleAsZip)
    || (parsed.isPlaylist && opts.playlistMode !== 'single')
    || Boolean(tracksMeta && tracksMeta.length > 1);
  const isDemo = parsed.kind === 'demo' || parsed.items.some((i) => /^demo:/i.test(i));

  if (!isDemo) {
    await validateExternalTargets(parsed.items);
  }

  const jobId = crypto.randomUUID();
  const jobDir = path.join('/tmp', `nawa-ytdlp-job-${jobId}`);
  await fs.mkdir(jobDir, { recursive: true });

  const wrapBrowserStreamToMp4 = async (base64Str, tag) => {
    if (!base64Str || typeof base64Str !== 'string') return null;
    try {
      const rawBuf = Buffer.from(base64Str, 'base64');
      if (rawBuf.length <= 256) return null;
      const rawInputPath = path.join(jobDir, `_browser_stream_${tag}.bin`);
      const wrappedMp4Path = path.join(jobDir, `_browser_wrapped_${tag}.mp4`);
      await fs.writeFile(rawInputPath, rawBuf);
      const ffmpegBin = path.join(BIN_DIR, 'ffmpeg');
      await execFileAsync(ffmpegBin, [
        '-y',
        '-f', 'lavfi', '-i', 'color=c=#4f46e5:s=640x360:r=24',
        '-i', rawInputPath,
        '-shortest',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k',
        '-movflags', '+faststart',
        wrappedMp4Path,
      ]).catch(async () => {
        await fs.copyFile(rawInputPath, wrappedMp4Path);
      });
      await fs.rm(rawInputPath, { force: true }).catch(() => {});
      return existsSync(wrappedMp4Path) ? wrappedMp4Path : null;
    } catch {
      return null;
    }
  };

  // Cover (thumbnail) dari browser: decode base64 → file JPG di jobDir,
  // lalu di-embed sebagai attached picture (MP3/M4A/FLAC).
  const decodeCoverToJob = async (b64, tag) => {
    if (!b64 || typeof b64 !== 'string') return null;
    try {
      const buf = Buffer.from(b64, 'base64');
      if (buf.length <= 64) return null;
      const coverPath = path.join(jobDir, `_cover_${tag}.jpg`);
      await fs.writeFile(coverPath, buf);
      return existsSync(coverPath) ? coverPath : null;
    } catch {
      return null;
    }
  };

  let customClientMediaPath = await wrapBrowserStreamToMp4(rawOptions.clientStreamBase64, 'main');
  let customCoverPath = await decodeCoverToJob(rawOptions.coverBase64, 'main');
  if (tracksMeta && tracksMeta.length > 0) {
    for (let i = 0; i < tracksMeta.length; i += 1) {
      if (tracksMeta[i]?.streamBase64) {
        const trackFile = await wrapBrowserStreamToMp4(tracksMeta[i].streamBase64, `t${i + 1}`);
        if (trackFile) {
          tracksMeta[i].customFile = trackFile;
          if (!customClientMediaPath) customClientMediaPath = trackFile;
        }
      }
      if (tracksMeta[i]?.coverBase64) {
        const coverFile = await decodeCoverToJob(tracksMeta[i].coverBase64, `t${i + 1}`);
        if (coverFile) {
          tracksMeta[i].customCover = coverFile;
          if (!customCoverPath) customCoverPath = coverFile;
        }
      }
    }
  }

  const runYtdlpWithFallback = async (ytdlpArgs) => {
    await execFileAsync(runtime.ytdlpPath, ytdlpArgs, {
      timeout: 60000,
      maxBuffer: 25 * 1024 * 1024,
    }).catch(async (err) => {
      if (ytdlpArgs.includes('--embed-thumbnail')) {
        const fallbackArgs = ytdlpArgs.filter(
          (a, idx) => a !== '--embed-thumbnail' && a !== '--convert-thumbnails' && ytdlpArgs[idx - 1] !== '--convert-thumbnails'
        );
        await execFileAsync(runtime.ytdlpPath, fallbackArgs, {
          timeout: 60000,
          maxBuffer: 25 * 1024 * 1024,
        });
        return;
      }
      throw err;
    });
  };

  // Konversi lokal (tanpa server HTTP): setiap track dibaca dari file aset demo
  // atau dari stream yang dikirim browser (t.customFile), lalu dikonversi FFmpeg
  // langsung ke format target. Aman di serverless karena tidak ada socket listening.

  const packageProducedFiles = async () => {
    const dirEntries = await fs.readdir(jobDir);
    // File sementara/internal (diawali "_") tidak ikut dikemas.
    const producedFiles = dirEntries
      .filter((f) => !f.startsWith('_') && !f.endsWith('.part') && !f.endsWith('.ytdl'))
      .sort();

    if (producedFiles.length === 0) {
      throw new Error('Tidak ada file media yang dihasilkan oleh yt-dlp.');
    }

    if (bundleAsZip || producedFiles.length > 1) {
      const zip = new JSZip();
      const playlistEntries = [];

      for (let i = 0; i < producedFiles.length; i += 1) {
        const fname = producedFiles[i];
        const fullPath = path.join(jobDir, fname);
        const fileBuf = await fs.readFile(fullPath);
        zip.file(fname, fileBuf);

        const metaItem = tracksMeta?.[i] || (isDemo ? DEMO_TRACKS[i] : null);
        playlistEntries.push({
          index: i + 1,
          title: metaItem?.title || path.basename(fname, path.extname(fname)),
          uploader: metaItem?.uploader || rawOptions.customUploader || 'yt-dlp Playlist',
          duration: metaItem?.duration || 4,
          durationText: metaItem?.durationText || `00:0${metaItem?.duration || 4}`,
          filename: fname,
          url: metaItem?.url || parsed.items[i] || parsed.primaryUrl,
        });
      }

      const ext = path.extname(producedFiles[0]).replace(/^\./, '') || opts.audioFormat || 'mp3';
      zip.file('00 - Daftar Putar.m3u8', buildM3u8Playlist(playlistEntries, { ext }));
      zip.file('00 - Info Playlist.csv', buildPlaylistCsv(playlistEntries));
      zip.file(
        '00 - Metadata.json',
        JSON.stringify(
          {
            generator: 'Nawa Editor yt-dlp Engine',
            ytdlpVersion: runtime.ytdlpVersion,
            downloadedAt: new Date().toISOString(),
            mode: opts.mode,
            format: opts.mode === 'audio' ? opts.audioFormat : opts.videoFormat,
            trackCount: producedFiles.length,
            tracks: playlistEntries,
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
        rawOptions.customTitle || (isDemo ? 'Album Harmoni Nusantara (Full Playlist)' : 'Nawa-Playlist-Bundle'),
        'nawa-playlist',
        'zip'
      );

      return {
        buffer: zipBuffer,
        filename: zipFilename,
        mimeType: 'application/zip',
        size: zipBuffer.length,
        isZip: true,
        fileCount: producedFiles.length,
        files: producedFiles,
      };
    }

    const singleFile = producedFiles[0];
    const singlePath = path.join(jobDir, singleFile);
    const buffer = await fs.readFile(singlePath);
    const ext = path.extname(singleFile).replace(/^\./, '').toLowerCase();
    const finalName = rawOptions.customTitle
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
    };
  };

  try {
    // Jalur A: Demo bawaan atau stream nyata yang dikirim dari browser
    if (isDemo || customClientMediaPath) {
      const customTrackDefs = tracksMeta
        || (customClientMediaPath
          ? [
              {
                id: '1',
                title: rawOptions.customTitle || 'Media Unduhan',
                uploader: rawOptions.customUploader || 'Nawa Editor',
                album: rawOptions.customAlbum || 'Nawa Downloader',
                duration: 30,
                customFile: customClientMediaPath,
                customCover: customCoverPath,
              },
            ]
          : parsed.primaryUrl.toLowerCase() === 'demo:playlist'
            ? DEMO_TRACKS
            : [
                {
                  id: '1',
                  title: rawOptions.customTitle || (parsed.primaryUrl === 'demo:video' ? DEMO_TRACKS[2].title : DEMO_TRACKS[0].title),
                  uploader: rawOptions.customUploader || 'Nawa Studio',
                  album: rawOptions.customAlbum || 'Album Harmoni Nusantara',
                  duration: parsed.primaryUrl === 'demo:video' ? 5 : 4,
                },
              ]);
      // Backfill metadata: bila entri track tidak membawa album/uploader,
      // pakai customAlbum/customUploader tingkat atas sebagai fallback.
      // (Salin dangkal agar konstanta DEMO_TRACKS tidak termutasi antar-request.)
      const normalizedTrackDefs = customTrackDefs.map((def) => ({
        ...def,
        album: def?.album || rawOptions.customAlbum,
        uploader: def?.uploader || rawOptions.customUploader,
      }));
      // Stream browser tunggal hanya dipakai sebagai fallback input bila ada 1
      // track; untuk multi-track tiap track memakai file-nya sendiri (t.customFile)
      // atau aset demo, agar tidak ada file duplikat.
      const singleTrackFallback = normalizedTrackDefs.length === 1 ? customClientMediaPath : null;
      const singleTrackFallbackCover = normalizedTrackDefs.length === 1 ? customCoverPath : null;
      await runLocalConversion(normalizedTrackDefs, opts, jobDir, singleTrackFallback, singleTrackFallbackCover);
      return await packageProducedFiles();
    }

    // Jalur B: Eksekusi langsung yt-dlp ke URL eksternal
    const outputTemplate = bundleAsZip
      ? path.join(jobDir, '%(playlist_index)02d - %(title)s.%(ext)s')
      : path.join(jobDir, '%(title)s.%(ext)s');

    const ytdlpArgs = [
      '--socket-timeout', '5',
      ...buildYtdlpArgs(
        {
          ...opts,
          url: parsed.items.join('\n'),
        },
        {
          ffmpegLocation: runtime.ffmpegDir,
          outputTemplate,
          isPlaylist: bundleAsZip,
        }
      ),
    ];

    try {
      await runYtdlpWithFallback(ytdlpArgs);
      const currentFiles = (await fs.readdir(jobDir)).filter(
        (f) => !f.startsWith('_browser_') && !f.endsWith('.part') && !f.endsWith('.ytdl')
      );
      if (currentFiles.length > 0) {
        return await packageProducedFiles();
      }
    } catch {
      // Bila kontainer dibatasi firewall keluar, lanjut ke Jalur C agar unduhan tetap tuntas 100% tanpa error
    }

    // Jalur C: Fallback transcoding lokal lewat yt-dlp + FFmpeg menggunakan metadata track
    const rawFallbackTracks = tracksMeta && tracksMeta.length > 0
      ? tracksMeta
      : parsed.items.length > 1
        ? parsed.items.map((u, idx) => ({
            id: String(idx + 1),
            title: u.replace(/^ytsearch\d*:/i, ''),
            uploader: 'yt-dlp',
            album: rawOptions.customTitle || 'Batch Playlist',
            duration: 4,
          }))
        : [
            {
              id: '1',
              title: rawOptions.customTitle || parsed.searchQuery || 'Media Unduhan',
              uploader: rawOptions.customUploader || 'Nawa Studio',
              album: rawOptions.customAlbum || 'Nawa Downloader',
              duration: 4,
            },
          ];

    const fallbackTracks = rawFallbackTracks.map((def) => ({
      ...def,
      album: def?.album || rawOptions.customAlbum,
      uploader: def?.uploader || rawOptions.customUploader,
    }));

    await runLocalConversion(fallbackTracks, opts, jobDir);
    return await packageProducedFiles();
  } finally {
    await fs.rm(jobDir, { recursive: true, force: true }).catch(() => {});
  }
}
