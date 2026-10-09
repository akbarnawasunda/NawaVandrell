'use client';

import { useMemo, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import Icon from '@/components/icons';
import { ErrorList, Metric, NumberField, Notice, Section, SectionHead, TextField } from '@/components/NvUi';
import { useToast } from '@/context/ToastContext';
import { downloadText } from '@/lib/fileDownload.mjs';
import { csvLine, formatRupiah, toAmount } from '@/lib/format.mjs';
import { newId } from '@/lib/localData.mjs';
import { splitBill } from '@/lib/splitBill.mjs';

const newPerson = (nama = '') => ({ id: newId('orang'), nama });
const newItem = () => ({ id: newId('barang'), nama: '', harga: '', qty: '1', pembagi: 'semua' });

export default function PembagiTagihanPage() {
  const { addToast } = useToast();
  const [people, setPeople] = useState([newPerson('Saya'), newPerson('')]);
  const [items, setItems] = useState([newItem()]);
  const [pajak, setPajak] = useState('0');
  const [service, setService] = useState('0');
  const [dibayar, setDibayar] = useState({});

  const result = useMemo(() => splitBill({
    people: people.filter((p) => p.nama.trim()),
    items: items.map((row) => ({
      id: row.id,
      nama: row.nama,
      harga: toAmount(row.harga, { max: 1e12 }),
      qty: toAmount(row.qty, { max: 100000 }) || 1,
      pembagi: row.pembagi,
    })),
    pajakPersen: toAmount(pajak, { max: 100 }),
    servicePersen: toAmount(service, { max: 100 }),
    dibayar: Object.entries(dibayar).map(([personId, jumlah]) => ({ personId, jumlah: toAmount(jumlah, { max: 1e12 }) })),
  }), [people, items, pajak, service, dibayar]);

  const hasItems = items.some((row) => toAmount(row.harga) > 0);
  const errors = hasItems ? result.errors : [];

  const updatePerson = (id, nama) => setPeople((list) => list.map((p) => (p.id === id ? { ...p, nama } : p)));
  const removePerson = (id) => setPeople((list) => (list.length > 1 ? list.filter((p) => p.id !== id) : list));
  const updateItem = (id, field, value) => setItems((list) => list.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  const togglePembagi = (item, personId) => {
    const current = item.pembagi === 'semua' ? people.map((p) => p.id) : item.pembagi;
    const next = current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId];
    updateItem(item.id, 'pembagi', next.length === people.length ? 'semua' : next);
  };

  const copySummary = async () => {
    const lines = [
      'Pembagian tagihan',
      ...result.shares.map((s) => `${s.nama}: ${formatRupiah(s.total)}`),
      `Total: ${formatRupiah(result.grandTotal)}`,
      ...(result.transfers.length ? ['Penyelesaian:', ...result.transfers.map((t) => `${t.dari} → ${t.ke}: ${formatRupiah(t.jumlah)}`)] : ['Penyelesaian: sudah seimbang atau belum ada pembayaran tercatat']),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      addToast('Ringkasan tersalin.', 'success');
    } catch {
      addToast('Gagal menyalin. Unduh CSV sebagai gantinya.', 'error');
    }
  };

  const downloadCsv = () => {
    const rows = [
      csvLine(['Nama', 'Subtotal', 'PPN', 'Biaya layanan', 'Total bagian', 'Sudah dibayar', 'Selisih']),
      ...result.shares.map((s) => {
        const paid = result.paid.find((p) => p.personId === s.personId)?.dibayar || 0;
        return csvLine([s.nama, s.subtotal, s.pajak, s.service, s.total, paid, paid - s.total]);
      }),
      csvLine(['Total', result.subtotal, result.pajakTotal, result.serviceTotal, result.grandTotal, result.totalPaid, result.selisihTotal]),
    ];
    downloadText(`\uFEFF${rows.join('\r\n')}\r\n`, 'pembagian-tagihan.csv', 'text/csv;charset=utf-8');
    addToast('CSV pembagian diunduh.', 'success');
  };

  return (
    <ToolShell
      title="Pembagi Tagihan & Patungan"
      desc="Bagi tagihan makan, belanja, atau biaya kegiatan kelompok. Tidak ada data yang disimpan di perangkat ini."
      icon="users"
      className="nv-tool-wide"
    >
      <div className="nv-stack">
        <Notice kind="info" title="Tanpa penyimpanan">
          Nama dan nominal hanya ada selama halaman terbuka. Salin atau unduh hasil sebelum menutup halaman.
        </Notice>

        <ErrorList errors={errors} />

        <Section labelledBy="pt-orang">
          <SectionHead id="pt-orang" eyebrow="LANGKAH 1" title="Siapa saja yang patungan?">
            Isi nama. Orang yang kosong tidak ikut dihitung.
          </SectionHead>
          <div className="nv-stack" role="group" aria-label="Daftar orang">
            {people.map((person, index) => (
              <div className="nv-row" key={person.id}>
                <TextField id={`pt-nama-${person.id}`} label={index === 0 ? 'Nama' : undefined} value={person.nama} onChange={(v) => updatePerson(person.id, v)} maxLength={60} placeholder={`Orang ke-${index + 1}`} />
                <span />
                <button type="button" className="nv-icon-button is-danger" onClick={() => removePerson(person.id)} disabled={people.length === 1} aria-label={`Hapus orang ke-${index + 1}`}><Icon name="trash" size={16} /></button>
              </div>
            ))}
          </div>
          <div className="nv-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPeople((list) => [...list, newPerson('')])} disabled={people.length >= 30}><Icon name="plus" size={14} /> Tambah orang</button>
          </div>
        </Section>

        <Section labelledBy="pt-barang">
          <SectionHead id="pt-barang" eyebrow="LANGKAH 2" title="Barang atau biaya">
            Untuk setiap barang, centang siapa yang ikut menanggung. Jika semua ikut, centang “Semua”.
          </SectionHead>
          {items.map((row, index) => {
            const selected = row.pembagi === 'semua' ? people.map((p) => p.id) : row.pembagi;
            return (
              <div className="nv-cv-card" key={row.id}>
                <div className="nv-row nv-row-wide">
                  <TextField id={`pt-item-${row.id}`} label={`Nama barang ${index + 1}`} value={row.nama} onChange={(v) => updateItem(row.id, 'nama', v)} maxLength={120} placeholder="Contoh: Nasi goreng" />
                  <NumberField id={`pt-qty-${row.id}`} label="Jumlah" value={row.qty} onChange={(v) => updateItem(row.id, 'qty', v)} />
                  <NumberField id={`pt-harga-${row.id}`} label="Harga satuan" value={row.harga} onChange={(v) => updateItem(row.id, 'harga', v)} suffix="Rp" />
                  <button type="button" className="nv-icon-button is-danger" onClick={() => setItems((list) => (list.length > 1 ? list.filter((r) => r.id !== row.id) : list))} disabled={items.length === 1} aria-label={`Hapus barang ${index + 1}`}><Icon name="trash" size={16} /></button>
                </div>
                <fieldset className="nv-fieldset">
                  <legend className="label">Ditanggung oleh</legend>
                  <div className="nv-chip-group">
                    {people.filter((p) => p.nama.trim()).map((person) => (
                      <label key={person.id} className={`chip nv-person-chip${selected.includes(person.id) ? ' is-on' : ''}`}>
                        <input type="checkbox" checked={selected.includes(person.id)} onChange={() => togglePembagi(row, person.id)} />
                        {person.nama}
                      </label>
                    ))}
                  </div>
                  <p className="nv-item-sub nv-muted">
                    Subtotal: <strong>{formatRupiah(Math.round(toAmount(row.harga) * (toAmount(row.qty) || 1)))}</strong>
                    {' · '}
                    <button type="button" className="nv-link-button" onClick={() => updateItem(row.id, 'pembagi', 'semua')}>pilih semua</button>
                  </p>
                </fieldset>
              </div>
            );
          })}
          <div className="nv-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setItems((list) => [...list, newItem()])} disabled={items.length >= 50}><Icon name="plus" size={14} /> Tambah barang</button>
          </div>
          <div className="nv-grid-2">
            <NumberField id="pt-pajak" label="PPN (opsional)" value={pajak} onChange={setPajak} suffix="%" hint="Dihitung dari total belanja." />
            <NumberField id="pt-service" label="Biaya layanan (opsional)" value={service} onChange={setService} suffix="%" />
          </div>
        </Section>

        <Section labelledBy="pt-bayar">
          <SectionHead id="pt-bayar" eyebrow="LANGKAH 3" title="Siapa sudah membayar?">
            Isi jumlah yang sudah dibayar ke kasir atau penagih. Kosongkan bila belum bayar.
          </SectionHead>
          <div className="nv-grid-2">
            {people.filter((p) => p.nama.trim()).map((person) => (
              <NumberField key={person.id} id={`pt-bayar-${person.id}`} label={`Sudah dibayar ${person.nama}`} value={dibayar[person.id] ?? ''} onChange={(v) => setDibayar((c) => ({ ...c, [person.id]: v }))} suffix="Rp" placeholder="0" />
            ))}
          </div>
        </Section>

        <Section labelledBy="pt-hasil">
          <SectionHead id="pt-hasil" eyebrow="HASIL" title="Bagian setiap orang">
            Jumlah bagian selalu sama dengan total tagihan, sampai ke rupiah.
          </SectionHead>
          <div className="nv-metrics">
            <Metric label="Subtotal" value={formatRupiah(result.subtotal)} />
            <Metric label="PPN + layanan" value={formatRupiah(result.pajakTotal + result.serviceTotal)} />
            <Metric label="Total tagihan" value={formatRupiah(result.grandTotal)} tone="strong" />
            <Metric label="Sudah dibayar" value={formatRupiah(result.totalPaid)} hint={result.seimbang ? 'seimbang dengan tagihan' : `selisih ${formatRupiah(result.selisihTotal)}`} tone={result.seimbang ? 'default' : 'warn'} />
          </div>
          {result.shares.length && result.grandTotal > 0 ? (
            <div className="nv-table-wrap" tabIndex={0} role="region" aria-label="Tabel, geser ke samping bila perlu">
              <table className="nv-table">
                <caption className="nv-sr-only">Bagian tagihan per orang</caption>
                <thead>
                  <tr>
                    <th scope="col">Nama</th>
                    <th scope="col" className="is-num">Subtotal</th>
                    <th scope="col" className="is-num">PPN &amp; layanan</th>
                    <th scope="col" className="is-num">Total bagian</th>
                    <th scope="col" className="is-num">Sudah bayar</th>
                    <th scope="col" className="is-num">Selisih</th>
                  </tr>
                </thead>
                <tbody>
                  {result.shares.map((share) => {
                    const paid = result.paid.find((p) => p.personId === share.personId)?.dibayar || 0;
                    const diff = paid - share.total;
                    return (
                      <tr key={share.personId}>
                        <td>{share.nama}</td>
                        <td className="is-num">{formatRupiah(share.subtotal)}</td>
                        <td className="is-num">{formatRupiah(share.pajak + share.service)}</td>
                        <td className="is-num"><strong>{formatRupiah(share.total)}</strong></td>
                        <td className="is-num">{formatRupiah(paid)}</td>
                        <td className="is-num">{diff === 0 ? 'Lunas' : diff > 0 ? `Lebih ${formatRupiah(diff)}` : `Kurang ${formatRupiah(-diff)}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="nv-muted">Isi nama orang dan harga barang untuk melihat pembagian.</p>}

          {result.transfers.length ? (
            <div className="nv-stack">
              <p className="nv-eyebrow">PENYELESAIAN</p>
              <ul className="nv-plain-list nv-transfer-list">
                {result.transfers.map((t, index) => (
                  <li key={`${t.dari}-${t.ke}-${index}`}><strong>{t.dari}</strong> transfer ke <strong>{t.ke}</strong>: {formatRupiah(t.jumlah)}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="nv-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={copySummary} disabled={!result.grandTotal}><Icon name="copy" size={14} /> Salin ringkasan</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={downloadCsv} disabled={!result.grandTotal}><Icon name="download" size={14} /> Unduh CSV</button>
          </div>
        </Section>
      </div>
    </ToolShell>
  );
}
