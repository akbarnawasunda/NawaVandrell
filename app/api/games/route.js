import { chunks } from '@/data/games/index';

export const dynamic = 'force-dynamic';

let cache = null;
function loadGames() {
  if (cache) return cache;
  cache = {};
  for (const mod of chunks) {
    if (mod.game) {
      const key = String(mod.game).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!cache[key]) {
        cache[key] = { game: mod.game, key, displayName: mod.displayName, items: [] };
      }
      cache[key].items.push(...(mod.items || []));
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
    const summary = Object.values(games).map((g) => ({
      slug: g.game,
      key: g.key,
      name: g.displayName,
      count: g.items.length,
    }));
    return Response.json(summary);
  }

  const cleanCat = String(cat || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const g = games[cleanCat];

  if (!cat || !g) {
    return Response.json({ error: 'Game tidak ada' }, { status: 404 });
  }

  let pool = g.items.filter((q) => q.d === diff && !exclude.includes(q.id));
  if (pool.length === 0) pool = g.items.filter((q) => !exclude.includes(q.id));
  if (pool.length === 0) {
    return Response.json({ error: 'Soal habis' }, { status: 404 });
  }

  const pick = pool[Math.floor(Math.random() * pool.length)];
  return Response.json(pick);
}
