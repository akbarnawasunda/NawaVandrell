import { verifyPin, rateLimit, resetRateLimit, isConfigured } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!isConfigured()) {
    return Response.json(
      { success: false, message: 'Admin belum dikonfigurasi. Set ADMIN_PIN & ADMIN_API_TOKEN di env.' },
      { status: 503 }
    );
  }

  const rl = rateLimit(request);
  if (!rl.allowed) {
    return Response.json(
      { success: false, message: `Terlalu banyak percobaan. Coba lagi dalam ${rl.retryAfter} detik.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));

  if (!verifyPin(body.pin)) {
    return Response.json({ success: false, message: 'PIN salah.' }, { status: 401 });
  }

  resetRateLimit(request);
  return Response.json({ success: true, token: process.env.ADMIN_API_TOKEN });
}
