import Link from 'next/link';
import SearchHome from '@/components/SearchHome';
import Icon from '@/components/icons';
import { featuredTools } from '@/data/featuredTools';
import { allGames } from '@/data/gameCatalog';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Workbench kerja, dokumen, dan operasional',
  description: 'Satu ruang kerja gratis untuk tugas harian, rapat, jadwal shift, inventaris, rekap nilai, dan alat produktivitas. Data disimpan di browser.',
  path: '/',
});

const GAME_PICKS = ['tebaktebakan', 'logic-gate', 'math-rush', 'typing-blitz', 'memory-matrix', 'susunkata'];

export default function HomePage() {
  const tools = Array.isArray(featuredTools) ? featuredTools.filter((tool) => tool.slug !== 'games') : [];
  const games = Array.isArray(allGames) ? allGames : [];
  const picks = GAME_PICKS.map((slug) => games.find((game) => game.slug === slug)).filter(Boolean);
  return (
    <div className="shell workbench-shell">
      <SearchHome tools={tools} />
      <section className="home-games-strip workbench-games" aria-labelledby="games-title">
        <div className="workbench-section-heading">
          <div><p className="section-eyebrow">JEDA SEBENTAR</p><h2 id="games-title">Istirahat sejenak?</h2></div>
          <Link href="/games" className="section-link">Lihat semua game <Icon name="arrowRight" size={15} /></Link>
        </div>
        <div className="game-strip">{picks.map((game) => <Link key={game.slug} href={`/games/${game.slug}`} className="game-strip-link"><span className="game-strip-icon" aria-hidden="true">{game.icon && game.icon.length <= 4 ? game.icon : <Icon name="gamepad" size={16} />}</span><span className="game-strip-name">{game.name}</span></Link>)}</div>
      </section>
    </div>
  );
}
