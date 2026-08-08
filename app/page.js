// app/page.js

import Link from 'next/link';
import SearchHome from '@/components/SearchHome';
import Icon, { iconNames } from '@/components/icons';
import { featuredTools } from '@/data/featuredTools';
import { allGames } from '@/data/nexrayData';
import { getRanked } from '@/lib/db';

export const dynamic = 'force-dynamic';

const gameIconMap = {
  'angka-enigma': 'angka',
  'emoji-story': 'emoji',
  'kata-sambung': 'word',
  'logic-gate': 'logic',
  'math-rush': 'math',
  'memory-matrix': 'memory',
  'typing-blitz': 'typing',
};

function GameCardIcon({ game, size = 28 }) {
  const slug = String(game?.slug || '');

  let iconName = gameIconMap[slug];

  if (!iconName) {
    if (slug.includes('kuis') || slug.includes('quiz')) {
      iconName = 'quiz';
    } else if (slug.includes('angka')) {
      iconName = 'angka';
    } else if (slug.includes('emoji')) {
      iconName = 'emoji';
    } else if (slug.includes('kata') || slug.includes('word')) {
      iconName = 'word';
    } else if (slug.includes('logic') || slug.includes('logika')) {
      iconName = 'logic';
    } else if (slug.includes('math') || slug.includes('angka-cepat')) {
      iconName = 'math';
    } else if (slug.includes('memory') || slug.includes('memori')) {
      iconName = 'memory';
    } else if (slug.includes('typing') || slug.includes('ketik')) {
      iconName = 'typing';
    } else {
      iconName = 'gamepad';
    }
  }

  if (!iconNames.includes(iconName)) {
    iconName = 'gamepad';
  }

  return (
    <span
      className="card-icon"
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--accent-soft)',
        marginBottom: 12,
      }}
    >
      <Icon name={iconName} size={size} />
    </span>
  );
}

export default async function HomePage() {
  const safeTools = Array.isArray(featuredTools) ? featuredTools : [];
  const safeGames = Array.isArray(allGames) ? allGames : [];

  const essentialTools = safeTools
    .filter((tool) => tool.slug !== 'games')
    .slice(0, 10);

  const gamePreview = safeGames.slice(0, 4);

  let top3 = [];

  try {
    top3 = await getRanked(3);
  } catch {
    top3 = [];
  }

  return (
    <div className="shell">
      {/* Hero + Search + Essential Tools */}
      <section className="hero">
        <span className="hero-badge simple-only">
          {essentialTools.length} tools · {safeGames.length} game
        </span>

        <span className="hero-badge pro-only">
          Neuro Core Digital Arsenal
        </span>

        <h1>
          <span className="grad">Tools yang beneran gampang dipakai</span>
        </h1>

        <p className="sub">
          Bikin QR, stiker WA, kompres foto, download video, sampai main kuis.
          Semua gratis, tanpa daftar.
        </p>

        <SearchHome tools={essentialTools} />
      </section>

      {/* Mini Games Preview */}
      <section>
        <div className="section-head">
          <h2>Main Game</h2>

          <Link
            href="/games"
            style={{
              fontSize: 13.5,
              color: 'var(--accent-soft)',
              fontWeight: 600,
            }}
          >
            Lihat semua {safeGames.length} game →
          </Link>
        </div>

        <div className="grid-cards">
          {gamePreview.map((game, i) => (
            <Link
              key={game.slug || `${game.name}-${i}`}
              href={`/games/${game.slug}`}
              className="card"
            >
              <GameCardIcon game={game} size={28} />

              <h3>{game.name}</h3>
              <p>{game.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Leaderboard Top 3 Preview */}
      <section>
        <div className="section-head">
          <h2>Papan Peringkat</h2>

          <Link
            href="/leaderboard"
            style={{
              fontSize: 13.5,
              color: 'var(--accent-soft)',
              fontWeight: 600,
            }}
          >
            Lihat ranking →
          </Link>
        </div>

        <div className="panel">
          {top3.length > 0 ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {top3.map((row, i) => (
                <div
                  key={`${row.name}-${i}`}
                  className={`rank-row ${
                    i === 0 ? 'gold' : i === 1 ? 'silver' : 'bronze'
                  }`}
                >
                  <span
                    style={{
                      minWidth: 36,
                      fontWeight: 800,
                      color: 'var(--text-faint)',
                    }}
                  >
                    #{i + 1}
                  </span>

                  <span
                    style={{
                      flex: 1,
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.name}
                  </span>

                  <span className="rank-score">{row.score}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 14 }}>
              Belum ada skor.{' '}
              <Link
                href="/games"
                style={{
                  color: 'var(--accent-soft)',
                  fontWeight: 600,
                }}
              >
                Main game
              </Link>{' '}
              dan jadi yang pertama.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
