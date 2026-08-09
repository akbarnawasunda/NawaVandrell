import { readdir } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';

// cache kategori di memory (biar gak baca disk tiap request)
let cache = null;
async function loadCategories() {
  if (cache) return cache;
  const dir = join(process.cwd(), 'data/quiz');
  const files = (await readdir(dir)).filter(f => f.endsWith('.js') && !f.startsWith('_'));
  cache = {};
  for (const f of files) {
    try {
      const mod = await import(`@/data/quiz/${f.replace('.js', '')}`);
      if (mod.category) cache[mod.category] = mod;
    } catch {}
  }
  return cache;
}

export async function GET(req) {
  const url = new URL(req.url);
  const cat = url.searchParams.get('cat');
  const diff = url.searchParams.get('diff') || 'easy';
  const exclude = (url.searchParams.get('exclude') || '').split(',').filter(Boolean);
  const list = url.searchParams.get('list');

  const categories = await loadCategories();

  // /api/quiz?list=1 -> return daftar kategori (buat homepage/selector)
  if (list === '1') {
    const summary = Object.values(categories).map(c => ({
      slug: c.category,
      name: c.displayName,
      count: c.questions.length,
    }));
    return Response.json(summary, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    });
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

  // return soal TANPA jawaban & explain (biar user gak bisa cheat dari inspect)
  return Response.json(
    {
      id: pick.id,
      q: pick.q,
      d: pick.d,
      hint: pick.hint || null,
      total: pool.length,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

// /api/quiz?reveal=k001&cat=kimia -> reveal jawaban + penjelasan
export async function POST(req) {
  const { id, cat } = await req.json().catch(() => ({}));
  const categories = await loadCategories();
  if (!cat || !categories[cat]) return Response.json({ error: 'Kategori tidak ada' }, { status: 404 });
  const q = categories[cat].questions.find(x => x.id === id);
  if (!q) return Response.json({ error: 'Soal tidak ada' }, { status: 404 });
  return Response.json({
    a: q.a,
    alt: q.alt || [],
    explain: q.explain,
  });
}
