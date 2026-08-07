/**
 * GET /api/quiz/reveal?id=category.level.index
 * -> { jawaban, alt }
 * Dipakai saat user klik "Lewati / Lihat Jawaban".
 */

import { getQuestionById } from '@/lib/quiz';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  // dukung ?id= dan ?questionId= (kompatibel dengan client lama)
  const id = searchParams.get('id') || searchParams.get('questionId');

  const found = getQuestionById(id);
  if (!found) {
    return Response.json({ error: 'ID soal tidak valid' }, { status: 400 });
  }

  return Response.json(
    {
      jawaban: found.item.jawaban,
      alt: found.item.alt || [],
      soal: found.item.soal,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
