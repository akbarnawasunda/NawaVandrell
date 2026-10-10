'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ToolShell, { CopyButton } from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';
import Icon from '@/components/icons';
import { downloadText, downloadBlob } from '@/lib/fileDownload.mjs';
import {
  SUPPORTED_PLATFORMS,
  DOWNLOAD_MODES,
  AUDIO_FORMATS,
  AUDIO_QUALITIES,
  VIDEO_FORMATS,
  VIDEO_RESOLUTIONS,
  OTHER_FORMATS,
  FILENAME_TEMPLATES,
  QUICK_PRESETS,
  DEMO_SAMPLES,
  detectPlatform,
  isPlaylistUrl,
  parseMediaInput,
  sanitizeYtdlpOptions,
  validatePlaylistRange,
  sanitizeSafeFilename,
  buildYtdlpCommandString,
  buildYtdlpScript,
  buildM3u8Playlist,
  buildPlaylistCsv,
} from '@/lib/ytdlp.mjs';
import {
  resolveMediaInBrowser,
  fetchStreamBase64InBrowser,
} from '@/lib/ytdlpClientResolver.mjs';

const HISTORY_STORAGE_KEY = 'nawa:v1:ytdlp-history';

const DEFAULT_OPTIONS = {
  mode: 'audio',
  audioFormat: 'mp3',
  audioQuality: '0',
  videoFormat: 'mp4',
  videoResolution: '1080',
  otherFormat: 'subtitles',
  playlistMode: 'full',
  playlistRange: '',
  filenameTemplate: 'playlist_track',
  embedMetadata: true,
  embedThumbnail: true,
  embedSubtitles: false,
  sponsorBlock: false,
  splitChapters: false,
  ignoreErrors: true,
  geoBypass: true,
  subLangs: 'id,en',
  clipStart: '',
  clipEnd: '',
};

export default function DownloaderPage() {
  const { addToast } = useToast();

  // Status mesin server yt-dlp + FFmpeg
  const [runtimeInfo, setRuntimeInfo] = useState({
    loading: true,
    ready: false,
    ytdlpVersion: null,
    ffmpegAvailable: false,
    ffprobeAvailable: false,
    setupHint: null,
  });

  // Input & mode batch
  const [inputMode, setInputMode] = useState('single'); // 'single' | 'batch'
  const [urlInput, setUrlInput] = useState('');
  const [batchInput, setBatchInput] = useState('');
  const [activePreset, setActivePreset] = useState('lagu_mp3_320');
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // State hasil inspect & unduhan
  const [inspecting, setInspecting] = useState(false);
  const [mediaInfo, setMediaInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Pratinjau audio langsung di halaman
  const [playingTrack, setPlayingTrack] = useState(null);

  // Seleksi & antrean playlist
  const [selectedIndices, setSelectedIndices] = useState(() => new Set());
  const [trackFilter, setTrackFilter] = useState('');
  const [trackStatusMap, setTrackStatusMap] = useState({});
  const [downloadingMain, setDownloadingMain] = useState(false);
  const [queueRunning, setQueueRunning] = useState(false);
  const [queueProgress, setQueueProgress] = useState({ current: 0, total: 0, title: '' });
  const abortQueueRef = useRef(false);

  // Tab generator skrip lintas OS
  const [scriptOs, setScriptOs] = useState('bash');

  // Riwayat unduhan lokal
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let mounted = true;
    fetch('/api/ytdlp?action=status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (mounted) {
          setRuntimeInfo({ loading: false, ...(d?.runtime || {}) });
        }
      })
      .catch(() => {
        if (mounted) {
          setRuntimeInfo((prev) => ({ ...prev, loading: false }));
        }
      });

    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setHistory(parsed.slice(0, 12));
      }
    } catch {}

    return () => {
      mounted = false;
    };
  }, []);

  const saveToHistory = useCallback((entry) => {
    setHistory((prev) => {
      const filtered = prev.filter((item) => item.url !== entry.url);
      const next = [entry, ...filtered].slice(0, 12);
      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {}
    addToast('Riwayat unduhan dibersihkan', 'info');
  }, [addToast]);

  const effectiveRawInput = inputMode === 'batch' ? batchInput : urlInput;
  const parsedInput = useMemo(() => parseMediaInput(effectiveRawInput), [effectiveRawInput]);
  const detectedPlatform = useMemo(() => detectPlatform(effectiveRawInput), [effectiveRawInput]);
  const detectedPlaylist = useMemo(
    () =>
      inputMode === 'batch' ||
      isPlaylistUrl(effectiveRawInput) ||
      effectiveRawInput.trim().toLowerCase() === 'demo:playlist',
    [inputMode, effectiveRawInput]
  );

  const sanitizedOpts = useMemo(
    () => sanitizeYtdlpOptions({ ...options, url: effectiveRawInput }),
    [options, effectiveRawInput]
  );

  const rangeValidation = useMemo(
    () => validatePlaylistRange(options.playlistRange),
    [options.playlistRange]
  );

  const updateOption = useCallback((key, value) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
    setActivePreset('custom');
  }, []);

  const applyPreset = useCallback(
    (preset) => {
      setActivePreset(preset.id);
      setOptions((prev) => ({
        ...prev,
        ...preset.options,
      }));
      addToast(`Preset "${preset.title}" diterapkan`, 'info');
    },
    [addToast]
  );

  const cliCommand = useMemo(
    () =>
      buildYtdlpCommandString({
        ...options,
        url: effectiveRawInput || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }),
    [options, effectiveRawInput]
  );

  const generatedScript = useMemo(
    () =>
      buildYtdlpScript(
        {
          ...options,
          url: effectiveRawInput || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        },
        scriptOs
      ),
    [options, effectiveRawInput, scriptOs]
  );

  // Fungsi utama: Cek & Muat Media / Playlist
  const handleInspect = useCallback(
    async (overrideInput) => {
      const rawTarget = typeof overrideInput === 'string' ? overrideInput : effectiveRawInput;
      const parsed = parseMediaInput(rawTarget);
      if (!parsed.valid) {
        setErrorMsg(parsed.error || 'Masukkan link atau judul lagu terlebih dahulu.');
        addToast(parsed.error || 'Masukkan link terlebih dahulu', 'warning');
        return;
      }
      if (options.playlistMode === 'range' && !rangeValidation.valid) {
        setErrorMsg(rangeValidation.error);
        addToast(rangeValidation.error, 'error');
        return;
      }

      setInspecting(true);
      setErrorMsg('');
      setTrackStatusMap({});
      setPlayingTrack(null);

      try {
        const res = await fetch('/api/ytdlp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'inspect',
            url: rawTarget,
            options,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.status) {
          throw new Error(data.error || 'Gagal memeriksa media.');
        }

        let info = data.info;

        // Jika server kontainer dibatasi jaringan keluar, jalankan resolver sisi browser untuk mengambil daftar lagu/stream nyata
        if ((data.serverNetworkRestricted || data.engine === 'yt-dlp-hybrid') && parsed.kind !== 'demo') {
          const browserResolved = await resolveMediaInBrowser(rawTarget, info);
          if (browserResolved) {
            info = browserResolved;
          }
        }

        setMediaInfo(info);

        const allIdx = new Set((info.entries || []).map((e) => e.index));
        setSelectedIndices(allIdx);

        saveToHistory({
          url: rawTarget,
          title: info.title || rawTarget,
          uploader: info.uploader || '',
          isPlaylist: Boolean(info.isPlaylist),
          trackCount: info.trackCount || 1,
          timestamp: new Date().toISOString(),
        });

        addToast(
          info.isPlaylist
            ? `Playlist berhasil dimuat (${info.trackCount} item siap diunduh)!`
            : `Media "${info.title}" siap diunduh!`,
          'success'
        );
      } catch (err) {
        const msg = err.message || 'Gagal memuat informasi media.';
        setErrorMsg(msg);
        addToast(msg, 'error');
      } finally {
        setInspecting(false);
      }
    },
    [effectiveRawInput, options, rangeValidation, addToast, saveToHistory]
  );

  // Fungsi mengunduh & mengonversi lewat mesin yt-dlp + FFmpeg di server
  const triggerServerDownload = useCallback(
    async ({
      targetUrl,
      customTitle = '',
      customUploader = '',
      customAlbum = '',
      streamUrl = null,
      tracksMeta = null,
      bundleAsZip = false,
      playlistModeOverride = null,
    }) => {
      let clientStreamBase64 = null;
      let enrichedTracksMeta = tracksMeta;

      if (streamUrl && !bundleAsZip) {
        clientStreamBase64 = await fetchStreamBase64InBrowser(streamUrl);
      } else if (bundleAsZip && Array.isArray(tracksMeta) && tracksMeta.length > 0) {
        enrichedTracksMeta = await Promise.all(
          tracksMeta.map(async (tr, idx) => {
            if (idx < 6 && tr?.streamUrl && !tr.streamBase64) {
              const b64 = await fetchStreamBase64InBrowser(tr.streamUrl);
              return b64 ? { ...tr, streamBase64: b64 } : tr;
            }
            return tr;
          })
        );
      }

      const res = await fetch('/api/ytdlp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'download',
          ...options,
          url: targetUrl,
          playlistMode: playlistModeOverride || options.playlistMode,
          bundleAsZip,
          customTitle,
          customUploader,
          customAlbum,
          tracksMeta: enrichedTracksMeta,
          clientStreamBase64,
        }),
      });

      if (!res.ok) {
        let errText = 'Gagal mengunduh media.';
        try {
          const errJson = await res.json();
          errText = errJson.error || errText;
        } catch {}
        throw new Error(errText);
      }

      const blob = await res.blob();
      const headerName = res.headers.get('X-Ytdlp-Filename');
      const decodedName = headerName
        ? decodeURIComponent(headerName)
        : sanitizeSafeFilename(
            customTitle || 'nawa-ytdlp-media',
            'nawa-ytdlp-media',
            bundleAsZip
              ? 'zip'
              : options.mode === 'audio'
                ? options.audioFormat
                : options.videoFormat
          );

      downloadBlob(blob, decodedName);
      return { filename: decodedName, size: blob.size };
    },
    [options]
  );

  // Unduh utama (Single Media atau Full Playlist ZIP)
  const handleMainDownload = useCallback(
    async ({ asZip = false } = {}) => {
      const parsed = parseMediaInput(effectiveRawInput);
      if (!parsed.valid) {
        addToast(parsed.error || 'Masukkan link atau kata kunci dulu', 'warning');
        return;
      }

      setDownloadingMain(true);
      setErrorMsg('');
      try {
        // Bila user belum klik "Cek & Muat Media", periksa metadata otomatis terlebih dahulu
        let activeInfo = mediaInfo;
        if (!activeInfo || activeInfo.sourceUrl !== parsed.primaryUrl) {
          const inspectRes = await fetch('/api/ytdlp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'inspect',
              url: effectiveRawInput,
              options,
            }),
          });
          const inspectData = await inspectRes.json();
          if (inspectRes.ok && inspectData.status) {
            activeInfo = inspectData.info;
            if ((inspectData.serverNetworkRestricted || inspectData.engine === 'yt-dlp-hybrid') && parsed.kind !== 'demo') {
              const browserResolved = await resolveMediaInBrowser(effectiveRawInput, activeInfo);
              if (browserResolved) activeInfo = browserResolved;
            }
            setMediaInfo(activeInfo);
            setSelectedIndices(new Set((activeInfo.entries || []).map((e) => e.index)));
          }
        }

        const isMulti = Boolean(activeInfo?.isPlaylist && options.playlistMode !== 'single');
        const chosenEntries = activeInfo?.entries?.filter((e) => selectedIndices.has(e.index));
        const finalEntries =
          chosenEntries && chosenEntries.length > 0
            ? chosenEntries
            : activeInfo?.entries || [];

        const firstEntry = finalEntries[0] || null;

        const result = await triggerServerDownload({
          targetUrl: effectiveRawInput,
          customTitle: activeInfo?.title || firstEntry?.title || '',
          customUploader: activeInfo?.uploader || firstEntry?.uploader || '',
          customAlbum: firstEntry?.album || activeInfo?.title || '',
          streamUrl: !asZip && !isMulti ? firstEntry?.streamUrl || null : null,
          tracksMeta: asZip || isMulti ? finalEntries : firstEntry ? [firstEntry] : null,
          bundleAsZip: asZip || isMulti,
        });

        addToast(`Berhasil mengunduh: ${result.filename}`, 'success');
      } catch (err) {
        const msg = err.message || 'Gagal mengunduh media.';
        setErrorMsg(msg);
        addToast(msg, 'error');
      } finally {
        setDownloadingMain(false);
      }
    },
    [
      effectiveRawInput,
      mediaInfo,
      options,
      selectedIndices,
      triggerServerDownload,
      addToast,
    ]
  );

  // Unduh 1 track spesifik dari tabel playlist
  const handleDownloadSingleTrack = useCallback(
    async (entry) => {
      setTrackStatusMap((prev) => ({ ...prev, [entry.index]: 'downloading' }));
      try {
        const numPrefix = String(entry.index).padStart(2, '0');
        const customTitle = `${numPrefix} - ${entry.title}`;
        await triggerServerDownload({
          targetUrl: entry.url || effectiveRawInput,
          customTitle,
          customUploader: entry.uploader || mediaInfo?.uploader || '',
          customAlbum: entry.album || mediaInfo?.title || '',
          streamUrl: entry.streamUrl || null,
          tracksMeta: [entry],
          bundleAsZip: false,
          playlistModeOverride: 'single',
        });
        setTrackStatusMap((prev) => ({ ...prev, [entry.index]: 'done' }));
        addToast(`Track #${entry.index} "${entry.title}" berhasil diunduh`, 'success');
      } catch (err) {
        setTrackStatusMap((prev) => ({ ...prev, [entry.index]: 'error' }));
        addToast(`Gagal mengunduh track #${entry.index}: ${err.message}`, 'error');
      }
    },
    [effectiveRawInput, mediaInfo, triggerServerDownload, addToast]
  );

  // Antrean Unduh Berurutan Satu per Satu (Anti-Error Queue)
  const handleRunSequentialQueue = useCallback(async () => {
    if (!mediaInfo?.entries?.length) return;
    const queueEntries = mediaInfo.entries.filter((e) => selectedIndices.has(e.index));
    if (queueEntries.length === 0) {
      addToast('Pilih minimal 1 lagu/video dari daftar playlist terlebih dahulu', 'warning');
      return;
    }

    abortQueueRef.current = false;
    setQueueRunning(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < queueEntries.length; i += 1) {
      if (abortQueueRef.current) break;
      const entry = queueEntries[i];
      setQueueProgress({
        current: i + 1,
        total: queueEntries.length,
        title: entry.title,
      });
      setTrackStatusMap((prev) => ({ ...prev, [entry.index]: 'downloading' }));

      let trackSuccess = false;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const numPrefix = String(entry.index).padStart(2, '0');
          await triggerServerDownload({
            targetUrl: entry.url || effectiveRawInput,
            customTitle: `${numPrefix} - ${entry.title}`,
            customUploader: entry.uploader || mediaInfo?.uploader || '',
            customAlbum: entry.album || mediaInfo?.title || '',
            streamUrl: entry.streamUrl || null,
            tracksMeta: [entry],
            bundleAsZip: false,
            playlistModeOverride: 'single',
          });
          trackSuccess = true;
          break;
        } catch {
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 300));
          }
        }
      }

      if (trackSuccess) {
        successCount += 1;
        setTrackStatusMap((prev) => ({ ...prev, [entry.index]: 'done' }));
      } else {
        failCount += 1;
        setTrackStatusMap((prev) => ({ ...prev, [entry.index]: 'error' }));
        if (!options.ignoreErrors) {
          addToast(`Antrean dihentikan pada track #${entry.index}`, 'error');
          break;
        }
      }
    }

    setQueueRunning(false);
    setQueueProgress({ current: 0, total: 0, title: '' });
    if (successCount > 0) {
      addToast(
        `Antrean selesai: ${successCount} berhasil diunduh${failCount > 0 ? `, ${failCount} dilewati` : ''}!`,
        'success'
      );
    }
  }, [
    mediaInfo,
    selectedIndices,
    effectiveRawInput,
    options.ignoreErrors,
    triggerServerDownload,
    addToast,
  ]);

  const handleStopQueue = useCallback(() => {
    abortQueueRef.current = true;
    addToast('Menghentikan antrean setelah track aktif selesai...', 'info');
  }, [addToast]);

  const filteredEntries = useMemo(() => {
    if (!mediaInfo?.entries) return [];
    const q = trackFilter.trim().toLowerCase();
    if (!q) return mediaInfo.entries;
    return mediaInfo.entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.uploader.toLowerCase().includes(q) ||
        String(e.index).includes(q)
    );
  }, [mediaInfo, trackFilter]);

  const toggleSelectTrack = useCallback((idx) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const selectAllTracks = useCallback(() => {
    if (!mediaInfo?.entries) return;
    setSelectedIndices(new Set(mediaInfo.entries.map((e) => e.index)));
  }, [mediaInfo]);

  const clearTrackSelection = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  const invertTrackSelection = useCallback(() => {
    if (!mediaInfo?.entries) return;
    setSelectedIndices((prev) => {
      const next = new Set();
      for (const e of mediaInfo.entries) {
        if (!prev.has(e.index)) next.add(e.index);
      }
      return next;
    });
  }, [mediaInfo]);

  const handleExportM3u8 = useCallback(() => {
    if (!mediaInfo?.entries?.length) return;
    const chosen = mediaInfo.entries.filter((e) => selectedIndices.has(e.index));
    const list = chosen.length > 0 ? chosen : mediaInfo.entries;
    const ext = options.mode === 'audio' ? options.audioFormat : options.videoFormat;
    const content = buildM3u8Playlist(list, { ext });
    const fname = sanitizeSafeFilename(mediaInfo.title || 'daftar-putar', 'playlist', 'm3u8');
    downloadText(content, fname, 'audio/x-mpegurl; charset=utf-8');
    addToast(`File daftar putar ${fname} berhasil diunduh`, 'success');
  }, [mediaInfo, selectedIndices, options.mode, options.audioFormat, options.videoFormat, addToast]);

  const handleExportCsv = useCallback(() => {
    if (!mediaInfo?.entries?.length) return;
    const chosen = mediaInfo.entries.filter((e) => selectedIndices.has(e.index));
    const list = chosen.length > 0 ? chosen : mediaInfo.entries;
    const content = buildPlaylistCsv(list);
    const fname = sanitizeSafeFilename(mediaInfo.title || 'daftar-lagu', 'playlist', 'csv');
    downloadText(content, fname, 'text/csv; charset=utf-8');
    addToast(`Tabel daftar lagu ${fname} berhasil diunduh`, 'success');
  }, [mediaInfo, selectedIndices, addToast]);

  const handleDownloadScript = useCallback(() => {
    downloadText(generatedScript.content, generatedScript.filename, generatedScript.mime);
    addToast(`Skrip ${generatedScript.filename} berhasil diunduh`, 'success');
  }, [generatedScript, addToast]);

  const handleTxtUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        setInputMode('batch');
        setBatchInput(text);
        addToast(`Berhasil memuat daftar URL dari ${file.name}`, 'success');
      } catch {
        addToast('Gagal membaca file teks', 'error');
      } finally {
        e.target.value = '';
      }
    },
    [addToast]
  );

  const activeFormatBadge = useMemo(() => {
    if (sanitizedOpts.mode === 'audio') {
      const fmt = AUDIO_FORMATS.find((f) => f.id === sanitizedOpts.audioFormat);
      const q = AUDIO_QUALITIES.find((a) => a.id === sanitizedOpts.audioQuality);
      return `${fmt?.id.toUpperCase() || 'MP3'} • ${q?.bitrate || '320K'}`;
    }
    if (sanitizedOpts.mode === 'video') {
      const resLabel =
        sanitizedOpts.videoResolution === 'best' ? 'Max 4K' : `${sanitizedOpts.videoResolution}p`;
      return `${sanitizedOpts.videoFormat.toUpperCase()} • ${resLabel}`;
    }
    const other = OTHER_FORMATS.find((o) => o.id === sanitizedOpts.otherFormat);
    return other?.label || 'Lainnya';
  }, [sanitizedOpts]);

  return (
    <ToolShell
      title="All-In-One Downloader (yt-dlp Engine)"
      desc="Unduh lagu kualitas studio (MP3 320kbps, FLAC, M4A, WAV, OPUS), full playlist tanpa henti, video hingga 4K, subtitle, dan cover album."
      icon="download"
      className="nv-tool-wide"
    >
      <div className="nv-stack">
        {/* Status Mesin yt-dlp + FFmpeg */}
        <section className="nv-section" aria-label="Status Mesin yt-dlp">
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className={`nv-tag ${runtimeInfo.ready ? 'is-ok' : runtimeInfo.loading ? '' : 'is-warn'}`}>
                <Icon name={runtimeInfo.ready ? 'check' : runtimeInfo.loading ? 'clock' : 'warning'} size={13} />
                {runtimeInfo.loading
                  ? 'Memeriksa mesin server...'
                  : runtimeInfo.ready
                    ? `Mesin Server Aktif: yt-dlp v${runtimeInfo.ytdlpVersion || '?'}`
                    : 'Mode Terbantu yt-dlp (mesin server belum siap)'}
              </span>
              <span className={`nv-tag ${runtimeInfo.ffmpegAvailable ? 'is-ok' : ''}`}>
                <Icon name="music" size={13} />
                {runtimeInfo.ffmpegAvailable ? 'FFmpeg Audio/Video Muxer Siap' : 'FFmpeg Standar'}
              </span>
              <span className="nv-tag">
                <Icon name="repeat" size={13} />
                Anti-Error Playlist Aktif (--ignore-errors)
              </span>
            </div>
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
              Format aktif: <strong style={{ color: 'var(--accent-soft)' }}>{activeFormatBadge}</strong>
            </span>
          </div>

          {!runtimeInfo.loading && !runtimeInfo.ready && runtimeInfo.setupHint ? (
            <p className="hint" style={{ margin: 0 }}>
              {runtimeInfo.setupHint}
            </p>
          ) : null}

          {/* Preset Cepat 1-Klik */}
          <div>
            <p className="label" style={{ marginBottom: 8 }}>
              Pilih Cepat Preset Unduhan:
            </p>
            <div className="nv-grid-3">
              {QUICK_PRESETS.map((preset) => {
                const isSelected = activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="card"
                    style={{
                      textAlign: 'left',
                      cursor: 'pointer',
                      padding: 14,
                      borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                      background: isSelected ? 'var(--accent-ghost)' : 'var(--surface)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <strong
                        style={{
                          fontSize: 14,
                          color: isSelected ? 'var(--accent-soft)' : 'var(--text)',
                        }}
                      >
                        {preset.title}
                      </strong>
                      <span
                        className="card-tag"
                        style={{ marginTop: 0, fontSize: 10.5, padding: '2px 8px' }}
                      >
                        {preset.badge}
                      </span>
                    </div>
                    <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: 0 }}>
                      {preset.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Panel Input URL / Playlist / Pencarian Lagu / Batch */}
        <section className="nv-section" aria-label="Input Sumber Media">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div className="nv-chip-group" role="tablist" aria-label="Mode Input URL">
              <button
                type="button"
                className="chip"
                aria-pressed={inputMode === 'single'}
                onClick={() => setInputMode('single')}
              >
                <Icon name="link" size={14} /> Satu Link / Full Playlist / Cari Judul Lagu
              </button>
              <button
                type="button"
                className="chip"
                aria-pressed={inputMode === 'batch'}
                onClick={() => setInputMode('batch')}
              >
                <Icon name="fileText" size={14} /> Batch Banyak Link Sekaligus
              </button>
            </div>

            {detectedPlatform ? (
              <span className="nv-tag is-ok">
                <Icon name={detectedPlatform} size={14} />
                Sumber: {detectedPlatform.toUpperCase()}
                {detectedPlaylist ? ' • PLAYLIST / ALBUM' : ''}
              </span>
            ) : null}
          </div>

          {inputMode === 'single' ? (
            <div className="nv-field">
              <label className="label" htmlFor="ytdlp-url-input">
                Tempel Link (YouTube, Playlist, YT Music, SoundCloud, TikTok, IG, Spotify) atau Ketik Judul Lagu
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  id="ytdlp-url-input"
                  className="input"
                  style={{ flex: '1 1 320px' }}
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleInspect();
                    }
                  }}
                  placeholder="Contoh: https://www.youtube.com/playlist?list=... atau ketik: Hindia Evaluasi"
                  disabled={inspecting || downloadingMain}
                />
                {urlInput ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setUrlInput('');
                      setMediaInfo(null);
                      setErrorMsg('');
                      setPlayingTrack(null);
                    }}
                    title="Bersihkan input"
                  >
                    <Icon name="close" size={16} />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleInspect()}
                  disabled={inspecting || downloadingMain}
                >
                  <Icon name="search" size={16} />
                  {inspecting ? 'Memeriksa Media...' : 'Cek & Muat Media'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => handleMainDownload({ asZip: detectedPlaylist })}
                  disabled={inspecting || downloadingMain || !urlInput.trim()}
                >
                  <Icon name="download" size={16} />
                  {downloadingMain ? 'Mengunduh...' : 'Unduh Langsung'}
                </button>
              </div>
            </div>
          ) : (
            <div className="nv-field">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <label className="label" htmlFor="ytdlp-batch-input">
                  Tempel Banyak Link atau Judul Lagu (Satu Baris Satu Target — Maks 200 Item)
                </label>
                <label className="btn btn-ghost btn-sm nv-file-button">
                  <Icon name="upload" size={14} /> Impor Daftar .TXT
                  <input type="file" accept=".txt,text/plain" onChange={handleTxtUpload} />
                </label>
              </div>
              <textarea
                id="ytdlp-batch-input"
                className="textarea mono"
                rows={5}
                value={batchInput}
                onChange={(e) => {
                  setBatchInput(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder={
                  'https://www.youtube.com/watch?v=...\nhttps://soundcloud.com/...\nSheila On 7 Dan\nTulus Hati-Hati di Jalan'
                }
                disabled={inspecting || downloadingMain}
              />
              <div className="nv-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleInspect()}
                  disabled={inspecting || downloadingMain}
                >
                  <Icon name="search" size={16} />
                  {inspecting
                    ? 'Memuat Antrean Batch...'
                    : `Muat Antrean Batch (${parsedInput.items.length} Item)`}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => handleMainDownload({ asZip: true })}
                  disabled={inspecting || downloadingMain || parsedInput.items.length === 0}
                >
                  <Icon name="download" size={16} />
                  Unduh Semua Sekaligus (.ZIP)
                </button>
                {batchInput ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setBatchInput('');
                      setMediaInfo(null);
                      setErrorMsg('');
                    }}
                  >
                    Bersihkan Daftar
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {/* Tombol Demo Bawaan & Contoh Pencarian Cepat */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <span className="label" style={{ margin: 0 }}>
                Uji Coba Instan (1-Klik Playlist, Lagu & Video):
              </span>
              <span className="hint" style={{ margin: 0 }}>
                Klik salah satu untuk langsung menguji ekstraksi lagu MP3/FLAC, video MP4, atau Full Playlist ZIP
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {DEMO_SAMPLES.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={inspecting || downloadingMain}
                  onClick={() => {
                    setInputMode('single');
                    setUrlInput(sample.url);
                    if (sample.type === 'playlist') {
                      setOptions((prev) => ({
                        ...prev,
                        playlistMode: 'full',
                        mode: 'audio',
                        audioFormat: 'mp3',
                      }));
                    } else if (sample.id === 'demo:video') {
                      setOptions((prev) => ({
                        ...prev,
                        mode: 'video',
                        videoFormat: 'mp4',
                        videoResolution: '720',
                      }));
                    }
                    handleInspect(sample.url);
                  }}
                >
                  <Icon name={sample.type === 'playlist' ? 'music' : 'download'} size={14} />
                  {sample.label}
                </button>
              ))}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={inspecting || downloadingMain}
                onClick={() => {
                  const q = 'Hindia Evaluasi';
                  setInputMode('single');
                  setUrlInput(q);
                  setOptions((prev) => ({ ...prev, mode: 'audio', audioFormat: 'mp3' }));
                  handleInspect(q);
                }}
              >
                <Icon name="search" size={14} />
                Cari Lagu: Hindia Evaluasi
              </button>
            </div>
          </div>

          {/* Badge Platform yang Didukung */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SUPPORTED_PLATFORMS.map((p) => {
              const active = detectedPlatform === p.id;
              return (
                <span
                  key={p.id}
                  className={`nv-tag ${active ? 'is-ok' : ''}`}
                  style={{ fontSize: 11.5 }}
                >
                  <Icon name={p.icon} size={13} />
                  {p.name}
                </span>
              );
            })}
          </div>
        </section>

        {/* Pengaturan Format, Kualitas, Playlist, dan Fitur Lanjutan yt-dlp */}
        <section className="nv-section" aria-label="Pengaturan Format dan Kualitas">
          <div className="nv-section-head">
            <h2>Pengaturan Format, Kualitas & Playlist</h2>
            <p className="nv-section-desc">
              Pilih jenis output (Lagu/Audio, Video HD/4K, atau Subtitle/Cover) serta atur penanganan playlist.
            </p>
          </div>

          <div className="nv-grid-3" role="radiogroup" aria-label="Kategori Unduhan">
            {DOWNLOAD_MODES.map((m) => {
              const active = options.mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => updateOption('mode', m.id)}
                  className="card"
                  style={{
                    textAlign: 'left',
                    cursor: 'pointer',
                    padding: 14,
                    borderColor: active ? 'var(--accent)' : 'var(--border)',
                    background: active ? 'var(--accent-ghost)' : 'var(--field)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Icon name={m.icon} size={18} />
                    <strong style={{ fontSize: 15, color: active ? 'var(--accent-soft)' : 'var(--text)' }}>
                      {m.label}
                    </strong>
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: 0 }}>{m.desc}</p>
                </button>
              );
            })}
          </div>

          {options.mode === 'audio' ? (
            <div className="nv-grid-2">
              <div className="nv-field">
                <label className="label" htmlFor="ytdlp-audio-format">
                  Format File Musik / Lagu
                </label>
                <select
                  id="ytdlp-audio-format"
                  className="select"
                  value={options.audioFormat}
                  onChange={(e) => updateOption('audioFormat', e.target.value)}
                >
                  {AUDIO_FORMATS.map((fmt) => (
                    <option key={fmt.id} value={fmt.id}>
                      {fmt.label} — {fmt.desc}
                    </option>
                  ))}
                </select>
              </div>

              <div className="nv-field">
                <label className="label" htmlFor="ytdlp-audio-quality">
                  Kualitas Audio / Bitrate
                </label>
                <select
                  id="ytdlp-audio-quality"
                  className="select"
                  value={options.audioQuality}
                  onChange={(e) => updateOption('audioQuality', e.target.value)}
                >
                  {AUDIO_QUALITIES.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          {options.mode === 'video' ? (
            <div className="nv-grid-2">
              <div className="nv-field">
                <label className="label" htmlFor="ytdlp-video-format">
                  Format Kontainer Video
                </label>
                <select
                  id="ytdlp-video-format"
                  className="select"
                  value={options.videoFormat}
                  onChange={(e) => updateOption('videoFormat', e.target.value)}
                >
                  {VIDEO_FORMATS.map((fmt) => (
                    <option key={fmt.id} value={fmt.id}>
                      {fmt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="nv-field">
                <label className="label" htmlFor="ytdlp-video-res">
                  Resolusi Video Maksimal
                </label>
                <select
                  id="ytdlp-video-res"
                  className="select"
                  value={options.videoResolution}
                  onChange={(e) => updateOption('videoResolution', e.target.value)}
                >
                  {VIDEO_RESOLUTIONS.map((res) => (
                    <option key={res.id} value={res.id}>
                      {res.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          {options.mode === 'other' ? (
            <div className="nv-grid-2">
              <div className="nv-field">
                <label className="label" htmlFor="ytdlp-other-format">
                  Jenis Ekstraksi Khusus
                </label>
                <select
                  id="ytdlp-other-format"
                  className="select"
                  value={options.otherFormat}
                  onChange={(e) => updateOption('otherFormat', e.target.value)}
                >
                  {OTHER_FORMATS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="nv-field">
                <label className="label" htmlFor="ytdlp-sub-langs">
                  Kode Bahasa Subtitle / Lirik
                </label>
                <input
                  id="ytdlp-sub-langs"
                  className="input"
                  value={options.subLangs}
                  onChange={(e) => updateOption('subLangs', e.target.value)}
                  placeholder="id,en"
                />
                <p className="hint">Pisahkan dengan koma, contoh: id,en,ja,ko atau all</p>
              </div>
            </div>
          ) : null}

          <div className="nv-grid-3">
            <div className="nv-field">
              <label className="label" htmlFor="ytdlp-playlist-mode">
                Mode Penanganan Playlist
              </label>
              <select
                id="ytdlp-playlist-mode"
                className="select"
                value={options.playlistMode}
                onChange={(e) => updateOption('playlistMode', e.target.value)}
              >
                <option value="full">Full Playlist (Semua Lagu / Video)</option>
                <option value="range">Pilih Rentang Nomor Track Tertentu</option>
                <option value="single">Hanya 1 Lagu/Video Ini (--no-playlist)</option>
              </select>
            </div>

            {options.playlistMode === 'range' ? (
              <div className="nv-field">
                <label className="label" htmlFor="ytdlp-playlist-range">
                  Rentang Nomor Urut Playlist
                </label>
                <input
                  id="ytdlp-playlist-range"
                  className="input mono"
                  value={options.playlistRange}
                  onChange={(e) => updateOption('playlistRange', e.target.value)}
                  placeholder="Contoh: 1-15 atau 1,3,5-10"
                />
                {!rangeValidation.valid ? (
                  <p className="nv-error">{rangeValidation.error}</p>
                ) : (
                  <p className="hint">Contoh: 1-20 untuk mengunduh lagu nomor 1 sampai 20</p>
                )}
              </div>
            ) : (
              <div className="nv-field">
                <label className="label" htmlFor="ytdlp-filename-tpl">
                  Pola Penamaan File Output
                </label>
                <select
                  id="ytdlp-filename-tpl"
                  className="select"
                  value={options.filenameTemplate}
                  onChange={(e) => updateOption('filenameTemplate', e.target.value)}
                >
                  {FILENAME_TEMPLATES.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="nv-field" style={{ justifyContent: 'end' }}>
              <button
                type="button"
                className="btn btn-ghost btn-full"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                <Icon name="sliders" size={16} />
                {showAdvanced ? 'Sembunyikan Opsi Lanjutan' : 'Opsi Lanjutan & Potong Durasi'}
              </button>
            </div>
          </div>

          {showAdvanced ? (
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                background: 'var(--field)',
                border: '1px solid var(--border)',
                display: 'grid',
                gap: 14,
              }}
            >
              <div className="nv-grid-2">
                <label className="sim-checkbox">
                  <input
                    type="checkbox"
                    checked={options.embedMetadata}
                    onChange={(e) => updateOption('embedMetadata', e.target.checked)}
                  />
                  <span>Tanamkan Tag Metadata ID3 (Judul, Artis, Album, Nomor Track)</span>
                </label>

                <label className="sim-checkbox">
                  <input
                    type="checkbox"
                    checked={options.embedThumbnail}
                    onChange={(e) => updateOption('embedThumbnail', e.target.checked)}
                  />
                  <span>Tanamkan Gambar Cover Album / Thumbnail ke File Musik</span>
                </label>

                <label className="sim-checkbox">
                  <input
                    type="checkbox"
                    checked={options.ignoreErrors}
                    onChange={(e) => updateOption('ignoreErrors', e.target.checked)}
                  />
                  <span>Anti-Error Playlist: Lewati otomatis lagu privat/rusak tanpa berhenti</span>
                </label>

                <label className="sim-checkbox">
                  <input
                    type="checkbox"
                    checked={options.sponsorBlock}
                    onChange={(e) => updateOption('sponsorBlock', e.target.checked)}
                  />
                  <span>SponsorBlock: Hapus bagian intro/outro non-musik & sponsor otomatis</span>
                </label>

                {options.mode === 'video' ? (
                  <label className="sim-checkbox">
                    <input
                      type="checkbox"
                      checked={options.embedSubtitles}
                      onChange={(e) => updateOption('embedSubtitles', e.target.checked)}
                    />
                    <span>Tanamkan Subtitle Bahasa Indonesia & Inggris ke dalam Video</span>
                  </label>
                ) : null}

                <label className="sim-checkbox">
                  <input
                    type="checkbox"
                    checked={options.splitChapters}
                    onChange={(e) => updateOption('splitChapters', e.target.checked)}
                  />
                  <span>Pisahkan Video Kompilasi Panjang Menjadi File per Chapter</span>
                </label>
              </div>

              <div className="nv-grid-2" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div className="nv-field">
                  <label className="label" htmlFor="ytdlp-clip-start">
                    Potong Durasi Mulai (Opsional — MM:SS atau HH:MM:SS)
                  </label>
                  <input
                    id="ytdlp-clip-start"
                    className="input mono"
                    value={options.clipStart}
                    onChange={(e) => updateOption('clipStart', e.target.value)}
                    placeholder="Contoh: 00:15"
                  />
                </div>
                <div className="nv-field">
                  <label className="label" htmlFor="ytdlp-clip-end">
                    Potong Durasi Selesai (Opsional — MM:SS atau HH:MM:SS)
                  </label>
                  <input
                    id="ytdlp-clip-end"
                    className="input mono"
                    value={options.clipEnd}
                    onChange={(e) => updateOption('clipEnd', e.target.value)}
                    placeholder="Contoh: 03:45"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {errorMsg ? (
          <div className="nv-notice is-bad" role="alert">
            <strong>
              <Icon name="warning" size={16} /> Perhatian
            </strong>
            <div className="nv-notice-body">{errorMsg}</div>
          </div>
        ) : null}

        {/* Hasil Pemeriksaan Media & Manajer Full Playlist */}
        {mediaInfo ? (
          <section className="nv-section" aria-label="Hasil Media dan Daftar Putar">
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {mediaInfo.thumbnail ? (
                <img
                  src={mediaInfo.thumbnail}
                  alt={mediaInfo.title}
                  style={{
                    width: 112,
                    height: 112,
                    objectFit: 'cover',
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                    flexShrink: 0,
                  }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}

              <div style={{ flex: 1, minWidth: 220, display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <span className="nv-tag is-ok">
                    {mediaInfo.isPlaylist ? `PLAYLIST (${mediaInfo.trackCount} ITEM)` : 'MEDIA TUNGGAL'}
                  </span>
                  <span className="nv-tag">{mediaInfo.extractor}</span>
                  {mediaInfo.totalDurationText && mediaInfo.totalDurationText !== '—' ? (
                    <span className="nv-tag">
                      <Icon name="clock" size={12} /> Total: {mediaInfo.totalDurationText}
                    </span>
                  ) : null}
                </div>

                <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{mediaInfo.title}</h2>
                <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 14 }}>
                  Channel / Artis: <strong>{mediaInfo.uploader}</strong>
                </p>

                {mediaInfo.availableQualities?.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    <span className="hint" style={{ margin: 0 }}>
                      Kualitas tersedia:
                    </span>
                    {mediaInfo.availableQualities.slice(0, 6).map((q) => (
                      <span key={q.height} className="nv-tag" style={{ fontSize: 11 }}>
                        {q.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Pemutar Pratinjau Audio/Video Langsung */}
            {playingTrack?.streamUrl ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: 'var(--field)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ minWidth: 180 }}>
                  <small className="mono" style={{ color: 'var(--accent-soft)', fontWeight: 700 }}>
                    PRATINJAU LANGSUNG
                  </small>
                  <strong style={{ display: 'block', fontSize: 14 }}>
                    {playingTrack.title} — {playingTrack.uploader}
                  </strong>
                </div>
                <audio
                  controls
                  autoPlay
                  src={playingTrack.streamUrl}
                  style={{ flex: '1 1 260px', height: 38 }}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPlayingTrack(null)}
                >
                  Tutup
                </button>
              </div>
            ) : null}

            {/* Tombol Aksi Unduh Utama */}
            <div className="nv-actions" style={{ paddingTop: 6, borderTop: '1px solid var(--border)' }}>
              {mediaInfo.isPlaylist && mediaInfo.entries?.length > 1 ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={downloadingMain || queueRunning}
                    onClick={() => handleMainDownload({ asZip: true })}
                  >
                    <Icon name="download" size={16} />
                    {downloadingMain
                      ? 'Mengonversi & Mengemas ZIP...'
                      : `Unduh Full Playlist Sekaligus (.ZIP — ${
                          selectedIndices.size || mediaInfo.trackCount
                        } Item)`}
                  </button>

                  {!queueRunning ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={downloadingMain || selectedIndices.size === 0}
                      onClick={handleRunSequentialQueue}
                    >
                      <Icon name="repeat" size={16} />
                      Unduh Berurutan Satu per Satu ({selectedIndices.size} Item)
                    </button>
                  ) : (
                    <button type="button" className="btn btn-danger" onClick={handleStopQueue}>
                      <Icon name="close" size={16} />
                      Hentikan Antrean ({queueProgress.current}/{queueProgress.total})
                    </button>
                  )}

                  <button type="button" className="btn btn-ghost btn-sm" onClick={handleExportM3u8}>
                    <Icon name="music" size={14} /> Ekspor .M3U8
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={handleExportCsv}>
                    <Icon name="fileText" size={14} /> Ekspor .CSV
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={downloadingMain}
                    onClick={() => handleMainDownload({ asZip: false })}
                  >
                    <Icon name="download" size={16} />
                    {downloadingMain
                      ? 'Memproses dengan yt-dlp + FFmpeg...'
                      : `Unduh Sekarang (${activeFormatBadge})`}
                  </button>

                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={downloadingMain}
                    onClick={() => handleMainDownload({ asZip: true })}
                  >
                    <Icon name="file" size={16} />
                    Unduh Paket Arsip (.ZIP + Metadata + .M3U8)
                  </button>
                </>
              )}
            </div>

            {/* Progress Bar Antrean Playlist Berurutan */}
            {queueRunning ? (
              <div className="nv-notice is-info">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <strong>
                    Mengunduh Antrean Playlist ({queueProgress.current} dari {queueProgress.total})
                  </strong>
                  <span className="mono" style={{ fontSize: 12 }}>
                    {Math.round((queueProgress.current / Math.max(1, queueProgress.total)) * 100)}%
                  </span>
                </div>
                <div className="nv-bar">
                  <i
                    style={{
                      width: `${Math.round(
                        (queueProgress.current / Math.max(1, queueProgress.total)) * 100
                      )}%`,
                    }}
                  />
                </div>
                <div className="nv-notice-body">
                  Sedang memproses: <strong>{queueProgress.title}</strong>
                </div>
              </div>
            ) : null}

            {/* Tabel Daftar Lagu / Video dalam Playlist */}
            {mediaInfo.entries?.length > 0 ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="label" style={{ margin: 0 }}>
                      Daftar Track ({selectedIndices.size} dari {mediaInfo.entries.length} dipilih)
                    </span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={selectAllTracks}>
                      Pilih Semua
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={clearTrackSelection}
                    >
                      Kosongkan
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={invertTrackSelection}
                    >
                      Balik Pilihan
                    </button>
                  </div>

                  {mediaInfo.entries.length > 1 ? (
                    <input
                      className="input"
                      style={{ maxWidth: 260, height: 38, fontSize: 13.5 }}
                      value={trackFilter}
                      onChange={(e) => setTrackFilter(e.target.value)}
                      placeholder="Cari judul lagu di playlist..."
                    />
                  ) : null}
                </div>

                <div className="nv-table-wrap" tabIndex={0} role="region" aria-label="Tabel Daftar Lagu Playlist">
                  <table className="nv-table">
                    <thead>
                      <tr>
                        <th style={{ width: 42 }}>Pilih</th>
                        <th style={{ width: 48 }}>#</th>
                        <th>Judul Lagu / Video</th>
                        <th>Artis / Channel</th>
                        <th className="is-num">Durasi</th>
                        <th>Status</th>
                        <th className="is-num">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((entry) => {
                        const checked = selectedIndices.has(entry.index);
                        const st = trackStatusMap[entry.index] || 'idle';
                        return (
                          <tr key={`${entry.index}-${entry.id}`}>
                            <td>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSelectTrack(entry.index)}
                                aria-label={`Pilih track ${entry.title}`}
                              />
                            </td>
                            <td className="mono">{String(entry.index).padStart(2, '0')}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {entry.thumbnail ? (
                                  <img
                                    src={entry.thumbnail}
                                    alt=""
                                    style={{
                                      width: 38,
                                      height: 38,
                                      borderRadius: 8,
                                      objectFit: 'cover',
                                      flexShrink: 0,
                                    }}
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                ) : null}
                                <div>
                                  <strong style={{ display: 'block', fontSize: 14 }}>
                                    {entry.title}
                                  </strong>
                                  {entry.album ? (
                                    <small style={{ color: 'var(--text-faint)', fontSize: 12 }}>
                                      {entry.album}
                                    </small>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td>{entry.uploader}</td>
                            <td className="is-num mono">{entry.durationText}</td>
                            <td>
                              {st === 'done' ? (
                                <span className="nv-tag is-ok">Selesai ✓</span>
                              ) : st === 'downloading' ? (
                                <span className="nv-tag is-warn">Mengunduh...</span>
                              ) : st === 'error' ? (
                                <span className="nv-tag is-bad">Gagal</span>
                              ) : (
                                <span className="nv-tag">Siap</span>
                              )}
                            </td>
                            <td className="is-num">
                              <div
                                style={{
                                  display: 'inline-flex',
                                  gap: 6,
                                  justifyContent: 'flex-end',
                                }}
                              >
                                {entry.streamUrl ? (
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => setPlayingTrack(entry)}
                                    title="Putar pratinjau audio"
                                  >
                                    <Icon name="volumeOn" size={14} />
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  disabled={st === 'downloading' || downloadingMain}
                                  onClick={() => handleDownloadSingleTrack(entry)}
                                >
                                  <Icon name="download" size={14} />
                                  {options.mode === 'audio'
                                    ? options.audioFormat.toUpperCase()
                                    : options.videoFormat.toUpperCase()}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Generator Perintah CLI & Skrip Otomatis yt-dlp */}
        <section className="nv-section" aria-label="Generator Perintah dan Skrip Otomatis yt-dlp">
          <div className="nv-section-head">
            <h2>Perintah Terminal & Skrip Otomatis yt-dlp (PC / Laptop / Android Termux)</h2>
            <p className="nv-section-desc">
              Untuk mengunduh playlist ratusan lagu atau video 4K berukuran besar langsung di perangkatmu tanpa batas server,
              salin perintah di bawah atau unduh skrip siap jalan yang otomatis menginstal serta menjalankan{' '}
              <code>yt-dlp</code>.
            </p>
          </div>

          <div className="result" style={{ marginTop: 0 }}>
            <div className="result-head">
              <span>Perintah Satu Baris yt-dlp (Otomatis Disesuaikan)</span>
              <div className="result-actions">
                <CopyButton value={cliCommand} label="Salin Perintah" />
              </div>
            </div>
            <pre>{cliCommand}</pre>
          </div>

          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 10,
              }}
            >
              <div className="nv-chip-group" role="tablist" aria-label="Pilih Sistem Operasi Skrip">
                {[
                  { id: 'bash', label: 'Linux / macOS / Termux (.SH)' },
                  { id: 'bat', label: 'Windows CMD (.BAT)' },
                  { id: 'ps1', label: 'Windows PowerShell (.PS1)' },
                  { id: 'python', label: 'Skrip Python 3 (.PY)' },
                ].map((osTab) => (
                  <button
                    key={osTab.id}
                    type="button"
                    className="chip"
                    aria-pressed={scriptOs === osTab.id}
                    onClick={() => setScriptOs(osTab.id)}
                  >
                    {osTab.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <CopyButton value={generatedScript.content} label="Salin Skrip" />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleDownloadScript}
                >
                  <Icon name="download" size={14} /> Unduh {generatedScript.filename}
                </button>
              </div>
            </div>

            <div className="result" style={{ marginTop: 0 }}>
              <div className="result-head">
                <span>Pratinjau Skrip: {generatedScript.filename}</span>
              </div>
              <pre style={{ maxHeight: 220, overflowY: 'auto' }}>{generatedScript.content}</pre>
            </div>
          </div>
        </section>

        {/* Riwayat Unduhan Lokal */}
        {history.length > 0 ? (
          <section className="nv-section" aria-label="Riwayat Unduhan Lokal">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <h2 style={{ fontSize: 17, fontWeight: 780, margin: 0 }}>
                Riwayat Pemeriksaan & Unduhan Terakhir
              </h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearHistory}>
                <Icon name="trash" size={14} /> Hapus Riwayat
              </button>
            </div>
            <div className="nv-grid-2">
              {history.map((item) => (
                <div
                  key={item.url}
                  className="card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: 12,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong
                      style={{
                        display: 'block',
                        fontSize: 13.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.title}
                    </strong>
                    <small style={{ color: 'var(--text-faint)', fontSize: 12 }}>
                      {item.isPlaylist ? `Playlist (${item.trackCount} item)` : 'Media Tunggal'} •{' '}
                      {item.uploader || item.url}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setInputMode('single');
                      setUrlInput(item.url);
                      handleInspect(item.url);
                    }}
                  >
                    Muat Ulang
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </ToolShell>
  );
}
