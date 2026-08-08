/**
 * GET /api/tool-proxy?path=<action>&...params
 *
 * ALL-IN-ONE TOOL PROXY ROUTE (COMPLETE EDITION)
 * Handle lokal: alay, roasting, funfact, lorem
 * Handle jaringan: waifu, tiktok (TikWM + Btch), youtube, social (BTCH Downloader Native)
 */

import { toAlay, roast, funfact, loremIpsum } from '@/lib/funTools';
import { igdl, twitter, pinterest, facebook, tiktok, capcut } from 'btch-downloader';

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

async function fetchWithTimeout(url, ms = 10000, init = {}) {
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

    // ------------------------ TIKTOK DOWNLOADER ------------------------
    case 'tiktok':
    case 'tiktokdl': {
      const url = searchParams.get('url') || '';
      if (!TIKTOK_RE.test(url)) {
        return fail('Link TikTok tidak valid.');
      }

      // LAYER 1: TikWM API
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

      // LAYER 2: BTCH Downloader Fallback
      try {
        const ttData = await tiktok(url);
        if (ttData && (ttData.video || ttData.nowm || ttData.url)) {
          return Response.json(
            {
              status: true,
              result: {
                play: ttData.video || ttData.nowm || ttData.url,
                title: ttData.title || 'TikTok Video',
                author: ttData.author || 'TikTok User',
              },
              source: 'btch-tiktok',
            },
            { headers: { 'Cache-Control': 'no-store' } }
          );
        }
      } catch (err) {
        console.error('[Btch TikTok Error]', err.message);
      }

      return fail('Gagal mengambil video TikTok. Coba lagi nanti.', 502);
    }

    // ------------------------ ALL-IN-ONE SOCIAL DOWNLOADER (BTCH ENGINE) ------------------------
    case 'social':
    case 'cobalt': {
      const url = searchParams.get('url') || '';
      if (!url.trim()) return fail('Link sosmed belum diisi');

      const cleanUrl = url.trim();

      // 1. INSTAGRAM (BTCH igdl)
      if (cleanUrl.includes('instagram.com')) {
        try {
          const igData = await igdl(cleanUrl);
          if (Array.isArray(igData) && igData.length > 0) {
            const mainMedia = igData[0];
            return Response.json(
              {
                status: true,
                result: {
                  downloadUrl: mainMedia.url || mainMedia.path,
                  thumbnail: mainMedia.thumbnail || generateSmartThumbnail(cleanUrl),
                  filename: 'instagram-media.mp4',
                  picker: igData.length > 1 ? igData.map((m) => ({ url: m.url || m.path })) : null,
                },
                source: 'btch-ig',
              },
              { headers: { 'Cache-Control': 'no-store' } }
            );
          }
        } catch (err) {
          console.error('[Btch IG Error]', err.message);
        }
      }

      // 2. TWITTER / X (BTCH twitter)
      if (cleanUrl.includes('twitter.com') || cleanUrl.includes('x.com')) {
        try {
          const twData = await twitter(cleanUrl);
          if (twData && (twData.url || twData.HD || twData.SD)) {
            const videoUrl = twData.HD || twData.url || twData.SD;
            return Response.json(
              {
                status: true,
                result: {
                  downloadUrl: videoUrl,
                  thumbnail: twData.thumb || generateSmartThumbnail(cleanUrl),
                  title: twData.desc || 'Twitter Video',
                  filename: 'twitter-video.mp4',
                },
                source: 'btch-twitter',
              },
              { headers: { 'Cache-Control': 'no-store' } }
            );
          }
        } catch (err) {
          console.error('[Btch Twitter Error]', err.message);
        }
      }

      // 3. PINTEREST (BTCH pinterest)
      if (cleanUrl.includes('pinterest.com') || cleanUrl.includes('pin.it')) {
        try {
          const pinData = await pinterest(cleanUrl);
          if (pinData && (pinData.result || pinData.url)) {
            const mediaUrl = pinData.result || pinData.url;
            return Response.json(
              {
                status: true,
                result: {
                  downloadUrl: typeof mediaUrl === 'string' ? mediaUrl : mediaUrl[0],
                  thumbnail: generateSmartThumbnail(cleanUrl),
                  filename: 'pinterest-media.mp4',
                },
                source: 'btch-pinterest',
              },
              { headers: { 'Cache-Control': 'no-store' } }
            );
          }
        } catch (err) {
          console.error('[Btch Pinterest Error]', err.message);
        }
      }

      // 4. FACEBOOK (BTCH facebook)
      if (cleanUrl.includes('facebook.com') || cleanUrl.includes('fb.watch')) {
        try {
          const fbData = await facebook(cleanUrl);
          if (fbData && (fbData.HD || fbData.SD || fbData.url)) {
            return Response.json(
              {
                status: true,
                result: {
                  downloadUrl: fbData.HD || fbData.url || fbData.SD,
                  filename: 'facebook-video.mp4',
                },
                source: 'btch-facebook',
              },
              { headers: { 'Cache-Control': 'no-store' } }
            );
          }
        } catch (err) {
          console.error('[Btch FB Error]', err.message);
        }
      }

      // 5. CAPCUT (BTCH capcut)
      if (cleanUrl.includes('capcut.com')) {
        try {
          const ccData = await capcut(cleanUrl);
          if (ccData && (ccData.originalVideoUrl || ccData.url)) {
            return Response.json(
              {
                status: true,
                result: {
                  downloadUrl: ccData.originalVideoUrl || ccData.url,
                  thumbnail: ccData.coverUrl || null,
                  title: ccData.title || 'CapCut Template',
                  filename: 'capcut-video.mp4',
                },
                source: 'btch-capcut',
              },
              { headers: { 'Cache-Control': 'no-store' } }
            );
          }
        } catch (err) {
          console.error('[Btch CapCut Error]', err.message);
        }
      }

      return fail('Gagal mengambil media. Gunakan Gateway Cadangan di bawah.', 502);
    }

    default:
      return fail(
        `Action "${action || '(kosong)'}" tidak dikenal. Pilihan: alay, roasting, funfact, lorem, waifu, tiktok, social`,
        404
      );
  }
}
