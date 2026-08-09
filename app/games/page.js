// app/games/page.js

'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import Icon from '@/components/icons';
import { allGames } from '@/data/nexrayData';

const CATEGORIES = [
  { id: 'all', label: 'Semua' },
  { id: 'kuis', label: 'Kuis & Tebak' },
  { id: 'logika', label: 'Logika & Memori' },
  { id: 'speed', label: 'Adu Cepat' },
  { id: 'kata', label: 'Kata & Emoji' },
];

const CAT_LABEL = {
  kuis: 'Kuis',
  logika: 'Logika',
  speed: 'Adu Cepat',
  kata: 'Kata',
};

const GAME_ICON_MAP = {
  'angka-enigma': 'angka',
  'emoji-story': 'emoji',
  'kata-sambung': 'word',
  'logic-gate': 'logic',
  'math-rush': 'math',
  'memory-matrix': 'memory',
  'typing-blitz': 'typing',
};

function catOf(slug) {
  const s = String(slug || '');
  if (s.includes('kuis') || s.includes('quiz') || s.includes('tebak')) return 'kuis';
  if (
    s.includes('logic') ||
    s.includes('logika') ||
    s.includes('memory') ||
    s.includes('memori') ||
    s.includes('angka-enigma')
  )
    return 'logika';
  if (s.includes('math') || s.includes('typing') || s.includes('ketik')) return 'speed';
  if (s.includes('kata') || s.includes('emoji')) return 'kata';
  return 'kuis';
}

function iconFor(slug) {
  const s = String(slug || '').toLowerCase();

  if (GAME_ICON_MAP[s]) return GAME_ICON_MAP[s];

  if (s.includes('kimia') || s.includes('chem')) return 'flask';
  if (s.includes('lirik') || s.includes('lagu') || s.includes('musi')) return 'music';
  if (s.includes('islamic') || s.includes('islam') || s.includes('quran') || s.includes('ngaji')) return 'moon';
  if (s.includes('siapakah') || s.includes('profesi') || s.includes('tokoh')) return 'user';
  if (s.includes('asah') || s.includes('otak') || s.includes('brain') || s.includes('pola')) return 'bulb';
  if (s.includes('teka') || s.includes('teki') || s.includes('puzzle')) return 'puzzle';
  if (s.includes('tebakan') || s.includes('receh') || s.includes('lucu') || s.includes('joke')) return 'emoji';
  if (s.includes('logic') || s.includes('logika') || s.includes('gate')) return 'logic';
  if (s.includes('memory') || s.includes('memori')) return 'memory';
  if (s.includes('typing') || s.includes('ketik')) return 'typing';
  if (s.includes('math') || s.includes('hitung') || s.includes('angka')) return 'math';
  if (s.includes('kata') || s.includes('word') || s.includes('sambung')) return 'word';
  if (s.includes('emoji')) return 'emoji';
  if (s.includes('kuis') || s.includes('quiz') || s.includes('tebak')) return 'quiz';

  return 'gamepad';
}

export default function GamesCatalogPage() {
  const safeGames = Array.isArray(allGames) ? allGames : [];
  const [cat, setCat] = useState('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const map = { all: safeGames.length };
    for (const c of CATEGORIES) {
      if (c.id === 'all') continue;
      map[c.id] = safeGames.filter((g) => catOf(g.slug) === c.id).length;
    }
    return map;
  }, [safeGames]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return safeGames.filter((g) => {
      if (cat !== 'all' && catOf(g.slug) !== cat) return false;
      if (!q) return true;
      return `${g.name} ${g.desc || ''}`.toLowerCase().includes(q);
    });
  }, [safeGames, cat, query]);

  return (
    <div className="shell">
      <Link href="/" className="back">
        <Icon name="arrowLeft" size={15} />
        Beranda
      </Link>

      <div className="tool-head">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--accent-soft)', display: 'inline-flex' }} aria-hidden="true">
            <Icon name="gamepad" size={26} />
          </span>
          Game Arcade
        </h1>
        <p>{safeGames.length} game gratis. Main, kumpulin poin, masuk papan peringkat.</p>
      </div>

      <div className="search-wrap" style={{ margin: '0 0 18px', maxWidth: 'none' }}>
        <span className="search-icon" aria-hidden="true" style={{ display: 'inline-flex' }}>
          <Icon name="search" size={18} />
        </span>
        <input
          className="search-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari game... contoh: kuis, ketik, logika"
          aria-label="Cari game"
        />
      </div>

      <div
        className="chips"
        role="group"
        aria-label="Filter kategori game"
        style={{ justifyContent: 'flex-start' }}
      >
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className="chip"
            aria-pressed={cat === c.id}
            onClick={() => setCat(c.id)}
          >
            {c.label}
            <span className="chip-count">{counts[c.id] ?? 0}</span>
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <div className="empty">
          <p style={{ margin: '0 auto 10px', width: 'fit-content', color: 'var(--text-faint)' }}>
            <Icon name="gamepad" size={26} />
          </p>
          <p style={{ margin: '0 0 6px', fontSize: 15, color: 'var(--text-dim)' }}>
            Gak ada game yang cocok
          </p>
          <p style={{ margin: 0 }}>Coba kata lain atau ganti kategori.</p>
        </div>
      ) : (
        <div className="grid-cards" style={{ marginTop: 16 }}>
          {results.map((game) => (
            <Link key={game.slug} href={`/games/${game.slug}`} className="card">
              <span
                className="card-icon"
                aria-hidden="true"
                style={{ display: 'inline-flex', color: 'var(--accent-soft)', marginBottom: 12 }}
              >
                <Icon name={iconFor(game.slug)} size={28} />
              </span>
              <h3>{game.name}</h3>
              <p>{game.desc}</p>
              <span className="card-tag">{CAT_LABEL[catOf(game.slug)] || 'Game'}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
