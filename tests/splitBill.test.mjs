import test from 'node:test';
import assert from 'node:assert/strict';
import { allocate, settle, splitBill } from '../lib/splitBill.mjs';

const people = [
  { id: 'a', nama: 'Andi' },
  { id: 'b', nama: 'Budi' },
  { id: 'c', nama: 'Citra' },
];

test('allocate splits a total without losing a rupiah (largest remainder)', () => {
  assert.deepEqual(allocate(100_000, [1, 1, 1]), [33_334, 33_333, 33_333]);
  const parts = allocate(999_999, [3, 5, 7, 11]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 999_999);
  assert.deepEqual(allocate(10, [0, 0]), [5, 5], 'zero weights fall back to equal split');
  assert.deepEqual(allocate(0, [1, 2]), [0, 0]);
});

test('items split only among selected people and totals add up exactly', () => {
  const result = splitBill({
    people,
    items: [
      { nama: 'Nasi', harga: 50_000, qty: 1, pembagi: ['a', 'b'] },
      { nama: 'Es teh', harga: 20_000, qty: 1, pembagi: ['a'] },
      { nama: 'Kerupuk', harga: 9_000, qty: 1, pembagi: 'semua' },
    ],
    pajakPersen: 10,
    servicePersen: 5,
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.subtotal, 79_000);
  assert.equal(result.pajakTotal, 7_900);
  assert.equal(result.serviceTotal, 3_950);
  assert.equal(result.grandTotal, 90_850);
  const sum = result.shares.reduce((acc, share) => acc + share.total, 0);
  assert.equal(sum, result.grandTotal, 'jumlah bagian orang harus sama dengan total tagihan');
  const andi = result.shares.find((share) => share.nama === 'Andi');
  assert.equal(andi.subtotal, 25_000 + 20_000 + 3_000);
  const citra = result.shares.find((share) => share.nama === 'Citra');
  assert.equal(citra.subtotal, 3_000);
});

test('quantities multiply prices and a bill with no selected people is reported', () => {
  const result = splitBill({
    people,
    items: [
      { nama: 'Kopi', harga: 15_000, qty: 4, pembagi: 'semua' },
      { nama: 'Roti', harga: 8_000, qty: 2, pembagi: [] },
    ],
  });
  assert.equal(result.subtotal, 60_000 + 16_000);
  assert.ok(result.errors.some((text) => /“Roti” belum dibagi/.test(text)));
});

test('payments produce a balanced settlement with the fewest transfers', () => {
  const result = splitBill({
    people,
    items: [{ nama: 'Makan', harga: 90_000, pembagi: 'semua' }],
    dibayar: [{ personId: 'a', jumlah: 90_000 }],
  });
  // Andi membayar seluruh tagihan (90.000), jadi total pembayaran sudah seimbang dengan tagihan.
  assert.equal(result.seimbang, true);
  // setiap orang seharusnya menanggung 30.000; Budi dan Citra mengembalikan 30.000 masing-masing ke Andi
  assert.deepEqual(result.transfers.sort((x, y) => x.dari.localeCompare(y.dari)), [
    { dari: 'Budi', ke: 'Andi', jumlah: 30_000 },
    { dari: 'Citra', ke: 'Andi', jumlah: 30_000 },
  ]);
  const balanced = splitBill({
    people,
    items: [{ nama: 'Makan', harga: 90_000, pembagi: 'semua' }],
    dibayar: [{ personId: 'a', jumlah: 30_000 }, { personId: 'b', jumlah: 30_000 }, { personId: 'c', jumlah: 30_000 }],
  });
  assert.equal(balanced.seimbang, true);
  assert.deepEqual(balanced.transfers, []);
});

test('settlement pairs debtors and creditors greedily and conserves money', () => {
  const transfers = settle([
    { nama: 'A', selisih: 50_000 },
    { nama: 'B', selisih: -20_000 },
    { nama: 'C', selisih: -30_000 },
    { nama: 'D', selisih: 0 },
  ]);
  assert.equal(transfers.reduce((sum, row) => sum + row.jumlah, 0), 50_000);
  assert.ok(transfers.every((row) => row.ke === 'A'));
});

test('empty groups and malformed inputs produce friendly errors', () => {
  const none = splitBill({ people: [], items: [{ nama: 'x', harga: 1000 }] });
  assert.ok(none.errors.some((text) => /minimal satu orang/.test(text)));
  const junk = splitBill({ people: [{ id: 'a', nama: 'Andi' }], items: [{ nama: 'Negatif', harga: -5000, pembagi: 'semua' }] });
  assert.equal(junk.subtotal, 0, 'harga negatif dianggap nol');
});

test('percent inputs are clamped so the tax cannot exceed the bill', () => {
  const result = splitBill({
    people,
    items: [{ nama: 'Makan', harga: 30_000, pembagi: 'semua' }],
    pajakPersen: 500,
  });
  assert.equal(result.pajakTotal, 30_000);
});
