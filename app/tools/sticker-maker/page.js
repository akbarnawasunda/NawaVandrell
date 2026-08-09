'use client';

import { useEffect, useRef, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';
import Icon from '@/components/icons';

const SIZE = 512;
const MAX_UPLOAD = 25 * 1024 * 1024;

const BACKGROUNDS = [
  { id: 'transparent', label: 'Transparan' },
  { id: 'white', label: 'Putih' },
  { id: 'accent', label: 'Emerald' },
];

export default function StickerMakerPage() {
  const { addToast } = useToast();
  const [source, setSource] = useState(null);
  const [sticker, setSticker] = useState(null);
  const [author, setAuthor] = useState('');
  const [background, setBackground] = useState('transparent');
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
      addToast('File itu bukan gambar', 'error');
      return;
    }
    if (file.size > MAX_UPLOAD) {
      addToast('Gambar kegedean (maks 25 MB)', 'error');
      return;
    }

    setSource(track(URL.createObjectURL(file)));
    setSticker(null);
  };

  const build = () => {
    if (!source) return;
    setBusy(true);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');

      if (background === 'white') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, SIZE, SIZE);
      } else if (background === 'accent') {
        const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
        grad.addColorStop(0, '#34d399');
        grad.addColorStop(1, '#059669');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, SIZE, SIZE);
      }

      const pad = 16;
      const box = SIZE - pad * 2;
      const ratio = img.width / img.height;
      let w = box;
      let h = box;
      if (ratio > 1) h = box / ratio;
      else w = box * ratio;

      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, pad + (box - w) / 2, pad + (box - h) / 2, w, h);

      const name = author.trim().slice(0, 24);
      if (name) {
        const barH = 52;
        ctx.fillStyle = 'rgba(0,0,0,0.62)';
        ctx.fillRect(0, SIZE - barH, SIZE, barH);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px "Plus Jakarta Sans", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, SIZE / 2, SIZE - barH / 2, SIZE - 32);
      }

      const emit = (blob, type) => {
        setBusy(false);
        if (!blob) {
          addToast('Gagal bikin stiker', 'error');
          return;
        }
        setSticker({ url: track(URL.createObjectURL(blob)), blob, size: blob.size, type });
        addToast('Stiker siap', 'success');
      };

      canvas.toBlob(
        (blob) => {
          if (blob && blob.type === 'image/webp') emit(blob, 'image/webp');
          else canvas.toBlob((png) => emit(png, 'image/png'), 'image/png');
        },
        'image/webp',
        0.92
      );
    };
    img.onerror = () => {
      setBusy(false);
      addToast('Gambar gagal dimuat', 'error');
    };
    img.src = source;
  };

  const filename = () => {
    const base = author.trim().replace(/[^\w-]+/g, '_') || 'sticker';
    return `${base}.${sticker?.type === 'image/webp' ? 'webp' : 'png'}`;
  };

  const download = () => {
    if (!sticker) return;
    const a = document.createElement('a');
    a.href = sticker.url;
    a.download = filename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    addToast('Stiker tersimpan', 'success');
  };

  const share = async () => {
    if (!sticker) return;
    const file = new File([sticker.blob], filename(), { type: sticker.type });

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Stiker WhatsApp',
          text: author.trim() ? `Stiker buatan ${author.trim()}` : 'Stiker dari NawaVandrell',
        });
      } catch (err) {
        if (err?.name !== 'AbortError') addToast('Share dibatalkan', 'info');
      }
    } else {
      addToast('HP/browser ini gak dukung share. Download aja ya.', 'warning');
    }
  };

  return (
    <ToolShell
      title="Bikin Stiker WA"
      desc="Foto jadi stiker WhatsApp 512×512, bisa langsung dikirim."
      icon="sticker"
    >
      <div className="panel">
        <div className="field">
          <label className="label" htmlFor="st-name">
            Nama pembuat (opsional)
          </label>
          <input
            id="st-name"
            className="input"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Contoh: Akbar"
            maxLength={24}
          />
        </div>

        <label className="dropzone" style={{ marginBottom: 15 }}>
          <Icon name="image" size={26} />
          <span>{source ? 'Ganti foto' : 'Pilih foto dari galeri'}</span>
          <input type="file" accept="image/*" onChange={pickFile} style={{ display: 'none' }} />
        </label>

        {source ? (
          <>
            <div className="field">
              <label className="label">Latar belakang</label>
              <div className="btn-row">
                {BACKGROUNDS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`btn btn-sm ${background === b.id ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setBackground(b.id)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 15 }}>
              <img
                src={source}
                alt="Foto asli"
                style={{ maxHeight: 170, borderRadius: 12, border: '1px solid var(--border)' }}
              />
            </div>

            <button type="button" className="btn btn-primary btn-full" onClick={build} disabled={busy}>
              {busy ? 'Memproses...' : (
                <>
                  <Icon name="sparkles" size={16} />
                  Jadikan Stiker
                </>
              )}
            </button>
          </>
        ) : null}

        {sticker ? (
          <div className="result" style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-faint)' }}>
              512×512 · {(sticker.size / 1024).toFixed(0)} KB ·{' '}
              {sticker.type === 'image/webp' ? 'WebP' : 'PNG'}
            </p>
            <img
              src={sticker.url}
              alt="Hasil stiker"
              style={{
                width: 180,
                height: 180,
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'repeating-conic-gradient(#2a2a2e 0% 25%, #1c1c20 0% 50%) 50%/18px 18px',
              }}
            />

            <div style={{ display: 'grid', gap: 10, marginTop: 15 }}>
              {canShare ? (
                <button
                  type="button"
                  className="btn btn-full"
                  onClick={share}
                  style={{ background: '#25D366', color: '#04120c' }}
                >
                  <Icon name="sparkles" size={16} />
                  Kirim ke WhatsApp
                </button>
              ) : null}
              <button type="button" className="btn btn-ghost btn-full" onClick={download}>
                <Icon name="download" size={16} />
                Download Stiker
              </button>
            </div>

            <p className="hint">
              Di WhatsApp: buka chat → emoji → stiker → tambah → pilih file ini.
            </p>
          </div>
        ) : null}
      </div>
    </ToolShell>
  );
}
