'use client';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

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

function detectPlatform(url) {
  if (!url || typeof url !== 'string') return 'generic';
  const u = url.toLowerCase().trim();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('tiktok.com') || u.includes('vt.tiktok.com')) return 'tiktok';
  if (u.includes('instagram.com') || u.includes('instagr.am')) return 'instagram';
  if (u.includes('twitter.com') || u.includes('x.com')) return 'twitter';
  if (u.includes('facebook.com') || u.includes('fb.watch') || u.includes('fb.com')) return 'facebook';
  if (u.includes('pinterest.com') || u.includes('pin.it')) return 'pinterest';
  if (u.includes('spotify.com')) return 'spotify';
  if (u.includes('soundcloud.com')) return 'soundcloud';
  if (u.includes('reddit.com') || u.includes('redd.it')) return 'reddit';
  if (u.includes('threads.net')) return 'threads';
  if (u.includes('capcut.com')) return 'capcut';
  if (u.includes('snackvideo.com') || u.includes('s.snackvideo.com')) return 'snackvideo';
  if (u.includes('likee.video') || u.includes('likee.com')) return 'likee';
  if (u.includes('vimeo.com')) return 'vimeo';
  if (u.includes('twitch.tv')) return 'twitch';
  return 'generic';
}

const PLATFORMS = [
  'instagram',
  'tiktok',
  'youtube',
  'twitter',
  'facebook',
  'pinterest',
  'spotify',
  'soundcloud',
  'reddit',
  'threads',
  'capcut',
  'snackvideo',
  'likee',
  'vimeo',
  'twitch',
  'generic'
];

const GATEWAYS = PLATFORMS.reduce((acc, platform) => {
  acc[platform] = [
    {
      label: 'FastDL (Auto-Paste)',
      url: 'https://fastdl.app/',
      builder: (raw) => `https://fastdl.app/?url=${encodeURIComponent(raw)}`,
      primary: true
    },
    {
      label: 'Downloader.asia',
      url: `https://downloader.asia/dl/${platform}/`,
      builder: (raw) => `https://downloader.asia/dl/${platform}/?url=${encodeURIComponent(raw)}`,
      primary: false
    },
    {
      label: 'Cobalt Tools',
      url: 'https://cobalt.tools/',
      builder: () => 'https://cobalt.tools/',
      noParam: true,
      primary: false
    }
  ];
  return acc;
}, {});

export default function DownloaderPage() {
  const toastContext = useToast();
  const showToast = (msg, type = 'info') => {
    if (toastContext?.showToast) toastContext.showToast(msg, type);
    else if (toastContext?.addToast) toastContext.addToast(msg, type);
    else if (toastContext?.toast) toastContext.toast(msg, type);
    else if (typeof toastContext === 'function') toastContext(msg);
  };

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [detected, setDetected] = useState('generic');
  const [mediaData, setMediaData] = useState(null);

  useEffect(() => {
    if (url.trim()) {
      setDetected(detectPlatform(url));
    } else {
      setDetected('generic');
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
    } catch (e) {
      // clip fallback
    }
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
    setMediaData(null);

    const platform = detectPlatform(url);
    setDetected(platform);

    try {
      if (platform === 'youtube') {
        const ytId = extractYtId(url);
        let title = 'YouTube Video';
        let author = '';

        try {
          const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
          if (oembedRes.ok) {
            const oembed = await oembedRes.json();
            if (oembed.title) title = oembed.title;
            if (oembed.author_name) author = oembed.author_name;
          }
        } catch (err) {
          // Fallback oembed error
        }

        setMediaData({
          type: 'youtube',
          title,
          author,
          ytId,
          thumbnail: ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null,
          platform
        });
        setLoading(false);
        return;
      }

      if (['tiktok', 'twitter', 'facebook', 'instagram'].includes(platform)) {
        try {
          const res = await fetch(`/api/tool-proxy?path=${platform}&url=${encodeURIComponent(url)}`);
          if (res.ok) {
            const data = await res.json();
            if (data && (data.url || data.downloadUrl || data.medias || data.video || data.data)) {
              setMediaData({
                type: 'direct',
                data,
                platform
              });
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          // Direct proxy failed -> fallback to gateways
        }
      }

      setMediaData({
        type: 'gateway',
        platform
      });
    } catch (err) {
      setMediaData({
        type: 'gateway',
        platform
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolShell title="All-In-One Downloader" icon="download">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="bg-slate-800/60 backdrop-blur border border-slate-700/60 rounded-2xl p-6 shadow-xl">
          <form onSubmit={handleSearch} className="space-y-4">
            <label className="block text-sm font-medium text-slate-300">
              Masukkan Link / URL Media
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Tempel URL TikTok, YouTube, Instagram, Facebook, Twitter, dll..."
                  className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all pr-12"
                />
                {detected && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
                    <PlatformIcon name={detected} className="w-6 h-6" />
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handlePaste}
                className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Icon name="clipboard" className="w-5 h-5" />
                <span>Tempel</span>
              </button>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
              >
                {loading ? (
                  <span>Memproses...</span>
                ) : (
                  <>
                    <Icon name="search" className="w-5 h-5" />
                    <span>Cari Media</span>
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-700/50">
            <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">
              Platform Didukung (16 Platform)
            </p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <span
                  key={p}
                  onClick={() => setDetected(p)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    detected === p
                      ? 'bg-indigo-600/30 border border-indigo-500/50 text-indigo-300'
                      : 'bg-slate-900/50 border border-slate-700/50 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <PlatformIcon name={p} className="w-3.5 h-3.5" />
                  <span className="capitalize">{p}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {loading && <SkeletonLoader />}

        {!loading && mediaData && (
          <div className="bg-slate-800/60 backdrop-blur border border-slate-700/60 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-4">
              <div className="flex items-center gap-3">
                <PlatformIcon name={mediaData.platform} className="w-8 h-8" />
                <div>
                  <h3 className="text-lg font-bold text-white capitalize">
                    Media {mediaData.platform}
                  </h3>
                  <p className="text-xs text-slate-400 truncate max-w-md">{url}</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-green-500/10 border border-green-500/30 text-green-400 text-xs rounded-full font-medium">
                Siap
              </span>
            </div>

            {mediaData.type === 'youtube' && (
              <div className="space-y-4">
                {mediaData.thumbnail && (
                  <div className="relative rounded-xl overflow-hidden aspect-video bg-black/40 border border-slate-700 max-w-md mx-auto">
                    <img
                      src={mediaData.thumbnail}
                      alt={mediaData.title || 'YouTube Thumbnail'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                {mediaData.title && (
                  <div className="text-center">
                    <h4 className="font-semibold text-white text-base">{mediaData.title}</h4>
                    {mediaData.author && (
                      <p className="text-sm text-slate-400">{mediaData.author}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {mediaData.type === 'direct' && mediaData.data && (
              <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-700/50 space-y-3">
                <h4 className="font-medium text-slate-200 text-sm">Hasil Direct Media:</h4>
                {mediaData.data.title && (
                  <p className="text-sm text-slate-300 font-semibold">{mediaData.data.title}</p>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  {(mediaData.data.downloadUrl || mediaData.data.url) && (
                    <a
                      href={mediaData.data.downloadUrl || mediaData.data.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Icon name="download" className="w-4 h-4" />
                      <span>Download Direct Media</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-300">
                Pilih Gateway Server Pengunduhan:
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(GATEWAYS[mediaData.platform] || GATEWAYS.generic).map((gw, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleOpenGateway(gw)}
                    className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between group ${
                      gw.primary
                        ? 'bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border-indigo-500/50 hover:border-indigo-400'
                        : 'bg-slate-900/50 border-slate-700/60 hover:border-slate-500'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">{gw.label}</span>
                        {gw.primary && (
                          <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] rounded font-bold uppercase">
                            Utama
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {gw.noParam
                          ? 'Buka server & tempel URL manual'
                          : 'Otomatis membawa URL saat diklik'}
                      </p>
                    </div>
                    <Icon
                      name="external-link"
                      className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
