'use client';

import { useState, useRef, useEffect } from 'react';
import ToolShell from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';
import Icon from '@/components/icons';

const BRAT_FONTS = [
  { name: 'Bold (Default)', value: '900' },
  { name: 'Extra Bold', value: '800' },
  { name: 'Black', value: '950' },
  { name: 'Regular', value: '400' },
];

const BG_COLORS = [
  { name: 'Transparan', value: 'transparent' },
  { name: 'Putih', value: '#ffffff' },
  { name: 'Hitam', value: '#000000' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Rose', value: '#f43f5e' },
];

export default function TextStickerPage() {
  const { addToast } = useToast();
  const canvasRef = useRef(null);
  
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(80);
  const [fontStyle, setFontStyle] = useState('900');
  const [textColor, setTextColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('transparent');
  const [strokeColor, setStrokeColor] = useState('#ffffff');
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Auto-generate preview on canvas (hidden) for accurate export
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = 512;
    
    ctx.clearRect(0, 0, size, size);
    
    if (bgColor !== 'transparent') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, size);
    }
    
    ctx.font = `${fontStyle} ${fontSize}px 'Plus Jakarta Sans', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;
    
    if (strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = 'round';
      ctx.strokeText(text || ' ', size / 2, size / 2);
    }
    
    ctx.fillText(text || ' ', size / 2, size / 2);
  }, [text, fontSize, fontStyle, textColor, bgColor, strokeColor, strokeWidth]);

  const downloadSticker = () => {
    if (!text.trim()) {
      addToast('Isi teks dulu cuy', 'warning');
      return;
    }
    
    setIsGenerating(true);
    const canvas = canvasRef.current;
    
    // Small delay to let UI update
    setTimeout(() => {
      canvas.toBlob((blob) => {
        setIsGenerating(false);
        if (!blob) {
          addToast('Gagal generate sticker', 'error');
          return;
        }
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stiker-${text.slice(0, 10).replace(/\s+/g, '-')}.webp`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        addToast('Stiker teks berhasil di-download! 🚀', 'success');
      }, 'image/webp', 1.0);
    }, 50);
  };

  return (
    <ToolShell
      title="Stiker Teks Polos"
      desc="Bikin stiker kata-kata ala '.brat' dengan custom font & warna."
      icon="case"
    >
      <div className="panel">
        <div className="field">
          <label className="label" htmlFor="sticker-text">
            Teks untuk sticker
          </label>
          <textarea
            id="sticker-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ketik teks di sini..."
            maxLength={30}
            rows={2}
            className="textarea"
            style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: fontStyle, fontSize: 16 }}
          />
          <p className="hint">Maksimal 30 karakter</p>
        </div>

        <div className="field">
          <label className="label">Ukuran Font: {fontSize}px</label>
          <input
            type="range"
            min="40"
            max="120"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
        </div>

        <div className="field">
          <label className="label">Style Font</label>
          <select
            value={fontStyle}
            onChange={(e) => setFontStyle(e.target.value)}
            className="select"
          >
            {BRAT_FONTS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label className="label">Warna Teks</label>
            <input
              type="color"
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
              style={{ width: '100%', height: 48, borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent' }}
            />
          </div>

          <div className="field">
            <label className="label">Background</label>
            <select
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="select"
            >
              {BG_COLORS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label className="label">Outline/Stroke: {strokeWidth}px</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => setStrokeColor(e.target.value)}
              style={{ width: 60, height: 48, borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent' }}
            />
            <input
              type="range"
              min="0"
              max="12"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent)' }}
            />
          </div>
        </div>

        {/* Live Preview (CSS based for performance) */}
        {text && (
          <div style={{ 
            marginTop: 16, 
            padding: 24, 
            background: 'var(--surface-2)',
            borderRadius: 12,
            textAlign: 'center',
            border: '1px solid var(--border)'
          }}>
            <p className="label" style={{ marginBottom: 16 }}>Live Preview</p>
            <div style={{
              display: 'inline-block',
              padding: '20px 30px',
              background: bgColor === 'transparent' ? 'repeating-conic-gradient(#2a2a2e 0% 25%, #1c1c20 0% 50%) 50%/18px 18px' : bgColor,
              borderRadius: 12,
            }}>
              <span style={{
                fontSize: Math.min(fontSize * 0.5, 60),
                fontWeight: fontStyle,
                color: textColor,
                WebkitTextStroke: strokeWidth > 0 ? `${strokeWidth * 0.5}px ${strokeColor}` : '0',
                textStroke: strokeWidth > 0 ? `${strokeWidth * 0.5}px ${strokeColor}` : '0',
              }}>
                {text}
              </span>
            </div>
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary btn-full"
          onClick={downloadSticker}
          disabled={!text.trim() || isGenerating}
          style={{ marginTop: 20 }}
        >
          {isGenerating ? (
            'Memproses...'
          ) : (
            <>
              <Icon name="download" size={16} />
              Download Sticker Teks
            </>
          )}
        </button>

        {/* Hidden Canvas for Generation */}
        <canvas ref={canvasRef} width={512} height={512} style={{ display: 'none' }} />

        <div style={{ marginTop: 20, padding: 16, background: 'var(--accent-ghost)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--accent-soft)' }}>💡 Cara Pakai:</strong>
            <br />1. Download file .webp yang sudah di-generate
            <br />2. Buka WhatsApp > pilih sticker
            <br />3. Klik "+" atau "Add Sticker"
            <br />4. Pilih file yang tadi didownload
          </p>
        </div>
      </div>
    </ToolShell>
  );
}
