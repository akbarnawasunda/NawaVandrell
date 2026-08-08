'use client';

import { useState } from 'react';
import ToolShell from '@/components/ToolShell';
import SkeletonLoader from '@/components/SkeletonLoader';
import { useToast } from '@/context/ToastContext';

const YT_RE = /(?:v=|\/embed\/|\/1\/|\/v\/|https:\/\/youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/;

export default function YoutubeDownloaderPage() {
  const { addToast } = useToast();
  const [url, setUrl] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const extractId = (inputUrl) => {
    const m = (inputUrl || '').match(YT_RE);
    return m ? m[1] : null;
  };

  const processUrl = async (inputUrl) => {
    const cleanUrl = (inputUrl || url).trim();
    const videoId = extractId(cleanUrl);

    if (!videoId) {
      setError('Link YouTube tidak valid. Contoh: https://www.youtube.com/watch?v=rv4DK8nVWd0');
      setData(null);
      return;
    }

    setLoading(true);
    setError('');
    setData(null);

    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const res = await fetch(oembedUrl);

      if (!res.ok) throw new Error('Video tidak ditemukan atau bersifat privat.');

      const json = await res.json();
      const fullYtUrl = `https://www.youtube.com/watch?v=${videoId}`;

      setData({
        videoId,
        fullYtUrl,
        title: json.title || 'YouTube Video',
        author: json.author_name || 'YouTube Channel',
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        yt5sDeepUrl: `https://yt5s.biz/enwr200/?q=${fullYtUrl}`,
        ssyoutubeDeepUrl: `https://ssyoutube.com/watch?v=${videoId}`,
        nineXBuddyDeepUrl: `https://9xbuddy.com/process?url=${fullYtUrl}`,
        y2mateMp3DeepUrl: `https://www.y2mate.com/youtube-mp3/${videoId}`,
      });

      addToast('Video ditemukan! 🎬', 'success');
    } catch (err) {
      setError(err.message || 'Gagal mengambil informasi video YouTube.');
    } finally {
      setLoading(false);
    }
  };

  const openGateway = (targetUrl, siteName) => {
    if (data?.fullYtUrl && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(data.fullYtUrl).catch(() => {});
      addToast(`Link tercopy! Paste di ${siteName} ya 📋`, 'info', 3000);
    }
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleNativePaste = (e) => {
    const pastedText = e.clipboardData?.getData('text') || '';
    const clean = pastedText.trim();
    if (clean && extractId(clean)) {
      setUrl(clean);
      addToast('Link YouTube terdeteksi, memproses... 🚀', 'info');
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
      if (clean && extractId(clean)) {
        setUrl(clean);
        addToast('Link YouTube terdeteksi, memproses... 🚀', 'info');
        processUrl(clean);
      } else {
        addToast('Clipboard kamu kosong atau bukan link YouTube', 'warning');
      }
    } catch {
      addToast('Gunakan saran "Tempel" dari Keyboard HP kamu ya!', 'info');
    }
  };

  return (
    <ToolShell
      title="Download YouTube"
      desc="Download video MP4 (360p-1080p) atau convert musik MP3 dari YouTube secara instan."
      icon="▶️"
    >
      <div className="panel">
        <div className="field">
          <label className="label" htmlFor="yt-url">
            Link video / Shorts YouTube
          </label>
          <input
            id="yt-url"
            className="input"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError('');
            }}
            onPaste={handleNativePaste}
            onKeyDown={(e) => e.key === 'Enter' && processUrl()}
            placeholder="Tempel / Paste link YouTube di sini..."
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
            {loading ? 'Memproses...' : 'Cari Video'}
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

        {data ? (
          <div className="result">
            <div className="result-head">
              <span>Video Ditemukan</span>
            </div>

            <img
              src={data.thumbnail}
              alt={data.title}
              style={{
                width: '100%',
                maxHeight: 240,
                objectFit: 'cover',
                borderRadius: 12,
                marginBottom: 12,
                border: '1px solid var(--border)',
              }}
            />

            <p style={{ margin: '0 0 4px', fontSize: 15, color: 'var(--text)', fontWeight: 700, lineHeight: 1.4 }}>
              {data.title}
            </p>
            <p className="hint" style={{ marginTop: 0, marginBottom: 16 }}>
              oleh {data.author}
            </p>

            <div style={{ display: 'grid', gap: 9 }}>
              <button
                type="button"
                className="btn btn-primary btn-full"
                onClick={() => openGateway(data.yt5sDeepUrl, 'yt5s')}
              >
                🚀 Download via yt5s (MP4 & MP3)
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-full"
                onClick={() => openGateway(data.ssyoutubeDeepUrl, 'SSYouTube')}
              >
                ⚡ Download via SSYouTube (SaveFrom)
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-full"
                onClick={() => openGateway(data.nineXBuddyDeepUrl, '9XBuddy')}
              >
                🌐 Download via 9XBuddy
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-full btn-sm"
                onClick={() => openGateway(data.y2mateMp3DeepUrl, 'Y2Mate MP3')}
              >
                🎵 Convert MP3 Audio (Y2Mate)
              </button>
            </div>
          </div>
        ) : null}

        <p className="hint">
          💡 <strong>Tips Instan:</strong> Saat tombol diklik, link video otomatis tercopy! Tinggal paste di web tujuan.
        </p>
      </div>
    </ToolShell>
  );
}