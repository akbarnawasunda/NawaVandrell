import {
  createAdminSession,
  isConfigured,
  isSameOriginRequest,
  rateLimit,
  resetRateLimit,
  serializeAdminSessionCookie,
  verifyPin,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  if (!isConfigured()) {
    return Response.json(
      { success: false, message: 'Akses admin belum dikonfigurasi dengan aman.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  if (!isSameOriginRequest(request)) {
    return Response.json(
      { success: false, message: 'Permintaan login tidak valid.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const limit = await rateLimit(request);
  if (!limit.allowed) {
    return Response.json(
      { success: false, message: `Terlalu banyak percobaan. Coba lagi dalam ${limit.retryAfter} detik.` },
      {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': String(limit.retryAfter),
        },
      }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, message: 'Permintaan login tidak valid.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (!verifyPin(body?.pin)) {
    return Response.json(
      { success: false, message: 'Kunci admin salah.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  await resetRateLimit(request);
  const session = createAdminSession();
  return Response.json(
    { success: true },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Set-Cookie': serializeAdminSessionCookie(session),
      },
    }
  );
}
