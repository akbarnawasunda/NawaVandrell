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
    const u = inputUrl.toLowerCase();
    if (u.includes('twitter.com') || u.includes('x.com')) return 'twitter';
    if (u.includes('tiktok.com')) return 'tiktok';
    if (u.includes('instagram.com')) return 'instagram';
    if (u.includes('facebook.com') || u.includes('fb.watch')) return 'facebook';
    if (u.includes('pinterest.com') || u.includes('pin.it')) return 'pinterest';
    if (u.includes('soundcloud.com')) return 'soundcloud';
    if (u.includes('spotify.com')) return 'spotify';
    if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
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

    // Kalo FB, IG, Pinterest, SoundCloud, Spotify, YT -> Pake Gateway Pilihan Terbaik
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

  const openGateway = (targetUrl, siteName) => {
    if (url && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
      addToast(`Link tercopy ke clipboard! Paste di ${siteName} ya 📋`, 'info', 3000);
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
      desc="Download video & audio dari IG, FB, Pinterest, TikTok, Twitter, SoundCloud, Spotify, YouTube."
      icon="📲"
    >
      <div className="panel">
        {/* PLATFORM BADGES */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {['📸 Instagram', '📘 Facebook', '📌 Pinterest', '🎵 TikTok', '🐤 Twitter/X', '☁️ SoundCloud', '🎧 Spotify', '▶️ YouTube'].map((tag) => (
            <span key={tag} className="chip" style={{ fontSize: 11, padding: '4px 9px', pointerEvents: 'none' }}>
              {tag}
            </span>
          ))}
        </div>

        <div className="field">
          <label className="label" htmlFor="social-url">
            Link postingan sosmed / lagu
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
            placeholder="Tempel link IG / FB / Pinterest / Spotify / SoundCloud / YT di sini..."
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
            {loading ? 'Memproses...' : 'Proses Link'}
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
              <span>Media Ditemukan (Direct File)</span>
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

        {/* HASIL 2: HIGH-QUALITY GATEWAY CARD */}
        {data && data.type === 'gateway' ? (
          <div className="result">
            <div className="result-head">
              <span>Server Pengunduh Siap ({data.platform.toUpperCase()})</span>
            </div>

            <p style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--accent-soft)', fontWeight: 600 }}>
              Link terdeteksi & otomatis tercopy ke clipboard!
            </p>
            <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>
              Klik server rekomendasi di bawah (link langsung terisi otomatis):
            </p>

            <div style={{ display: 'grid', gap: 9 }}>
              {data.platform === 'facebook' ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-full"
                    onClick={() => openGateway('https://downloader.asia/dl/facebook/', 'Downloader.asia FB')}
                  >
                    📘 Unduh via Downloader.asia (FB Video/Audio)
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-full"
                    onClick={() => openGateway('https://fdownloader.net/', 'FDownloader')}
                  >
                    ⚡ Unduh via FDownloader (HD MP4)
                  </button>
                </>
              ) : data.platform === 'instagram' ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-full"
                    onClick={() => openGateway('https://fastdl.app/', 'FastDL')}
                  >
                    📸 Unduh via FastDL (Instagram Reel/Post)
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-full"
                    onClick={() => openGateway('https://snapinsta.app/', 'SnapInsta')}
                  >
                    ⚡ Unduh via SnapInsta
                  </button>
                </>
              ) : data.platform === 'pinterest' ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-full"
                    onClick={() => openGateway('https://downloader.asia/dl/pinterest/', 'Downloader.asia Pinterest')}
                  >
                    📌 Unduh via Downloader.asia (Pinterest)
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-full"
                    onClick={() => openGateway('https://printdwn.com/', 'PrintDwn')}
                  >
                    ⚡ Unduh via PrintDwn
                  </button>
                </>
              ) : data.platform === 'soundcloud' ? (
                <button
                  type="button"
                  className="btn btn-primary btn-full"
                  onClick={() => openGateway('https://downloader.asia/dl/soundcloud/', 'Downloader.asia SoundCloud')}
                >
                  ☁️ Unduh via Downloader.asia (SoundCloud MP3)
                </button>
              ) : data.platform === 'spotify' ? (
                <button
                  type="button"
                  className="btn btn-primary btn-full"
                  onClick={() => openGateway('https://downloader.asia/dl/spotify/', 'Downloader.asia Spotify')}
                >
                  🎧 Unduh via Downloader.asia (Spotify Song/Album)
                </button>
              ) : data.platform === 'youtube' ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-full"
                    onClick={() => openGateway('https://downloader.asia/dl/youtube/', 'Downloader.asia YouTube')}
                  >
                    ▶️ Unduh via Downloader.asia (YouTube MP4/MP3)
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-full"
                    onClick={() => openGateway('https://yt5s.biz/enwr200/', 'yt5s')}
                  >
                    🚀 Unduh via yt5s
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-full"
                  onClick={() => openGateway('https://fastdl.app/', 'FastDL')}
                >
                  ✨ Unduh via FastDL Universal
                </button>
              )}
            </div>
          </div>
        ) : null}

        <p className="hint">
          💡 <strong>Tips Instan:</strong> Twitter & TikTok ter-download langsung di web, sedangkan Facebook, IG, Pinterest, SoundCloud, Spotify & YouTube menggunakan gateway server bersih tanpa iklan!
        </p>
      </div>
    </ToolShell>
  );
}
