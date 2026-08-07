'use client';

import { useCallback, useEffect, useState } from 'react';
import ToolShell, { CopyButton } from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';

/** UUID v4 pakai crypto.randomUUID, fallback manual kalau belum ada. */
function uuidv4() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function UuidPage() {
  const { addToast } = useToast();
  const [count, setCount] = useState(5);
  const [upper, setUpper] = useState(false);
  const [braces, setBraces] = useState(false);
  const [list, setList] = useState([]);

  const generate = useCallback(() => {
    const n = Math.max(1, Math.min(100, Number(count) || 1));
    setList(Array.from({ length: n }, uuidv4));
  }, [count]);

  useEffect(() => {
    generate();
  }, [generate]);

  const decorate = (id) => {
    let out = upper ? id.toUpperCase() : id;
    if (braces) out = `{${out}}`;
    return out;
  };

  const all = list.map(decorate).join('\n');

  return (
    <ToolShell title="Bikin UUID" desc="UUID v4 acak, dibuat pakai crypto perangkat kamu." icon="🆔">
      <div className="panel">
        <div className="field">
          <label className="label" htmlFor="uuid-count">
            Jumlah (1-100)
          </label>
          <input
            id="uuid-count"
            className="input"
            type="number"
            min="1"
            max="100"
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </div>

        <div className="field" style={{ display: 'grid', gap: 8 }}>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={upper}
              onChange={(e) => setUpper(e.target.checked)}
              style={{ width: 17, height: 17, accentColor: 'var(--accent)' }}
            />
            HURUF BESAR
          </label>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={braces}
              onChange={(e) => setBraces(e.target.checked)}
              style={{ width: 17, height: 17, accentColor: 'var(--accent)' }}
            />
            Pakai kurung kurawal {'{ }'}
          </label>
        </div>

        <div className="btn-row">
          <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={generate}>
            🎲 Bikin Baru
          </button>
          <CopyButton value={all} label="Copy semua" small={false} />
        </div>

        {list.length ? (
          <div className="result">
            <div className="result-head">
              <span>{list.length} UUID</span>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {list.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="mono"
                  onClick={() => {
                    navigator.clipboard?.writeText(decorate(id));
                    addToast('Tercopy', 'success');
                  }}
                  style={{
                    textAlign: 'left',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '8px 11px',
                    cursor: 'pointer',
                    color: 'var(--accent-soft)',
                  }}
                  title="Klik untuk copy"
                >
                  {decorate(id)}
                </button>
              ))}
            </div>
            <p className="hint">Klik salah satu untuk copy satuan.</p>
          </div>
        ) : null}
      </div>
    </ToolShell>
  );
}
