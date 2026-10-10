import './globals.css';
import './nv-tools.css';
import './sim-tool.css';
import Script from 'next/script';
import { ToastProvider } from '@/context/ToastContext';
import TopBar from '@/components/TopBar';
import CommandPalette from '@/components/CommandPalette';
import DownloadOverlay from '@/components/DownloadOverlay';
import { SITE_ORIGIN } from '@/lib/seo';

const siteDescription = 'Kumpulan alat harian, dokumen, dan game ringan yang berjalan cepat di browser. Gratis, tanpa akun.';

export const metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: 'Nawa Editor — Alat harian yang sederhana dan cepat',
    template: '%s · Nawa Editor',
  },
  description: siteDescription,
  manifest: '/manifest.json',
  applicationName: 'Nawa Editor',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  openGraph: {
    type: 'website',
    siteName: 'Nawa Editor',
    title: 'Nawa Editor — Alat harian yang sederhana dan cepat',
    description: siteDescription,
    url: SITE_ORIGIN,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Nawa Editor — Alat harian yang sederhana dan cepat' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nawa Editor — Alat harian yang sederhana dan cepat',
    description: siteDescription,
    images: ['/og.png'],
  },
};

export const viewport = {
  themeColor: '#f4f5f7',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <meta name="color-scheme" content="light" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'Nawa Editor',
              url: SITE_ORIGIN,
              applicationCategory: 'UtilitiesApplication',
              operatingSystem: 'Any',
              description: siteDescription,
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'IDR' },
            }),
          }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main-content">Lewati ke konten</a>
        <ToastProvider>
          <TopBar />
          <main id="main-content" tabIndex="-1">{children}</main>
          <CommandPalette />
          <DownloadOverlay />
          <footer className="site-footer">
            <div className="site-footer-main">
              <a href="/" className="footer-brand">
                <span className="brand-symbol" aria-hidden="true">N</span>
                <span>Nawa <strong>Editor</strong></span>
              </a>
              <p>Alat harian yang sederhana, cepat, dan gratis. Diproses langsung di browser kamu.</p>
            </div>
            <nav className="footer-links" aria-label="Tautan footer">
              <a href="/#tools">Semua alat</a>
              <a href="/downloader">Downloader</a>
              <a href="/tools/sim-application">Rekap SIM kolektif</a>
              <a href="/games">Game</a>
              <a href="/leaderboard">Papan peringkat</a>
              <a href="/privacy">Privasi</a>
              <a href="/terms">Ketentuan</a>
              <a href="https://github.com/akbarnawasunda/nawaeditor/issues" target="_blank" rel="noopener noreferrer">Laporkan masalah</a>
            </nav>
            <div className="site-footer-meta">
              <span>© {new Date().getFullYear()} Nawa Editor</span>
              <span>Dibuat agar urusan kecil terasa ringan.</span>
            </div>
          </footer>
        </ToastProvider>

        <Script id="nawa-sw" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator) { var neRegisterSw = function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); }; if (document.readyState === 'complete') { neRegisterSw(); } else { window.addEventListener('load', neRegisterSw); } }`}
        </Script>
      </body>
    </html>
  );
}
