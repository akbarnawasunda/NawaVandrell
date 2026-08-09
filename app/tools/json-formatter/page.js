// app/tools/json-formatter/page.js

'use client';

import { useState } from 'react';
import ToolShell, { CopyButton } from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';
import Icon from '@/components/icons';

const SAMPLE = JSON.stringify({
  app: 'NawaVandrell',
  version: 3,
  pro: true,
  tools: ['downloader', 'qr-code', 'sticker-maker'],
  owner: { name: 'akbar', region: 'bandung' },
});

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

function errorPosition(message, raw) {
  const m = String(message).match(/position (\d+)/i);
  if (!m) return null;
  const pos = Number(m[1]);
  const before = raw.slice(0, pos);
  const line = (before.match(/\n/g) || []).length + 1;
  const col = pos - before.lastIndexOf('\n');
  return { line, col };
}

function analyze(node) {
  let keys = 0;
  let depth = 0;
  const walk = (n, d) => {
    depth = Math.max(depth, d);
    if (Array.isArray(n)) n.forEach((x) => walk(x, d + 1));
    else if (n && typeof n === 'object') {
      keys += Object.keys(n).length;
      Object.values(n).forEach((x) => walk(x, d + 1));
    }
  };
  walk(node, 1);
  return { keys, depth };
}

export default function JsonFormatterPage() {
  const { addToast } = useToast();
  const [input, setInput] = useState('');
  const [indent, setIndent] = useState('2');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);

  const space = indent === 'tab' ? '\t' : Number(indent);

  const run = (mode) => {
    const raw = input.trim();
    if (!raw) {
      addToast('Tempel JSON dulu', 'warning');
      return;
    }

    try {
      const value = JSON.parse(raw);
      setError('');

      const result =
        mode === 'minify' ? JSON.stringify(value) : JSON.stringify(value, null, space);

      setOutput(result);
      setStats({
        ...analyze(value),
        inBytes: new Blob([raw]).size,
        outBytes: new Blob([result]).size,
      });
      addToast(mode === 'minify' ? 'JSON di-minify' : 'JSON dirapikan', 'success');
    } catch (e) {
      setOutput('');
      setStats(null);
      const pos = errorPosition(e.message, raw);
      setError(pos ? `${e.message} (baris ${pos.line}, kolom ${pos.col})` : e.message);
      addToast('JSON tidak valid', 'error');
    }
  };

  const validate = () => {
    const raw = input.trim();
    if (!raw) {
      addToast('Tempel JSON dulu', 'warning');
      return;
    }
    try {
      JSON.parse(raw);
      setError('');
      addToast('JSON valid. Aman.', 'success');
    } catch (e) {
      const pos = errorPosition(e.message, raw);
      setError(pos ? `${e.message} (baris ${pos.line}, kolom ${pos.col})` : e.message);
      addToast('JSON rusak', 'error');
    }
  };

  return (
    <ToolShell
      title="Rapikan JSON"
      desc="Format, minify, dan cek error JSON lengkap dengan posisi barisnya."
      icon="json"
    >
      <div className="panel">
        <div className="field">
          <label className="label" htmlFor="json-input">
            Tempel JSON di sini
          </label>
          <textarea
            id="json-input"
            className="textarea"
            style={{ minHeight: 170 }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='{"contoh": "data"}'
            spellCheck={false}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="json-indent">
            Indentasi
          </label>
          <select
            id="json-indent"
            className="select"
            value={indent}
            onChange={(e) => setIndent(e.target.value)}
          >
            <option value="2">2 spasi</option>
            <option value="4">4 spasi</option>
            <option value="tab">Tab</option>
          </select>
        </div>

        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={() => run('beautify')}>
            <Icon name="json" size={16} /> Rapikan
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => run('minify')}>
            <Icon name="case" size={16} /> Minify
          </button>
          <button type="button" className="btn btn-ghost" onClick={validate}>
            <Icon name="check" size={16} /> Validasi
          </button>
        </div>

        <div className="btn-row" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setInput(SAMPLE);
              setOutput('');
              setError('');
              setStats(null);
            }}
          >
            <Icon name="sparkles" size={14} /> Isi Contoh
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setInput('');
              setOutput('');
              setError('');
              setStats(null);
            }}
          >
            <Icon name="close" size={14} /> Bersihkan
          </button>
        </div>

        {error ? <p className="err">{error}</p> : null}

        {stats ? (
          <div className="stat-row" style={{ marginTop: 14, marginBottom: 0 }}>
            <div className="stat">
              <b>{stats.keys}</b>
              <small>keys</small>
            </div>
            <div className="stat">
              <b>{stats.depth}</b>
              <small>depth</small>
            </div>
            <div className="stat">
              <b>{formatBytes(stats.outBytes)}</b>
              <small>hasil</small>
            </div>
          </div>
        ) : null}

        {output ? (
          <div className="result">
            <div className="result-head">
              <span>Hasil</span>
              <CopyButton value={output} />
            </div>
            <pre style={{ maxHeight: 300, overflow: 'auto' }}>{output}</pre>
          </div>
        ) : null}
      </div>
    </ToolShell>
  );
}
