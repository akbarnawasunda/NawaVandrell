// app/layout.js

import './globals.css';
import Script from 'next/script';
import { ToastProvider } from '@/context/ToastContext';
import { ModeProvider } from '@/context/ModeContext';
import TopBar from '@/components/TopBar';

export const metadata = {
  title: {
    default: 'NawaVandrell 3.0 — Tools yang beneran gampang dipakai',
    template: '%s · NawaVandrell 3.0',
  },
  description:
    'NawaVandrell 3.0: all-in-one downloader, QR code, stiker WA, kompres foto, password generator, JSON formatter, dan arcade game. Gratis, langsung jalan di browser.',
  manifest: '/manifest.json',
  applicationName: 'NawaVandrell 3.0',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'NawaVandrell 3.0',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'NawaVandrell 3.0 — Neuro Core Digital Arsenal',
    description:
      'All-in-one downloader, tools harian, dan arcade game dalam satu tempat. Gratis, tanpa daftar.',
    type: 'website',
  },
};

export const viewport = {
  themeColor: '#040408',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" data-mode="simple" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="dark" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />

        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />

        {/*
          Set mode sebelum first paint biar gak ada flash theme.
          Default: simple. Kalau localStorage bilang pro, langsung pro.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('nawa_mode');document.documentElement.dataset.mode=(m==='pro'?'pro':'simple');}catch(e){}})();`,
          }}
        />
      </head>

      <body>
        {/* Background orbs + cyber grid */}
        <div className="backdrop" aria-hidden="true">
          <span className="orb orb-1" />
          <span className="orb orb-2" />
          <span className="orb orb-3" />
        </div>

        <div className="grid-bg" aria-hidden="true" />

        <ModeProvider>
          <ToastProvider>
            <TopBar />

            <main>{children}</main>

            <footer className="footer">
              <p style={{ margin: '0 0 6px' }}>
                <strong>NawaVandrell 3.0</strong> — Neuro Core Digital Arsenal
              </p>

              <p style={{ margin: 0 }}>
                Semua proses jalan di browser kamu. <a href="/admin">Admin</a>
              </p>
            </footer>
          </ToastProvider>
        </ModeProvider>

        {/* PWA service worker */}
        <Script id="nawa-sw" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}`}
        </Script>
      </body>
    </html>
  );
}
