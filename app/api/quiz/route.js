/**
 * GET /api/quiz?category=tebaktebakan&level=easy&exclude=id1,id2
 * -> { id, soal, level, category, points, total }
 *
 * Jawaban TIDAK dikirim ke client. Cek jawaban lewat /api/quiz/check.
 * ID deterministik ("category.level.index") jadi selalu sinkron antar endpoint.
 */

import { pickQuestion, isValidCategory } from '@/lib/quiz';
import { quizCategoryKeys } from '@/data/quizDatabase';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || '';
  const level = searchParams.get('level') || 'easy';
  const exclude = (searchParams.get('exclude') || '').split(',').filter(Boolean);

  if (!isValidCategory(category)) {
    return Response.json(
      { error: 'Kategori tidak ada', available: quizCategoryKeys },
      { status: 400 }
    );
  }

  const question = pickQuestion(category, level, exclude);
  if (!question) {
    return Response.json({ error: 'Soal belum tersedia untuk level ini' }, { status: 404 });
  }

  return Response.json(question, { headers: { 'Cache-Control': 'no-store' } });
}
