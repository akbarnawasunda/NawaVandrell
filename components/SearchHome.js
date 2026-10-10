'use client';

import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { getToolHref, toolCategories } from '@/data/featuredTools';
import Icon, { getToolIconName, iconNames } from './icons';

const RECENT_KEY = 'nawa:workbench:recent-tools';
const FAVORITE_KEY = 'nawa:workbench:favorite-tools';
const sectors = [
  { id: 'kantor', label: 'Kantor & administrasi', icon: '▤', desc: 'Rapat, dokumen, data, dan tindak lanjut', groups: ['kerja', 'dokumen'] },
  { id: 'ritel', label: 'Toko & operasional', icon: '▦', desc: 'Jadwal tim, stok, dan hitung usaha', groups: ['operasional', 'umkm'] },
  { id: 'sekolah', label: 'Sekolah & pelatihan', icon: '⌂', desc: 'Nilai, kehadiran, materi, dan sertifikat', groups: ['sekolah', 'belajar', 'komunitas'] },
  { id: 'usaha', label: 'UMKM & usaha', icon: '↗', desc: 'Harga, invoice, pemasukan, dan promosi', groups: ['umkm', 'uang'] },
];

function safeRead(key) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  } catch { return []; }
}
function saveList(key, list) {
  try { window.localStorage.setItem(key, JSON.stringify(list)); } catch { /* penyimpanan privat/penuh */ }
  window.dispatchEvent(new Event('nawa:workbench-updated'));
}
function ToolIcon({ tool }) {
  const iconName = getToolIconName(tool);
  const emoji = typeof tool?.icon === 'string' && !/^[a-z][a-z0-9-]*$/i.test(tool.icon);
  if (!emoji && iconNames.includes(iconName)) return <span className="tool-card-icon" aria-hidden="true"><Icon name={iconName} size={22} /></span>;
  return <span className="tool-card-icon tool-card-emoji" aria-hidden="true">{emoji ? tool.icon : '✦'}</span>;
}

export default function SearchHome({ tools = [] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sector, setSector] = useState('');
  const [recent, setRecent] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const searchRef = useRef(null);
  const deferred = useDeferredValue(query);

  useEffect(() => {
    const refresh = () => { setRecent(safeRead(RECENT_KEY)); setFavorites(safeRead(FAVORITE_KEY)); };
    refresh();
    window.addEventListener('nawa:workbench-updated', refresh);
    window.addEventListener('storage', refresh);
    const focusOnSlash = (event) => {
      const target = event.target;
      const typing = target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', focusOnSlash);
    return () => { window.removeEventListener('nawa:workbench-updated', refresh); window.removeEventListener('storage', refresh); window.removeEventListener('keydown', focusOnSlash); };
  }, []);

  const counts = useMemo(() => Object.fromEntries(toolCategories.map((cat) => [cat.id, cat.id === 'all' ? tools.length : tools.filter((item) => item.group?.includes(cat.id)).length])), [tools]);
  const visible = useMemo(() => {
    const term = deferred.trim().toLowerCase();
    const groups = sector ? sectors.find((item) => item.id === sector)?.groups || [] : [];
    return tools.filter((tool) => {
      if (category !== 'all' && !tool.group?.includes(category)) return false;
      if (groups.length && !groups.some((group) => tool.group?.includes(group))) return false;
      return !term || `${tool.title} ${tool.desc} ${tool.keywords || ''}`.toLowerCase().split(/\s+/).every((word) => word && `${tool.title} ${tool.desc} ${tool.keywords || ''}`.toLowerCase().includes(word));
    });
  }, [tools, deferred, category, sector]);
  const recentTools = recent.map((slug) => tools.find((tool) => tool.slug === slug)).filter(Boolean).slice(0, 4);
  const favoriteTools = favorites.map((slug) => tools.find((tool) => tool.slug === slug)).filter(Boolean).slice(0, 4);
  const featured = ['papan-tugas', 'notulen-rapat', 'jadwal-shift', 'rekap-nilai', 'stok-inventaris', 'pengolah-excel'].map((slug) => tools.find((tool) => tool.slug === slug)).filter(Boolean);
  const searchActive = Boolean(query.trim() || category !== 'all' || sector);
  const catalogTools = (showAll || searchActive) ? visible : visible.slice(0, 12);

  const toggleFavorite = (slug) => {
    const next = favorites.includes(slug) ? favorites.filter((item) => item !== slug) : [slug, ...favorites].slice(0, 20);
    setFavorites(next); saveList(FAVORITE_KEY, next);
  };
  const clearFilters = () => { setQuery(''); setCategory('all'); setSector(''); setShowAll(false); };

  return (
    <div className="workbench">
      <section className="workbench-hero" aria-labelledby="workbench-title">
        <div className="workbench-hero-copy">
          <p className="workbench-kicker"><span className="workbench-live-dot" /> RUANG KERJA DIGITAL · GRATIS · TANPA AKUN</p>
          <h1 id="workbench-title">Kerjaan beres.<br /><span>Tanpa pindah-pindah.</span></h1>
          <p className="workbench-lede">Alat praktis untuk urusan kantor, toko, sekolah, dan usaha kecil. Mulai dari tugas hari ini — data tetap di perangkatmu.</p>
          <div className="workbench-search">
            <Icon name="search" size={20} />
            <label className="visually-hidden" htmlFor="tool-search">Cari alat kerja</label>
            <input id="tool-search" ref={searchRef} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setShowAll(true); }} placeholder="Cari: notulen rapat, stok barang, rekap nilai…" autoComplete="off" enterKeyHint="search" />
            {query ? <button type="button" className="workbench-clear" onClick={() => setQuery('')} aria-label="Hapus pencarian">×</button> : <kbd>/</kbd>}
          </div>
          <div className="workbench-hero-meta"><span><strong>{tools.length}</strong> alat siap pakai</span><span><strong>Gratis</strong>, tanpa akun</span><span><strong>Privat</strong>, olah di browser</span></div>
        </div>
        <aside className="workbench-hero-card" aria-label="Pintasan produktivitas">
          <div className="workbench-orbit" aria-hidden="true"><span>✳</span><i>✓</i><b>↗</b></div>
          <p className="workbench-card-eyebrow">MULAI DARI YANG PENTING</p>
          <h2>Ruang kerja yang lebih rapi.</h2>
          <p>Catat pekerjaan, rapat, jadwal, stok, atau nilai — lalu lanjutkan kapan saja.</p>
          <a href="#mulai-kerja" className="workbench-hero-link">Pilih kebutuhan <Icon name="arrowRight" size={15} /></a>
        </aside>
      </section>

      {query.trim() ? (
        <section className="workbench-inline-results" aria-live="polite" aria-labelledby="instant-results-title">
          <div className="workbench-section-heading"><div><p className="section-eyebrow">PENCARIAN CEPAT</p><h2 id="instant-results-title">{visible.length ? `${visible.length} alat ditemukan` : 'Belum ada alat yang cocok'}</h2></div><button type="button" className="catalog-reset" onClick={() => { setQuery(''); setShowAll(false); }}>Hapus pencarian</button></div>
          {visible.length ? <div className="featured-work-grid">{visible.slice(0, 6).map((tool) => <ToolTile key={tool.slug} tool={tool} favorite={favorites.includes(tool.slug)} onFavorite={toggleFavorite} compact />)}</div> : <p className="nv-muted">Coba kata lain seperti “rapat”, “stok”, “nilai”, atau “Excel”.</p>}
        </section>
      ) : null}

      {recentTools.length || favoriteTools.length ? (
        <section className="workbench-resume" aria-label="Alat yang disimpan dan terakhir dibuka">
          {recentTools.length ? <div className="resume-block"><div className="resume-heading"><span className="resume-dot" /> <h2>Baru dibuka</h2></div><div className="resume-links">{recentTools.map((tool) => <Link href={getToolHref(tool)} key={tool.slug}><ToolIcon tool={tool} /><span>{tool.title}</span><Icon name="arrowRight" size={14} /></Link>)}</div></div> : null}
          {favoriteTools.length ? <div className="resume-block"><div className="resume-heading"><span className="resume-star">★</span><h2>Favoritmu</h2></div><div className="resume-links">{favoriteTools.map((tool) => <Link href={getToolHref(tool)} key={tool.slug}><ToolIcon tool={tool} /><span>{tool.title}</span><Icon name="arrowRight" size={14} /></Link>)}</div></div> : null}
        </section>
      ) : null}

      <section id="mulai-kerja" className="workbench-sectors" aria-labelledby="sector-title">
        <div className="workbench-section-heading"><div><p className="section-eyebrow">PILIH KONTEKSMU</p><h2 id="sector-title">Mulai dari pekerjaanmu</h2></div><p>Temukan alat sesuai kebutuhan hari ini.</p></div>
        <div className="sector-grid">{sectors.map((item) => <button type="button" className={`sector-card${sector === item.id ? ' is-active' : ''}`} key={item.id} aria-pressed={sector === item.id} onClick={() => { setSector(sector === item.id ? '' : item.id); setCategory('all'); setShowAll(true); document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><span className="sector-symbol" aria-hidden="true">{item.icon}</span><span className="sector-card-copy"><strong>{item.label}</strong><small>{item.desc}</small></span><Icon name="arrowRight" size={16} /></button>)}</div>
      </section>

      <section className="workbench-featured" aria-labelledby="featured-title">
        <div className="workbench-section-heading"><div><p className="section-eyebrow">WORKBENCH BARU</p><h2 id="featured-title">Alat kerja yang langsung kepakai</h2></div><span className="workbench-section-note">Dibuat untuk alur sehari-hari</span></div>
        <div className="featured-work-grid">{featured.map((tool) => <ToolTile key={tool.slug} tool={tool} favorite={favorites.includes(tool.slug)} onFavorite={toggleFavorite} />)}</div>
      </section>

      <section id="tools" className="tool-catalog workbench-catalog" aria-labelledby="tools-title">
        <div className="workbench-section-heading"><div><p className="section-eyebrow">KATALOG</p><h2 id="tools-title">Cari alat yang kamu butuhkan</h2></div><span className="catalog-total"><Icon name="sparkles" size={14} /> {tools.length} alat</span></div>
        <div className="chips catalog-chips" role="group" aria-label="Filter kategori alat">{toolCategories.map((cat) => <button type="button" className="chip" key={cat.id} aria-pressed={category === cat.id} onClick={() => { setCategory(cat.id); setSector(''); setShowAll(true); }}>{cat.label}<span className="chip-count">{counts[cat.id] ?? 0}</span></button>)}</div>
        <div className="catalog-results">
          <div className="catalog-results-head"><div><p className="catalog-section-label">{searchActive ? 'HASIL PENCARIAN' : 'PILIHAN UNTUKMU'}</p><h3>{searchActive ? 'Alat yang cocok' : 'Pilihan populer'}</h3></div><div className="catalog-results-meta"><span aria-live="polite">{visible.length} alat{query.trim() ? ` untuk “${query.trim()}”` : ''}</span>{searchActive ? <button type="button" className="catalog-reset" onClick={clearFilters}>Hapus filter</button> : null}</div></div>
          {catalogTools.length ? <div className="grid-cards tool-grid workbench-tool-grid">{catalogTools.map((tool) => <ToolTile key={tool.slug} tool={tool} favorite={favorites.includes(tool.slug)} onFavorite={toggleFavorite} compact />)}</div> : <div className="empty catalog-empty"><span className="empty-icon"><Icon name="search" size={23} /></span><h3>Belum ada yang cocok</h3><p>Coba kata lain atau hilangkan filter sektor.</p><button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>Tampilkan semua alat</button></div>}
          {!searchActive && !showAll && visible.length > 12 ? <button type="button" className="workbench-show-all" onClick={() => setShowAll(true)}>Lihat semua {visible.length} alat <Icon name="arrowRight" size={15} /></button> : null}
        </div>
      </section>
    </div>
  );
}

function ToolTile({ tool, favorite, onFavorite, compact = false }) {
  return <article className={`workbench-tool-card${compact ? ' is-compact' : ''}`}><Link href={getToolHref(tool)} className="workbench-tool-link"><ToolIcon tool={tool} /><span className="workbench-tool-text"><strong>{tool.title}</strong><small>{tool.desc}</small></span><span className="workbench-tool-arrow" aria-hidden="true"><Icon name="arrowRight" size={16} /></span></Link><button type="button" className={`workbench-favorite${favorite ? ' is-favorite' : ''}`} aria-pressed={favorite} aria-label={`${favorite ? 'Hapus dari' : 'Tambahkan ke'} favorit: ${tool.title}`} onClick={() => onFavorite(tool.slug)}>{favorite ? '★' : '☆'}</button></article>;
}
