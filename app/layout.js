import './globals.css';
import Script from 'next/script';
import { ToastProvider } from '@/context/ToastContext';
import { ModeProvider } from '@/context/ModeContext';
import TopBar from '@/components/TopBar';

export const metadata = {
  title: {
    default: 'NawaVandrell — Tools yang beneran gampang dipakai',
    template: '%s · NawaVandrell',
  },
  description:
    'NawaVandrell: 20 tools praktis + 15 game seru. Bikin QR, stiker WA, kompres foto, password, dan banyak lagi. Gratis, langsung jalan di browser.',
  manifest: '/manifest.json',
  applicationName: 'NawaVandrell',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'NawaVandrell' },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  openGraph: {
    title: 'NawaVandrell — Digital Arsenal',
    description: '20 tools + 15 game, gratis dan langsung jalan di browser.',
    type: 'website',
  },
};

export const viewport = {
  themeColor: '#10B981',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" data-mode="simple" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* Set mode sebelum paint supaya tidak ada kedip tema */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('nawa_mode');document.documentElement.dataset.mode=(m==='pro'?'pro':'simple');}catch(e){}})();`,
          }}
        />
      </head>
      <body>
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
                <strong>NawaVandrell 2.0</strong> — Neuro Core Digital Arsenal
              </p>
              <p style={{ margin: 0 }}>
                Semua proses jalan di browser kamu. <a href="/admin">Admin</a>
              </p>
            </footer>
          </ToastProvider>
        </ModeProvider>

        <Script id="nawa-sw" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator) {
              window.addEventListener('load', function () {
                navigator.serviceWorker.register('/sw.js').catch(function(){});
              });
            }`}
        </Script>
      </body>
    </html>
  );
}
