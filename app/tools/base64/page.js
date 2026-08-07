'use client';

import { useState } from 'react';
import ToolShell, { ResultBox } from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';

/**
 * Unicode-safe Base64.
 * btoa/atob mentah error kalau ada emoji atau huruf non-Latin,
 * jadi teks dilewatkan TextEncoder/TextDecoder dulu.
 */
function encodeB64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function decodeB64(b64) {
  const clean = b64.replace(/\s+/g, '');
  // dukung URL-safe base64
  const normalized = clean.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export default function Base64Page() {
  const { addToast } = useToast();
  const [mode, setMode] = useState('encode');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const run = () => {
    setError('');
    setOutput('');
    if (!input.trim()) {
      addToast('Isi teksnya dulu', 'warning');
      return;
    }
    try {
      const result = mode === 'encode' ? encodeB64(input) : decodeB64(input);
      setOutput(result);
      addToast(mode === 'encode' ? 'Berhasil di-encode' : 'Berhasil di-decode', 'success');
    } catch {
      setError(
        mode === 'encode'
          ? 'Gagal encode teks ini.'
          : 'Bukan Base64 yang valid. Cek lagi teksnya ya.'
      );
    }
  };

  const swap = () => {
    const next = mode === 'encode' ? 'decode' : 'encode';
    setMode(next);
    if (output) {
      setInput(output);
      setOutput('');
    }
    setError('');
  };

  return (
    <ToolShell title="Base64" desc="Encode atau decode teks. Aman untuk emoji dan huruf non-Latin." icon="🔣">
      <div className="panel">
        <div className="btn-row" style={{ marginBottom: 15 }}>
          <button
            type="button"
            className={`btn ${mode === 'encode' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              setMode('encode');
              setError('');
            }}
          >
            Teks → Base64
          </button>
          <button
            type="button"
            className={`btn ${mode === 'decode' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              setMode('decode');
              setError('');
            }}
          >
            Base64 → Teks
          </button>
        </div>

        <div className="field">
          <label className="label" htmlFor="b64-in">
            {mode === 'encode' ? 'Teks biasa' : 'Teks Base64'}
          </label>
          <textarea
            id="b64-in"
            className="textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === 'encode' ? 'Halo dunia! 🎉 Ketik apa aja di sini...' : 'SGFsbG8gZHVuaWEh'
            }
          />
        </div>

        <div className="btn-row">
          <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={run}>
            {mode === 'encode' ? 'Encode' : 'Decode'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={swap}>
            ⇄ Tukar
          </button>
        </div>

        {error ? <p className="err">{error}</p> : null}

        {output ? (
          <ResultBox label={mode === 'encode' ? 'Base64' : 'Teks asli'} value={output} />
        ) : null}
      </div>
    </ToolShell>
  );
}
