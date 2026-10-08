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
      title="Ganti tampilan"
    >
      <button
        type="button"
        aria-pressed={mode === 'simple'}
        aria-label="Tampilan Tenang"
        onClick={() => pick('simple')}
      >
        Tenang
      </button>

      <button
        type="button"
        aria-pressed={mode === 'pro'}
        aria-label="Tampilan Aura"
        onClick={() => pick('pro')}
      >
        Aura
      </button>
    </div>
  );
}
