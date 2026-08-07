'use client';

import Link from 'next/link';
import { useState } from 'react';
import { allGames, gameFilters } from '@/data/nexrayData';

export default function GamesIndexPage() {
  const [filter, setFilter] = useState('all');

  const games = allGames.filter((g) => filter === 'all' || g.type === filter);
  const counts = {
    all: allGames.length,
    quiz: allGames.filter((g) => g.type === 'quiz').length,
    arcade: allGames.filter((g) => g.type === 'arcade').length,
  };

  return (
    <div className="shell">
      <Link href="/" className="back">
        ← Kembali
      </Link>

      <div className="tool-head">
        <h1>🎮 Semua Game</h1>
        <p>{allGames.length} game siap dimainkan. Poin kamu tersimpan otomatis.</p>
      </div>

      <div className="chips" style={{ justifyContent: 'flex-start', marginBottom: 18 }}>
        {gameFilters.map((f) => (
          <button
            key={f.id}
            type="button"
            className="chip"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            <span className="chip-count">{counts[f.id]}</span>
          </button>
        ))}
        <Link href="/leaderboard" className="chip" style={{ textDecoration: 'none' }}>
          🏆 Peringkat
        </Link>
      </div>

      <div className="grid-cards">
        {games.map((game) => (
          <Link key={game.slug} href={`/games/${game.slug}`} className="card">
            <span className="card-icon" aria-hidden="true">
              {game.icon}
            </span>
            <h3>{game.name}</h3>
            <p>{game.desc}</p>
            <span className="card-tag">{game.type === 'quiz' ? 'Kuis' : 'Arcade'}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
