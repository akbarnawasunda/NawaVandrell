'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Icon from './icons';

const navigation = [
  { href: '/#tools', label: 'Alat' },
  { href: '/games', label: 'Game' },
  { href: '/leaderboard', label: 'Peringkat' },
];

export default function TopBar() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  const openCommandPalette = () => {
    window.dispatchEvent(new Event('nawa:open-command-palette'));
    setMenuOpen(false);
  };

  return (
    <header className="topbar">
      <Link href="/" className="brand" onClick={() => setMenuOpen(false)} aria-label="Nawa Editor — beranda">
        <span className="brand-symbol" aria-hidden="true">N</span>
        <span className="brand-name">Nawa <strong>Editor</strong></span>
        <span className="brand-cursor" aria-hidden="true" />
      </Link>

      <nav className={`topbar-links${menuOpen ? ' is-open' : ''}`} id="primary-navigation" aria-label="Navigasi utama">
        {navigation.map((item) => (
          <Link key={item.href} href={item.href} className="topbar-link" onClick={() => setMenuOpen(false)}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="topbar-actions">
        <button
          type="button"
          className="command-trigger"
          onClick={openCommandPalette}
          aria-keyshortcuts="Control+K Meta+K"
          title="Cari alat, game, atau halaman (Ctrl atau Command + K)"
        >
          <Icon name="search" size={17} />
          <span className="command-trigger-label">Cari</span>
          <kbd>⌘K</kbd>
        </button>

        <button
          type="button"
          className="mobile-nav-toggle"
          aria-label={menuOpen ? 'Tutup navigasi' : 'Buka navigasi'}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((current) => !current)}
        >
          <Icon name={menuOpen ? 'close' : 'menu'} size={19} />
        </button>
      </div>
    </header>
  );
}
