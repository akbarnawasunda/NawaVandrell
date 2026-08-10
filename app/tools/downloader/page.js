'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import ToolShell from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';

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
  if (s.includes('snackvideo')) return 'snackvideo';
  if (s.includes('likee')) return 'likee';
  if (s.includes('vimeo.com')) return 'vimeo';
  if (s.includes('twitch.tv')) return 'twitch';
  return null;
}

const PRIMARY_BASE = process.env.NEXT_PUBLIC_DL_PRIMARY || 'https://SHITDL/';

const GATEWAYS_BY_PLATFORM = {
  instagram: [
    { label: 'Primary Downloader', sub: 'Auto-Paste + Fast', url: PRIMARY_BASE, primary: true },
    { label: 'Downloader.asia', sub: 'Backup 1', url: 'https://downloader.asia/dl/instagram/' },
  ],
  tiktok: [
    { label: 'Primary Downloader', sub: 'No Watermark', url: PRIMARY_BASE, primary: true },
    { label: 'Cobalt.tools', sub: 'Backup', url: 'https://cobalt.tools/' },
  ],
  youtube: [
    { label: 'Primary Downloader', sub: 'MP4 / MP3', url: PRIMARY_BASE, primary: true },
    { label: 'Cobalt.tools', sub: 'Backup', url: 'https://cobalt.tools/' },
  ],
  default: [
    { label: 'Primary Downloader', sub: 'All-in-One', url: PRIMARY_BASE, primary: true },
    { label: 'Cobalt.tools', sub: 'Universal Backup', url: 'https://cobalt.tools/' },
  ]
};

export default function DownloaderPage() {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    setPlatform(detectPlatform(url));
  }, [url]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        showToast('URL ditempel!', 'success');
      }
    } catch {
      showToast('Gagal akses clipboard', 'error');
    }
  };

  const handleOpen = (gw) => {
    if (!url.trim()) {
      showToast('Tempel link dulu', 'warning');
      return;
    }
    try { navigator.clipboard.writeText(url); } catch {}
    const target = gw.primary ? `${gw.url}?url=${encodeURIComponent(url)}` : gw.url;
    window.open(target, '_blank');
    showToast('URL disalin, membuka downloader...', 'success');
  };

  const gateways = (platform && GATEWAYS_BY_PLATFORM[platform]) || GATEWAYS_BY_PLATFORM.default;

  return (
    <ToolShell title="All-In-One Downloader" icon="download">
      <div className="w-full max-w-3xl mx-auto space-y-6">
        {/* Input Card */}
        <div className="relative rounded-[24px] bg-[#0f201a]/80 border border-emerald-500/20 backdrop-blur-xl p-5 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400/60">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              </div>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Tempel link TikTok, IG, YouTube, X..."
                className="w-full h-[56px] pl-12 pr-4 rounded-2xl bg-[#050a07] border border-emerald-500/10 text-white placeholder:text-zinc-500 outline-none focus:border-emerald-400/40 focus:ring-4 focus:ring-emerald-500/10 transition-all"
              />
            </div>
            <button onClick={handlePaste} className="h-[56px] px-6 rounded-2xl bg-zinc-900 border border-white/10 text-white font-medium hover:bg-zinc-800 transition">Tempel</button>
          </div>

          <button
            onClick={() => handleOpen(gateways[0])}
            disabled={loading}
            className="mt-4 w-full h-[56px] rounded-2xl bg-gradient-to-r from-emerald-400 to-emerald-600 text-black font-bold text-[16px] tracking-wide shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:shadow-[0_0_50px_rgba(16,185,129,0.6)] hover:scale-[1.01] active:scale-[0.99] transition-all"
          >
            {loading ? 'Memproses...' : 'Cari Media →'}
          </button>

          {platform && (
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Terdeteksi: {platform.toUpperCase()}
            </div>
          )}
        </div>

        {/* Gateways */}
        <div className="space-y-3">
          <h3 className="text-zinc-400 text-sm font-medium px-1">Pilih Gateway Downloader</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {gateways.map((gw, i) => (
              <button
                key={i}
                onClick={() => handleOpen(gw)}
                className={`group text-left p-4 rounded-2xl border transition-all duration-300 ${
                  gw.primary
                    ? 'bg-white text-black border-white shadow-[0_10px_30px_rgba(255,255,255,0.15)] hover:scale-[1.02]'
                    : 'bg-[#111a16] text-white border-emerald-500/10 hover:border-emerald-500/30 hover:bg-[#15221b]'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-[15px]">{gw.label}</div>
                    <div className={`text-xs mt-1 ${gw.primary ? 'text-zinc-600' : 'text-zinc-400'}`}>{gw.sub}</div>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition ${gw.primary ? 'bg-black text-white' : 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-400 group-hover:text-black'}`}>
                    ↗
                  </div>
                </div>
                {gw.primary && <div className="mt-3 text-[10px] font-bold tracking-widest opacity-60">AUTO-PASTE • NO WATERMARK</div>}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 text-center text-[11px] text-zinc-600">
          NawaVandrell 3.0 — Neuro Core Digital Arsenal<br/>Semua proses jalan di browser kamu.
        </div>
      </div>
    </ToolShell>
  );
}
