import '@fontsource-variable/plus-jakarta-sans/wght.css';
import '@fontsource-variable/space-grotesk/wght.css';
import './globals.css';
import Script from 'next/script';
import { ToastProvider } from '@/context/ToastContext';
import { ModeProvider } from '@/context/ModeContext';
import TopBar from '@/components/TopBar';
import CommandPalette from '@/components/CommandPalette';
import MicroAudioController from '@/components/MicroAudioController';

const siteDescription = 'Satu ruang untuk tools harian, kreativitas, rekap SIM kolektif, dan mini game. Gratis tanpa langganan.';

export const metadata = {
  metadataBase: new URL('https://nawavandrell.vercel.app'),
  title: {
    default: 'Nawa Vandrell — Tools praktis, ide kreatif, arcade',
    template: '%s · Nawa Vandrell',
  },
  description: siteDescription,
  manifest: '/manifest.json',
  applicationName: 'Nawa Vandrell',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  openGraph: {
    type: 'website',
    siteName: 'Nawa Vandrell',
    title: 'Nawa Vandrell — Satu ruang untuk banyak hal',
    description: siteDescription,
    url: 'https://nawavandrell.vercel.app',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Nawa Vandrell — Satu ruang untuk banyak hal' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nawa Vandrell — Satu ruang untuk banyak hal',
    description: siteDescription,
    images: ['/og.png'],
  },
};

export const viewport = {
  themeColor: '#080b14',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" data-mode="simple" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="dark" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'Nawa Vandrell',
              url: 'https://nawavandrell.vercel.app',
              applicationCategory: 'UtilitiesApplication',
              operatingSystem: 'Any',
              description: siteDescription,
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'IDR' },
            }),
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('nawa_mode');document.documentElement.dataset.mode=(m==='pro'?'pro':'simple');}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main-content">Lewati ke konten</a>
        <div className="backdrop" aria-hidden="true">
          <span className="orb orb-1" />
          <span className="orb orb-2" />
          <span className="orb orb-3" />
        </div>
        <div className="grid-bg" aria-hidden="true" />
        <div className="noise" aria-hidden="true" />

        <ModeProvider>
          <ToastProvider>
            <TopBar />
            <main id="main-content" tabIndex="-1">{children}</main>
            <CommandPalette />
            <MicroAudioController />
            <footer className="site-footer">
              <div className="site-footer-main">
                <a href="/" className="footer-brand">
                  <span className="brand-symbol" aria-hidden="true">N</span>
                  <span>Nawa <strong>Vandrell</strong></span>
                </a>
                <p>Tools praktis, ruang kreatif, dan jeda kecil untuk main.</p>
              </div>
              <nav className="footer-links" aria-label="Tautan footer">
                <a href="/#tools">Semua tools</a>
                <a href="/tools/sim-application">Rekap SIM kolektif</a>
                <a href="/games">Arcade</a>
                <a href="/leaderboard">Papan peringkat</a>
                <a href="/admin">Admin</a>
              </nav>
              <div className="site-footer-meta">
                <span>© {new Date().getFullYear()} Nawa Vandrell</span>
                <span>Dibuat untuk hari-hari yang lebih ringan.</span>
              </div>
            </footer>
          </ToastProvider>
        </ModeProvider>

        <Script id="nawa-sw" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); }); }`}
        </Script>
      </body>
    </html>
  );
}
