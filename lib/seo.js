import { featuredTools } from '@/data/featuredTools';
import { allGames } from '@/data/gameCatalog';

export const SITE_ORIGIN = 'https://nawaeditor.vercel.app';
const DEFAULT_IMAGE = '/og.png';

export function pageMetadata({ title, description, path = '/', image = DEFAULT_IMAGE }) {
  const cleanTitle = String(title || 'Nawa Editor').trim();
  const cleanDescription = String(description || 'Workbench kerja, dokumen, alat harian, dan game ringan yang praktis. Gratis, tanpa akun.').trim().slice(0, 300);
  const url = new URL(path, SITE_ORIGIN).toString();
  const imageUrl = new URL(image, SITE_ORIGIN).toString();
  const shareTitle = `${cleanTitle} · Nawa Editor`;
  return {
    title: cleanTitle,
    description: cleanDescription,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: 'Nawa Editor',
      title: shareTitle,
      description: cleanDescription,
      url,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: shareTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title: shareTitle,
      description: cleanDescription,
      images: [imageUrl],
    },
  };
}

export function toolMetadata(slug) {
  const tool = featuredTools.find((item) => item.slug === slug);
  const extraTools = {
    'sim-individual': {
      title: 'Lembar Persiapan SIM Pribadi',
      desc: 'Siapkan catatan dan dokumen pribadi sebelum mengurus SIM. Bukan formulir resmi.',
    },
  };
  const item = tool || extraTools[slug];
  const title = item?.title || slug.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  const description = item?.desc || 'Gunakan tool gratis Nawa Editor untuk menyelesaikan kebutuhan harian dengan praktis.';
  const path = slug === 'downloader' ? '/downloader' : `/tools/${slug}`;
  return pageMetadata({ title, description, path });
}

export function gameMetadata(slug) {
  const game = allGames.find((item) => item.slug === slug);
  if (!game) {
    return pageMetadata({
      title: 'Game singkat',
      description: 'Mainkan game singkat gratis di Nawa Editor.',
      path: `/games/${slug}`,
    });
  }
  return pageMetadata({
    title: game.name,
    description: `${game.desc || 'Game singkat'} — main gratis di arcade Nawa Editor.`,
    path: `/games/${slug}`,
  });
}
