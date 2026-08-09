import QuizEngine from '@/components/QuizEngine';

export async function generateMetadata({ params }) {
  return { title: `Quiz ${params.slug}` };
}

export default function QuizPage({ params }) {
  return <QuizEngine cat={params.slug} />;
}
