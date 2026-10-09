import { gameMetadata } from '@/lib/seo';

export const metadata = gameMetadata('memory-matrix');

export default function GameRouteLayout({ children }) {
  return children;
}
