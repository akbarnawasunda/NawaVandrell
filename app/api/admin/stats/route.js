/**
 * GET /api/admin/stats
 * Header: Authorization: Bearer <ADMIN_API_TOKEN>
 * -> statistik ringkas untuk dashboard admin.
 */

import { getLeaderboard, storageDriver } from '@/lib/db';
import { verifyBearer, unauthorized } from '@/lib/auth';
import { countQuestions } from '@/data/quizDatabase';
import { featuredTools } from '@/data/featuredTools';
import { allGames } from '@/data/nexrayData';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!verifyBearer(request)) return unauthorized();

  const board = await getLeaderboard();
  const entries = Object.entries(board).map(([name, score]) => ({ name, score }));
  const scores = entries.map((e) => e.score);
  const total = scores.reduce((a, b) => a + b, 0);
  const quiz = countQuestions();

  return Response.json(
    {
      success: true,
      players: entries.length,
      totalScore: total,
      avgScore: entries.length ? Math.round(total / entries.length) : 0,
      topScore: scores.length ? Math.max(...scores) : 0,
      topPlayer: entries.sort((a, b) => b.score - a.score)[0]?.name || null,
      tools: featuredTools.length,
      games: allGames.length,
      quizQuestions: quiz.total,
      quizPerCategory: quiz.per,
      storage: storageDriver(),
      runtime: process.env.VERCEL ? 'vercel' : 'local',
      generatedAt: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
