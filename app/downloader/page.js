'use client';

import { useState } from 'react';
import ToolShell from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';
import Icon from '@/components/icons';

const API_BASE = '/api/tools-proxy';

const PLATFORMS = [
  { id: 'tiktok', name: 'TikTok', icon: 'tiktok' },
  { id: 'instagram', name: 'Instagram', icon: 'instagram' },
  { id: 'youtube', name: 'YouTube', icon: 'youtube' },
  { id: 'twitter', name: 'X / Twitter', icon: 'twitter' },
  { id: 'facebook', name: 'Facebook', icon: 'facebook' },
  { id: 'spotify', name: 'Spotify', icon: 'spotify' },
];

const FALLBACK_GATEWAYS = [
  { name: 'Cobalt Web', url: 'https://cobalt.tools', desc: 'Universal tanpa iklan / watermark' },
  { name: 'SnapTik', url: 'https://snaptik.app', desc: 'TikTok HD Video & Musik' },
  { name: 'SaveFrom', url: 'https://en.savefrom.net', desc: 'YouTube & FB Video' },
  { name: 'SnapInsta', url: 'https://snapinsta.app', desc: 'Instagram Reels & Carousels' },
];

function detectPlatform(u) {
  if (!u) return null;
  const s = u.toLowerCase();
  if (s.includes('tiktok.com')) return 'tiktok';
  if (s.includes('instagram.com')) return 'instagram';
  if (s.includes('twitter.com') || s.includes('x.com')) return 'twitter';
  if (s.includes('facebook.com') || s.includes('fb.watch')) return 'facebook';
  if (s.includes('youtube.com') || s.includes('youtu.be')) return 'youtube';
  if (s.includes('spotify.com')) return 'spotify';
  if (s.includes('pinterest.com') || s.includes('pin.it')) return 'pinterest';
  return null;
}

export default function DownloaderPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const { addToast } = useToast();

  const handleFetch = async () => {
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      addToast('Tempel link media dulu', 'warning');
      return;
    }
    setLoading(true);
    setResult(null);
    setErrorMsg('');
    try {
      const platform = detectPlatform(cleanUrl);
      const action = platform === 'tiktok' ? 'tiktok' : 'social';
      const res = await fetch(`${API_BASE}?path=${action}&url=${encodeURIComponent(cleanUrl)}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!data.status) throw new Error(data.error || 'Gagal mengambil media');
      setResult(data.result);
      addToast('Media berhasil ditemukan!', 'success');
    } catch (err) {
      const msg = err.message || 'Gagal mengunduh media. Coba cek link atau gunakan gateway cadangan.';
      setErrorMsg(msg);
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const proxy = (href) => `/api/download-proxy?url=${encodeURIComponent(href)}`;

  const detected = detectPlatform(url);

  return (
    <ToolShell
      title="All-In-One Downloader"
      desc="Download video & audio tanpa watermark dari TikTok, Instagram, YouTube, X, Facebook, dan lainnya."
      icon="download"
    >
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 20 }}>
        <div className="panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p className="label" style={{ margin: 0 }}>Tempel URL Media</p>
            {detected ? (
              <span style={{ fontSize: 12, color: 'var(--accent-soft)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Icon name={detected} size={14} /> Terdeteksi: {detected.toUpperCase()}
              </span>
            ) : null}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <input
              className="input"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
              placeholder="https://www.tiktok.com/@... atau https://www.instagram.com/reel/..."
              disabled={loading}
              style={{ flex: 1 }}
              autoFocus
            />
            {url ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => { setUrl(''); setResult(null); setErrorMsg(''); }}
                title="Bersihkan"
              >
                ✕
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleFetch}
              disabled={loading}
              style={{ minWidth: 100 }}
            >
              {loading ? 'Scraping...' : 'Fetch'}
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
            {PLATFORMS.map((p) => (
              <span
                key={p.id}
                style={{
                  fontSize: 11.5,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: detected === p.id ? 'var(--accent-ghost)' : 'rgba(255,255,255,0.05)',
                  color: detected === p.id ? 'var(--accent-soft)' : 'var(--text-dim)',
                  border: detected === p.id ? '1px solid var(--accent)' : '1px solid transparent',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Icon name={p.icon} size={13} />
                {p.name}
              </span>
            ))}
          </div>
        </div>

        {errorMsg ? (
          <div className="panel" style={{ borderColor: 'rgba(248, 113, 113, 0.3)', background: 'rgba(248, 113, 113, 0.04)' }}>
            <p style={{ color: 'var(--danger)', margin: '0 0 8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="warning" size={16} /> {errorMsg}
            </p>
            <p className="hint" style={{ margin: 0 }}>
              Jika konten berstatus privat atau dilindungi DRM, gunakan salah satu web gateway cadangan di bawah ini.
            </p>
          </div>
        ) : null}

        {result ? (
          <div className="panel">
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-start' }}>
              {result.thumbnail ? (
                <img
                  src={result.thumbnail}
                  alt="thumbnail"
                  style={{
                    width: 90,
                    height: 90,
                    objectFit: 'cover',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    flexShrink: 0,
                  }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : null}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 800, fontSize: 16, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {result.title || 'Media Siap Diunduh'}
                </p>
                {result.author ? (
                  <p className="hint" style={{ margin: '4px 0 0' }}>Oleh: {result.author}</p>
                ) : null}
              </div>
            </div>

            <p className="label" style={{ marginBottom: 10 }}>Pilihan Format & Kualitas Unduhan:</p>
            <div style={{ display: 'grid', gap: 10 }}>
              {(result.links || []).map((link, i) => (
                <a
                  key={i}
                  href={proxy(link.href)}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className={`btn ${link.primary ? 'btn-primary' : 'btn-ghost'} btn-full`}
                  style={{ justifyContent: 'flex-start', gap: 10, height: 48 }}
                >
                  <Icon name="download" size={16} />
                  <span>{link.label}</span>
                </a>
              ))}
            </div>
          </div>
        ) : null}

        <div className="panel" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <p className="label" style={{ marginBottom: 10 }}>Gateway Cadangan (Jika Link Gagal)</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {FALLBACK_GATEWAYS.map((gw) => (
              <a
                key={gw.name}
                href={gw.url}
                target="_blank"
                rel="noopener noreferrer"
                className="card"
                style={{ padding: 14, textDecoration: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <b style={{ fontSize: 14, color: 'var(--accent-soft)' }}>{gw.name}</b>
                  <Icon name="link" size={13} />
                </div>
                <small style={{ color: 'var(--text-faint)', fontSize: 12 }}>{gw.desc}</small>
              </a>
            ))}
          </div>
        </div>

        <p className="hint" style={{ textAlign: 'center', margin: 0 }}>
          Direct Server-Side Proxy oleh Nawa Editor. Tidak ada iklan popup & tidak ada redirect.
        </p>
      </div>
    </ToolShell>
  );
}
