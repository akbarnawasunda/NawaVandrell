'use client';

import { useState } from 'react';
import ToolShell, { CopyButton } from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';

const ALGOS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function HashPage() {
  const { addToast } = useToast();
  const [input, setInput] = useState('');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (!input) {
      addToast('Isi teksnya dulu', 'warning');
      return;
    }
    if (!globalThis.crypto?.subtle) {
      setError('Browser ini tidak mendukung Web Crypto. Coba browser lain atau pakai HTTPS.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const bytes = new TextEncoder().encode(input);
      const pairs = await Promise.all(
        ALGOS.map(async (algo) => [algo, toHex(await crypto.subtle.digest(algo, bytes))])
      );
      setResults(Object.fromEntries(pairs));
      addToast('Hash selesai', 'success');
    } catch {
      setError('Gagal menghitung hash.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell title="Bikin Hash" desc="Hash SHA-1, SHA-256, SHA-384, dan SHA-512 dari teks." icon="#️⃣">
      <div className="panel">
        <div className="field">
          <label className="label" htmlFor="hash-in">
            Teks yang mau di-hash
          </label>
          <textarea
            id="hash-in"
            className="textarea"
            style={{ minHeight: 100 }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ketik apa saja..."
          />
        </div>

        <button type="button" className="btn btn-primary btn-full" onClick={run} disabled={busy}>
          {busy ? 'Menghitung...' : 'Hitung Hash'}
        </button>

        {error ? <p className="err">{error}</p> : null}

        {results
          ? ALGOS.map((algo) => (
              <div className="result" key={algo}>
                <div className="result-head">
                  <span>{algo}</span>
                  <CopyButton value={results[algo]} />
                </div>
                <p className="mono" style={{ margin: 0 }}>
                  {results[algo]}
                </p>
              </div>
            ))
          : null}

        {results ? (
          <p className="hint">
            Hash itu satu arah — tidak bisa dibalik jadi teks asli. Jangan pakai SHA-1 untuk
            keamanan baru.
          </p>
        ) : null}
      </div>
    </ToolShell>
  );
}
