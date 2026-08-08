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
    if (inputUrl.includes('soundcloud.com')) return 'soundcloud';
    if (inputUrl.includes('spotify.com')) return 'spotify';
    if (inputUrl.includes('reddit.com')) return 'reddit';
    if (inputUrl.includes('youtube.com') || inputUrl.includes('youtu.be')) return 'youtube';
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

    // Kalo Twitter atau TikTok -> Direct MP4 Stream
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

    // Kalo IG, FB, Pinterest, SoundCloud, Spotify, Reddit, YouTube -> Auto-Query Parameter Gateway
    setTimeout(() => {
      setData({
        type: 'gateway',
        platform,
        rawUrl: cleanUrl,
      });
      addToast('Gateway pengunduh siap! 📋', 'success');
      setLoading(false);
    }, 300);
  };

  // AUTO-FILL VIA QUERY PARAMETER ?url=
  const openGateway = (baseUrl, siteName) => {
    const clean = url.trim();
    
    // Auto-copy sebagai backup
    if (clean && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(clean).catch(() => {});
    }

    // Bikin link Query Parameter ?url= biar web tujuan AUTO-FILL!
    const targetWithParam = baseUrl.includes('?')
      ? `${baseUrl}&url=${encodeURIComponent(clean)}`
      : `${baseUrl}?url=${encodeURIComponent(clean)}`;

    addToast(`Membuka ${siteName}... 🚀`, 'info', 2500);
    window.open(targetWithParam, '_blank', 'noopener,noreferrer');
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
      desc="Download video & foto dari Instagram, TikTok, Twitter, Facebook, Pinterest, SoundCloud, Spotify, Reddit."
      icon="📲"
    >
      <div className="panel">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {['📸 Instagram', '🎵 TikTok', '🐤 Twitter/X', '📘 Facebook', '📌 Pinterest', '☁️ SoundCloud', '🎧 Spotify', '🤖 Reddit'].map((tag) => (
            <span key={tag} className="chip" style={{ fontSize: 11.5, padding: '4px 10px', pointerEvents: 'none' }}>
              {tag}
            </span>
          ))}
        </div>

        <div className="field">
          <label className="label" htmlFor="social-url">
            Link postingan sosmed / musik
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
            placeholder="Tempel link IG / TikTok / FB / Spotify / Pinterest di sini..."
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

        {/* DIRECT DOWNLOAD (TIKTOK & TWITTER) */}
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

        {/* AUTO-FILL QUERY PARAMETER GATEWAYS */}
        {data && data.type === 'gateway' ? (
          <div className="result">
            <div className="result-head">
              <span>Pengunduh Siap ({data.platform.toUpperCase()})</span>
            </div>

            <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--accent-soft)', fontWeight: 600 }}>
              Link berhasil dideteksi!
            </p>
            <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>
              Klik tombol di bawah untuk membuka pengunduh spesialis (link terisi otomatis):
            </p>

            <div style={{ display: 'grid', gap: 9 }}>
              {data.platform === 'instagram' ? (
                <button
                  type="button"
                  className="btn btn-primary btn-full"
                  onClick={() => openGateway('https://fastdl.app/', 'FastDL')}
                >
                  📸 Unduh via FastDL (Instagram HD)
                </button>
              ) : data.platform === 'facebook' ? (
                <button
                  type="button"
                  className="btn btn-primary btn-full"
                  onClick={() => openGateway('https://downloader.asia/dl/facebook/', 'Downloader Asia FB')}
                >
                  📘 Unduh via Downloader Asia (Facebook Video & Audio)
                </button>
              ) : data.platform === 'pinterest' ? (
                <button
                  type="button"
                  className="btn btn-primary btn-full"
                  onClick={() => openGateway('https://downloader.asia/dl/pinterest/', 'Downloader Asia Pinterest')}
                >
                  📌 Unduh via Downloader Asia (Pinterest Video & Gambar)
                </button>
              ) : data.platform === 'soundcloud' ? (
                <button
                  type="button"
                  className="btn btn-primary btn-full"
                  onClick={() => openGateway('https://downloader.asia/dl/soundcloud/', 'Downloader Asia SoundCloud')}
                >
                  ☁️ Unduh via Downloader Asia (SoundCloud MP3)
                </button>
              ) : data.platform === 'spotify' ? (
                <button
                  type="button"
                  className="btn btn-primary btn-full"
                  onClick={() => openGateway('https://downloader.asia/dl/spotify/', 'Downloader Asia Spotify')}
                >
                  🎧 Unduh via Downloader Asia (Spotify Music)
                </button>
              ) : data.platform === 'reddit' ? (
                <button
                  type="button"
                  className="btn btn-primary btn-full"
                  onClick={() => openGateway('https://downloader.asia/dl/reddit/', 'Downloader Asia Reddit')}
                >
                  🤖 Unduh via Downloader Asia (Reddit Video & GIF)
                </button>
              ) : data.platform === 'youtube' ? (
                <button
                  type="button"
                  className="btn btn-primary btn-full"
                  onClick={() => openGateway('https://downloader.asia/dl/youtube/', 'Downloader Asia YouTube')}
                >
                  ▶️ Unduh via Downloader Asia (YouTube MP4 & MP3)
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-full"
                  onClick={() => openGateway('https://downloader.asia/', 'Downloader Asia')}
                >
                  ✨ Unduh via Downloader Asia (All-In-One)
                </button>
              )}
            </div>
          </div>
        ) : null}

        <p className="hint">
          💡 <strong>Tips Instan:</strong> Twitter & TikTok ter-download langsung, sementara IG/FB/Spotify/Pinterest/SoundCloud dialihkan dengan link yang otomatis terisi!
        </p>
      </div>
    </ToolShell>
  );
}
