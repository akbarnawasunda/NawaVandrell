import dynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

const DownloaderClient = dynamic(() => import('./DownloaderClient'), {
  ssr: false,
});

export default function Page() {
  return <DownloaderClient />;
}
