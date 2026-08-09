// app/tools/image-compressor/page.js

'use client';

import { useEffect, useRef, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';
import Icon from '@/components/icons';

const MAX_UPLOAD = 25 * 1024 * 1024;

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ImageCompressorPage() {
  const { addToast } = useToast();
  const [source, setSource] = useState(null);
  const [format, setFormat] = useState('auto');
  const [quality, setQuality] = useState(0.8);
  const [maxWidth, setMaxWidth] = useState('0');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const urlsRef = useRef([]);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && !!navigator.canShare);
    return () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const track = (url) => {
    urlsRef.current.push(url);
    return url;
  };

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('File harus gambar', 'error');
      return;
    }
    if (file.size > MAX_UPLOAD) {
      addToast('Maksimal 25 MB', 'error');
      return;
    }

    setSource({ url: track(URL.createObjectURL(file)), file, size: file.size });
    setResult(null);
  };

  const emit = (blob, mime, width, height) => {
    setBusy(false);
    if (!blob) {
      addToast('Gagal kompres', 'error');
      return;
    }
    setResult({ url: track(URL.createObjectURL(blob)), blob, size: blob.size, mime, width, height });
    addToast('Foto berhasil dikompres', 'success');
  };

  const compress = () => {
    if (!source) return;
    setBusy(true);

    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const limit = Number(maxWidth);

      if (limit && width > limit) {
        const ratio = limit / width;
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      let mime = format;
      if (format === 'auto') {
        mime = source.file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
      }

      if (mime === 'image/png') {
        canvas.toBlob((blob) => emit(blob, mime, width, height), mime);
      } else {
        canvas.toBlob((blob) => emit(blob, mime, width, height), mime, quality);
      }
    };
    img.onerror = () => {
      setBusy(false);
      addToast('Gambar gagal dimuat', 'error');
    };
    img.src = source.url;
  };

  const saved =
    result && source ? Math.max(0, Math.round((1 - result.size / source.size) * 100)) : 0;

  const ext = result?.mime === 'image/webp' ? 'webp' : result?.mime === 'image/png' ? 'png' : 'jpg';

  const download = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = `kompres-${(source?.file?.name || 'foto').replace(/\.[^.]+$/, '')}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    addToast('Foto tersimpan', 'success');
  };

  const share = async () => {
    if (!result) return;
    const file = new File([result.blob], `kompres.${ext}`, { type: result.mime });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Foto terkompres' });
      } catch (err) {
        if (err?.name !== 'AbortError') addToast('Share dibatalkan', 'info');
      }
    } else {
      addToast('Browser gak dukung share, download aja', 'warning');
    }
  };

  return (
    <ToolShell
      title="Kompres Foto"
      desc="Perkecil ukuran foto langsung di browser, tanpa upload ke server."
      icon="image"
    >
      <div className="panel">
        <label className="dropzone" style={{ marginBottom: 15 }}>
          <Icon name="image" size={26} />
          <span>{source ? 'Ganti foto' : 'Pilih foto dari galeri'}</span>
          <input type="file" accept="image/*" onChange={pickFile} style={{ display: 'none' }} />
        </label>

        {source ? (
          <>
            <div className="field">
              <label className="label" htmlFor="comp-format">
                Format output
              </label>
              <select
                id="comp-format"
                className="select"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option value="auto">Auto (WebP kalau sumbernya WebP)</option>
                <option value="image/webp">WebP (paling hemat)</option>
                <option value="image/jpeg">JPEG</option>
                <option value="image/png">PNG (lossless)</option>
              </select>
            </div>

            <div className="field">
              <label className="label" htmlFor="comp-width">
                Lebar maksimal
              </label>
              <select
                id="comp-width"
                className="select"
                value={maxWidth}
                onChange={(e) => setMaxWidth(e.target.value)}
              >
                <option value="0">Asli (tanpa resize)</option>
                <option value="1920">1920px (Full HD)</option>
                <option value="1280">1280px (HD)</option>
                <option value="800">800px (sosmed)</option>
              </select>
            </div>

            {format !== 'image/png' ? (
              <div className="field">
                <label className="label">Kualitas: {Math.round(quality * 100)}%</label>
                <input
                  type="range"
                  min="0.3"
                  max="1"
                  step="0.05"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            ) : null}

            <button
              type="button"
              className="btn btn-primary btn-full"
              onClick={compress}
              disabled={busy}
            >
              {busy ? 'Mengompres...' : 'Kompres Foto'}
            </button>
          </>
        ) : null}

        {result ? (
          <div className="result">
            <div className="result-head">
              <span>
                Hasil · {result.width}×{result.height}
              </span>
            </div>

            <img
              src={result.url}
              alt="Hasil kompres"
              style={{
                width: '100%',
                maxHeight: 220,
                objectFit: 'contain',
                borderRadius: 10,
                marginBottom: 12,
                border: '1px solid var(--border)',
                background: 'rgba(0,0,0,0.25)',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-faint)', marginBottom: 5 }}>
              <span>Asli {formatBytes(source.size)}</span>
              <span>Hasil {formatBytes(result.size)}</span>
            </div>
            <div className="meter">
              <i
                style={{
                  width: `${Math.max(4, 100 - saved)}%`,
                  background: saved > 0 ? 'var(--accent)' : 'var(--warn)',
                }}
              />
            </div>
            <p className="hint">
              {saved > 0 ? `Hemat ${saved}% ukuran` : 'Hasil lebih besar dari asli (coba turunkan kualitas)'}
            </p>

            <div style={{ display: 'grid', gap: 9, marginTop: 12 }}>
              <button type="button" className="btn btn-primary btn-full" onClick={download}>
                <Icon name="download" size={16} /> Download
              </button>
              {canShare ? (
                <button type="button" className="btn btn-ghost btn-full" onClick={share}>
                  <Icon name="sparkles" size={16} /> Share
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </ToolShell>
  );
}
