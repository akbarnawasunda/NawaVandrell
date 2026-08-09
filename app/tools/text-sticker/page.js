'use client';

import { useEffect, useRef, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';
import Icon from '@/components/icons';

const SIZE = 512;

const PRESETS = [
  { id: 'brat', label: 'Brat', bg: '#8ACE00', color: '#213304', font: 'Arial, Helvetica, sans-serif', size: 72, blur: 0.7, transform: 'lower', align: 'left', weight: '400' },
  { id: 'news', label: 'Breaking', bg: '#B71C1C', color: '#ffffff', font: '"Plus Jakarta Sans", system-ui, sans-serif', size: 56, blur: 0, transform: 'upper', align: 'center', weight: '800', banner: true },
  { id: 'struk', label: 'Struk', bg: '#f4f4ef', color: '#141414', font: '"Courier New", monospace', size: 40, blur: 0, transform: 'upper', align: 'center', weight: '700', receipt: true },
  { id: 'custom', label: 'Custom' },
];

function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  for (const raw of String(text || '').split('\n')) {
    const words = raw.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}

export default function TextStickerPage() {
  const { addToast } = useToast();
  const canvasRef = useRef(null);
  const urlsRef = useRef([]);

  const [text, setText] = useState('mending push dulu,\nbaru ngopi.');
  const [presetId, setPresetId] = useState('brat');
  const [bg, setBg] = useState('#8ACE00');
  const [color, setColor] = useState('#213304');
  const [size, setSize] = useState(72);
  const [font, setFont] = useState('Arial, Helvetica, sans-serif');

  useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const applyPreset = (p) => {
    setPresetId(p.id);
    if (p.id === 'custom') return;
    setBg(p.bg);
    setColor(p.color);
    setSize(p.size);
    setFont(p.font);
  };

  const current = PRESETS.find((p) => p.id === presetId) || PRESETS[0];

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, SIZE, SIZE);

      let body = text;
      if (current.transform === 'lower') body = body.toLowerCase();
      if (current.transform === 'upper') body = body.toUpperCase();

      const pad = 44;
      const bannerH = current.banner ? 84 : 0;
      const receiptH = current.receipt ? 150 : 0;

      ctx.filter = current.blur ? `blur(${current.blur}px)` : 'none';
      ctx.fillStyle = color;
      ctx.font = `${current.weight || '700'} ${size}px ${font}`;
      ctx.textBaseline = 'top';

      const maxW = SIZE - pad * 2;
      const lines = wrapLines(ctx, body, maxW);
      const lh = size * 1.15;
      const availH = SIZE - bannerH - receiptH;
      let y = Math.max(pad, (availH - lines.length * lh) / 2);

      for (const line of lines) {
        const w = ctx.measureText(line).width;
        const x = current.align === 'center' ? (SIZE - w) / 2 : pad;
        ctx.fillText(line, x, y, maxW);
        y += lh;
      }
      ctx.filter = 'none';

      if (current.banner) {
        ctx.fillStyle = '#0d0d0d';
        ctx.fillRect(0, SIZE - bannerH, SIZE, bannerH);
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 34px "Plus Jakarta Sans", system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText('BREAKING NEWS', 32, SIZE - bannerH / 2);
      }

      if (current.receipt) {
        ctx.fillStyle = color;
        ctx.font = '700 30px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('* * *  NAWA MART  * * *', SIZE / 2, 64);
        ctx.fillText('------------------------', SIZE / 2, 96);
        ctx.fillText('TERIMA KASIH UDAH MAMPIR', SIZE / 2, SIZE - 40);
        ctx.textAlign = 'left';
      }
    };

    draw();
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(draw).catch(() => {});
    }
  }, [text, bg, color, size, font, current]);

  const exportBlob = (type) => new Promise((res) => canvasRef.current.toBlob(res, type, 0.92));

  const download = async () => {
    const blob = (await exportBlob('image/webp')) || (await exportBlob('image/png'));
    if (!blob) {
      addToast('Gagal export', 'error');
      return;
    }
    const url = URL.createObjectURL(blob);
    urlsRef.current.push(url);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stiker-${presetId}.${blob.type === 'image/webp' ? 'webp' : 'png'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    addToast('Stiker tersimpan', 'success');
  };

  const share = async () => {
    const blob = (await exportBlob('image/webp')) || (await exportBlob('image/png'));
    if (!blob) {
      addToast('Gagal export', 'error');
      return;
    }
    const file = new File([blob], `stiker-${presetId}.webp`, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Stiker teks' });
      } catch (e) {
        if (e?.name !== 'AbortError') addToast('Share dibatalkan', 'info');
      }
    } else {
      addToast('Browser gak dukung share, download aja', 'warning');
    }
  };

  return (
    <ToolShell
      title="Stiker Teks"
      desc="Preset brat, breaking news, struk kasir. Ketik, download, pamer."
      icon="case"
    >
      <div className="panel">
        <div className="field">
          <label className="label" htmlFor="ts-text">Tulis teks lu</label>
          <textarea
            id="ts-text"
            className="textarea"
            style={{ minHeight: 90 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={140}
          />
        </div>

        <div className="field">
          <label className="label">Preset</label>
          <div className="chips" style={{ justifyContent: 'flex-start' }}>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="chip"
                aria-pressed={presetId === p.id}
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center', margin: '6px 0 15px' }}>
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            style={{ width: '100%', maxWidth: 300, borderRadius: 12, border: '1px solid var(--border)' }}
          />
        </div>

        {presetId === 'custom' ? (
          <div className="field">
            <label className="label">Warna latar & teks</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} style={{ width: '50%', height: 40, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }} aria-label="Warna latar" />
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: '50%', height: 40, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }} aria-label="Warna teks" />
            </div>
          </div>
        ) : null}

        <div className="field">
          <label className="label">Ukuran teks: {size}px</label>
          <input type="range" min="24" max="120" value={size} onChange={(e) => setSize(Number(e.target.value))} style={{ width: '100%' }} />
        </div>

        <div style={{ display: 'grid', gap: 9 }}>
          <button type="button" className="btn btn-primary btn-full" onClick={download}>
            <Icon name="download" size={16} /> Download Stiker
          </button>
          <button type="button" className="btn btn-ghost btn-full" onClick={share}>
            <Icon name="sparkles" size={16} /> Share
          </button>
        </div>
      </div>
    </ToolShell>
  );
}
