// app/api/tool-proxy/route.js

import { NextResponse } from 'next/server';
import { toAlay, roast, funfact, loremIpsum } from '@/lib/funTools';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WAIFU_TYPES = new Set([
  'waifu',
  'neko',
  'shinobu',
  'megumin',
  'awoo',
  'cuddle',
]);

const TIKTOK_RE = /^https?:\/\/(www\.|vm\.|vt\.|m\.)?tiktok\.com\//i;

const TWITTER_STATUS_RE =
  /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/([0-9]+)/i;

const IG_SHORTCODE_RE =
  /instagram\.com\/(?:reel|p|tv)\/([a-zA-Z0-9_-]+)/i;

const HTTP_RE = /^https?:\/\//i;

function ok(result, extra = {}) {
  return NextResponse.json(
    { status: true, result, ...extra },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

function fail(message, status = 400) {
  return NextResponse.json(
    { status: false, error: message },
    { status }
  );
}

async function fetchWithTimeout(url, ms = 12000, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timer);
  }
}

function isValidHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeMediaUrl(url) {
  if (!url) return url;
  if (String(url).startsWith('//')) return `https:${url}`;
  return String(url);
}

function cleanText(value, fallback = '', max = 140) {
  const text = String(value || '').trim();

  if (!text) return fallback;
  if (text.length <= max) return text;

  return `${text.slice(0, max)}…`;
}

function extractTweetId(url) {
  const match = String(url || '').match(TWITTER_STATUS_RE);
  return match ? match[2] : null;
}

function extractIgShortcode(url) {
  const match = String(url || '').match(IG_SHORTCODE_RE);
  return match ? match[1] : null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const rawPath = searchParams.get('path') || '';
  const action = rawPath.split('/').filter(Boolean).pop()?.toLowerCase() || '';

  try {
    switch (action) {
      /* ---------------- fun tools lokal ---------------- */

      case 'alay': {
        const text = searchParams.get('text') || '';

        if (!text.trim()) {
          return fail('Teks belum diisi');
        }

        if (text.length > 2000) {
          return fail('Teks maksimal 2000 karakter');
        }

        return ok(toAlay(text));
      }

      case 'roasting':
      case 'roast': {
        const name =
          searchParams.get('name') || searchParams.get('text') || '';

        if (!name.trim()) {
          return fail('Nama belum diisi');
        }

        if (name.length > 100) {
          return fail('Nama maksimal 100 karakter');
        }

        return ok(roast(name));
      }

      case 'funfact':
      case 'livefunfact': {
        const birthdate =
          searchParams.get('birthdate') || searchParams.get('date') || '';

        const res = funfact(birthdate);

        if (res.error) {
          return fail(res.error);
        }

        return ok(res.result, { meta: res.meta });
      }

      case 'lorem': {
        const count = Number(searchParams.get('count')) || 3;
        const unit = searchParams.get('unit') || 'paragraph';

        return ok(loremIpsum({ count, unit }));
      }

      /* ---------------- waifu / anime ---------------- */

      case 'waifu':
      case 'anime': {
        const type = (searchParams.get('type') || 'waifu').toLowerCase();
        const safeType = WAIFU_TYPES.has(type) ? type : 'waifu';

        try {
          const res = await fetchWithTimeout(
            `https://api.waifu.pics/sfw/${safeType}`,
            9000
          );

          if (!res.ok) {
            throw new Error(`waifu.pics ${res.status}`);
          }

          const data = await res.json();

          if (!data?.url) {
            throw new Error('no image url');
          }

          return ok(normalizeMediaUrl(data.url), {
            source: 'waifu.pics',
          });
        } catch (error) {
          console.error('[WAIFU ERROR]', error?.message || error);
          return fail('Sumber gambar anime sedang tidak bisa diakses.', 502);
        }
      }

      /* ---------------- tiktok direct ---------------- */

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

          if (!tikwmRes.ok) {
            throw new Error(`tikwm ${tikwmRes.status}`);
          }

          const tikwmData = await tikwmRes.json();

          if (tikwmData.code === 0 && tikwmData.data) {
            const d = tikwmData.data;

            return ok(
              {
                play: normalizeMediaUrl(d.play),
                wmplay: normalizeMediaUrl(d.wmplay),
                music: normalizeMediaUrl(d.music),
                cover: normalizeMediaUrl(d.cover),
                title: cleanText(d.title, 'TikTok Video'),
                author: cleanText(
                  d.author?.nickname || d.author?.unique_id || 'TikTok User',
                  'TikTok User',
                  80
                ),
              },
              { source: 'tikwm' }
            );
          }

          throw new Error('tikwm invalid payload');
        } catch (error) {
          console.error('[TIKTOK ERROR]', error?.message || error);
          return fail('Gagal mengambil video TikTok. Coba lagi nanti.', 502);
        }
      }

      /* ---------------- social direct ---------------- */

      case 'social':
      case 'cobalt': {
        const url = searchParams.get('url') || '';

        if (!url.trim()) {
          return fail('Link sosmed belum diisi');
        }

        const cleanUrl = url.trim();

        if (!isValidHttpUrl(cleanUrl)) {
          return fail('Link tidak valid. Pastikan diawali http:// atau https://');
        }

        /* 1. Twitter / X */
        if (cleanUrl.includes('twitter.com') || cleanUrl.includes('x.com')) {
          const tweetId = extractTweetId(cleanUrl);

          if (tweetId) {
            try {
              const fxRes = await fetchWithTimeout(
                `https://api.fxtwitter.com/status/${tweetId}`,
                8000
              );

              if (!fxRes.ok) {
                throw new Error(`fxtwitter ${fxRes.status}`);
              }

              const fxData = await fxRes.json();
              const video = fxData.tweet?.media?.videos?.[0];

              if (video?.url) {
                return ok(
                  {
                    downloadUrl: normalizeMediaUrl(video.url),
                    thumbnail: normalizeMediaUrl(
                      video.thumbnail_url ||
                        fxData.tweet?.media?.photos?.[0]?.url ||
                        `https://vxtwitter.com/render/video/status/${tweetId}.jpg`
                    ),
                    title: cleanText(
                      fxData.tweet?.text,
                      'Twitter/X Video'
                    ),
                    author: cleanText(
                      fxData.tweet?.author?.name,
                      'Twitter User',
                      80
                    ),
                    filename: `twitter-${tweetId}.mp4`,
                  },
                  { source: 'fxtwitter' }
                );
              }

              throw new Error('fxtwitter no video');
            } catch (error) {
              console.error('[TWITTER ERROR]', error?.message || error);
            }
          }
        }

        /* 2. Facebook */
        if (
          cleanUrl.includes('facebook.com') ||
          cleanUrl.includes('fb.watch')
        ) {
          try {
            const fbRes = await fetchWithTimeout(
              `https://api.vkrdown.com/fb/?url=${encodeURIComponent(cleanUrl)}`,
              10000
            );

            if (!fbRes.ok) {
              throw new Error(`vkr-fb ${fbRes.status}`);
            }

            const fbJson = await fbRes.json();
            const fbData = Array.isArray(fbJson.data)
              ? fbJson.data[0]
              : fbJson.data;

            const videoUrl =
              fbData?.hd || fbData?.sd || fbData?.video || fbData?.url;

            if (videoUrl) {
              return ok(
                {
                  downloadUrl: normalizeMediaUrl(videoUrl),
                  thumbnail: normalizeMediaUrl(fbData?.thumbnail || null),
                  title: cleanText(fbData?.title, 'Facebook Video'),
                  filename: 'facebook-video.mp4',
                },
                { source: 'vkr-fb' }
              );
            }

            throw new Error('vkr-fb no video');
          } catch (error) {
            console.error('[FACEBOOK ERROR]', error?.message || error);
          }
        }

        /* 3. Instagram */
        if (cleanUrl.includes('instagram.com')) {
          const shortcode = extractIgShortcode(cleanUrl) || 'media';

          try {
            const igRes = await fetchWithTimeout(
              `https://api.vkrdown.com/ig/?url=${encodeURIComponent(cleanUrl)}`,
              10000
            );

            if (!igRes.ok) {
              throw new Error(`vkr-ig ${igRes.status}`);
            }

            const igJson = await igRes.json();

            const videoUrl =
              igJson.data?.video ||
              igJson.data?.url ||
              igJson.data?.[0]?.url;

            if (videoUrl) {
              return ok(
                {
                  downloadUrl: normalizeMediaUrl(videoUrl),
                  thumbnail: normalizeMediaUrl(
                    igJson.data?.thumbnail ||
                      `https://www.instagram.com/p/${shortcode}/media/?size=l`
                  ),
                  title: `Instagram Post (${shortcode})`,
                  filename: `instagram-${shortcode}.mp4`,
                },
                { source: 'vkr-ig' }
              );
            }

            throw new Error('vkr-ig no video');
          } catch (error) {
            console.error('[INSTAGRAM ERROR]', error?.message || error);
          }
        }

        /* 4. Pinterest */
        if (
          cleanUrl.includes('pinterest.com') ||
          cleanUrl.includes('pin.it')
        ) {
          try {
            const pinRes = await fetchWithTimeout(cleanUrl, 8000, {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                Accept:
                  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
              },
            });

            if (!pinRes.ok) {
              throw new Error(`pinterest ${pinRes.status}`);
            }

            const html = await pinRes.text();

            const mp4Match =
              html.match(
                /https:\/\/[^"\s]+v1\.pinimg\.com\/videos\/[^"\s]+\.mp4/i
              ) ||
              html.match(
                /<meta\s+property="og:video"\s+content="([^"]+)"/i
              );

            const thumbMatch = html.match(
              /<meta\s+property="og:image"\s+content="([^"]+)"/i
            );

            const rawVideo = mp4Match?.[1] || mp4Match?.[0];

            if (rawVideo) {
              const videoUrl = String(rawVideo).replace(/&amp;/g, '&');
              const thumbnail = thumbMatch?.[1]?.replace(/&amp;/g, '&');

              return ok(
                {
                  downloadUrl: normalizeMediaUrl(videoUrl),
                  thumbnail: normalizeMediaUrl(thumbnail || null),
                  title: 'Pinterest Video',
                  filename: 'pinterest-video.mp4',
                },
                { source: 'pinterest-direct' }
              );
            }

            throw new Error('pinterest no video');
          } catch (error) {
            console.error('[PINTEREST ERROR]', error?.message || error);
          }
        }

        return fail(
          'Gagal mengambil media. Gunakan Gateway Cadangan di bawah.',
          502
        );
      }

      default: {
        return fail(`Action "${action || '(kosong)'}" tidak dikenal.`, 404);
      }
    }
  } catch (error) {
    console.error('[TOOL PROXY FATAL]', error?.message || error);
    return fail('Internal proxy error', 500);
  }
}
