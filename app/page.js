import Link from 'next/link';
import SearchHome from '@/components/SearchHome';
import Icon, { getToolIconName, iconNames } from '@/components/icons';
import { featuredTools, getToolHref } from '@/data/featuredTools';
import { allGames } from '@/data/nexrayData';
import { getRanked } from '@/lib/db';

export const dynamic = 'force-dynamic';

function QuickToolLink({ tool }) {
  if (!tool) return null;
  const iconName = getToolIconName(tool);
  return (
    <Link href={getToolHref(tool)} className="quick-tool-link">
      <span className="quick-tool-icon" aria-hidden="true">
        <Icon name={iconNames.includes(iconName) ? iconName : 'sparkles'} size={19} />
      </span>
      <span className="quick-tool-copy">
        <strong>{tool.title}</strong>
        <small>{tool.desc}</small>
      </span>
      <Icon name="arrowRight" size={16} className="quick-tool-arrow" />
    </Link>
  );
}

export default async function HomePage() {
  const safeTools = Array.isArray(featuredTools) ? featuredTools : [];
  const safeGames = Array.isArray(allGames) ? allGames : [];
  const allToolItems = safeTools.filter((tool) => tool.slug !== 'games');
  const downloader = safeTools.find((tool) => tool.slug === 'downloader');
  const simTool = safeTools.find((tool) => tool.slug === 'sim-application');
  const quickTools = ['qr-code', 'image-compressor', 'sticker-maker']
    .map((slug) => safeTools.find((tool) => tool.slug === slug))
    .filter(Boolean);

  let topPlayers = [];
  try {
    topPlayers = await getRanked(3);
  } catch {
    topPlayers = [];
  }

  return (
    <div className="shell home-shell">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <p className="home-kicker"><span aria-hidden="true" /> TOOLS HARIAN <i /> KREATIVITAS <i /> ARCADE</p>
          <h1 id="home-title">Hal praktis,<br /><span>jadi lebih mudah.</span></h1>
          <p className="home-lede">
            Bereskan pekerjaan kecil, buat sesuatu yang baru, rapikan rekap SIM kolektif, atau ambil jeda dengan game singkat.
          </p>
          <div className="home-hero-actions">
            <a href="#tools" className="btn btn-primary home-primary-cta">
              Cari tools <Icon name="arrowDown" size={16} />
            </a>
            <Link href="/games" className="btn btn-ghost home-secondary-cta">
              <Icon name="gamepad" size={17} /> Lihat arcade
            </Link>
          </div>
          <p className="home-hero-summary">
            <strong>{allToolItems.length} tools</strong><span aria-hidden="true">·</span><strong>{safeGames.length} game</strong><span aria-hidden="true">·</span>gratis tanpa langganan
          </p>
        </div>

        <aside className="home-quick-panel" aria-labelledby="quick-tools-title">
          <div className="home-quick-heading">
            <div>
              <p className="section-eyebrow">MULAI CEPAT</p>
              <h2 id="quick-tools-title">Pintasan populer</h2>
            </div>
            <a href="#tools" className="quiet-link">Semua tools <Icon name="arrowRight" size={15} /></a>
          </div>
          <div className="quick-tool-list">
            {quickTools.map((tool) => <QuickToolLink key={tool.slug} tool={tool} />)}
          </div>
          {simTool ? (
            <Link href={getToolHref(simTool)} className="quick-sim-link">
              <span className="quick-sim-icon" aria-hidden="true"><Icon name="fingerprint" size={19} /></span>
              <span className="quick-sim-copy">
                <small>REKAP SIM KOLEKTIF</small>
                <strong>Banyak KTP. Satu rekap.</strong>
              </span>
              <Icon name="arrowRight" size={16} className="quick-tool-arrow" />
            </Link>
          ) : null}
        </aside>
      </section>

      <section className="home-featured" aria-labelledby="featured-title">
        <div className="section-intro">
          <div>
            <p className="section-eyebrow">PILIHAN UNTUK MEMULAI</p>
            <h2 id="featured-title">Pilih sesuai kebutuhan.</h2>
          </div>
          <Link href="#tools" className="section-link">Jelajahi semua tools <Icon name="arrowRight" size={15} /></Link>
        </div>

        <div className="featured-grid">
          {downloader ? (
            <Link href={getToolHref(downloader)} className="featured-card featured-card-downloader">
              <span className="featured-card-icon"><Icon name="download" size={21} /></span>
              <span className="featured-card-label">VIDEO & AUDIO</span>
              <h3>{downloader.title}</h3>
              <p>{downloader.desc}</p>
              <span className="featured-card-action">Buka downloader <Icon name="arrowRight" size={15} /></span>
            </Link>
          ) : null}

          {simTool ? (
            <Link href={getToolHref(simTool)} className="featured-card featured-card-sim">
              <span className="featured-card-icon"><Icon name="fingerprint" size={21} /></span>
              <span className="featured-card-label">BANYAK KTP. SATU REKAP.</span>
              <h3>Rekap SIM kolektif</h3>
              <p>Rapikan data, pilihan SIM, catatan, dan foto peserta dalam satu daftar.</p>
              <span className="featured-card-action">Buka rekap <Icon name="arrowRight" size={15} /></span>
            </Link>
          ) : null}

          <Link href="/games" className="featured-card featured-card-games">
            <span className="featured-card-icon"><Icon name="gamepad" size={21} /></span>
            <span className="featured-card-label">JEDA SEBENTAR</span>
            <h3>Game arcade</h3>
            <p>{safeGames.length} game untuk menguji logika, ingatan, kata, dan kecepatan.</p>
            <span className="featured-card-action">Pilih game <Icon name="arrowRight" size={15} /></span>
          </Link>

          <Link href="/leaderboard" className="featured-card featured-card-leaderboard">
            <span className="featured-card-icon"><Icon name="trophy" size={21} /></span>
            <span className="featured-card-label">SKOR PEMAIN</span>
            <h3>Papan peringkat</h3>
            {topPlayers.length ? (
              <ol className="rank-preview-list" aria-label="Tiga pemain teratas">
                {topPlayers.map((player, index) => (
                  <li key={`${player.name}-${index}`}>
                    <span className="rank-preview-place">{index + 1}</span>
                    <span className="rank-preview-name">{player.name}</span>
                    <strong>{player.score} poin</strong>
                  </li>
                ))}
              </ol>
            ) : <p>Belum ada skor. Jadi yang pertama masuk papan.</p>}
            <span className="featured-card-action">Lihat peringkat <Icon name="arrowRight" size={15} /></span>
          </Link>
        </div>
      </section>

      <section id="tools" className="tool-catalog" aria-labelledby="tools-title">
        <div className="section-intro catalog-intro">
          <div>
            <p className="section-eyebrow">KATALOG</p>
            <h2 id="tools-title">Apa yang mau kamu bereskan?</h2>
            <p>Cari alat berdasarkan kebutuhan, lalu langsung buka.</p>
          </div>
          <span className="catalog-total"><Icon name="sparkles" size={15} /> {allToolItems.length} tools</span>
        </div>
        <SearchHome tools={allToolItems} />
      </section>
    </div>
  );
}
