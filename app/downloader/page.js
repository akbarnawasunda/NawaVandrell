'use client';

import { useState } from 'react';
import ToolShell from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';
import Icon from '@/components/icons';

const API_BASE = '/api/tools-proxy';

function detectPlatform(u) {
  if (!u) return null;
  const s = u.toLowerCase();
  if (s.includes('tiktok.com')) return 'tiktok';
  if (s.includes('instagram.com')) return 'instagram';
  if (s.includes('twitter.com') || s.includes('x.com')) return 'twitter';
  if (s.includes('facebook.com') || s.includes('fb.watch')) return 'facebook';
  if (s.includes('youtube.com') || s.includes('youtu.be')) return 'youtube';
  return null;
}

export default function DownloaderPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const { showToast } = useToast();

  const handleFetch = async () => {
    if (!url.trim()) { showToast('Tempel link dulu', 'warning'); return; }
    setLoading(true);
    setResult(null);
    try {
      const platform = detectPlatform(url);
      const action = platform === 'tiktok' ? 'tiktok' : 'social';
      const res = await fetch(`${API_BASE}?path=${action}&url=${encodeURIComponent(url)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!data.status) throw new Error(data.error || 'Gagal fetch media');
      setResult(data.result);
      showToast('Media ketemu! Pilih kualitas di bawah.', 'success');
    } catch (err) {
      showToast(err.message || 'Gagal fetch', 'error');
    } finally {
      setLoading(false);
    }
  };

  const proxy = (href) => `/api/download-proxy?url=${encodeURIComponent(href)}`;

  return (
    <ToolShell title="Direct Media Downloader" icon="download">
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'grid', gap: 20 }}>
        <div className="panel">
          <p className="label" style={{ marginBottom: 10 }}>Tempel link media (TikTok, IG, X, FB, YT)</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="dl-input-wrap" style={{ flex: 1 }}>
              <span className="dl-input-icon"><Icon name="link" size={18} /></span>
              <input
                className="input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
                placeholder="https://..."
                disabled={loading}
              />
            </div>
            <button type="button" className="btn btn-primary" onClick={handleFetch} disabled={loading}>
              {loading ? 'Scraping...' : 'Fetch'}
            </button>
          </div>
        </div>

        {result ? (
          <div className="panel">
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              {result.thumbnail ? (
                <img src={result.thumbnail} alt="thumb" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border,rgba(255,255,255,0.15))' }} />
              ) : null}
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 800, fontSize: 16, margin: 0 }}>{result.title || 'Media'}</p>
                {result.author ? <p className="hint" style={{ margin: '4px 0 0' }}>{result.author}</p> : null}
              </div>
            </div>

            <p className="label" style={{ marginBottom: 10 }}>Pilih kualitas / format:</p>
            <div style={{ display: 'grid', gap: 10 }}>
              {(result.links || []).map((link, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <a
                    href={proxy(link.href)}
                    className={`btn ${link.primary ? 'btn-primary' : 'btn-ghost'} btn-full`}
                    style={{ justifyContent: 'flex-start', gap: 10, height: 48 }}
                  >
                    <Icon name="download" size={16} /> {link.label}
                  </a>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost"
                    style={{ flex: 'none', padding: '0 14px', height: 48 }}
                    title="Buka direct (fallback)"
                  >
                    <Icon name="link" size={14} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <p className="hint" style={{ textAlign: 'center' }}>
          Powered by NawaVandrell Server-Side Proxy. No Ads, No Redirect.
        </p>
      </div>
    </ToolShell>
  );
}
