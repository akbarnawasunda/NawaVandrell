'use client';

import { useMemo, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import LocalDataPanel from '@/components/LocalDataPanel';
import { Metric, Notice, Section, SectionHead, TextField } from '@/components/Ui';
import { useLocalCollection } from '@/components/useLocalCollection';
import { useToast } from '@/context/ToastContext';
import { downloadText, safeFileName } from '@/lib/fileDownload.mjs';
import { createLocalCollection, newId } from '@/lib/localData.mjs';
import { createInventoryItem, inventoryCsv, recordStockMovement, sanitizeInventoryItem, summarizeInventory } from '@/lib/workTools.mjs';

const store = createLocalCollection({ name: 'stok-inventaris', version: 1, sanitize: sanitizeInventoryItem, maxItems: 1000 });
const rupiah = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);

export default function StokInventarisPage() {
  const { items, setItems, meta, ready, save, afterDataChange } = useLocalCollection(store);
  const { addToast } = useToast();
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('Umum');
  const [unit, setUnit] = useState('pcs');
  const [quantity, setQuantity] = useState('0');
  const [minQuantity, setMinQuantity] = useState('0');
  const [unitCost, setUnitCost] = useState('0');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [adjustments, setAdjustments] = useState({});
  const summary = useMemo(() => summarizeInventory(items), [items]);
  const visible = useMemo(() => items.filter((item) => (filter !== 'low' || (item.minQuantity > 0 && item.quantity <= item.minQuantity)) && (!query.trim() || `${item.name} ${item.sku} ${item.category}`.toLowerCase().includes(query.trim().toLowerCase()))).sort((a, b) => a.name.localeCompare(b.name, 'id')), [items, filter, query]);
  const addItem = (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    const fresh = sanitizeInventoryItem({ ...createInventoryItem(), id: newId('barang'), name, sku, category, unit, quantity, minQuantity, unitCost });
    if (save([fresh, ...items])) { setName(''); setSku(''); setQuantity('0'); }
  };
  const updateItem = (next) => save(items.map((item) => item.id === next.id ? sanitizeInventoryItem(next) : item));
  const adjust = (item, direction) => {
    const amount = Math.max(1, Math.trunc(Number(adjustments[item.id]) || 1));
    try { updateItem(recordStockMovement(item, amount * direction, direction > 0 ? 'Stok masuk' : 'Stok keluar')); }
    catch (error) { addToast(error.message, 'warning'); }
  };
  const remove = (item) => { if (window.confirm(`Hapus “${item.name}” beserta riwayat mutasinya?`)) save(items.filter((row) => row.id !== item.id)); };
  return (
    <ToolShell title="Stok & Inventaris" desc="Catat barang, lihat batas minimum, dan dokumentasikan stok masuk atau keluar. Cocok untuk perlengkapan kantor, kelas, atau toko kecil." icon="📦" className="nv-tool-wide">
      <div className="nv-stack">
        <Notice kind="info" title="Data inventaris tersimpan lokal">Daftar barang tidak dikirim ke server. Ekspor CSV untuk rekap, atau ekspor cadangan JSON untuk memindahkan seluruh data dan riwayat.</Notice>
        <div className="nv-metrics"><Metric label="Jenis barang" value={summary.items} /><Metric label="Unit tersedia" value={summary.units} /><Metric label="Perlu restok" value={summary.low} tone={summary.low ? 'warn' : 'strong'} /><Metric label="Nilai perkiraan" value={rupiah(summary.value)} /></div>
        <Section labelledBy="stock-add"><SectionHead id="stock-add" eyebrow="DAFTAR BARANG" title="Tambahkan barang">Masukkan jumlah saat ini dan ambang stok minimum untuk peringatan restok.</SectionHead>
          <form className="nv-stack" onSubmit={addItem}><div className="nv-grid-2"><TextField id="stock-name" label="Nama barang" value={name} onChange={setName} maxLength={140} placeholder="Kertas A4, kopi, seragam…" required /><TextField id="stock-sku" label="Kode / SKU (opsional)" value={sku} onChange={setSku} maxLength={50} /><TextField id="stock-category" label="Kategori" value={category} onChange={setCategory} maxLength={60} /><TextField id="stock-unit" label="Satuan" value={unit} onChange={setUnit} maxLength={20} placeholder="pcs, rim, box…" /></div><div className="nv-grid-3"><TextField id="stock-qty" label="Stok saat ini" value={quantity} onChange={setQuantity} type="number" min={0} max={1000000} step={1} inputMode="numeric" /><TextField id="stock-min" label="Batas minimum" value={minQuantity} onChange={setMinQuantity} type="number" min={0} max={1000000} step={1} inputMode="numeric" /><TextField id="stock-cost" label="Harga satuan (opsional)" value={unitCost} onChange={setUnitCost} type="number" min={0} max={1000000000} step={1} inputMode="numeric" /></div><div className="nv-actions"><button type="submit" className="btn btn-primary" disabled={!ready || !meta.available || meta.corrupt || !name.trim()}>+ Simpan barang</button></div></form>
        </Section>
        <Section labelledBy="stock-list"><SectionHead id="stock-list" eyebrow="PANTAUAN STOK" title="Barang tersimpan">Tambah atau kurangi stok; setiap perubahan masuk ke riwayat mutasi barang.</SectionHead>
          <div className="nv-search-row"><TextField id="stock-search" label="Cari barang" value={query} onChange={setQuery} placeholder="Nama, kode, kategori" /><div className="chips" role="group" aria-label="Filter stok"><button type="button" className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Semua</button><button type="button" className="chip" aria-pressed={filter === 'low'} onClick={() => setFilter('low')}>Perlu restok</button></div></div>
          {visible.length ? <div className="inventory-list">{visible.map((item) => <article key={item.id} className={`inventory-card${item.minQuantity > 0 && item.quantity <= item.minQuantity ? ' is-low' : ''}`}>
            <div className="inventory-card-head"><div><h3>{item.name}</h3><p className="nv-muted">{[item.sku && `Kode ${item.sku}`, item.category, item.unit].filter(Boolean).join(' · ')}</p></div><span className="inventory-qty"><strong>{item.quantity}</strong><small>{item.unit}</small></span></div>
            <div className="inventory-subline"><span>Minimum: {item.minQuantity} {item.unit}</span><span>Nilai: {rupiah(item.quantity * item.unitCost)}</span>{item.minQuantity > 0 && item.quantity <= item.minQuantity ? <b>Perlu restok</b> : null}</div>
            <div className="inventory-controls"><label className="nv-sr-only" htmlFor={`stock-adjust-${item.id}`}>Jumlah mutasi {item.name}</label><input id={`stock-adjust-${item.id}`} className="input inventory-amount" type="number" min="1" value={adjustments[item.id] || '1'} onChange={(event) => setAdjustments((current) => ({ ...current, [item.id]: event.target.value }))} /><button type="button" className="btn btn-ghost btn-sm" onClick={() => adjust(item, 1)}>+ Stok masuk</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => adjust(item, -1)}>− Stok keluar</button><button type="button" className="nv-icon-button is-danger" aria-label={`Hapus ${item.name}`} onClick={() => remove(item)}>×</button></div>
            {item.movements.length ? <details className="inventory-history"><summary>Riwayat mutasi · {item.movements.length}</summary><ul>{[...item.movements].reverse().slice(0, 10).map((move) => <li key={move.id}><span>{move.date} · {move.note}</span><strong className={move.delta > 0 ? 'is-in' : 'is-out'}>{move.delta > 0 ? '+' : ''}{move.delta} {item.unit}</strong></li>)}</ul></details> : null}
          </article>)}</div> : <p className="nv-muted">{items.length ? 'Tidak ada barang yang cocok dengan filter.' : 'Belum ada barang. Tambahkan barang di atas.'}</p>}
          <div className="nv-actions"><button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadText(inventoryCsv(items), `${safeFileName('stok-inventaris')}.csv`, 'text/csv;charset=utf-8')} disabled={!items.length}>Unduh CSV</button></div>
        </Section>
        <LocalDataPanel title="Cadangan inventaris" store={store} items={items} setItems={setItems} {...meta} fileBase="stok-inventaris" onAfterChange={afterDataChange} available={ready && meta.available} />
      </div>
    </ToolShell>
  );
}
