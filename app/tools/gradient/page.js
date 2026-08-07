'use client';

import { useMemo, useState } from 'react';
import ToolShell, { CopyButton } from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';

const PRESETS = [
  { name: 'Emerald', from: '#34D399', to: '#059669', angle: 135 },
  { name: 'Sunset', from: '#F59E0B', to: '#EF4444', angle: 120 },
  { name: 'Ocean', from: '#6366F1', to: '#06B6D4', angle: 160 },
  { name: 'Grape', from: '#8B5CF6', to: '#EC4899', angle: 135 },
  { name: 'Mint', from: '#A7F3D0', to: '#818CF8', angle: 110 },
  { name: 'Night', from: '#1E293B', to: '#0F172A', angle: 180 },
];

export default function GradientPage() {
  const { addToast } = useToast();
  const [from, setFrom] = useState('#34D399');
  const [to, setTo] = useState('#6366F1');
  const [angle, setAngle] = useState(135);
  const [type, setType] = useState('linear');

  const css = useMemo(() => {
    return type === 'linear'
      ? `linear-gradient(${angle}deg, ${from}, ${to})`
      : `radial-gradient(circle at 50% 50%, ${from}, ${to})`;
  }, [type, angle, from, to]);

  const snippet = `background: ${css};`;
  const tailwind =
    type === 'linear'
      ? `bg-[linear-gradient(${angle}deg,${from},${to})]`
      : `bg-[radial-gradient(circle,${from},${to})]`;

  const applyPreset = (p) => {
    setFrom(p.from);
    setTo(p.to);
    setAngle(p.angle);
    setType('linear');
    addToast(`Preset ${p.name}`, 'info');
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <ToolShell title="Bikin Gradient" desc="Atur warna, dapat CSS siap tempel." icon="🎚️">
      <div className="panel">
        <div
          style={{
            height: 150,
            borderRadius: 14,
            background: css,
            border: '1px solid var(--border)',
            marginBottom: 15,
          }}
        />

        <div className="field">
          <label className="label">Tipe</label>
          <div className="btn-row">
            <button
              type="button"
              className={`btn btn-sm ${type === 'linear' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setType('linear')}
            >
              Linear
            </button>
            <button
              type="button"
              className={`btn btn-sm ${type === 'radial' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setType('radial')}
            >
              Radial
            </button>
          </div>
        </div>

        <div className="field" style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="label" htmlFor="g-from">
              Warna awal
            </label>
            <div style={{ display: 'flex', gap: 7 }}>
              <input
                id="g-from"
                type="color"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                style={{
                  width: 48,
                  height: 48,
                  padding: 3,
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              />
              <input
                className="input"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}
              />
            </div>
          </div>
        </div>

        <div className="field">
          <button type="button" className="btn btn-ghost btn-sm btn-full" onClick={swap}>
            ⇅ Tukar warna
          </button>
        </div>

        <div className="field">
          <label className="label" htmlFor="g-to">
            Warna akhir
          </label>
          <div style={{ display: 'flex', gap: 7 }}>
            <input
              id="g-to"
              type="color"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{
                width: 48,
                height: 48,
                padding: 3,
                border: '1px solid var(--border)',
                borderRadius: 10,
                background: 'transparent',
                cursor: 'pointer',
              }}
            />
            <input
              className="input"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}
            />
          </div>
        </div>

        {type === 'linear' ? (
          <div className="field">
            <label className="label" htmlFor="g-angle">
              Sudut: <strong style={{ color: 'var(--accent-soft)' }}>{angle}°</strong>
            </label>
            <input
              id="g-angle"
              type="range"
              min="0"
              max="360"
              value={angle}
              onChange={(e) => setAngle(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
          </div>
        ) : null}

        <div className="field">
          <label className="label">Preset</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p)}
                title={p.name}
                style={{
                  height: 46,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: `linear-gradient(${p.angle}deg, ${p.from}, ${p.to})`,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#fff',
                  textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="result">
          <div className="result-head">
            <span>CSS</span>
            <CopyButton value={snippet} />
          </div>
          <pre>{snippet}</pre>
        </div>

        <div className="result">
          <div className="result-head">
            <span>Tailwind</span>
            <CopyButton value={tailwind} />
          </div>
          <pre>{tailwind}</pre>
        </div>
      </div>
    </ToolShell>
  );
}
