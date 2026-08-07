/**
 * POST /api/admin/verify  { pin }
 * -> { success, token }
 *
 * PIN dibandingkan dengan ADMIN_PIN pakai crypto.timingSafeEqual (lib/auth.js),
 * dibatasi 5 percobaan / 10 menit per IP.
 * Token yang dibalikkan = ADMIN_API_TOKEN, dipakai sebagai Bearer di /api/admin/*.
 */

import { verifyPin, isConfigured, rateLimit, resetRateLimit } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!isConfigured()) {
    return Response.json(
      {
        success: false,
        message: 'ADMIN_PIN / ADMIN_API_TOKEN belum diset di environment.',
      },
      { status: 503 }
    );
  }

  const limit = rateLimit(request);
  if (!limit.allowed) {
    return Response.json(
      {
        success: false,
        message: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(limit.retryAfter / 60)} menit.`,
      },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, message: 'Body harus JSON' }, { status: 400 });
  }

  if (!verifyPin(body?.pin)) {
    return Response.json(
      {
        success: false,
        message: `PIN salah. Sisa percobaan: ${limit.remaining}`,
      },
      { status: 401 }
    );
  }

  resetRateLimit(request);

  return Response.json({
    success: true,
    token: process.env.ADMIN_API_TOKEN,
  });
}
