/**
 * Service worker NawaVandrell.
 *
 * Strategi:
 * - Navigasi (HTML)  -> network-first, fallback cache, terakhir halaman offline.
 * - Aset statis      -> stale-while-revalidate.
 * - /api/*           -> TIDAK pernah di-cache (leaderboard & kuis harus segar).
 *
 * Kenapa tidak precache halaman? Next.js App Router pakai hash build,
 * jadi lebih aman meng-cache saat halaman benar-benar dikunjungi.
 */

const VERSION = 'nawa-v2';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const PRECACHE = ['/', '/games', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function isAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    /\.(?:css|js|woff2?|ttf|svg|png|jpe?g|webp|ico)$/i.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // beda origin (gambar pihak ketiga) -> biarkan browser yang urus
  if (url.origin !== self.location.origin) return;

  // API selalu langsung ke jaringan
  if (url.pathname.startsWith('/api/')) return;

  // Navigasi halaman: network-first supaya konten selalu terbaru
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const home = await caches.match('/');
          if (home) return home;
          return new Response(
            '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
              '<body style="background:#0a0a0b;color:#e5e7eb;font-family:system-ui;text-align:center;padding:60px 20px">' +
              '<h1 style="color:#10b981">Kamu sedang offline</h1>' +
              '<p>Halaman ini belum pernah dibuka, jadi belum tersimpan. Coba lagi setelah online.</p></body>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
          );
        })
    );
    return;
  }

  // Aset statis: pakai cache dulu, perbarui di belakang
  if (isAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSET_CACHE).then((c) => c.put(request, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
