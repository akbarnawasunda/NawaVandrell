import Link from 'next/link';
import SearchHome from '@/components/SearchHome';
import ScrambleText from '@/components/ScrambleText';
import Icon, { iconNames } from '@/components/icons';
import { featuredTools } from '@/data/featuredTools';
import { allGames } from '@/data/nexrayData';
import { getRanked } from '@/lib/db';

export const dynamic = 'force-dynamic';

const gameIconMap = {
  'angka-enigma': 'angka', 'emoji-story': 'emoji', 'kata-sambung': 'word',
  'logic-gate': 'logic', 'math-rush': 'math', 'memory-matrix': 'memory', 'typing-blitz': 'typing',
};

function GameIcon({ slug }) {
  let iconName = gameIconMap[slug];
  if (!iconName) {
    const s = String(slug || '').toLowerCase();
    if (s.includes('kuis') || s.includes('tebak')) iconName = 'quiz';
    else iconName = 'gamepad';
  }
  if (!iconNames.includes(iconName)) iconName = 'gamepad';
  return <Icon name={iconName} size={26} />;
}

export default async function HomePage() {
  const safeTools = Array.isArray(featuredTools) ? featuredTools : [];
  const safeGames = Array.isArray(allGames) ? allGames : [];
  
  const downloader = safeTools.find((t) => t.slug === 'downloader');
  const sticker = safeTools.find((t) => t.slug === 'sticker-maker');
  const textSticker = safeTools.find((t) => t.slug === 'text-sticker');
  const gamesTool = safeTools.find((t) => t.slug === 'games');
  
  const essentialTools = safeTools.filter(
    (t) => !['downloader', 'sticker-maker', 'text-sticker', 'games'].includes(t.slug)
  );

  let top3 = [];
  try { top3 = await getRanked(3); } catch { top3 = []; }

  return (
    <div className="shell">
      <section className="hero">
        <span className="hero-badge simple-only">{safeTools.length} tools · {safeGames.length} game</span>
        <span className="hero-badge pro-only">Neuro Core Digital Arsenal</span>
        
        <h1 className="pro-only" style={{ minHeight: '1.2em' }}>
          <ScrambleText text="Tools yang beneran gampang dipakai." />
        </h1>
        <h1 className="simple-only">
          <span className="grad">Tools yang beneran gampang dipakai</span>
        </h1>
        
        <p className="sub">Bikin QR, stiker WA, kompres foto, download video, sampai main kuis. Semua gratis, tanpa daftar.</p>
        <SearchHome tools={essentialTools} />
      </section>

      <section style={{ marginTop: 10 }}>
        <div className="section-head">
          <h2>Showcase</h2>
          <Link href="/games" style={{ fontSize: 13.5, color: 'var(--accent-soft)', fontWeight: 600 }}>
            Lihat semua game →
          </Link>
        </div>

        <div className="bento">
          {downloader ? (
            <Link href={`/tools/${downloader.slug}`} className="bento-card bento-large" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(99,102,241,0.05))' }}>
              <div className="bento-glow" style={{ background: 'var(--accent)', top: -50, right: -50 }} />
              <span className="bento-tag">Flagship</span>
              <div>
                <h3 className="bento-title">
                  <span style={{ color: 'var(--accent-soft)', display: 'inline-flex' }}>
                    <Icon name="download" size={26} />
                  </span>
                  {downloader.title}
                </h3>
                <p className="bento-desc">{downloader.desc}</p>
              </div>
              <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['TikTok', 'IG', 'YouTube', 'Twitter', 'FB'].map((p) => (
                  <span key={p} style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(255,255,255,0.06)', borderRadius: 999, color: 'var(--text-dim)' }}>
                    {p}
                  </span>
                ))}
              </div>
            </Link>
          ) : null}

          {sticker ? (
            <Link href={`/tools/${sticker.slug}`} className="bento-card">
              <h3 className="bento-title" style={{ fontSize: 18 }}>
                <span style={{ color: 'var(--accent-soft)', display: 'inline-flex' }}>
                  <Icon name="sticker" size={20} />
                </span>
                Stiker WA
              </h3>
              <p className="bento-desc" style={{ fontSize: 12.5 }}>Foto jadi stiker 512x512.</p>
            </Link>
          ) : null}

          {textSticker ? (
            <Link href={`/tools/${textSticker.slug}`} className="bento-card">
              <h3 className="bento-title" style={{ fontSize: 18 }}>
                <span style={{ color: 'var(--accent-soft)', display: 'inline-flex' }}>
                  <Icon name="case" size={20} />
                </span>
                Stiker Teks
              </h3>
              <p className="bento-desc" style={{ fontSize: 12.5 }}>Ala ".brat" bot WA.</p>
            </Link>
          ) : null}

          {gamesTool ? (
            <Link href="/games" className="bento-card bento-wide" style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
              <div>
                <h3 className="bento-title" style={{ fontSize: 20 }}>
                  <span style={{ color: 'var(--accent-soft)', display: 'inline-flex' }}>
                    <Icon name="gamepad" size={24} />
                  </span>
                  Game Arcade
                </h3>
                <p className="bento-desc">{safeGames.length} game gratis. Main, kumpulin poin.</p>
              </div>
              <div style={{ display: 'flex', marginLeft: 'auto', flexShrink: 0 }}>
                {safeGames.slice(0, 3).map((g, i) => (
                  <div key={g.slug} style={{ 
                    width: 44, height: 44, borderRadius: 12, 
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    display: 'grid', placeItems: 'center', color: 'var(--accent-soft)',
                    marginLeft: i > 0 ? -12 : 0, zIndex: 3 - i
                  }}>
                    <GameIcon slug={g.slug} />
                  </div>
                ))}
              </div>
            </Link>
          ) : null}

          <Link href="/leaderboard" className="bento-card bento-wide" style={{ background: 'rgba(251,191,36,0.04)', borderColor: 'rgba(251,191,36,0.15)' }}>
            <h3 className="bento-title" style={{ fontSize: 18 }}>
              <span style={{ color: '#fbbf24', display: 'inline-flex' }}>
                <Icon name="trophy" size={20} />
              </span>
              Papan Peringkat
            </h3>
            {top3.length > 0 ? (
              <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
                {top3.map((row, i) => (
                  <div key={row.name} style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-faint)' }}>#{i + 1}</p>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</p>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--accent-soft)', fontWeight: 800 }}>{row.score}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="bento-desc" style={{ marginTop: 6 }}>Belum ada skor. Jadi yang pertama!</p>
            )}
          </Link>
        </div>
      </section>
    </div>
  );
}
