#!/usr/bin/env node
/**
 * scripts/ytdlp-cli.mjs — CLI Nawa Editor berbasis yt-dlp + FFmpeg.
 * Contoh penggunaan:
 *   npm run ytdlp -- demo:playlist --mode audio --format mp3
 *   npm run ytdlp -- "https://www.youtube.com/playlist?list=..." --mode audio --format mp3
 *   npm run ytdlp -- "https://www.youtube.com/watch?v=..." --mode video --resolution 1080
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureYtdlpRuntime, inspectWithYtdlp, downloadWithYtdlp } from '../lib/ytdlpServer.mjs';

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log([
      'Nawa Editor — yt-dlp Full Playlist & Media Downloader CLI',
      '',
      'Penggunaan:',
      '  npm run ytdlp -- <URL atau Kata Kunci atau demo:playlist> [opsi]',
      '',
      'Opsi:',
      '  --mode <audio|video|other>       Mode unduhan (default: audio)',
      '  --format <mp3|m4a|flac|wav|opus> Format audio (default: mp3)',
      '  --video-format <mp4|mkv|webm>    Format kontainer video (default: mp4)',
      '  --resolution <2160|1080|720|480> Resolusi video (default: 1080)',
      '  --playlist <full|range|single>   Mode playlist (default: full)',
      '  --range <1-10>                   Rentang nomor track playlist',
      '  --out <folder>                   Folder tujuan penyimpanan (default: ./downloads)',
      '  --info                           Hanya tampilkan info metadata tanpa mengunduh',
    ].join('\n'));
    return;
  }

  const getFlag = (flag, fallback) => {
    const idx = args.indexOf(flag);
    if (idx !== -1 && args[idx + 1]) return args[idx + 1];
    return fallback;
  };

  const target = args.find((a) => !a.startsWith('-')) || 'demo:playlist';
  const mode = getFlag('--mode', 'audio');
  const audioFormat = getFlag('--format', 'mp3');
  const videoFormat = getFlag('--video-format', 'mp4');
  const videoResolution = getFlag('--resolution', '1080');
  const playlistMode = getFlag('--playlist', 'full');
  const playlistRange = getFlag('--range', '');
  const outDir = path.resolve(process.cwd(), getFlag('--out', './downloads'));
  const infoOnly = args.includes('--info');

  const rt = await ensureYtdlpRuntime();
  console.log(`[yt-dlp] Engine siap: v${rt.ytdlpVersion} (FFmpeg: ${rt.ffmpegAvailable ? 'Aktif' : 'Tidak ada'})`);

  if (infoOnly) {
    const infoRes = await inspectWithYtdlp(target, { playlistMode, playlistRange });
    console.log(JSON.stringify(infoRes.info, null, 2));
    return;
  }

  console.log(`[yt-dlp] Memproses target: ${target} (mode: ${mode})...`);
  const result = await downloadWithYtdlp({
    url: target,
    mode,
    audioFormat,
    videoFormat,
    videoResolution,
    playlistMode,
    playlistRange,
  });

  await fs.mkdir(outDir, { recursive: true });
  const destPath = path.join(outDir, result.filename);
  await fs.writeFile(destPath, result.buffer);
  console.log(`[SELESAI] Tersimpan: ${destPath} (${(result.size / 1024).toFixed(1)} KB, ${result.fileCount} file)`);
}

main().catch((err) => {
  console.error('[ERROR]', err.message || err);
  process.exit(1);
});
