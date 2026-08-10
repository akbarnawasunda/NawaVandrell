'use client';
import { useState } from 'react';
import ToolShell from '@/components/ToolShell';
import SkeletonLoader from '@/components/SkeletonLoader';
import { useToast } from '@/context/ToastContext';
import Icon, { PlatformIcon } from '@/components/icons';
const PLATFORMS = [{ id: 'instagram', label: 'Instagram' },{ id: 'tiktok', label: 'TikTok' },{ id: 'youtube', label: 'YouTube' },{ id: 'twitter', label: 'Twitter/X' },{ id: 'facebook', label: 'Facebook' },{ id: 'pinterest', label: 'Pinterest' },{ id: 'spotify', label: 'Spotify' },{ id: 'soundcloud', label: 'SoundCloud' },{ id: 'reddit', label: 'Reddit' }];
const PLATFORM_LABELS = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', twitter: 'Twitter/X', facebook: 'Facebook', pinterest: 'Pinterest', spotify: 'Spotify', soundcloud: 'SoundCloud', reddit: 'Reddit', generic: 'Media' };
const YT_RE = /(?:v=|\/embed\/|\/1\/|\/v\/|https:\/\/youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/;
function extractYtId(url) { if (!url) return null; const match = String(url).match(YT_RE); return match? match[1] : null; }
function detectPlatform(inputUrl) { const url = String(inputUrl || '').toLowerCase(); if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter'; if (url.includes('tiktok.com')) return 'tiktok'; if (url.includes('instagram.com')) return 'instagram'; if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook'; if (url.includes('pinterest.com') || url.includes('pin.it')) return 'pinterest'; if (url.includes('soundcloud.com')) return 'soundcloud'; if (url.includes('spotify.com')) return 'spotify'; if (url.includes('reddit.com')) return 'reddit'; if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'; return 'generic'; }
function buildGatewayUrl(gateway, rawUrl) { const clean = String(rawUrl || '').trim(); if (gateway.builder) return gateway.builder(clean); const base = gateway.url; if (!clean || gateway.noParam) return base; const separator = base.includes('?')? '&' : '?'; return `${base}${separator}url=${encodeURIComponent(clean)}`; }
const GATEWAYS = {
  instagram: [{ label: 'Downloader Asia (Instagram)', url: 'https://downloader.asia/dl/instagram/', primary: true },{ label: 'Cobalt (Zero Ads)', url: 'https://cobalt.tools/', noParam: true }],
  facebook: [{ label: 'Downloader Asia (Facebook)', url: 'https://downloader.asia/dl/facebook/', primary: true }],
  youtube: [{ label: 'Downloader Asia (YouTube)', url: 'https://downloader.asia/dl/youtube/', primary: true },{ label: 'Cobalt (Zero Ads)', url: 'https://cobalt.tools/', noParam: true }],
  pinterest: [{ label: 'Downloader Asia (Pinterest)', url: 'https://downloader.asia/dl/pinterest/', primary: true }],
  spotify: [{ label: 'Downloader Asia (Spotify)', url: 'https://downloader.asia/dl/spotify/', primary: true }],
  soundcloud: [{ label: 'Downloader Asia (SoundCloud)', url: 'https://downloader.asia/dl/soundcloud/', primary: true },{ label: 'Cobalt (Zero Ads)', url: 'https://cobalt.tools/', noParam: true }],
  reddit: [{ label: 'Downloader Asia (Reddit)', url: 'https://downloader.asia/dl/reddit/', primary: true },{ label: 'Cobalt (Zero Ads)', url: 'https://cobalt.tools/', noParam: true }],
  twitter: [{ label: 'Downloader Asia (Twitter)', url: 'https://downloader.asia/dl/twitter/', primary: true },{ label: 'Cobalt (Zero Ads)', url: 'https://cobalt.tools/', noParam: true }],
  tiktok: [{ label: 'Downloader Asia (TikTok)', url: 'https://downloader.asia/dl/tiktok/', primary: true },{ label: 'Cobalt (Zero Ads / No WM)', url: 'https://cobalt.tools/', noParam: true }],
  generic: [{ label: 'Downloader Asia (All-In-One)', url: 'https://downloader.asia/', primary: true },{ label: 'Cobalt (Zero Ads)', url: 'https://cobalt.tools/', noParam: true }],
};
export default function MasterDownloaderPage() {
  const { addToast } = useToast();
  const [url, setUrl] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const processUrl = async (inputUrl) => {
    const cleanUrl = (inputUrl || url).trim();
    if (!cleanUrl) { addToast('Isi link media dulu', 'warning'); return; }
    if (!/^https?:\/\//i.test(cleanUrl)) { setError('Link harus diawali http:// atau https://'); setData(null); return; }
    const platform = detectPlatform(cleanUrl);
    setLoading(true); setError(''); setData(null);
    try {
      if (platform === 'tiktok') {
        try {
          let res = await fetch(`/api/tools-proxy?path=tiktok&url=${encodeURIComponent(cleanUrl)}`);
          if (!res.ok) res = await fetch(`/api/tool-proxy?path=tiktok&url=${encodeURIComponent(cleanUrl)}`);
          const json = await res.json().catch(() => null);
          if (res.ok && json?.status) {
            const r = json.result || {};
            let links = r.links && r.links.length > 0? r.links : [
              { label: 'Tanpa Watermark', href: r.play || r.nowatermark, primary: true },
              { label: 'HD No WM', href: r.hdplay },
              { label: 'Dengan Watermark', href: r.wmplay },
              { label: 'Audio MP3', href: r.music },
            ];
            links = links.filter((l) => typeof l.href === 'string' && /^https?:\/\//i.test(l.href));
            if (links.length > 0) {
              setData({ type: 'direct', platform, title: r.title || 'TikTok Video', author: r.author?.nickname || r.author, thumbnail: r.cover, links });
              addToast('Media TikTok ditemukan ('+links.length+' file)', 'success'); return;
            }
          }
        } catch {}
        setData({ type: 'gateway', platform, rawUrl: cleanUrl });
        addToast('Direct proxy gagal, pakai gateway cadangan', 'warning'); return;
      }
      if (['twitter', 'facebook', 'instagram', 'pinterest'].includes(platform)) {
        try {
          let res = await fetch(`/api/tools-proxy?path=social&url=${encodeURIComponent(cleanUrl)}`);
          if (!res.ok) res = await fetch(`/api/tool-proxy?path=social&url=${encodeURIComponent(cleanUrl)}`);
          const json = await res.json().catch(() => null);
          if (res.ok && json?.status && json.result) {
            const r = json.result;
            let links = r.links || [];
            if (links.length === 0 && r.downloadUrl) links = [{ label: 'Download MP4', href: r.downloadUrl, primary: true }];
            links = links.filter(l => l.href && /^https?:\/\//i.test(l.href));
            if (links.length > 0) {
              setData({ type: 'direct', platform, title: r.title, author: r.author, thumbnail: r.thumbnail, links });
              addToast('Media berhasil ditemukan ('+links.length+' file)', 'success'); return;
            }
          }
        } catch {}
      }
      if (platform === 'youtube') {
        const videoId = extractYtId(cleanUrl);
        if (!videoId) { setError('Link YouTube tidak valid'); return; }
        const payload = { type: 'gateway', platform, rawUrl: cleanUrl, thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, title: 'YouTube Video' };
        try { const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`); if (oembedRes.ok) { const meta = await oembedRes.json(); payload.title = meta?.title || payload.title; payload.author = meta?.author_name; } } catch {}
        setData(payload); addToast('Gateway YouTube siap', 'success'); return;
      }
      setData({ type: 'gateway', platform, rawUrl: cleanUrl });
      addToast('Gateway pengunduh siap', 'success');
    } catch { setError('Ada masalah saat memproses link.'); } finally { setLoading(false); }
  };
  const openGateway = (gateway) => {
    const clean = (data?.rawUrl || url || '').trim();
    if (clean && navigator.clipboard?.writeText) navigator.clipboard.writeText(clean).catch(() => {});
    const target = buildGatewayUrl(gateway, clean);
    if (gateway.noParam) { addToast(`Link tercopy! Tinggal paste di ${gateway.label}`, 'info', 3000); } else { addToast(`Membuka ${gateway.label}...`, 'info', 2200); }
    window.open(target, '_blank', 'noopener,noreferrer');
  };
  const handleNativePaste = (e) => { const pastedText = e.clipboardData?.getData('text') || ''; if (pastedText.trim() && /^https?:\/\//i.test(pastedText.trim())) { setUrl(pastedText.trim()); addToast('Link terdeteksi, memproses...', 'info'); processUrl(pastedText.trim()); } };
  const pasteButton = async () => { try { if (!navigator.clipboard?.readText) { addToast('Gunakan fitur Tempel dari keyboard HP', 'info'); return; } const text = (await navigator.clipboard.readText() || '').trim(); if (text && /^https?:\/\//i.test(text)) { setUrl(text); addToast('Link terdeteksi...', 'info'); processUrl(text); } else { addToast('Clipboard kosong atau bukan link valid', 'warning'); } } catch { addToast('Akses clipboard ditolak', 'warning'); } };
  const gatewayActions = data?.platform? GATEWAYS[data.platform] || GATEWAYS.generic : GATEWAYS.generic;
  return (
    <ToolShell title="All-In-One Downloader" desc="Download video & audio dari TikTok, IG, YouTube, Twitter, FB, dll. Clean & No Ads." icon="download">
      <div className="panel">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>{PLATFORMS.map((p) => (<span key={p.id} className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, padding: '4px 10px', pointerEvents: 'none' }}><PlatformIcon platform={p.id} size={13} /> {p.label}</span>))}</div>
        <div className="field"><label className="label" htmlFor="master-url">Link postingan / video / musik</label><input id="master-url" className="input" value={url} onChange={(e) => { setUrl(e.target.value); setError(''); }} onPaste={handleNativePaste} onKeyDown={(e) => e.key === 'Enter' && processUrl()} placeholder="Tempel link di sini..." inputMode="url" spellCheck={false} /></div>
        <div className="btn-row"><button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={() => processUrl()} disabled={loading}>{loading? 'Memproses...' : <><Icon name="search" size={16} /> Cari Media</>}</button><button type="button" className="btn btn-ghost" onClick={pasteButton}><Icon name="clipboard" size={16} /> Tempel</button></div>
        {loading? <div style={{ marginTop: 16 }}><SkeletonLoader type="video" /></div> : null}
        {error? <p className="err">{error}</p> : null}
        {data?.type === 'direct'? (<div className="result"><div className="result-head"><span>Media Ditemukan (Direct) • {data.links?.length} file</span></div><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><PlatformIcon platform={data.platform} size={16} /><strong style={{ fontSize: 14 }}>{PLATFORM_LABELS[data.platform]}</strong></div>{data.thumbnail? <img src={data.thumbnail} alt="Preview" referrerPolicy="no-referrer" style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 12, marginBottom: 12, border: '1px solid var(--border)' }} /> : null}{data.title? <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>{data.title}</p> : null}{data.author? <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>oleh {data.author}</p> : null}<div style={{ display: 'grid', gap: 9 }}>{data.links.map((l, idx) => (<a key={idx} href={l.href} target="_blank" rel="noopener noreferrer" download className={`btn ${l.primary? 'btn-primary' : 'btn-ghost'} btn-full`}><Icon name="download" size={16} /> {l.label}</a>))}</div></div>) : null}
        {data?.type === 'gateway'? (<div className="result"><div className="result-head"><span>Gateway Siap</span></div><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><PlatformIcon platform={data.platform} size={16} /><strong style={{ fontSize: 14 }}>{PLATFORM_LABELS[data.platform]}</strong></div>{data.thumbnail? <img src={data.thumbnail} alt="Preview" referrerPolicy="no-referrer" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12, marginBottom: 12, border: '1px solid var(--border)' }} /> : null}{data.title? <p style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700 }}>{data.title}</p> : null}<p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>Pilih gateway di bawah. Link otomatis terisi (atau tercopy).</p><div style={{ display: 'grid', gap: 9 }}>{gatewayActions.map((g) => (<button key={g.label} type="button" className={`btn ${g.primary? 'btn-primary' : 'btn-ghost'} btn-full`} onClick={() => openGateway(g)}>{g.noParam? <Icon name="sparkles" size={16} /> : <PlatformIcon platform={data.platform} size={16} />} {g.label}</button>))}</div></div>) : null}
        <p className="hint"><strong>Tips:</strong> TikTok slideshow sekarang bisa download semua slide, Twitter bisa multi-video sekaligus.</p>
      </div>
    </ToolShell>
  );
}
