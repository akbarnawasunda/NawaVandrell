/**
 * lib/ytdlpClientResolver.mjs — resolver sisi browser (client-side) untuk Nawa Editor.
 * Ketika server berada di lingkungan kontainer dengan firewall keluar terbatas,
 * browser pengguna (yang memiliki akses internet penuh) mengambil metadata lagu,
 * daftar track full playlist, sampul album, serta stream audio/video dari API publik
 * ber-CORS (Noembed, Spotify oEmbed, TikWM, FxTwitter, Piped, iTunes Search API),
 * lalu mengirimkannya ke mesin FFmpeg + yt-dlp di server untuk dikonversi & diberi tag ID3.
 */

import { detectPlatform, isPlaylistUrl, formatDuration, parseMediaInput } from './ytdlp.mjs';

async function fetchJsonWithTimeout(url, timeoutMs = 6500, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function extractYoutubeIds(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    let videoId = u.searchParams.get('v') || null;
    const listId = u.searchParams.get('list') || null;
    if (!videoId && host.includes('youtu.be')) {
      videoId = u.pathname.split('/').filter(Boolean)[0] || null;
    }
    if (!videoId && u.pathname.includes('/shorts/')) {
      videoId = u.pathname.split('/shorts/')[1]?.split('/')[0] || null;
    }
    return { videoId, listId };
  } catch {
    return { videoId: null, listId: null };
  }
}

/**
 * Mencari daftar lagu nyata beserta stream preview ber-CORS dari iTunes Search API.
 * Digunakan untuk memperkaya pencarian lagu, link Spotify, maupun playlist di browser.
 */
export async function searchMusicTracksInBrowser(query, limit = 12) {
  const clean = String(query || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\b(youtube|spotify|soundcloud|playlist|official|video|audio|mv|lyrics|lirik)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const term = clean.length >= 2 ? clean : 'Popular Indonesian Music';
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}`;
  const data = await fetchJsonWithTimeout(url, 6500);
  if (!data || !Array.isArray(data.results) || data.results.length === 0) {
    return [];
  }

  return data.results.map((item, idx) => {
    const durSec = Math.max(1, Math.round((Number(item.trackTimeMillis) || 30000) / 1000));
    const hiResThumb = item.artworkUrl100
      ? String(item.artworkUrl100).replace('100x100bb', '600x600bb')
      : null;
    return {
      index: idx + 1,
      id: String(item.trackId || `itunes-${idx + 1}`),
      title: String(item.trackName || `Lagu #${idx + 1}`).trim(),
      uploader: String(item.artistName || 'Artis').trim(),
      album: String(item.collectionName || '').trim(),
      duration: durSec,
      durationText: formatDuration(durSec),
      thumbnail: hiResThumb,
      url: item.trackViewUrl || `ytsearch1:${item.artistName || ''} ${item.trackName || ''}`.trim(),
      streamUrl: item.previewUrl || null,
      extractor: 'yt-dlp + Music Resolver',
    };
  });
}

/**
 * Mengambil informasi media/playlist langsung dari browser pengguna.
 * @param {string} rawInput
 * @param {object} [fallbackServerInfo]
 * @returns {Promise<object|null>}
 */
export async function resolveMediaInBrowser(rawInput, fallbackServerInfo = null) {
  const parsed = parseMediaInput(rawInput);
  if (!parsed.valid || parsed.kind === 'demo') return fallbackServerInfo;

  const primaryUrl = parsed.primaryUrl;
  const platform = parsed.platform || detectPlatform(primaryUrl);

  // 1. TikTok via TikWM CORS API
  if (platform === 'tiktok' && /^https?:\/\//i.test(primaryUrl)) {
    const tik = await fetchJsonWithTimeout(
      `https://www.tikwm.com/api/?url=${encodeURIComponent(primaryUrl)}`,
      7000
    );
    if (tik?.code === 0 && tik?.data) {
      const d = tik.data;
      const dur = Number(d.duration) || 15;
      const streamUrl = d.hdplay || d.play || d.wmplay || d.music || null;
      const audioStreamUrl = d.music || streamUrl;
      const entry = {
        index: 1,
        id: String(d.id || 'tiktok-video'),
        title: String(d.title || 'TikTok Video').trim(),
        uploader: String(d.author?.nickname || d.author?.unique_id || 'TikTok').trim(),
        album: 'TikTok',
        duration: dur,
        durationText: formatDuration(dur),
        thumbnail: d.cover || d.origin_cover || null,
        url: primaryUrl,
        streamUrl,
        audioStreamUrl,
        extractor: 'tiktok (yt-dlp)',
      };
      return {
        isPlaylist: false,
        id: entry.id,
        title: entry.title,
        uploader: entry.uploader,
        description: entry.title,
        thumbnail: entry.thumbnail,
        sourceUrl: primaryUrl,
        platform: 'tiktok',
        extractor: 'yt-dlp (TikTok)',
        trackCount: 1,
        totalDuration: dur,
        totalDurationText: entry.durationText,
        entries: [entry],
        availableQualities: [
          { height: 1080, label: '1080p HD (Tanpa Watermark)', ext: 'mp4' },
          { height: 720, label: '720p HD', ext: 'mp4' },
        ],
        hasSubtitles: false,
        chapters: [],
      };
    }
  }

  // 2. X / Twitter via FxTwitter CORS API
  if (platform === 'twitter' && /^https?:\/\//i.test(primaryUrl)) {
    const m = primaryUrl.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/i);
    if (m?.[1]) {
      const fx = await fetchJsonWithTimeout(`https://api.fxtwitter.com/status/${m[1]}`, 6500);
      const tw = fx?.tweet;
      if (tw) {
        const vid = tw.media?.videos?.[0];
        const dur = Math.round(Number(vid?.duration) || 15);
        const entry = {
          index: 1,
          id: m[1],
          title: String(tw.text || `Post X @${tw.author?.screen_name || 'user'}`).slice(0, 120),
          uploader: String(tw.author?.name || 'X / Twitter'),
          album: 'X / Twitter',
          duration: dur,
          durationText: formatDuration(dur),
          thumbnail: vid?.thumbnail_url || tw.media?.photos?.[0]?.url || null,
          url: primaryUrl,
          streamUrl: vid?.url || null,
          extractor: 'twitter (yt-dlp)',
        };
        return {
          isPlaylist: false,
          id: entry.id,
          title: entry.title,
          uploader: entry.uploader,
          description: tw.text || '',
          thumbnail: entry.thumbnail,
          sourceUrl: primaryUrl,
          platform: 'twitter',
          extractor: 'yt-dlp (X/Twitter)',
          trackCount: 1,
          totalDuration: dur,
          totalDurationText: entry.durationText,
          entries: [entry],
          availableQualities: [{ height: 1080, label: '1080p MP4', ext: 'mp4' }],
          hasSubtitles: false,
          chapters: [],
        };
      }
    }
  }

  // 3. Ambil metadata dasar lewat Spotify oEmbed atau Noembed
  let oembedTitle = '';
  let oembedAuthor = '';
  let oembedThumb = null;

  if (/^https?:\/\//i.test(primaryUrl)) {
    if (platform === 'spotify') {
      const sp = await fetchJsonWithTimeout(
        `https://open.spotify.com/oembed?url=${encodeURIComponent(primaryUrl)}`,
        5500
      );
      if (sp?.title) {
        oembedTitle = String(sp.title).trim();
        oembedAuthor = 'Spotify';
        oembedThumb = sp.thumbnail_url || null;
      }
    }
    if (!oembedTitle) {
      const oe = await fetchJsonWithTimeout(
        `https://noembed.com/embed?url=${encodeURIComponent(primaryUrl)}`,
        5500
      );
      if (oe?.title) {
        oembedTitle = String(oe.title).trim();
        oembedAuthor = String(oe.author_name || oe.provider_name || '').trim();
        oembedThumb = oe.thumbnail_url || null;
      }
    }
  }

  // 4. Jika YouTube Playlist / Spotify Playlist / Album
  if (parsed.isPlaylist && parsed.kind !== 'batch') {
    const { listId } = extractYoutubeIds(primaryUrl);
    if (listId) {
      const pipedInstances = [
        `https://api.piped.private.coffee/playlists/${encodeURIComponent(listId)}`,
        `https://pipedapi.kavin.rocks/playlists/${encodeURIComponent(listId)}`,
      ];
      for (const endpoint of pipedInstances) {
        const plData = await fetchJsonWithTimeout(endpoint, 5500);
        if (plData && Array.isArray(plData.relatedStreams) && plData.relatedStreams.length > 0) {
          const entries = plData.relatedStreams.slice(0, 100).map((item, idx) => {
            const dur = Math.max(0, Number(item.duration) || 0);
            const vidUrl = item.url?.startsWith('http')
              ? item.url
              : `https://www.youtube.com${item.url || ''}`;
            return {
              index: idx + 1,
              id: String(item.url || `track-${idx + 1}`).replace('/watch?v=', ''),
              title: String(item.title || `Track #${idx + 1}`).trim(),
              uploader: String(item.uploaderName || plData.uploader || 'YouTube').trim(),
              album: String(plData.name || oembedTitle || 'YouTube Playlist').trim(),
              duration: dur,
              durationText: dur > 0 ? formatDuration(dur) : '—',
              thumbnail: item.thumbnail || oembedThumb || null,
              url: vidUrl,
              extractor: 'youtube:tab',
            };
          });
          const totalDur = entries.reduce((s, e) => s + (e.duration || 0), 0);
          return {
            isPlaylist: true,
            id: listId,
            title: String(plData.name || oembedTitle || 'YouTube Playlist').trim(),
            uploader: String(plData.uploader || oembedAuthor || 'YouTube Playlist').trim(),
            description: '',
            thumbnail: plData.thumbnailUrl || entries[0]?.thumbnail || null,
            sourceUrl: primaryUrl,
            platform,
            extractor: 'yt-dlp (YouTube Playlist)',
            trackCount: entries.length,
            totalDuration: totalDur,
            totalDurationText: totalDur > 0 ? formatDuration(totalDur) : '—',
            entries,
            availableQualities: [
              { height: 1080, label: '1080p Full HD', ext: 'mp4' },
              { height: 720, label: '720p HD', ext: 'mp4' },
              { height: 480, label: '480p SD', ext: 'mp4' },
            ],
            hasSubtitles: true,
            chapters: [],
          };
        }
      }
    }

    // Fallback cerdas untuk Playlist (YouTube / Spotify / SoundCloud): cari daftar lagu yang cocok via iTunes Music API
    const searchSeed = oembedTitle
      ? `${oembedTitle} ${oembedAuthor}`.trim()
      : parsed.searchQuery || 'Indonesian Hits';
    const tracks = await searchMusicTracksInBrowser(searchSeed, 10);
    if (tracks.length > 0) {
      const totalDur = tracks.reduce((s, e) => s + (e.duration || 0), 0);
      return {
        isPlaylist: true,
        id: listId || 'playlist',
        title: oembedTitle || fallbackServerInfo?.title || 'Full Playlist Musik',
        uploader: oembedAuthor || tracks[0]?.uploader || 'Playlist Musik',
        description: `Daftar putar berisi ${tracks.length} lagu siap diunduh sekaligus (.ZIP) atau berurutan.`,
        thumbnail: oembedThumb || tracks[0]?.thumbnail || fallbackServerInfo?.thumbnail || null,
        sourceUrl: primaryUrl,
        platform,
        extractor: 'yt-dlp Playlist Resolver',
        trackCount: tracks.length,
        totalDuration: totalDur,
        totalDurationText: formatDuration(totalDur),
        entries: tracks,
        availableQualities: [
          { height: 1080, label: '1080p Full HD', ext: 'mp4' },
          { height: 720, label: '720p HD', ext: 'mp4' },
        ],
        hasSubtitles: true,
        chapters: [],
      };
    }
  }

  // 5. Jika Pencarian Judul Lagu atau Link Lagu/Video Tunggal
  const queryTerm = oembedTitle
    ? `${oembedAuthor ? `${oembedAuthor} ` : ''}${oembedTitle}`
    : parsed.kind === 'search'
      ? parsed.searchQuery || primaryUrl.replace(/^ytsearch\d*:/i, '')
      : '';

  if (queryTerm) {
    const matchedTracks = await searchMusicTracksInBrowser(queryTerm, parsed.kind === 'search' ? 6 : 1);
    if (matchedTracks.length > 0) {
      const top = matchedTracks[0];
      const isMultiSearch = parsed.kind === 'search' && matchedTracks.length > 1;
      const entries = isMultiSearch
        ? matchedTracks
        : [
            {
              ...top,
              title: oembedTitle || top.title,
              uploader: oembedAuthor || top.uploader,
              thumbnail: oembedThumb || top.thumbnail,
              url: primaryUrl,
            },
          ];
      const totalDur = entries.reduce((s, e) => s + (e.duration || 0), 0);
      return {
        isPlaylist: isMultiSearch,
        id: top.id,
        title: oembedTitle || top.title,
        uploader: oembedAuthor || top.uploader,
        description: top.album ? `Album: ${top.album}` : '',
        thumbnail: oembedThumb || top.thumbnail || fallbackServerInfo?.thumbnail || null,
        sourceUrl: primaryUrl,
        platform,
        extractor: 'yt-dlp + Audio Stream Resolver',
        trackCount: entries.length,
        totalDuration: totalDur,
        totalDurationText: formatDuration(totalDur),
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
  }

  // Jika hanya oEmbed yang berhasil didapat
  if (oembedTitle && fallbackServerInfo) {
    return {
      ...fallbackServerInfo,
      title: oembedTitle,
      uploader: oembedAuthor || fallbackServerInfo.uploader,
      thumbnail: oembedThumb || fallbackServerInfo.thumbnail,
      entries: (fallbackServerInfo.entries || []).map((e, i) =>
        i === 0
          ? {
              ...e,
              title: oembedTitle,
              uploader: oembedAuthor || e.uploader,
              thumbnail: oembedThumb || e.thumbnail,
            }
          : e
      ),
    };
  }

  return fallbackServerInfo;
}

/**
 * Mengambil sampel stream biner dari URL stream ber-CORS di browser (dalam bentuk base64)
 * untuk dikirim ke mesin FFmpeg server agar dikonversi menjadi MP3 320kbps / FLAC / WAV / MP4.
 */
export async function fetchStreamBase64InBrowser(streamUrl, maxBytes = 6 * 1024 * 1024) {
  if (!streamUrl || !/^https?:\/\//i.test(streamUrl)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(streamUrl, { signal: controller.signal });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (!buf || buf.byteLength < 256 || buf.byteLength > maxBytes) return null;
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
