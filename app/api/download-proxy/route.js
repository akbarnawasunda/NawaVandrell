import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req) {
  const targetUrl = new URL(req.url).searchParams.get('url');
  if (!targetUrl) return NextResponse.json({ error: 'URL target kosong' }, { status: 400 });

  try {
    const isTiktok = targetUrl.includes('tiktok');
    const isTwitter = targetUrl.includes('twimg') || targetUrl.includes('twitter') || targetUrl.includes('x.com');
    const isIg = targetUrl.includes('instagram') || targetUrl.includes('fbcdn');

    // NYAMAR JADI BROWSER ASLI
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Sec-Fetch-Dest': 'video',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site',
    };

    // KUNCI UTAMA: SPOOF REFERER & ORIGIN BIAR GAK DI-403 CDN
    if (isTiktok) {
      headers['Referer'] = 'https://www.tiktok.com/';
      headers['Origin'] = 'https://www.tiktok.com';
    } else if (isTwitter) {
      headers['Referer'] = 'https://twitter.com/';
      headers['Origin'] = 'https://twitter.com';
    } else if (isIg) {
      headers['Referer'] = 'https://www.instagram.com/';
      headers['Origin'] = 'https://www.instagram.com';
    }

    const res = await fetch(targetUrl, { headers, redirect: 'follow' });

    if (!res.ok) {
      console.error('[PROXY] CDN rejected:', res.status);
      return NextResponse.json({ error: 'CDN nolak request', status: res.status }, { status: 502 });
    }

    const contentType = res.headers.get('Content-Type') || 'video/mp4';
    const contentLength = res.headers.get('Content-Length');
    
    // PAKSA BROWSER DOWNLOAD
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', contentType);
    responseHeaders.set('Content-Disposition', 'attachment; filename="nawavandrell_media.mp4"');
    if (contentLength) responseHeaders.set('Content-Length', contentLength);
    responseHeaders.set('Cache-Control', 'no-store');
    responseHeaders.set('Accept-Ranges', 'bytes');

    return new NextResponse(res.body, { headers: responseHeaders });
  } catch (e) {
    console.error('[PROXY ERROR]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
