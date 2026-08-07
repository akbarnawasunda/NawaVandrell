'use client';

import Link from 'next/link';
import ModeToggle from './ModeToggle';

export default function TopBar() {
  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="NawaVandrell beranda">
        <span className="brand-dot" aria-hidden="true">
          N
        </span>
        <span>
          Nawa<span className="nv-accent">Vandrell</span>
        </span>
      </Link>

      <ModeToggle />
    </header>
  );
}
