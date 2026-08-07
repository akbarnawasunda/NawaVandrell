'use client';

import { useState } from 'react';
import ToolShell, { ResultBox } from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';

const SAMPLE = '{"nama":"NawaVandrell","versi":2,"tools":["qr","base64"],"aktif":true}';

/** Ambil nomor baris & kolom dari pesan error JSON.parse. */
function locate(input, message) {
  const m = message.match(/position (\d+)/i);
  if (!m) return null;
  const pos = Number(m[1]);
  const before = input.slice(0, pos);
  const line = before.split('\n').length;
  const col = pos - before.lastIndexOf('\n');
  return { line, col };
}

export default function JsonFormatterPage() {
  const { addToast } = useToast();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const parse = () => {
    if (!input.trim()) {
      addToast('Tempel JSON-nya dulu', 'warning');
      return null;
    }
    try {
      return JSON.parse(input);
    } catch (err) {
      const where = locate(input, err.message);
      setError(
        where
          ? `JSON tidak valid di baris ${where.line}, kolom ${where.col} — ${err.message}`
          : `JSON tidak valid — ${err.message}`
      );
      setOutput('');
      setInfo('');
      return null;
    }
  };

  const format = () => {
    setError('');
    const obj = parse();
    if (obj === null) return;
    const text = JSON.stringify(obj, null, 2);
    setOutput(text);
    describe(obj, text);
    addToast('JSON rapi ✨', 'success');
  };

  const minify = () => {
    setError('');
    const obj = parse();
    if (obj === null) return;
    const text = JSON.stringify(obj);
    setOutput(text);
    const saved = input.length - text.length;
    setInfo(
      `${text.length} karakter${saved > 0 ? ` · hemat ${saved} karakter (${Math.round((saved / input.length) * 100)}%)` : ''}`
    );
    addToast('JSON dipadatkan', 'success');
  };

  const describe = (obj, text) => {
    const type = Array.isArray(obj) ? 'array' : typeof obj;
    const keys = Array.isArray(obj)
      ? `${obj.length} item`
      : obj && type === 'object'
        ? `${Object.keys(obj).length} key`
        : type;
    setInfo(`Valid ✓ · ${keys} · ${text.split('\n').length} baris`);
  };

  return (
    <ToolShell title="Rapikan JSON" desc="Format, padatkan, dan cek error JSON kamu." icon="📋">
      <div className="panel">
        <div className="field">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="label" htmlFor="json-in" style={{ marginBottom: 0 }}>
              JSON kamu
            </label>
            <button
              type="button"
              onClick={() => {
                setInput(SAMPLE);
                setError('');
              }}
              style={{
                background: 'none',
                border: 0,
                color: 'var(--accent-soft)',
                font: 'inherit',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
                marginBottom: 7,
              }}
            >
              pakai contoh
            </button>
          </div>
          <textarea
            id="json-in"
            className="textarea"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError('');
            }}
            placeholder='{"nama": "Nawa", "aktif": true}'
            spellCheck={false}
          />
        </div>

        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={format}>
            Rapikan
          </button>
          <button type="button" className="btn btn-ghost" onClick={minify}>
            Padatkan
          </button>
        </div>

        {error ? <p className="err">{error}</p> : null}
        {info && !error ? <p className="hint">{info}</p> : null}

        {output ? (
          <ResultBox
            label="Hasil"
            value={output}
            actions={
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setInput(output);
                  addToast('Hasil dipindah ke input', 'info');
                }}
              >
                ↑ Pakai
              </button>
            }
          />
        ) : null}
      </div>
    </ToolShell>
  );
}
