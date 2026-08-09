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
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  const items = useMemo(() => {
    const tools = featuredTools.map((t) => ({
      id: `tool-${t.slug}`,
      label: t.title,
      hint: 'Tool',
      icon: t.icon,
      href: getToolHref(t),
      kw: `${t.keywords || ''} ${t.desc || ''}`,
    }));

    const games = (Array.isArray(allGames) ? allGames : []).map((g) => ({
      id: `game-${g.slug}`,
      label: g.name,
      hint: 'Game',
      icon: 'gamepad',
      href: `/games/${g.slug}`,
      kw: g.desc || '',
    }));

    const actions = [
      {
        id: 'act-mode',
        label: isPro ? 'Ganti ke Mode Simple' : 'Ganti ke Mode Pro',
        hint: 'Aksi',
        icon: 'sparkles',
        action: () => toggle(),
      },
      { id: 'act-home', label: 'Ke Beranda', hint: 'Aksi', icon: 'arrowLeft', href: '/' },
      { id: 'act-board', label: 'Papan Peringkat', hint: 'Aksi', icon: 'trophy', href: '/leaderboard' },
      { id: 'act-admin', label: 'Area Admin', hint: 'Aksi', icon: 'lock', href: '/admin' },
    ];

    return [...tools, ...games, ...actions];
  }, [isPro, toggle]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items.slice(0, 8);
    return items
      .filter((i) => `${i.label} ${i.kw} ${i.hint}`.toLowerCase().includes(s))
      .slice(0, 8);
  }, [q, items]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  useEffect(() => setActive(0), [q]);

  const run = (item) => {
    setOpen(false);
    if (item.action) item.action();
    else if (item.href) router.push(item.href);
  };

  const onInputKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[active]) run(results[active]);
    }
  };

  return (
    <>
      <button
        type="button"
        className="cmdk-fab"
        onClick={() => setOpen(true)}
        aria-label="Buka command palette"
      >
        <Icon name="search" size={20} />
      </button>

      {open ? (
        <>
          <div className="cmdk-backdrop" onClick={() => setOpen(false)} />

          <div className="cmdk-panel" role="dialog" aria-modal="true" aria-label="Command palette">
            <input
              ref={inputRef}
              className="cmdk-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onInputKey}
              placeholder="Ketik perintah atau cari tool..."
            />

            <div className="cmdk-list">
              {results.length === 0 ? (
                <p style={{ padding: 18, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
                  Gak ketemu. Coba kata lain.
                </p>
              ) : (
                results.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    className="cmdk-item"
                    data-active={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => run(item)}
                  >
                    <Icon name={iconNames.includes(item.icon) ? item.icon : 'sparkles'} size={16} />
                    <span>{item.label}</span>
                    <span className="hint" style={{ margin: '0 0 0 auto' }}>{item.hint}</span>
                  </button>
                ))
              )}
            </div>

            <div className="cmdk-foot">
              <span><span className="kbd">↑↓</span> navigasi</span>
              <span><span className="kbd">↵</span> buka</span>
              <span><span className="kbd">esc</span> tutup</span>
              <span style={{ marginLeft: 'auto' }}><span className="kbd">Ctrl</span> <span className="kbd">K</span></span>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
