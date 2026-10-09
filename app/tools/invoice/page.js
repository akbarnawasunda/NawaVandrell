'use client';

import { useEffect, useMemo, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import Icon from '@/components/icons';
import LocalDataPanel from '@/components/LocalDataPanel';
import { ErrorList, Metric, NumberField, Notice, Section, SectionHead, SelectField, TextAreaField, TextField } from '@/components/Ui';
import { useToast } from '@/context/ToastContext';
import { printNvDocument } from '@/lib/printDoc.mjs';
import { downloadBlob, safeFileName } from '@/lib/fileDownload.mjs';
import { formatDateId, formatRupiah, toAmount, todayIso } from '@/lib/format.mjs';
import { createLocalCollection, newId } from '@/lib/localData.mjs';
import {
  INVOICE_STATUSES,
  INVOICE_TYPES,
  calcInvoice,
  createInvoice,
  createInvoiceXlsxBlob,
  documentTitle,
  dueLabel,
  nextInvoiceNumber,
  receiptPurpose,
  sanitizeInvoice,
  validateInvoice,
} from '@/lib/invoiceDoc.mjs';

const store = createLocalCollection({ name: 'invoice', version: 1, sanitize: sanitizeInvoice, maxItems: 200 });
const MAX_ITEMS = 100;

function freshItem() {
  return { id: newId('baris'), nama: '', qty: 1, satuan: 'pcs', harga: 0 };
}

function PrintSheet({ doc, totals }) {
  const isReceipt = doc.jenis === 'kuitansi';
  return (
    <div className="nv-print-sheet">
      <header className="nv-doc-head">
        <div>
          <p className="nv-doc-kicker">{documentTitle(doc.jenis)}</p>
          <h2 className="nv-doc-title">{doc.penjual.nama || 'Nama usaha'}</h2>
          {doc.penjual.alamat ? <p>{doc.penjual.alamat}</p> : null}
          {doc.penjual.kontak ? <p>{doc.penjual.kontak}</p> : null}
        </div>
        <dl className="nv-doc-meta">
          <div><dt>Nomor</dt><dd>{doc.nomor || '-'}</dd></div>
          <div><dt>Tanggal</dt><dd>{formatDateId(doc.tanggal) || '-'}</dd></div>
          {doc.jenis !== 'kuitansi' ? <div><dt>Jatuh tempo</dt><dd>{dueLabel(doc)}</dd></div> : null}
        </dl>
      </header>

      <div className="nv-doc-parties">
        <div>
          <p className="nv-doc-label">{isReceipt ? 'Diterima dari' : 'Kepada'}</p>
          <p><strong>{doc.pembeli.nama || '-'}</strong></p>
          {doc.pembeli.alamat ? <p>{doc.pembeli.alamat}</p> : null}
          {doc.pembeli.kontak ? <p>{doc.pembeli.kontak}</p> : null}
        </div>
      </div>

      <div className="nv-table-wrap nv-doc-table" tabIndex={0} role="region" aria-label="Rincian barang, geser ke samping bila perlu">
        <table>
          <thead>
            <tr>
              <th scope="col">No</th>
              <th scope="col">Barang / jasa</th>
              <th scope="col" className="is-num">Jumlah</th>
              <th scope="col">Satuan</th>
              <th scope="col" className="is-num">Harga satuan</th>
              <th scope="col" className="is-num">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {totals.items.filter((row) => row.nama || row.harga > 0).map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}</td>
                <td>{row.nama || '-'}</td>
                <td className="is-num">{row.qty}</td>
                <td>{row.satuan || '-'}</td>
                <td className="is-num">{formatRupiah(row.harga)}</td>
                <td className="is-num">{formatRupiah(row.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><th scope="row" colSpan={5}>Subtotal</th><td className="is-num">{formatRupiah(totals.subtotal)}</td></tr>
            {totals.diskon > 0 ? (
              <tr><th scope="row" colSpan={5}>Diskon{totals.diskonTipe === 'persen' ? ` (${doc.diskon.nilai}%)` : ''}</th><td className="is-num">-{formatRupiah(totals.diskon)}</td></tr>
            ) : null}
            {totals.pajakAktif ? (
              <tr><th scope="row" colSpan={5}>PPN {totals.persenPajak}% (dari {formatRupiah(totals.dpp)})</th><td className="is-num">{formatRupiah(totals.pajak)}</td></tr>
            ) : null}
            <tr><th scope="row" colSpan={5}>Total</th><td className="is-num"><strong>{formatRupiah(totals.total)}</strong></td></tr>
          </tfoot>
        </table>
      </div>

      <p className="nv-doc-terbilang"><strong>Terbilang:</strong> {totals.terbilang}</p>
      {isReceipt ? (
        <p className="nv-doc-receipt">
          Telah terima dari <strong>{doc.pembeli.nama || '-'}</strong> uang sejumlah <strong>{formatRupiah(totals.total)}</strong>.
          Untuk: {receiptPurpose(doc)}.
        </p>
      ) : null}
      {doc.penjual.rekening && !isReceipt ? <p><strong>Pembayaran:</strong> {doc.penjual.rekening}</p> : null}
      {doc.syarat && !isReceipt ? <p className="nv-doc-note">{doc.syarat}</p> : null}
      {doc.catatan ? <p className="nv-doc-note">Catatan: {doc.catatan}</p> : null}

      <div className="nv-doc-sign">
        <div>
          <p>{isReceipt ? 'Penerima,' : 'Hormat kami,'}</p>
          <b>{doc.penjual.nama || '(nama & tanda tangan)'}</b>
        </div>
      </div>
    </div>
  );
}

export default function InvoicePage() {
  const { addToast } = useToast();
  const [doc, setDoc] = useState(() => createInvoice('invoice'));
  const [saved, setSaved] = useState([]);
  const [meta, setMeta] = useState({ available: true, corrupt: false, updatedAt: '' });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loaded = store.load();
    setSaved(loaded.items);
    setMeta({ available: loaded.available, corrupt: loaded.corrupt, updatedAt: loaded.updatedAt });
    setDoc(createInvoice('invoice'));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    setDoc((current) => (current.nomor ? current : { ...current, nomor: nextInvoiceNumber(saved, current.jenis, current.tanggal) }));
  }, [ready, saved]);

  const totals = useMemo(() => calcInvoice(doc), [doc]);
  const errors = useMemo(() => validateInvoice(doc), [doc]);
  const filledItems = doc.items.filter((row) => row.nama || toAmount(row.harga) > 0).length;

  const update = (field, value) => setDoc((current) => ({ ...current, [field]: value }));
  const updateNested = (group, field, value) => setDoc((current) => ({ ...current, [group]: { ...current[group], [field]: value } }));
  const updateItem = (id, field, value) => setDoc((current) => ({
    ...current,
    items: current.items.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
  }));
  const addItem = () => {
    if (doc.items.length >= MAX_ITEMS) {
      addToast(`Maksimal ${MAX_ITEMS} baris per dokumen.`, 'warning');
      return;
    }
    setDoc((current) => ({ ...current, items: [...current.items, freshItem()] }));
  };
  const removeItem = (id) => setDoc((current) => ({
    ...current,
    items: current.items.length > 1 ? current.items.filter((row) => row.id !== id) : current.items,
  }));

  const changeType = (jenis) => {
    setDoc((current) => ({ ...current, jenis, nomor: nextInvoiceNumber(saved, jenis, current.tanggal) }));
  };

  const persist = (nextList) => {
    try {
      const clean = store.save(nextList);
      setSaved(clean);
      return clean;
    } catch (error) {
      addToast(error.message, 'error', 6000);
      return null;
    }
  };

  const saveCurrent = () => {
    const now = new Date().toISOString();
    const stamped = { ...doc, updatedAt: now };
    const next = [stamped, ...saved.filter((item) => item.id !== doc.id)];
    if (persist(next)) {
      setDoc(stamped);
      addToast(errors.length ? 'Draf disimpan di perangkat. Lengkapi data sebelum dikirim.' : 'Dokumen disimpan di perangkat ini.', errors.length ? 'warning' : 'success', 5000);
    }
  };

  const openDoc = (item) => {
    setDoc(item);
    addToast(`Dokumen ${item.nomor || 'tanpa nomor'} dibuka.`, 'info');
  };

  const duplicateDoc = (item) => {
    const copy = {
      ...item,
      id: newId('dok'),
      nomor: nextInvoiceNumber(saved, item.jenis, todayIso()),
      tanggal: todayIso(),
      status: 'draf',
      items: item.items.map((row) => ({ ...row, id: newId('baris') })),
    };
    setDoc(copy);
    addToast('Salinan dibuat. Periksa nomor dan tanggalnya lalu simpan.', 'success');
  };

  const deleteDoc = (item) => {
    if (!window.confirm(`Hapus dokumen ${item.nomor || 'ini'} dari perangkat? Tindakan ini tidak bisa dibatalkan.`)) return;
    persist(saved.filter((row) => row.id !== item.id));
    if (doc.id === item.id) setDoc(createInvoice(item.jenis));
    addToast('Dokumen dihapus dari perangkat ini.', 'success');
  };

  const newDocument = () => {
    const fresh = createInvoice(doc.jenis);
    setDoc({ ...fresh, nomor: nextInvoiceNumber(saved, fresh.jenis, fresh.tanggal) });
  };

  const printDocument = () => {
    if (errors.length) addToast('Dokumen masih punya data yang belum lengkap. Cek daftar di atas sebelum mengirim.', 'warning', 5200);
    printNvDocument();
  };

  const downloadXlsx = async () => {
    try {
      const blob = await createInvoiceXlsxBlob(doc);
      downloadBlob(blob, `${safeFileName(doc.nomor || documentTitle(doc.jenis))}.xlsx`);
      addToast('File Excel diunduh.', 'success');
    } catch (error) {
      console.error('Gagal membuat Excel dokumen:', error);
      addToast('Excel belum bisa dibuat. Coba lagi.', 'error');
    }
  };

  if (!ready) {
    return (
      <ToolShell title="Invoice, Penawaran & Kuitansi" desc="Memuat dokumen dari perangkat ini…" icon="receipt" className="nv-tool-wide">
        <p className="nv-muted" role="status">Memuat…</p>
      </ToolShell>
    );
  }

  return (
    <ToolShell
      title="Invoice, Penawaran & Kuitansi"
      desc="Buat tagihan, penawaran harga, atau kuitansi. Cetak sebagai PDF atau unduh Excel. Data tersimpan hanya di perangkat ini."
      icon="receipt"
      className="nv-tool-wide"
    >
      <div className="nv-stack">
        <Notice kind="info" title="Ekspor PDF lewat dialog cetak">
          Pilih “Simpan sebagai PDF” di dialog cetak browser. Dokumen dibuat di perangkat; tidak ada yang dikirim ke server.
        </Notice>

        <div className="nv-actions" role="toolbar" aria-label="Aksi dokumen">
          <button type="button" className="btn btn-ghost btn-sm" onClick={newDocument}><Icon name="plus" size={14} /> Dokumen baru</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={saveCurrent} disabled={!meta.available}><Icon name="check" size={14} /> Simpan di perangkat</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={printDocument}><Icon name="printer" size={14} /> Cetak / PDF</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={downloadXlsx}><Icon name="download" size={14} /> Unduh Excel</button>
        </div>

        <ErrorList errors={errors} />

        <Section labelledBy="inv-dokumen">
          <SectionHead id="inv-dokumen" eyebrow="LANGKAH 1" title="Jenis dan nomor dokumen">
            Pilih jenis dokumen. Nomor dibuat otomatis per bulan, tetapi bisa diubah.
          </SectionHead>
          <div className="nv-grid-2">
            <SelectField id="inv-jenis" label="Jenis dokumen" value={doc.jenis} onChange={changeType} options={INVOICE_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
            <SelectField id="inv-status" label="Status" value={doc.status} onChange={(v) => update('status', v)} options={INVOICE_STATUSES} />
          </div>
          <div className="nv-grid-3">
            <TextField id="inv-nomor" label="Nomor dokumen" value={doc.nomor} onChange={(v) => update('nomor', v)} maxLength={60} />
            <TextField id="inv-tanggal" type="date" label="Tanggal" value={doc.tanggal} onChange={(v) => update('tanggal', v)} />
            <TextField id="inv-jatuh-tempo" type="date" label="Jatuh tempo" value={doc.jatuhTempo} onChange={(v) => update('jatuhTempo', v)} hint="Kosongkan bila tidak ada." />
          </div>
        </Section>

        <div className="nv-grid-2">
          <Section labelledBy="inv-penjual">
            <SectionHead id="inv-penjual" eyebrow="LANGKAH 2" title="Data penjual" />
            <TextField id="inv-p-nama" label="Nama usaha / penjual" value={doc.penjual.nama} onChange={(v) => updateNested('penjual', 'nama', v)} maxLength={120} required />
            <TextAreaField id="inv-p-alamat" label="Alamat" value={doc.penjual.alamat} onChange={(v) => updateNested('penjual', 'alamat', v)} rows={2} maxLength={300} />
            <TextField id="inv-p-kontak" label="Kontak (telepon / email)" value={doc.penjual.kontak} onChange={(v) => updateNested('penjual', 'kontak', v)} maxLength={120} />
            <TextField id="inv-p-rekening" label="Info pembayaran (opsional)" value={doc.penjual.rekening} onChange={(v) => updateNested('penjual', 'rekening', v)} maxLength={200} placeholder="Bank, nomor rekening, atau e-wallet" />
          </Section>
          <Section labelledBy="inv-pembeli">
            <SectionHead id="inv-pembeli" eyebrow="LANGKAH 3" title={doc.jenis === 'kuitansi' ? 'Data penerima pembayaran' : 'Data pembeli'} />
            <TextField id="inv-b-nama" label="Nama pembeli" value={doc.pembeli.nama} onChange={(v) => updateNested('pembeli', 'nama', v)} maxLength={120} required />
            <TextAreaField id="inv-b-alamat" label="Alamat" value={doc.pembeli.alamat} onChange={(v) => updateNested('pembeli', 'alamat', v)} rows={2} maxLength={300} />
            <TextField id="inv-b-kontak" label="Kontak (opsional)" value={doc.pembeli.kontak} onChange={(v) => updateNested('pembeli', 'kontak', v)} maxLength={120} />
          </Section>
        </div>

        <Section labelledBy="inv-barang">
          <SectionHead id="inv-barang" eyebrow="LANGKAH 4" title="Barang atau jasa">
            Satu baris untuk setiap barang atau jasa. Subtotal baris dihitung otomatis.
          </SectionHead>
          <div className="nv-stack" role="group" aria-label="Daftar barang atau jasa">
            {doc.items.map((row, index) => (
              <div className="nv-row nv-row-wide nv-item-row" key={row.id}>
                <TextField id={`inv-nama-${row.id}`} label={index === 0 ? 'Nama barang / jasa' : undefined} value={row.nama} onChange={(v) => updateItem(row.id, 'nama', v)} maxLength={120} placeholder="Contoh: Nasi kotak" />
                <NumberField id={`inv-qty-${row.id}`} label={index === 0 ? 'Jumlah' : undefined} value={row.qty} onChange={(v) => updateItem(row.id, 'qty', v)} />
                <NumberField id={`inv-harga-${row.id}`} label={index === 0 ? 'Harga satuan' : undefined} value={row.harga} onChange={(v) => updateItem(row.id, 'harga', v)} suffix="Rp" />
                <button type="button" className="nv-icon-button is-danger" onClick={() => removeItem(row.id)} disabled={doc.items.length === 1} aria-label={`Hapus baris ${index + 1}`}>
                  <Icon name="trash" size={16} />
                </button>
                <p className="nv-item-sub nv-muted">Subtotal baris {index + 1}: <strong>{formatRupiah(totals.items[index]?.subtotal || 0)}</strong></p>
              </div>
            ))}
          </div>
          <div className="nv-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={addItem} disabled={doc.items.length >= MAX_ITEMS}><Icon name="plus" size={14} /> Tambah baris</button>
            <span className="nv-muted">{filledItems} baris terisi</span>
          </div>
        </Section>

        <div className="nv-grid-2">
          <Section labelledBy="inv-diskon">
            <SectionHead id="inv-diskon" eyebrow="LANGKAH 5" title="Diskon dan pajak" />
            <div className="nv-grid-2">
              <SelectField id="inv-diskon-tipe" label="Jenis diskon" value={doc.diskon.tipe} onChange={(v) => updateNested('diskon', 'tipe', v)} options={[{ value: 'persen', label: 'Persen (%)' }, { value: 'nominal', label: 'Nominal (Rp)' }]} />
              <NumberField id="inv-diskon-nilai" label="Nilai diskon" value={doc.diskon.nilai} onChange={(v) => updateNested('diskon', 'nilai', v)} suffix={doc.diskon.tipe === 'persen' ? '%' : 'Rp'} />
            </div>
            <label className="nv-check">
              <input type="checkbox" checked={doc.pajak.aktif} onChange={(event) => updateNested('pajak', 'aktif', event.target.checked)} />
              <span>Tambahkan PPN</span>
            </label>
            {doc.pajak.aktif ? (
              <NumberField id="inv-ppn" label="Tarif PPN" value={doc.pajak.persen} onChange={(v) => updateNested('pajak', 'persen', v)} suffix="%" hint="Isi sesuai ketentuan usaha Anda. Tarif 11% hanya contoh; pastikan dengan konsultan pajak bila perlu." />
            ) : null}
          </Section>
          <Section labelledBy="inv-catatan">
            <SectionHead id="inv-catatan" eyebrow="LANGKAH 6" title="Catatan dan syarat" />
            <TextAreaField id="inv-syarat" label="Syarat pembayaran" value={doc.syarat} onChange={(v) => update('syarat', v)} rows={2} maxLength={600} />
            <TextAreaField id="inv-note" label="Catatan (opsional)" value={doc.catatan} onChange={(v) => update('catatan', v)} rows={2} maxLength={600} />
          </Section>
        </div>

        <div className="nv-metrics">
          <Metric label="Subtotal" value={formatRupiah(totals.subtotal)} />
          <Metric label="Diskon" value={formatRupiah(totals.diskon)} />
          <Metric label="PPN" value={totals.pajakAktif ? formatRupiah(totals.pajak) : 'Tidak dipakai'} />
          <Metric label="Total" value={formatRupiah(totals.total)} tone="strong" />
        </div>

        <Section labelledBy="inv-pratinjau" className="nv-preview-section">
          <SectionHead id="inv-pratinjau" eyebrow="PRATINJAU" title="Tampilan dokumen">
            Ini yang akan tercetak. Gunakan tombol Cetak / PDF di atas.
          </SectionHead>
          <div className="nv-print-area">
            <PrintSheet doc={doc} totals={totals} />
          </div>
        </Section>

        <section className="nv-section nv-no-print" aria-labelledby="inv-tersimpan">
          <SectionHead id="inv-tersimpan" eyebrow="DI PERANGKAT INI" title="Dokumen tersimpan">
            Buka, salin, atau hapus dokumen yang sudah disimpan.
          </SectionHead>
          {saved.length === 0 ? (
            <p className="nv-muted">Belum ada dokumen tersimpan. Isi form lalu tekan “Simpan di perangkat”.</p>
          ) : (
            <div className="nv-table-wrap" tabIndex={0} role="region" aria-label="Tabel, geser ke samping bila perlu">
              <table className="nv-table">
                <caption className="nv-sr-only">Daftar dokumen tersimpan</caption>
                <thead><tr><th scope="col">Nomor</th><th scope="col">Jenis</th><th scope="col">Pembeli</th><th scope="col" className="is-num">Total</th><th scope="col">Status</th><th scope="col"><span className="nv-sr-only">Aksi</span></th></tr></thead>
                <tbody>
                  {saved.map((item) => {
                    const t = calcInvoice(item);
                    return (
                      <tr key={item.id}>
                        <td>{item.nomor || '(tanpa nomor)'}</td>
                        <td>{documentTitle(item.jenis)}</td>
                        <td>{item.pembeli.nama || '-'}</td>
                        <td className="is-num">{formatRupiah(t.total)}</td>
                        <td>{INVOICE_STATUSES.find((s) => s.value === item.status)?.label}</td>
                        <td>
                          <div className="nv-actions">
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => openDoc(item)}>Buka</button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => duplicateDoc(item)}>Salin</button>
                            <button type="button" className="btn btn-ghost btn-sm nv-danger-button" onClick={() => deleteDoc(item)} aria-label={`Hapus ${item.nomor || 'dokumen'}`}>Hapus</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {ready ? (
          <LocalDataPanel
            title="Cadangan dokumen invoice"
            store={store}
            items={saved}
            setItems={setSaved}
            corrupt={meta.corrupt}
            available={meta.available}
            updatedAt={meta.updatedAt}
            fileBase="invoice"
          />
        ) : null}

        <p className="hint nv-no-print">
          Kuitansi adalah tanda terima pembayaran. Pastikan isinya sesuai kesepakatan dengan pembeli. Tidak menggantikan dokumen pajak resmi.
        </p>
      </div>
    </ToolShell>
  );
}
