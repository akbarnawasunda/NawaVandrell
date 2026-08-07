import Link from 'next/link';
import SearchHome from '@/components/SearchHome';
import { featuredTools } from '@/data/featuredTools';
import { allGames } from '@/data/nexrayData';

export default function HomePage() {
  return (
    <div className="shell">
      <section className="hero">
        <span className="hero-badge simple-only">{featuredTools.length} tools · {allGames.length} game</span>
        <span className="hero-badge pro-only">⚡ Neuro Core Digital Arsenal</span>
        <h1>
          <span className="grad">Tools yang beneran gampang dipakai</span>
        </h1>
        <p className="sub">
          Bikin QR, stiker WA, kompres foto, sampai main kuis. Semua gratis, tanpa daftar.
        </p>
        <SearchHome tools={featuredTools} />
      </section>

      <section>
        <div className="section-head">
          <h2>Main Game</h2>
          <Link href="/games" style={{ fontSize: 13.5, color: 'var(--accent-soft)', fontWeight: 600 }}>
            Lihat semua {allGames.length} game →
          </Link>
        </div>
        <div className="grid-cards">
          {allGames.slice(0, 6).map((game) => (
            <Link key={game.slug} href={`/games/${game.slug}`} className="card">
              <span className="card-icon" aria-hidden="true">
                {game.icon}
              </span>
              <h3>{game.name}</h3>
              <p>{game.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>Papan Peringkat</h2>
          <Link href="/leaderboard" style={{ fontSize: 13.5, color: 'var(--accent-soft)', fontWeight: 600 }}>
            Lihat ranking →
          </Link>
        </div>
        <div className="panel">
          <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 14 }}>
            Main game, kumpulin poin, masuk top 20 global. Skor kamu tersimpan otomatis di
            perangkat ini.
          </p>
        </div>
      </section>
    </div>
  );
}
