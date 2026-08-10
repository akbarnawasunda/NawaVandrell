import { chunks } from '@/data/games/index';

export const dynamic = 'force-dynamic';

let cache = null;
function loadGames() {
  if (cache) return cache;
  cache = {};
  for (const mod of chunks) {
    if (mod.game) {
      if (!cache[mod.game]) {
        cache[mod.game] = { game: mod.game, displayName: mod.displayName, items: [] };
      }
      cache[mod.game].items.push(...(mod.items || []));
    }
  }
  return cache;
}

export async function GET(req) {
  const url = new URL(req.url);
  const cat = url.searchParams.get('cat');
  const diff = url.searchParams.get('diff') || 'easy';
  const exclude = (url.searchParams.get('exclude') || '').split(',').filter(Boolean);
  const list = url.searchParams.get('list');

  const games = loadGames();

  if (list === '1') {
    const summary = Object.values(games).map((g) => ({ slug: g.game, name: g.displayName, count: g.items.length }));
    return Response.json(summary);
  }

  if (!cat || !games[cat]) {
    return Response.json({ error: 'Game tidak ada' }, { status: 404 });
  }

  const g = games[cat];
  let pool = g.items.filter((q) => q.d === diff && !exclude.includes(q.id));
  if (pool.length === 0) pool = g.items.filter((q) => !exclude.includes(q.id));
  if (pool.length === 0) {
    return Response.json({ error: 'Soal habis' }, { status: 404 });
  }

  const pick = pool[Math.floor(Math.random() * pool.length)];
  return Response.json(pick);
}
