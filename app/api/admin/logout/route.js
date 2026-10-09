import { clearAdminSessionCookie, isSameOriginRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return Response.json(
      { success: false, message: 'Permintaan logout tidak valid.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  return Response.json(
    { success: true },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Set-Cookie': clearAdminSessionCookie(),
      },
    }
  );
}
