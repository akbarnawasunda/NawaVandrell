import { NextResponse } from 'next/server';
import { UnsafeUrlError } from '@/lib/safeUrl.mjs';
import { ensureYtdlpRuntime, inspectWithYtdlp, downloadWithYtdlp, MediaEngineError, isNetworkErrorText } from '@/lib/ytdlpServer.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonOk(data, status = 200) {
  return NextResponse.json(
    { status: true, ...data },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}

function jsonFail(message, status = 400, extra = {}) {
  return NextResponse.json(
    { status: false, error: message, ...extra },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}

/**
 * Mengubah galat menjadi respons JSON. Galat berkode (MediaEngineError) memakai status dan kode
 * yang tepat; galat lain dipetakan seperti sebelumnya (jaringan dibatasi → 502, lainnya → 400).
 */
function mapErrorResponse(err) {
  if (err instanceof UnsafeUrlError) {
    return jsonFail(err.message, 400);
  }
  if (err instanceof MediaEngineError) {
    return jsonFail(err.message, err.status || 400, { code: err.code, ...err.extra });
  }
  const msg = String(err.stderr || err.message || 'Gagal memproses permintaan yt-dlp.');
  const isNetwork = isNetworkErrorText(msg);
  return jsonFail(
    isNetwork
      ? 'Koneksi keluar server dibatasi untuk domain ini. Unduhan dari browser (stream publik) tetap bisa dipakai bila tersedia.'
      : msg.split('\n').filter(Boolean).pop() || 'Gagal memproses media.',
    isNetwork ? 502 : 400,
    { networkRestricted: isNetwork }
  );
}

function buildBinaryResponse(result) {
  const headers = new Headers();
  headers.set('Content-Type', result.mimeType || 'application/octet-stream');
  const encodedName = encodeURIComponent(result.filename);
  const asciiFallback = result.filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
  headers.set(
    'Content-Disposition',
    `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`
  );
  headers.set('Content-Length', String(result.size));
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Ytdlp-Filename', encodedName);
  headers.set('X-Ytdlp-File-Count', String(result.fileCount || 1));
  headers.set('X-Nawa-Preview', result.isPreview ? '1' : '0');
  headers.set('X-Nawa-Demo', result.demo ? '1' : '0');
  headers.set('X-Nawa-Skipped', String(result.skippedCount || 0));
  return new NextResponse(result.buffer, { status: 200, headers });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const action = (searchParams.get('action') || 'status').toLowerCase();

  try {
    if (action === 'status') {
      const rt = await ensureYtdlpRuntime();
      return jsonOk({ runtime: rt });
    }

    if (action === 'inspect') {
      const url = searchParams.get('url') || '';
      const playlistMode = searchParams.get('playlistMode') || 'full';
      const playlistRange = searchParams.get('playlistRange') || '';
      const res = await inspectWithYtdlp(url, { playlistMode, playlistRange });
      return jsonOk(res);
    }

    if (action === 'download') {
      const options = {
        url: searchParams.get('url') || '',
        mode: searchParams.get('mode') || 'audio',
        audioFormat: searchParams.get('audioFormat') || 'mp3',
        audioQuality: searchParams.get('audioQuality') || '0',
        videoFormat: searchParams.get('videoFormat') || 'mp4',
        videoResolution: searchParams.get('videoResolution') || '1080',
        otherFormat: searchParams.get('otherFormat') || 'subtitles',
        playlistMode: searchParams.get('playlistMode') || 'full',
        playlistRange: searchParams.get('playlistRange') || '',
        filenameTemplate: searchParams.get('filenameTemplate') || 'playlist_track',
        embedMetadata: searchParams.get('embedMetadata') !== 'false',
        embedThumbnail: searchParams.get('embedThumbnail') !== 'false',
        embedSubtitles: searchParams.get('embedSubtitles') === 'true',
        sponsorBlock: searchParams.get('sponsorBlock') === 'true',
        splitChapters: searchParams.get('splitChapters') === 'true',
        clipStart: searchParams.get('clipStart') || '',
        clipEnd: searchParams.get('clipEnd') || '',
        bundleAsZip: searchParams.get('bundleAsZip') === 'true',
        customTitle: searchParams.get('customTitle') || '',
      };
      const result = await downloadWithYtdlp(options);
      return buildBinaryResponse(result);
    }

    return jsonFail(`Aksi "${action}" tidak dikenal.`, 400);
  } catch (err) {
    return mapErrorResponse(err);
  }
}

export async function POST(req) {
  let body = {};
  try {
    body = await req.json();
  } catch {
    return jsonFail('Payload JSON tidak valid.', 400);
  }

  const action = String(body.action || 'inspect').toLowerCase();

  try {
    if (action === 'status') {
      const rt = await ensureYtdlpRuntime();
      return jsonOk({ runtime: rt });
    }

    if (action === 'inspect') {
      const res = await inspectWithYtdlp(body.url || body.input || '', body.options || body);
      return jsonOk(res);
    }

    if (action === 'download') {
      const result = await downloadWithYtdlp(body);
      return buildBinaryResponse(result);
    }

    return jsonFail(`Aksi "${action}" tidak dikenal.`, 400);
  } catch (err) {
    return mapErrorResponse(err);
  }
}
