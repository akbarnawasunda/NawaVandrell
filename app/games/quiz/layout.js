import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Kuis interaktif',
  description: 'Pilih kuis singkat dan uji pengetahuanmu di arcade Nawa Editor.',
  path: '/games',
});

export default function QuizRoutesLayout({ children }) {
  return children;
}
