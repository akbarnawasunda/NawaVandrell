'use client';

import { useEffect } from 'react';
import { useMicroSound } from '@/hooks/useMicroSound';

export default function MicroAudioController() {
  const { play, enabled } = useMicroSound();

  useEffect(() => {
    if (!enabled) return;

    const handleHover = (e) => {
      // Jangan bunyiin hover di layar sentuh (bikin berisik pas scroll)
      if (e.pointerType === 'touch') return;
      
      if (e.target.closest('.btn, .card, .chip, .mode-switch button, .cmdk-item')) {
        play('hover');
      }
    };

    const handleClick = (e) => {
      if (e.target.closest('.btn, .chip, .mode-switch button')) {
        play('click');
      }
    };

    document.addEventListener('pointerenter', handleHover, true);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('pointerenter', handleHover, true);
      document.removeEventListener('click', handleClick, true);
    };
  }, [enabled, play]);

  return null;
}
