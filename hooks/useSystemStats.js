'use client';

import { useEffect, useState } from 'react';

export function useSystemStats() {
  const [stats, setStats] = useState({ storage: '0 B', ping: '---' });

  useEffect(() => {
    const update = () => {
      // Hitung ukuran LocalStorage
      let total = 0;
      try {
        for (let x in localStorage) {
          if (!localStorage.hasOwnProperty(x)) continue;
          total += ((localStorage[x].length + x.length) * 2);
        }
      } catch (e) {}

      let sizeStr = '0 B';
      if (total > 1024 * 1024) sizeStr = (total / 1024 / 1024).toFixed(1) + ' MB';
      else if (total > 1024) sizeStr = (total / 1024).toFixed(1) + ' KB';
      else sizeStr = total + ' B';

      // Simulasi Ping (random 8-25ms biar kerasa hidup)
      const ping = Math.floor(Math.random() * 17) + 8;

      setStats({
        storage: sizeStr,
        ping: ping + 'ms',
      });
    };

    update();
    const interval = setInterval(update, 3000); // update tiap 3 detik
    return () => clearInterval(interval);
  }, []);

  return stats;
}
