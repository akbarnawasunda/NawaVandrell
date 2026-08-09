import { verifyBearer, unauthorized } from '@/lib/auth';
import { getLeaderboard, storageDriver } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!verifyBearer(request)) return unauthorized();

  const board = await getLeaderboard();
  const entries = Object.entries(board);
  const top = [...entries].sort((a, b) => b[1] - a[1])[0];

  return Response.json({
    success: true,
    stats: {
      players: entries.length,
      totalScore: entries.reduce((s, [, v]) => s + v, 0),
      topName: top?.[0] || '-',
      topScore: top?.[1] || 0,
      driver: storageDriver(),
    },
  });
}
