/**
 * GET /api/tool-proxy?path=<action>&...params
 *
 * FIX BUG LAMA: versi lama cuma handle `alay`, sisanya gagal diam-diam.
 * Sekarang semua fun-tool diproses LOKAL:
 *   alay      -> ?path=alay&text=...
 *   roasting  -> ?path=roasting&name=...
 *   funfact   -> ?path=funfact&birthdate=YYYY-MM-DD
 *   lorem     -> ?path=lorem&count=3&unit=paragraph
 *   waifu     -> ?path=waifu&type=waifu     (proxy api.waifu.pics, ada fallback)
 *   tiktok    -> ?path=tiktok&url=...       (proxy upstream, opsional)
 *
 * Upstream eksternal hanya dipakai untuk yang memang butuh jaringan.
 * Kalau UPSTREAM_API_BASE tidak diset, TikTok akan balas pesan jelas
 * (bukan error mentah).
 */

import { toAlay, roast, funfact, loremIpsum } from '@/lib/funTools';

export const dynamic = 'force-dynamic';

const UPSTREAM = (process.env.UPSTREAM_API_BASE || '').replace(/\/$/, '');
const WAIFU_TYPES = new Set(['waifu', 'neko', 'shinobu', 'megumin', 'awoo', 'cuddle']);

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
  // terima ?path=alay maupun ?path=/fun/alay
  const raw = searchParams.get('path') || '';
  const action = raw.split('/').filter(Boolean).pop()?.toLowerCase() || '';

  switch (action) {
    // ------------------------- lokal -------------------------
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

    // ------------------------ jaringan ------------------------
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
        return fail('Sumber gambar anime sedang tidak bisa diakses. Coba lagi.', 502);
      }
    }

    case 'tiktok':
    case 'tiktokdl': {
      const url = searchParams.get('url') || '';
      if (!/^https?:\/\/(www\.|vm\.|vt\.|m\.)?tiktok\.com\//i.test(url)) {
        return fail('Link TikTok tidak valid. Contoh: https://www.tiktok.com/@user/video/123');
      }
      if (!UPSTREAM) {
        return fail(
          'Downloader butuh UPSTREAM_API_BASE di environment. Set dulu di Vercel, lalu fitur ini aktif.',
          503
        );
      }
      try {
        const res = await fetchWithTimeout(
          `${UPSTREAM}/downloader/tiktok?url=${encodeURIComponent(url)}`,
          15000
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        return Response.json(
          { status: true, result: data.result ?? data, source: 'upstream' },
          { headers: { 'Cache-Control': 'no-store' } }
        );
      } catch {
        return fail('Server downloader tidak merespons. Coba lagi nanti.', 502);
      }
    }

    default:
      return fail(
        `Action "${action || '(kosong)'}" tidak dikenal. Pilihan: alay, roasting, funfact, lorem, waifu, tiktok`,
        404
      );
  }
}
