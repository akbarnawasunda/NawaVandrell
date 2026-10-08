'use client';

import Link from 'next/link';
import { useState } from 'react';
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
  if (icon) return <span className="tool-emoji-icon">{icon}</span>;
  return <Icon name="gamepad" size={size} />;
}

function MandatoryGate({ onSave }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const submit = (event) => {
    event.preventDefault();
    const clean = name.trim().replace(/\s+/g, ' ');
    if (clean.length < 3) {
      setError('Nama minimal 3 karakter.');
      return;
    }
    if (!onSave(clean)) setError('Nama belum tersimpan. Coba lagi.');
  };

  return (
    <div className="shell-tool game-gate">
      <div className="game-gate-mark" aria-hidden="true"><Icon name="user" size={25} /></div>
      <p className="tool-eyebrow">SEBELUM MULAI</p>
      <h1>Simpan skor kamu.</h1>
      <p className="game-gate-copy">
        Pilih nama panggilan untuk papan peringkat. Nama disimpan di perangkat ini; skor yang dikirim bisa tampil di papan publik.
      </p>
      <form className="panel game-gate-panel" onSubmit={submit}>
        <div className="field">
          <label className="label" htmlFor="gate-name">Nama panggilan</label>
          <input
            id="gate-name"
            className="input"
            value={name}
            onChange={(event) => { setName(event.target.value); setError(''); }}
            placeholder="Ketik nama yang ingin ditampilkan"
            maxLength={24}
            autoComplete="nickname"
            autoFocus
            aria-describedby="gate-name-hint"
          />
        </div>
        {error ? <p className="err" role="alert">{error}</p> : null}
        <button type="submit" className="btn btn-primary btn-full">
          <Icon name="gamepad" size={17} />
          Simpan dan main
        </button>
        <p className="hint" id="gate-name-hint">Nama maksimal 24 karakter. Kamu bisa memakai nama panggilan.</p>
      </form>
    </div>
  );
}

export default function GameShell({ title, desc, icon, slug, stats, children, sound, playerName, score }) {
  const player = usePlayer();
  const fallbackSound = useSound();
  const activeSound = sound || fallbackSound;

  if (!player.ready) return null;

  const displayName = player.name || playerName;
  const displayScore = player.score > 0 ? player.score : score;

  if (!displayName) return <MandatoryGate onSave={player.saveName} />;

  const playerInitial = String(displayName).trim().charAt(0).toUpperCase() || 'P';

  return (
    <div className="shell-tool game-page-shell">
      <Link href="/games" className="back">
        <Icon name="arrowLeft" size={15} />
        <span>Semua game</span>
      </Link>

      <header className="tool-head tool-shell-head game-tool-head">
        <span className="tool-head-mark" aria-hidden="true">
          <RenderGameIcon icon={icon} slug={slug} size={25} />
        </span>
        <div className="tool-head-copy">
          <p className="tool-eyebrow">NAWA VANDRELL <i /> ARCADE</p>
          <h1>{title}</h1>
          {desc ? <p className="tool-head-description">{desc}</p> : null}
        </div>
        <button
          type="button"
          className="audio-toggle game-audio-toggle"
          onClick={activeSound.toggle}
          aria-label={activeSound.enabled ? 'Matikan suara game' : 'Nyalakan suara game'}
          aria-pressed={activeSound.enabled}
          title={activeSound.enabled ? 'Matikan suara game' : 'Nyalakan suara game'}
        >
          <Icon name={activeSound.enabled ? 'volumeOn' : 'volumeOff'} size={17} />
        </button>
      </header>

      {stats?.length ? (
        <div className="stat-row game-stat-row">
          {stats.map((stat) => (
            <div className="stat" key={stat.label}>
              <b style={{ color: stat.color || 'var(--text)' }}>{stat.value}</b>
              <small>{stat.label}</small>
            </div>
          ))}
        </div>
      ) : null}

      <div className="player-strip">
        <span className="player-avatar" aria-hidden="true">{playerInitial}</span>
        <span className="player-meta">
          <small>MAIN SEBAGAI</small>
          <strong>{displayName}</strong>
        </span>
        {typeof displayScore === 'number' ? (
          <span className="player-score"><Icon name="trophy" size={15} /> {displayScore} <small>POIN</small></span>
        ) : null}
      </div>

      {children}
    </div>
  );
}

// Compat: older game pages may still import PlayerGate.
export function PlayerGate() {
  return null;
}
