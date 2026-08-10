'use client';

import { useState } from 'react';
import ToolShell from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';
import Icon from '@/components/icons';

export default function DownloaderPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const { showToast } = useToast();

  const handleFetch = async () => {
    if (!url.trim()) { showToast('Masukkan link dulu', 'warning'); return; }
    setLoading(true);
    setResult(null);
    try {
      // Asumsi endpoint API utama lu adalah /api/tools
      const res = await fetch('/api/tools?path=social&url=' + encodeURIComponent(url));
      const data = await res.json();
      if (!data.status) throw new Error(data.error || 'Gagal fetch media');
      setResult(data.result);
      showToast('Media berhasil di-scrape!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const getProxyUrl = (href) => {
    return `/api/download-proxy?url=${encodeURIComponent(href)}`;
  };

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
                <img src={result.thumbnail} alt="thumb" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)' }} />
              ) : null}
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 800, fontSize: 16, margin: 0 }}>{result.title || 'Media'}</p>
                {result.author ? <p className="hint" style={{ margin: '4px 0 0' }}>{result.author}</p> : null}
              </div>
            </div>

            <p className="label" style={{ marginBottom: 10 }}>Pilih kualitas / format:</p>
            <div style={{ display: 'grid', gap: 10 }}>
              {(result.links || []).map((link, i) => (
                <a
                  key={i}
                  href={getProxyUrl(link.href)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`btn ${link.primary ? 'btn-primary' : 'btn-ghost'} btn-full`}
                  style={{ justifyContent: 'flex-start', gap: 10, height: 48 }}
                >
                  <Icon name="download" size={16} />
                  {link.label}
                </a>
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
