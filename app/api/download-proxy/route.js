import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req) {
  const targetUrl = new URL(req.url).searchParams.get('url');
  if (!targetUrl) {
    return NextResponse.json({ error: 'URL target kosong' }, { status: 400 });
  }

  try {
    // Server-side fetch pake User-Agent browser biar gak diblokir CDN
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'CDN nolak request', status: res.status }, { status: 502 });
    }

    // Ambil stream body langsung dari CDN (hemat memori server)
    const headers = new Headers(res.headers);
    
    // PAKSA BROWSER DOWNLOAD (ini kuncinya)
    headers.set('Content-Disposition', 'attachment; filename="nawavandrell_media.mp4"');
    headers.set('Content-Type', res.headers.get('Content-Type') || 'video/mp4');
    
    // Hapus header yang bisa bikin konflik CORS di browser
    headers.delete('content-security-policy');
    headers.delete('x-content-type-options');

    return new NextResponse(res.body, { headers });
  } catch (e) {
    console.error('[PROXY ERROR]', e);
    return NextResponse.json({ error: 'Gagal fetch dari CDN' }, { status: 500 });
  }
}
