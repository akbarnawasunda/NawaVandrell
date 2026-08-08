'use client';

import { useState } from 'react';
import ToolShell from '@/components/ToolShell';
import SkeletonLoader from '@/components/SkeletonLoader';
import { useToast } from '@/context/ToastContext';

export default function SocialDownloaderPage() {
  const { addToast } = useToast();
  const [url, setUrl] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const processUrl = async (inputUrl) => {
    const cleanUrl = (inputUrl || url).trim();
    if (!cleanUrl) {
      addToast('Isi link postingan sosmed dulu ya', 'warning');
      return;
    }

    setLoading(true);
    setError('');
    setData(null);

    try {
      const res = await fetch(`/api/tool-proxy?path=social&url=${encodeURIComponent(cleanUrl)}`);
      const json = await res.json();
      if (!res.ok || !json.status) {
        setError(json.error || 'Gagal mengambil media dari server.');
        return;
      }
      setData(json.result);
      addToast('Media berhasil ditemukan! 🚀', 'success');
    } catch {
      setError('Koneksi bermasalah. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleNativePaste = (e) => {
    const pastedText = e.clipboardData?.getData('text') || '';
    const clean = pastedText.trim();
    if (clean && clean.startsWith('http')) {
      setUrl(clean);
      addToast('Link terdeteksi, memproses... 🚀', 'info');
      processUrl(clean);
    }
  };

  const pasteButton = async () => {
    try {
      if (!navigator.clipboard?.readText) {
        addToast('Gunakan fitur Tempel dari Keyboard HP kamu!', 'info');
        return;
      }
      const text = await navigator.clipboard.readText();
      const clean = (text || '').trim();
      if (clean && clean.startsWith('http')) {
        setUrl(clean);
        addToast('Link terdeteksi, memproses... 🚀', 'info');
        processUrl(clean);
      } else {
        addToast('Clipboard kamu kosong atau bukan link valid', 'warning');
      }
    } catch {
      addToast('Gunakan saran "Tempel" dari Keyboard HP kamu ya!', 'info');
    }
  };

  const openFallback = (gatewayUrl) => {
    if (url && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
      addToast('Link tercopy! Tinggal paste di web tujuan 📋', 'info', 3000);
    }
    window.open(gatewayUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <ToolShell
      title="Download Sosmed"
      desc="Download video & foto dari Instagram, Twitter/X, Facebook, Pinterest, Reddit, SoundCloud."
      icon="📲"
    >
      <div className="panel">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {['📸 Instagram', '🐤 Twitter/X', '📘 Facebook', '📌 Pinterest', '🤖 Reddit', '🎵 SoundCloud'].map((tag) => (
            <span key={tag} className="chip" style={{ fontSize: 11.5, padding: '4px 10px', pointerEvents: 'none' }}>
              {tag}
            </span>
          ))}
        </div>

        <div className="field">
          <label className="label" htmlFor="social-url">
            Link postingan sosmed
          </label>
          <input
            id="social-url"
            className="input"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError('');
            }}
            onPaste={handleNativePaste}
            onKeyDown={(e) => e.key === 'Enter' && processUrl()}
            placeholder="Tempel link IG Reel / Twitter / Pinterest di sini..."
            inputMode="url"
            spellCheck={false}
          />
        </div>

        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 2 }}
            onClick={() => processUrl()}
            disabled={loading}
          >
            {loading ? 'Memproses...' : 'Ambil Media'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={pasteButton}>
            📋 Tempel
          </button>
        </div>

        {loading ? (
          <div style={{ marginTop: 16 }}>
            <SkeletonLoader lines={3} />
          </div>
        ) : null}

        {error ? (
          <div className="result" style={{ borderColor: 'var(--danger)' }}>
            <p className="err" style={{ marginTop: 0, marginBottom: 10 }}>
              {error}
            </p>

            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 10 }}>
              💡 Atau gunakan Gateway Cadangan 1-Click di bawah:
            </p>

            <div style={{ display: 'grid', gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary btn-full"
                onClick={() => openFallback(`https://cobalt.tools/#${url}`)}
              >
                ✨ Download via Cobalt Web UI
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-full"
                onClick={() => openFallback('https://fastdl.app/')}
              >
                📸 Download via FastDL (Instagram)
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-full btn-sm"
                onClick={() => openFallback('https://twitsave.com/')}
              >
                🐤 Download via TwitSave (Twitter/X)
              </button>
            </div>
          </div>
        ) : null}

        {data ? (
          <div className="result">
            <div className="result-head">
              <span>Media Siap Diunduh</span>
            </div>

            {data.thumbnail ? (
              <img
                src={data.thumbnail}
                alt="Preview Media"
                referrerPolicy="no-referrer"
                style={{
                  width: '100%',
                  maxHeight: 240,
                  objectFit: 'cover',
                  borderRadius: 12,
                  marginBottom: 12,
                  border: '1px solid var(--border)',
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : null}

            <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--accent-soft)', fontWeight: 600 }}>
              {data.filename}
            </p>

            {data.downloadUrl ? (
              <a
                href={data.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-full"
                download
              >
                📥 Download File (Langsung)
              </a>
            ) : null}

            {data.picker && data.picker.length > 0 ? (
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                {data.picker.map((item, idx) => (
                  <a
                    key={idx}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-full"
                    download
                  >
                    📥 Download Slide/File #{idx + 1}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <p className="hint">
          💡 <strong>Tips Instan:</strong> Tinggal paste link dari keyboard HP kamu, foto/video bakal otomatis terdeteksi tanpa watermark!
        </p>
      </div>
    </ToolShell>
  );
} 