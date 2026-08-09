'use client';
import { useState, useRef } from 'react';
import ToolShell from '@/components/ToolShell';
import { QRCodeCanvas } from 'qrcode.react';
import { useToast } from '@/context/ToastContext';
import Icon from '@/components/icons';

export default function QRCodePage() {
  const { addToast } = useToast();
  const [text, setText] = useState('https://nawavandrell.vercel.app');
  const [fgColor, setFgColor] = useState('#10b981'); // Emerald
  const [bgColor, setBgColor] = useState('#040408'); // Obsidian
  const [size, setSize] = useState(256);
  const canvasRef = useRef(null);

  const download = () => {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) { addToast('QR belum siap', 'warning'); return; }
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qrcode-nawa.png';
    a.click();
    addToast('QR Code ter-download', 'success');
  };

  return (
    <ToolShell title="Bikin QR Code" desc="Generate QR Code estetik dengan custom warna." icon="qr">
      <div className="panel">
        <div className="field">
          <label className="label">Teks atau Link</label>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="https://..." />
        </div>

        <div className="field">
          <label className="label">Warna</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <small style={{ color: 'var(--text-faint)' }}>Depan</small>
              <input type="color" value={fgColor} onChange={(e) => setFgColor(e.target.value)} style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }} />
            </div>
            <div style={{ flex: 1 }}>
              <small style={{ color: 'var(--text-faint)' }}>Belakang</small>
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }} />
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', margin: '20px 0', padding: 20, background: 'var(--surface-2)', borderRadius: 16, border: '1px solid var(--border)' }} ref={canvasRef}>
          {text ? (
            <QRCodeCanvas value={text} size={size} fgColor={fgColor} bgColor={bgColor} level="H" includeMargin />
          ) : (
            <p style={{ color: 'var(--text-faint)' }}>Isi teks dulu</p>
          )}
        </div>

        <button type="button" className="btn btn-primary btn-full" onClick={download} disabled={!text}>
          <Icon name="download" size={16} /> Download PNG
        </button>
      </div>
    </ToolShell>
  );
}
