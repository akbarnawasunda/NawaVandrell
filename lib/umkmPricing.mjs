/**
 * lib/umkmPricing.mjs — HPP, harga jual, margin, markup, diskon, dan titik impas untuk usaha kecil.
 *
 * Definisi yang dipakai (ditampilkan juga di halaman):
 *  - HPP per produk  = bahan + tenaga + kemasan + (biaya tetap bulanan ÷ jumlah produksi bulanan)
 *  - Margin          = laba ÷ harga jual (bersih dari biaya platform)
 *  - Markup          = laba ÷ HPP
 *  - Titik impas     = (biaya tetap + target laba) ÷ kontribusi per produk
 *    kontribusi per produk = harga bersih (setelah biaya platform) − biaya variabel per produk
 *
 * Semua fungsi murni; tidak menyimpan data dan tidak mengirim apa pun.
 */

import { toAmount } from './format.mjs';

const MAX_PERCENT = 99.99;

function percent(value, max = MAX_PERCENT) {
  return toAmount(value, { min: 0, max });
}

/** Biaya bahan per produk: Σ (jumlah pakai × harga satuan). */
export function materialCost(materials = []) {
  return (Array.isArray(materials) ? materials : []).reduce((sum, row) => {
    const qty = toAmount(row?.qty, { max: 1_000_000 });
    const unitCost = toAmount(row?.unitCost, { max: 1_000_000_000 });
    return sum + qty * unitCost;
  }, 0);
}

/**
 * Rincian HPP per produk.
 * @returns {{bahan:number, tenaga:number, kemasan:number, overhead:number, hpp:number, overheadTersedia:boolean}}
 */
export function unitCostBreakdown({
  materials = [],
  laborPerUnit = 0,
  packagingPerUnit = 0,
  fixedMonthly = 0,
  unitsPerMonth = 0,
} = {}) {
  const bahan = materialCost(materials);
  const tenaga = toAmount(laborPerUnit, { max: 1_000_000_000 });
  const kemasan = toAmount(packagingPerUnit, { max: 1_000_000_000 });
  const units = toAmount(unitsPerMonth, { max: 10_000_000 });
  const fixed = toAmount(fixedMonthly, { max: 1_000_000_000_000 });
  const overheadTersedia = units > 0;
  const overhead = overheadTersedia ? fixed / units : 0;
  return {
    bahan,
    tenaga,
    kemasan,
    overhead,
    hpp: bahan + tenaga + kemasan + overhead,
    overheadTersedia,
  };
}

/** Harga jual dari target margin (persen dari harga jual). margin 40% → harga = HPP ÷ 0,6 */
export function priceFromMargin(hpp, marginPct) {
  const m = percent(marginPct);
  return hpp / (1 - m / 100);
}

/** Harga jual dari target markup (persen dari HPP). markup 50% → harga = HPP × 1,5 */
export function priceFromMarkup(hpp, markupPct) {
  const m = percent(markupPct, 100_000);
  return hpp * (1 + m / 100);
}

/**
 * Diskon pada harga jual.
 * @param {{tipe:'persen'|'nominal', nilai:number}} discount
 * @returns {{harga:number, potongan:number}} harga tidak pernah negatif
 */
export function applyDiscount(price, discount = { tipe: 'persen', nilai: 0 }) {
  const base = toAmount(price, { max: 1_000_000_000_000 });
  let potongan = 0;
  if (discount?.tipe === 'nominal') {
    potongan = toAmount(discount.nilai, { max: base });
  } else {
    // diskon persen dibatasi 0–100%; 100% berarti gratis, tidak pernah negatif
    potongan = base * (toAmount(discount?.nilai, { min: 0, max: 100 }) / 100);
  }
  potongan = Math.min(base, Math.max(0, potongan));
  return { harga: base - potongan, potongan };
}

/**
 * Laba per produk pada harga tertentu.
 * @returns {{hargaBersih:number, biayaPlatform:number, laba:number, marginPct:number, markupPct:number, rugi:boolean}}
 */
export function profitAt({ price, hpp, feePct = 0 } = {}) {
  const harga = toAmount(price, { max: 1_000_000_000_000 });
  const cost = toAmount(hpp, { max: 1_000_000_000_000 });
  const fee = percent(feePct);
  const biayaPlatform = harga * (fee / 100);
  const hargaBersih = harga - biayaPlatform;
  const laba = hargaBersih - cost;
  return {
    hargaBersih,
    biayaPlatform,
    laba,
    marginPct: hargaBersih > 0 ? (laba / hargaBersih) * 100 : 0,
    markupPct: cost > 0 ? (laba / cost) * 100 : 0,
    rugi: laba < 0,
  };
}

/**
 * Titik impas dan target laba dalam jumlah produk per bulan.
 * @returns {{status:'ok'|'tidak-bisa', kontribusi:number, unit:number, rupiah:number}}
 */
export function breakEven({
  fixedMonthly = 0,
  price = 0,
  variablePerUnit = 0,
  feePct = 0,
  targetProfit = 0,
} = {}) {
  const fixed = toAmount(fixedMonthly, { max: 1_000_000_000_000 });
  const target = toAmount(targetProfit, { max: 1_000_000_000_000 });
  const harga = toAmount(price, { max: 1_000_000_000_000 });
  const variable = toAmount(variablePerUnit, { max: 1_000_000_000_000 });
  const fee = percent(feePct);
  const kontribusi = harga * (1 - fee / 100) - variable;
  if (kontribusi <= 0) {
    return { status: 'tidak-bisa', kontribusi, unit: 0, rupiah: 0 };
  }
  const unit = Math.ceil((fixed + target) / kontribusi);
  return { status: 'ok', kontribusi, unit, rupiah: unit * harga };
}

/** Peringatan ringkas untuk pengguna berdasarkan hasil hitung. */
export function pricingWarnings({ hpp, overheadTersedia, finalProfit }) {
  const warnings = [];
  if (!overheadTersedia) {
    warnings.push('Jumlah produksi per bulan belum diisi, jadi biaya tetap belum dibagi ke setiap produk.');
  }
  if (hpp <= 0) {
    warnings.push('HPP masih nol. Isi bahan atau biaya per produk dulu.');
  }
  if (finalProfit && finalProfit.rugi) {
    warnings.push('Harga setelah diskon dan biaya platform berada di bawah HPP: setiap penjualan merugi.');
  } else if (finalProfit && finalProfit.marginPct < 10 && finalProfit.marginPct >= 0) {
    warnings.push('Margin di bawah 10%. Pastikan ada ruang untuk biaya tak terduga dan kenaikan harga bahan.');
  }
  return warnings;
}
