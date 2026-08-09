'use client';

import Link from 'next/link';
import { useMode } from '@/context/ModeContext';
import { useSystemStats } from '@/hooks/useSystemStats';
import Icon from './icons';

export default function TopBar() {
  const { mode, toggle } = useMode();
  const stats = useSystemStats();

  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <span className="brand-dot">N</span>
        <span>
          Nawa<span className="nv-accent">Vandrell</span>
        </span>
      </Link>

      {/* Tactical Indicators (Hidden on very small screens to save space) */}
      <div className="hud-indicators" style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11, fontFamily: 'monospace', color: 'var(--text-faint)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
          <span className="hud-label" style={{ display: 'none' }}>SYS:</span>
          <span className="hud-value">OK</span>
        </div>
        
        <div style={{ opacity: 0.6 }}>|</div>

        <div>
          <span className="hud-label" style={{ display: 'none' }}>STO:</span>
          <span className="hud-value">{stats.storage}</span>
        </div>

        <div style={{ opacity: 0.6 }}>|</div>

        <div>
          <span className="hud-label" style={{ display: 'none' }}>NET:</span>
          <span className="hud-value">{stats.ping}</span>
        </div>
      </div>

      <div className="mode-switch">
        <button
          type="button"
          aria-pressed={mode === 'simple'}
          onClick={() => mode !== 'simple' && toggle()}
        >
          SIMPLE
        </button>
        <button
          type="button"
          aria-pressed={mode === 'pro'}
          onClick={() => mode !== 'pro' && toggle()}
        >
          PRO
        </button>
      </div>
    </header>
  );
}
