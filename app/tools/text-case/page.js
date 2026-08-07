'use client';

import { useMemo, useState } from 'react';
import ToolShell, { CopyButton } from '@/components/ToolShell';

const words = (t) => t.trim().split(/[\s_-]+/).filter(Boolean);

const TRANSFORMS = [
  { id: 'upper', label: 'HURUF BESAR', fn: (t) => t.toUpperCase() },
  { id: 'lower', label: 'huruf kecil', fn: (t) => t.toLowerCase() },
  {
    id: 'title',
    label: 'Huruf Awal Besar',
    fn: (t) => t.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase()),
  },
  {
    id: 'sentence',
    label: 'Seperti kalimat.',
    fn: (t) =>
      t
        .toLowerCase()
        .replace(/(^\s*\p{L})|([.!?]\s+\p{L})/gu, (c) => c.toUpperCase()),
  },
  { id: 'slug', label: 'slug-url', fn: (t) => words(t.toLowerCase()).join('-').replace(/[^\p{L}\p{N}-]/gu, '') },
  {
    id: 'camel',
    label: 'camelCase',
    fn: (t) =>
      words(t.toLowerCase())
        .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(''),
  },
  {
    id: 'pascal',
    label: 'PascalCase',
    fn: (t) =>
      words(t.toLowerCase())
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(''),
  },
  { id: 'snake', label: 'snake_case', fn: (t) => words(t.toLowerCase()).join('_') },
  { id: 'kebab', label: 'kebab-case', fn: (t) => words(t.toLowerCase()).join('-') },
  { id: 'constant', label: 'CONSTANT_CASE', fn: (t) => words(t.toUpperCase()).join('_') },
  {
    id: 'alternating',
    label: 'aLtErNaTiNg',
    fn: (t) =>
      [...t].map((c, i) => (i % 2 ? c.toUpperCase() : c.toLowerCase())).join(''),
  },
  { id: 'reverse', label: 'kilabreT', fn: (t) => [...t].reverse().join('') },
];

export default function TextCasePage() {
  const [input, setInput] = useState('');
  const [active, setActive] = useState('upper');

  const output = useMemo(() => {
    if (!input) return '';
    const t = TRANSFORMS.find((x) => x.id === active);
    return t ? t.fn(input) : input;
  }, [input, active]);

  const stats = useMemo(() => {
    const chars = input.length;
    const noSpace = input.replace(/\s/g, '').length;
    const wordCount = input.trim() ? input.trim().split(/\s+/).length : 0;
    const lines = input ? input.split('\n').length : 0;
    return { chars, noSpace, wordCount, lines };
  }, [input]);

  return (
    <ToolShell title="Ubah Huruf" desc="Ganti kapitalisasi teks ke 12 format berbeda." icon="🔠">
      <div className="panel">
        <div className="field">
          <label className="label" htmlFor="tc-in">
            Teks kamu
          </label>
          <textarea
            id="tc-in"
            className="textarea"
            style={{ minHeight: 100, fontFamily: 'inherit', fontSize: 15 }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tulis apa saja di sini..."
          />
          <p className="hint">
            {stats.wordCount} kata · {stats.chars} karakter · {stats.noSpace} tanpa spasi ·{' '}
            {stats.lines} baris
          </p>
        </div>

        <div className="field">
          <label className="label">Pilih format</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {TRANSFORMS.map((t) => (
              <button
                key={t.id}
                type="button"
                className="chip"
                aria-pressed={active === t.id}
                onClick={() => setActive(t.id)}
                style={{ fontSize: 12.5, padding: '7px 13px' }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {output ? (
          <div className="result">
            <div className="result-head">
              <span>{TRANSFORMS.find((t) => t.id === active)?.label}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setInput(output)}
                >
                  ↑ Pakai
                </button>
                <CopyButton value={output} />
              </div>
            </div>
            <p className="mono" style={{ margin: 0, fontFamily: 'inherit', fontSize: 15, color: 'var(--text)' }}>
              {output}
            </p>
          </div>
        ) : null}
      </div>
    </ToolShell>
  );
}
