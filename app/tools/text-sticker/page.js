// app/tools/text-sticker/page.js

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';
import Icon from '@/components/icons';

const SIZE = 512;

const PRESETS = [
  { id: 'brat', label: 'Brat Lime', bg: '#9acf00', text: '#000000' },
  { id: 'transparent', label: 'Transparan', bg: 'transparent', text: '#ffffff' },
  { id: 'white', label: 'Putih', bg: '#ffffff', text: '#000000' },
  { id: 'black', label: 'Hitam', bg: '#000000', text: '#ffffff' },
];

const WEIGHTS = [
  { label: 'Regular', value: '400' },
  { label: 'Bold', value: '700' },
  { label: 'Extra Bold', value: '800' },
  { label: 'Black', value: '900' },
];

export default function TextStickerPage() {
  const { addToast } = useToast();
  const canvasRef = useRef(null);

  const [text, setText] = useState('teks lu\ndi sini');
  const [bg, setBg] = useState('#9acf00');
  const [color, setColor] = useState('#000000');
  const [weight, setWeight] = useState('900');
  const [fontSize, setFontSize] = useState(88);
  const [stroke, setStroke] = useState(0);
  const [strokeColor, setStrokeColor] = useState('#ffffff');
  const [sticker, setSticker] = useState(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && !!navigator.canShare);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, SIZE, SIZE);

    if (bg !== 'transparent') {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, SIZE, SIZE);
    }

    const lines = (text || '')
      .split('\n')
      .map((l) => l.trimEnd())
      .filter((_, i) => i < 6);

    if (lines.length === 0) return;

    ctx.font = `${weight} ${fontSize}px 'Plus Jakarta Sans', system-ui, sans-serif`;

    // auto-fit: biar teks gak keluar kotak horizontal & vertikal
    const maxWidth = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);
    const maxW = SIZE - 72;
    const maxH = SIZE - 72;
    let eff = fontSize;
    if (maxWidth > maxW) eff = Math.floor(eff * (maxW / maxWidth));
    const lineH = eff * 1.15;
    if (lineH * lines.length > maxH) {
      eff = Math.floor(eff * (maxH / (lineH * lines.length)));
    }

    ctx.font = `${weight} ${eff}px 'Plus Jakarta Sans', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    const effLineH = eff * 1.15;
    const totalH = effLineH * lines.length;
    let y = (SIZE - totalH) / 2 + effLineH / 2;

    for (const line of lines) {
      if (stroke > 0) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = stroke;
        ctx.strokeText(line, SIZE / 2, y);
      }
      ctx.fillStyle = color;
      ctx.fillText(line, SIZE / 2, y);
      y += effLineH;
    }
  }, [text, bg, color, weight, fontSize, stroke, strokeColor]);

  useEffect(() => {
    draw();
  }, [draw]);

  const exportSticker = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          addToast('Gagal bikin stiker', 'error');
          return;
        }

        const emit = (finalBlob, type) => {
          const url = URL.createObjectURL(finalBlob);
          setSticker({ url, blob: finalBlob, type, size: finalBlob.size });
          addToast('Stiker teks siap', 'success');
        };

        if (blob.type === 'image/webp') emit(blob, 'image/webp');
        else canvas.toBlob((png) => emit(png, 'image/png'), 'image/png');
      },
      'image/webp',
      0.92
    );
  };

  const download = () => {
    if (!sticker) return;
    const a = document.createElement('a');
    a.href = sticker.url;
    a.download = `stiker-teks.${sticker.type === 'image/webp' ? 'webp' : 'png'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    addToast('Stiker tersimpan', 'success');
  };

  const share = async () => {
    if (!sticker) return;
    const file = new File([sticker.blob], 'stiker-teks.webp', { type: sticker.type });

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Stiker WhatsApp' });
      } catch (err) {
        if (err?.name !== 'AbortError') addToast('Share dibatalkan', 'info');
      }
    } else {
      addToast('Browser gak dukung share, download aja ya', 'warning');
    }
  };

  return (
    <ToolShell
      title="Stiker Teks Polos"
      desc="Ketik kata-kata, jadi stiker WA 512x512. Ala stiker '.brat' di bot WA."
      icon="case"
    >
      <div className="panel">
        <div className="field">
          <label className="label" htmlFor="ts-text">
            Teks stiker (maks 6 baris)
          </label>
          <textarea
            id="ts-text"
            className="textarea"
            style={{ fontFamily: 'var(--font-body)', minHeight: 90 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={80}
            rows={3}
            placeholder={'nak berak\npun nyawa\ntaruhan'}
          />
        </div>

        <div className="field">
          <label className="label">Preset cepet</label>
          <div className="btn-row">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`btn btn-sm ${bg === p.bg && color === p.text ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => {
                  setBg(p.bg);
                  setColor(p.text);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="label">Ukuran teks: {fontSize}px</label>
          <input
            type="range"
            min="40"
            max="140"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="ts-weight">
            Ketebalan font
          </label>
          <select
            id="ts-weight"
            className="select"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          >
            {WEIGHTS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label">Warna teks & latar</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Warna teks"
              style={{ flex: 1, height: 44, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
            />
            <input
              type="color"
              value={bg === 'transparent' ? '#000000' : bg}
              onChange={(e) => setBg(e.target.value)}
              aria-label="Warna latar"
              style={{ flex: 1, height: 44, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
            />
          </div>
        </div>

        <div className="field">
          <label className="label">Outline teks: {stroke}px</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="range"
              min="0"
              max="14"
              value={stroke}
              onChange={(e) => setStroke(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => setStrokeColor(e.target.value)}
              aria-label="Warna outline"
              style={{ width: 52, height: 40, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* Live preview */}
        <div style={{ textAlign: 'center', margin: '18px 0' }}>
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            style={{
              width: '100%',
              maxWidth: 260,
              borderRadius: 14,
              border: '1px solid var(--border)',
              background:
                'repeating-conic-gradient(#2a2a2e 0% 25%, #1c1c20 0% 50%) 50%/18px 18px',
            }}
          />
          <p className="hint">Preview live 512x512</p>
        </div>

        <button type="button" className="btn btn-primary btn-full" onClick={exportSticker}>
          <Icon name="sparkles" size={16} />
          Jadikan Stiker
        </button>

        {sticker ? (
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {canShare ? (
              <button
                type="button"
                className="btn btn-full"
                onClick={share}
                style={{ background: '#25D366', color: '#04120c' }}
              >
                <Icon name="download" size={16} />
                Kirim ke WhatsApp
              </button>
            ) : null}
            <button type="button" className="btn btn-ghost btn-full" onClick={download}>
              <Icon name="download" size={16} />
              Download Stiker
            </button>
            <p className="hint">
              Di WhatsApp: buka chat → stiker → tambah → pilih file ini.
            </p>
          </div>
        ) : null}
      </div>
    </ToolShell>
  );
}
