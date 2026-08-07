'use client';

import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import ToolShell from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';

const SIZES = [
  { label: 'Kecil', value: 256 },
  { label: 'Sedang', value: 512 },
  { label: 'Besar', value: 1024 },
];

export default function QRCodePage() {
  const { addToast } = useToast();
  const [text, setText] = useState('');
  const [value, setValue] = useState('');
  const [size, setSize] = useState(512);
  const wrapRef = useRef(null);

  const generate = () => {
    const clean = text.trim();
    if (!clean) {
      addToast('Isi teks atau link dulu', 'warning');
      return;
    }
    if (clean.length > 1800) {
      addToast('Teks terlalu panjang buat QR (maks 1800)', 'error');
      return;
    }
    setValue(clean);
  };

  const download = () => {
    const canvas = wrapRef.current?.querySelector('canvas');
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) {
        addToast('Gagal bikin file', 'error');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-nawavandrell-${size}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      addToast('QR tersimpan 📥', 'success');
    }, 'image/png');
  };

  return (
    <ToolShell title="Bikin QR" desc="Ketik teks atau link, langsung jadi QR code." icon="📱">
      <div className="panel">
        <div className="field">
          <label className="label" htmlFor="qr-text">
            Teks atau link
          </label>
          <input
            id="qr-text"
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generate()}
            placeholder="https://contoh.com atau tulisan apa saja"
          />
        </div>

        <div className="field">
          <label className="label">Ukuran</label>
          <div className="btn-row">
            {SIZES.map((s) => (
              <button
                key={s.value}
                type="button"
                className={`btn btn-sm ${size === s.value ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSize(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="btn btn-primary btn-full" onClick={generate}>
          Bikin QR
        </button>

        {value ? (
          <div className="result" style={{ textAlign: 'center' }}>
            <div
              ref={wrapRef}
              style={{
                display: 'inline-block',
                padding: 14,
                background: '#fff',
                borderRadius: 12,
                lineHeight: 0,
              }}
            >
              <QRCodeCanvas
                value={value}
                size={size}
                level="M"
                includeMargin={false}
                style={{ width: 220, height: 220 }}
              />
            </div>
            <p className="hint" style={{ wordBreak: 'break-all' }}>{value}</p>
            <button type="button" className="btn btn-primary btn-full" onClick={download} style={{ marginTop: 12 }}>
              📥 Download PNG ({size}px)
            </button>
          </div>
        ) : null}
      </div>
    </ToolShell>
  );
}
