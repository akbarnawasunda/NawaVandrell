import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDiscount,
  breakEven,
  materialCost,
  pricingWarnings,
  priceFromMarkup,
  priceFromMargin,
  profitAt,
  unitCostBreakdown,
} from '../lib/umkmPricing.mjs';

test('HPP per produk menjumlahkan bahan, tenaga, kemasan, dan biaya tetap per unit', () => {
  const breakdown = unitCostBreakdown({
    materials: [
      { qty: 2, unitCost: 3000 }, // tepung 2 x 3.000
      { qty: 0.5, unitCost: 20000 }, // gula 0,5 x 20.000
    ],
    laborPerUnit: 1500,
    packagingPerUnit: 1000,
    fixedMonthly: 3_000_000,
    unitsPerMonth: 1000,
  });
  assert.equal(materialCost([{ qty: 2, unitCost: 3000 }, { qty: 0.5, unitCost: 20000 }]), 16000);
  assert.equal(breakdown.bahan, 16000);
  assert.equal(breakdown.overhead, 3000);
  assert.equal(breakdown.hpp, 16000 + 1500 + 1000 + 3000);
  assert.equal(breakdown.overheadTersedia, true);
});

test('tanpa jumlah produksi, biaya tetap tidak dibagi dan ditandai', () => {
  const breakdown = unitCostBreakdown({ materials: [{ qty: 1, unitCost: 5000 }], fixedMonthly: 900000, unitsPerMonth: 0 });
  assert.equal(breakdown.overhead, 0);
  assert.equal(breakdown.overheadTersedia, false);
  assert.equal(breakdown.hpp, 5000);
});

test('harga dari margin dan markup memakai definisi yang benar', () => {
  // margin 40% berarti laba = 40% dari harga jual: harga = HPP / 0,6
  assert.equal(Math.round(priceFromMargin(12000, 40)), 20000);
  // markup 50% berarti laba = 50% dari HPP: harga = HPP x 1,5
  assert.equal(priceFromMarkup(12000, 50), 18000);
  assert.equal(priceFromMargin(12000, 0), 12000);
});

test('diskon persen dan nominal tidak pernah membuat harga negatif', () => {
  assert.deepEqual(applyDiscount(20000, { tipe: 'persen', nilai: 15 }), { harga: 17000, potongan: 3000 });
  assert.deepEqual(applyDiscount(20000, { tipe: 'nominal', nilai: 5000 }), { harga: 15000, potongan: 5000 });
  assert.deepEqual(applyDiscount(20000, { tipe: 'nominal', nilai: 999999 }), { harga: 0, potongan: 20000 });
  assert.deepEqual(applyDiscount(20000, { tipe: 'persen', nilai: 250 }), { harga: 0, potongan: 20000 });
});

test('laba, margin, dan markup dihitung setelah biaya platform', () => {
  const profit = profitAt({ price: 20000, hpp: 12000, feePct: 5 });
  // harga bersih 19.000; laba 7.000; margin 7.000/19.000; markup 7.000/12.000
  assert.equal(profit.hargaBersih, 19000);
  assert.equal(profit.laba, 7000);
  assert.equal(Number(profit.marginPct.toFixed(2)), 36.84);
  assert.equal(Number(profit.markupPct.toFixed(2)), 58.33);
  assert.equal(profit.rugi, false);
});

test('harga di bawah HPP ditandai rugi', () => {
  const profit = profitAt({ price: 10000, hpp: 12000, feePct: 0 });
  assert.equal(profit.laba, -2000);
  assert.equal(profit.rugi, true);
});

test('titik impas dibulatkan ke atas dan memperhitungkan target laba', () => {
  // kontribusi = 20.000 - 12.000 = 8.000 per produk
  const plain = breakEven({ fixedMonthly: 2_000_000, price: 20000, variablePerUnit: 12000 });
  assert.equal(plain.status, 'ok');
  assert.equal(plain.unit, 250);
  assert.equal(plain.rupiah, 5_000_000);

  const withTarget = breakEven({ fixedMonthly: 2_000_000, price: 20000, variablePerUnit: 12000, targetProfit: 1_000_000 });
  assert.equal(withTarget.unit, 375);
});

test('titik impas tidak bisa dihitung bila harga tidak menutup biaya variabel', () => {
  const result = breakEven({ fixedMonthly: 1_000_000, price: 10000, variablePerUnit: 11000 });
  assert.equal(result.status, 'tidak-bisa');
  assert.equal(result.unit, 0);
});

test('biaya platform ikut mengurangi kontribusi titik impas', () => {
  // harga bersih 19.000 - variabel 12.000 = 7.000 -> 2.000.000 / 7.000 = 285,7 -> 286
  const result = breakEven({ fixedMonthly: 2_000_000, price: 20000, variablePerUnit: 12000, feePct: 5 });
  assert.equal(result.unit, 286);
});

test('peringatan muncul untuk produksi kosong, rugi, dan margin tipis', () => {
  const warnings = pricingWarnings({
    hpp: 12000,
    overheadTersedia: false,
    finalProfit: profitAt({ price: 12500, hpp: 12000, feePct: 0 }),
  });
  assert.ok(warnings.some((text) => /Jumlah produksi/.test(text)));
  assert.ok(warnings.some((text) => /Margin di bawah 10%/.test(text)));
  const loss = pricingWarnings({ hpp: 12000, overheadTersedia: true, finalProfit: profitAt({ price: 9000, hpp: 12000 }) });
  assert.ok(loss.some((text) => /merugi/.test(text)));
});
