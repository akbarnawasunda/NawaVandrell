'use client';

import { useCallback, useEffect, useState } from 'react';
import ToolShell, { ResultBox } from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';

const LOWER = 'abcdefghijkmnopqrstuvwxyz'; // tanpa l
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // tanpa I, O
const DIGITS = '23456789'; // tanpa 0, 1
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?/';
const AMBIGUOUS = 'lIO01';

/** Ambil integer acak 0..max-1 tanpa modulo bias. */
function secureIndex(max) {
  const limit = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  let n;
  do {
    crypto.getRandomValues(buf);
    n = buf[0];
  } while (n >= limit);
  return n % max;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = secureIndex(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function strengthOf(pw, poolSize) {
  if (!pw) return { score: 0, label: '—', color: '#3f3f46' };
  const bits = pw.length * Math.log2(poolSize || 1);
  if (bits < 36) return { score: 25, label: 'Lemah', color: '#f87171' };
  if (bits < 60) return { score: 50, label: 'Cukup', color: '#fbbf24' };
  if (bits < 90) return { score: 75, label: 'Kuat', color: '#34d399' };
  return { score: 100, label: 'Sangat Kuat', color: '#10b981' };
}

export default function PasswordPage() {
  const { addToast } = useToast();
  const [length, setLength] = useState(16);
  const [useUpper, setUseUpper] = useState(true);
  const [useDigits, setUseDigits] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [avoidAmbiguous, setAvoidAmbiguous] = useState(true);
  const [password, setPassword] = useState('');
  const [poolSize, setPoolSize] = useState(0);

  const generate = useCallback(() => {
    let sets = [LOWER];
    if (useUpper) sets.push(UPPER);
    if (useDigits) sets.push(DIGITS);
    if (useSymbols) sets.push(SYMBOLS);

    if (!avoidAmbiguous) {
      sets = sets.map((s, i) => (i === 0 ? s + 'l' : i === 1 && useUpper ? s + 'IO' : s));
      if (useDigits) sets = sets.map((s) => (s === DIGITS ? s + '01' : s));
    }

    const pool = sets.join('');
    setPoolSize(pool.length);

    // jamin minimal 1 karakter dari tiap set yang dipilih
    const chars = sets.map((set) => set[secureIndex(set.length)]);
    while (chars.length < length) chars.push(pool[secureIndex(pool.length)]);

    setPassword(shuffle(chars).slice(0, length).join(''));
  }, [length, useUpper, useDigits, useSymbols, avoidAmbiguous]);

  useEffect(() => {
    generate();
  }, [generate]);

  const strength = strengthOf(password, poolSize);

  const toggles = [
    { id: 'upper', label: 'HURUF BESAR', on: useUpper, set: setUseUpper },
    { id: 'digits', label: 'Angka 0-9', on: useDigits, set: setUseDigits },
    { id: 'symbols', label: 'Simbol !@#', on: useSymbols, set: setUseSymbols },
    { id: 'amb', label: 'Hindari l I O 0 1', on: avoidAmbiguous, set: setAvoidAmbiguous },
  ];

  return (
    <ToolShell title="Bikin Password" desc="Password acak yang kuat, dibuat di perangkat kamu." icon="🔐">
      <div className="panel">
        <div className="field">
          <label className="label" htmlFor="pw-len">
            Panjang: <strong style={{ color: 'var(--accent-soft)' }}>{length} karakter</strong>
          </label>
          <input
            id="pw-len"
            type="range"
            min="6"
            max="64"
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
        </div>

        <div className="field" style={{ display: 'grid', gap: 8 }}>
          {toggles.map((t) => (
            <label
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 14,
                cursor: 'pointer',
                color: t.on ? 'var(--text)' : 'var(--text-dim)',
              }}
            >
              <input
                type="checkbox"
                checked={t.on}
                onChange={(e) => t.set(e.target.checked)}
                style={{ width: 17, height: 17, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              {t.label}
            </label>
          ))}
        </div>

        <button type="button" className="btn btn-primary btn-full" onClick={generate}>
          🎲 Bikin Password Baru
        </button>

        {password ? (
          <>
            <ResultBox label="Password kamu" value={password}>
              <p
                className="mono"
                style={{ fontSize: 17, letterSpacing: '0.02em', margin: 0, userSelect: 'all' }}
              >
                {password}
              </p>
            </ResultBox>

            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12.5,
                  marginBottom: 6,
                  color: 'var(--text-dim)',
                }}
              >
                <span>Kekuatan</span>
                <strong style={{ color: strength.color }}>{strength.label}</strong>
              </div>
              <div className="meter">
                <i style={{ width: `${strength.score}%`, background: strength.color }} />
              </div>
              <p className="hint">
                ~{Math.round(password.length * Math.log2(poolSize || 1))} bit entropi dari{' '}
                {poolSize} karakter unik.
              </p>
            </div>
          </>
        ) : null}
      </div>
    </ToolShell>
  );
}
