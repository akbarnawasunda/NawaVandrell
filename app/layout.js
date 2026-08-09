import './globals.css';
import Script from 'next/script';
import { ToastProvider } from '@/context/ToastContext';
import { ModeProvider } from '@/context/ModeContext';
import TopBar from '@/components/TopBar';
import CommandPalette from '@/components/CommandPalette';

export const metadata = {
  title: {
    default: 'NawaVandrell 3.0 — Neuro Core Digital Arsenal',
    template: '%s · NawaVandrell 3.0',
  },
  description:
    'All-in-one downloader, tools harian, dan arcade game dalam satu tempat. Gratis, tanpa daftar.',
  manifest: '/manifest.json',
  applicationName: 'NawaVandrell 3.0',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  openGraph: {
    title: 'NawaVandrell 3.0 — Neuro Core Digital Arsenal',
    description: 'All-in-one downloader, tools harian, dan arcade game. Gratis, tanpa daftar.',
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
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Space+Grotesk:wght@500;700&display=swap"
          rel="stylesheet"
        />
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
        <div className="noise" aria-hidden="true" />

        <ModeProvider>
          <ToastProvider>
            <TopBar />
            <main>{children}</main>
            <CommandPalette />
            <MicroAudioController />
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

        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window !== 'undefined') {
                  window.addEventListener('pointermove', function(e) {
                    document.querySelectorAll('.bento-card, .card').forEach(function(card) {
                      var rect = card.getBoundingClientRect();
                      card.style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px');
                      card.style.setProperty('--mouse-y', (e.clientY - rect.top) + 'px');
                    });
                  }, { passive: true });
                }
              })();
            `,
          }}
        />
        <Script id="nawa-sw" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); }); }`}
        </Script>
      </body>
    </html>
  );
}
