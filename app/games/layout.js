import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Game singkat gratis',
  description: 'Pilih game arcade gratis untuk menguji logika, ingatan, kata, dan kecepatan di Nawa Editor.',
  path: '/games',
});

export default function GamesLayout({ children }) {
  return children;
}
