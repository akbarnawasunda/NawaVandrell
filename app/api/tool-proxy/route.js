/**
 * GET /api/tool-proxy?path=<action>&...params
 *
 * ALL-IN-ONE DIRECT MEDIA DOWNLOADER PROXY (100% DIRECT CDN EDITION)
 * Handle lokal: alay, roasting, funfact, lorem
 * Handle jaringan: waifu, tiktok (TikWM), twitter (FxTwitter), instagram (VKR/SnapInsta), facebook (VKR FB), pinterest (v1.pinimg)
 */

import { toAlay, roast, funfact, loremIpsum } from '@/lib/funTools';

export const dynamic = 'force-dynamic';

const WAIFU_TYPES = new Set(['waifu', 'neko', 'shinobu', 'megumin', 'awoo', 'cuddle']);
const YT_RE = /(?:v=|\/embed\/|\/1\/|\/v\/|https:\/\/youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/;
const TIKTOK_RE = /^https?:\/\/(www\.|vm\.|vt\.|m\.)?tiktok\.com\//i;

function extractYtId(url) {
  if (!url) return null;
  const match = url.match(YT_RE);
  return match ? match[1] : null;
}

function generateSmartThumbnail(url) {
  if (!url) return null;

  const igMatch = url.match(/instagram\.com\/(?:reel|p|tv)\/([a-zA-Z0-9_-]+)/i);
  if (igMatch) {
    return `https://www.instagram.com/p/${igMatch[1]}/media/?size=l`;
  }

  const twMatch = url.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/([0-9]+)/i);
  if (twMatch) {
    return `https://vxtwitter.com/render/video/status/${twMatch[2]}.jpg`;
  }

  const ytId = extractYtId(url);
  if (ytId) {
    return `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
  }

  return null;
}

function ok(result, extra = {}) {
  return Response.json(
    { status: true, result, ...extra },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

function fail(message, status = 400) {
  return Response.json({ status: false, error: message }, { status });
}

async function fetchWithTimeout(url, ms = 12000, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get('path') || '';
  const action = raw.split('/').filter(Boolean).pop()?.toLowerCase() || '';

  switch (action) {
    case 'alay': {
      const text = searchParams.get('text') || '';
      if (!text.trim()) return fail('Teks belum diisi');
      if (text.length > 2000) return fail('Teks maksimal 2000 karakter');
      return ok(toAlay(text));
    }

    case 'roasting':
    case 'roast': {
      const name = searchParams.get('name') || searchParams.get('text') || '';
      if (!name.trim()) return fail('Nama belum diisi');
      return ok(roast(name));
    }

    case 'funfact':
    case 'livefunfact': {
      const birthdate = searchParams.get('birthdate') || searchParams.get('date') || '';
      const res = funfact(birthdate);
      if (res.error) return fail(res.error);
      return ok(res.result, { meta: res.meta });
    }

    case 'lorem': {
      const count = searchParams.get('count') || 3;
      const unit = searchParams.get('unit') || 'paragraph';
      return ok(loremIpsum({ count, unit }));
    }

    case 'waifu':
    case 'anime': {
      const type = (searchParams.get('type') || 'waifu').toLowerCase();
      const safeType = WAIFU_TYPES.has(type) ? type : 'waifu';
      try {
        const res = await fetchWithTimeout(`https://api.waifu.pics/sfw/${safeType}`, 9000);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (!data?.url) throw new Error('no url');
        return ok(data.url, { source: 'waifu.pics' });
      } catch {
        return fail('Sumber gambar anime sedang tidak bisa diakses.', 502);
      }
    }

    // ------------------------ TIKTOK DOWNLOADER (TikWM API) ------------------------
    case 'tiktok':
    case 'tiktokdl': {
      const url = searchParams.get('url') || '';
      if (!TIKTOK_RE.test(url)) {
        return fail('Link TikTok tidak valid.');
      }

      try {
        const tikwmRes = await fetchWithTimeout(
          `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`,
          10000
        );
        if (tikwmRes.ok) {
          const tikwmData = await tikwmRes.json();
          if (tikwmData.code === 0 && tikwmData.data) {
            const d = tikwmData.data;
            return Response.json(
              {
                status: true,
                result: {
                  play: d.play,
                  wmplay: d.wmplay,
                  music: d.music,
                  cover: d.cover,
                  title: d.title || 'TikTok Video',
                  author: d.author?.nickname || 'TikTok User',
                },
                source: 'tikwm',
              },
              { headers: { 'Cache-Control': 'no-store' } }
            );
          }
        }
      } catch (err) {
        console.error('[TikWM Error]', err.message);
      }

      return fail('Gagal mengambil video TikTok. Coba lagi nanti.', 502);
    }

    // ------------------------ ALL-IN-ONE DIRECT SOCIAL DOWNLOADER ------------------------
    case 'social':
    case 'cobalt': {
      const url = searchParams.get('url') || '';
      if (!url.trim()) return fail('Link sosmed belum diisi');

      const cleanUrl = url.trim();

      // 1. TWITTER / X (FxTwitter Direct API)
      const twMatch = cleanUrl.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/([0-9]+)/i);
      if (twMatch) {
        const tweetId = twMatch[2];
        try {
          const fxRes = await fetchWithTimeout(`https://api.fxtwitter.com/status/${tweetId}`, 8000);
          if (fxRes.ok) {
            const fxData = await fxRes.json();
            const video = fxData.tweet?.media?.videos?.[0];
            if (video?.url) {
              return Response.json(
                {
                  status: true,
                  result: {
                    downloadUrl: video.url,
                    thumbnail: video.thumbnail_url || fxData.tweet?.media?.photos?.[0]?.url || `https://vxtwitter.com/render/video/status/${tweetId}.jpg`,
                    title: fxData.tweet?.text || 'Twitter/X Video',
                    author: fxData.tweet?.author?.name || 'Twitter User',
                    filename: `twitter-${tweetId}.mp4`,
                  },
                  source: 'fxtwitter',
                },
                { headers: { 'Cache-Control': 'no-store' } }
              );
            }
          }
        } catch (err) {
          console.error('[FxTwitter Error]', err.message);
        }
      }

      // 2. FACEBOOK (VKR FB Direct API - Direct FB CDN MP4)
      if (cleanUrl.includes('facebook.com') || cleanUrl.includes('fb.watch')) {
        try {
          const fbRes = await fetchWithTimeout(`https://api.vkrdown.com/fb/?url=${encodeURIComponent(cleanUrl)}`, 10000);
          if (fbRes.ok) {
            const fbJson = await fbRes.json();
            const videoUrl = fbJson.data?.hd || fbJson.data?.sd || fbJson.data?.video;
            if (videoUrl) {
              return Response.json(
                {
                  status: true,
                  result: {
                    downloadUrl: videoUrl,
                    thumbnail: fbJson.data?.thumbnail || null,
                    title: fbJson.data?.title || 'Facebook Video',
                    filename: 'facebook-video.mp4',
                  },
                  source: 'vkr-fb',
                },
                { headers: { 'Cache-Control': 'no-store' } }
              );
            }
          }
        } catch (err) {
          console.error('[VKR FB Error]', err.message);
        }
      }

      // 3. INSTAGRAM (VKR IG Direct API - Direct Instagram CDN MP4)
      if (cleanUrl.includes('instagram.com')) {
        const shortcodeMatch = cleanUrl.match(/instagram\.com\/(?:reel|p|tv)\/([a-zA-Z0-9_-]+)/i);
        const shortcode = shortcodeMatch ? shortcodeMatch[1] : 'media';

        try {
          const igRes = await fetchWithTimeout(`https://api.vkrdown.com/ig/?url=${encodeURIComponent(cleanUrl)}`, 10000);
          if (igRes.ok) {
            const igJson = await igRes.json();
            const videoUrl = igJson.data?.video || igJson.data?.url || igJson.data?.[0]?.url;
            if (videoUrl) {
              return Response.json(
                {
                  status: true,
                  result: {
                    downloadUrl: videoUrl,
                    thumbnail: igJson.data?.thumbnail || `https://www.instagram.com/p/${shortcode}/media/?size=l`,
                    title: `Instagram Reel (${shortcode})`,
                    filename: `instagram-${shortcode}.mp4`,
                  },
                  source: 'vkr-ig',
                },
                { headers: { 'Cache-Control': 'no-store' } }
              );
            }
          }
        } catch (err) {
          console.error('[VKR IG Error]', err.message);
        }
      }

      // 4. PINTEREST (Direct v1.pinimg CDN Video Extractor)
      if (cleanUrl.includes('pinterest.com') || cleanUrl.includes('pin.it')) {
        try {
          const pinRes = await fetchWithTimeout(cleanUrl, 8000, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          });
          if (pinRes.ok) {
            const html = await pinRes.text();
            const mp4Match = html.match(/https:\/\/[^"]+v1\.pinimg\.com\/videos\/[^"]+\.mp4/i) || html.match(/<meta\s+property="og:video"\s+content="([^"]+)"/i);
            const thumbMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);

            if (mp4Match?.[0] || mp4Match?.[1]) {
              const videoUrl = (mp4Match[1] || mp4Match[0]).replace(/&amp;/g, '&');
              return Response.json(
                {
                  status: true,
                  result: {
                    downloadUrl: videoUrl,
                    thumbnail: thumbMatch?.[1]?.replace(/&amp;/g, '&') || generateSmartThumbnail(cleanUrl),
                    title: 'Pinterest Video',
                    filename: 'pinterest-video.mp4',
                  },
                  source: 'pinterest-direct',
                },
                { headers: { 'Cache-Control': 'no-store' } }
              );
            }
          }
        } catch (err) {
          console.error('[Pinterest Error]', err.message);
        }
      }

      return fail('Gagal mengambil media. Gunakan Gateway Cadangan di bawah.', 502);
    }

    default:
      return fail(`Action "${action || '(kosong)'}" tidak dikenal.`, 404);
  }
}
