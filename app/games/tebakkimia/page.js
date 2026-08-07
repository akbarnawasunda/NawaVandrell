'use client';

import QuizEngine from '@/components/QuizEngine';
import { quizMeta } from '@/data/quizDatabase';

const CATEGORY = 'tebakkimia';

export default function Page() {
  const meta = quizMeta[CATEGORY];
  return <QuizEngine category={CATEGORY} title={meta.name} desc={meta.desc} icon={meta.icon} />;
}
