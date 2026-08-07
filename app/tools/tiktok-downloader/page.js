'use client';

import { useState } from 'react';
import ToolShell from '@/components/ToolShell';
import SkeletonLoader from '@/components/SkeletonLoader';
import { useToast } from '@/context/ToastContext';

const TIKTOK_RE = /^https?:\/\/(www\.|vm\.|vt\.|m\.)?tiktok\.com\//i;

export default function TiktokDownloaderPage() {
  const { addToast } = useToast();
  const [url, setUrl] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const clean = url.trim();
    if (!clean) {
      addToast('Tempel link TikTok-nya dulu', 'warning');
      return;
    }
    if (!TIKTOK_RE.test(clean)) {
      setError('Link-nya bukan TikTok. Contoh: https://www.tiktok.com/@user/video/123456');
      setData(null);
      return;
    }

    setLoading(true);
    setError('');
    setData(null);

    try {
      const res = await fetch(`/api/tool-proxy?path=tiktok&url=${encodeURIComponent(clean)}`);
      const json = await res.json();
      if (!res.ok || !json.status) {
        setError(json.error || 'Gagal mengambil video.');
        return;
      }
      setData(json.result);
      addToast('Video ditemukan', 'success');
    } catch {
      setError('Koneksi bermasalah. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        setError('');
      }
    } catch {
      addToast('Gak bisa akses clipboard, tempel manual ya', 'warning');
    }
  };

  // upstream bisa balas bentuk yang beda-beda, jadi kumpulkan link video apa pun yang ada
  const videoLinks = data
    ? [
        { label: 'Tanpa Watermark', href: data.play || data.nowatermark || data.video || data.hdplay },
        { label: 'Dengan Watermark', href: data.wmplay || data.watermark },
        { label: 'Audio (MP3)', href: data.music || data.audio },
      ].filter((l) => typeof l.href === 'string' && l.href.startsWith('http'))
    : [];

  return (
    <ToolShell title="Download TikTok" desc="Tempel link video TikTok, ambil versi tanpa watermark." icon="⬇️">
      <div className="panel">
        <div className="field">
          <label className="label" htmlFor="tt-url">
            Link video TikTok
          </label>
          <input
            id="tt-url"
            className="input"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="https://www.tiktok.com/@user/video/..."
            inputMode="url"
            spellCheck={false}
          />
        </div>

        <div className="btn-row">
          <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={submit} disabled={loading}>
            {loading ? 'Mencari...' : 'Ambil Video'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={paste}>
            📋 Tempel
          </button>
        </div>

        {loading ? (
          <div style={{ marginTop: 16 }}>
            <SkeletonLoader lines={3} />
          </div>
        ) : null}

        {error ? <p className="err">{error}</p> : null}

        {data ? (
          <div className="result">
            <div className="result-head">
              <span>Hasil</span>
            </div>

            {data.cover || data.origin_cover ? (
              <img
                src={data.cover || data.origin_cover}
                alt="Thumbnail video"
                referrerPolicy="no-referrer"
                style={{
                  width: '100%',
                  maxHeight: 240,
                  objectFit: 'cover',
                  borderRadius: 10,
                  marginBottom: 12,
                }}
              />
            ) : null}

            {data.title ? (
              <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text)' }}>{data.title}</p>
            ) : null}

            {data.author?.nickname || data.author ? (
              <p className="hint" style={{ marginTop: 0 }}>
                oleh {data.author?.nickname || String(data.author)}
              </p>
            ) : null}

            {videoLinks.length ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {videoLinks.map((l) => (
                  <a
                    key={l.label}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-full"
                    download
                  >
                    📥 {l.label}
                  </a>
                ))}
              </div>
            ) : (
              <p className="hint" style={{ marginTop: 0 }}>
                Server balas data, tapi tidak ada link unduhan yang dikenali.
              </p>
            )}
          </div>
        ) : null}

        <p className="hint">
          Fitur ini butuh server pihak ketiga (env <code>UPSTREAM_API_BASE</code>) karena TikTok
          tidak bisa diakses langsung dari browser. Tool lain di NawaVandrell jalan tanpa internet.
        </p>
      </div>
    </ToolShell>
  );
}
