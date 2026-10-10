/**
 * lib/ffmpegRuntime.mjs — deteksi, verifikasi, dan argumen konversi FFmpeg untuk Nawa Editor.
 *
 * Modul ini sengaja tanpa dependensi ke state server (cache, env global), agar bisa dipakai:
 *  - oleh runtime server (`lib/ytdlpServer.mjs`) saat menentukan binari yang benar-benar bisa dieksekusi;
 *  - oleh `scripts/setup-ffmpeg.mjs` saat build, untuk menyalin binari ke `bin/ffmpeg`
 *    yang lalu ikut ter-bundle ke serverless function lewat `outputFileTracingIncludes`;
 *  - oleh tes unit.
 *
 * Catatan penting: keberadaan berkas di disk BUKAN jaminan binari bisa dijalankan di function.
 * Karena itu setiap kandidat diverifikasi dengan menjalankannya (`-version`, `-encoders`).
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { createRequire } from 'node:module';

const execFileAsync = promisify(execFile);

/** Encoder yang WAJIB ada agar konversi MP3 dan M4A/AAC bisa berjalan. */
export const FFMPEG_REQUIRED_ENCODERS = ['libmp3lame', 'aac'];

/** Encoder tambahan yang dicatat untuk diagnosis (tidak wajib). */
export const FFMPEG_OPTIONAL_ENCODERS = ['libx264', 'flac', 'libopus', 'libvorbis', 'pcm_s16le', 'libvpx'];

/** Kunci platform sesuai penamaan paket `@ffmpeg-installer/<os>-<arch>`. */
export function platformKey(platform = process.platform, arch = process.arch) {
  return `${platform}-${arch}`;
}

/**
 * Membaca daftar encoder dari keluaran `ffmpeg -encoders`.
 * Baris encoder berformat: " V....D libx264  H.264 ..." (6 kolom bendera, lalu nama).
 * @param {string} text
 * @returns {Set<string>}
 */
export function parseEncoderNames(text) {
  const names = new Set();
  for (const line of String(text || '').split('\n')) {
    const m = line.match(/^\s*[A-Z.]{6}\s+([a-z][a-z0-9_]*)\b/);
    if (m) names.add(m[1]);
  }
  return names;
}

/**
 * Mengurai info stream dari stderr `ffmpeg -i <berkas>` (tanpa output).
 * Dipakai untuk mengetahui apakah stream punya video, codec-nya, dan durasinya,
 * tanpa perlu ffprobe.
 * @param {string} stderr
 * @returns {{ hasAudio: boolean, audioCodec: string|null, hasVideo: boolean, videoCodec: string|null, durationSec: number|null }}
 */
export function parseFfmpegInputInfo(stderr) {
  const text = String(stderr || '');
  const audio = text.match(/Stream #\d+:\d+[^\n]*?Audio:\s*([A-Za-z0-9_]+)/);
  const video = text.match(/Stream #\d+:\d+[^\n]*?Video:\s*([A-Za-z0-9_]+)/);
  const dur = text.match(/Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/);
  let durationSec = null;
  if (dur) {
    const total = Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]);
    durationSec = Number.isFinite(total) && total > 0 ? total : null;
  }
  return {
    hasAudio: Boolean(audio),
    audioCodec: audio ? audio[1] : null,
    hasVideo: Boolean(video),
    videoCodec: video ? video[1] : null,
    durationSec,
  };
}

/**
 * Daftar kandidat lokasi FFmpeg, urut prioritas. Tiap kandidat: { source, path }.
 * Kandidat `FFMPEG_PATH` (env) selalu paling depan agar bisa dipaksa oleh operator.
 */
export function ffmpegCandidates({
  env = process.env,
  projectRoot = null,
  cwd = process.cwd(),
  platform = process.platform,
  arch = process.arch,
  resolveInstaller = resolveInstallerBinary,
} = {}) {
  const list = [];
  if (env.FFMPEG_PATH) list.push({ source: 'env:FFMPEG_PATH', path: env.FFMPEG_PATH });
  if (projectRoot) list.push({ source: 'bin/ffmpeg (build)', path: path.join(projectRoot, 'bin', 'ffmpeg') });
  if (cwd) list.push({ source: 'bin/ffmpeg (cwd)', path: path.join(cwd, 'bin', 'ffmpeg') });
  const installed = resolveInstaller('@ffmpeg-installer', 'ffmpeg', platform, arch);
  if (installed) list.push({ source: `@ffmpeg-installer/${platformKey(platform, arch)}`, path: installed });
  for (const dir of String(env.PATH || '').split(path.delimiter)) {
    if (dir) list.push({ source: 'PATH', path: path.join(dir, 'ffmpeg') });
  }
  list.push({ source: '/usr/bin/ffmpeg', path: '/usr/bin/ffmpeg' });
  list.push({ source: '/usr/local/bin/ffmpeg', path: '/usr/local/bin/ffmpeg' });

  // Buang duplikat path (pertahankan kandidat pertama).
  const seen = new Set();
  return list.filter((c) => {
    const key = path.resolve(c.path);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Menemukan binari dari paket `@ffmpeg-installer/<platform>` atau `@ffprobe-installer/<platform>`.
 * Mengembalikan null bila paket tidak terpasang (mis. platform tidak didukung).
 */
export function resolveInstallerBinary(scope, name, platform = process.platform, arch = process.arch) {
  const spec = `${scope}/${platformKey(platform, arch)}/package.json`;
  // Urutan penting: pada bundel Next, `import.meta.url` menunjuk ke path SAAT BUILD (mis. /vercel/path0),
  // sedangkan function berjalan dari cwd-nya (Vercel: /var/task). Karena itu cwd dicoba lebih dulu.
  const starts = [path.join(process.cwd(), 'package.json'), import.meta.url];
  for (const start of starts) {
    try {
      const req = createRequire(start);
      const pkgJson = req.resolve(spec);
      return path.join(path.dirname(pkgJson), name);
    } catch {
      // coba lokasi berikutnya
    }
  }
  return null;
}

function firstLine(text) {
  return String(text || '').split('\n').map((s) => s.trim()).find(Boolean) || '';
}

/**
 * Menjalankan binari FFmpeg untuk memastikan benar-benar bisa dieksekusi dan memiliki encoder wajib.
 * @param {string} binPath
 * @param {{ timeout?: number }} [opts]
 * @returns {Promise<{ ok: boolean, version: string|null, encoders: string[], missingEncoders: string[], reason: string|null }>}
 */
export async function probeFfmpegBinary(binPath, { timeout = 15000 } = {}) {
  let versionText = '';
  let encoderText = '';
  try {
    const v = await execFileAsync(binPath, ['-hide_banner', '-version'], { timeout, maxBuffer: 1024 * 1024 });
    versionText = String(v.stdout || '');
    const e = await execFileAsync(binPath, ['-hide_banner', '-encoders'], { timeout, maxBuffer: 8 * 1024 * 1024 });
    encoderText = String(e.stdout || '');
  } catch (err) {
    const detail = firstLine(err?.stderr) || firstLine(err?.message) || 'tidak diketahui';
    return {
      ok: false,
      version: null,
      encoders: [],
      missingEncoders: [...FFMPEG_REQUIRED_ENCODERS],
      reason: `tidak dapat dijalankan (${detail})`,
    };
  }

  const version = firstLine(versionText).replace(/^ffmpeg version\s*/i, '').split(' Copyright')[0] || null;
  const names = parseEncoderNames(encoderText);
  const missingEncoders = FFMPEG_REQUIRED_ENCODERS.filter((name) => !names.has(name));
  const present = [...FFMPEG_REQUIRED_ENCODERS, ...FFMPEG_OPTIONAL_ENCODERS].filter((name) => names.has(name));
  if (missingEncoders.length > 0) {
    return {
      ok: false,
      version,
      encoders: present,
      missingEncoders,
      reason: `encoder wajib tidak tersedia: ${missingEncoders.join(', ')}`,
    };
  }
  return { ok: true, version, encoders: present, missingEncoders: [], reason: null };
}

/**
 * Menyusun argumen FFmpeg untuk mengonversi stream (hasil unduhan browser) menjadi format tujuan.
 * Pure function: tidak menyentuh disk. Melempar Error berkode bila kombinasi tidak didukung.
 *
 * @param {object} p
 * @param {string} p.input        path berkas masukan
 * @param {string} p.output       path berkas keluaran (ekstensi menentukan muxer)
 * @param {'audio'|'video'} p.mode
 * @param {string} p.audioFormat  mp3 | m4a | flac | wav | opus | vorbis
 * @param {string} p.audioBitrate contoh '320k'; diabaikan untuk codec lossless
 * @param {string} p.videoFormat  mp4 | mkv | webm
 * @param {object} p.info         hasil parseFfmpegInputInfo
 * @param {{ title?: string, artist?: string, album?: string, comment?: string, track?: string }} [p.metadata]
 * @param {number|null} [p.clipStart] detik
 * @param {number|null} [p.clipEnd]   detik
 * @returns {string[]}
 */
export function buildConversionArgs({
  input,
  output,
  mode,
  audioFormat = 'mp3',
  audioBitrate = '320k',
  videoFormat = 'mp4',
  info,
  metadata = {},
  clipStart = null,
  clipEnd = null,
}) {
  const args = ['-hide_banner', '-nostdin', '-loglevel', 'error', '-y'];
  if (Number.isFinite(clipStart) && clipStart > 0) args.push('-ss', String(clipStart));
  args.push('-i', input);
  if (Number.isFinite(clipEnd) && clipEnd > 0 && (!Number.isFinite(clipStart) || clipEnd > clipStart)) {
    args.push('-to', String(clipEnd));
  }

  if (mode === 'video') {
    if (!info?.hasVideo) {
      const err = new Error('Stream dari browser hanya berisi audio. Pilih mode Audio untuk unduhan ini.');
      err.code = 'STREAM_AUDIO_ONLY';
      throw err;
    }
    args.push('-map', '0:v:0', '-map', '0:a:0?');
    if (videoFormat === 'webm') {
      args.push('-c:v', 'libvpx', '-b:v', '0', '-crf', '32', '-c:a', 'libopus', '-b:a', '128k');
    } else {
      const h264 = /^h264$/i.test(info.videoCodec || '');
      if (h264) args.push('-c:v', 'copy');
      else args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p');
      args.push('-c:a', 'aac', '-b:a', '192k');
      if (videoFormat === 'mp4') args.push('-movflags', '+faststart');
    }
  } else {
    args.push('-map', '0:a:0', '-vn');
    switch (audioFormat) {
      case 'flac':
        args.push('-c:a', 'flac');
        break;
      case 'wav':
        args.push('-c:a', 'pcm_s16le');
        break;
      case 'm4a':
        args.push('-c:a', 'aac', '-b:a', audioBitrate, '-movflags', '+faststart');
        break;
      case 'opus':
        args.push('-c:a', 'libopus', '-b:a', audioBitrate === '320k' ? '160k' : audioBitrate);
        break;
      case 'vorbis':
        args.push('-c:a', 'libvorbis', '-q:a', '6');
        break;
      case 'mp3':
      default:
        args.push('-c:a', 'libmp3lame', '-b:a', audioBitrate);
        break;
    }
  }

  args.push('-map_metadata', '-1');
  for (const [key, value] of Object.entries(metadata)) {
    if (value) args.push('-metadata', `${key}=${String(value).replace(/[\r\n]/g, ' ')}`);
  }
  args.push(output);
  return args;
}

/** Mengubah id kualitas audio (mis. '0', '256K') menjadi bitrate FFmpeg. */
export function audioQualityToBitrate(id) {
  const map = { '0': '320k', '256K': '256k', '192K': '192k', '128K': '128k', '64K': '64k' };
  return map[String(id)] || '320k';
}

/**
 * Menjalankan FFmpeg dengan argumen yang sudah disusun. Melempar Error berisi ekor stderr bila gagal.
 * @returns {Promise<void>}
 */
export async function runFfmpeg(binPath, args, { timeout = 120000 } = {}) {
  try {
    await execFileAsync(binPath, args, { timeout, maxBuffer: 8 * 1024 * 1024 });
  } catch (err) {
    const tail = String(err?.stderr || err?.message || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(-3)
      .join(' | ');
    const e = new Error(`FFmpeg gagal mengonversi: ${tail || 'tanpa keterangan'}`);
    e.code = 'FFMPEG_CONVERT_FAILED';
    throw e;
  }
}

/**
 * Membaca info stream dengan menjalankan `ffmpeg -i`. Keluaran stderr diurai; exit code 1 itu normal.
 * @returns {Promise<ReturnType<typeof parseFfmpegInputInfo>>}
 */
export async function probeInputWithFfmpeg(binPath, inputPath) {
  let stderr = '';
  try {
    await execFileAsync(binPath, ['-hide_banner', '-nostdin', '-i', inputPath], { timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
  } catch (err) {
    stderr = String(err?.stderr || '');
  }
  return parseFfmpegInputInfo(stderr);
}
