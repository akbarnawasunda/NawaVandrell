'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/context/ToastContext';

export function useLocalCollection(store) {
  const { addToast } = useToast();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ available: true, corrupt: false, updatedAt: '' });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const result = store.load();
    setItems(result.items);
    setMeta({ available: result.available, corrupt: result.corrupt, updatedAt: result.updatedAt });
    setReady(true);
  }, [store]);
  const save = (next) => {
    if (!ready) {
      addToast('Data sedang dimuat. Tunggu sebentar lalu coba lagi.', 'info');
      return false;
    }
    if (meta.corrupt) {
      addToast('Data lama tidak terbaca dan tidak akan ditimpa. Ekspor/hapus data rusak melalui panel cadangan sebelum mulai ulang.', 'error', 6500);
      return false;
    }
    try {
      const clean = store.save(next);
      setItems(clean);
      setMeta((previous) => ({ ...previous, updatedAt: new Date().toISOString() }));
      return true;
    } catch (error) {
      addToast(error?.message || 'Data belum tersimpan. Coba lagi.', 'error', 6000);
      return false;
    }
  };
  const afterDataChange = () => setMeta((previous) => ({ ...previous, corrupt: false, updatedAt: new Date().toISOString() }));
  return { items, setItems, meta, setMeta, ready, save, afterDataChange };
}
