'use client';

import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';
import { getToolHref, toolCategories } from '@/data/featuredTools';

/**
 * Search + filter kategori.
 * Klik chip SELALU memberi feedback terlihat:
 *  - chip aktif berubah warna (aria-pressed -> CSS)
 *  - baris status di atas grid menyebut filter aktif + jumlah hasil
 */
export default function SearchHome({ tools }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const deferred = useDeferredValue(query);

  const counts = useMemo(() => {
    const map = { all: tools.length };
    for (const cat of toolCategories) {
      if (cat.id === 'all') continue;
      map[cat.id] = tools.filter((t) => t.group?.includes(cat.id)).length;
    }
    return map;
  }, [tools]);

  const results = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    return tools.filter((tool) => {
      const inCategory = category === 'all' || tool.group?.includes(category);
      if (!inCategory) return false;
      if (!q) return true;
      const haystack = `${tool.title} ${tool.desc} ${tool.keywords || ''}`.toLowerCase();
      return q.split(/\s+/).every((word) => haystack.includes(word));
    });
  }, [tools, deferred, category]);

  const activeLabel = toolCategories.find((c) => c.id === category)?.label || 'Semua';
  const filtering = category !== 'all' || query.trim().length > 0;

  return (
    <>
      <div className="search-wrap">
        <span className="search-icon" aria-hidden="true">
          🔎
        </span>
        <input
          className="search-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Mau ngapain hari ini? Contoh: bikin QR, kompres foto..."
          aria-label="Cari tool"
          enterKeyHint="search"
        />
      </div>

      <div className="chips" role="group" aria-label="Filter kategori">
        {toolCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className="chip"
            aria-pressed={category === cat.id}
            onClick={() => setCategory(cat.id)}
          >
            {cat.label}
            <span className="chip-count">{counts[cat.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="section-head">
          <h2 style={{ fontSize: 17 }}>
            {filtering ? `Hasil: ${activeLabel}` : 'Semua Tools'}
          </h2>
          <span aria-live="polite">
            {results.length} tool{results.length === 1 ? '' : 's'}
            {query.trim() ? ` untuk "${query.trim()}"` : ''}
            {filtering ? (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setCategory('all');
                  }}
                  style={{
                    background: 'none',
                    border: 0,
                    padding: 0,
                    font: 'inherit',
                    color: 'var(--accent-soft)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  reset
                </button>
              </>
            ) : null}
          </span>
        </div>

        {results.length === 0 ? (
          <div className="empty">
            <p style={{ margin: '0 0 6px', fontSize: 15, color: 'var(--text-dim)' }}>
              Gak ada tool yang cocok 🤔
            </p>
            <p style={{ margin: 0 }}>Coba kata lain, atau klik chip “Semua”.</p>
          </div>
        ) : (
          <div className="grid-cards">
            {results.map((tool) => (
              <Link key={tool.slug} href={getToolHref(tool)} className="card">
                <span className="card-icon" aria-hidden="true">
                  {tool.icon}
                </span>
                <h3>{tool.title}</h3>
                <p>{tool.desc}</p>
                {tool.group?.includes('populer') ? (
                  <span className="card-tag">Populer</span>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
