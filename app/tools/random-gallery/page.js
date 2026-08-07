'use client';

import { useCallback, useEffect, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import SkeletonLoader from '@/components/SkeletonLoader';
import { useToast } from '@/context/ToastContext';
import { CECAN_IMAGES } from '@/data/cecanImages';
import { galleryModes } from '@/data/nexrayData';

const WAIFU_TYPES = ['waifu', 'neko', 'shinobu', 'megumin'];

export default function RandomGalleryPage() {
  const { addToast } = useToast();
  const [mode, setMode] = useState('cecan');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (which = mode) => {
      setLoading(true);
      setError('');
      setImage(null);

      try {
        if (which === 'cecan') {
          const idx = Math.floor(Math.random() * CECAN_IMAGES.length);
          setImage(CECAN_IMAGES[idx]);
          return;
        }

        if (which === 'aesthetic') {
          // picsum: seed acak -> gambar stabil per seed, tanpa API key
          const seed = Math.random().toString(36).slice(2, 10);
          setImage(`https://picsum.photos/seed/${seed}/800/1200`);
          return;
        }

        // waifu -> lewat tool-proxy supaya tidak kena CORS
        const type = WAIFU_TYPES[Math.floor(Math.random() * WAIFU_TYPES.length)];
        const res = await fetch(`/api/tool-proxy?path=waifu&type=${type}`);
        const data = await res.json();
        if (!res.ok || !data.status) throw new Error(data.error || 'gagal');
        setImage(data.result);
      } catch (err) {
        setError(err.message || 'Gagal memuat gambar. Coba lagi.');
      } finally {
        setLoading(false);
      }
    },
    [mode]
  );

  useEffect(() => {
    load(mode);
  }, [mode, load]);

  return (
    <ToolShell title="Galeri Acak" desc="Cecan Indonesia, waifu anime, atau wallpaper aesthetic." icon="📸">
      <div className="panel">
        <div className="field">
          <div style={{ display: 'grid', gap: 7 }}>
            {galleryModes.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`btn ${mode === m.id ? 'btn-primary' : 'btn-ghost'} btn-full`}
                onClick={() => setMode(m.id)}
              >
                <span aria-hidden="true">{m.icon}</span> {m.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ minHeight: 200 }}>
          {loading ? (
            <SkeletonLoader type="image" />
          ) : error ? (
            <p className="err">{error}</p>
          ) : image ? (
            <img
              src={image}
              alt="Gambar acak"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setError('Gambar ini gagal dimuat. Klik acak lagi.')}
              style={{
                width: '100%',
                maxHeight: 420,
                objectFit: 'cover',
                borderRadius: 12,
                border: '1px solid var(--border)',
                display: 'block',
              }}
            />
          ) : null}
        </div>

        <div className="btn-row" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 2 }}
            onClick={() => load()}
            disabled={loading}
          >
            🔄 Acak Lagi
          </button>
          {image ? (
            <a
              href={image}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
              onClick={() => addToast('Dibuka di tab baru', 'info')}
            >
              Buka
            </a>
          ) : null}
        </div>

        <p className="hint">
          Gambar diambil dari sumber publik. NawaVandrell tidak menyimpan atau memiliki gambar-gambar
          ini.
        </p>
      </div>
    </ToolShell>
  );
}
