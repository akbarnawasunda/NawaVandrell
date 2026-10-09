import Link from 'next/link';
import SearchHome from '@/components/SearchHome';
import Icon from '@/components/icons';
import { featuredTools } from '@/data/featuredTools';
import { allGames } from '@/data/gameCatalog';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Alat harian yang sederhana dan cepat',
  description: 'Bikin QR, kompres foto, rapikan dokumen, hitung harga, sampai main game singkat. Semua gratis, tanpa akun, langsung di browser.',
  path: '/',
});

const GAME_PICKS = ['tebaktebakan', 'logic-gate', 'math-rush', 'typing-blitz', 'memory-matrix', 'susunkata'];

export default function HomePage() {
  const tools = Array.isArray(featuredTools) ? featuredTools.filter((tool) => tool.slug !== 'games') : [];
  const games = Array.isArray(allGames) ? allGames : [];
  const picks = GAME_PICKS.map((slug) => games.find((game) => game.slug === slug)).filter(Boolean);

  return (
    <div className="shell home-shell">
      <header className="home-head">
        <p className="home-badge"><Icon name="sparkles" size={13} /> NAWA EDITOR · GRATIS · TANPA AKUN</p>
        <h1>
          Semua urusan kecil,<br />
          <span className="home-typed">beres di satu editor.</span>
        </h1>
        <p className="home-lede">
          Ketik apa yang mau kamu lakukan — bikin QR, kompres foto, susun dokumen, hitung-hitungan, sampai main game singkat.
        </p>
        <p className="home-stats">
          <span><strong>{tools.length} alat</strong> siap pakai</span>
          <span aria-hidden="true">·</span>
          <span><strong>{games.length} game</strong> ringan</span>
          <span aria-hidden="true">·</span>
          <span>Diproses cepat di browser</span>
        </p>
      </header>

      <section id="tools" className="tool-catalog" aria-labelledby="tools-title">
        <h2 id="tools-title" className="visually-hidden">Katalog alat Nawa Editor</h2>
        <SearchHome tools={tools} />
      </section>

      <section className="home-games-strip" aria-labelledby="games-title">
        <div className="section-intro">
          <div>
            <p className="section-eyebrow">JEDA SEBENTAR</p>
            <h2 id="games-title">Game ringan buat istirahat</h2>
          </div>
          <Link href="/games" className="section-link">Semua game <Icon name="arrowRight" size={15} /></Link>
        </div>
        <div className="game-strip">
          {picks.map((game) => (
            <Link key={game.slug} href={`/games/${game.slug}`} className="game-strip-link">
              <span className="game-strip-icon" aria-hidden="true">{game.icon && game.icon.length <= 4 ? game.icon : <Icon name="gamepad" size={16} />}</span>
              <span className="game-strip-name">{game.name}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
