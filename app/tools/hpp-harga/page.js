'use client';

import { useMemo, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import Icon from '@/components/icons';
import { ErrorList, Metric, NumberField, Notice, Section, SectionHead, SelectField, TextField } from '@/components/NvUi';
import { useToast } from '@/context/ToastContext';
import { downloadText, safeFileName } from '@/lib/fileDownload.mjs';
import { csvLine, formatPercent, formatRupiah, toAmount } from '@/lib/format.mjs';
import { newId } from '@/lib/localData.mjs';
import {
  applyDiscount,
  breakEven,
  materialCost,
  pricingWarnings,
  priceFromMarkup,
  priceFromMargin,
  profitAt,
  unitCostBreakdown,
} from '@/lib/umkmPricing.mjs';

const newMaterial = () => ({ id: newId('bahan'), nama: '', qty: '', unitCost: '' });

const PRICING_MODES = [
  { value: 'margin', label: 'Margin dari harga jual' },
  { value: 'markup', label: 'Markup dari HPP' },
];

const DISCOUNT_TYPES = [
  { value: 'persen', label: 'Persen (%)' },
  { value: 'nominal', label: 'Nominal (Rp)' },
];

export default function HppHargaPage() {
  const { addToast } = useToast();
  const [productName, setProductName] = useState('');
  const [materials, setMaterials] = useState([newMaterial()]);
  const [laborPerUnit, setLaborPerUnit] = useState('');
  const [packagingPerUnit, setPackagingPerUnit] = useState('');
  const [fixedMonthly, setFixedMonthly] = useState('');
  const [unitsPerMonth, setUnitsPerMonth] = useState('');
  const [pricingMode, setPricingMode] = useState('margin');
  const [targetPct, setTargetPct] = useState('40');
  const [manualPrice, setManualPrice] = useState('');
  const [discountType, setDiscountType] = useState('persen');
  const [discountValue, setDiscountValue] = useState('0');
  const [feePct, setFeePct] = useState('0');
  const [targetProfit, setTargetProfit] = useState('');

  const errors = useMemo(() => {
    const list = [];
    const rowsWithoutName = materials.filter((row) => (row.qty || row.unitCost) && !String(row.nama).trim());
    if (rowsWithoutName.length) list.push('Setiap bahan yang sudah diisi perlu nama, misalnya “Tepung”.');
    const target = toAmount(targetPct, { max: 100_000 });
    if (pricingMode === 'margin' && target >= 100) list.push('Target margin harus di bawah 100%.');
    if (toAmount(feePct) >= 100) list.push('Biaya platform harus di bawah 100%.');
    return list;
  }, [materials, targetPct, pricingMode, feePct]);

  const breakdown = useMemo(() => unitCostBreakdown({
    materials,
    laborPerUnit,
    packagingPerUnit,
    fixedMonthly,
    unitsPerMonth,
  }), [materials, laborPerUnit, packagingPerUnit, fixedMonthly, unitsPerMonth]);

  const hpp = breakdown.hpp;
  const variableCost = breakdown.bahan + breakdown.tenaga + breakdown.kemasan;

  const suggestedPrice = useMemo(() => {
    if (hpp <= 0) return 0;
    const target = toAmount(targetPct, { max: 100_000 });
    if (pricingMode === 'margin') return target < 100 ? priceFromMargin(hpp, target) : 0;
    return priceFromMarkup(hpp, target);
  }, [hpp, pricingMode, targetPct]);

  const basePrice = toAmount(manualPrice, { max: 1_000_000_000 }) > 0
    ? toAmount(manualPrice, { max: 1_000_000_000 })
    : Math.round(suggestedPrice);
  const discountResult = applyDiscount(basePrice, {
    tipe: discountType,
    nilai: toAmount(discountValue, { max: 100_000_000 }),
  });
  const finalPrice = discountResult.harga;
  const fee = toAmount(feePct, { max: 99.99 });
  const profit = profitAt({ price: finalPrice, hpp, feePct: fee });
  const bep = breakEven({
    fixedMonthly: toAmount(fixedMonthly, { max: 1_000_000_000_000 }),
    price: finalPrice,
    variablePerUnit: variableCost,
    feePct: fee,
    targetProfit: toAmount(targetProfit, { max: 1_000_000_000_000 }),
  });
  const warnings = pricingWarnings({ hpp, overheadTersedia: breakdown.overheadTersedia, finalProfit: basePrice > 0 ? profit : null });

  const updateMaterial = (id, field, value) => {
    setMaterials((rows) => rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const removeMaterial = (id) => {
    setMaterials((rows) => (rows.length > 1 ? rows.filter((row) => row.id !== id) : rows));
  };

  const summaryRows = [
    ['Produk', productName.trim() || 'Tanpa nama'],
    ['Bahan baku per produk', formatRupiah(breakdown.bahan)],
    ['Tenaga kerja per produk', formatRupiah(breakdown.tenaga)],
    ['Kemasan per produk', formatRupiah(breakdown.kemasan)],
    ['Biaya tetap per produk', formatRupiah(breakdown.overhead)],
    ['HPP per produk', formatRupiah(hpp)],
    ['Harga jual dasar', formatRupiah(basePrice)],
    ['Potongan diskon', formatRupiah(discountResult.potongan)],
    ['Harga jual setelah diskon', formatRupiah(finalPrice)],
    ['Biaya platform', formatRupiah(profit.biayaPlatform)],
    ['Laba per produk', formatRupiah(profit.laba)],
    ['Margin', formatPercent(profit.marginPct, 1)],
    ['Markup', formatPercent(profit.markupPct, 1)],
    ['Titik impas (produk/bulan)', bep.status === 'ok' ? `${bep.unit} produk` : 'Belum bisa dihitung'],
    ['Titik impas (rupiah/bulan)', bep.status === 'ok' ? formatRupiah(bep.rupiah) : '-'],
  ];

  const copySummary = async () => {
    const text = summaryRows.map(([label, value]) => `${label}: ${value}`).join('\n');
    try {
      await navigator.clipboard.writeText(`Ringkasan HPP & harga\n${text}\n\nEstimasi dari data yang Anda isi. Bukan nasihat keuangan.`);
      addToast('Ringkasan tersalin ke clipboard.', 'success');
    } catch {
      addToast('Gagal menyalin. Unduh CSV sebagai gantinya.', 'error');
    }
  };

  const downloadCsv = () => {
    const lines = [csvLine(['Item', 'Nilai']), ...summaryRows.map(([label, value]) => csvLine([label, value]))];
    downloadText(`\uFEFF${lines.join('\r\n')}\r\n`, `${safeFileName(productName || 'hpp-harga')}-ringkasan.csv`, 'text/csv;charset=utf-8');
    addToast('CSV ringkasan diunduh.', 'success');
  };

  return (
    <ToolShell
      title="Kalkulator HPP & Harga"
      desc="Hitung modal per produk, harga jual, diskon, laba, dan titik impas. Semua dihitung di perangkat ini."
      icon="calculator"
      className="nv-tool-wide"
    >
      <div className="nv-stack">
        <Notice kind="info" title="Cara membaca hasil">
          HPP = bahan + tenaga + kemasan + biaya tetap dibagi jumlah produksi. Margin dihitung dari harga jual,
          markup dihitung dari HPP. Hasil adalah estimasi dari angka yang Anda isi.
        </Notice>

        <ErrorList errors={errors} />

        <Section labelledBy="hpp-produk">
          <SectionHead id="hpp-produk" eyebrow="LANGKAH 1" title="Produk dan bahan baku">
            Isi bahan yang dipakai untuk satu produk. Gunakan jumlah pakai per produk, bukan jumlah belanja.
          </SectionHead>
          <TextField id="hpp-nama" label="Nama produk (opsional)" value={productName} onChange={setProductName} placeholder="Contoh: Kopi susu botol 250 ml" maxLength={80} />

          <div className="nv-stack" role="group" aria-label="Daftar bahan baku">
            {materials.map((row, index) => (
              <div className="nv-row nv-row-wide" key={row.id}>
                <TextField id={`bahan-nama-${row.id}`} label={index === 0 ? 'Nama bahan' : undefined} value={row.nama} onChange={(v) => updateMaterial(row.id, 'nama', v)} placeholder="Contoh: Susu cair" maxLength={60} />
                <NumberField id={`bahan-qty-${row.id}`} label={index === 0 ? 'Jumlah pakai' : undefined} value={row.qty} onChange={(v) => updateMaterial(row.id, 'qty', v)} placeholder="0" />
                <NumberField id={`bahan-harga-${row.id}`} label={index === 0 ? 'Harga satuan' : undefined} value={row.unitCost} onChange={(v) => updateMaterial(row.id, 'unitCost', v)} placeholder="0" suffix="Rp" />
                <button type="button" className="nv-icon-button is-danger" onClick={() => removeMaterial(row.id)} disabled={materials.length === 1} aria-label={`Hapus bahan nomor ${index + 1}`}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="nv-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMaterials((rows) => [...rows, newMaterial()])}>
              <Icon name="plus" size={15} /> Tambah bahan
            </button>
            <span className="nv-muted">Subtotal bahan: <strong>{formatRupiah(materialCost(materials))}</strong></span>
          </div>

          <div className="nv-grid-2">
            <NumberField id="hpp-tenaga" label="Tenaga kerja per produk" value={laborPerUnit} onChange={setLaborPerUnit} placeholder="0" suffix="Rp" hint="Upah langsung untuk satu produk, kalau ada." />
            <NumberField id="hpp-kemasan" label="Kemasan per produk" value={packagingPerUnit} onChange={setPackagingPerUnit} placeholder="0" suffix="Rp" hint="Botol, plastik, stiker, kardus per produk." />
          </div>
        </Section>

        <Section labelledBy="hpp-tetap">
          <SectionHead id="hpp-tetap" eyebrow="LANGKAH 2" title="Biaya tetap per bulan">
            Sewa, listrik, internet, gaji tetap, dan biaya bulanan lain. Dibagi ke setiap produk yang dibuat.
          </SectionHead>
          <div className="nv-grid-2">
            <NumberField id="hpp-tetap-bulan" label="Total biaya tetap per bulan" value={fixedMonthly} onChange={setFixedMonthly} placeholder="0" suffix="Rp" />
            <NumberField id="hpp-produksi" label="Jumlah produk dibuat per bulan" value={unitsPerMonth} onChange={setUnitsPerMonth} placeholder="0" suffix="pcs" hint="Isi perkiraan rata-rata. Angka ini membagi biaya tetap." />
          </div>
        </Section>

        <Section labelledBy="hpp-harga">
          <SectionHead id="hpp-harga" eyebrow="LANGKAH 3" title="Harga jual, diskon, dan biaya platform">
            Pilih cara menghitung harga yang disarankan. Anda juga bisa mengisi harga jual sendiri.
          </SectionHead>
          <div className="nv-grid-2">
            <SelectField id="hpp-mode" label="Cara menghitung harga" value={pricingMode} onChange={setPricingMode} options={PRICING_MODES} />
            <NumberField id="hpp-target" label={pricingMode === 'margin' ? 'Target margin' : 'Target markup'} value={targetPct} onChange={setTargetPct} suffix="%" hint={pricingMode === 'margin' ? 'Laba sebagai persen dari harga jual.' : 'Laba sebagai persen dari HPP.'} />
          </div>
          <div className="nv-grid-2">
            <NumberField id="hpp-harga-manual" label="Harga jual sendiri (opsional)" value={manualPrice} onChange={setManualPrice} placeholder="Kosongkan untuk pakai saran" suffix="Rp" hint="Misalnya harga pesaing. Jika diisi, angka ini dipakai." />
            <NumberField id="hpp-fee" label="Biaya platform / komisi" value={feePct} onChange={setFeePct} suffix="%" hint="Marketplace, payment gateway, atau komisi reseller." />
          </div>
          <div className="nv-grid-2">
            <SelectField id="hpp-diskon-tipe" label="Jenis diskon" value={discountType} onChange={setDiscountType} options={DISCOUNT_TYPES} />
            <NumberField id="hpp-diskon" label="Nilai diskon" value={discountValue} onChange={setDiscountValue} suffix={discountType === 'persen' ? '%' : 'Rp'} />
          </div>
        </Section>

        <Section labelledBy="hpp-hasil">
          <SectionHead id="hpp-hasil" eyebrow="HASIL" title="Ringkasan per produk">
            Angka di bawah ini berubah otomatis saat Anda mengisi form.
          </SectionHead>
          <div className="nv-metrics">
            <Metric label="HPP per produk" value={formatRupiah(hpp)} />
            <Metric label="Harga saran" value={formatRupiah(suggestedPrice)} hint={pricingMode === 'margin' ? `margin ${targetPct || 0}%` : `markup ${targetPct || 0}%`} />
            <Metric label="Harga jual final" value={formatRupiah(finalPrice)} hint={discountResult.potongan ? `diskon ${formatRupiah(discountResult.potongan)}` : 'tanpa diskon'} tone="strong" />
            <Metric label="Laba per produk" value={formatRupiah(profit.laba)} tone={profit.rugi ? 'danger' : 'strong'} hint={profit.rugi ? 'rugi' : 'setelah biaya platform'} />
            <Metric label="Margin" value={formatPercent(profit.marginPct, 1)} hint="dari harga bersih" />
            <Metric label="Markup" value={formatPercent(profit.markupPct, 1)} hint="dari HPP" />
          </div>

          {warnings.length ? (
            <div className="nv-stack">
              {warnings.map((text) => <Notice key={text} kind={/merugi/.test(text) ? 'bad' : 'warn'}>{text}</Notice>)}
            </div>
          ) : null}

          <div className="nv-table-wrap" tabIndex={0} role="region" aria-label="Tabel, geser ke samping bila perlu">
            <table className="nv-table">
              <caption className="nv-sr-only">Rincian HPP per produk</caption>
              <thead><tr><th scope="col">Komponen</th><th scope="col" className="is-num">Nilai</th></tr></thead>
              <tbody>
                <tr><td>Bahan baku</td><td className="is-num">{formatRupiah(breakdown.bahan)}</td></tr>
                <tr><td>Tenaga kerja</td><td className="is-num">{formatRupiah(breakdown.tenaga)}</td></tr>
                <tr><td>Kemasan</td><td className="is-num">{formatRupiah(breakdown.kemasan)}</td></tr>
                <tr><td>Biaya tetap dibagi produksi</td><td className="is-num">{formatRupiah(breakdown.overhead)}</td></tr>
                <tr><th scope="row">HPP</th><th scope="row" className="is-num">{formatRupiah(hpp)}</th></tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section labelledBy="hpp-impas">
          <SectionHead id="hpp-impas" eyebrow="LANGKAH 4" title="Titik impas dan target laba">
            Berapa produk harus terjual tiap bulan agar biaya tetap tertutup, dan agar target laba tercapai.
          </SectionHead>
          <NumberField id="hpp-target-laba" label="Target laba per bulan (opsional)" value={targetProfit} onChange={setTargetProfit} suffix="Rp" placeholder="0" />
          <div className="nv-metrics">
            <Metric label="Kontribusi per produk" value={formatRupiah(bep.kontribusi)} hint="harga bersih − biaya variabel" />
            <Metric
              label="Terjual minimal per bulan"
              value={bep.status === 'ok' ? `${bep.unit} produk` : 'Belum bisa'}
              tone={bep.status === 'ok' ? 'strong' : 'danger'}
              hint={bep.status === 'ok' ? `omzet ${formatRupiah(bep.rupiah)}` : 'harga harus lebih tinggi dari biaya variabel'}
            />
          </div>
        </Section>

        <section className="nv-section nv-no-print" aria-labelledby="hpp-ekspor">
          <SectionHead id="hpp-ekspor" eyebrow="SIMPAN HASIL" title="Salin atau unduh ringkasan">
            Halaman ini tidak menyimpan data. Salin atau unduh ringkasan bila ingin dipakai nanti.
          </SectionHead>
          <div className="nv-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={copySummary}><Icon name="copy" size={14} /> Salin ringkasan</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={downloadCsv}><Icon name="download" size={14} /> Unduh CSV</button>
          </div>
        </section>
      </div>
    </ToolShell>
  );
}
