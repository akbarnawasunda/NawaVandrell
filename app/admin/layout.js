export const metadata = {
  title: 'Akses terbatas',
  description: 'Area privat pengelola Nawa Vandrell.',
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export default function AdminLayout({ children }) {
  return children;
}
