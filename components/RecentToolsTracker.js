'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { featuredTools } from '@/data/featuredTools';

const KEY = 'nawa:workbench:recent-tools';

export default function RecentToolsTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const match = featuredTools.find((tool) => (tool.href || `/tools/${tool.slug}`) === pathname);
    if (!match || match.slug === 'games') return;
    try {
      const old = JSON.parse(window.localStorage.getItem(KEY) || '[]');
      const recent = [match.slug, ...(Array.isArray(old) ? old.filter((slug) => slug !== match.slug) : [])].slice(0, 8);
      window.localStorage.setItem(KEY, JSON.stringify(recent));
      window.dispatchEvent(new Event('nawa:workbench-updated'));
    } catch { /* private browsing: skip recent history */ }
  }, [pathname]);
  return null;
}
