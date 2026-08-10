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
function extractTweetId(url) { const m = String(url||'').match(TWITTER_STATUS_RE); return m? m[2]:null; }
function extractIgShortcode(url) { const m = String(url||'').match(IG_SHORTCODE_RE); return m? m[1]:null; }

async function tryTikWM(url, base) {
  try { const res = await fetchWithTimeout(`${base}/api/?url=${encodeURIComponent(url)}`, 9000); if(!res.ok) return null; const j = await res.json(); if(j.code===0 && j.data) return j.data; } catch {} return null;
}
async function tryTiklyDown(url) {
  try { const res = await fetchWithTimeout(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, 9000); if(!res.ok) return null; const j = await res.json(); const d = j.data||j; if(!d) return null; return { play: d.play||d.nowm||d.video?.noWatermark, wmplay: d.wmplay||d.video?.watermark, hdplay: d.hdplay, music: d.music||d.audio, cover: d.cover||d.thumbnail, title: d.title, author: d.author?.nickname||d.author||'TikTok', images: d.images||d.imageList }; } catch { return null; }
}
async function tryCobalt(url) {
  try {
    const res = await fetchWithTimeout('https://api.cobalt.tools/api/json', 10000, {
      method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({ url })
    });
    if(!res.ok) return null;
    const j = await res.json();
    if(j.status === 'redirect' && j.url) {
      return { downloadUrl: normalizeMediaUrl(j.url), thumbnail: j.thumb||null, filename: j.filename||'video.mp4', title: j.filename||'Media', links: [{ label: 'Download MP4', href: normalizeMediaUrl(j.url), primary: true }] };
    }
    if(j.status === 'picker' && Array.isArray(j.picker)) {
      const links = j.picker.map((p,i)=>({ label: `${(p.type||'').toUpperCase()} ${p.quality||''}`.trim() || `Option ${i+1}`, href: normalizeMediaUrl(p.url), primary: i===0 }));
      return { downloadUrl: links[0]?.href, links, thumbnail: j.picker[0]?.thumb||null, title: 'Media' };
    }
  } catch {}
  return null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawPath = searchParams.get('path') || '';
  const action = rawPath.split('/').filter(Boolean).pop()?.toLowerCase() || '';
  try {
    switch (action) {
      case 'alay': { const text = searchParams.get('text')||''; if(!text.trim()) return fail('Teks belum diisi'); if(text.length>2000) return fail('Maks 2000 karakter'); return ok(toAlay(text)); }
      case 'roasting': case 'roast': { const name = searchParams.get('name')||searchParams.get('text')||''; if(!name.trim()) return fail('Nama belum diisi'); if(name.length>100) return fail('Maks 100 karakter'); return ok(roast(name)); }
      case 'funfact': case 'livefunfact': { const bd = searchParams.get('birthdate')||searchParams.get('date')||''; const res = funfact(bd); if(res.error) return fail(res.error); return ok(res.result,{meta:res.meta}); }
      case 'lorem': { const count = Number(searchParams.get('count'))||3; const unit = searchParams.get('unit')||'paragraph'; return ok(loremIpsum({count, unit})); }
      case 'waifu': case 'anime': { const type = (searchParams.get('type')||'waifu').toLowerCase(); const safe = WAIFU_TYPES.has(type)? type:'waifu'; try { const res = await fetchWithTimeout(`https://api.waifu.pics/sfw/${safe}`,9000); if(!res.ok) throw new Error(); const data = await res.json(); return ok(normalizeMediaUrl(data.url),{source:'waifu.pics'}); } catch { return fail('Sumber waifu error',502); } }

      case 'tiktok': case 'tiktokdl': {
        const url = searchParams.get('url')||''; if(!TIKTOK_RE.test(url)) return fail('Link TikTok tidak valid.');
        let d = await tryTikWM(url,'https://www.tikwm.com'); if(!d) d = await tryTikWM(url,'https://tikwm.com'); if(!d) d = await tryTiklyDown(url);
        if(d) {
          const links = [];
          if(d.play) links.push({ label: 'Tanpa Watermark', href: normalizeMediaUrl(d.play), primary: true });
          if(d.hdplay) links.push({ label: 'HD No Watermark', href: normalizeMediaUrl(d.hdplay) });
          if(d.wmplay) links.push({ label: 'Dengan Watermark', href: normalizeMediaUrl(d.wmplay) });
          if(d.music) links.push({ label: 'Audio MP3', href: normalizeMediaUrl(d.music) });
          if(d.images && Array.isArray(d.images)) d.images.forEach((img,i)=>links.push({ label: `Slide ${i+1}`, href: normalizeMediaUrl(img.url||img) }));
          return ok({ play: normalizeMediaUrl(d.play), wmplay: normalizeMediaUrl(d.wmplay), music: normalizeMediaUrl(d.music), cover: normalizeMediaUrl(d.cover), title: cleanText(d.title,'TikTok Video'), author: cleanText(d.author?.nickname||d.author||'TikTok User','TikTok User',80), links }, {source:'tikwm+fallback'});
        }
        const cobalt = await tryCobalt(url);
        if(cobalt) return ok({...cobalt, title: 'TikTok Video' }, {source:'cobalt'});
        return fail('Gagal TikTok, coba gateway.',502);
      }

      case 'social': case 'cobalt': {
        const url = searchParams.get('url')||''; if(!url.trim()) return fail('Link belum diisi'); const cleanUrl = url.trim(); if(!isValidHttpUrl(cleanUrl)) return fail('Link tidak valid.');

        if(cleanUrl.includes('twitter.com')||cleanUrl.includes('x.com')) {
          const tweetId = extractTweetId(cleanUrl);
          if(tweetId) {
            try { const fxRes = await fetchWithTimeout(`https://api.fxtwitter.com/status/${tweetId}`,7000); if(fxRes.ok){ const fxData = await fxRes.json(); const tweet = fxData.tweet; if(tweet){ const vids = tweet?.media?.videos||[]; const photos = tweet?.media?.photos||[]; const links=[]; vids.forEach((v,i)=>links.push({label: vids.length>1?`Video ${i+1}`:'Download MP4', href: normalizeMediaUrl(v.url), primary:i===0})); photos.forEach((p,i)=>links.push({label:`Foto ${i+1}`, href: normalizeMediaUrl(p.url)})); if(links.length>0) return ok({ downloadUrl: links[0].href, links, thumbnail: normalizeMediaUrl(vids[0]?.thumbnail_url||photos[0]?.url||`https://vxtwitter.com/render/video/status/${tweetId}.jpg`), title: cleanText(tweet.text,'Twitter/X Video'), author: cleanText(tweet.author?.name,'Twitter User',80), filename:`twitter-${tweetId}.mp4` },{source:'fxtwitter'}); } } } catch {}
            try { const vxRes = await fetchWithTimeout(`https://api.vxtwitter.com/status/${tweetId}`,7000); if(vxRes.ok){ const vxData = await vxRes.json(); const tweet = vxData.tweet; if(tweet){ const vids = tweet?.media?.videos||[]; const links = vids.map((v,i)=>({label: vids.length>1?`Video ${i+1}`:'Download MP4', href: normalizeMediaUrl(v.url), primary:i===0})); if(links.length>0) return ok({ downloadUrl: links[0].href, links, thumbnail: normalizeMediaUrl(vids[0]?.thumbnail_url||null), title: cleanText(tweet.text,'Twitter/X Video'), author: cleanText(tweet.author?.name,'Twitter User',80) },{source:'vxtwitter'}); } } } catch {}
          }
        }

        if(cleanUrl.includes('facebook.com')||cleanUrl.includes('fb.watch')) {
          try { const fbRes = await fetchWithTimeout(`https://api.vkrdown.com/fb/?url=${encodeURIComponent(cleanUrl)}`,9000); if(fbRes.ok){ const fbJson = await fbRes.json(); const fbData = Array.isArray(fbJson.data)? fbJson.data[0]:fbJson.data; const videoUrl = fbData?.hd||fbData?.sd||fbData?.video||fbData?.url; if(videoUrl) return ok({ downloadUrl: normalizeMediaUrl(videoUrl), links: [{label:'HD Video', href: normalizeMediaUrl(videoUrl), primary:true}], thumbnail: normalizeMediaUrl(fbData?.thumbnail||null), title: cleanText(fbData?.title,'Facebook Video') },{source:'vkr-fb'}); } } catch {}
        }

        if(cleanUrl.includes('instagram.com')) {
          const shortcode = extractIgShortcode(cleanUrl)||'media';
          try { const igRes = await fetchWithTimeout(`https://api.vkrdown.com/ig/?url=${encodeURIComponent(cleanUrl)}`,9000); if(igRes.ok){ const igJson = await igRes.json(); const videoUrl = igJson.data?.video||igJson.data?.url||igJson.data?.[0]?.url; if(videoUrl){ const all = Array.isArray(igJson.data)? igJson.data : [igJson.data]; const links = all.map((it,i)=>({label: all.length>1?`Media ${i+1}`:'Download', href: normalizeMediaUrl(it.url||it.video), primary:i===0})).filter(l=>l.href); if(links.length>0) return ok({ downloadUrl: links[0].href, links, thumbnail: normalizeMediaUrl(igJson.data?.thumbnail||`https://www.instagram.com/p/${shortcode}/media/?size=l`), title:`Instagram Post (${shortcode})` },{source:'vkr-ig'}); } } } catch {}
        }

        // Cobalt universal fallback for YT, Reddit, Pinterest, SoundCloud, FB, IG, Twitter, etc
        const cobalt = await tryCobalt(cleanUrl);
        if(cobalt) return ok(cobalt, {source:'cobalt'});

        if(cleanUrl.includes('pinterest.com')||cleanUrl.includes('pin.it')) {
          try { const pinRes = await fetchWithTimeout(cleanUrl,8000,{headers:{'User-Agent':'Mozilla/5.0'}}); if(pinRes.ok){ const html = await pinRes.text(); const mp4Match = html.match(/https:\/\/[^"\s]+v1\.pinimg\.com\/videos\/[^"\s]+\.mp4/i)||html.match(/<meta\s+property="og:video"\s+content="([^"]+)"/i); const thumbMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i); const rawVideo = mp4Match?.[1]||mp4Match?.[0]; if(rawVideo) return ok({ downloadUrl: normalizeMediaUrl(String(rawVideo).replace(/&amp;/g,'&')), links:[{label:'Download MP4', href: normalizeMediaUrl(String(rawVideo).replace(/&amp;/g,'&')), primary:true}], thumbnail: normalizeMediaUrl(thumbMatch?.[1]?.replace(/&amp;/g,'&')||null), title:'Pinterest Video' },{source:'pinterest-direct'}); } } catch {}
        }

        return fail('Gagal mengambil media. Gunakan Gateway Cadangan di bawah.',502);
      }
      default: { return fail(`Action "${action||'(kosong)'}" tidak dikenal.`,404); }
    }
  } catch (error) { console.error('[TOOL PROXY FATAL]', error?.message||error); return fail('Internal proxy error',500); }
}
