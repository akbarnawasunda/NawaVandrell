'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon, { iconNames } from '@/components/icons';
import { featuredTools, getToolHref } from '@/data/featuredTools';
import { allGames } from '@/data/nexrayData';
import { useMode } from '@/context/ModeContext';

export default function CommandPalette() {
  const router = useRouter();
  const { toggle, isPro } = useMode();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const previousOverflowRef = useRef('');

  const items = useMemo(() => {
    const tools = featuredTools.map((tool) => ({
      id: `tool-${tool.slug}`,
      label: tool.title,
      hint: 'Tool',
      icon: tool.icon,
      href: getToolHref(tool),
      keywords: `${tool.keywords || ''} ${tool.desc || ''}`,
    }));

    const games = (Array.isArray(allGames) ? allGames : []).map((game) => ({
      id: `game-${game.slug}`,
      label: game.name,
      hint: 'Arcade',
      icon: 'gamepad',
      href: `/games/${game.slug}`,
      keywords: game.desc || '',
    }));

    const actions = [
      {
        id: 'act-mode',
        label: isPro ? 'Ubah tampilan ke Tenang' : 'Ubah tampilan ke Aura',
        hint: 'Tampilan',
        icon: 'sparkles',
        action: () => toggle(),
      },
      { id: 'act-home', label: 'Kembali ke beranda', hint: 'Halaman', icon: 'home', href: '/' },
      { id: 'act-board', label: 'Papan peringkat', hint: 'Halaman', icon: 'trophy', href: '/leaderboard' },
      { id: 'act-admin', label: 'Area admin', hint: 'Halaman', icon: 'lock', href: '/admin' },
    ];

    return [...tools, ...games, ...actions];
  }, [isPro, toggle]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items.slice(0, 8);
    return items
      .filter((item) => `${item.label} ${item.keywords} ${item.hint}`.toLowerCase().includes(term))
      .slice(0, 8);
  }, [query, items]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    const onOpenRequest = () => setOpen(true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('nawa:open-command-palette', onOpenRequest);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('nawa:open-command-palette', onOpenRequest);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    previousFocusRef.current = document.activeElement;
    previousOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setQuery('');
    setActive(0);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 20);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflowRef.current;
      const previousFocus = previousFocusRef.current;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [open]);

  useEffect(() => setActive(0), [query]);

  const run = (item) => {
    setOpen(false);
    if (item.action) item.action();
    else if (item.href) router.push(item.href);
  };

  const onInputKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (results.length) setActive((current) => Math.min(current + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (results.length) setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (results[active]) run(results[active]);
    }
  };

  const trapDialogFocus = (event) => {
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return open ? (
    <div className="cmdk-layer">
      <button type="button" className="cmdk-backdrop" onClick={() => setOpen(false)} aria-label="Tutup pencarian" />
      <section
        ref={dialogRef}
        className="cmdk-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cmdk-title"
        onKeyDown={trapDialogFocus}
      >
        <div className="cmdk-header">
          <span className="cmdk-search-icon" aria-hidden="true"><Icon name="search" size={19} /></span>
          <label className="visually-hidden" htmlFor="command-search">Cari tools, game, atau halaman</label>
          <input
            ref={inputRef}
            id="command-search"
            className="cmdk-input"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls="command-results"
            aria-activedescendant={results[active] ? `cmdk-option-${active}` : undefined}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Cari tools, game, atau tindakan..."
            autoComplete="off"
            spellCheck="false"
          />
          <button type="button" className="cmdk-close" onClick={() => setOpen(false)} aria-label="Tutup pencarian">
            <Icon name="close" size={17} />
          </button>
        </div>

        <div className="cmdk-results-heading">
          <h2 id="cmdk-title">Pencarian cepat</h2>
          <span>{query.trim() ? `${results.length} hasil` : 'Sering dipakai'}</span>
        </div>
        <div className="cmdk-list" id="command-results" role="listbox" aria-label="Hasil pencarian">
          {results.length === 0 ? (
            <div className="cmdk-empty">
              <Icon name="search" size={20} />
              <p>Tidak ada yang cocok. Coba kata lain.</p>
            </div>
          ) : results.map((item, index) => (
            <button
              key={item.id}
              id={`cmdk-option-${index}`}
              type="button"
              className="cmdk-item"
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              onClick={() => run(item)}
            >
              <span className="cmdk-item-icon">
                <Icon name={iconNames.includes(item.icon) ? item.icon : 'sparkles'} size={17} />
              </span>
              <span className="cmdk-item-label">{item.label}</span>
              <span className="cmdk-item-hint">{item.hint}</span>
              <Icon name="arrowRight" size={15} className="cmdk-item-arrow" />
            </button>
          ))}
        </div>

        <footer className="cmdk-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigasi</span>
          <span><kbd>↵</kbd> buka</span>
          <span><kbd>esc</kbd> tutup</span>
          <span className="cmdk-foot-shortcut"><kbd>⌘</kbd><kbd>K</kbd> cari kapan saja</span>
        </footer>
      </section>
    </div>
  ) : null;
}
