'use client';

import { useState, useRef } from 'react';
import ToolShell from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';
import Icon from '@/components/icons';

const BRAT_FONTS = [
  { name: 'Bold (Default)', value: 'bold', style: '900' },
  { name: 'Extra Bold', value: 'extra-bold', style: '800' },
  { name: 'Black', value: 'black', style: '950' },
  { name: 'Regular', value: 'regular', style: '400' },
];

const BG_COLORS = [
  { name: 'Transparent', value: 'transparent' },
  { name: 'Putih', value: '#ffffff' },
  { name: 'Hitam', value: '#000000' },
  { name: 'Hijau', value: '#10b981' },
  { name: 'Biru', value: '#3b82f6' },
  { name: 'Merah', value: '#ef4444' },
  { name: 'Kuning', value: '#fbbf24' },
];

export default function StickerMakerPage() {
  const { addToast } = useToast();
  const canvasRef = useRef(null);
  const [mode, setMode] = useState('image'); // 'image' | 'text'
  
  // Image mode state
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  
  // Text mode state
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(80);
  const [fontStyle, setFontStyle] = useState('900');
  const [textColor, setTextColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('transparent');
  const [strokeColor, setStrokeColor] = useState('#ffffff');
  const [strokeWidth, setStrokeWidth] = useState(0);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      addToast('File harus gambar (JPG/PNG/WebP)', 'warning');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImageFile(file);
      setPreviewUrl(ev.target?.result);
      addToast('Gambar berhasil dimuat', 'success');
    };
    reader.readAsDataURL(file);
  };

  const generateTextSticker = () => {
    if (!text.trim()) {
      addToast('Isi teks dulu', 'warning');
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const size = 512;
    
    // Clear canvas
    ctx.clearRect(0, 0, size, size);
    
    // Background
    if (bgColor !== 'transparent') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, size);
    }
    
    // Text setup
    ctx.font = `${fontStyle} ${fontSize}px 'Plus Jakarta Sans', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;
    
    // Stroke (outline)
    if (strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.strokeText(text, size / 2, size / 2);
    }
    
    // Fill text
    ctx.fillText(text, size / 2, size / 2);
    
    downloadSticker(canvas, 'text-sticker');
  };

  const processImageSticker = () => {
    if (!previewUrl) {
      addToast('Upload gambar dulu', 'warning');
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Resize & crop to 512x512 (center crop)
      const size = 512;
      const scale = Math.max(size / img.width, size / img.height);
      const x = (size / 2) - (img.width / 2) * scale;
      const y = (size / 2) - (img.height / 2) * scale;
      
      canvas.width = size;
      canvas.height = size;
      
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      
      downloadSticker(canvas, 'image-sticker');
    };
    
    img.src = previewUrl;
  };

  const downloadSticker = (canvas, filename) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        addToast('Gagal generate sticker', 'error');
        return;
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.webp`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      addToast('Sticker berhasil di-download! Upload ke WhatsApp manually', 'success');
    }, 'image/webp', 1.0);
  };

  return (
    <ToolShell
      title="Bikin Stiker WA"
      desc="Convert foto atau bikin teks jadi stiker WhatsApp 512x512 WebP."
      icon="sticker"
    >
      <div className="panel">
        {/* Mode Switcher */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button
            type="button"
            className={`btn ${mode === 'image' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1 }}
            onClick={() => setMode('image')}
          >
            <Icon name="image" size={16} />
            Dari Gambar
          </button>
          <button
            type="button"
            className={`btn ${mode === 'text' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1 }}
            onClick={() => setMode('text')}
          >
            <Icon name="case" size={16} />
            Teks Polos
          </button>
        </div>

        {/* IMAGE MODE */}
        {mode === 'image' ? (
          <>
            <div className="field">
              <label className="label" htmlFor="sticker-image">
                Upload foto/gambar
              </label>
              <input
                id="sticker-image"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="input"
                style={{ padding: '12px' }}
              />
              {previewUrl && (
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <img
                    src={previewUrl}
                    alt="Preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: 300,
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                    }}
                  />
                  <p className="hint" style={{ marginTop: 8 }}>
                    Gambar akan di-crop & resize otomatis jadi 512x512
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              className="btn btn-primary btn-full"
              onClick={processImageSticker}
              disabled={!previewUrl}
            >
              <Icon name="download" size={16} />
              Convert jadi Sticker WA
            </button>
          </>
        ) : null}

        {/* TEXT MODE */}
        {mode === 'text' ? (
          <>
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
                rows={3}
                className="textarea"
                style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: fontStyle }}
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
                style={{ width: '100%' }}
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
                  <option key={f.value} value={f.style}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="label">Warna Teks</label>
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                style={{ width: '100%', height: 48, borderRadius: 8, cursor: 'pointer' }}
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

            <div className="field">
              <label className="label">Outline/Stroke (Opsional)</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="color"
                  value={strokeColor}
                  onChange={(e) => setStrokeColor(e.target.value)}
                  style={{ width: 60, height: 48, borderRadius: 8, cursor: 'pointer' }}
                />
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-faint)', minWidth: 30 }}>
                  {strokeWidth}
                </span>
              </div>
            </div>

            {/* Live Preview */}
            {text && (
              <div style={{ 
                marginTop: 16, 
                padding: 20, 
                background: 'var(--surface-2)',
                borderRadius: 12,
                textAlign: 'center',
                border: '1px solid var(--border)'
              }}>
                <p className="label" style={{ marginBottom: 12 }}>Preview</p>
                <div style={{
                  display: 'inline-block',
                  padding: '20px 30px',
                  background: bgColor === 'transparent' ? 'rgba(255,255,255,0.05)' : bgColor,
                  borderRadius: 12,
                }}>
                  <span style={{
                    fontSize: fontSize * 0.6,
                    fontWeight: fontStyle,
                    color: textColor,
                    WebkitTextStroke: strokeWidth > 0 ? `${strokeWidth}px ${strokeColor}` : '0',
                  }}>
                    {text}
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary btn-full"
              onClick={generateTextSticker}
              disabled={!text.trim()}
              style={{ marginTop: 16 }}
            >
              <Icon name="download" size={16} />
              Download Sticker Teks
            </button>
          </>
        ) : null}

        {/* Hidden Canvas for Generation */}
        <canvas ref={canvasRef} width={512} height={512} style={{ display: 'none' }} />

        <div style={{ marginTop: 20, padding: 16, background: 'var(--accent-ghost)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>
            <strong style={{ color: 'var(--accent-soft)' }}>💡 Cara Pakai:</strong>
            <br />1. Download file .webp yang sudah di-generate
            <br />2. Buka WhatsApp > pilih sticker
            <br />3. Klik "+" atau "Add Sticker"
            <br />4. Pilih file yang tadi didownload
            <br />5. Sticker siap dipakai!
          </p>
        </div>
      </div>
    </ToolShell>
  );
}
