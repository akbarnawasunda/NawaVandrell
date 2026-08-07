'use client';

import { useCallback, useEffect, useState } from 'react';
import ToolShell, { ResultBox } from '@/components/ToolShell';
import { loremIpsum } from '@/lib/funTools';

const UNITS = [
  { id: 'paragraph', label: 'Paragraf' },
  { id: 'sentence', label: 'Kalimat' },
  { id: 'word', label: 'Kata' },
];

export default function LoremPage() {
  const [count, setCount] = useState(3);
  const [unit, setUnit] = useState('paragraph');
  const [output, setOutput] = useState('');

  const generate = useCallback(() => {
    setOutput(loremIpsum({ count, unit }));
  }, [count, unit]);

  useEffect(() => {
    generate();
  }, [generate]);

  return (
    <ToolShell title="Teks Dummy" desc="Lorem ipsum buat ngisi mockup dan desain." icon="📄">
      <div className="panel">
        <div className="field">
          <label className="label">Satuan</label>
          <div className="btn-row">
            {UNITS.map((u) => (
              <button
                key={u.id}
                type="button"
                className={`btn btn-sm ${unit === u.id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setUnit(u.id)}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="lorem-count">
            Jumlah: <strong style={{ color: 'var(--accent-soft)' }}>{count}</strong>
          </label>
          <input
            id="lorem-count"
            type="range"
            min="1"
            max={unit === 'word' ? 50 : unit === 'sentence' ? 20 : 10}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
        </div>

        <button type="button" className="btn btn-primary btn-full" onClick={generate}>
          🎲 Bikin Lagi
        </button>

        {output ? (
          <ResultBox label="Teks dummy" value={output}>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.75,
                color: 'var(--text-dim)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {output}
            </p>
          </ResultBox>
        ) : null}
      </div>
    </ToolShell>
  );
}
