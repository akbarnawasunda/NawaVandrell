'use client';

import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { getToolHref, toolCategories } from '@/data/featuredTools';
import Icon, { getToolIconName, iconNames } from './icons';

function ToolCardIcon({ tool }) {
  const iconName = getToolIconName(tool);
  if (iconNames.includes(iconName)) {
    return (
      <span className="tool-card-icon" aria-hidden="true">
        <Icon name={iconName} size={23} />
      </span>
    );
  }
  return (
    <span className="tool-card-icon tool-card-emoji" aria-hidden="true">
      {typeof tool?.icon === 'string' ? tool.icon : '✦'}
    </span>
  );
}

export default function SearchHome({ tools }) {
  const safeTools = Array.isArray(tools) ? tools : [];
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const searchInputRef = useRef(null);
  const deferred = useDeferredValue(query);

  useEffect(() => {
    const focusSearchOnSlash = (event) => {
      const target = event.target;
      const isTyping = target instanceof HTMLElement
        && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || isTyping) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener('keydown', focusSearchOnSlash);
    return () => window.removeEventListener('keydown', focusSearchOnSlash);
  }, []);

  const counts = useMemo(() => {
    const map = { all: safeTools.length };
    for (const cat of toolCategories) {
      if (cat.id === 'all') continue;
      map[cat.id] = safeTools.filter((tool) => tool.group?.includes(cat.id)).length;
    }
    return map;
  }, [safeTools]);

  const results = useMemo(() => {
    const searchTerm = deferred.trim().toLowerCase();
    return safeTools.filter((tool) => {
      const inCategory = category === 'all' || tool.group?.includes(category);
      if (!inCategory) return false;
      if (!searchTerm) return true;
      const haystack = `${tool.title} ${tool.desc} ${tool.keywords || ''}`.toLowerCase();
      return searchTerm.split(/\s+/).every((word) => haystack.includes(word));
    });
  }, [safeTools, deferred, category]);

  const activeLabel = toolCategories.find((item) => item.id === category)?.label || 'Semua';
  const filtering = category !== 'all' || query.trim().length > 0;

  return (
    <>
      <div className="search-wrap catalog-search">
        <span className="search-icon" aria-hidden="true">
          <Icon name="search" size={19} />
        </span>
        <label className="visually-hidden" htmlFor="tool-search">Cari tools</label>
        <input
          id="tool-search"
          ref={searchInputRef}
          className="search-input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Contoh: bikin QR, kompres foto, rapikan JSON..."
          enterKeyHint="search"
          autoComplete="off"
        />
        <kbd className="search-shortcut" aria-hidden="true">/</kbd>
      </div>

      <div className="chips catalog-chips" role="group" aria-label="Filter kategori tools">
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

      <div className="catalog-results">
        <div className="section-head catalog-results-head">
          <div>
            <p className="catalog-section-label">{filtering ? 'PENELUSURAN' : 'PILIHAN UNTUKMU'}</p>
            <h2>{filtering ? `Hasil: ${activeLabel}` : 'Semua tools'}</h2>
          </div>
          <div className="catalog-results-meta">
            <span aria-live="polite" aria-atomic="true">
              {results.length} {results.length === 1 ? 'tool' : 'tools'}
              {query.trim() ? ` untuk “${query.trim()}”` : ''}
            </span>
            {filtering ? (
              <button
                type="button"
                className="catalog-reset"
                onClick={() => { setQuery(''); setCategory('all'); }}
              >
                Hapus filter
              </button>
            ) : null}
          </div>
        </div>

        {results.length === 0 ? (
          <div className="empty catalog-empty">
            <span className="empty-icon" aria-hidden="true"><Icon name="search" size={23} /></span>
            <h3>Belum ada yang cocok</h3>
            <p>Coba kata lain, atau tampilkan semua tools.</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setQuery(''); setCategory('all'); }}>
              Tampilkan semua
            </button>
          </div>
        ) : (
          <div className="grid-cards tool-grid">
            {results.map((tool) => (
              <Link key={tool.slug} href={getToolHref(tool)} className="card tool-card">
                <ToolCardIcon tool={tool} />
                <div className="tool-card-copy">
                  <h3>{tool.title}</h3>
                  <p>{tool.desc}</p>
                </div>
                <span className="tool-card-arrow" aria-hidden="true"><Icon name="arrowRight" size={16} /></span>
                {tool.group?.includes('populer') ? <span className="card-tag">Populer</span> : null}
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
