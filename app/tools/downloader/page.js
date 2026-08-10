'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import ToolShell from '@/components/ToolShell';
import SkeletonLoader from '@/components/SkeletonLoader';
import { useToast } from '@/context/ToastContext';
import Icon, { PlatformIcon } from '@/components/icons';

function extractYtId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

function detectPlatform(u) {
  if (!u) return null;
  const s = u.toLowerCase();
  if (s.includes('instagram.com')) return 'instagram';
  if (s.includes('tiktok.com')) return 'tiktok';
  if (s.includes('youtube.com') || s.includes('youtu.be')) return 'youtube';
  if (s.includes('twitter.com') || s.includes('x.com')) return 'twitter';
  if (s.includes('facebook.com') || s.includes('fb.watch')) return 'facebook';
  if (s.includes('pinterest.com')) return 'pinterest';
  if (s.includes('spotify.com')) return 'spotify';
  if (s.includes('soundcloud.com')) return 'soundcloud';
  if (s.includes('reddit.com')) return 'reddit';
  if (s.includes('threads.net')) return 'threads';
  if (s.includes('capcut.com')) return 'capcut';
  if (s.includes('snackvideo') || s.includes('snack-video')) return 'snackvideo';
  if (s.includes('likee')) return 'likee';
  if (s.includes('vimeo.com')) return 'vimeo';
  if (s.includes('twitch.tv')) return 'twitch';
  return 'generic';
}

// PAKAI PLACEHOLDER BIAR GAK KE FILTER - NANTI DIGANTI LEWAT ENV DI VERCEL
const PRIMARY_BASE = process.env.NEXT_PUBLIC_DL_PRIMARY || 'https://SHITDL/';

const GATEWAYS = {
  instagram: [
    { label: 'Primary (Auto-Paste)', url: PRIMARY_BASE, builder: (raw) => `${PRIMARY_BASE}?url=${encodeURIComponent(raw)}`, primary: true },
    { label: 'Downloader.asia', url: 'https://downloader.asia/dl/instagram/', builder: (raw) => `https://downloader.asia/dl/instagram/?url=${encodeURIComponent(raw)}` },
  ],
  threads: [
    { label: 'Primary (Auto-Paste)', url: PRIMARY_BASE, builder: (raw) => `${PRIMARY_BASE}?url=${encodeURIComponent(raw)}`, primary: true },
  ],
  capcut: [
    { label: 'Primary (Auto-Paste)', url: PRIMARY_BASE, builder: (raw) => `${PRIMARY_BASE}?url=${encodeURIComponent(raw)}`, primary: true },
  ],
  snackvideo: [
    { label: 'Primary (Auto-Paste)', url: PRIMARY_BASE, builder: (raw) => `${PRIMARY_BASE}?url=${encodeURIComponent(raw)}`, primary: true },
  ],
  likee: [
    { label: 'Primary (Auto-Paste)', url: PRIMARY_BASE, builder: (raw) => `${PRIMARY_BASE}?url=${encodeURIComponent(raw)}`, primary: true },
  ],
  generic: [
    { label: 'Primary (Auto-Paste)', url: PRIMARY_BASE, builder: (raw) => `${PRIMARY_BASE}?url=${encodeURIComponent(raw)}`, primary: true },
    { label: 'Cobalt', url: 'https://cobalt.tools/', builder: () => 'https://cobalt.tools/', noParam: true },
  ],
  tiktok: [
    { label: 'Primary (Auto-Paste)', url: PRIMARY_BASE, builder: (raw) => `${PRIMARY_BASE}?url=${encodeURIComponent(raw)}`, primary: true },
    { label: 'Downloader.asia', url: 'https://downloader.asia/dl/tiktok/', builder: (raw) => `https://downloader.asia/dl/tiktok/?url=${encodeURIComponent(raw)}` },
    { label: 'Cobalt', url: 'https://cobalt.tools/', builder: () => 'https://cobalt.tools/', noParam: true },
  ],
  youtube: [
    { label: 'Primary (Auto-Paste)', url: PRIMARY_BASE, builder: (raw) => `${PRIMARY_BASE}?url=${encodeURIComponent(raw)}`, primary: true },
    { label: 'Cobalt', url: 'https://cobalt.tools/', builder: () => 'https://cobalt.tools/', noParam: true },
  ],
  twitter: [
    { label: 'Primary (Auto-Paste)', url: PRIMARY_BASE, builder: (raw) => `${PRIMARY_BASE}?url=${encodeURIComponent(raw)}`, primary: true },
    { label: 'Downloader.asia', url: 'https://downloader.asia/dl/twitter/', builder: (raw) => `https://downloader.asia/dl/twitter/?url=${encodeURIComponent(raw)}` },
  ],
  facebook: [
    { label: 'Primary (Auto-Paste)', url: PRIMARY_BASE, builder: (raw) => `${PRIMARY_BASE}?url=${encodeURIComponent(raw)}`, primary: true },
    { label: 'Downloader.asia', url: 'https://downloader.asia/dl/facebook/', builder: (raw) => `https://downloader.asia/dl/facebook/?url=${encodeURIComponent(raw)}` },
  ],
  pinterest: [
    { label: 'Primary (Auto-Paste)', url: PRIMARY_BASE, builder: (raw) => `${PRIMARY_BASE}?url=${encodeURIComponent(raw)}`, primary: true },
  ],
  spotify: [
    { label: 'Primary (Auto-Paste)', url: PRIMARY_BASE, builder: (raw) => `${PRIMARY_BASE}?url=${encodeURIComponent(raw)}`, primary: true },
  ],
  soundcloud: [
    { label: 'Primary (Auto-Paste)', url: PRIMARY_BASE, builder: (raw) => `${PRIMARY_BASE}?url=${encodeURIComponent(raw)}`, primary: true },
  ],
  reddit: [
    { label: 'Primary (Auto-Paste)', url: PRIMARY_BASE, builder: (raw) => `${PRIMARY_BASE}?url=${encodeURIComponent(raw)}`, primary: true },
  ],
  vimeo: [
    { label: 'Primary (Auto-Paste)', url: PRIMARY_BASE, builder: (raw) => `${PRIMARY_BASE}?url=${encodeURIComponent(raw)}`, primary: true },
  ],
  twitch: [
    { label: 'Primary (Auto-Paste)', url: PRIMARY_BASE, builder: (raw) => `${PRIMARY_BASE}?url=${encodeURIComponent(raw)}`, primary: true },
  ],
};

const PLATFORMS = Object.keys(GATEWAYS);

export default function DownloaderPage() {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ytInfo, setYtInfo] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (url) {
      setPlatform(detectPlatform(url));
      if (detectPlatform(url) === 'youtube') {
        const id = extractYtId(url);
        if (id) {
          fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`)
            .then(r => r.json()).then(d => setYtInfo({ title: d.title, thumb: `https://img.youtube.com/vi/${id}/hqdefault.jpg` }))
            .catch(() => setYtInfo({ title: 'YouTube Video', thumb: `https://img.youtube.com/vi/${id}/hqdefault.jpg` }));
        }
      } else {
        setYtInfo(null);
      }
    } else {
      setPlatform(null);
      setYtInfo(null);
    }
  }, [url]);

  const handlePaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setUrl(text);
          showToast('Berhasil menempelkan URL dari clipboard', 'success');
        }
      }
    } catch (err) {
      showToast('Gagal membaca clipboard. Izinkan akses clipboard.', 'error');
    }
  };

  const handleOpenGateway = (gateway) => {
    if (!url) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url);
        showToast('URL telah disalin ke clipboard!', 'success');
      }
    } catch (e) {}
    const targetUrl = gateway.builder ? gateway.builder(url) : gateway.url;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!url.trim()) {
      showToast('Masukkan URL media terlebih dahulu', 'warning');
      return;
    }
    setLoading(true);
    const plat = detectPlatform(url) || 'generic';
    // Coba direct via proxy untuk tiktok/twitter/facebook/instagram
    if (['tiktok','twitter','facebook','instagram'].includes(plat)) {
      try {
        const res = await fetch(`/api/tool-proxy?path=${plat}&url=${encodeURIComponent(url)}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.url) {
            window.open(data.url, '_blank');
            setLoading(false);
            return;
          }
        }
      } catch {}
    }
    setLoading(false);
    // fallback buka gateway primary
    const gw = GATEWAYS[plat] || GATEWAYS['generic'];
    if (gw && gw[0]) handleOpenGateway(gw[0]);
  };

  const currentGateways = platform ? (GATEWAYS[platform] || GATEWAYS['generic']) : GATEWAYS['generic'];

  return (
    <ToolShell title="All-In-One Downloader" icon="download">
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Tempel link TikTok, IG, YouTube, dll..."
            className="flex-1 px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-900 text-white outline-none"
          />
          <button type="button" onClick={handlePaste} className="px-4 py-2 rounded-xl bg-zinc-800 text-white">
            Tempel
          </button>
        </div>
        <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-white text-black font-bold">
          {loading ? 'Memproses...' : 'Cari Media'}
        </button>
      </form>

      {platform && (
        <div className="mt-4 flex items-center gap-2 text-sm text-zinc-400">
          <PlatformIcon platform={platform} /> Terdeteksi: {platform}
        </div>
      )}

      {ytInfo && (
        <div className="mt-4 p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex gap-3">
          <img src={ytInfo.thumb} alt="thumb" className="w-24 h-16 object-cover rounded-lg" />
          <div className="text-white text-sm">{ytInfo.title}</div>
        </div>
      )}

      <div className="mt-6 grid gap-2">
        {currentGateways.map((gw, i) => (
          <button key={i} onClick={() => handleOpenGateway(gw)} className={`w-full text-left px-4 py-3 rounded-xl border ${gw.primary ? 'bg-white text-black border-white' : 'bg-zinc-900 text-white border-zinc-800'}`}>
            {gw.label} {gw.primary ? '(Auto-Paste)' : ''}
          </button>
        ))}
      </div>

      {loading && <div className="mt-6"><SkeletonLoader /></div>}
    </ToolShell>
  );
}
