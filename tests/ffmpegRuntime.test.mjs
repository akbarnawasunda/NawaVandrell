import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  parseEncoderNames,
  parseFfmpegInputInfo,
  buildConversionArgs,
  ffmpegCandidates,
  probeFfmpegBinary,
  resolveInstallerBinary,
  audioQualityToBitrate,
} from '../lib/ffmpegRuntime.mjs';

test('parseEncoderNames membaca nama encoder dari keluaran `ffmpeg -encoders` dan mengabaikan legenda', () => {
  const sample = [
    'Encoders:',
    ' V..... = Video',
    ' A..... = Audio',
    ' ------',
    ' V....D libx264              libx264 H.264 / AVC',
    ' A..... aac                  AAC (Advanced Audio Coding)',
    ' A....D libmp3lame           libmp3lame MP3',
  ].join('\n');
  const names = parseEncoderNames(sample);
  assert.ok(names.has('libx264'));
  assert.ok(names.has('aac'));
  assert.ok(names.has('libmp3lame'));
  assert.ok(!names.has('='), 'legenda "= Video" tidak boleh dianggap encoder');
  assert.equal(names.size, 3);
});

test('parseFfmpegInputInfo mengurai codec audio/video dan durasi dari stderr `ffmpeg -i`', () => {
  const audio = [
    "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'preview.m4a':",
    '  Duration: 00:00:03.02, start: 0.000000, bitrate: 88 kb/s',
    '    Stream #0:0[0x1](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, mono, fltp, 128 kb/s',
  ].join('\n');
  assert.deepEqual(parseFfmpegInputInfo(audio), {
    hasAudio: true,
    audioCodec: 'aac',
    hasVideo: false,
    videoCodec: null,
    durationSec: 3.02,
  });

  const video = [
    '  Duration: 00:01:05.50, start: 0.000000, bitrate: 900 kb/s',
    '    Stream #0:0(und): Video: vp9 (Profile 0), yuv420p, 1280x720, 30 fps',
    '    Stream #0:1(und): Audio: opus, 48000 Hz, stereo, fltp',
  ].join('\n');
  const info = parseFfmpegInputInfo(video);
  assert.equal(info.hasVideo, true);
  assert.equal(info.videoCodec, 'vp9');
  assert.equal(info.audioCodec, 'opus');
  assert.equal(info.durationSec, 65.5);
});

test('buildConversionArgs menyusun MP3 320 kbps dengan metadata dan tanpa video', () => {
  const args = buildConversionArgs({
    input: '/tmp/in.bin',
    output: '/tmp/out.mp3',
    mode: 'audio',
    audioFormat: 'mp3',
    audioBitrate: audioQualityToBitrate('0'),
    info: parseFfmpegInputInfo('Stream #0:0: Audio: aac, 44100 Hz'),
    metadata: { title: 'Senja\nDi Jakarta', artist: 'Penyanyi' },
  });
  assert.ok(args.includes('-vn'));
  assert.equal(args[args.indexOf('-c:a') + 1], 'libmp3lame');
  assert.equal(args[args.indexOf('-b:a') + 1], '320k');
  assert.ok(args.includes('title=Senja Di Jakarta'), 'newline dalam metadata harus diganti spasi');
  assert.ok(args.includes('artist=Penyanyi'));
  assert.equal(args[args.length - 1], '/tmp/out.mp3');
  assert.ok(!args.includes('0:v:0'));
});

test('buildConversionArgs memakai codec yang benar untuk setiap format audio', () => {
  const info = parseFfmpegInputInfo('Stream #0:0: Audio: aac, 44100 Hz');
  const expect = {
    flac: ['flac'],
    wav: ['pcm_s16le'],
    m4a: ['aac', '+faststart'],
    opus: ['libopus'],
    vorbis: ['libvorbis'],
  };
  for (const [fmt, tokens] of Object.entries(expect)) {
    const args = buildConversionArgs({ input: 'a', output: `b.${fmt}`, mode: 'audio', audioFormat: fmt, info });
    const joined = args.join(' ');
    for (const token of tokens) assert.ok(joined.includes(token), `${fmt} harus memuat ${token}`);
  }
});

test('buildConversionArgs video: H.264 di-copy, selain itu ditranskode; stream audio saja ditolak', () => {
  const h264 = parseFfmpegInputInfo('Stream #0:0: Video: h264 (High), yuv420p\nStream #0:1: Audio: aac');
  const copyArgs = buildConversionArgs({ input: 'a', output: 'b.mp4', mode: 'video', videoFormat: 'mp4', info: h264 });
  assert.equal(copyArgs[copyArgs.indexOf('-c:v') + 1], 'copy');

  const vp9 = parseFfmpegInputInfo('Stream #0:0: Video: vp9, yuv420p\nStream #0:1: Audio: opus');
  const transcode = buildConversionArgs({ input: 'a', output: 'b.mp4', mode: 'video', videoFormat: 'mp4', info: vp9 });
  assert.equal(transcode[transcode.indexOf('-c:v') + 1], 'libx264');

  const audioOnly = parseFfmpegInputInfo('Stream #0:0: Audio: aac');
  assert.throws(
    () => buildConversionArgs({ input: 'a', output: 'b.mp4', mode: 'video', videoFormat: 'mp4', info: audioOnly }),
    (err) => err.code === 'STREAM_AUDIO_ONLY' && /hanya berisi audio/.test(err.message)
  );
});

test('buildConversionArgs menerapkan pemotong waktu: -ss sebelum -i, -to sesudahnya', () => {
  const args = buildConversionArgs({
    input: 'in',
    output: 'out.mp3',
    mode: 'audio',
    audioFormat: 'mp3',
    info: parseFfmpegInputInfo('Stream #0:0: Audio: aac'),
    clipStart: 1,
    clipEnd: 3,
  });
  const iSs = args.indexOf('-ss');
  const iIn = args.indexOf('-i');
  const iTo = args.indexOf('-to');
  assert.ok(iSs >= 0 && iSs < iIn, '-ss harus sebelum -i');
  assert.ok(iTo > iIn, '-to harus sesudah -i');
  assert.equal(args[iTo + 1], '3');
});

test('ffmpegCandidates: FFMPEG_PATH paling depan, bin hasil build sebelum paket installer, duplikat dibuang', () => {
  const candidates = ffmpegCandidates({
    env: { FFMPEG_PATH: '/opt/custom/ffmpeg', PATH: '/usr/bin:/usr/bin' },
    projectRoot: '/app',
    cwd: '/app',
    platform: 'linux',
    arch: 'x64',
    resolveInstaller: () => '/app/node_modules/@ffmpeg-installer/linux-x64/ffmpeg',
  });
  assert.equal(candidates[0].source, 'env:FFMPEG_PATH');
  assert.equal(candidates[0].path, '/opt/custom/ffmpeg');
  assert.equal(candidates[1].source, 'bin/ffmpeg (build)');
  assert.equal(candidates[1].path, path.join('/app', 'bin', 'ffmpeg'));
  const installerIdx = candidates.findIndex((c) => c.source === '@ffmpeg-installer/linux-x64');
  const pathIdx = candidates.findIndex((c) => c.source === 'PATH');
  assert.ok(installerIdx > 0 && installerIdx < pathIdx, 'binari statis installer harus didahulukan atas PATH');
  // /usr/bin/ffmpeg muncul sekali walau PATH memuat /usr/bin dua kali.
  assert.equal(candidates.filter((c) => c.path === '/usr/bin/ffmpeg').length, 1);
});

test('resolveInstallerBinary menemukan binari paket @ffmpeg-installer untuk platform ini', () => {
  const found = resolveInstallerBinary('@ffmpeg-installer', 'ffmpeg');
  if (process.platform !== 'linux' || process.arch !== 'x64') {
    // Platform lain boleh tidak punya paket; fungsi harus tetap mengembalikan null, bukan melempar.
    assert.ok(found === null || typeof found === 'string');
    return;
  }
  assert.ok(found, 'paket @ffmpeg-installer/linux-x64 harus terpasang (optionalDependency)');
});

test('probeFfmpegBinary: binari statis dari paket installer lolos verifikasi dan memiliki encoder wajib', async () => {
  const bin = resolveInstallerBinary('@ffmpeg-installer', 'ffmpeg');
  if (!bin) return; // platform tanpa paket: diuji di tempat lain
  const probe = await probeFfmpegBinary(bin);
  assert.equal(probe.ok, true, probe.reason || '');
  assert.ok(probe.version && probe.version.length > 0);
  assert.ok(probe.encoders.includes('libmp3lame'));
  assert.ok(probe.encoders.includes('aac'));
  assert.deepEqual(probe.missingEncoders, []);
});

test('probeFfmpegBinary menolak berkas yang tidak bisa dieksekusi dengan alasan yang bisa ditindaklanjuti', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ffprobe-test-'));
  try {
    const notExec = path.join(dir, 'ffmpeg-not-exec');
    await fs.writeFile(notExec, 'bukan binari');
    await fs.chmod(notExec, 0o644);
    const r1 = await probeFfmpegBinary(notExec);
    assert.equal(r1.ok, false);
    assert.match(r1.reason, /tidak dapat dijalankan/);

    const missing = await probeFfmpegBinary(path.join(dir, 'tidak-ada'));
    assert.equal(missing.ok, false);
    assert.match(missing.reason, /tidak dapat dijalankan/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('probeFfmpegBinary menolak FFmpeg yang tidak memiliki encoder MP3 (libmp3lame)', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ffprobe-enc-'));
  try {
    const fake = path.join(dir, 'ffmpeg');
    await fs.writeFile(fake, [
      '#!/bin/sh',
      'case "$*" in',
      '  *-encoders*) echo " V....D libx264  H.264"; echo " A..... aac  AAC"; exit 0 ;;',
      '  *-version*) echo "ffmpeg version fake-1.0 Copyright (c) fake"; exit 0 ;;',
      'esac',
      'exit 1',
      '',
    ].join('\n'));
    await fs.chmod(fake, 0o755);
    const probe = await probeFfmpegBinary(fake);
    assert.equal(probe.ok, false);
    assert.deepEqual(probe.missingEncoders, ['libmp3lame']);
    assert.match(probe.reason, /libmp3lame/);
    assert.equal(probe.version, 'fake-1.0');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
