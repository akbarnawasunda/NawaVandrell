import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = readFileSync(path.join(root, 'data/featuredTools.js'), 'utf8');

function entries() {
  const blocks = catalog.split(/\n  \{\n/).slice(1);
  return blocks.map((block) => {
    const slug = block.match(/slug: '([^']+)'/)?.[1];
    const href = block.match(/href: '([^']+)'/)?.[1];
    const group = block.match(/group: \[([^\]]*)\]/)?.[1];
    return { slug, href, groups: group ? [...group.matchAll(/'([^']+)'/g)].map((m) => m[1]) : [] };
  }).filter((e) => e.slug);
}

test('catalog slugs are unique and every entry has a working route', () => {
  const list = entries();
  const slugs = list.map((e) => e.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'slug duplikat');
  for (const entry of list) {
    if (entry.href) {
      assert.ok(existsSync(path.join(root, 'app', entry.href, 'page.js')), `halaman ${entry.href} tidak ada`);
    } else if (entry.slug !== 'games') {
      assert.ok(existsSync(path.join(root, 'app/tools', entry.slug, 'page.js')), `app/tools/${entry.slug}/page.js tidak ada`);
      const layout = path.join(root, 'app/tools', entry.slug, 'layout.js');
      assert.ok(existsSync(layout), `layout metadata ${entry.slug} tidak ada`);
      assert.match(readFileSync(layout, 'utf8'), new RegExp(`toolMetadata\\('${entry.slug}'\\)`));
    }
  }
});

test('every catalog group is a known category and categories are declared once', () => {
  const categoriesBlock = catalog.slice(catalog.indexOf('export const toolCategories'), catalog.indexOf('];', catalog.indexOf('export const toolCategories')));
  const known = new Set([...categoriesBlock.matchAll(/id: '([^']+)'/g)].map((m) => m[1]));
  for (const entry of entries()) {
    for (const group of entry.groups) assert.ok(known.has(group), `${entry.slug} memakai kategori tak dikenal: ${group}`);
  }
  assert.equal(known.size, categoriesBlock.match(/id: '/g).length);
});

test('new tools are listed in the sitemap', () => {
  const sitemap = readFileSync(path.join(root, 'public/sitemap.xml'), 'utf8');
  for (const entry of entries()) {
    if (entry.href || entry.slug === 'games') continue;
    assert.ok(sitemap.includes(`/tools/${entry.slug}<`), `sitemap belum memuat ${entry.slug}`);
  }
});

test('no product version label appears in the catalog or the new tool pages', () => {
  const files = [catalog];
  for (const entry of entries()) {
    const page = path.join(root, 'app/tools', entry.slug, 'page.js');
    if (existsSync(page)) files.push(readFileSync(page, 'utf8'));
  }
  for (const source of files) {
    assert.doesNotMatch(source, /\bv3\.0\b|versi\s+3\b|Beta\b/i);
  }
});
