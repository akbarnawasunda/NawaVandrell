'use client';

import { useRef, useState } from 'react';
import Icon from '@/components/icons';
import { useToast } from '@/context/ToastContext';
import { downloadText, safeFileName } from '@/lib/fileDownload.mjs';
import { formatDateId } from '@/lib/format.mjs';

/**
 * Panel cadangan untuk koleksi data lokal: ekspor JSON, impor (gabung/ganti), dan hapus.
 * Data tidak pernah dikirim ke server; semua aksi terjadi di browser ini.
 *
 * @param {object} props
 * @param {string} props.title        judul panel, mis. "Data pelacak lamaran"
 * @param {object} props.store        koleksi dari createLocalCollection
 * @param {any[]}  props.items        isi koleksi saat ini
 * @param {(items:any[])=>void} props.setItems  dipanggil setelah impor/hapus
 * @param {boolean} [props.corrupt]   data tersimpan tidak terbaca
 * @param {boolean} [props.available] penyimpanan lokal tersedia
 * @param {string}  [props.updatedAt] waktu simpan terakhir (ISO)
 * @param {string}  [props.fileBase]  awalan nama berkas ekspor
 */
export default function LocalDataPanel({ title, store, items, setItems, corrupt = false, available = true, updatedAt = '', fileBase = 'data', onAfterChange }) {
  const { addToast } = useToast();
  const fileRef = useRef(null);
  const [mode, setMode] = useState('gabung');
  const [busy, setBusy] = useState(false);

  const exportBackup = () => {
    const text = store.exportBackup(items);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(text, `${safeFileName(fileBase)}-cadangan-${stamp}.json`, 'application/json;charset=utf-8');
    addToast('Cadangan JSON diunduh. Simpan di tempat aman.', 'success');
  };

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      addToast('File cadangan terlalu besar (maks. 5 MB).', 'error', 5200);
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      const result = store.importBackup(text, items, mode);
      if (mode === 'ganti' && items.length && !window.confirm(`Mengganti akan menghapus ${items.length} data yang sekarang ada di perangkat ini. Lanjutkan?`)) {
        return;
      }
      const saved = store.save(result.items);
      setItems(saved);
      onAfterChange?.(saved);
      const detail = mode === 'ganti'
        ? `${result.added} data dimuat ulang`
        : `${result.added} baru, ${result.updated} diperbarui`;
      addToast(`Impor selesai: ${detail}${result.skipped ? `, ${result.skipped} dilewati karena tidak valid` : ''}.`, 'success', 6000);
    } catch (error) {
      addToast(error?.message || 'Impor gagal. Pastikan file cadangan dari Nawa Vandrell.', 'error', 6000);
    } finally {
      setBusy(false);
    }
  };

  const clearAll = () => {
    if (!items.length && !corrupt) {
      addToast('Belum ada data tersimpan di perangkat ini.', 'info');
      return;
    }
    if (!window.confirm('Hapus semua data fitur ini dari perangkat ini? Tindakan ini tidak bisa dibatalkan. Ekspor cadangan dulu bila masih dibutuhkan.')) return;
    store.clear();
    setItems([]);
    onAfterChange?.([]);
    addToast('Semua data fitur ini sudah dihapus dari perangkat ini.', 'success');
  };

  return (
    <section className="nv-section nv-data-panel nv-no-print" aria-labelledby={`${store.key}-panel-title`}>
      <div className="nv-data-panel-head">
        <div>
          <p className="nv-eyebrow">DATA DI PERANGKAT INI</p>
          <h2 id={`${store.key}-panel-title`}>{title}</h2>
          <p className="nv-section-desc">
            {available
              ? `${items.length} data tersimpan${updatedAt ? ` · terakhir disimpan ${formatDateId(updatedAt.slice(0, 10))}` : ''}. Tidak dikirim ke server.`
              : 'Penyimpanan browser tidak tersedia. Data hanya ada selama halaman terbuka; ekspor cadangan sebelum menutup.'}
          </p>
        </div>
      </div>

      {corrupt ? (
        <p className="nv-notice is-bad" role="alert">
          Data tersimpan tidak bisa dibaca dan tidak diubah otomatis. Ekspor file lama bila ada, lalu hapus data ini untuk mulai ulang.
        </p>
      ) : null}

      <div className="nv-data-panel-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={exportBackup} disabled={!items.length}>
          <Icon name="download" size={15} /> Ekspor cadangan (JSON)
        </button>
        <label className="btn btn-ghost btn-sm nv-file-button" aria-disabled={busy || !available}>
          <Icon name="upload" size={15} /> {busy ? 'Membaca file…' : 'Impor cadangan'}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={importFile}
            disabled={busy || !available}
          />
        </label>
        <fieldset className="nv-import-mode">
          <legend className="nv-sr-only">Cara impor</legend>
          <label><input type="radio" name={`${store.key}-mode`} value="gabung" checked={mode === 'gabung'} onChange={() => setMode('gabung')} /> Gabung</label>
          <label><input type="radio" name={`${store.key}-mode`} value="ganti" checked={mode === 'ganti'} onChange={() => setMode('ganti')} /> Ganti semua</label>
        </fieldset>
        <button type="button" className="btn btn-ghost btn-sm nv-danger-button" onClick={clearAll} disabled={!available}>
          <Icon name="trash" size={15} /> Hapus semua data
        </button>
      </div>
      <p className="hint">Gabung: data dengan ID yang sama diperbarui, sisanya ditambahkan. Ganti: seluruh isi diganti dengan isi file.</p>
    </section>
  );
}
