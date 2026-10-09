import QuizEngine from '@/components/QuizEngine';
import { gameMetadata } from '@/lib/seo';

export async function generateMetadata({ params }) {
  return gameMetadata(params.slug);
}

export default function QuizPage({ params }) {
  return <QuizEngine cat={params.slug} />;
}
