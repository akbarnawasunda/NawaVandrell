import { NextResponse } from 'next/server';
import { toAlay, roast, funfact, loremIpsum } from '@/lib/funTools';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const WAIFU_TYPES = new Set(['waifu','neko','shinobu','megumin','awoo','cuddle']);
const TIKTOK_RE = /tiktok\.com/i;
const TWITTER_STATUS_RE = /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/([0-9]+)/i;
const IG_SHORTCODE_RE = /instagram\.com\/(?:reel|p|tv)\/([a-zA-Z0-9_-]+)/i;
function ok(result, extra = {}) { return NextResponse.json({ status: true, result,...extra }, { headers: { 'Cache-Control': 'no-store' } }); }
function fail(message, status = 400) { return NextResponse.json({ status: false, error: message }, { status }); }
async function fetchWithTimeout(url, ms = 12000, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try { return await fetch(url, {...init, signal: controller.signal, cache: 'no-store' }); } finally { clearTimeout(timer); }
}
function isValidHttpUrl(value) { try { const u = new URL(value); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } }
function normalizeMediaUrl(url) { if (!url) return url; if (String(url).startsWith('//')) return `https:${url}`; return String(url); }
function cleanText(value, fallback = '', max = 140) { const text = String(value || '').trim(); if (!text) return fallback; if (text.length <= max) return text; return `${text.slice(0, max)}…`; }
function extractTweetId(url) { const match = String(url || '').match(TWITTER_STATUS_RE); return match? match[2] : null; }
function extractIgShortcode(url) { const match = String(url || '').match(IG_SHORTCODE_RE); return match? match[1] : null; }

async function tryTikWM(url, base) {
  try {
    const res = await fetchWithTimeout(`${base}/api/?url=${encodeURIComponent(url)}`, 10000);
    if (!res.ok) return null;
    const j = await res.json();
    if (j.code === 0 && j.data) return j.data;
  } catch {}
  return null;
}
async function tryTiklyDown(url) {
  try {
    const res = await fetchWithTimeout(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, 10000);
    if (!res.ok) return null;
    const j = await res.json();
    const d = j.data || j;
    if (!d) return null;
    return {
      play: d.play || d.nowm || d.video?.noWatermark || d.noWatermark,
      wmplay: d.wmplay || d.wm || d.video?.watermark || d.watermark,
      hdplay: d.hdplay || d.video?.hd,
      music: d.music || d.audio || d.musicInfo?.play,
      cover: d.cover || d.thumbnail || d.video?.cover,
      title: d.title,
      author: d.author?.nickname || d.author?.unique_id || d.author || 'TikTok User',
      images: d.images || d.imageList || null
    };
  } catch { return null; }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawPath = searchParams.get('path') || '';
  const action = rawPath.split('/').filter(Boolean).pop()?.toLowerCase() || '';
  try {
    switch (action) {
      case 'alay': { const text = searchParams.get('text') || ''; if (!text.trim()) return fail('Teks belum diisi'); if (text.length > 2000) return fail('Teks maksimal 2000 karakter'); return ok(toAlay(text)); }
      case 'roasting': case 'roast': { const name = searchParams.get('name') || searchParams.get('text') || ''; if (!name.trim()) return fail('Nama belum diisi'); if (name.length > 100) return fail('Nama maksimal 100 karakter'); return ok(roast(name)); }
      case 'funfact': case 'livefunfact': { const birthdate = searchParams.get('birthdate') || searchParams.get('date') || ''; const res = funfact(birthdate); if (res.error) return fail(res.error); return ok(res.result, { meta: res.meta }); }
      case 'lorem': { const count = Number(searchParams.get('count')) || 3; const unit = searchParams.get('unit') || 'paragraph'; return ok(loremIpsum({ count, unit })); }
      case 'waifu': case 'anime': { const type = (searchParams.get('type') || 'waifu').toLowerCase(); const safeType = WAIFU_TYPES.has(type)? type : 'waifu'; try { const res = await fetchWithTimeout(`https://api.waifu.pics/sfw/${safeType}`, 9000); if (!res.ok) throw new Error(`waifu.pics ${res.status}`); const data = await res.json(); if (!data?.url) throw new Error('no image url'); return ok(normalizeMediaUrl(data.url), { source: 'waifu.pics' }); } catch (error) { return fail('Sumber gambar anime sedang tidak bisa diakses.', 502); } }

      case 'tiktok': case 'tiktokdl': {
        const url = searchParams.get('url') || '';
        if (!TIKTOK_RE.test(url)) return fail('Link TikTok tidak valid.');
        let d = await tryTikWM(url, 'https://www.tikwm.com');
        if (!d) d = await tryTikWM(url, 'https://tikwm.com');
        if (!d) d = await tryTiklyDown(url);
        if (!d) return fail('Gagal mengambil video TikTok. TikWM & fallback mati, coba gateway.', 502);
        const links = [];
        if (d.play) links.push({ label: 'Tanpa Watermark', href: normalizeMediaUrl(d.play), primary: true });
        if (d.hdplay) links.push({ label: 'HD No Watermark', href: normalizeMediaUrl(d.hdplay), primary: false });
        if (d.wmplay) links.push({ label: 'Dengan Watermark', href: normalizeMediaUrl(d.wmplay) });
        if (d.music) links.push({ label: 'Audio MP3', href: normalizeMediaUrl(d.music) });
        if (d.images && Array.isArray(d.images) && d.images.length > 0) {
          d.images.forEach((img, i) => links.push({ label: `Slide ${i+1}`, href: normalizeMediaUrl(img.url || img) }));
        }
        return ok({
          play: normalizeMediaUrl(d.play), wmplay: normalizeMediaUrl(d.wmplay), music: normalizeMediaUrl(d.music),
          cover: normalizeMediaUrl(d.cover), title: cleanText(d.title, 'TikTok Video'), author: cleanText(d.author?.nickname || d.author || 'TikTok User', 'TikTok User', 80),
          links
        }, { source: d.source || 'tikwm+fallback' });
      }

      case 'social': case 'cobalt': {
        const url = searchParams.get('url') || '';
        if (!url.trim()) return fail('Link sosmed belum diisi');
        const cleanUrl = url.trim();
        if (!isValidHttpUrl(cleanUrl)) return fail('Link tidak valid.');

        if (cleanUrl.includes('twitter.com') || cleanUrl.includes('x.com')) {
          const tweetId = extractTweetId(cleanUrl);
          if (tweetId) {
            let fxData = null;
            try {
              const fxRes = await fetchWithTimeout(`https://api.fxtwitter.com/status/${tweetId}`, 8000);
              if (fxRes.ok) fxData = await fxRes.json();
            } catch {}
            if (!fxData ||!fxData.tweet) {
              try {
                const vxRes = await fetchWithTimeout(`https://api.vxtwitter.com/status/${tweetId}`, 8000);
                if (vxRes.ok) fxData = await vxRes.json();
              } catch {}
            }
            if (fxData?.tweet) {
              const tweet = fxData.tweet;
              const videos = tweet?.media?.videos || [];
              const photos = tweet?.media?.photos || [];
              const allLinks = [];
              videos.forEach((v, i) => allLinks.push({ label: videos.length > 1? `Video ${i+1} (MP4)` : 'Download MP4', href: normalizeMediaUrl(v.url), primary: i === 0 }));
              photos.forEach((p, i) => allLinks.push({ label: `Foto ${i+1}`, href: normalizeMediaUrl(p.url), primary: allLinks.length === 0 }));
              if (allLinks.length > 0) {
                return ok({
                  downloadUrl: allLinks[0].href,
                  links: allLinks,
                  thumbnail: normalizeMediaUrl(videos[0]?.thumbnail_url || photos[0]?.url || `https://vxtwitter.com/render/video/status/${tweetId}.jpg`),
                  title: cleanText(tweet.text, 'Twitter/X Video'),
                  author: cleanText(tweet.author?.name, 'Twitter User', 80),
                  filename: `twitter-${tweetId}.mp4`
                }, { source: 'fxtwitter+vxtwitter' });
              }
            }
          }
        }

        if (cleanUrl.includes('facebook.com') || cleanUrl.includes('fb.watch')) {
          try {
            const fbRes = await fetchWithTimeout(`https://api.vkrdown.com/fb/?url=${encodeURIComponent(cleanUrl)}`, 10000);
            if (fbRes.ok) {
              const fbJson = await fbRes.json();
              const fbData = Array.isArray(fbJson.data)? fbJson.data[0] : fbJson.data;
              const videoUrl = fbData?.hd || fbData?.sd || fbData?.video || fbData?.url;
              if (videoUrl) return ok({ downloadUrl: normalizeMediaUrl(videoUrl), thumbnail: normalizeMediaUrl(fbData?.thumbnail || null), title: cleanText(fbData?.title, 'Facebook Video'), filename: 'facebook-video.mp4' }, { source: 'vkr-fb' });
            }
          } catch {}
        }

        if (cleanUrl.includes('instagram.com')) {
          const shortcode = extractIgShortcode(cleanUrl) || 'media';
          try {
            const igRes = await fetchWithTimeout(`https://api.vkrdown.com/ig/?url=${encodeURIComponent(cleanUrl)}`, 10000);
            if (igRes.ok) {
              const igJson = await igRes.json();
              const videoUrl = igJson.data?.video || igJson.data?.url || igJson.data?.[0]?.url;
              if (videoUrl) return ok({ downloadUrl: normalizeMediaUrl(videoUrl), thumbnail: normalizeMediaUrl(igJson.data?.thumbnail || `https://www.instagram.com/p/${shortcode}/media/?size=l`), title: `Instagram Post (${shortcode})`, filename: `instagram-${shortcode}.mp4` }, { source: 'vkr-ig' });
            }
          } catch {}
        }

        if (cleanUrl.includes('pinterest.com') || cleanUrl.includes('pin.it')) {
          try {
            const pinRes = await fetchWithTimeout(cleanUrl, 8000, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (pinRes.ok) {
              const html = await pinRes.text();
              const mp4Match = html.match(/https:\/\/[^"\s]+v1\.pinimg\.com\/videos\/[^"\s]+\.mp4/i) || html.match(/<meta\s+property="og:video"\s+content="([^"]+)"/i);
              const thumbMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
              const rawVideo = mp4Match?.[1] || mp4Match?.[0];
              if (rawVideo) return ok({ downloadUrl: normalizeMediaUrl(String(rawVideo).replace(/&amp;/g, '&')), thumbnail: normalizeMediaUrl(thumbMatch?.[1]?.replace(/&amp;/g, '&') || null), title: 'Pinterest Video', filename: 'pinterest-video.mp4' }, { source: 'pinterest-direct' });
            }
          } catch {}
        }
        return fail('Gagal mengambil media. Gunakan Gateway Cadangan di bawah.', 502);
      }
      default: { return fail(`Action "${action || '(kosong)'}" tidak dikenal.`, 404); }
    }
  } catch (error) { console.error('[TOOL PROXY FATAL]', error?.message || error); return fail('Internal proxy error', 500); }
}
