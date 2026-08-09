'use client';

import Link from 'next/link';
import { useMode } from '@/context/ModeContext';
import { useSystemStats } from '@/hooks/useSystemStats';
import { useMicroSound } from '@/hooks/useMicroSound';
import Icon from './icons';

export default function TopBar() {
  const { mode, toggle } = useMode();
  const stats = useSystemStats();
  const audio = useMicroSound();

  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <span className="brand-dot">N</span>
        <span>
          Nawa<span className="nv-accent">Vandrell</span>
        </span>
      </Link>

      <div className="hud-indicators">
        <div className="hud-item">
          <span className="hud-dot" />
          <span className="hud-value">SYS:OK</span>
        </div>
        <div className="hud-sep">|</div>
        <div className="hud-item">
          <span className="hud-value">{stats.storage}</span>
        </div>
        <div className="hud-sep">|</div>
        <div className="hud-item">
          <span className="hud-value">{stats.ping}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={audio.toggle}
          aria-label={audio.enabled ? 'Matikan suara' : 'Nyalakan suara'}
          style={{ padding: '0 10px', height: 32 }}
        >
          <Icon name={audio.enabled ? 'volumeOn' : 'volumeOff'} size={16} />
        </button>

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
      </div>
    </header>
  );
}
