#!/usr/bin/env node
/**
 * scripts/smoke-ytdlp-api.mjs — smoke test API /api/ytdlp terhadap server yang sedang berjalan.
 *
 *   node scripts/smoke-ytdlp-api.mjs --base http://127.0.0.1:3000
 *
 * Yang diuji (dan dilaporkan sebagai JSON):
 *  1. status      : yt-dlp & FFmpeg siap, downloadEnabled, diagnosis.
 *  2. stream MP3  : stream pratinjau (fixture audio AAC) dikonversi server → MP3 berlabel Preview.
 *  3. stream MP4  : fixture video dikirim sebagai stream → MP4.
 *  4. demo        : `demo:song` eksplisit → MP3 demo berlabel demo (bukti FFmpeg server bekerja).
 *  5. URL publik  : URL yt-dlp biasa. Hasil yang diharapkan: berkas nyata ATAU galat nyata
 *                   (jaringan dibatasi). TIDAK BOLEH berupa berkas demo/sintetis.
 *
 * Verifikasi berkas dilakukan dengan FFmpeg terpisah (env FFMPEG_BIN, atau binari paket installer),
 * sehingga hasil tidak bergantung pada logika yang sedang diuji.
 * Fixture dibuat dengan FFmpeg yang sama. Tidak ada media sintetis yang dikirim sebagai pengganti URL nyata.
 */

import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const execFileAsync = promisify(execFile);
const args = process.argv.slice(2);
const baseIdx = args.indexOf('--base');
const BASE = (baseIdx >= 0 ? args[baseIdx + 1] : process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const publicUrlIdx = args.indexOf('--public-url');
const PUBLIC_URL = publicUrlIdx >= 0 ? args[publicUrlIdx + 1] : 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

function resolveVerifierFfmpeg() {
  if (process.env.FFMPEG_BIN) return process.env.FFMPEG_BIN;
  const req = createRequire(import.meta.url);
  try {
    return path.join(path.dirname(req.resolve('@ffmpeg-installer/linux-x64/package.json')), 'ffmpeg');
  } catch {
    return 'ffmpeg';
  }
}
const VERIFIER = resolveVerifierFfmpeg();

async function ffmpegInfo(file) {
  let stderr = '';
  try {
    await execFileAsync(VERIFIER, ['-hide_banner', '-i', file], { maxBuffer: 4 * 1024 * 1024 });
  } catch (err) {
    stderr = String(err.stderr || '');
  }
  const audio = stderr.match(/Audio:\s*([A-Za-z0-9_]+)/);
  const video = stderr.match(/Video:\s*([A-Za-z0-9_]+)/);
  const dur = stderr.match(/Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/);
  const durationSec = dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : null;
  // Verifikasi bahwa FFmpeg benar-benar bisa men-decode berkas sampai akhir (bukan sekadar header).
  let decodeOk = false;
  let decodeErr = '';
  try {
    await execFileAsync(VERIFIER, ['-hide_banner', '-v', 'error', '-i', file, '-f', 'null', '-'], { timeout: 60000 });
    decodeOk = true;
  } catch (err) {
    decodeErr = String(err.stderr || err.message || '').split('\n').filter(Boolean).slice(-1)[0] || 'gagal';
  }
  return { audioCodec: audio ? audio[1] : null, videoCodec: video ? video[1] : null, durationSec, decodeOk, decodeErr, stderr };
}

async function post(body) {
  const res = await fetch(`${BASE}/api/ytdlp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return { status: res.status, json: await res.json(), headers: res.headers };
  }
  return { status: res.status, buffer: Buffer.from(await res.arrayBuffer()), headers: res.headers };
}

const results = [];
function record(name, ok, details) {
  results.push({ name, ok, ...details });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${name}`);
  for (const [k, v] of Object.entries(details)) {
    if (k === 'stderr') continue;
    console.log(`       ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
  }
}

async function main() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nawa-smoke-'));
  console.log(`Base: ${BASE}`);
  console.log(`Verifier FFmpeg: ${VERIFIER}`);

  // 1. Status
  const statusRes = await fetch(`${BASE}/api/ytdlp?action=status`, { cache: 'no-store' });
  const statusJson = await statusRes.json();
  const rt = statusJson.runtime || {};
  record('status: yt-dlp & FFmpeg siap', rt.ready === true && rt.ffmpegAvailable === true && rt.downloadEnabled === true, {
    httpStatus: statusRes.status,
    ytdlpVersion: rt.ytdlpVersion,
    ffmpegVersion: rt.ffmpegVersion,
    ffmpegSource: rt.ffmpegSource,
    downloadEnabled: rt.downloadEnabled,
    diagnosis: (rt.diagnosis || []).map((d) => `${d.id}:${d.level}`).join(', '),
  });
  if (!rt.ffmpegAvailable) {
    console.log(JSON.stringify(rt.diagnosis, null, 2));
    console.log('FFmpeg belum siap; pengujian unduhan dilewati.');
    return finish(dir);
  }

  // Fixture (dibuat oleh FFmpeg verifier, identik secara fungsi dengan pratinjau iTunes AAC 30 dtk).
  const audioFixture = path.join(dir, 'preview.m4a');
  await execFileAsync(VERIFIER, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:a', 'aac', '-b:a', '128k', audioFixture]);
  const audioB64 = (await fs.readFile(audioFixture)).toString('base64');

  // 2. Stream pratinjau → MP3
  const mp3 = await post({
    action: 'download',
    url: 'ytsearch1:Senja di Jakarta',
    mode: 'audio',
    audioFormat: 'mp3',
    audioQuality: '0',
    playlistMode: 'single',
    customTitle: 'Senja di Jakarta',
    customUploader: 'Penyanyi Uji',
    isPreview: true,
    clientStreamBase64: audioB64,
  });
  if (mp3.buffer) {
    const p = path.join(dir, 'stream.mp3');
    await fs.writeFile(p, mp3.buffer);
    const info = await ffmpegInfo(p);
    const label = /Preview 30 detik/.test(decodeURIComponent(mp3.headers.get('x-ytdlp-filename') || ''));
    record('stream pratinjau → MP3 (FFmpeg server)', mp3.status === 200 && info.audioCodec === 'mp3' && info.decodeOk && label && mp3.headers.get('x-nawa-preview') === '1', {
      httpStatus: mp3.status,
      filename: decodeURIComponent(mp3.headers.get('x-ytdlp-filename') || ''),
      bytes: mp3.buffer.length,
      audioCodec: info.audioCodec,
      durationSec: info.durationSec,
      decodeOk: info.decodeOk,
      labeledPreview: label,
      demoFlag: mp3.headers.get('x-nawa-demo'),
    });
  } else {
    record('stream pratinjau → MP3 (FFmpeg server)', false, { httpStatus: mp3.status, error: mp3.json?.error, code: mp3.json?.code });
  }

  // 3. Stream video → MP4
  const videoFixture = path.join(dir, 'clip.mp4');
  await execFileAsync(VERIFIER, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=320x240:rate=15', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', videoFixture]);
  const mp4 = await post({
    action: 'download',
    url: 'https://example.invalid/clip',
    mode: 'video',
    videoFormat: 'mp4',
    playlistMode: 'single',
    customTitle: 'Klip Uji',
    clientStreamBase64: (await fs.readFile(videoFixture)).toString('base64'),
  });
  if (mp4.buffer) {
    const p = path.join(dir, 'stream.mp4');
    await fs.writeFile(p, mp4.buffer);
    const info = await ffmpegInfo(p);
    record('stream video → MP4 (FFmpeg server)', mp4.status === 200 && info.videoCodec === 'h264' && info.decodeOk, {
      httpStatus: mp4.status,
      bytes: mp4.buffer.length,
      videoCodec: info.videoCodec,
      audioCodec: info.audioCodec,
      durationSec: info.durationSec,
      decodeOk: info.decodeOk,
    });
  } else {
    record('stream video → MP4 (FFmpeg server)', false, { httpStatus: mp4.status, error: mp4.json?.error, code: mp4.json?.code });
  }

  // 4. Demo eksplisit
  const demo = await post({ action: 'download', url: 'demo:song', mode: 'audio', audioFormat: 'mp3', audioQuality: '0', playlistMode: 'single' });
  if (demo.buffer) {
    const p = path.join(dir, 'demo.mp3');
    await fs.writeFile(p, demo.buffer);
    const info = await ffmpegInfo(p);
    record('demo eksplisit (demo:song) → MP3', demo.status === 200 && info.audioCodec === 'mp3' && info.decodeOk && demo.headers.get('x-nawa-demo') === '1', {
      httpStatus: demo.status,
      filename: decodeURIComponent(demo.headers.get('x-ytdlp-filename') || ''),
      bytes: demo.buffer.length,
      audioCodec: info.audioCodec,
      durationSec: info.durationSec,
      demoFlag: demo.headers.get('x-nawa-demo'),
    });
  } else {
    record('demo eksplisit (demo:song) → MP3', false, { httpStatus: demo.status, error: demo.json?.error });
  }

  // 5. URL publik: berkas nyata ATAU galat nyata. Tidak boleh berkas demo.
  const pub = await post({ action: 'download', url: PUBLIC_URL, mode: 'audio', audioFormat: 'mp3', audioQuality: '0', playlistMode: 'single' });
  if (pub.buffer) {
    const p = path.join(dir, 'public.bin');
    await fs.writeFile(p, pub.buffer);
    const info = await ffmpegInfo(p);
    const isDemoArtifact = /Album Harmoni|Nawa Studio/.test(info.stderr) || pub.headers.get('x-nawa-demo') === '1';
    record('URL publik: berkas nyata (bukan demo)', !isDemoArtifact, {
      httpStatus: pub.status,
      filename: decodeURIComponent(pub.headers.get('x-ytdlp-filename') || ''),
      bytes: pub.buffer.length,
      audioCodec: info.audioCodec,
      isDemoArtifact,
    });
  } else {
    const msg = pub.json?.error || '';
    const honest = !/aset media|demo/i.test(msg) && Boolean(msg);
    record('URL publik: galat nyata (bukan demo/sintetis)', honest, {
      httpStatus: pub.status,
      code: pub.json?.code || null,
      networkRestricted: Boolean(pub.json?.networkRestricted),
      error: msg,
    });
  }

  return finish(dir);
}

async function finish(dir) {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ base: BASE, total: results.length, passed: results.length - failed.length, failed: failed.map((f) => f.name) }, null, 2));
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((err) => {
  console.error('Smoke test error:', err);
  process.exitCode = 1;
});

void execFileSync;
