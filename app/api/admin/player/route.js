import { verifyBearer, unauthorized } from '@/lib/auth';
import { getLeaderboard, saveLeaderboard } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(request) {
  if (!verifyBearer(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim().slice(0, 24);
  const score = Number(body.score);
  if (!name || !Number.isFinite(score) || score < 0) {
    return Response.json({ success: false, message: 'Data tidak valid' }, { status: 400 });
  }
  const board = await getLeaderboard();
  board[name] = Math.floor(Math.min(score, 9_999_999));
  await saveLeaderboard(board);
  return Response.json({ success: true });
}

export async function POST(request) {
  if (!verifyBearer(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim().slice(0, 24);
  const score = Number(body.score || 0);
  
  if (!name) return Response.json({ success: false, message: 'Nama wajib diisi' }, { status: 400 });
  
  const board = await getLeaderboard();
  if (board[name]) return Response.json({ success: false, message: 'Nama udah ada, pakai PATCH buat update' }, { status: 409 });
  
  board[name] = Math.floor(Math.max(0, Math.min(score, 9_999_999)));
  await saveLeaderboard(board);
  return Response.json({ success: true });
}

export async function DELETE(request) {
  if (!verifyBearer(request)) return unauthorized();
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') || '';
  if (!name) return Response.json({ success: false, message: 'Nama tidak ada' }, { status: 400 });
  const board = await getLeaderboard();
  if (!(name in board)) return Response.json({ success: false, message: 'Player tidak ditemukan' }, { status: 404 });
  delete board[name];
  await saveLeaderboard(board);
  return Response.json({ success: true });
}
