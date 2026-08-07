'use client';

import { useEffect, useRef, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';

const MAX_UPLOAD = 25 * 1024 * 1024; // 25 MB

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function ImageCompressorPage() {
  const { addToast } = useToast();
  const [original, setOriginal] = useState(null); // { url, size, name, w, h }
  const [result, setResult] = useState(null); // { url, size, blob, w, h }
  const [quality, setQuality] = useState(70);
  const [maxWidth, setMaxWidth] = useState(1600);
  const [format, setFormat] = useState('image/jpeg');
  const [busy, setBusy] = useState(false);
  const urlsRef = useRef([]);

  useEffect(
    () => () => {
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    },
    []
  );

  const track = (url) => {
    urlsRef.current.push(url);
    return url;
  };

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast('File itu bukan gambar', 'error');
      return;
    }
    if (file.size > MAX_UPLOAD) {
      addToast('Gambar kegedean (maks 25 MB)', 'error');
      return;
    }

    const url = track(URL.createObjectURL(file));
    const img = new Image();
    img.onload = () => {
      setOriginal({ url, size: file.size, name: file.name, w: img.width, h: img.height });
      setResult(null);
    };
    img.onerror = () => addToast('Gambar gagal dibaca', 'error');
    img.src = url;
  };

  const compress = () => {
    if (!original) return;
    setBusy(true);

    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';

      // JPEG tidak punya alpha, isi putih dulu biar transparan tidak jadi hitam
      if (format === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          setBusy(false);
          if (!blob) {
            addToast('Gagal kompres', 'error');
            return;
          }
          setResult({ url: track(URL.createObjectURL(blob)), size: blob.size, blob, w, h });
          addToast('Selesai dikompres ✨', 'success');
        },
        format,
        quality / 100
      );
    };
    img.onerror = () => {
      setBusy(false);
      addToast('Gambar gagal dimuat', 'error');
    };
    img.src = original.url;
  };

  const download = () => {
    if (!result) return;
    const ext = format === 'image/webp' ? 'webp' : format === 'image/png' ? 'png' : 'jpg';
    const base = (original?.name || 'gambar').replace(/\.[^.]+$/, '');
    const a = document.createElement('a');
    a.href = result.url;
    a.download = `${base}-kompres.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    addToast('Tersimpan 📥', 'success');
  };

  const saved = original && result ? original.size - result.size : 0;
  const percent = original && result ? Math.round((saved / original.size) * 100) : 0;

  return (
    <ToolShell title="Kompres Foto" desc="Perkecil ukuran foto langsung di browser kamu." icon="🗜️">
      <div className="panel">
        <label className="dropzone" style={{ marginBottom: 15 }}>
          <span style={{ fontSize: 26 }} aria-hidden="true">
            📁
          </span>
          <span>{original ? 'Ganti foto' : 'Pilih foto dari galeri'}</span>
          <input type="file" accept="image/*" onChange={pickFile} style={{ display: 'none' }} />
        </label>

        {original ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 15 }}>
              <img
                src={original.url}
                alt="Foto asli"
                style={{ maxHeight: 200, borderRadius: 12, border: '1px solid var(--border)' }}
              />
              <p className="hint">
                {original.w}×{original.h} · {humanSize(original.size)}
              </p>
            </div>

            <div className="field">
              <label className="label" htmlFor="q">
                Kualitas: <strong style={{ color: 'var(--accent-soft)' }}>{quality}%</strong>
                {quality >= 85 ? ' (bagus, file besar)' : quality <= 45 ? ' (kecil, agak pecah)' : ' (seimbang)'}
              </label>
              <input
                id="q"
                type="range"
                min="10"
                max="100"
                step="5"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
                disabled={format === 'image/png'}
              />
              {format === 'image/png' ? (
                <p className="hint">PNG tidak pakai kualitas — kecilkan lewat lebar maksimum.</p>
              ) : null}
            </div>

            <div className="field">
              <label className="label" htmlFor="mw">
                Lebar maksimum: <strong style={{ color: 'var(--accent-soft)' }}>{maxWidth}px</strong>
              </label>
              <input
                id="mw"
                type="range"
                min="320"
                max="4000"
                step="80"
                value={maxWidth}
                onChange={(e) => setMaxWidth(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
            </div>

            <div className="field">
              <label className="label">Format hasil</label>
              <div className="btn-row">
                {[
                  { id: 'image/jpeg', label: 'JPEG' },
                  { id: 'image/webp', label: 'WebP' },
                  { id: 'image/png', label: 'PNG' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`btn btn-sm ${format === f.id ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setFormat(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-full"
              onClick={compress}
              disabled={busy}
            >
              {busy ? 'Memproses...' : 'Kompres Sekarang'}
            </button>
          </>
        ) : null}

        {result ? (
          <div className="result" style={{ textAlign: 'center' }}>
            <img
              src={result.url}
              alt="Hasil kompres"
              style={{ maxHeight: 200, borderRadius: 12, border: '1px solid var(--border)' }}
            />

            <div className="stat-row" style={{ marginTop: 14, marginBottom: 12 }}>
              <div className="stat">
                <b style={{ fontSize: 16 }}>{humanSize(original.size)}</b>
                <small>Sebelum</small>
              </div>
              <div className="stat">
                <b style={{ fontSize: 16, color: 'var(--accent-soft)' }}>{humanSize(result.size)}</b>
                <small>Sesudah</small>
              </div>
              <div className="stat">
                <b style={{ fontSize: 16, color: saved > 0 ? 'var(--accent-soft)' : 'var(--warn)' }}>
                  {saved > 0 ? `-${percent}%` : `+${Math.abs(percent)}%`}
                </b>
                <small>{saved > 0 ? 'Hemat' : 'Bertambah'}</small>
              </div>
            </div>

            {saved <= 0 ? (
              <p className="hint" style={{ marginTop: 0 }}>
                Hasilnya malah lebih besar. Turunkan kualitas atau lebar maksimumnya.
              </p>
            ) : null}

            <p className="hint" style={{ marginTop: 0 }}>
              Ukuran akhir: {result.w}×{result.h}
            </p>

            <button type="button" className="btn btn-primary btn-full" onClick={download}>
              📥 Download Hasil
            </button>
          </div>
        ) : null}
      </div>
    </ToolShell>
  );
}
