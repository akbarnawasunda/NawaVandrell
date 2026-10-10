/**
 * Tes integrasi jalur unduhan YANG DIPERBAIKI (FFmpeg nyata, tanpa demo, tanpa fallback sintetis).
 *
 * Fixture dibuat dengan FFmpeg yang sama dengan runtime, lalu dikirim sebagai `clientStreamBase64`
 * seperti yang dilakukan browser untuk pratinjau iTunes/TikTok/X. Hasil diverifikasi dengan FFmpeg
 * (codec, durasi, metadata), jadi bukti "bisa dibuat dan dibaca FFmpeg" tidak hanya dari ukuran berkas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';

import {
  ensureYtdlpRuntime,
  downloadWithYtdlp,
  resetYtdlpRuntimeCache,
  sanitizeTracksMeta,
  inspectWithYtdlp,
} from '../lib/ytdlpServer.mjs';
import { probeInputWithFfmpeg } from '../lib/ffmpegRuntime.mjs';

const execFileAsync = promisify(execFile);

async function makeWorkDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'nawa-stream-test-'));
}

/** Membuat audio AAC 3 detik (mirip pratinjau iTunes) memakai FFmpeg runtime. */
async function makeAudioFixture(ffmpegBin, dir, { title = 'Fixture Uji', seconds = 3 } = {}) {
  const out = path.join(dir, 'preview-fixture.m4a');
  await execFileAsync(ffmpegBin, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}`,
    '-c:a', 'aac', '-b:a', '128k',
    '-metadata', `title=${title}`,
    out,
  ]);
  return out;
}

async function makeVideoFixture(ffmpegBin, dir) {
  const out = path.join(dir, 'clip-fixture.mp4');
  await execFileAsync(ffmpegBin, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'testsrc=duration=2:size=320x240:rate=15',
    '-f', 'lavfi', '-i', 'sine=frequency=330:duration=2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
    '-shortest', out,
  ]);
  return out;
}

/** Membaca metadata (stderr `ffmpeg -i`) untuk memastikan tag artis/judul yang benar. */
async function readFfmpegStderr(ffmpegBin, file) {
  try {
    await execFileAsync(ffmpegBin, ['-hide_banner', '-i', file]);
    return '';
  } catch (err) {
    return String(err.stderr || '');
  }
}

async function requireRuntime() {
  resetYtdlpRuntimeCache();
  const rt = await ensureYtdlpRuntime({ force: true });
  assert.equal(rt.ready, true, 'yt-dlp harus siap');
  assert.equal(rt.ffmpegAvailable, true, `FFmpeg harus siap untuk tes ini: ${JSON.stringify(rt.diagnosis)}`);
  return rt;
}

test('status: FFmpeg siap dibaca runtime, downloadEnabled true, dan diagnosis menyebut FFmpeg', async () => {
  const rt = await requireRuntime();
  assert.equal(rt.downloadEnabled, true);
  assert.ok(rt.ffmpegPath && rt.ffmpegPath.endsWith('ffmpeg'));
  assert.ok(rt.ffmpegVersion, 'versi FFmpeg harus terbaca');
  assert.ok(rt.ffmpegEncoders.includes('libmp3lame'));
  const ffDiag = rt.diagnosis.find((d) => d.id === 'ffmpeg');
  assert.equal(ffDiag.level, 'ok');
  assert.ok(Array.isArray(rt.diagnostics.ffmpeg) && rt.diagnostics.ffmpeg.some((c) => c.result === 'ok'));
});

test('lagu biasa dari stream pratinjau: MP3 nyata dengan label Preview, bukan aset demo', async () => {
  const rt = await requireRuntime();
  const dir = await makeWorkDir();
  try {
    const fixture = await makeAudioFixture(rt.ffmpegPath, dir);
    const b64 = (await fs.readFile(fixture)).toString('base64');

    const res = await downloadWithYtdlp({
      clientStreamBase64: b64,
      customTitle: 'Senja di Jakarta',
      customUploader: 'Penyanyi Uji',
      customAlbum: 'Album Uji',
      url: 'ytsearch1:Senja di Jakarta',
      mode: 'audio',
      audioFormat: 'mp3',
      audioQuality: '0',
      playlistMode: 'single',
      isPreview: true,
    });

    assert.equal(res.isZip, false);
    assert.equal(res.mimeType, 'audio/mpeg');
    assert.equal(res.demo, false);
    assert.equal(res.isPreview, true);
    assert.match(res.filename, /Senja di Jakarta \(Preview 30 detik\)\.mp3$/);

    const outPath = path.join(dir, 'out.mp3');
    await fs.writeFile(outPath, res.buffer);
    const info = await probeInputWithFfmpeg(rt.ffmpegPath, outPath);
    assert.equal(info.hasAudio, true);
    assert.equal(info.audioCodec, 'mp3');
    assert.ok(info.durationSec >= 2.5 && info.durationSec <= 3.5, `durasi tidak sesuai fixture 3 dtk: ${info.durationSec}`);

    const meta = await readFfmpegStderr(rt.ffmpegPath, outPath);
    assert.match(meta, /artist\s*:\s*Penyanyi Uji/);
    assert.match(meta, /comment\s*:\s*Preview 30 detik/);
    assert.ok(!/Nawa Studio|Album Harmoni Nusantara/.test(meta), 'metadata tidak boleh berasal dari aset demo');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

for (const [fmt, codec] of [
  ['mp3', 'mp3'],
  ['m4a', 'aac'],
  ['flac', 'flac'],
  ['wav', 'pcm_s16le'],
  ['opus', 'opus'],
  ['vorbis', 'vorbis'],
]) {
  test(`konversi stream ke ${fmt} menghasilkan audio yang dapat dibaca FFmpeg (codec ${codec})`, async () => {
    const rt = await requireRuntime();
    const dir = await makeWorkDir();
    try {
      const fixture = await makeAudioFixture(rt.ffmpegPath, dir);
      const res = await downloadWithYtdlp({
        clientStreamBase64: (await fs.readFile(fixture)).toString('base64'),
        customTitle: `Uji ${fmt}`,
        mode: 'audio',
        audioFormat: fmt,
        audioQuality: '192K',
        playlistMode: 'single',
      });
      const outPath = path.join(dir, `out.${fmt}`);
      await fs.writeFile(outPath, res.buffer);
      const info = await probeInputWithFfmpeg(rt.ffmpegPath, outPath);
      assert.equal(info.hasAudio, true);
      assert.equal(info.audioCodec, codec);
      assert.ok(info.durationSec >= 2.5 && info.durationSec <= 3.5);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
}

test('stream video dari browser diremux/ditranskode menjadi MP4 yang dapat dibaca', async () => {
  const rt = await requireRuntime();
  const dir = await makeWorkDir();
  try {
    const fixture = await makeVideoFixture(rt.ffmpegPath, dir);
    const res = await downloadWithYtdlp({
      clientStreamBase64: (await fs.readFile(fixture)).toString('base64'),
      customTitle: 'Klip Uji',
      mode: 'video',
      videoFormat: 'mp4',
      playlistMode: 'single',
    });
    assert.equal(res.mimeType, 'video/mp4');
    const outPath = path.join(dir, 'out.mp4');
    await fs.writeFile(outPath, res.buffer);
    const info = await probeInputWithFfmpeg(rt.ffmpegPath, outPath);
    assert.equal(info.hasVideo, true);
    assert.equal(info.videoCodec, 'h264');
    assert.equal(info.hasAudio, true);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('mode video dengan stream yang hanya audio ditolak dengan pesan jelas (bukan video palsu)', async () => {
  const rt = await requireRuntime();
  const dir = await makeWorkDir();
  try {
    const fixture = await makeAudioFixture(rt.ffmpegPath, dir);
    await assert.rejects(
      downloadWithYtdlp({
        clientStreamBase64: (await fs.readFile(fixture)).toString('base64'),
        customTitle: 'Bukan Video',
        mode: 'video',
        videoFormat: 'mp4',
        playlistMode: 'single',
      }),
      (err) => {
        assert.equal(err.code, 'STREAM_CONVERT_FAILED');
        assert.match(err.message, /hanya berisi audio/);
        return true;
      }
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('antrean ZIP: item dengan stream dikonversi, item tanpa stream dicatat sebagai dilewati', async () => {
  const rt = await requireRuntime();
  const dir = await makeWorkDir();
  try {
    const fixture = await makeAudioFixture(rt.ffmpegPath, dir);
    const b64 = (await fs.readFile(fixture)).toString('base64');
    const res = await downloadWithYtdlp({
      bundleAsZip: true,
      mode: 'audio',
      audioFormat: 'mp3',
      audioQuality: '0',
      customTitle: 'Antrean Uji',
      tracksMeta: [
        { index: 1, title: 'Lagu A', uploader: 'Artis A', album: 'Album A', duration: 30, isPreview: true, streamBase64: b64 },
        { index: 2, title: 'Lagu B', uploader: 'Artis B', album: 'Album A', duration: 30, isPreview: true, streamBase64: b64 },
        { index: 3, title: 'Lagu C tanpa stream', uploader: 'Artis C', album: 'Album A', duration: 30, isPreview: true },
      ],
    });
    assert.equal(res.isZip, true);
    assert.equal(res.isPreview, true);
    assert.equal(res.fileCount, 2);
    assert.equal(res.skippedCount, 1);
    assert.match(res.filename, /Antrean Uji\.zip$/);

    const zip = await JSZip.loadAsync(res.buffer);
    const names = Object.keys(zip.files);
    assert.equal(names.filter((n) => n.endsWith('.mp3')).length, 2);
    assert.ok(names.includes('00 - Daftar Putar.m3u8'));
    assert.ok(names.includes('00 - Info Playlist.csv'));
    const meta = JSON.parse(await zip.file('00 - Metadata.json').async('string'));
    assert.equal(meta.previewOnly, true);
    assert.equal(meta.demo, false);
    assert.equal(meta.skipped.length, 1);
    assert.match(meta.skipped[0].reason, /Tidak ada stream/);
    assert.ok(names.every((n) => !/Album Harmoni|Senja di Jakarta/.test(n)), 'nama berkas tidak boleh berasal dari demo');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('stream rusak menghasilkan galat konversi nyata, tidak menghasilkan berkas mentah berlabel media', async () => {
  await requireRuntime();
  const junk = Buffer.alloc(4096, 0x41).toString('base64');
  await assert.rejects(
    downloadWithYtdlp({ clientStreamBase64: junk, customTitle: 'Rusak', mode: 'audio', audioFormat: 'mp3', playlistMode: 'single' }),
    (err) => {
      assert.equal(err.code, 'STREAM_CONVERT_FAILED');
      assert.ok(!/aset media|demo/i.test(err.message));
      return true;
    }
  );
});

test('Spotify: tidak ada unduhan audio penuh tanpa pratinjau berlabel', async () => {
  await requireRuntime();
  await assert.rejects(
    downloadWithYtdlp({ url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', mode: 'audio', audioFormat: 'mp3' }),
    (err) => {
      assert.equal(err.code, 'SPOTIFY_FULL_AUDIO_UNSUPPORTED');
      assert.match(err.message, /pratinjau 30 detik/);
      return true;
    }
  );
});

test('klien tidak bisa menunjuk berkas lokal server lewat tracksMeta.customFile', () => {
  const sanitized = sanitizeTracksMeta([
    { title: 'x', customFile: '/etc/passwd', streamBase64: 'AAAA', isPreview: 'ya' },
  ]);
  assert.equal(sanitized[0].customFile, undefined);
  assert.equal(sanitized[0].isPreview, false, 'isPreview hanya boleh bernilai boolean true');
  const huge = sanitizeTracksMeta([{ title: 'besar', streamBase64: 'A'.repeat(12 * 1024 * 1024) }]);
  assert.equal(huge[0].streamBase64, null, 'stream di atas batas 8 MB harus dibuang');
});

test('tanpa FFmpeg: unduhan dinonaktifkan dengan galat FFMPEG_UNAVAILABLE, bukan "aset demo"', async () => {
  resetYtdlpRuntimeCache();
  try {
    const rt = await ensureYtdlpRuntime({ force: true, ffmpegCandidates: [] });
    assert.equal(rt.ffmpegAvailable, false);
    assert.equal(rt.downloadEnabled, false);
    assert.ok(rt.diagnosis.some((d) => d.id === 'ffmpeg' && d.level === 'error' && d.action));
    assert.ok(rt.diagnosis.some((d) => d.id === 'download' && d.level === 'error'));

    const junk = Buffer.alloc(2048, 1).toString('base64');
    const requests = [
      { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', mode: 'audio', audioFormat: 'mp3' },
      { url: 'ytsearch1:Hindia Evaluasi', clientStreamBase64: junk, mode: 'audio', audioFormat: 'mp3' },
      { url: 'demo:song', mode: 'audio', audioFormat: 'mp3' },
    ];
    for (const req of requests) {
      await assert.rejects(downloadWithYtdlp(req), (err) => {
        assert.equal(err.code, 'FFMPEG_UNAVAILABLE', `kode salah untuk ${req.url}: ${err.code}`);
        assert.equal(err.status, 503);
        assert.ok(!/aset media/i.test(err.message), 'pesan "aset media" tidak boleh muncul untuk unduhan biasa');
        assert.ok(err.extra.diagnosis, 'diagnosis harus ikut dikembalikan ke klien');
        return true;
      });
    }

    // Inspeksi metadata tetap berjalan tanpa FFmpeg (URL publik tetap tidak dipalsukan).
    const inspected = await inspectWithYtdlp('ytsearch1:Hindia Evaluasi');
    assert.equal(inspected.status, true);

    // Demo eksplisit memerlukan FFmpeg; inspeksi demo menyebut itu dengan jelas.
    await assert.rejects(inspectWithYtdlp('demo:playlist'), (err) => {
      assert.equal(err.code, 'FFMPEG_UNAVAILABLE');
      assert.match(err.message, /Demo memerlukan FFmpeg/);
      return true;
    });
  } finally {
    resetYtdlpRuntimeCache();
  }
});

test('galat TLS/DNS yt-dlp dikenali sebagai galat jaringan, galat video biasa tidak', async () => {
  const { isNetworkErrorText } = await import('../lib/ytdlpServer.mjs');
  assert.equal(isNetworkErrorText('ERROR: [youtube] x: Unable to download API page: TLS/SSL connection has been closed (EOF)'), true);
  assert.equal(isNetworkErrorText('Failed to resolve host: getaddrinfo ENOTFOUND'), true);
  assert.equal(isNetworkErrorText('ERROR: Video unavailable. This video is private'), false);
});

test('akar proyek & binari installer diambil dari cwd function, bukan path build yang dibekukan bundel', async () => {
  const { resolveProjectRoot } = await import('../lib/ytdlpServer.mjs');
  const { resolveInstallerBinary } = await import('../lib/ffmpegRuntime.mjs');
  const { platformKey } = await import('../lib/ffmpegRuntime.mjs');
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'nawa-cwd-'));
  const pkgDir = path.join(tmp, 'node_modules', '@ffmpeg-installer', platformKey());
  await fs.mkdir(pkgDir, { recursive: true });
  await fs.writeFile(path.join(pkgDir, 'package.json'), '{"name":"@ffmpeg-installer/x"}');
  await fs.writeFile(path.join(pkgDir, 'ffmpeg'), '#!/bin/sh\n');
  await fs.writeFile(path.join(tmp, 'package.json'), '{}');
  const prev = process.cwd();
  try {
    process.chdir(tmp);
    assert.equal(resolveProjectRoot(), tmp, 'akar proyek harus cwd (tempat bin/ hasil trace berada)');
    const found = resolveInstallerBinary('@ffmpeg-installer', 'ffmpeg');
    assert.equal(found, path.join(pkgDir, 'ffmpeg'), 'installer harus ditemukan lewat node_modules di cwd');
  } finally {
    process.chdir(prev);
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('Spotify: inspeksi fallback tidak menampilkan pilihan resolusi video (audio/metadata saja)', async () => {
  const { inspectWithYtdlp } = await import('../lib/ytdlpServer.mjs');
  // Jalur ini memakai kerangka hybrid tanpa jaringan: yt-dlp gagal -> buildStructuredFallbackInfo.
  const result = await inspectWithYtdlp('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', { playlistMode: 'single' });
  assert.equal(result.info.unverified, true);
  assert.deepEqual(result.info.availableQualities, []);
  assert.equal(result.info.hasSubtitles, false);
});
