'use client';

import { useMemo, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? [...clean].map((c) => c + c).join('') : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function rgbToHsl({ r, g, b }) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
    else if (max === gg) h = ((bb - rr) / d + 2) / 6;
    else h = ((rr - gg) / d + 4) / 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h, s, l) {
  const S = s / 100;
  const L = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x) =>
    Math.round(255 * x)
      .toString(16)
      .padStart(2, '0');
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

/** Kontras WCAG terhadap putih & hitam. */
function luminance({ r, g, b }) {
  const chan = (v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

export default function ColorPickerPage() {
  const { addToast } = useToast();
  const [hex, setHex] = useState('#10B981');

  const data = useMemo(() => {
    const valid = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex);
    const safe = valid ? (hex.startsWith('#') ? hex : `#${hex}`) : '#10B981';
    const rgb = hexToRgb(safe);
    const hsl = rgbToHsl(rgb);
    const lum = luminance(rgb);
    const onWhite = (1.05) / (lum + 0.05);
    const onBlack = (lum + 0.05) / 0.05;
    return {
      valid,
      safe: safe.toUpperCase(),
      rgb,
      hsl,
      contrastWhite: onWhite,
      contrastBlack: onBlack,
      shades: [90, 80, 70, 60, 50, 40, 30, 20, 10].map((l) => hslToHex(hsl.h, hsl.s, l)),
      harmony: [
        { label: 'Komplementer', color: hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l) },
        { label: 'Triadik 1', color: hslToHex((hsl.h + 120) % 360, hsl.s, hsl.l) },
        { label: 'Triadik 2', color: hslToHex((hsl.h + 240) % 360, hsl.s, hsl.l) },
        { label: 'Analog 1', color: hslToHex((hsl.h + 30) % 360, hsl.s, hsl.l) },
        { label: 'Analog 2', color: hslToHex((hsl.h + 330) % 360, hsl.s, hsl.l) },
      ],
    };
  }, [hex]);

  const copy = (text) => {
    navigator.clipboard?.writeText(text);
    addToast(`${text} tercopy`, 'success');
  };

  const formats = [
    { label: 'HEX', value: data.safe },
    { label: 'RGB', value: `rgb(${data.rgb.r}, ${data.rgb.g}, ${data.rgb.b})` },
    { label: 'HSL', value: `hsl(${data.hsl.h}, ${data.hsl.s}%, ${data.hsl.l}%)` },
    {
      label: 'RGBA',
      value: `rgba(${data.rgb.r}, ${data.rgb.g}, ${data.rgb.b}, 1)`,
    },
  ];

  return (
    <ToolShell title="Pilih Warna" desc="Ambil kode warna, palet, dan cek kontras." icon="🌈">
      <div className="panel">
        <div
          style={{
            height: 120,
            borderRadius: 14,
            background: data.safe,
            border: '1px solid var(--border)',
            marginBottom: 15,
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            fontSize: 19,
            color: data.contrastBlack > data.contrastWhite ? '#000' : '#fff',
          }}
        >
          {data.safe}
        </div>

        <div className="field" style={{ display: 'flex', gap: 10 }}>
          <input
            type="color"
            value={data.safe}
            onChange={(e) => setHex(e.target.value)}
            aria-label="Pilih warna"
            style={{
              width: 56,
              height: 48,
              padding: 3,
              border: '1px solid var(--border)',
              borderRadius: 12,
              background: 'transparent',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
          <input
            className="input"
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            placeholder="#10B981"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
            spellCheck={false}
          />
        </div>

        {!data.valid && hex ? <p className="err">Kode HEX belum valid, contoh: #10B981</p> : null}

        <div className="field">
          <label className="label">Format</label>
          <div style={{ display: 'grid', gap: 6 }}>
            {formats.map((f) => (
              <button
                key={f.label}
                type="button"
                onClick={() => copy(f.value)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  padding: '11px 14px',
                  background: 'rgba(255,255,255,0.035)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  cursor: 'pointer',
                  font: 'inherit',
                  color: 'var(--text)',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-faint)' }}>
                  {f.label}
                </span>
                <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                  {f.value}
                </code>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="label">Gradasi (klik untuk copy)</label>
          <div className="swatch-grid">
            {data.shades.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => copy(c.toUpperCase())}
                title={c}
                style={{
                  aspectRatio: '1',
                  background: c,
                  border: '1px solid var(--border)',
                  borderRadius: 9,
                  cursor: 'pointer',
                }}
                aria-label={`Copy ${c}`}
              />
            ))}
          </div>
        </div>

        <div className="field">
          <label className="label">Warna pendamping</label>
          <div style={{ display: 'grid', gap: 6 }}>
            {data.harmony.map((h) => (
              <button
                key={h.label}
                type="button"
                onClick={() => copy(h.color.toUpperCase())}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: 9,
                  background: 'rgba(255,255,255,0.035)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  cursor: 'pointer',
                  font: 'inherit',
                  color: 'var(--text)',
                }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 7,
                    background: h.color,
                    flexShrink: 0,
                    border: '1px solid var(--border)',
                  }}
                />
                <span style={{ fontSize: 13.5, flex: 1, textAlign: 'left' }}>{h.label}</span>
                <code style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-dim)' }}>
                  {h.color.toUpperCase()}
                </code>
              </button>
            ))}
          </div>
        </div>

        <div className="result">
          <div className="result-head">
            <span>Kontras teks</span>
          </div>
          <div style={{ display: 'flex', gap: 9 }}>
            <div
              style={{
                flex: 1,
                padding: 12,
                background: '#fff',
                color: data.safe,
                borderRadius: 9,
                textAlign: 'center',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {data.contrastWhite.toFixed(1)}:1
              <div style={{ fontSize: 10.5, fontWeight: 600, opacity: 0.8 }}>
                {data.contrastWhite >= 4.5 ? 'lolos AA' : 'kurang'}
              </div>
            </div>
            <div
              style={{
                flex: 1,
                padding: 12,
                background: '#000',
                color: data.safe,
                borderRadius: 9,
                textAlign: 'center',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {data.contrastBlack.toFixed(1)}:1
              <div style={{ fontSize: 10.5, fontWeight: 600, opacity: 0.8 }}>
                {data.contrastBlack >= 4.5 ? 'lolos AA' : 'kurang'}
              </div>
            </div>
          </div>
          <p className="hint">Minimal 4.5:1 supaya teks nyaman dibaca (standar WCAG AA).</p>
        </div>
      </div>
    </ToolShell>
  );
}
