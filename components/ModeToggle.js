// components/ModeToggle.js

'use client';

import { useMode } from '@/context/ModeContext';

export default function ModeToggle() {
  const { mode, setMode } = useMode();

  const pick = (next) => {
    if (next === mode) return;
    setMode(next);
  };

  return (
    <div
      className="mode-switch"
      role="group"
      aria-label="Pilih tampilan"
      title="Ganti mode tampilan"
    >
      <button
        type="button"
        aria-pressed={mode === 'simple'}
        aria-label="Mode Simple"
        onClick={() => pick('simple')}
      >
        Simple
      </button>

      <button
        type="button"
        aria-pressed={mode === 'pro'}
        aria-label="Mode Pro"
        onClick={() => pick('pro')}
      >
        Pro
      </button>
    </div>
  );
}
