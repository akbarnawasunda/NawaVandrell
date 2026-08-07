'use client';

import { useMemo, useState } from 'react';
import ToolShell from '@/components/ToolShell';

const FLAG_OPTIONS = [
  { id: 'g', label: 'g — semua match' },
  { id: 'i', label: 'i — abaikan huruf besar/kecil' },
  { id: 'm', label: 'm — multiline' },
  { id: 's', label: 's — titik cocok newline' },
  { id: 'u', label: 'u — unicode' },
];

const PRESETS = [
  { label: 'Email', pattern: '[\\w.+-]+@[\\w-]+\\.[\\w.]+' },
  { label: 'No HP Indonesia', pattern: '(?:\\+62|62|0)8[1-9][0-9]{6,10}' },
  { label: 'URL', pattern: 'https?:\\/\\/[^\\s]+' },
  { label: 'Angka', pattern: '\\d+' },
  { label: 'Tanggal YYYY-MM-DD', pattern: '\\d{4}-\\d{2}-\\d{2}' },
];

const MAX_MATCHES = 300;

export default function RegexTesterPage() {
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState(['g']);
  const [text, setText] = useState('');
  const [replacement, setReplacement] = useState('');

  const toggleFlag = (id) =>
    setFlags((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));

  const { error, matches, replaced } = useMemo(() => {
    if (!pattern) return { error: '', matches: [], replaced: '' };
    let re;
    try {
      re = new RegExp(pattern, flags.join(''));
    } catch (err) {
      return { error: err.message, matches: [], replaced: '' };
    }
    if (!text) return { error: '', matches: [], replaced: '' };

    const found = [];
    try {
      if (flags.includes('g')) {
        let m;
        let guard = 0;
        const global = new RegExp(pattern, flags.join(''));
        while ((m = global.exec(text)) !== null) {
          found.push({ value: m[0], index: m.index, groups: m.slice(1) });
          if (m[0] === '') global.lastIndex += 1; // hindari infinite loop
          if (++guard >= MAX_MATCHES) break;
        }
      } else {
        const m = re.exec(text);
        if (m) found.push({ value: m[0], index: m.index, groups: m.slice(1) });
      }
      const rep = replacement ? text.replace(re, replacement) : '';
      return { error: '', matches: found, replaced: rep };
    } catch (err) {
      return { error: err.message, matches: [], replaced: '' };
    }
  }, [pattern, flags, text, replacement]);

  /** Highlight semua match di teks asli. */
  const highlighted = useMemo(() => {
    if (!matches.length) return null;
    const parts = [];
    let cursor = 0;
    matches.forEach((m, i) => {
      if (m.index > cursor) parts.push(<span key={`t${i}`}>{text.slice(cursor, m.index)}</span>);
      parts.push(
        <mark
          key={`m${i}`}
          style={{
            background: 'rgba(16,185,129,0.28)',
            color: 'var(--accent-soft)',
            borderRadius: 3,
            padding: '1px 2px',
          }}
        >
          {m.value}
        </mark>
      );
      cursor = m.index + m.value.length;
    });
    if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);
    return parts;
  }, [matches, text]);

  return (
    <ToolShell title="Tes Regex" desc="Coba pola regex, lihat match dan hasil replace-nya." icon="🔍">
      <div className="panel">
        <div className="field">
          <label className="label" htmlFor="re-pattern">
            Pola regex
          </label>
          <input
            id="re-pattern"
            className="input"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="\d{4}-\d{2}-\d{2}"
            spellCheck={false}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="chip"
                style={{ fontSize: 12, padding: '5px 11px' }}
                onClick={() => setPattern(p.pattern)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="label">Flags</label>
          <div style={{ display: 'grid', gap: 6 }}>
            {FLAG_OPTIONS.map((f) => (
              <label
                key={f.id}
                style={{ display: 'flex', gap: 9, alignItems: 'center', fontSize: 13.5, cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={flags.includes(f.id)}
                  onChange={() => toggleFlag(f.id)}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                />
                <code style={{ fontFamily: "'JetBrains Mono', monospace" }}>{f.label}</code>
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="re-text">
            Teks yang dites
          </label>
          <textarea
            id="re-text"
            className="textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tempel teks di sini..."
            spellCheck={false}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="re-rep">
            Replace dengan (opsional) — pakai $1, $2 untuk grup
          </label>
          <input
            id="re-rep"
            className="input"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            placeholder="[$&]"
            spellCheck={false}
          />
        </div>

        {error ? <p className="err">Regex tidak valid: {error}</p> : null}

        {!error && pattern && text ? (
          <>
            <div className="result">
              <div className="result-head">
                <span>
                  {matches.length} match{matches.length >= MAX_MATCHES ? ' (dibatasi)' : ''}
                </span>
              </div>
              {matches.length ? (
                <p className="mono" style={{ margin: 0, color: 'var(--text)', fontSize: 14, lineHeight: 1.8 }}>
                  {highlighted}
                </p>
              ) : (
                <p style={{ margin: 0, color: 'var(--text-faint)', fontSize: 13.5 }}>
                  Tidak ada yang cocok.
                </p>
              )}
            </div>

            {matches.length ? (
              <div className="result">
                <div className="result-head">
                  <span>Detail match</span>
                </div>
                <div style={{ display: 'grid', gap: 5 }}>
                  {matches.slice(0, 40).map((m, i) => (
                    <div key={i} className="mono" style={{ fontSize: 12.5 }}>
                      <span style={{ color: 'var(--text-faint)' }}>#{i + 1} @{m.index}</span>{' '}
                      {m.value || '(kosong)'}
                      {m.groups.length ? (
                        <span style={{ color: 'var(--info)' }}> → [{m.groups.join(', ')}]</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {replacement && replaced ? (
              <div className="result">
                <div className="result-head">
                  <span>Hasil replace</span>
                </div>
                <pre>{replaced}</pre>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </ToolShell>
  );
}
