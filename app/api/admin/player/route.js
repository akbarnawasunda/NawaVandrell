/**
 * PATCH  /api/admin/player  { name, score }  -> set skor pemain (bisa turun)
 * DELETE /api/admin/player?name=...          -> hapus pemain
 * Semua butuh Authorization: Bearer <ADMIN_API_TOKEN>
 */

import { getLeaderboard, saveLeaderboard, deletePlayer } from '@/lib/db';
import { verifyBearer, unauthorized } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(request) {
  if (!verifyBearer(request)) return unauthorized();

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, message: 'Body harus JSON' }, { status: 400 });
  }

  const name = String(body?.name || '').trim().slice(0, 24);
  const score = Number(body?.score);

  if (!name) return Response.json({ success: false, message: 'Nama wajib' }, { status: 400 });
  if (!Number.isFinite(score) || score < 0) {
    return Response.json({ success: false, message: 'Skor tidak valid' }, { status: 400 });
  }

  const board = await getLeaderboard();
  board[name] = Math.floor(score);
  const persisted = await saveLeaderboard(board);

  return Response.json({ success: true, name, score: board[name], persisted });
}

export async function DELETE(request) {
  if (!verifyBearer(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const name = String(searchParams.get('name') || '').trim();
  if (!name) return Response.json({ success: false, message: 'Nama wajib' }, { status: 400 });

  const removed = await deletePlayer(name);
  if (!removed) {
    return Response.json({ success: false, message: 'Pemain tidak ditemukan' }, { status: 404 });
  }
  return Response.json({ success: true, name });
}
