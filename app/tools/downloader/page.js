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
  return null;
}

const PRIMARY_BASE = process.env.NEXT_PUBLIC_DL_PRIMARY || 'https://SHITDL/';

const GATEWAYS = {
  instagram: [
    { label: 'Primary Downloader', sub: 'Auto-Paste • No Watermark', url: PRIMARY_BASE, primary: true },
    { label: 'Cobalt.tools', sub: 'Universal Backup', url: 'https://cobalt.tools/' },
  ],
  tiktok: [
    { label: 'Primary Downloader', sub: 'No Watermark • Fast', url: PRIMARY_BASE, primary: true },
    { label: 'Cobalt.tools', sub: 'Backup', url: 'https://cobalt.tools/' },
  ],
  default: [
    { label: 'Primary Downloader', sub: 'All-in-One • Auto-Paste', url: PRIMARY_BASE, primary: true },
    { label: 'Cobalt.tools', sub: 'Universal Backup', url: 'https://cobalt.tools/' },
  ]
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
    const target = gw.primary ? `${gw.url}?url=${encodeURIComponent(url)}` : gw.url;
    window.open(target, '_blank');
    showToast('URL disalin, membuka downloader...', 'success');
  };

  const gateways = (platform && GATEWAYS[platform]) || GATEWAYS.default;

  return (
    <ToolShell title="All-In-One Downloader" icon="download">
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        
        {/* MAIN CARD */}
        <div style={{ background: 'linear-gradient(180deg, #13251d 0%, #0c1712 100%)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 24, padding: 20, boxShadow: '0 0 60px rgba(16,185,129,0.12)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#10b981' }}>🔗</span>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Tempel link TikTok, IG, YouTube, X..."
                style={{ width: '100%', height: 56, paddingLeft: 44, paddingRight: 16, borderRadius: 16, background: '#050a07', border: '1px solid rgba(16,185,129,0.15)', color: 'white', outline: 'none', fontSize: 15 }}
              />
            </div>
            <button onClick={handlePaste} style={{ height: 56, padding: '0 20px', borderRadius: 16, background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Tempel</button>
          </div>

          <button
            onClick={() => handleOpen(gateways[0])}
            style={{ marginTop: 16, width: '100%', height: 56, borderRadius: 16, background: 'linear-gradient(90deg, #34d399, #059669)', color: 'black', fontWeight: 800, fontSize: 16, border: 'none', cursor: 'pointer', boxShadow: '0 0 30px rgba(16,185,129,0.4)' }}
          >
            Cari Media →
          </button>

          {platform && (
            <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#6ee7b7', fontSize: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: '#10b981', display: 'inline-block' }} /> Terdeteksi: {platform.toUpperCase()}
            </div>
          )}
        </div>

        {/* GATEWAY GRID */}
        <div>
          <div style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 10, paddingLeft: 4, fontWeight: 600 }}>Pilih Gateway Downloader</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {gateways.map((gw, i) => (
              <button
                key={i}
                onClick={() => handleOpen(gw)}
                style={{
                  textAlign: 'left', padding: 16, borderRadius: 16, border: gw.primary ? '1px solid white' : '1px solid rgba(16,185,129,0.15)',
                  background: gw.primary ? 'white' : '#121a16',
                  color: gw.primary ? 'black' : 'white',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{gw.label}</div>
                    <div style={{ fontSize: 12, marginTop: 4, opacity: 0.6 }}>{gw.sub}</div>
                  </div>
                  <div style={{ width: 28, height: 28, borderRadius: 999, background: gw.primary ? 'black' : 'rgba(16,185,129,0.15)', color: gw.primary ? 'white' : '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↗</div>
                </div>
                {gw.primary && <div style={{ marginTop: 12, fontSize: 10, fontWeight: 800, letterSpacing: 1, opacity: 0.5 }}>AUTO-PASTE • NO WATERMARK</div>}
              </button>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center', color: '#52525b', fontSize: 11, paddingTop: 8 }}>
          NawaVandrell 3.0 — Neuro Core Digital Arsenal<br/>Semua proses jalan di browser kamu.
        </div>
      </div>
    </ToolShell>
  );
}
