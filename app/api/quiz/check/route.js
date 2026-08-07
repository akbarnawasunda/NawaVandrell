/**
 * POST /api/quiz/check
 * body: { id, answer, streak? }
 * -> { correct, pointsAwarded, multiplier, jawaban? }
 *
 * Soal diambil dari `id` (deterministik), bukan dari state server,
 * jadi tidak ada lagi mismatch soal seperti versi lama.
 * Jawaban benar hanya dibocorkan kalau user sudah benar.
 */

import { getQuestionById, checkAnswer, pointsFor } from '@/lib/quiz';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body harus JSON' }, { status: 400 });
  }

  const found = getQuestionById(body?.id);
  if (!found) {
    return Response.json({ error: 'ID soal tidak valid' }, { status: 400 });
  }

  const correct = checkAnswer(found.item, body?.answer);
  const base = pointsFor(found.level);

  // multiplier dihitung server-side dari streak yang dilaporkan,
  // tapi di-clamp supaya tidak bisa dimanipulasi jadi angka besar.
  const streak = Math.max(0, Math.min(999, Number(body?.streak) || 0));
  const multiplier = streak >= 5 ? 3 : streak >= 2 ? 2 : 1;

  return Response.json({
    correct,
    pointsAwarded: correct ? base * multiplier : 0,
    basePoints: base,
    multiplier,
    ...(correct ? { jawaban: found.item.jawaban } : {}),
  });
}
