'use client';

import { useMode } from '@/context/ModeContext';
import { useToast } from '@/context/ToastContext';

export default function ModeToggle() {
  const { mode, setMode } = useMode();
  const { addToast } = useToast();

  const pick = (next) => {
    if (next === mode) return;
    setMode(next);
    addToast(
      next === 'pro' ? 'Pro Mode aktif — sci-fi penuh 🚀' : 'Simple Mode aktif — bersih & fokus',
      'success'
    );
  };

  return (
    <div className="mode-switch" role="group" aria-label="Pilih tampilan">
      <button type="button" aria-pressed={mode === 'simple'} onClick={() => pick('simple')}>
        Simple
      </button>
      <button type="button" aria-pressed={mode === 'pro'} onClick={() => pick('pro')}>
        Pro
      </button>
    </div>
  );
}
