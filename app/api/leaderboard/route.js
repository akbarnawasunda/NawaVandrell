/**
 * GET  /api/leaderboard          -> top 20 tersortir (publik)
 * GET  /api/leaderboard?raw=1    -> map mentah { name: score }  (BUTUH Bearer token)
 * POST /api/leaderboard          -> { name, score }  submit skor 1 pemain (publik, best-score only)
 * POST /api/leaderboard          -> { <name>: <score>, ... } timpa penuh (BUTUH Bearer token)
 *
 * FIX BUG LAMA: dulu POST bisa menimpa SELURUH leaderboard tanpa auth sama sekali.
 * Sekarang penulisan massal wajib Bearer ADMIN_API_TOKEN, dan submit publik
 * hanya boleh menaikkan skor pemain itu sendiri.
 */

import { getRanked, getLeaderboard, saveLeaderboard, submitScore } from '@/lib/db';
import { verifyBearer, unauthorized } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get('raw') === '1') {
    if (!verifyBearer(request)) return unauthorized('Butuh token admin untuk data mentah');
    const board = await getLeaderboard();
    return Response.json(board, { headers: { 'Cache-Control': 'no-store' } });
  }

  const limit = Number(searchParams.get('limit')) || 20;
  const ranked = await getRanked(limit);
  return Response.json(ranked, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, message: 'Body harus JSON' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Response.json({ success: false, message: 'Format tidak valid' }, { status: 400 });
  }

  // --- Mode 1: submit satu pemain (publik) ---
  if (typeof body.name === 'string' && body.score !== undefined) {
    const result = await submitScore(body.name, body.score);
    if (!result.ok) {
      return Response.json({ success: false, message: result.error }, { status: 400 });
    }
    return Response.json({
      success: true,
      name: result.username,
      score: result.score,
      persisted: result.persisted,
    });
  }

  // --- Mode 2: timpa seluruh board (admin only) ---
  if (!verifyBearer(request)) {
    return unauthorized('Penulisan massal butuh Bearer ADMIN_API_TOKEN');
  }

  const ok = await saveLeaderboard(body);
  return Response.json({ success: true, persisted: ok });
}
