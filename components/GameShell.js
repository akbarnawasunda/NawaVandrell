'use client';

import Link from 'next/link';
import { useMode } from '@/context/ModeContext';
import { useSound } from '@/hooks/useSound';

/**
 * Wrapper standar game.
 * Simple Mode: judul + isi saja (tanpa XP/streak di header, sesuai spek).
 * Pro Mode: baris stats (skor, streak, combo) muncul.
 */
export default function GameShell({
  title,
  desc,
  icon,
  stats,
  children,
  sound,
  playerName,
  score,
}) {
  const { isPro } = useMode();
  const fallbackSound = useSound();
  const snd = sound || fallbackSound;

  return (
    <div className="shell-tool">
      <Link href="/games" className="back">
        ← Semua game
      </Link>

      <div
        className="tool-head"
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}
      >
        <div>
          <h1>
            {icon ? <span aria-hidden="true">{icon} </span> : null}
            {title}
          </h1>
          {desc ? <p>{desc}</p> : null}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={snd.toggle}
          aria-label={snd.enabled ? 'Matikan suara' : 'Nyalakan suara'}
          title={snd.enabled ? 'Matikan suara' : 'Nyalakan suara'}
          style={{ flexShrink: 0, padding: '0 12px' }}
        >
          {snd.enabled ? '🔊' : '🔇'}
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

      {isPro && playerName ? (
        <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: '0 0 14px' }}>
          Pemain: <strong style={{ color: 'var(--accent-soft)' }}>{playerName}</strong>
          {typeof score === 'number' ? ` · total ${score} poin` : ''}
        </p>
      ) : null}

      {children}
    </div>
  );
}

/** Kotak nama pemain — dipakai semua game agar skor bisa masuk leaderboard. */
export function PlayerGate({ name, onSave }) {
  return (
    <form
      className="panel"
      style={{ marginBottom: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        const value = new FormData(e.currentTarget).get('nama');
        onSave(value);
      }}
    >
      <label className="label" htmlFor="player-name">
        Nama kamu (buat masuk papan peringkat)
      </label>
      <div style={{ display: 'flex', gap: 9 }}>
        <input
          id="player-name"
          name="nama"
          className="input"
          defaultValue={name}
          placeholder="Ketik nama..."
          maxLength={24}
          autoComplete="nickname"
        />
        <button type="submit" className="btn btn-primary" style={{ flexShrink: 0 }}>
          Simpan
        </button>
      </div>
      <p className="hint">Bisa dilewati — main tanpa nama juga boleh.</p>
    </form>
  );
}
