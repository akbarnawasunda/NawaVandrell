// app/tools/downloader/page.js

'use client';

import { useState } from 'react';
import ToolShell from '@/components/ToolShell';
import SkeletonLoader from '@/components/SkeletonLoader';
import { useToast } from '@/context/ToastContext';
import Icon, { PlatformIcon } from '@/components/icons';

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'twitter', label: 'Twitter/X' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'pinterest', label: 'Pinterest' },
  { id: 'spotify', label: 'Spotify' },
  { id: 'soundcloud', label: 'SoundCloud' },
  { id: 'reddit', label: 'Reddit' },
];

const PLATFORM_LABELS = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  twitter: 'Twitter/X',
  facebook: 'Facebook',
  pinterest: 'Pinterest',
  spotify: 'Spotify',
  soundcloud: 'SoundCloud',
  reddit: 'Reddit',
  generic: 'Media',
};

const YT_RE =
  /(?:v=|\/embed\/|\/1\/|\/v\/|https:\/\/youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/;

function extractYtId(url) {
  if (!url) return null;
  const match = String(url).match(YT_RE);
  return match ? match[1] : null;
}

function detectPlatform(inputUrl) {
  const url = String(inputUrl || '').toLowerCase();

  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
  if (url.includes('pinterest.com') || url.includes('pin.it')) return 'pinterest';
  if (url.includes('soundcloud.com')) return 'soundcloud';
  if (url.includes('spotify.com')) return 'spotify';
  if (url.includes('reddit.com')) return 'reddit';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';

  return 'generic';
}

function buildGatewayUrl(gateway, rawUrl) {
  const clean = String(rawUrl || '').trim();

  if (gateway.builder) {
    return gateway.builder(clean);
  }

  const base = gateway.url;
  const param = gateway.param || 'url';
  const value = clean;

  if (!value) return base;

  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}${param}=${encodeURIComponent(value)}`;
}

const GATEWAYS = {
  tiktok: [
    {
      label: 'Downloader Asia (All-In-One)',
      url: 'https://downloader.asia/',
      primary: true,
    },
  ],

  instagram: [
    {
      label: 'FastDL (Instagram HD)',
      url: 'https://fastdl.app/',
      primary: true,
    },
  ],

  facebook: [
    {
      label: 'Downloader Asia (Facebook)',
      url: 'https://downloader.asia/dl/facebook/',
      primary: true,
    },
  ],

  pinterest: [
    {
      label: 'Downloader Asia (Pinterest)',
      url: 'https://downloader.asia/dl/pinterest/',
      primary: true,
    },
  ],

  soundcloud: [
    {
      label: 'Downloader Asia (SoundCloud)',
      url: 'https://downloader.asia/dl/soundcloud/',
      primary: true,
    },
  ],

  spotify: [
    {
      label: 'Downloader Asia (Spotify)',
      url: 'https://downloader.asia/dl/spotify/',
      primary: true,
    },
  ],

  reddit: [
    {
      label: 'Downloader Asia (Reddit)',
      url: 'https://downloader.asia/dl/reddit/',
      primary: true,
    },
  ],

  twitter: [
    {
      label: 'Downloader Asia (All-In-One)',
      url: 'https://downloader.asia/',
      primary: true,
    },
  ],

  youtube: [
    {
      label: 'yt5s (MP4 & MP3)',
      primary: true,
      builder: (rawUrl) =>
        `https://yt5s.biz/enwr200/?q=${encodeURIComponent(rawUrl)}`,
    },
    {
      label: 'SSYouTube (SaveFrom)',
      builder: (rawUrl) => {
        const id = extractYtId(rawUrl);
        return id
          ? `https://ssyoutube.com/watch?v=${id}`
          : `https://ssyoutube.com/watch?url=${encodeURIComponent(rawUrl)}`;
      },
    },
    {
      label: '9XBuddy',
      builder: (rawUrl) =>
        `https://9xbuddy.com/process?url=${encodeURIComponent(rawUrl)}`,
    },
    {
      label: 'Y2Mate MP3',
      builder: (rawUrl) => {
        const id = extractYtId(rawUrl);
        return id
          ? `https://www.y2mate.com/youtube-mp3/${id}`
          : `https://www.y2mate.com/youtube-mp3/${encodeURIComponent(rawUrl)}`;
      },
    },
  ],

  generic: [
    {
      label: 'Downloader Asia (All-In-One)',
      url: 'https://downloader.asia/',
      primary: true,
    },
  ],
};

export default function MasterDownloaderPage() {
  const { addToast } = useToast();

  const [url, setUrl] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const processUrl = async (inputUrl) => {
    const cleanUrl = (inputUrl || url).trim();

    if (!cleanUrl) {
      addToast('Isi link media dulu', 'warning');
      return;
    }

    if (!/^https?:\/\//i.test(cleanUrl)) {
      setError('Link harus diawali http:// atau https://');
      setData(null);
      return;
    }

    const platform = detectPlatform(cleanUrl);

    setLoading(true);
    setError('');
    setData(null);

    try {
      // TikTok: coba direct dulu lewat proxy
      if (platform === 'tiktok') {
        try {
          const res = await fetch(
            `/api/tool-proxy?path=tiktok&url=${encodeURIComponent(cleanUrl)}`
          );
          const json = await res.json().catch(() => null);

          if (res.ok && json?.status) {
            const r = json.result || {};

            const links = [
              {
                label: 'Tanpa Watermark',
                href: r.play || r.nowatermark || r.video || r.hdplay,
                primary: true,
              },
              {
                label: 'Dengan Watermark',
                href: r.wmplay || r.watermark,
              },
              {
                label: 'Audio MP3',
                href: r.music || r.audio,
              },
            ].filter(
              (link) =>
                typeof link.href === 'string' && /^https?:\/\//i.test(link.href)
            );

            if (links.length > 0) {
              setData({
                type: 'direct',
                platform,
                title: r.title || 'TikTok Video',
                author: r.author?.nickname || r.author || 'TikTok User',
                thumbnail: r.cover || r.origin_cover || null,
                links,
              });

              addToast('Media TikTok ditemukan', 'success');
              return;
            }
          }
        } catch {
          // fallback ke gateway
        }

        setData({
          type: 'gateway',
          platform,
          rawUrl: cleanUrl,
        });

        addToast('Direct TikTok gagal, pakai gateway cadangan', 'warning');
        return;
      }

      // Twitter / Facebook / Instagram / Pinterest: coba direct dulu
      if (['twitter', 'facebook', 'instagram', 'pinterest'].includes(platform)) {
        try {
          const res = await fetch(
            `/api/tool-proxy?path=social&url=${encodeURIComponent(cleanUrl)}`
          );
          const json = await res.json().catch(() => null);

          if (
            res.ok &&
            json?.status &&
            json.result?.downloadUrl &&
            /^https?:\/\//i.test(json.result.downloadUrl)
          ) {
            setData({
              type: 'direct',
              platform,
              title: json.result.title || 'Video Download',
              author: json.result.author || null,
              thumbnail: json.result.thumbnail || null,
              links: [
                {
                  label: 'Download MP4',
                  href: json.result.downloadUrl,
                  primary: true,
                },
              ],
            });

            addToast('Media berhasil ditemukan', 'success');
            return;
          }
        } catch {
          // fallback ke gateway
        }
      }

      // YouTube: metadata oembed + gateway
      if (platform === 'youtube') {
        const videoId = extractYtId(cleanUrl);

        if (!videoId) {
          setError('Link YouTube tidak valid');
          return;
        }

        const payload = {
          type: 'gateway',
          platform,
          rawUrl: cleanUrl,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          title: 'YouTube Video',
          author: null,
        };

        try {
          const oembedRes = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
          );

          if (oembedRes.ok) {
            const meta = await oembedRes.json().catch(() => null);
            payload.title = meta?.title || payload.title;
            payload.author = meta?.author_name || null;
          }
        } catch {
          // abaikan, thumbnail tetap jalan
        }

        setData(payload);
        addToast('Gateway YouTube siap', 'success');
        return;
      }

      // Platform lain: langsung gateway
      setData({
        type: 'gateway',
        platform,
        rawUrl: cleanUrl,
      });

      addToast('Gateway pengunduh siap', 'success');
    } catch {
      setError('Ada masalah saat memproses link. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const openGateway = (gateway) => {
    const clean = (data?.rawUrl || url || '').trim();

    if (clean && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(clean).catch(() => {});
    }

    const target = buildGatewayUrl(gateway, clean);

    addToast(`Membuka ${gateway.label}...`, 'info', 2200);
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  const handleNativePaste = (e) => {
    const pastedText = e.clipboardData?.getData('text') || '';
    const clean = pastedText.trim();

    if (clean && /^https?:\/\//i.test(clean)) {
      setUrl(clean);
      addToast('Link terdeteksi, memproses...', 'info');
      processUrl(clean);
    }
  };

  const pasteButton = async () => {
    try {
      if (!navigator.clipboard?.readText) {
        addToast('Gunakan fitur Tempel dari keyboard HP kamu', 'info');
        return;
      }

      const text = await navigator.clipboard.readText();
      const clean = (text || '').trim();

      if (clean && /^https?:\/\//i.test(clean)) {
        setUrl(clean);
        addToast('Link terdeteksi, memproses...', 'info');
        processUrl(clean);
      } else {
        addToast('Clipboard kosong atau bukan link valid', 'warning');
      }
    } catch {
      addToast('Gunakan saran Tempel dari keyboard HP kamu', 'info');
    }
  };

  const gatewayActions = data?.platform
    ? GATEWAYS[data.platform] || GATEWAYS.generic
    : GATEWAYS.generic;

  return (
    <ToolShell
      title="All-In-One Downloader"
      desc="Download video & audio dari TikTok, Instagram, YouTube, Facebook, Twitter/X, Pinterest, Spotify, SoundCloud, dan Reddit."
      icon="download"
    >
      <div className="panel">
        {/* Platform chips */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginBottom: 14,
          }}
        >
          {PLATFORMS.map((platform) => (
            <span
              key={platform.id}
              className="chip"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11.5,
                padding: '4px 10px',
                pointerEvents: 'none',
              }}
            >
              <PlatformIcon platform={platform.id} size={13} />
              {platform.label}
            </span>
          ))}
        </div>

        {/* Input */}
        <div className="field">
          <label className="label" htmlFor="master-downloader-url">
            Link postingan / video / musik
          </label>

          <input
            id="master-downloader-url"
            className="input"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError('');
            }}
            onPaste={handleNativePaste}
            onKeyDown={(e) => e.key === 'Enter' && processUrl()}
            placeholder="Tempel link TikTok / IG / YouTube / Spotify di sini..."
            inputMode="url"
            spellCheck={false}
          />
        </div>

        {/* Actions */}
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 2 }}
            onClick={() => processUrl()}
            disabled={loading}
          >
            {loading ? (
              'Memproses...'
            ) : (
              <>
                <Icon name="search" size={16} />
                Cari Media
              </>
            )}
          </button>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={pasteButton}
          >
            <Icon name="clipboard" size={16} />
            Tempel
          </button>
        </div>

        {loading ? (
          <div style={{ marginTop: 16 }}>
            <SkeletonLoader lines={3} />
          </div>
        ) : null}

        {error ? <p className="err">{error}</p> : null}

        {/* Direct download result */}
        {data?.type === 'direct' ? (
          <div className="result">
            <div className="result-head">
              <span>Media Ditemukan</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
              }}
            >
              <PlatformIcon platform={data.platform} size={16} />
              <strong style={{ fontSize: 14 }}>
                {PLATFORM_LABELS[data.platform] || 'Media'}
              </strong>
            </div>

            {data.thumbnail ? (
              <img
                src={data.thumbnail}
                alt="Preview media"
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

            {data.title ? (
              <p
                style={{
                  margin: '0 0 4px',
                  fontSize: 15,
                  color: 'var(--text)',
                  fontWeight: 700,
                  lineHeight: 1.4,
                }}
              >
                {data.title}
              </p>
            ) : null}

            {data.author ? (
              <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>
                oleh {data.author}
              </p>
            ) : null}

            <div style={{ display: 'grid', gap: 9 }}>
              {data.links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className={`btn ${
                    link.primary ? 'btn-primary' : 'btn-ghost'
                  } btn-full`}
                >
                  <Icon name="download" size={16} />
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        ) : null}

        {/* Gateway result */}
        {data?.type === 'gateway' ? (
          <div className="result">
            <div className="result-head">
              <span>Gateway Siap</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
              }}
            >
              <PlatformIcon platform={data.platform} size={16} />
              <strong style={{ fontSize: 14 }}>
                {PLATFORM_LABELS[data.platform] || 'Media'}
              </strong>
            </div>

            {data.thumbnail ? (
              <img
                src={data.thumbnail}
                alt="Preview media"
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

            {data.title ? (
              <p
                style={{
                  margin: '0 0 10px',
                  fontSize: 15,
                  color: 'var(--text)',
                  fontWeight: 700,
                  lineHeight: 1.4,
                }}
              >
                {data.title}
              </p>
            ) : null}

            <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>
              Klik tombol di bawah. Link biasanya otomatis terisi, dan link asli
              juga dicopy sebagai cadangan.
            </p>

            <div style={{ display: 'grid', gap: 9 }}>
              {gatewayActions.map((gateway) => (
                <button
                  key={gateway.label}
                  type="button"
                  className={`btn ${
                    gateway.primary ? 'btn-primary' : 'btn-ghost'
                  } btn-full`}
                  onClick={() => openGateway(gateway)}
                >
                  <PlatformIcon platform={data.platform} size={16} />
                  {gateway.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <p className="hint">
          <strong>Tips:</strong> tempel link langsung dari keyboard HP, platform
          bakal otomatis terdeteksi. TikTok dan Twitter/X bisa direct MP4 kalau
          proxy sedang sehat.
        </p>
      </div>
    </ToolShell>
  );
}
