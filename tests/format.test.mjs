import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysIso,
  csvLine,
  daysBetweenIso,
  formatDateId,
  formatMonthId,
  formatRupiah,
  isValidIsoDate,
  safeSpreadsheetText,
  toAmount,
} from '../lib/format.mjs';

test('rupiah formatting uses Indonesian separators and rounds to whole rupiah', () => {
  assert.equal(formatRupiah(1234567), 'Rp 1.234.567');
  assert.equal(formatRupiah(1234.6), 'Rp 1.235');
  assert.equal(formatRupiah(-5000), '-Rp 5.000');
  assert.equal(formatRupiah(NaN), 'Rp 0');
});

test('toAmount accepts Indonesian and plain numeric input and clamps bounds', () => {
  assert.equal(toAmount('1.500.000'), 1500000);
  assert.equal(toAmount('12,5'), 12.5);
  assert.equal(toAmount('abc'), 0);
  assert.equal(toAmount(-40), 0);
  assert.equal(toAmount(150, { max: 100 }), 100);
  assert.equal(toAmount(Infinity), 0);
  // titik desimal kecil tidak boleh berubah menjadi ribuan
  assert.equal(toAmount('0.500'), 0.5);
  assert.equal(toAmount('1.500,75'), 1500.75);
  assert.equal(toAmount('12.500.000'), 12500000);
});

test('ISO date helpers handle month ends and validation', () => {
  assert.equal(addDaysIso('2026-10-31', 1), '2026-11-01');
  assert.equal(addDaysIso('2026-02-28', 1), '2026-03-01');
  assert.equal(daysBetweenIso('2026-10-09', '2026-10-12'), 3);
  assert.equal(daysBetweenIso('2026-10-09', '2026-10-01'), -8);
  assert.equal(isValidIsoDate('2026-02-29'), false);
  assert.equal(isValidIsoDate('2028-02-29'), true);
  assert.equal(formatDateId('2026-10-09'), '9 Oktober 2026');
  assert.equal(formatMonthId('2026-03'), 'Maret 2026');
  assert.equal(formatMonthId('2026-13'), '');
});

test('spreadsheet-safe text neutralises formula injection', () => {
  assert.equal(safeSpreadsheetText('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(safeSpreadsheetText('+62812'), "'+62812");
  assert.equal(safeSpreadsheetText('Budi'), 'Budi');
  assert.equal(csvLine(['a "b"', 42, '=1+1']), '"a ""b""",42,"\'=1+1"');
});
