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
function isValidHttpUrl(v) { try { const u = new URL(v); return u.protocol==='http:'||u.protocol==='https:'; } catch { return false; } }
function normalizeMediaUrl(url) { if(!url) return url; if(String(url).startsWith('//')) return `https:${url}`; return String(url); }
function cleanText(v,f='',m=140){ const t=String(v||'').trim(); if(!t) return f; if(t.length<=m) return t; return `${t.slice(0,m)}…`; }
function extractTweetId(url){ const x=String(url||'').match(TWITTER_STATUS_RE); return x?x[2]:null; }
const COBALT_INSTANCES = [
  'https://api.cobalt.tools/api/json',
  'https://co.wuk.sh/api/json',
  'https://cobalt-api.kwiatekmiki.com/api/json',
  'https://api.kinoware.dev/api/json'
];
async function tryCobalt(url){
  for(const inst of COBALT_INSTANCES){
    try{
      const res = await fetchWithTimeout(inst, 10000, {
        method:'POST',
        headers:{ 'Accept':'application/json','Content-Type':'application/json','User-Agent':'Mozilla/5.0' },
        body: JSON.stringify({ url })
      });
      if(!res.ok) continue;
      const j = await res.json();
      if(j.status==='redirect' && j.url){
        return { downloadUrl: normalizeMediaUrl(j.url), links:[{label:'Download MP4', href: normalizeMediaUrl(j.url), primary:true}], thumbnail:j.thumb||null, title:j.filename||'Media' };
      }
      if(j.status==='picker' && Array.isArray(j.picker) && j.picker.length){
        const links = j.picker.map((p,i)=>({ label:`${(p.type||'video').toUpperCase()} ${p.quality||''}`.trim()||`Option ${i+1}`, href: normalizeMediaUrl(p.url), primary:i===0 }));
        return { downloadUrl: links[0].href, links, thumbnail:j.picker[0]?.thumb||null, title:'Media' };
      }
    }catch(e){ console.log('[COBALT FAIL]', inst, e.message); continue; }
  }
  return null;
}
async function tryTikWM(url, base){ try{ const r=await fetchWithTimeout(`${base}/api/?url=${encodeURIComponent(url)}`,9000); if(!r.ok) return null; const j=await r.json(); if(j.code===0&&j.data) return j.data; }catch{} return null; }
async function tryTiklyDown(url){ try{ const r=await fetchWithTimeout(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`,9000); if(!r.ok) return null; const j=await r.json(); const d=j.data||j; if(!d) return null; return { play:d.play||d.nowm||d.video?.noWatermark, wmplay:d.wmplay||d.video?.watermark, hdplay:d.hdplay, music:d.music||d.audio, cover:d.cover||d.thumbnail, title:d.title, author:d.author?.nickname||d.author||'TikTok', images:d.images||d.imageList }; }catch{ return null; } }

export async function GET(request){
  const { searchParams } = new URL(request.url);
  const rawPath = searchParams.get('path')||'';
  const action = rawPath.split('/').filter(Boolean).pop()?.toLowerCase()||'';
  try{
    switch(action){
      case 'alay': { const t=searchParams.get('text')||''; if(!t.trim()) return fail('Teks belum diisi'); return ok(toAlay(t)); }
      case 'roasting': case 'roast': { const n=searchParams.get('name')||searchParams.get('text')||''; if(!n.trim()) return fail('Nama belum diisi'); return ok(roast(n)); }
      case 'funfact': case 'livefunfact': { const bd=searchParams.get('birthdate')||searchParams.get('date')||''; const r=funfact(bd); if(r.error) return fail(r.error); return ok(r.result,{meta:r.meta}); }
      case 'lorem': { const c=Number(searchParams.get('count'))||3; const u=searchParams.get('unit')||'paragraph'; return ok(loremIpsum({count:c,unit:u})); }
      case 'waifu': case 'anime': { const tp=(searchParams.get('type')||'waifu').toLowerCase(); const safe=WAIFU_TYPES.has(tp)?tp:'waifu'; try{ const r=await fetchWithTimeout(`https://api.waifu.pics/sfw/${safe}`,9000); const d=await r.json(); return ok(normalizeMediaUrl(d.url)); }catch{ return fail('Waifu error',502); } }

      case 'tiktok': case 'tiktokdl': {
        const url=searchParams.get('url')||''; if(!TIKTOK_RE.test(url)) return fail('Link TikTok tidak valid.');
        let d=await tryTikWM(url,'https://www.tikwm.com'); if(!d) d=await tryTikWM(url,'https://tikwm.com'); if(!d) d=await tryTiklyDown(url);
        if(d){
          const links=[]; if(d.play) links.push({label:'Tanpa Watermark', href:normalizeMediaUrl(d.play), primary:true}); if(d.hdplay) links.push({label:'HD No WM', href:normalizeMediaUrl(d.hdplay)}); if(d.wmplay) links.push({label:'Dengan WM', href:normalizeMediaUrl(d.wmplay)}); if(d.music) links.push({label:'Audio MP3', href:normalizeMediaUrl(d.music)}); if(d.images&&Array.isArray(d.images)) d.images.forEach((img,i)=>links.push({label:`Slide ${i+1}`, href:normalizeMediaUrl(img.url||img)}));
          return ok({ play:normalizeMediaUrl(d.play), cover:normalizeMediaUrl(d.cover), title:cleanText(d.title,'TikTok Video'), author:cleanText(d.author?.nickname||d.author||'TikTok','TikTok',80), links },{source:'tikwm'});
        }
        const c=await tryCobalt(url); if(c) return ok({...c,title:'TikTok Video'},{source:'cobalt'});
        return fail('Gagal TikTok',502);
      }

      case 'social': case 'cobalt': {
        const url=searchParams.get('url')||''; if(!url.trim()) return fail('Link kosong'); const cleanUrl=url.trim(); if(!isValidHttpUrl(cleanUrl)) return fail('Link tidak valid.');

        // TWITTER - prioritas fxtwitter
        if(cleanUrl.includes('twitter.com')||cleanUrl.includes('x.com')){
          const id=extractTweetId(cleanUrl);
          if(id){
            try{ const r=await fetchWithTimeout(`https://api.fxtwitter.com/status/${id}`,7000); if(r.ok){ const j=await r.json(); const tw=j.tweet; const vids=tw?.media?.videos||[]; const photos=tw?.media?.photos||[]; const links=[]; vids.forEach((v,i)=>links.push({label:vids.length>1?`Video ${i+1}`:'Download MP4', href:normalizeMediaUrl(v.url), primary:i===0})); photos.forEach((p,i)=>links.push({label:`Foto ${i+1}`, href:normalizeMediaUrl(p.url)})); if(links.length) return ok({ downloadUrl:links[0].href, links, thumbnail:normalizeMediaUrl(vids[0]?.thumbnail_url||photos[0]?.url||null), title:cleanText(tw.text,'Twitter Video'), author:cleanText(tw.author?.name,'Twitter',80) },{source:'fxtwitter'}); } }catch{}
          }
        }

        // IG - coba vkr dulu
        if(cleanUrl.includes('instagram.com')){
          try{ const r=await fetchWithTimeout(`https://api.vkrdown.com/ig/?url=${encodeURIComponent(cleanUrl)}`,8000); if(r.ok){ const j=await r.json(); const data=j.data; const first=data?.[0]||data; if(first?.url||first?.video){ const arr=Array.isArray(data)?data:[data]; const links=arr.map((it,i)=>({label:arr.length>1?`Media ${i+1}`:'Download', href:normalizeMediaUrl(it.url||it.video), primary:i===0})).filter(l=>l.href); if(links.length) return ok({ downloadUrl:links[0].href, links, thumbnail:normalizeMediaUrl(first?.thumbnail||null), title:'Instagram Post' },{source:'vkr-ig'}); } } }catch{}
        }

        // FB
        if(cleanUrl.includes('facebook.com')||cleanUrl.includes('fb.watch')){
          try{ const r=await fetchWithTimeout(`https://api.vkrdown.com/fb/?url=${encodeURIComponent(cleanUrl)}`,8000); if(r.ok){ const j=await r.json(); const d=Array.isArray(j.data)?j.data[0]:j.data; const u=d?.hd||d?.sd||d?.video||d?.url; if(u) return ok({ downloadUrl:normalizeMediaUrl(u), links:[{label:'Download MP4', href:normalizeMediaUrl(u), primary:true}], thumbnail:normalizeMediaUrl(d?.thumbnail||null), title:cleanText(d?.title,'Facebook Video') },{source:'vkr-fb'}); } }catch{}
        }

        // COBALT UNIVERSAL - ini yang bikin IG/FB/YT jadi direct
        const cobalt = await tryCobalt(cleanUrl);
        if(cobalt) return ok(cobalt, {source:'cobalt-multi'});

        return fail('Gagal direct, pakai gateway di bawah.',502);
      }
      default: return fail(`Action "${action}" tidak dikenal`,404);
    }
  }catch(e){ console.error('[FATAL]', e.message); return fail('Internal error',500); }
}
