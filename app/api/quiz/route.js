import { chunks } from '@/data/quiz/index';

export const dynamic = 'force-dynamic';

let cache = null;
function loadCategories() {
  if (cache) return cache;
  cache = {};
  for (const mod of chunks) {
    if (mod.category) {
      if (!cache[mod.category]) {
        cache[mod.category] = { category: mod.category, displayName: mod.displayName, questions: [] };
      }
      cache[mod.category].questions.push(...(mod.questions || []));
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

  const categories = loadCategories();

  if (list === '1') {
    const summary = Object.values(categories).map(c => ({
      slug: c.category,
      name: c.displayName,
      count: c.questions.length,
    }));
    return Response.json(summary, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  }

  if (!cat || !categories[cat]) {
    return Response.json({ error: 'Kategori tidak ada' }, { status: 404 });
  }

  const mod = categories[cat];
  let pool = mod.questions.filter(q => q.d === diff && !exclude.includes(q.id));
  if (pool.length === 0) pool = mod.questions.filter(q => !exclude.includes(q.id));
  if (pool.length === 0) {
    return Response.json({ error: 'Soal habis, coba kategori lain' }, { status: 404 });
  }

  const pick = pool[Math.floor(Math.random() * pool.length)];

  return Response.json(
    { id: pick.id, q: pick.q, d: pick.d, hint: pick.hint || null, total: pool.length },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(req) {
  const { id, cat } = await req.json().catch(() => ({}));
  const categories = loadCategories();
  if (!cat || !categories[cat]) return Response.json({ error: 'Kategori tidak ada' }, { status: 404 });
  const q = categories[cat].questions.find(x => x.id === id);
  if (!q) return Response.json({ error: 'Soal tidak ada' }, { status: 404 });
  return Response.json({ a: q.a, alt: q.alt || [], explain: q.explain });
}
