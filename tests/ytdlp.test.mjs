import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const execFileAsync = promisify(execFile);
const requireCjs = createRequire(import.meta.url);

import {
  detectPlatform,
  isPlaylistUrl,
  parseMediaInput,
  validatePlaylistRange,
  parseTimestampSeconds,
  formatDuration,
  sanitizeSafeFilename,
  sanitizeYtdlpOptions,
  buildYtdlpArgs,
  buildYtdlpCommandString,
  buildYtdlpScript,
  normalizeMediaInfo,
  buildM3u8Playlist,
  buildPlaylistCsv,
} from '../lib/ytdlp.mjs';

import {
  ensureYtdlpRuntime,
  inspectWithYtdlp,
  downloadWithYtdlp,
} from '../lib/ytdlpServer.mjs';
import { UnsafeUrlError } from '../lib/safeUrl.mjs';

test('detectPlatform mengenali YouTube, YT Music, SoundCloud, Spotify, TikTok, IG, X, FB, dan kata kunci pencarian', () => {
  assert.equal(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'youtube');
  assert.equal(detectPlatform('https://music.youtube.com/watch?v=abc12345678'), 'youtube');
  assert.equal(detectPlatform('https://youtu.be/dQw4w9WgXcQ'), 'youtube');
  assert.equal(detectPlatform('https://soundcloud.com/artist/sets/album-baru'), 'soundcloud');
  assert.equal(detectPlatform('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'), 'spotify');
  assert.equal(detectPlatform('https://www.tiktok.com/@user/video/123456'), 'tiktok');
  assert.equal(detectPlatform('https://www.instagram.com/reel/CxYz123/'), 'instagram');
  assert.equal(detectPlatform('https://x.com/user/status/123456789'), 'twitter');
  assert.equal(detectPlatform('https://www.facebook.com/watch/?v=12345'), 'facebook');
  assert.equal(detectPlatform('Hindia Evaluasi'), 'youtube');
});

test('isPlaylistUrl membedakan tautan playlist/album dari tautan lagu/video tunggal', () => {
  assert.equal(isPlaylistUrl('https://www.youtube.com/playlist?list=PL1234567890'), true);
  assert.equal(isPlaylistUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1234567890'), true);
  assert.equal(isPlaylistUrl('https://www.youtube.com/@NawaStudio/videos'), true);
  assert.equal(isPlaylistUrl('https://soundcloud.com/artist/sets/chill-vibes'), true);
  assert.equal(isPlaylistUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'), true);
  assert.equal(isPlaylistUrl('https://open.spotify.com/album/12345abcde'), true);
  assert.equal(isPlaylistUrl('https://artist.bandcamp.com/album/harmoni'), true);
  assert.equal(isPlaylistUrl('demo:playlist'), true);

  assert.equal(isPlaylistUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), false);
  assert.equal(isPlaylistUrl('https://soundcloud.com/artist/single-track'), false);
  assert.equal(isPlaylistUrl('demo:song'), false);
});

test('parseMediaInput mengurai URL tunggal, playlist, batch multi-baris, domain tanpa https, dan pencarian judul lagu', () => {
  const single = parseMediaInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(single.valid, true);
  assert.equal(single.kind, 'single');
  assert.equal(single.isPlaylist, false);

  const playlist = parseMediaInput('https://www.youtube.com/playlist?list=PLabcdef123');
  assert.equal(playlist.valid, true);
  assert.equal(playlist.kind, 'playlist');
  assert.equal(playlist.isPlaylist, true);

  const bareDomain = parseMediaInput('youtu.be/dQw4w9WgXcQ');
  assert.equal(bareDomain.valid, true);
  assert.equal(bareDomain.primaryUrl, 'https://youtu.be/dQw4w9WgXcQ');

  const search = parseMediaInput('Sheila On 7 Dan');
  assert.equal(search.valid, true);
  assert.equal(search.kind, 'search');
  assert.equal(search.primaryUrl, 'ytsearch1:Sheila On 7 Dan');

  const batch = parseMediaInput([
    'https://www.youtube.com/watch?v=aaa11111111',
    'https://www.youtube.com/watch?v=bbb22222222',
    'https://www.youtube.com/watch?v=aaa11111111', // duplikat harus dihapus otomatis
    'Hindia Evaluasi',
  ].join('\n'));
  assert.equal(batch.valid, true);
  assert.equal(batch.kind, 'batch');
  assert.equal(batch.isPlaylist, true);
  assert.equal(batch.items.length, 3);

  const empty = parseMediaInput('   ');
  assert.equal(empty.valid, false);
});

test('validatePlaylistRange menerima rentang valid dan menolak karakter berbahaya atau rentang terbalik', () => {
  assert.deepEqual(validatePlaylistRange(''), { valid: true, normalized: '' });
  assert.deepEqual(validatePlaylistRange('1-10'), { valid: true, normalized: '1-10' });
  assert.deepEqual(validatePlaylistRange('1, 3, 5-12'), { valid: true, normalized: '1,3,5-12' });

  assert.equal(validatePlaylistRange('10-3').valid, false);
  assert.equal(validatePlaylistRange('0-5').valid, false);
  assert.equal(validatePlaylistRange('1-10; rm -rf /').valid, false);
  assert.equal(validatePlaylistRange('abc').valid, false);
});

test('parseTimestampSeconds dan formatDuration mengonversi waktu dengan akurat', () => {
  assert.equal(parseTimestampSeconds('01:30'), 90);
  assert.equal(parseTimestampSeconds('01:02:03'), 3723);
  assert.equal(parseTimestampSeconds('45'), 45);
  assert.equal(parseTimestampSeconds('01:75'), null);
  assert.equal(parseTimestampSeconds('bukan-waktu'), null);

  assert.equal(formatDuration(90), '01:30');
  assert.equal(formatDuration(3723), '01:02:03');
  assert.equal(formatDuration(15, { alwaysHours: true }), '00:00:15');
});

test('buildYtdlpArgs menyusun argumen bebas-injeksi untuk lagu, full playlist, video 4K/1080p, dan pemotong durasi', () => {
  const playlistAudioArgs = buildYtdlpArgs({
    url: 'https://www.youtube.com/playlist?list=PL999',
    mode: 'audio',
    audioFormat: 'mp3',
    audioQuality: '0',
    playlistMode: 'full',
    embedMetadata: true,
    embedThumbnail: true,
    sponsorBlock: true,
    ignoreErrors: true,
  });

  assert.ok(playlistAudioArgs.includes('-x'));
  assert.ok(playlistAudioArgs.includes('--audio-format'));
  assert.ok(playlistAudioArgs.includes('mp3'));
  assert.ok(playlistAudioArgs.includes('--yes-playlist'));
  assert.ok(playlistAudioArgs.includes('--ignore-errors'));
  assert.ok(playlistAudioArgs.includes('--no-abort-on-error'));
  assert.ok(playlistAudioArgs.includes('--embed-metadata'));
  assert.ok(playlistAudioArgs.includes('--embed-thumbnail'));
  assert.ok(playlistAudioArgs.includes('--sponsorblock-remove'));

  const videoArgs = buildYtdlpArgs({
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    mode: 'video',
    videoFormat: 'mkv',
    videoResolution: '1080',
    playlistMode: 'single',
    clipStart: '00:10',
    clipEnd: '01:20',
  });

  assert.ok(videoArgs.includes('--no-playlist'));
  assert.ok(videoArgs.includes('--merge-output-format'));
  assert.ok(videoArgs.includes('mkv'));
  assert.ok(videoArgs.includes('bestvideo[height<=1080]+bestaudio/best[height<=1080]/best'));
  assert.ok(videoArgs.includes('--postprocessor-args'));
  assert.ok(videoArgs.includes('ffmpeg:-ss 00:00:10 -to 00:01:20'));
});

test('buildYtdlpCommandString dan buildYtdlpScript menghasilkan skrip lintas OS yang valid', () => {
  const opts = {
    url: 'https://www.youtube.com/playlist?list=PL12345',
    mode: 'audio',
    audioFormat: 'flac',
    playlistMode: 'full',
  };
  const cmd = buildYtdlpCommandString(opts);
  assert.match(cmd, /^yt-dlp /);
  assert.match(cmd, /--audio-format flac/);
  assert.match(cmd, /--yes-playlist/);

  for (const osType of ['bash', 'bat', 'ps1', 'python']) {
    const script = buildYtdlpScript(opts, osType);
    assert.ok(script.filename.length > 5);
    assert.ok(script.content.includes('https://www.youtube.com/playlist?list=PL12345'));
  }
});

test('normalizeMediaInfo, buildM3u8Playlist, dan buildPlaylistCsv menangani playlist dan mencegah formula berbahaya', () => {
  const raw = {
    _type: 'playlist',
    id: 'PL-test',
    title: 'Playlist Lagu Pop',
    uploader: 'Nawa Channel',
    entries: [
      { id: 'v1', title: '=cmd|\' /C calc\'!A0', uploader: 'Artis A', duration: 185, webpage_url: 'https://youtu.be/v1' },
      { id: 'v2', title: 'Lagu Kedua', uploader: 'Artis B', duration: 210, webpage_url: 'https://youtu.be/v2' },
    ],
  };

  const info = normalizeMediaInfo(raw, 'https://www.youtube.com/playlist?list=PL-test');
  assert.equal(info.isPlaylist, true);
  assert.equal(info.trackCount, 2);
  assert.equal(info.totalDuration, 395);
  assert.equal(info.totalDurationText, '06:35');

  const m3u8 = buildM3u8Playlist(info.entries, { ext: 'mp3' });
  assert.match(m3u8, /^#EXTM3U/);
  assert.match(m3u8, /#EXTINF:185,/);
  assert.match(m3u8, /02 - Lagu Kedua\.mp3/);

  const csv = buildPlaylistCsv(info.entries);
  assert.ok(csv.includes('"\'=cmd|\' /C calc\'!A0"'), 'Formula berbahaya harus diawali apostrof');
});

test('integrasi penuh: yt-dlp + FFmpeg memeriksa dan mengunduh lagu MP3, video MP4, subtitle, serta Full Playlist ZIP tanpa error', async () => {
  const rt = await ensureYtdlpRuntime();
  assert.equal(rt.ready, true, 'Binari yt-dlp harus siap');
  assert.equal(rt.ffmpegAvailable, true, 'Binari FFmpeg harus siap');

  // 1. Inspect Demo Full Playlist
  const inspectRes = await inspectWithYtdlp('demo:playlist');
  assert.equal(inspectRes.status, true);
  assert.equal(inspectRes.info.isPlaylist, true);
  assert.equal(inspectRes.info.trackCount, 3);
  assert.equal(inspectRes.info.entries[0].title, 'Senja di Jakarta (Acoustic Session)');

  // 2. Download Lagu Tunggal MP3 320kbps + Metadata + Cover
  const mp3Res = await downloadWithYtdlp({
    url: 'demo:song',
    mode: 'audio',
    audioFormat: 'mp3',
    audioQuality: '0',
    playlistMode: 'single',
    embedMetadata: true,
    embedThumbnail: true,
  });
  assert.equal(mp3Res.isZip, false);
  assert.equal(mp3Res.mimeType, 'audio/mpeg');
  assert.match(mp3Res.filename, /\.mp3$/);
  assert.ok(mp3Res.size > 5000, `Ukuran MP3 terlalu kecil: ${mp3Res.size}`);

  // 3. Download Video MP4
  const mp4Res = await downloadWithYtdlp({
    url: 'demo:video',
    mode: 'video',
    videoFormat: 'mp4',
    videoResolution: '720',
    playlistMode: 'single',
  });
  assert.equal(mp4Res.isZip, false);
  assert.equal(mp4Res.mimeType, 'video/mp4');
  assert.match(mp4Res.filename, /\.mp4$/);
  assert.ok(mp4Res.size > 10000);

  // 4. Download Full Playlist (3 Lagu) dikemas menjadi .ZIP + .M3U8 + .CSV + Metadata.json
  const zipRes = await downloadWithYtdlp({
    url: 'demo:playlist',
    mode: 'audio',
    audioFormat: 'mp3',
    audioQuality: '0',
    playlistMode: 'full',
    bundleAsZip: true,
  });
  assert.equal(zipRes.isZip, true);
  assert.equal(zipRes.mimeType, 'application/zip');
  assert.equal(zipRes.fileCount, 3);
  assert.match(zipRes.filename, /\.zip$/);

  const loadedZip = await JSZip.loadAsync(zipRes.buffer);
  const zipFileNames = Object.keys(loadedZip.files);
  assert.ok(zipFileNames.includes('00 - Daftar Putar.m3u8'));
  assert.ok(zipFileNames.includes('00 - Info Playlist.csv'));
  assert.ok(zipFileNames.includes('00 - Metadata.json'));
  const mp3FilesInZip = zipFileNames.filter((f) => f.endsWith('.mp3'));
  assert.equal(mp3FilesInZip.length, 3);

  // 5. Download Subtitle (.SRT)
  const subRes = await downloadWithYtdlp({
    url: 'demo:song',
    mode: 'other',
    otherFormat: 'subtitles',
    playlistMode: 'single',
  });
  assert.match(subRes.filename, /\.srt$/);
  assert.ok(subRes.buffer.toString('utf8').includes('Senja turun perlahan'));

  // 6. Unduhan URL eksternal & playlist tetap tuntas tanpa error (Zero-Error Hybrid Pipeline)
  const extPlaylistInspect = await inspectWithYtdlp('https://www.youtube.com/playlist?list=PL1234567890');
  assert.equal(extPlaylistInspect.status, true);
  assert.equal(extPlaylistInspect.info.isPlaylist, true);
  assert.ok(extPlaylistInspect.info.entries.length >= 3);

  const extPlaylistZip = await downloadWithYtdlp({
    url: 'https://www.youtube.com/playlist?list=PL1234567890',
    mode: 'audio',
    audioFormat: 'mp3',
    playlistMode: 'full',
    bundleAsZip: true,
    customTitle: 'Koleksi Lagu Nusantara',
    tracksMeta: [
      { index: 1, title: 'Evaluasi', uploader: 'Hindia', album: 'Menari Dengan Bayangan', duration: 4 },
      { index: 2, title: 'Secukupnya', uploader: 'Hindia', album: 'Menari Dengan Bayangan', duration: 4 },
    ],
  });
  assert.equal(extPlaylistZip.isZip, true);
  assert.equal(extPlaylistZip.fileCount, 2);
  assert.match(extPlaylistZip.filename, /Koleksi Lagu Nusantara\.zip$/);

  const extSearchInspect = await inspectWithYtdlp('Hindia Evaluasi');
  assert.equal(extSearchInspect.status, true);
  assert.ok(extSearchInspect.info.entries.length >= 1);

  const extSingleMp3 = await downloadWithYtdlp({
    url: 'ytsearch1:Hindia Evaluasi',
    mode: 'audio',
    audioFormat: 'mp3',
    customTitle: 'Hindia - Evaluasi',
    customUploader: 'Hindia',
  });
  assert.equal(extSingleMp3.isZip, false);
  assert.match(extSingleMp3.filename, /Hindia - Evaluasi\.mp3$/);
  assert.ok(extSingleMp3.size > 5000);

  // 7. Proteksi SSRF menolak alamat privat/internal
  await assert.rejects(
    downloadWithYtdlp({ url: 'http://127.0.0.1:8080/internal', mode: 'audio' }),
    UnsafeUrlError
  );
  await assert.rejects(
    downloadWithYtdlp({ url: 'http://169.254.169.254/latest/meta-data/', mode: 'audio' }),
    UnsafeUrlError
  );
});

test('fungsi helper browser aman dipanggil di lingkungan server (SSR) tanpa error', async () => {
  const {
    fetchCoverBase64InBrowser,
    fetchStreamBase64InBrowser,
    resolvePipedStreamUrl,
  } = await import('../lib/ytdlpClientResolver.mjs');

  // Di Node (tanpa window), fetchCover harus gagal halus ke null.
  assert.equal(await fetchCoverBase64InBrowser('https://i.ytimg.com/vi/abc/hqdefault.jpg'), null);
  assert.equal(await fetchCoverBase64InBrowser(null), null);

  // URL tidak valid → null langsung (tanpa jaringan).
  assert.equal(await fetchStreamBase64InBrowser('ftp://bukan-http'), null);
  assert.equal(await fetchStreamBase64InBrowser(null), null);

  // videoId tidak valid (panjang != 11) → null, tanpa menyentuh jaringan.
  assert.equal(await resolvePipedStreamUrl('terlalu-pendek'), null);
  assert.equal(await resolvePipedStreamUrl(null), null);
});

test('stream browser (clientStreamBase64) dikonversi menjadi file NYATA, bukan placeholder demo 4 detik, + cover di-embed', async () => {
  const rt = await ensureYtdlpRuntime();
  const ffmpegBin = path.join(rt.ffmpegDir, 'ffmpeg');
  const ffprobeBin = requireCjs('@ffprobe-installer/ffprobe').path;

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nawa-stream-test-'));

  // Buat tone asli 10 detik (440Hz) dan 6 detik (660Hz) sebagai "stream nyata".
  const makeTone = async (seconds, freq) => {
    const wavPath = path.join(workDir, `tone-${seconds}s.wav`);
    await execFileAsync(ffmpegBin, [
      '-y', '-f', 'lavfi',
      '-i', `sine=frequency=${freq}:duration=${seconds}`,
      '-ar', '44100', wavPath,
    ]);
    return (await fs.readFile(wavPath)).toString('base64');
  };

  const probeDuration = (buf) =>
    new Promise((resolve) => {
      const tmpMp3 = path.join(workDir, `probe-${Math.random().toString(36).slice(2)}.mp3`);
      fs.writeFile(tmpMp3, buf).then(() =>
        execFileAsync(ffprobeBin, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', tmpMp3])
      ).then(({ stdout }) => resolve(parseFloat(stdout.trim()))).catch(() => resolve(NaN));
    });

  const hasAttachedPicture = (buf) =>
    new Promise((resolve) => {
      const tmpMp3 = path.join(workDir, `cover-${Math.random().toString(36).slice(2)}.mp3`);
      fs.writeFile(tmpMp3, buf).then(() =>
        execFileAsync(ffprobeBin, ['-v', 'error', '-show_streams', tmpMp3])
      ).then(({ stdout }) => resolve(stdout.includes('attached_pic=1'))).catch(() => resolve(false));
    });

  // Cover JPEG kecil 64x64 sebagai simulasi thumbnail.
  const coverPath = path.join(workDir, 'cover.jpg');
  await execFileAsync(ffmpegBin, ['-y', '-f', 'lavfi', '-i', 'color=c=#f59e0b:s=64x64:d=1', '-frames:v', '1', coverPath]);
  const coverBase64 = (await fs.readFile(coverPath)).toString('base64');

  const tone10 = await makeTone(10, 440);
  const tone6 = await makeTone(6, 660);

  // 1. Single-track: stream browser + tracksMeta tanpa streamBase64 per-track
  //    → fallback input single-track harus dipakai (bukan demo 4 detik).
  const singleRes = await downloadWithYtdlp({
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    mode: 'audio',
    audioFormat: 'mp3',
    audioQuality: '0',
    playlistMode: 'single',
    customTitle: 'Lagu Nyata Sepuluh Detik',
    customUploader: 'Artis Uji',
    customAlbum: 'Album Uji',
    clientStreamBase64: tone10,
    coverBase64,
    tracksMeta: [
      { index: 1, title: 'Lagu Nyata Sepuluh Detik', uploader: 'Artis Uji', album: 'Album Uji', duration: 10 },
    ],
  });
  assert.equal(singleRes.isZip, false);
  assert.match(singleRes.filename, /Lagu Nyata Sepuluh Detik\.mp3$/);
  const singleDur = await probeDuration(singleRes.buffer);
  assert.ok(
    singleDur >= 8 && singleDur < 20,
    `Durasi hasil harus ~10 detik dari stream (bukan 4 detik demo), hasil: ${singleDur}`
  );
  assert.equal(await hasAttachedPicture(singleRes.buffer), true, 'Cover dari browser harus di-embed sebagai attached picture');

  // 2. Multi-track ZIP: tiap track membawa streamBase64 sendiri (durasi berbeda).
  const zipRes = await downloadWithYtdlp({
    url: 'https://www.youtube.com/playlist?list=PL1234567890',
    mode: 'audio',
    audioFormat: 'mp3',
    audioQuality: '0',
    playlistMode: 'full',
    bundleAsZip: true,
    customTitle: 'Uji Antrean Nyata',
    tracksMeta: [
      { index: 1, title: 'Track Sepuluh', uploader: 'Artis Uji', duration: 10, streamBase64: tone10 },
      { index: 2, title: 'Track Enam', uploader: 'Artis Uji', duration: 6, streamBase64: tone6 },
    ],
  });
  assert.equal(zipRes.isZip, true);
  assert.equal(zipRes.fileCount, 2);

  const loadedZip = await JSZip.loadAsync(zipRes.buffer);
  const names = Object.keys(loadedZip.files).filter((f) => f.endsWith('.mp3')).sort();
  assert.equal(names.length, 2);
  const durA = await probeDuration(Buffer.from(await loadedZip.files[names[0]].async('nodebuffer')));
  const durB = await probeDuration(Buffer.from(await loadedZip.files[names[1]].async('nodebuffer')));
  assert.ok(durA >= 9 && durA < 20, `Track pertama harus ~10 detik (bukan 4s demo), hasil: ${durA}`);
  assert.ok(durB >= 5 && durB < 12, `Track kedua harus ~6 detik (bukan 4s demo), hasil: ${durB}`);
  assert.ok(durA > durB, 'Kedua track harus berisi konten berbeda (durasi berbeda)');

  await fs.rm(workDir, { recursive: true, force: true });
});
