import Link from 'next/link';
import SearchHome from '@/components/SearchHome';
import Icon, { iconNames } from '@/components/icons';
import { featuredTools, getToolHref } from '@/data/featuredTools';
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

function GameIcon({ slug, size = 22 }) {
  const slugText = String(slug || '').toLowerCase();
  let iconName = gameIconMap[slugText];
  if (!iconName && (slugText.includes('kuis') || slugText.includes('tebak'))) iconName = 'quiz';
  if (!iconNames.includes(iconName)) iconName = 'gamepad';
  return <Icon name={iconName} size={size} />;
}

function ShowcaseArrow() {
  return <span className="showcase-arrow" aria-hidden="true"><Icon name="arrowRight" size={17} /></span>;
}

export default async function HomePage() {
  const safeTools = Array.isArray(featuredTools) ? featuredTools : [];
  const safeGames = Array.isArray(allGames) ? allGames : [];
  const downloader = safeTools.find((tool) => tool.slug === 'downloader');
  const sticker = safeTools.find((tool) => tool.slug === 'sticker-maker');
  const textSticker = safeTools.find((tool) => tool.slug === 'text-sticker');
  const simTool = safeTools.find((tool) => tool.slug === 'sim-application');
  const allToolItems = safeTools.filter((tool) => tool.slug !== 'games');

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
          <p className="home-kicker"><span aria-hidden="true" /> SATU RUANG UNTUK BANYAK HAL</p>
          <h1 id="home-title">
            Beresin hal kecil.
            <span>Bikin hal besar.</span>
          </h1>
          <p className="home-lede">
            Tools harian, rekap SIM kolektif, dan game singkat — dirancang ringkas, jelas, dan enak dipakai.
          </p>
          <div className="home-hero-actions">
            <a href="#tools" className="btn btn-primary home-primary-cta">
              Jelajahi semua tools
              <Icon name="arrowDown" size={17} />
            </a>
            <Link href="/games" className="btn btn-ghost home-secondary-cta">
              <Icon name="gamepad" size={18} />
              Masuk ke arcade
            </Link>
          </div>
          <div className="home-proof" aria-label={`${allToolItems.length} tools dan ${safeGames.length} game tersedia`}>
            <div className="home-proof-item">
              <strong>{String(allToolItems.length).padStart(2, '0')}</strong>
              <span>TOOLS PRAKTIS</span>
            </div>
            <span className="home-proof-divider" aria-hidden="true" />
            <div className="home-proof-item">
              <strong>{String(safeGames.length).padStart(2, '0')}</strong>
              <span>GAME RINGAN</span>
            </div>
            <span className="home-proof-divider" aria-hidden="true" />
            <div className="home-proof-item home-proof-free">
              <strong>Rp 0</strong>
              <span>TANPA LANGGANAN</span>
            </div>
          </div>
        </div>

        <div className="home-visual" aria-hidden="true">
          <span className="home-visual-orbit home-visual-orbit-one" />
          <span className="home-visual-orbit home-visual-orbit-two" />
          <span className="home-visual-glow" />
          <div className="workspace-window">
            <div className="workspace-window-header">
              <span className="workspace-mark">N</span>
              <span className="workspace-heading">
                <strong>Nawa Vandrell</strong>
                <small>Ruang untuk ide dan hal praktis</small>
              </span>
              <span className="workspace-ready"><i /> SIAP DIPAKAI</span>
            </div>

            <div className="workspace-feature">
              <div className="workspace-feature-topline">
                <span>RUANG KERJA</span>
                <Icon name="sparkles" size={17} />
              </div>
              <strong>Satu tempat.<br /><em>Banyak kemungkinan.</em></strong>
              <div className="workspace-feature-caption">
                <span>TOOLS</span><i /><span>KOLEKTIF</span><i /><span>ARCADE</span>
              </div>
              <div className="workspace-orbit-mark"><Icon name="sparkles" size={22} /></div>
            </div>

            <div className="workspace-shortcuts">
              <div className="workspace-shortcut workspace-shortcut-mint">
                <span><Icon name="qr" size={17} /></span>
                <strong>Bikin QR</strong>
                <small>01</small>
              </div>
              <div className="workspace-shortcut workspace-shortcut-violet">
                <span><Icon name="fingerprint" size={17} /></span>
                <strong>Rekap SIM</strong>
                <small>02</small>
              </div>
              <div className="workspace-shortcut workspace-shortcut-blue">
                <span><Icon name="gamepad" size={17} /></span>
                <strong>Arcade</strong>
                <small>03</small>
              </div>
            </div>
            <div className="workspace-window-footer">
              <span>MUDAH DIMULAI</span>
              <span>BUAT HARI INI LEBIH RINGAN <i>↗</i></span>
            </div>
          </div>

          <div className="workspace-float workspace-float-sim">
            <span className="workspace-float-icon"><Icon name="fingerprint" size={17} /></span>
            <span><small>SIM KOLEKTIF</small><strong>Banyak KTP. Satu rekap.</strong></span>
            <Icon name="check" size={15} />
          </div>
          <div className="workspace-float workspace-float-game">
            <span className="workspace-float-icon"><Icon name="gamepad" size={17} /></span>
            <span><small>SEMPATKAN MAIN</small><strong>{safeGames.length} game siap dicoba</strong></span>
          </div>
          <span className="home-visual-spark home-visual-spark-one" />
          <span className="home-visual-spark home-visual-spark-two" />
        </div>
      </section>

      <section className="home-showcase" aria-labelledby="showcase-title">
        <div className="section-intro">
          <div>
            <p className="section-eyebrow">MULAI DARI FAVORIT</p>
            <h2 id="showcase-title">Yang kamu butuhkan, lebih dekat.</h2>
            <p>Pintasan pilihan buat mulai tanpa banyak langkah.</p>
          </div>
          <Link href="#tools" className="section-link">
            Lihat semua tools <Icon name="arrowRight" size={16} />
          </Link>
        </div>

        <div className="showcase-grid">
          {downloader ? (
            <Link href={getToolHref(downloader)} className="showcase-card showcase-card-download">
              <div className="showcase-card-topline">
                <span className="showcase-index">01 <i /> POPULER</span>
                <ShowcaseArrow />
              </div>
              <div className="download-visual" aria-hidden="true">
                <span className="download-visual-ring download-visual-ring-one" />
                <span className="download-visual-ring download-visual-ring-two" />
                <span className="download-visual-icon"><Icon name="download" size={32} /></span>
                <span className="download-platform download-platform-one">YT</span>
                <span className="download-platform download-platform-two">IG</span>
                <span className="download-platform download-platform-three">♪</span>
                <span className="download-visual-caption">SAVE WHAT MOVES YOU</span>
              </div>
              <div className="showcase-card-copy">
                <span className="showcase-label">VIDEO & AUDIO</span>
                <h3>{downloader.title}</h3>
                <p>{downloader.desc}</p>
                <div className="showcase-platforms">
                  {['TikTok', 'Instagram', 'YouTube', 'Spotify'].map((platform) => <span key={platform}>{platform}</span>)}
                </div>
              </div>
            </Link>
          ) : null}

          {simTool ? (
            <Link href={getToolHref(simTool)} className="showcase-card showcase-card-sim">
              <div className="showcase-card-topline">
                <span className="showcase-index">02 <i /> WORKFLOW</span>
                <ShowcaseArrow />
              </div>
              <div className="roster-art" aria-hidden="true">
                <div className="roster-art-heading"><span>DAFTAR PESERTA</span><span>03 ORANG</span></div>
                {['01', '02', '03'].map((number, index) => (
                  <div className="roster-art-row" key={number}>
                    <span className={`roster-art-avatar roster-art-avatar-${index + 1}`}>{number}</span>
                    <span className="roster-art-lines"><i /><i /></span>
                    <span className="roster-art-chip">SIM {index === 1 ? 'C' : 'A'}</span>
                    <span className="roster-art-check"><Icon name="check" size={12} /></span>
                  </div>
                ))}
              </div>
              <div className="showcase-card-copy">
                <span className="showcase-label">BANYAK KTP. SATU REKAP.</span>
                <h3>Rekap SIM Kolektif</h3>
                <p>Atur data, pilihan SIM, dan foto tiap orang dalam satu roster.</p>
              </div>
            </Link>
          ) : null}

          {sticker ? (
            <Link href={getToolHref(sticker)} className="showcase-card showcase-card-small showcase-card-sticker">
              <div className="showcase-card-topline">
                <span className="showcase-index">03 <i /> KREATIF</span>
                <ShowcaseArrow />
              </div>
              <div className="showcase-icon showcase-icon-mint"><Icon name="sticker" size={23} /></div>
              <div className="showcase-card-copy">
                <h3>{sticker.title}</h3>
                <p>{sticker.desc}</p>
              </div>
            </Link>
          ) : null}

          {textSticker ? (
            <Link href={getToolHref(textSticker)} className="showcase-card showcase-card-small showcase-card-text">
              <div className="showcase-card-topline">
                <span className="showcase-index">04 <i /> KREATIF</span>
                <ShowcaseArrow />
              </div>
              <div className="showcase-icon showcase-icon-violet"><Icon name="case" size={23} /></div>
              <div className="showcase-card-copy">
                <h3>{textSticker.title}</h3>
                <p>{textSticker.desc}</p>
              </div>
            </Link>
          ) : null}

          <Link href="/games" className="showcase-card showcase-card-small showcase-card-arcade">
            <div className="showcase-card-topline">
              <span className="showcase-index">05 <i /> BREAK TIME</span>
              <ShowcaseArrow />
            </div>
            <div className="arcade-icon-stack" aria-hidden="true">
              {safeGames.slice(0, 3).map((game, index) => (
                <span className={`arcade-icon arcade-icon-${index + 1}`} key={game.slug}>
                  <GameIcon slug={game.slug} size={20} />
                </span>
              ))}
            </div>
            <div className="showcase-card-copy">
              <h3>Game Arcade</h3>
              <p>{safeGames.length} game untuk jeda sebentar dan adu skor.</p>
            </div>
          </Link>

          <Link href="/leaderboard" className="showcase-card showcase-card-small showcase-card-rank">
            <div className="showcase-card-topline">
              <span className="showcase-index">06 <i /> KOMUNITAS</span>
              <ShowcaseArrow />
            </div>
            <div className="rank-preview-icon" aria-hidden="true"><Icon name="trophy" size={22} /></div>
            <div className="showcase-card-copy">
              <h3>Papan peringkat</h3>
              {topPlayers.length ? (
                <ol className="rank-preview-list" aria-label="Tiga pemain teratas">
                  {topPlayers.map((player, index) => (
                    <li key={`${player.name}-${index}`}>
                      <span className="rank-preview-place">0{index + 1}</span>
                      <span className="rank-preview-name">{player.name}</span>
                      <strong>{player.score}</strong>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>Belum ada skor. Jadilah yang pertama masuk papan.</p>
              )}
            </div>
          </Link>
        </div>
      </section>

      <section id="tools" className="tool-catalog" aria-labelledby="tools-title">
        <div className="section-intro catalog-intro">
          <div>
            <p className="section-eyebrow">TOOLBOX NAWA VANDRELL</p>
            <h2 id="tools-title">Apa yang mau kamu bereskan?</h2>
            <p>Cari berdasarkan kebutuhan, lalu langsung buka alatnya.</p>
          </div>
          <span className="catalog-total"><Icon name="sparkles" size={16} /> {allToolItems.length} tools</span>
        </div>
        <SearchHome tools={allToolItems} />
      </section>
    </div>
  );
}
