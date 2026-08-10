'use client';

import { useEffect, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';
import Icon from '@/components/icons';

function detectPlatform(u) {
  if (!u) return null;
  const s = u.toLowerCase();
  if (s.includes('instagram.com')) return 'instagram';
  if (s.includes('tiktok.com')) return 'tiktok';
  if (s.includes('youtube.com') || s.includes('youtu.be')) return 'youtube';
  if (s.includes('twitter.com') || s.includes('x.com')) return 'twitter';
  if (s.includes('facebook.com') || s.includes('fb.watch')) return 'facebook';
  return null;
}

const PLATFORM_META = {
  instagram: { label: 'Instagram', color: '#e1306c' },
  tiktok: { label: 'TikTok', color: '#22d3ee' },
  youtube: { label: 'YouTube', color: '#ff4d4d' },
  twitter: { label: 'X / Twitter', color: '#a1a1aa' },
  facebook: { label: 'Facebook', color: '#4d8dff' },
};

// REAL PROXY & API GATEWAYS
const GATEWAYS = {
  instagram: [
    { label: 'FastDL (Recommended)', sub: 'IG Post, Reels, Story', url: 'https://fastdl.app/', primary: true },
    { label: 'SnapInsta', sub: 'Backup Gateway', url: 'https://snapinsta.app/' },
  ],
  tiktok: [
    { label: 'TikWM API', sub: 'Direct Proxy • No Watermark', url: 'https://www.tikwm.com/', primary: true },
    { label: 'SnapTik', sub: 'Backup Proxy', url: 'https://snaptik.app/' },
  ],
  twitter: [
    { label: 'Twitsave CDN', sub: 'Direct Twitter API / CDN', url: 'https://twitsave.com/', primary: true },
    { label: 'SSSTwitter', sub: 'Backup Scraper', url: 'https://ssstwitter.com/' },
  ],
  youtube: [
    { label: 'Y2Mate', sub: 'Video & Audio Converter', url: 'https://www.y2mate.com/', primary: true },
    { label: '9xBuddy', sub: 'Universal Backup', url: 'https://9xbuddy.in/' },
  ],
  facebook: [
    { label: 'FDown', sub: 'FB Video HD/SD', url: 'https://fdown.net/', primary: true },
    { label: 'GetfVid', sub: 'Backup', url: 'https://www.getfvid.com/' },
  ],
  default: [
    { label: 'Cobalt', sub: 'Universal • Ad-Free API', url: 'https://cobalt.tools/', primary: true },
    { label: 'Downloader.asia', sub: 'Multi-Platform Hub', url: 'https://downloader.asia/' },
  ],
};

export default function DownloaderPage() {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState(null);
  const { showToast } = useToast();

  useEffect(() => { setPlatform(detectPlatform(url)); }, [url]);

  const handlePaste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) { setUrl(t); showToast('URL ditempel!', 'success'); }
    } catch { showToast('Gagal akses clipboard', 'error'); }
  };

  const handleOpen = (gw) => {
    if (!url.trim()) { showToast('Tempel link dulu', 'warning'); return; }
    try { navigator.clipboard.writeText(url); } catch {}
    window.open(gw.url, '_blank');
    showToast('Link disalin! Tinggal paste di situs downloader.', 'success');
  };

  const gateways = (platform && GATEWAYS[platform]) || GATEWAYS.default;
  const meta = platform ? PLATFORM_META[platform] : null;

  return (
    <ToolShell title="All-In-One Downloader" icon="download">
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'grid', gap: 20 }}>
        <div className="panel">
          <p className="label" style={{ marginBottom: 10 }}>Tempel link media</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="dl-input-wrap" style={{ flex: 1 }}>
              <span className="dl-input-icon"><Icon name="link" size={18} /></span>
              <input
                className="input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleOpen(gateways[0])}
                placeholder="Tempel link TikTok, IG, YouTube, X..."
              />
            </div>
            <button type="button" className="btn btn-ghost" onClick={handlePaste}>Tempel</button>
          </div>

          {meta ? (
            <span className="dl-chip" style={{ marginTop: 12, color: meta.color, borderColor: `${meta.color}55` }}>
              <span className="dot" /> Terdeteksi: {meta.label}
            </span>
          ) : null}

          <button type="button" className="btn btn-primary btn-full" style={{ marginTop: 14, height: 52 }} onClick={() => handleOpen(gateways[0])}>
            Cari Media
          </button>
        </div>

        <div>
          <p className="label" style={{ marginBottom: 10 }}>Pilih gateway downloader</p>
          <div className="dl-grid">
            {gateways.map((gw, i) => (
              <button key={i} type="button" className={`dl-gw ${gw.primary ? 'primary' : ''}`} onClick={() => handleOpen(gw)}>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <span>
                    <span style={{ display: 'block', fontWeight: 800, fontSize: 14 }}>{gw.label}</span>
                    <span style={{ display: 'block', fontSize: 12, marginTop: 4, opacity: 0.65 }}>{gw.sub}</span>
                  </span>
                  <span className="arrow"><Icon name="link" size={14} /></span>
                </span>
                {gw.primary ? (
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, opacity: 0.6 }}>AUTO-COPY • NO WATERMARK</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <p className="hint" style={{ textAlign: 'center' }}>
          Semua proses jalan di browser kamu. NawaVandrell tidak menyimpan media apa pun.
        </p>
      </div>
    </ToolShell>
  );
}
