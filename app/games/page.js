'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/icons';
import { allGames } from '@/data/nexrayData';

const CATEGORIES = [
  { id: 'all', label: 'Semua' },
  { id: 'kuis', label: 'Kuis & tebak' },
  { id: 'logika', label: 'Logika & memori' },
  { id: 'speed', label: 'Adu cepat' },
  { id: 'kata', label: 'Kata & emoji' },
];

const CAT_LABEL = {
  kuis: 'Kuis',
  logika: 'Logika',
  speed: 'Adu cepat',
  kata: 'Kata & emoji',
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
  const value = String(slug || '').toLowerCase();
  if (value.includes('kuis') || value.includes('quiz') || value.includes('tebak')) return 'kuis';
  if (value.includes('logic') || value.includes('logika') || value.includes('memory') || value.includes('memori') || value.includes('angka-enigma')) return 'logika';
  if (value.includes('math') || value.includes('typing') || value.includes('ketik')) return 'speed';
  if (value.includes('kata') || value.includes('emoji')) return 'kata';
  return 'kuis';
}

function iconFor(slug) {
  const value = String(slug || '').toLowerCase();
  if (GAME_ICON_MAP[value]) return GAME_ICON_MAP[value];
  if (value.includes('kimia') || value.includes('chem')) return 'flask';
  if (value.includes('lirik') || value.includes('lagu') || value.includes('musi')) return 'music';
  if (value.includes('islamic') || value.includes('islam') || value.includes('quran') || value.includes('ngaji')) return 'moon';
  if (value.includes('siapakah') || value.includes('profesi') || value.includes('tokoh')) return 'user';
  if (value.includes('asah') || value.includes('otak') || value.includes('brain') || value.includes('pola')) return 'bulb';
  if (value.includes('teka') || value.includes('teki') || value.includes('puzzle')) return 'puzzle';
  if (value.includes('receh') || value.includes('lucu') || value.includes('joke')) return 'emoji';
  if (value.includes('logic') || value.includes('logika') || value.includes('gate')) return 'logic';
  if (value.includes('memory') || value.includes('memori')) return 'memory';
  if (value.includes('typing') || value.includes('ketik')) return 'typing';
  if (value.includes('math') || value.includes('hitung') || value.includes('angka')) return 'math';
  if (value.includes('kata') || value.includes('word') || value.includes('sambung')) return 'word';
  if (value.includes('emoji')) return 'emoji';
  if (value.includes('kuis') || value.includes('quiz') || value.includes('tebak')) return 'quiz';
  return 'gamepad';
}

export default function GamesCatalogPage() {
  const safeGames = Array.isArray(allGames) ? allGames : [];
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const searchInputRef = useRef(null);

  useEffect(() => {
    const focusSearchOnSlash = (event) => {
      const target = event.target;
      const isTyping = target instanceof HTMLElement
        && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || isTyping) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener('keydown', focusSearchOnSlash);
    return () => window.removeEventListener('keydown', focusSearchOnSlash);
  }, []);

  const counts = useMemo(() => {
    const map = { all: safeGames.length };
    for (const item of CATEGORIES) {
      if (item.id !== 'all') map[item.id] = safeGames.filter((game) => catOf(game.slug) === item.id).length;
    }
    return map;
  }, [safeGames]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    return safeGames.filter((game) => {
      if (category !== 'all' && catOf(game.slug) !== category) return false;
      if (!term) return true;
      return `${game.name} ${game.desc || ''}`.toLowerCase().includes(term);
    });
  }, [safeGames, category, query]);

  return (
    <div className="shell catalog-page game-catalog-page">
      <Link href="/" className="back catalog-back">
        <Icon name="arrowLeft" size={15} />
        <span>Kembali ke beranda</span>
      </Link>

      <header className="game-catalog-hero">
        <div className="game-catalog-copy">
          <p className="tool-eyebrow">NAWA VANDRELL <i /> ARCADE</p>
          <h1>Ambil jeda.<span>Mainkan pikiran.</span></h1>
          <p>{safeGames.length} game singkat untuk menguji logika, kata, ingatan, dan kecepatanmu. Main santai, kumpulkan skor.</p>
          <div className="game-catalog-highlights">
            <span><Icon name="gamepad" size={15} /> Gratis dimainkan</span>
            <span><Icon name="trophy" size={15} /> Papan peringkat</span>
          </div>
        </div>
        <div className="game-catalog-art" aria-hidden="true">
          <span className="game-art-orbit game-art-orbit-one" />
          <span className="game-art-orbit game-art-orbit-two" />
          <span className="game-art-tile game-art-tile-back"><Icon name="bulb" size={25} /></span>
          <span className="game-art-tile game-art-tile-side"><Icon name="word" size={22} /></span>
          <span className="game-art-main"><Icon name="gamepad" size={42} /></span>
          <span className="game-art-spark game-art-spark-one">✦</span>
          <span className="game-art-spark game-art-spark-two">✧</span>
        </div>
      </header>

      <section className="game-browser" aria-label="Cari dan filter game">
        <div className="search-wrap game-search">
          <span className="search-icon" aria-hidden="true"><Icon name="search" size={19} /></span>
          <label htmlFor="game-search" className="visually-hidden">Cari game</label>
          <input
            id="game-search"
            ref={searchInputRef}
            className="search-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari game: logika, ketik, emoji..."
            autoComplete="off"
          />
          {query ? (
            <button type="button" className="search-clear" aria-label="Hapus pencarian" onClick={() => setQuery('')}>
              <Icon name="close" size={16} />
            </button>
          ) : <kbd className="search-shortcut" aria-hidden="true">/</kbd>}
        </div>

        <div className="chips game-filter-chips" role="group" aria-label="Filter kategori game">
          {CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              className="chip"
              aria-pressed={category === item.id}
              onClick={() => setCategory(item.id)}
            >
              {item.label}
              <span className="chip-count">{counts[item.id] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="section-head catalog-results-head game-results-head">
          <div>
            <p className="catalog-section-label">PILIH PETUALANGANMU</p>
            <h2>{category === 'all' ? 'Semua game' : CAT_LABEL[category]}</h2>
          </div>
          <div className="catalog-results-meta">
            <span aria-live="polite" aria-atomic="true">{results.length} game</span>
            {(query || category !== 'all') ? (
              <button type="button" className="catalog-reset" onClick={() => { setQuery(''); setCategory('all'); }}>
                Hapus filter
              </button>
            ) : null}
          </div>
        </div>

        {results.length === 0 ? (
          <div className="empty catalog-empty">
            <span className="empty-icon" aria-hidden="true"><Icon name="gamepad" size={23} /></span>
            <h3>Belum ada game yang cocok</h3>
            <p>Coba kata lain, atau tampilkan semua game.</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setQuery(''); setCategory('all'); }}>
              Tampilkan semua
            </button>
          </div>
        ) : (
          <div className="grid-cards game-grid">
            {results.map((game) => (
              <Link key={game.slug} href={`/games/${game.slug}`} className="card game-card">
                <div className="game-card-top">
                  <span className="game-card-icon" aria-hidden="true"><Icon name={iconFor(game.slug)} size={23} /></span>
                  <span className="game-card-arrow" aria-hidden="true"><Icon name="arrowRight" size={16} /></span>
                </div>
                <span className="game-card-category">{CAT_LABEL[catOf(game.slug)] || 'Game'}</span>
                <h3>{game.name}</h3>
                <p>{game.desc}</p>
                <span className="game-card-action">Mainkan <Icon name="arrowRight" size={14} /></span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
