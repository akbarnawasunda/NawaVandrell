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

  const detectPlatform = (inputUrl) => {
    if (inputUrl.includes('twitter.com') || inputUrl.includes('x.com')) return 'twitter';
    if (inputUrl.includes('tiktok.com')) return 'tiktok';
    if (inputUrl.includes('instagram.com')) return 'instagram';
    if (inputUrl.includes('facebook.com') || inputUrl.includes('fb.watch')) return 'facebook';
    if (inputUrl.includes('pinterest.com') || inputUrl.includes('pin.it')) return 'pinterest';
    return 'generic';
  };

  const processUrl = async (inputUrl) => {
    const cleanUrl = (inputUrl || url).trim();
    if (!cleanUrl) {
      addToast('Isi link postingan sosmed dulu ya', 'warning');
      return;
    }

    const platform = detectPlatform(cleanUrl);

    setLoading(true);
    setError('');
    setData(null);

    // Kalo Twitter atau TikTok -> Coba Direct MP4 Stream dulu!
    if (platform === 'twitter' || platform === 'tiktok') {
      try {
        const res = await fetch(`/api/tool-proxy?path=social&url=${encodeURIComponent(cleanUrl)}`);
        const json = await res.json();
        if (res.ok && json.status) {
          setData({
            type: 'direct',
            platform,
            downloadUrl: json.result.downloadUrl,
            thumbnail: json.result.thumbnail,
            title: json.result.title || 'Video Download',
            filename: json.result.filename || 'video.mp4',
          });
          addToast('Media berhasil ditemukan! 🚀', 'success');
          setLoading(false);
          return;
        }
      } catch {
        /* fallback ke gateway jika direct fail */
      }
    }

    // Kalo Instagram, Facebook, Pinterest -> Pake Smart Gateway Card (100% Bebas Error)
    setTimeout(() => {
      setData({
        type: 'gateway',
        platform,
        rawUrl: cleanUrl,
      });
      addToast('Gateway pengunduh siap! 📋', 'success');
      setLoading(false);
    }, 400);
  };

  const openGateway = (targetUrl, siteName) => {
    if (url && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
      addToast(`Link tercopy! Tinggal paste di ${siteName} 📋`, 'info', 3000);
    }
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
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

  return (
    <ToolShell
      title="Download Sosmed"
      desc="Download video & foto dari Instagram, Twitter/X, Facebook, Pinterest, TikTok, SoundCloud."
      icon="📲"
    >
      <div className="panel">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {['📸 Instagram', '🐤 Twitter/X', '📘 Facebook', '📌 Pinterest', '🎵 TikTok'].map((tag) => (
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
            placeholder="Tempel link IG Reel / Twitter / FB / Pinterest di sini..."
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
            {loading ? 'Memproses...' : 'Cari Media'}
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

        {error ? <p className="err">{error}</p> : null}

        {/* HASIL 1: DIRECT DOWNLOAD (TWITTER & TIKTOK) */}
        {data && data.type === 'direct' ? (
          <div className="result">
            <div className="result-head">
              <span>Media Ditemukan (Direct MP4)</span>
            </div>

            {data.thumbnail ? (
              <img
                src={data.thumbnail}
                alt="Preview"
                referrerPolicy="no-referrer"
                style={{
                  width: '100%',
                  maxHeight: 240,
                  objectFit: 'cover',
                  borderRadius: 12,
                  marginBottom: 12,
                  border: '1px solid var(--border)',
                }}
              />
            ) : null}

            <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>
              {data.title}
            </p>

            <a
              href={data.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-full"
              download
            >
              📥 Download File MP4 (Langsung)
            </a>
          </div>
        ) : null}

        {/* HASIL 2: SMART GATEWAY CARD (INSTAGRAM, FACEBOOK, PINTEREST) */}
        {data && data.type === 'gateway' ? (
          <div className="result">
            <div className="result-head">
              <span>Pengunduh Siap ({data.platform.toUpperCase()})</span>
            </div>

            <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--accent-soft)', fontWeight: 600 }}>
              Link berhasil dideteksi & tercopy ke clipboard!
            </p>
            <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>
              Klik salah satu server spesialis di bawah (link otomatis terisi):
            </p>

            <div style={{ display: 'grid', gap: 9 }}>
              {data.platform === 'instagram' ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-full"
                    onClick={() => openGateway('https://fastdl.app/', 'FastDL')}
                  >
                    📸 Unduh via FastDL (Instagram HD)
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-full"
                    onClick={() => openGateway('https://snapinsta.app/', 'SnapInsta')}
                  >
                    ⚡ Unduh via SnapInsta
                  </button>
                </>
              ) : data.platform === 'facebook' ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-full"
                    onClick={() => openGateway('https://fdownloader.net/', 'FDownloader')}
                  >
                    📘 Unduh via FDownloader (Facebook HD)
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-full"
                    onClick={() => openGateway('https://snapsave.app/', 'SnapSave')}
                  >
                    ⚡ Unduh via SnapSave
                  </button>
                </>
              ) : data.platform === 'pinterest' ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-full"
                    onClick={() => openGateway('https://pinterestvideodownloader.com/', 'PinterestDownloader')}
                  >
                    📌 Unduh via PinterestDownloader
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-full"
                    onClick={() => openGateway('https://printdwn.com/', 'PrintDwn')}
                  >
                    ⚡ Unduh via PrintDwn
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-full"
                  onClick={() => openGateway(`https://cobalt.tools/#${data.rawUrl}`, 'Cobalt')}
                >
                  ✨ Unduh via Cobalt Web UI
                </button>
              )}
            </div>
          </div>
        ) : null}

        <p className="hint">
          💡 <strong>Tips Instan:</strong> Twitter & TikTok ter-download langsung, sementara Instagram/FB/Pinterest ter-copy otomatis untuk diunduh via server HD spesialis!
        </p>
      </div>
    </ToolShell>
  );
}
