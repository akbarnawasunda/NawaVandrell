import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Papan peringkat game',
  description: 'Lihat skor tertinggi para pemain di arcade gratis Nawa Vandrell.',
  path: '/leaderboard',
});

export default function LeaderboardLayout({ children }) {
  return children;
}
