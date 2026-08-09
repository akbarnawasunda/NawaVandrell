'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMode } from '@/context/ModeContext';
import { usePlayer } from '@/hooks/usePlayer';
import { useSound } from '@/hooks/useSound';
import Icon, { iconNames } from './icons';

const gameIconMap = {
  'angka-enigma': 'angka',
  'emoji-story': 'emoji',
  'kata-sambung': 'word',
  'logic-gate': 'logic',
  'math-rush': 'math',
  'memory-matrix': 'memory',
  'typing-blitz': 'typing',
};

function RenderGameIcon({ icon, slug, size = 26 }) {
  if (typeof icon === 'string' && iconNames.includes(icon)) return <Icon name={icon} size={size} />;
  if (slug && gameIconMap[slug] && iconNames.includes(gameIconMap[slug])) return <Icon name={gameIconMap[slug]} size={size} />;
  if (slug && (slug.includes('kuis') || slug.includes('quiz'))) return <Icon name="quiz" size={size} />;
  if (icon) return <span>{icon}</span>;
  return <Icon name="gamepad" size={size} />;
}

function MandatoryGate({ onSave }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const clean = name.trim().replace(/\s+/g, ' ');
    if (clean.length < 3) {
      setError('Nama minimal 3 karakter, jangan asal ketik.');
      return;
    }
    if (!onSave(clean)) setError('Gagal nyimpen nama. Coba lagi.');
  };

  return (
    <div className="shell-tool">
      <div className="tool-head">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--accent-soft)', display: 'inline-flex' }}>
            <Icon name="user" size={24} />
          </span>
          Absen Dulu, Bro
        </h1>
        <p>Masukin nama buat nyimpen poin kamu. Nama ini dipake permanen tiap kali kamu balik.</p>
      </div>

      <form className="panel" onSubmit={submit}>
        <div className="field">
          <label className="label" htmlFor="gate-name">Nama kamu</label>
          <input
            id="gate-name"
            className="input"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            placeholder="Ketik nama..."
            maxLength={24}
            autoFocus
          />
        </div>
        {error ? <p className="err">{error}</p> : null}
        <button type="submit" className="btn btn-primary btn-full">
          <Icon name="check" size={16} />
          Simpan & Main
        </button>
        <p className="hint">Nama disimpen di perangkat ini. Ketik yang bener, gak ada tombol skip.</p>
      </form>
    </div>
  );
}

export default function GameShell({ title, desc, icon, slug, stats, children, sound, playerName, score }) {
  const { isPro } = useMode();
  const player = usePlayer();
  const fallbackSound = useSound();
  const snd = sound || fallbackSound;

  if (!player.ready) return null;

  const displayName = player.name || playerName;
  const displayScore = player.score > 0 ? player.score : score;

  // GERBANG WAJIB: belum ada nama = game gak di-render
  if (!displayName) {
    return <MandatoryGate onSave={player.saveName} />;
  }

  return (
    <div className="shell-tool">
      <Link href="/games" className="back">
        <Icon name="arrowLeft" size={15} />
        Semua game
      </Link>

      <div className="tool-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span aria-hidden="true" style={{ color: 'var(--accent-soft)', display: 'inline-flex' }}>
              <RenderGameIcon icon={icon} slug={slug} size={26} />
            </span>
            <span>{title}</span>
          </h1>
          {desc ? <p>{desc}</p> : null}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={snd.toggle}
          aria-label={snd.enabled ? 'Matikan suara' : 'Nyalakan suara'}
          style={{ flexShrink: 0, padding: '0 12px' }}
        >
          <Icon name={snd.enabled ? 'volumeOn' : 'volumeOff'} size={16} />
        </button>
      </div>

      {isPro && stats?.length ? (
        <div className="stat-row">
          {stats.map((s) => (
            <div className="stat" key={s.label}>
              <b style={{ color: s.color || 'var(--text)' }}>{s.value}</b>
              <small>{s.label}</small>
            </div>
          ))}
        </div>
      ) : null}

      <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: '0 0 14px' }}>
        Pemain: <strong style={{ color: 'var(--accent-soft)' }}>{displayName}</strong>
        {typeof displayScore === 'number' ? ` · total ${displayScore} poin` : ''}
      </p>

      {children}
    </div>
  );
}

// compat: file game lama yang masih import PlayerGate gak bakal error.
// gerbang wajib sekarang di-handle langsung sama GameShell.
export function PlayerGate() {
  return null;
}
