'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMicroSound } from '@/hooks/useMicroSound';
import Icon from './icons';

const navigation = [
  { href: '/', label: 'Beranda' },
  { href: '/#tools', label: 'Tools' },
  { href: '/tools/sim-application', label: 'SIM kolektif' },
  { href: '/games', label: 'Arcade' },
  { href: '/leaderboard', label: 'Peringkat' },
];

export default function TopBar() {
  const audio = useMicroSound();
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
      <Link href="/" className="brand" aria-label="Nawa Vandrell — Beranda" onClick={() => setMenuOpen(false)}>
        <span className="brand-symbol" aria-hidden="true">N</span>
        <span className="brand-name">Nawa <strong>Vandrell</strong></span>
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
          aria-label="Cari tools, game, atau halaman"
          title="Cari apa saja (Ctrl atau Command + K)"
        >
          <Icon name="search" size={17} />
          <span className="command-trigger-label">Cari</span>
          <kbd>⌘ K</kbd>
        </button>

        <button
          type="button"
          className="audio-toggle"
          onClick={audio.toggle}
          aria-label={audio.enabled ? 'Matikan suara antarmuka' : 'Nyalakan suara antarmuka'}
          aria-pressed={audio.enabled}
          title={audio.enabled ? 'Matikan suara antarmuka' : 'Nyalakan suara antarmuka'}
        >
          <Icon name={audio.enabled ? 'volumeOn' : 'volumeOff'} size={17} />
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
