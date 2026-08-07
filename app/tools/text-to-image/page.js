'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';

const THEMES = [
  { id: 'emerald', label: 'Emerald', from: '#065F46', to: '#0A0A0B', text: '#ECFDF5', accent: '#34D399' },
  { id: 'night', label: 'Malam', from: '#1E1B4B', to: '#0A0A0B', text: '#EEF2FF', accent: '#818CF8' },
  { id: 'sunset', label: 'Sunset', from: '#7C2D12', to: '#18181B', text: '#FFF7ED', accent: '#FB923C' },
  { id: 'paper', label: 'Kertas', from: '#FAFAF9', to: '#E7E5E4', text: '#1C1917', accent: '#059669' },
];

const RATIOS = [
  { id: 'square', label: '1:1 Feed', w: 1080, h: 1080 },
  { id: 'story', label: '9:16 Story', w: 1080, h: 1920 },
  { id: 'wide', label: '16:9 Banner', w: 1280, h: 720 },
];

/** Bungkus teks manual karena canvas gak punya word-wrap. */
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export default function TextToImagePage() {
  const { addToast } = useToast();
  const [text, setText] = useState('Kerja keras itu penting,\ntapi kerja pintar lebih hemat waktu.');
  const [author, setAuthor] = useState('NawaVandrell');
  const [theme, setTheme] = useState('emerald');
  const [ratio, setRatio] = useState('square');
  const [fontSize, setFontSize] = useState(58);
  const canvasRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const t = THEMES.find((x) => x.id === theme) || THEMES[0];
    const r = RATIOS.find((x) => x.id === ratio) || RATIOS[0];
    canvas.width = r.w;
    canvas.height = r.h;
    const ctx = canvas.getContext('2d');

    // latar
    const grad = ctx.createLinearGradient(0, 0, r.w, r.h);
    grad.addColorStop(0, t.from);
    grad.addColorStop(1, t.to);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, r.w, r.h);

    // aksen sudut
    ctx.fillStyle = t.accent;
    ctx.globalAlpha = 0.14;
    ctx.beginPath();
    ctx.arc(r.w * 0.88, r.h * 0.12, r.w * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    const pad = Math.round(r.w * 0.1);
    const maxWidth = r.w - pad * 2;
    const size = Math.round((fontSize / 1080) * r.w);

    // tanda kutip
    ctx.fillStyle = t.accent;
    ctx.font = `bold ${size * 2.4}px Georgia, serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.globalAlpha = 0.35;
    ctx.fillText('"', pad, pad * 0.5);
    ctx.globalAlpha = 1;

    // teks utama
    ctx.fillStyle = t.text;
    ctx.font = `700 ${size}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines = wrapText(ctx, text || ' ', maxWidth);
    const lineHeight = size * 1.38;
    const blockHeight = lines.length * lineHeight;
    let y = r.h / 2 - blockHeight / 2 + lineHeight / 2;

    for (const line of lines) {
      ctx.fillText(line, r.w / 2, y, maxWidth);
      y += lineHeight;
    }

    // penulis
    if (author.trim()) {
      ctx.fillStyle = t.accent;
      ctx.font = `600 ${Math.round(size * 0.5)}px "Plus Jakarta Sans", system-ui, sans-serif`;
      ctx.fillText(`— ${author.trim()}`, r.w / 2, y + lineHeight * 0.5);
    }

    // garis bawah
    ctx.strokeStyle = t.accent;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(2, r.w * 0.004);
    ctx.beginPath();
    ctx.moveTo(pad, r.h - pad * 0.6);
    ctx.lineTo(r.w - pad, r.h - pad * 0.6);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, [text, author, theme, ratio, fontSize]);

  useEffect(() => {
    // tunggu font siap supaya ukuran teks akurat
    if (document.fonts?.ready) document.fonts.ready.then(draw).catch(draw);
    else draw();
  }, [draw]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) {
        addToast('Gagal bikin gambar', 'error');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nawavandrell-quote-${ratio}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      addToast('Gambar tersimpan 📥', 'success');
    }, 'image/png');
  };

  return (
    <ToolShell title="Teks ke Gambar" desc="Bikin quote atau poster teks jadi PNG siap posting." icon="🖼️">
      <div className="panel">
        <div className="field">
          <label className="label" htmlFor="tti-text">
            Teks
          </label>
          <textarea
            id="tti-text"
            className="textarea"
            style={{ minHeight: 90, fontFamily: 'inherit', fontSize: 15 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tulis quote kamu..."
            maxLength={320}
          />
          <p className="hint">{text.length}/320 karakter</p>
        </div>

        <div className="field">
          <label className="label" htmlFor="tti-author">
            Nama / sumber (opsional)
          </label>
          <input
            id="tti-author"
            className="input"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            maxLength={30}
            placeholder="Nama kamu"
          />
        </div>

        <div className="field">
          <label className="label">Tema</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7 }}>
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                style={{
                  height: 42,
                  borderRadius: 10,
                  border: theme === t.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: `linear-gradient(135deg, ${t.from}, ${t.to})`,
                  color: t.text,
                  cursor: 'pointer',
                  font: 'inherit',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="label">Ukuran</label>
          <div className="btn-row">
            {RATIOS.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`btn btn-sm ${ratio === r.id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setRatio(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="tti-size">
            Ukuran font: <strong style={{ color: 'var(--accent-soft)' }}>{fontSize}</strong>
          </label>
          <input
            id="tti-size"
            type="range"
            min="30"
            max="100"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
        </div>

        <div className="result" style={{ textAlign: 'center' }}>
          <div className="result-head">
            <span>Preview</span>
          </div>
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              maxWidth: ratio === 'story' ? 220 : '100%',
              height: 'auto',
              borderRadius: 10,
              border: '1px solid var(--border)',
            }}
          />
          <button type="button" className="btn btn-primary btn-full" onClick={download} style={{ marginTop: 12 }}>
            📥 Download PNG
          </button>
        </div>
      </div>
    </ToolShell>
  );
}
