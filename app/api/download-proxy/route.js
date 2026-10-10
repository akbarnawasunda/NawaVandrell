import { NextResponse } from 'next/server';
import { fetchPublicUrl, UnsafeUrlError } from '@/lib/safeUrl.mjs';
import { sanitizeSafeFilename } from '@/lib/ytdlp.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get('url');
  const rawName = searchParams.get('filename') || '';
  const rawExt = searchParams.get('ext') || '';

  if (!targetUrl) return NextResponse.json({ error: 'URL target kosong' }, { status: 400 });
  if (targetUrl.length > 2048) return NextResponse.json({ error: 'URL terlalu panjang' }, { status: 400 });

  try {
    const isTiktok = targetUrl.includes('tiktok');
    const isTwitter = targetUrl.includes('twimg') || targetUrl.includes('twitter') || targetUrl.includes('x.com');
    const isIg = targetUrl.includes('instagram') || targetUrl.includes('fbcdn');

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Sec-Fetch-Dest': 'video',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site',
    };

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

    const res = await fetchPublicUrl(targetUrl, { headers });

    if (!res.ok) {
      return NextResponse.json({ error: 'CDN menolak permintaan', status: res.status }, { status: 502 });
    }

    const contentType = res.headers.get('Content-Type') || 'video/mp4';
    const contentLength = res.headers.get('Content-Length');

    let defaultExt = rawExt;
    if (!defaultExt) {
      if (contentType.includes('mpeg') || contentType.includes('mp3')) defaultExt = 'mp3';
      else if (contentType.includes('audio/mp4') || contentType.includes('m4a')) defaultExt = 'm4a';
      else if (contentType.includes('flac')) defaultExt = 'flac';
      else if (contentType.includes('wav')) defaultExt = 'wav';
      else if (contentType.includes('ogg') || contentType.includes('opus')) defaultExt = 'ogg';
      else if (contentType.includes('webm')) defaultExt = 'webm';
      else if (contentType.includes('jpeg') || contentType.includes('jpg')) defaultExt = 'jpg';
      else if (contentType.includes('png')) defaultExt = 'png';
      else defaultExt = 'mp4';
    }

    const safeName = sanitizeSafeFilename(rawName || 'nawa-editor_media', 'nawa-editor_media', defaultExt);
    const asciiName = safeName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', contentType);
    responseHeaders.set(
      'Content-Disposition',
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`
    );
    if (contentLength) responseHeaders.set('Content-Length', contentLength);
    responseHeaders.set('Cache-Control', 'no-store');
    responseHeaders.set('Accept-Ranges', 'bytes');

    return new NextResponse(res.body, { headers: responseHeaders });
  } catch (e) {
    if (e instanceof UnsafeUrlError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Gagal mengambil media' }, { status: 500 });
  }
}
