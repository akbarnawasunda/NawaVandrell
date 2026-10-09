import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Tools gratis untuk kebutuhan harian',
  description: 'Jelajahi alat gratis untuk kerja, kreativitas, teks, gambar, dan kebutuhan harian di Nawa Editor.',
  path: '/#tools',
});

export default function ToolsLayout({ children }) {
  return children;
}
