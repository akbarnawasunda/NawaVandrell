'use client';

import { useState, useRef } from 'react';
import ToolShell from '@/components/ToolShell';
import { QRCodeCanvas } from 'qrcode.react';
import { useToast } from '@/context/ToastContext';
import Icon from '@/components/icons';

const COLOR_PRESETS = [
  { name: 'Emerald', fg: '#10b981', bg: '#040408' },
  { name: 'Klasik', fg: '#000000', bg: '#ffffff' },
  { name: 'Cyberpunk', fg: '#22d3ee', bg: '#090d16' },
  { name: 'Sunset', fg: '#f97316', bg: '#180a0a' },
  { name: 'Violet', fg: '#a855f7', bg: '#0b0814' },
];

const CONTENT_PRESETS = [
  { label: 'Website', sample: 'https://nawaeditor.vercel.app' },
  { label: 'WhatsApp', sample: 'https://wa.me/6281234567890?text=Halo%20kak' },
  { label: 'WiFi', sample: 'WIFI:S:MyHomeWifi;T:WPA;P:Rahasia123;;' },
  { label: 'Email', sample: 'mailto:kontak@example.com?subject=Halo' },
];

export default function QRCodePage() {
  const { addToast } = useToast();
  const [text, setText] = useState('https://nawaeditor.vercel.app');
  const [fgColor, setFgColor] = useState('#10b981');
  const [bgColor, setBgColor] = useState('#040408');
  const [size, setSize] = useState(256);
  const canvasRef = useRef(null);

  const download = () => {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) {
      addToast('QR belum siap', 'warning');
      return;
    }
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nawa-qrcode.png';
    a.click();
    addToast('QR Code ter-download!', 'success');
  };

  const copyImage = async () => {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error();
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        addToast('Gambar QR tercopy ke clipboard!', 'success');
      });
    } catch {
      addToast('Browser tidak mendukung copy gambar langsung', 'warning');
    }
  };

  return (
    <ToolShell
      title="Bikin QR Code"
      desc="Generate QR Code estetik dengan custom warna, ukuran, dan preset praktis."
      icon="qr"
    >
      <div className="panel">
        <div className="field">
          <label className="label">Preset Konten Cepat</label>
          <div className="chips" style={{ justifyContent: 'flex-start', marginBottom: 8 }}>
            {CONTENT_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="chip"
                onClick={() => {
                  setText(p.sample);
                  addToast(`Template ${p.label} dimuat`, 'info');
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <label className="label" htmlFor="qr-text" style={{ marginTop: 12 }}>
            Teks atau Link
          </label>
          <textarea
            id="qr-text"
            className="textarea"
            style={{ minHeight: 80 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="https://... atau teks apa saja"
          />
        </div>

        <div className="field">
          <label className="label">Tema Warna</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {COLOR_PRESETS.map((c) => (
              <button
                key={c.name}
                type="button"
                className="chip"
                onClick={() => {
                  setFgColor(c.fg);
                  setBgColor(c.bg);
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: c.fg,
                    marginRight: 4,
                  }}
                />
                {c.name}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="label" htmlFor="qr-fg-color">Warna QR (Foreground)</label>
              <input
                id="qr-fg-color"
                type="color"
                value={fgColor}
                onChange={(e) => setFgColor(e.target.value)}
                style={{
                  width: '100%',
                  height: 40,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: 'transparent',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label" htmlFor="qr-bg-color">Warna Background</label>
              <input
                id="qr-bg-color"
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                style={{
                  width: '100%',
                  height: 40,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: 'transparent',
                }}
              />
            </div>
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="qr-size">
            Ukuran: <strong style={{ color: 'var(--accent-soft)' }}>{size}px</strong>
          </label>
          <input
            id="qr-size"
            type="range"
            min="160"
            max="400"
            step="16"
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
        </div>

        <div
          style={{
            textAlign: 'center',
            margin: '20px 0',
            padding: 24,
            background: 'var(--surface-2)',
            borderRadius: 16,
            border: '1px solid var(--border)',
            display: 'grid',
            placeItems: 'center',
          }}
          ref={canvasRef}
        >
          {text ? (
            <QRCodeCanvas
              value={text}
              size={size}
              fgColor={fgColor}
              bgColor={bgColor}
              level="H"
              includeMargin
            />
          ) : (
            <p style={{ color: 'var(--text-faint)' }}>Ketik teks atau tempel link terlebih dahulu</p>
          )}
        </div>

        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 2 }}
            onClick={download}
            disabled={!text}
          >
            <Icon name="download" size={16} /> Download PNG
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ flex: 1 }}
            onClick={copyImage}
            disabled={!text}
          >
            <Icon name="copy" size={16} /> Copy Gambar
          </button>
        </div>
      </div>
    </ToolShell>
  );
}
