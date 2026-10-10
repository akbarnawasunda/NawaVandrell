/**
 * lib/ytdlp.mjs — mesin logika yt-dlp untuk Nawa Editor.
 * Menyediakan pendeteksi platform & playlist, sanitasi opsi unduhan,
 * penyusun argumen CLI yt-dlp bebas-injeksi, generator skrip lintas OS
 * (Bash/Termux, Windows BAT, PowerShell, Python), normalisasi metadata
 * lagu/video/playlist, serta ekspor daftar putar (.m3u8, .csv, .json).
 *
 * Murni fungsi (tanpa DOM/child_process) agar dapat diuji penuh dengan node --test.
 */

import { csvLine } from './format.mjs';

export const SUPPORTED_PLATFORMS = [
  { id: 'youtube', name: 'YouTube & YT Music', icon: 'youtube', supportsPlaylist: true },
  { id: 'soundcloud', name: 'SoundCloud', icon: 'soundcloud', supportsPlaylist: true },
  { id: 'spotify', name: 'Spotify (via YT Music)', icon: 'spotify', supportsPlaylist: true },
  { id: 'tiktok', name: 'TikTok', icon: 'tiktok', supportsPlaylist: true },
  { id: 'instagram', name: 'Instagram', icon: 'instagram', supportsPlaylist: false },
  { id: 'twitter', name: 'X / Twitter', icon: 'twitter', supportsPlaylist: false },
  { id: 'facebook', name: 'Facebook', icon: 'facebook', supportsPlaylist: false },
  { id: 'pinterest', name: 'Pinterest', icon: 'pinterest', supportsPlaylist: false },
  { id: 'reddit', name: 'Reddit', icon: 'reddit', supportsPlaylist: false },
  { id: 'generic', name: '1000+ Situs Lainnya', icon: 'link', supportsPlaylist: true },
];

export const DOWNLOAD_MODES = [
  { id: 'audio', label: 'Lagu / Audio', icon: 'music', desc: 'Ekstrak musik kualitas tinggi (MP3, FLAC, M4A, WAV, OPUS) + Cover Art & ID3 Tag' },
  { id: 'video', label: 'Video + Audio', icon: 'youtube', desc: 'Unduh video resolusi 360p hingga 4K Ultra HD (MP4, MKV, WebM)' },
  { id: 'other', label: 'Subtitle, Cover & Info', icon: 'fileText', desc: 'Unduh lirik/subtitle (.srt/.vtt), thumbnail HD (.jpg), atau metadata JSON' },
];

export const AUDIO_FORMATS = [
  { id: 'mp3', label: 'MP3 (Universal)', ext: 'mp3', mime: 'audio/mpeg', desc: 'Kompatibel di semua pemutar musik, HP, dan mobil' },
  { id: 'm4a', label: 'M4A / AAC (Apple)', ext: 'm4a', mime: 'audio/mp4', desc: 'Kualitas jernih dengan ukuran file lebih hemat' },
  { id: 'flac', label: 'FLAC (Lossless Studio)', ext: 'flac', mime: 'audio/flac', desc: 'Audio tanpa kompresi lossy untuk audiophile' },
  { id: 'wav', label: 'WAV (Uncompressed PCM)', ext: 'wav', mime: 'audio/wav', desc: 'Mentahan audio siap pakai untuk aplikasi editing/DAW' },
  { id: 'opus', label: 'OPUS (Efisiensi Tinggi)', ext: 'opus', mime: 'audio/opus', desc: 'Codec modern kualitas terbaik pada bitrate rendah' },
  { id: 'vorbis', label: 'OGG Vorbis', ext: 'ogg', mime: 'audio/ogg', desc: 'Format terbuka untuk game dan pemutar lintas platform' },
];

export const AUDIO_QUALITIES = [
  { id: '0', label: 'Terbaik (320 kbps / VBR 0)', bitrate: '320K' },
  { id: '256K', label: 'Tinggi (256 kbps)', bitrate: '256K' },
  { id: '192K', label: 'Standar (192 kbps)', bitrate: '192K' },
  { id: '128K', label: 'Hemat Kuota (128 kbps)', bitrate: '128K' },
  { id: '64K', label: 'Suara / Podcast (64 kbps)', bitrate: '64K' },
];

export const VIDEO_FORMATS = [
  { id: 'mp4', label: 'MP4 (H.264 / AAC — Paling Kompatibel)', ext: 'mp4', mime: 'video/mp4' },
  { id: 'mkv', label: 'MKV (Matroska — Semua Codec & Subtitle)', ext: 'mkv', mime: 'video/x-matroska' },
  { id: 'webm', label: 'WebM (VP9 / AV1 + Opus)', ext: 'webm', mime: 'video/webm' },
];

export const VIDEO_RESOLUTIONS = [
  { id: 'best', label: 'Terbaik Otomatis (Max 4K/8K)', height: null },
  { id: '2160', label: '4K Ultra HD (2160p)', height: 2160 },
  { id: '1440', label: '2K QHD (1440p)', height: 1440 },
  { id: '1080', label: 'Full HD (1080p)', height: 1080 },
  { id: '720', label: 'HD (720p)', height: 720 },
  { id: '480', label: 'SD (480p — Hemat Kuota)', height: 480 },
  { id: '360', label: 'Ringan (360p)', height: 360 },
];

export const OTHER_FORMATS = [
  { id: 'subtitles', label: 'Subtitle / Lirik (.SRT & .VTT)', ext: 'srt', mime: 'text/plain; charset=utf-8' },
  { id: 'thumbnail', label: 'Thumbnail / Cover Art HD (.JPG)', ext: 'jpg', mime: 'image/jpeg' },
  { id: 'metadata', label: 'Info Metadata Lengkap (.JSON)', ext: 'json', mime: 'application/json; charset=utf-8' },
  { id: 'video_muted', label: 'Video Saja Tanpa Audio (B-Roll MP4)', ext: 'mp4', mime: 'video/mp4' },
];

export const FILENAME_TEMPLATES = [
  { id: 'playlist_track', label: '01 - Judul Lagu (Urutan Playlist)', template: '%(playlist_index)02d - %(title)s.%(ext)s', singleTemplate: '%(title)s.%(ext)s' },
  { id: 'artist_title', label: 'Artis - Judul Lagu', template: '%(uploader,artist,channel|Unknown)s - %(title)s.%(ext)s', singleTemplate: '%(uploader,artist,channel|Unknown)s - %(title)s.%(ext)s' },
  { id: 'title_only', label: 'Judul Saja', template: '%(title)s.%(ext)s', singleTemplate: '%(title)s.%(ext)s' },
  { id: 'title_id', label: 'Judul [ID Media]', template: '%(title)s [%(id)s].%(ext)s', singleTemplate: '%(title)s [%(id)s].%(ext)s' },
];

export const QUICK_PRESETS = [
  {
    id: 'lagu_mp3_320',
    title: 'Lagu MP3 320kbps + Cover',
    desc: 'Format musik terbaik lengkap dengan gambar cover album & metadata artis.',
    badge: 'Populer',
    options: {
      mode: 'audio',
      audioFormat: 'mp3',
      audioQuality: '0',
      embedMetadata: true,
      embedThumbnail: true,
      sponsorBlock: true,
    },
  },
  {
    id: 'full_playlist_mp3',
    title: 'Full Playlist Lagu (Anti-Error)',
    desc: 'Unduh seluruh lagu dalam 1 playlist/album otomatis berurutan + penomoran track.',
    badge: 'Full Playlist',
    options: {
      mode: 'audio',
      audioFormat: 'mp3',
      audioQuality: '0',
      playlistMode: 'full',
      filenameTemplate: 'playlist_track',
      embedMetadata: true,
      embedThumbnail: true,
      ignoreErrors: true,
      sponsorBlock: true,
    },
  },
  {
    id: 'lagu_flac_lossless',
    title: 'Lagu FLAC Lossless Studio',
    desc: 'Kualitas audio murni tanpa kompresi lossy untuk suara jernih maksimal.',
    badge: 'Hi-Res',
    options: {
      mode: 'audio',
      audioFormat: 'flac',
      audioQuality: '0',
      embedMetadata: true,
      embedThumbnail: true,
    },
  },
  {
    id: 'video_1080p_mp4',
    title: 'Video Full HD 1080p (MP4)',
    desc: 'Video + audio jernih 1080p yang langsung bisa diputar di semua perangkat.',
    badge: '1080p HD',
    options: {
      mode: 'video',
      videoFormat: 'mp4',
      videoResolution: '1080',
      embedMetadata: true,
      embedSubtitles: false,
    },
  },
  {
    id: 'video_4k_best',
    title: 'Video 4K Ultra HD (2160p)',
    desc: 'Kualitas tertinggi yang tersedia digabung dengan audio terbaik.',
    badge: '4K UHD',
    options: {
      mode: 'video',
      videoFormat: 'mp4',
      videoResolution: '2160',
      embedMetadata: true,
    },
  },
  {
    id: 'video_720p_hemat',
    title: 'Video HD 720p Hemat Kuota',
    desc: 'Ukuran file bersahabat untuk disimpan dan dibagikan lewat WhatsApp/Telegram.',
    badge: '720p',
    options: {
      mode: 'video',
      videoFormat: 'mp4',
      videoResolution: '720',
      embedMetadata: true,
    },
  },
];

export const DEMO_SAMPLES = [
  {
    id: 'demo:playlist',
    label: 'Demo Full Playlist Lagu (3 Track Musik)',
    url: 'demo:playlist',
    desc: 'Uji langsung mesin yt-dlp + FFmpeg mengunduh 1 album penuh (3 lagu) sekaligus atau jadi ZIP.',
    type: 'playlist',
  },
  {
    id: 'demo:song',
    label: 'Demo Lagu Tunggal (Audio Sintesis Harmoni)',
    url: 'demo:song',
    desc: 'Uji konversi lagu ke MP3 320kbps, FLAC, WAV, M4A, OPUS + potong durasi & ID3 tag.',
    type: 'single',
  },
  {
    id: 'demo:video',
    label: 'Demo Video HD + Audio + Subtitle',
    url: 'demo:video',
    desc: 'Uji unduh video MP4/MKV/WebM berbagai resolusi (720p/480p/360p) + ekstrak subtitle.',
    type: 'single',
  },
];

/**
 * Mendeteksi platform dari sebuah URL atau kata kunci.
 * @param {string} raw
 * @returns {string}
 */
export function detectPlatform(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith('demo:')) return 'youtube';
  if (s.startsWith('ytsearch') || s.startsWith('scsearch')) return 'youtube';
  if (s.includes('music.youtube.com')) return 'youtube';
  if (s.includes('youtube.com') || s.includes('youtu.be') || s.includes('youtube-nocookie.com')) return 'youtube';
  if (s.includes('tiktok.com') || s.includes('vm.tiktok.com') || s.includes('vt.tiktok.com')) return 'tiktok';
  if (s.includes('instagram.com') || s.includes('instagr.am')) return 'instagram';
  if (s.includes('twitter.com') || s.includes('x.com') || s.includes('t.co')) return 'twitter';
  if (s.includes('facebook.com') || s.includes('fb.watch') || s.includes('fb.gg')) return 'facebook';
  if (s.includes('spotify.com') || s.includes('spoti.fi')) return 'spotify';
  if (s.includes('soundcloud.com') || s.includes('on.soundcloud.com')) return 'soundcloud';
  if (s.includes('pinterest.com') || s.includes('pin.it')) return 'pinterest';
  if (s.includes('reddit.com') || s.includes('redd.it') || s.includes('v.redd.it')) return 'reddit';
  if (s.includes('bilibili.com') || s.includes('b23.tv') || s.includes('bilibili.tv')) return 'generic';
  if (s.includes('vimeo.com') || s.includes('twitch.tv') || s.includes('bandcamp.com') || s.includes('dailymotion.com')) return 'generic';
  if (/^https?:\/\//i.test(s)) return 'generic';
  return 'youtube';
}

/**
 * Mengecek apakah sebuah URL merupakan playlist / album / multi-track.
 * @param {string} rawUrl
 * @returns {boolean}
 */
export function isPlaylistUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const s = rawUrl.trim();
  if (!s) return false;
  if (s.toLowerCase() === 'demo:playlist') return true;

  try {
    const u = new URL(s);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();
    const listParam = u.searchParams.get('list');

    if (listParam && listParam.length > 1) return true;
    if (path.includes('/playlist') || path.includes('/sets/') || path.includes('/album/') || path.includes('/albums/')) {
      return true;
    }
    if ((host.includes('youtube.com') || host.includes('youtu.be')) && (/\/@(?:[^/]+)\/(?:videos|releases|streams|shorts|playlists)/.test(path) || path.startsWith('/channel/') || path.startsWith('/c/'))) {
      return true;
    }
    if (host.includes('soundcloud.com') && (path.includes('/sets/') || path.endsWith('/tracks') || path.endsWith('/albums'))) {
      return true;
    }
    if (host.includes('bandcamp.com') && path.includes('/album/')) {
      return true;
    }
    if (host.includes('spotify.com') && (path.includes('/playlist/') || path.includes('/album/'))) {
      return true;
    }
    if (host.includes('tiktok.com') && /^\/@[a-z0-9._-]+\/?$/i.test(path)) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Mengurai input pengguna (bisa 1 URL, URL playlist, banyak URL per baris, demo, atau kata kunci pencarian lagu).
 * @param {string} rawInput
 * @returns {{
 *   valid: boolean,
 *   error?: string,
 *   kind: 'single' | 'playlist' | 'batch' | 'search' | 'demo',
 *   items: string[],
 *   primaryUrl: string,
 *   platform: string | null,
 *   isPlaylist: boolean
 * }}
 */
export function parseMediaInput(rawInput) {
  const text = String(rawInput ?? '').trim();
  if (!text) {
    return {
      valid: false,
      error: 'Masukkan link video/lagu/playlist atau ketik judul lagu yang ingin dicari.',
      kind: 'single',
      items: [],
      primaryUrl: '',
      platform: null,
      isPlaylist: false,
    };
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  if (lines.length === 0) {
    return {
      valid: false,
      error: 'Input tidak memuat URL atau kata kunci yang valid.',
      kind: 'single',
      items: [],
      primaryUrl: '',
      platform: null,
      isPlaylist: false,
    };
  }

  // Cek apakah baris tunggal adalah demo bawaan
  if (lines.length === 1 && /^demo:(playlist|song|video)$/i.test(lines[0])) {
    const demoKey = lines[0].toLowerCase();
    const isPl = demoKey === 'demo:playlist';
    return {
      valid: true,
      kind: 'demo',
      items: [demoKey],
      primaryUrl: demoKey,
      platform: 'youtube',
      isPlaylist: isPl,
    };
  }

  // Jika banyak baris URL
  if (lines.length > 1) {
    const normalizedItems = [];
    const seen = new Set();
    for (const line of lines.slice(0, 200)) {
      const item = normalizeSingleInputItem(line);
      if (item && !seen.has(item)) {
        seen.add(item);
        normalizedItems.push(item);
      }
    }
    return {
      valid: normalizedItems.length > 0,
      kind: 'batch',
      items: normalizedItems,
      primaryUrl: normalizedItems[0] || '',
      platform: detectPlatform(normalizedItems[0] || ''),
      isPlaylist: true,
    };
  }

  const single = lines[0];
  // Cek apakah URL http/https
  if (/^https?:\/\//i.test(single)) {
    try {
      const parsed = new URL(single);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return {
          valid: false,
          error: 'Hanya protokol http:// atau https:// yang didukung.',
          kind: 'single',
          items: [],
          primaryUrl: '',
          platform: null,
          isPlaylist: false,
        };
      }
      const pl = isPlaylistUrl(single);
      return {
        valid: true,
        kind: pl ? 'playlist' : 'single',
        items: [single],
        primaryUrl: single,
        platform: detectPlatform(single),
        isPlaylist: pl,
      };
    } catch {
      return {
        valid: false,
        error: 'Format URL tidak valid. Pastikan diawali https:// atau ketik judul lagu.',
        kind: 'single',
        items: [],
        primaryUrl: '',
        platform: null,
        isPlaylist: false,
      };
    }
  }

  // Cek apakah sudah berupa query ytsearch / scsearch
  if (/^(ytsearch\d*|scsearch\d*):/i.test(single)) {
    const isMultiSearch = /^(ytsearch|scsearch)([2-9]|\d{2,}):/i.test(single);
    return {
      valid: true,
      kind: 'search',
      items: [single],
      primaryUrl: single,
      platform: 'youtube',
      isPlaylist: isMultiSearch,
    };
  }

  // Jika user mengetik domain tanpa https:// (mis. youtu.be/xxx atau www.youtube.com/...)
  if (/^(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be|tiktok\.com|vm\.tiktok\.com|instagram\.com|twitter\.com|x\.com|soundcloud\.com|open\.spotify\.com|facebook\.com|fb\.watch|bilibili\.com|vimeo\.com|bandcamp\.com)\//i.test(single)) {
    const withHttps = `https://${single}`;
    const pl = isPlaylistUrl(withHttps);
    return {
      valid: true,
      kind: pl ? 'playlist' : 'single',
      items: [withHttps],
      primaryUrl: withHttps,
      platform: detectPlatform(withHttps),
      isPlaylist: pl,
    };
  }

  // Selain itu, perlakukan sebagai pencarian lagu/video otomatis (ytsearch1:...)
  const cleanQuery = single.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 160);
  if (cleanQuery.length < 2) {
    return {
      valid: false,
      error: 'Kata kunci pencarian terlalu pendek (minimal 2 karakter).',
      kind: 'search',
      items: [],
      primaryUrl: '',
      platform: null,
      isPlaylist: false,
    };
  }

  const searchTarget = `ytsearch1:${cleanQuery}`;
  return {
    valid: true,
    kind: 'search',
    items: [searchTarget],
    primaryUrl: searchTarget,
    searchQuery: cleanQuery,
    platform: 'youtube',
    isPlaylist: false,
  };
}

function normalizeSingleInputItem(line) {
  const s = String(line || '').trim();
  if (!s) return null;
  if (/^demo:(playlist|song|video)$/i.test(s)) return s.toLowerCase();
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
    } catch {
      return null;
    }
  }
  if (/^(ytsearch\d*|scsearch\d*):/i.test(s)) return s;
  if (/^(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be|tiktok\.com|instagram\.com|twitter\.com|x\.com|soundcloud\.com|open\.spotify\.com)\//i.test(s)) {
    return `https://${s}`;
  }
  return `ytsearch1:${s.slice(0, 160)}`;
}

/**
 * Validasi rentang item playlist (contoh: "1-10", "1,3,5-8", "2-15").
 * Hanya mengizinkan angka, tanda hubung, dan koma agar aman dari injeksi argumen.
 * @param {string} raw
 * @returns {{ valid: boolean, normalized: string, error?: string }}
 */
export function validatePlaylistRange(raw) {
  const clean = String(raw ?? '').replace(/\s+/g, '');
  if (!clean) return { valid: true, normalized: '' };
  if (!/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(clean)) {
    return {
      valid: false,
      normalized: '',
      error: 'Format rentang playlist harus berupa nomor urut, contoh: 1-10 atau 1,3,5-8.',
    };
  }
  const parts = clean.split(',');
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      if (start < 1 || end < 1 || start > end || end > 5000) {
        return {
          valid: false,
          normalized: '',
          error: `Rentang "${part}" tidak valid (angka awal harus <= angka akhir, maks 5000).`,
        };
      }
    } else {
      const num = Number(part);
      if (num < 1 || num > 5000) {
        return {
          valid: false,
          normalized: '',
          error: `Nomor track "${part}" harus antara 1 dan 5000.`,
        };
      }
    }
  }
  return { valid: true, normalized: clean };
}

/**
 * Mengubah string timestamp "MM:SS" atau "HH:MM:SS" atau detik menjadi jumlah detik.
 * @param {string|number} raw
 * @returns {number|null}
 */
export function parseTimestampSeconds(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : null;
  }
  const clean = String(raw).trim();
  if (!clean) return null;
  if (/^\d+$/.test(clean)) {
    const s = Number(clean);
    return Number.isFinite(s) && s >= 0 ? s : null;
  }
  const parts = clean.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((p) => /^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (parts.length === 2) {
    const [m, s] = nums;
    if (s >= 60) return null;
    return m * 60 + s;
  }
  const [h, m, s] = nums;
  if (m >= 60 || s >= 60) return null;
  return h * 3600 + m * 60 + s;
}

/**
 * Format detik menjadi "HH:MM:SS" atau "MM:SS".
 * @param {number} totalSeconds
 * @param {{ alwaysHours?: boolean }} [opts]
 * @returns {string}
 */
export function formatDuration(totalSeconds, { alwaysHours = false } = {}) {
  const sec = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0 || alwaysHours) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Sanitasi nama file agar aman di Windows, macOS, Linux, dan Android.
 * @param {string} name
 * @param {string} [fallback='nawa-media']
 * @param {string} [ext='']
 * @returns {string}
 */
export function sanitizeSafeFilename(name, fallback = 'nawa-media', ext = '') {
  const cleaned = String(name ?? '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 140);
  const base = cleaned || fallback;
  const cleanExt = String(ext || '').replace(/^\.+/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (!cleanExt) return base;
  if (base.toLowerCase().endsWith(`.${cleanExt}`)) return base;
  return `${base}.${cleanExt}`;
}

const VALID_MODES = new Set(DOWNLOAD_MODES.map((m) => m.id));
const VALID_AUDIO_FORMATS = new Set(AUDIO_FORMATS.map((f) => f.id));
const VALID_AUDIO_QUALITIES = new Set(AUDIO_QUALITIES.map((q) => q.id));
const VALID_VIDEO_FORMATS = new Set(VIDEO_FORMATS.map((f) => f.id));
const VALID_VIDEO_RESOLUTIONS = new Set(VIDEO_RESOLUTIONS.map((r) => r.id));
const VALID_OTHER_FORMATS = new Set(OTHER_FORMATS.map((o) => o.id));
const VALID_TEMPLATES = new Set(FILENAME_TEMPLATES.map((t) => t.id));

/**
 * Sanitasi seluruh opsi unduhan yt-dlp menjadi objek terstandar yang aman.
 * @param {object} [raw={}]
 * @returns {object}
 */
export function sanitizeYtdlpOptions(raw = {}) {
  const mode = VALID_MODES.has(raw.mode) ? raw.mode : 'audio';
  const audioFormat = VALID_AUDIO_FORMATS.has(raw.audioFormat) ? raw.audioFormat : 'mp3';
  const audioQuality = VALID_AUDIO_QUALITIES.has(raw.audioQuality) ? raw.audioQuality : '0';
  const videoFormat = VALID_VIDEO_FORMATS.has(raw.videoFormat) ? raw.videoFormat : 'mp4';
  const videoResolution = VALID_VIDEO_RESOLUTIONS.has(raw.videoResolution) ? raw.videoResolution : '1080';
  const otherFormat = VALID_OTHER_FORMATS.has(raw.otherFormat) ? raw.otherFormat : 'subtitles';
  const filenameTemplate = VALID_TEMPLATES.has(raw.filenameTemplate) ? raw.filenameTemplate : 'playlist_track';

  const playlistMode = ['full', 'range', 'single'].includes(raw.playlistMode)
    ? raw.playlistMode
    : 'full';

  const rangeCheck = validatePlaylistRange(raw.playlistRange || '');
  const playlistRange = rangeCheck.valid ? rangeCheck.normalized : '';

  const startSec = parseTimestampSeconds(raw.clipStart);
  const endSec = parseTimestampSeconds(raw.clipEnd);
  let validStart = startSec;
  let validEnd = endSec;
  if (validStart !== null && validEnd !== null && validEnd <= validStart) {
    validEnd = null;
  }

  const subLangsRaw = String(raw.subLangs || 'id,en').trim();
  const subLangs = /^[a-zA-Z0-9_,-]+$/.test(subLangsRaw) ? subLangsRaw.slice(0, 40) : 'id,en';

  return {
    mode,
    audioFormat,
    audioQuality,
    videoFormat,
    videoResolution,
    otherFormat,
    filenameTemplate,
    playlistMode,
    playlistRange,
    playlistRangeError: rangeCheck.valid ? null : rangeCheck.error,
    embedMetadata: raw.embedMetadata !== false,
    embedThumbnail: raw.embedThumbnail !== false,
    embedSubtitles: Boolean(raw.embedSubtitles),
    sponsorBlock: Boolean(raw.sponsorBlock),
    splitChapters: Boolean(raw.splitChapters),
    ignoreErrors: raw.ignoreErrors !== false,
    geoBypass: raw.geoBypass !== false,
    subLangs,
    clipStart: validStart !== null ? formatDuration(validStart, { alwaysHours: true }) : '',
    clipEnd: validEnd !== null ? formatDuration(validEnd, { alwaysHours: true }) : '',
    clipStartSeconds: validStart,
    clipEndSeconds: validEnd,
  };
}

/**
 * Menyusun daftar argumen CLI `yt-dlp` (sebagai array string, bebas shell injection).
 * @param {object} rawOptions
 * @param {object} [context]
 * @param {string} [context.outputTemplate]
 * @param {string} [context.ffmpegLocation]
 * @param {boolean} [context.isPlaylist]
 * @returns {string[]}
 */
export function buildYtdlpArgs(rawOptions = {}, context = {}) {
  const opts = sanitizeYtdlpOptions(rawOptions);
  const parsedInput = parseMediaInput(rawOptions.url || rawOptions.input || '');
  const args = [
    '--no-warnings',
    '--no-progress',
    '--windows-filenames',
    '--retries', '10',
    '--fragment-retries', '10',
    '--continue',
  ];

  if (opts.ignoreErrors) {
    args.push('--ignore-errors', '--no-abort-on-error');
  }
  if (opts.geoBypass) {
    args.push('--geo-bypass');
  }
  if (context.ffmpegLocation) {
    args.push('--ffmpeg-location', String(context.ffmpegLocation));
  }

  // Penanganan Playlist vs Single
  const treatAsPlaylist = context.isPlaylist ?? (parsedInput.isPlaylist && opts.playlistMode !== 'single');
  if (opts.playlistMode === 'single' && !parsedInput.items || (opts.playlistMode === 'single' && parsedInput.kind !== 'batch')) {
    args.push('--no-playlist');
  } else if (treatAsPlaylist || opts.playlistMode === 'full' || opts.playlistMode === 'range') {
    args.push('--yes-playlist');
    if (opts.playlistMode === 'range' && opts.playlistRange) {
      args.push('--playlist-items', opts.playlistRange);
    }
  } else {
    args.push('--no-playlist');
  }

  // Mode unduhan
  if (opts.mode === 'audio') {
    args.push(
      '-x',
      '--audio-format', opts.audioFormat,
      '--audio-quality', opts.audioQuality
    );
    if (opts.embedMetadata) {
      args.push('--embed-metadata');
    }
    if (opts.embedThumbnail && ['mp3', 'm4a', 'flac', 'opus', 'vorbis'].includes(opts.audioFormat)) {
      args.push('--embed-thumbnail', '--convert-thumbnails', 'jpg');
    }
    if (opts.sponsorBlock) {
      args.push('--sponsorblock-remove', 'music_offtopic,sponsor,intro,outro');
    }
    if (opts.splitChapters) {
      args.push('--split-chapters');
    }
  } else if (opts.mode === 'video') {
    const res = opts.videoResolution;
    const fmt = opts.videoFormat;
    if (res === 'best') {
      args.push('-f', 'bestvideo+bestaudio/best');
    } else {
      args.push('-f', `bestvideo[height<=${res}]+bestaudio/best[height<=${res}]/best`);
    }
    args.push('--merge-output-format', fmt);
    if (opts.embedMetadata) {
      args.push('--embed-metadata');
    }
    if (opts.embedThumbnail && (fmt === 'mp4' || fmt === 'mkv')) {
      args.push('--embed-thumbnail', '--convert-thumbnails', 'jpg');
    }
    if (opts.embedSubtitles) {
      args.push('--embed-subs', '--write-auto-subs', '--sub-langs', opts.subLangs);
    }
    if (opts.sponsorBlock) {
      args.push('--sponsorblock-remove', 'sponsor,intro,outro,selfpromo');
    }
    if (opts.splitChapters) {
      args.push('--split-chapters');
    }
  } else if (opts.mode === 'other') {
    if (opts.otherFormat === 'subtitles') {
      args.push('--skip-download', '--write-subs', '--write-auto-subs', '--sub-langs', opts.subLangs, '--convert-subs', 'srt');
    } else if (opts.otherFormat === 'thumbnail') {
      args.push('--skip-download', '--write-thumbnail', '--convert-thumbnails', 'jpg');
    } else if (opts.otherFormat === 'metadata') {
      args.push('--skip-download', '--write-info-json');
    } else if (opts.otherFormat === 'video_muted') {
      const res = opts.videoResolution === 'best' ? '' : `[height<=${opts.videoResolution}]`;
      args.push('-f', `bestvideo${res}/best`, '--remux-video', 'mp4');
    }
  }

  // Pemotongan durasi (Clipper) via postprocessor-args agar bebas error HTTP range
  if (opts.clipStartSeconds !== null || opts.clipEndSeconds !== null) {
    const ppParts = [];
    if (opts.clipStartSeconds !== null) ppParts.push(`-ss ${opts.clipStart}`);
    if (opts.clipEndSeconds !== null) ppParts.push(`-to ${opts.clipEnd}`);
    if (ppParts.length > 0) {
      args.push('--postprocessor-args', `ffmpeg:${ppParts.join(' ')}`);
    }
  }

  // Output template
  const tplObj = FILENAME_TEMPLATES.find((t) => t.id === opts.filenameTemplate) || FILENAME_TEMPLATES[0];
  const chosenTemplate = context.outputTemplate
    || (treatAsPlaylist ? tplObj.template : tplObj.singleTemplate);
  args.push('-o', chosenTemplate);

  // Target URL(s)
  if (parsedInput.valid && parsedInput.items.length > 0) {
    args.push('--', ...parsedInput.items);
  }

  return args;
}

/**
 * Mengutip satu argumen CLI agar aman ditampilkan atau dijalankan di terminal.
 * @param {string} arg
 * @param {'posix' | 'cmd' | 'ps1'} [shell='posix']
 * @returns {string}
 */
function quoteShellArg(arg, shell = 'posix') {
  const s = String(arg ?? '');
  if (/^[a-zA-Z0-9_./:=,@+-]+$/.test(s)) return s;
  if (shell === 'cmd') {
    return `"${s.replace(/"/g, '""').replace(/%/g, '%%')}"`;
  }
  if (shell === 'ps1') {
    return `'${s.replace(/'/g, "''")}'`;
  }
  return `'${s.replace(/'/g, "'\\''")}'`;
}

/**
 * Menghasilkan perintah satu baris `yt-dlp` yang siap disalin ke terminal.
 * @param {object} rawOptions
 * @returns {string}
 */
export function buildYtdlpCommandString(rawOptions = {}) {
  const args = buildYtdlpArgs(rawOptions).filter((a) => a !== '--no-progress' && a !== '--');
  return `yt-dlp ${args.map((a) => quoteShellArg(a, 'posix')).join(' ')}`;
}

/**
 * Menghasilkan skrip downloader lengkap lintas sistem operasi (Bash/Termux, Windows BAT, PowerShell, Python).
 * @param {object} rawOptions
 * @param {'bash' | 'bat' | 'ps1' | 'python'} [targetOs='bash']
 * @returns {{ filename: string, content: string, mime: string, label: string }}
 */
export function buildYtdlpScript(rawOptions = {}, targetOs = 'bash') {
  const opts = sanitizeYtdlpOptions(rawOptions);
  const parsed = parseMediaInput(rawOptions.url || rawOptions.input || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const items = parsed.items.length > 0 ? parsed.items : ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'];
  const baseArgs = buildYtdlpArgs({ ...rawOptions, url: '' }).filter((a) => a !== '--no-progress' && a !== '--');

  if (targetOs === 'bat') {
    const quotedArgs = baseArgs.map((a) => quoteShellArg(a, 'cmd')).join(' ');
    const urlLines = items.map((u) => `yt-dlp ${quotedArgs} -- ${quoteShellArg(u, 'cmd')}`).join('\r\n');
    const content = [
      '@echo off',
      'chcp 65001 >nul',
      'title Nawa Editor — yt-dlp Audio & Playlist Downloader',
      'echo ========================================================',
      'echo   NAWA EDITOR — YT-DLP FULL PLAYLIST ^& MEDIA DOWNLOADER',
      'echo ========================================================',
      'where yt-dlp >nul 2>nul',
      'if %errorlevel% neq 0 (',
      '  echo [INFO] Menginstal yt-dlp menggunakan winget / pip...',
      '  pip install -U yt-dlp || winget install yt-dlp.yt-dlp',
      ')',
      'if not exist "Nawa_Downloads" mkdir "Nawa_Downloads"',
      'cd "Nawa_Downloads"',
      'echo.',
      'echo [MULAI] Mengunduh media tanpa henti (anti-error aktif)...',
      urlLines,
      'echo.',
      'echo [SELESAI] Semua file tersimpan di folder Nawa_Downloads!',
      'pause',
    ].join('\r\n');
    return {
      filename: 'nawa-ytdlp-downloader.bat',
      content,
      mime: 'application/x-bat; charset=utf-8',
      label: 'Windows (.BAT)',
    };
  }

  if (targetOs === 'ps1') {
    const quotedArgs = baseArgs.map((a) => quoteShellArg(a, 'ps1')).join(' ');
    const urlLines = items.map((u) => `yt-dlp ${quotedArgs} -- ${quoteShellArg(u, 'ps1')}`).join('\n');
    const content = [
      '#!/usr/bin/env pwsh',
      '$ErrorActionPreference = "Continue"',
      'Write-Host "========================================================" -ForegroundColor Cyan',
      'Write-Host "  NAWA EDITOR — YT-DLP FULL PLAYLIST & MEDIA DOWNLOADER" -ForegroundColor Cyan',
      'Write-Host "========================================================" -ForegroundColor Cyan',
      'if (-not (Get-Command yt-dlp -ErrorAction SilentlyContinue)) {',
      '  Write-Host "[INFO] Menginstal yt-dlp via pip..." -ForegroundColor Yellow',
      '  pip install -U yt-dlp',
      '}',
      '$OutDir = Join-Path $PSScriptRoot "Nawa_Downloads"',
      'New-Item -ItemType Directory -Force -Path $OutDir | Out-Null',
      'Set-Location $OutDir',
      urlLines,
      'Write-Host "[SELESAI] Unduhan selesai di folder: $OutDir" -ForegroundColor Green',
    ].join('\n');
    return {
      filename: 'nawa-ytdlp-downloader.ps1',
      content,
      mime: 'text/plain; charset=utf-8',
      label: 'PowerShell (.PS1)',
    };
  }

  if (targetOs === 'python') {
    const pyOpts = {
      ignoreerrors: opts.ignoreErrors,
      no_warnings: true,
      continuedl: true,
      retries: 10,
      fragment_retries: 10,
      windowsfilenames: true,
      noplaylist: opts.playlistMode === 'single',
      outtmpl: 'Nawa_Downloads/%(playlist_index|)s%(playlist_index& - |)s%(title)s.%(ext)s',
    };
    if (opts.mode === 'audio') {
      pyOpts.format = 'bestaudio/best';
      pyOpts.postprocessors = [
        {
          key: 'FFmpegExtractAudio',
          preferredcodec: opts.audioFormat,
          preferredquality: opts.audioQuality,
        },
        ...(opts.embedMetadata ? [{ key: 'FFmpegMetadata', add_metadata: true }] : []),
      ];
    } else if (opts.mode === 'video') {
      pyOpts.format = opts.videoResolution === 'best'
        ? 'bestvideo+bestaudio/best'
        : `bestvideo[height<=${opts.videoResolution}]+bestaudio/best[height<=${opts.videoResolution}]/best`;
      pyOpts.merge_output_format = opts.videoFormat;
    }

    const content = [
      '#!/usr/bin/env python3',
      '"""Nawa Editor — Skrip Python yt-dlp Otomatis (Lagu, Video & Full Playlist)."""',
      'import os',
      'import subprocess',
      'import sys',
      '',
      'try:',
      '    import yt_dlp',
      'except ImportError:',
      '    print("[INFO] Menginstal pustaka yt-dlp...")',
      '    subprocess.check_call([sys.executable, "-m", "pip", "install", "-U", "yt-dlp"])',
      '    import yt_dlp',
      '',
      `URLS = ${JSON.stringify(items, null, 2)}`,
      `YDL_OPTS = ${JSON.stringify(pyOpts, null, 2)}`,
      '',
      'def main():',
      '    os.makedirs("Nawa_Downloads", exist_ok=True)',
      '    print(f"[MULAI] Mengunduh {len(URLS)} target ke folder Nawa_Downloads...")',
      '    with yt_dlp.YoutubeDL(YDL_OPTS) as ydl:',
      '        ydl.download(URLS)',
      '    print("[SELESAI] Semua media berhasil diunduh!")',
      '',
      'if __name__ == "__main__":',
      '    main()',
    ].join('\n');
    return {
      filename: 'nawa_ytdlp_downloader.py',
      content,
      mime: 'text/x-python; charset=utf-8',
      label: 'Python 3 (.PY)',
    };
  }

  // Default: Bash (Linux / macOS / Android Termux)
  const quotedArgs = baseArgs.map((a) => quoteShellArg(a, 'posix')).join(' ');
  const urlLines = items.map((u) => `yt-dlp ${quotedArgs} -- ${quoteShellArg(u, 'posix')}`).join('\n');
  const content = [
    '#!/usr/bin/env bash',
    'set -u',
    'echo "========================================================"',
    'echo "  NAWA EDITOR — YT-DLP FULL PLAYLIST & MEDIA DOWNLOADER"',
    'echo "========================================================"',
    'if ! command -v yt-dlp >/dev/null 2>&1; then',
    '  echo "[INFO] Menginstal yt-dlp..."',
    '  python3 -m pip install -U yt-dlp || pip install -U yt-dlp',
    'fi',
    'mkdir -p "Nawa_Downloads"',
    'cd "Nawa_Downloads" || exit 1',
    urlLines,
    'echo "[SELESAI] Semua file berhasil disimpan di folder $(pwd)"',
  ].join('\n');
  return {
    filename: 'nawa-ytdlp-downloader.sh',
    content,
    mime: 'application/x-sh; charset=utf-8',
    label: 'Linux / macOS / Termux (.SH)',
  };
}

/**
 * Menormalisasi objek JSON mentah dari `yt-dlp --dump-single-json` menjadi struktur seragam
 * baik untuk lagu tunggal, video tunggal, maupun full playlist / album.
 * @param {object} raw
 * @param {string} [sourceUrl='']
 * @returns {object}
 */
export function normalizeMediaInfo(raw, sourceUrl = '') {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Data metadata media kosong atau tidak valid.');
  }

  const isPlaylist = raw._type === 'playlist' || raw._type === 'multi_video' || Array.isArray(raw.entries);
  const rawEntries = isPlaylist ? (raw.entries || []).filter(Boolean) : [raw];

  const entries = rawEntries.map((item, idx) => {
    const durationSec = Math.max(0, Math.round(Number(item.duration) || 0));
    const itemUrl = item.webpage_url || item.url || item.original_url || sourceUrl || '';
    const thumb = item.thumbnail
      || (Array.isArray(item.thumbnails) && item.thumbnails.length > 0
        ? item.thumbnails[item.thumbnails.length - 1].url
        : null);
    return {
      index: Number(item.playlist_index) || idx + 1,
      id: String(item.id || `track-${idx + 1}`),
      title: String(item.title || item.fulltitle || `Media #${idx + 1}`).trim(),
      uploader: String(item.uploader || item.artist || item.creator || item.channel || raw.uploader || 'Tidak diketahui').trim(),
      album: String(item.album || (isPlaylist ? raw.title : '') || '').trim(),
      duration: durationSec,
      durationText: durationSec > 0 ? formatDuration(durationSec) : '—',
      thumbnail: thumb,
      url: itemUrl,
      extractor: String(item.extractor_key || item.extractor || raw.extractor_key || 'generic').toLowerCase(),
      viewCount: Number(item.view_count) || null,
      uploadDate: item.upload_date || null,
    };
  });

  const totalDuration = entries.reduce((sum, e) => sum + (e.duration || 0), 0);

  // Ekstrak ringkasan format video/audio yang tersedia (untuk single media)
  const rawFormats = Array.isArray(raw.formats) ? raw.formats : [];
  const availableQualities = [];
  const seenHeights = new Set();
  for (const f of rawFormats) {
    if (f.height && Number.isFinite(f.height) && !seenHeights.has(f.height)) {
      seenHeights.add(f.height);
      availableQualities.push({
        height: f.height,
        label: `${f.height}p${f.fps && f.fps > 30 ? ` ${Math.round(f.fps)}fps` : ''}`,
        ext: f.ext || 'mp4',
        filesize: f.filesize || f.filesize_approx || null,
      });
    }
  }
  availableQualities.sort((a, b) => b.height - a.height);

  const mainThumb = raw.thumbnail
    || (Array.isArray(raw.thumbnails) && raw.thumbnails.length > 0
      ? raw.thumbnails[raw.thumbnails.length - 1].url
      : entries[0]?.thumbnail || null);

  return {
    isPlaylist,
    id: String(raw.id || entries[0]?.id || 'media'),
    title: String(raw.title || entries[0]?.title || 'Media Siap Diunduh').trim(),
    uploader: String(raw.uploader || raw.channel || raw.artist || entries[0]?.uploader || 'Tidak diketahui').trim(),
    description: String(raw.description || '').slice(0, 500),
    thumbnail: mainThumb,
    sourceUrl: raw.webpage_url || sourceUrl || entries[0]?.url || '',
    platform: detectPlatform(raw.webpage_url || sourceUrl || ''),
    extractor: String(raw.extractor_key || raw.extractor || 'yt-dlp'),
    trackCount: entries.length,
    totalDuration,
    totalDurationText: totalDuration > 0 ? formatDuration(totalDuration) : '—',
    entries,
    availableQualities,
    hasSubtitles: Boolean(
      (raw.subtitles && Object.keys(raw.subtitles).length > 0)
      || (raw.automatic_captions && Object.keys(raw.automatic_captions).length > 0)
    ),
    chapters: Array.isArray(raw.chapters)
      ? raw.chapters.map((ch, i) => ({
          index: i + 1,
          title: String(ch.title || `Bagian ${i + 1}`),
          startTime: Math.round(Number(ch.start_time) || 0),
          endTime: Math.round(Number(ch.end_time) || 0),
        }))
      : [],
  };
}

/**
 * Menyusun isi berkas daftar putar `.m3u8` standar (#EXTM3U) dari daftar track.
 * @param {Array<{index?: number, title: string, uploader?: string, duration?: number, filename?: string}>} entries
 * @param {{ ext?: string }} [opts]
 * @returns {string}
 */
export function buildM3u8Playlist(entries = [], { ext = 'mp3' } = {}) {
  const lines = ['#EXTM3U', '#PLAYLIST:Nawa Editor yt-dlp Playlist'];
  entries.forEach((item, idx) => {
    const dur = Math.round(Number(item.duration) || -1);
    const artist = item.uploader && item.uploader !== 'Tidak diketahui' ? `${item.uploader} - ` : '';
    const displayTitle = `${artist}${item.title || `Track ${idx + 1}`}`;
    const num = String(item.index || idx + 1).padStart(2, '0');
    const file = item.filename || sanitizeSafeFilename(`${num} - ${item.title || `Track ${idx + 1}`}`, `track-${num}`, ext);
    lines.push(`#EXTINF:${dur},${displayTitle}`);
    lines.push(file);
  });
  return `${lines.join('\n')}\n`;
}

/**
 * Menyusun tabel CSV dari daftar lagu/video dalam playlist (aman dari injeksi formula spreadsheet).
 * @param {Array<object>} entries
 * @returns {string}
 */
export function buildPlaylistCsv(entries = []) {
  const header = csvLine(['No', 'Judul', 'Artis / Channel', 'Durasi', 'Detik', 'URL Sumber']);
  const rows = entries.map((item, idx) =>
    csvLine([
      Number(item.index) || idx + 1,
      item.title || '',
      item.uploader || '',
      item.durationText || formatDuration(item.duration || 0),
      Number(item.duration) || 0,
      item.url || '',
    ])
  );
  return [header, ...rows].join('\n');
}
