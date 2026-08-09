'use client';

import { useEffect, useRef, useState } from 'react';
import ToolShell, { CopyButton } from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';
import Icon from '@/components/icons';

const MAGIC = 'NAWA1:';

function textToBytes(text) {
  return new TextEncoder().encode(text);
}

function bytesToBits(bytes) {
  const bits = [];
  for (let i = 0; i < bytes.length; i++) {
    for (let j = 7; j >= 0; j--) bits.push((bytes[i] >> j) & 1);
  }
  return bits;
}

function bitsToBytes(bits) {
  const out = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < out.length; i++) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i * 8 + j];
    out[i] = v;
  }
  return out;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memuat gambar'));
    img.src = url;
  });
}

export default function StegoPage() {
  const { addToast } = useToast();
  const [mode, setMode] = useState('encode');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [secret, setSecret] = useState('');
  const [decoded, setDecoded] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [capacity, setCapacity] = useState(0);
  const urlsRef = useRef([]);

  useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const track = (u) => {
    urlsRef.current.push(u);
    return u;
  };

  const pickFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      addToast('File harus gambar', 'error');
      return;
    }
    setFile(f);
    setPreview(track(URL.createObjectURL(f)));
    setResult(null);
    setDecoded('');
    try {
      const img = await loadImage(f);
      setCapacity(Math.max(0, Math.floor((img.width * img.height * 3 - 32) / 8)));
    } catch {
      setCapacity(0);
    }
  };

  const encode = async () => {
    if (!file) {
      addToast('Pilih foto dulu', 'warning');
      return;
    }
    const text = secret.trim();
    if (!text) {
      addToast('Isi pesan rahasianya', 'warning');
      return;
    }
    setBusy(true);
    try {
      const img = await loadImage(file);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); const data = imageData.data;
      const payload = textToBytes(MAGIC + text);
      const bits = bytesToBits(payload);

      const lenBits = [];
      for (let i = 31; i >= 0; i--) lenBits.push((payload.length >> i) & 1);
      const allBits = [...lenBits, ...bits];

      if (allBits.length > img.width * img.height * 3) {
        throw new Error('Pesan kepanjangan buat foto ini. Pakai foto lebih gede.');
      }

      let cursor = 0;
      const writeBit = (bit) => {
        const p = Math.floor(cursor / 3) * 4 + (cursor % 3);
        data[p] = (data[p] & 0xfe) | bit;
        cursor++;
      };
      for (let i = 0; i < allBits.length; i++) writeBit(allBits[i]);

      ctx.putImageData(imageData, 0, 0);
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      setResult({ url: track(URL.createObjectURL(blob)), blob, size: blob.size });
      addToast('Pesan berhasil diselundupkan', 'success');
    } catch (e) {
      addToast(e.message || 'Gagal encode', 'error');
    } finally {
      setBusy(false);
    }
  };

  const decode = async () => {
    if (!file) {
      addToast('Pilih foto yang mengandung pesan', 'warning');
      return;
    }
    setBusy(true);
    try {
      const img = await loadImage(file);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); const data = imageData.data;

      let cursor = 0;
      const nextBit = () => {
        const p = Math.floor(cursor / 3) * 4 + (cursor % 3);
        cursor++;
        return data[p] & 1;
      };

      let len = 0;
      for (let i = 0; i < 32; i++) len = (len << 1) | nextBit();
      if (len <= 0 || len > 200000) {
        throw new Error('Foto ini gak mengandung pesan dari NawaVandrell.');
      }

      const bits = [];
      for (let i = 0; i < len * 8; i++) bits.push(nextBit());
      const text = new TextDecoder().decode(bitsToBytes(bits));

      if (!text.startsWith(MAGIC)) {
        throw new Error('Foto ini gak mengandung pesan dari NawaVandrell.');
      }
      setDecoded(text.slice(MAGIC.length));
      addToast('Pesan rahasia ketemu', 'success');
    } catch (e) {
      setDecoded('');
      addToast(e.message || 'Gagal decode', 'error');
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = 'foto-anti-kepo.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    addToast('PNG tersimpan', 'success');
  };

  return (
    <ToolShell
      title="Anti-Kepo (Steganografi)"
      desc="Selundupin pesan rahasia di dalam piksel foto. Mata telanjang gak bakal liat bedanya."
      icon="eye"
    >
      <div className="panel">
        <div className="chips" style={{ justifyContent: 'flex-start', marginBottom: 15 }}>
          <button type="button" className="chip" aria-pressed={mode === 'encode'} onClick={() => setMode('encode')}>
            Sembunyikan Pesan
          </button>
          <button type="button" className="chip" aria-pressed={mode === 'decode'} onClick={() => setMode('decode')}>
            Bongkar Pesan
          </button>
        </div>

        <label className="dropzone" style={{ marginBottom: 15 }}>
          <Icon name="image" size={26} />
          <span>{file ? 'Ganti foto' : 'Pilih foto (PNG/JPG)'}</span>
          <input type="file" accept="image/*" onChange={pickFile} style={{ display: 'none' }} />
        </label>

        {preview ? (
          <div style={{ textAlign: 'center', marginBottom: 15 }}>
            <img src={preview} alt="Foto sumber" style={{ maxHeight: 160, borderRadius: 12, border: '1px solid var(--border)' }} />
            <p className="hint">Kapasitas sembunyi: ±{capacity} karakter</p>
          </div>
        ) : null}

        {mode === 'encode' ? (
          <>
            <div className="field">
              <label className="label" htmlFor="stego-secret">Pesan rahasia</label>
              <textarea
                id="stego-secret"
                className="textarea"
                style={{ minHeight: 100 }}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Curhatan, password, koordinat rahasia..."
              />
            </div>
            <button type="button" className="btn btn-primary btn-full" onClick={encode} disabled={busy}>
              {busy ? 'Menyelundupkan...' : 'Selundupkan Pesan'}
            </button>

            {result ? (
              <div className="result" style={{ marginTop: 15 }}>
                <div className="result-head">
                  <span>Foto berisi pesan · {(result.size / 1024).toFixed(0)} KB</span>
                </div>
                <div style={{ display: 'grid', gap: 9 }}>
                  <button type="button" className="btn btn-primary btn-full" onClick={download}>
                    <Icon name="download" size={16} /> Download PNG
                  </button>
                </div>
                <p className="hint">
                  Wajib kirim sebagai DOKUMEN di WA/Telegram. Kalau dikirim sebagai foto biasa, kompresi bakal ngehancurin pesan rahasianya.
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <button type="button" className="btn btn-primary btn-full" onClick={decode} disabled={busy}>
              {busy ? 'Membongkar...' : 'Bongkar Pesan'}
            </button>

            {decoded ? (
              <div className="result" style={{ marginTop: 15 }}>
                <div className="result-head">
                  <span>Pesan rahasia</span>
                  <CopyButton value={decoded} />
                </div>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{decoded}</pre>
              </div>
            ) : null}
          </>
        )}
      </div>
    </ToolShell>
  );
}
