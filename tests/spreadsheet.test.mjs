import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanTableWhitespace,
  createProcessedWorkbookBlob,
  matrixToTable,
  normalizeName,
  numericColumnIndexes,
  partitionTableByColumn,
  parseNumericValue,
  removeBlankRows,
  removeDuplicateRows,
  renameTableColumn,
  splitTableColumn,
  summarizeBy,
  summarizeNumericColumn,
  tableToMatrix,
  toCsv,
  uniqueSheetName,
} from '../lib/spreadsheet.mjs';

const xlsxModule = await import('@e965/xlsx');
const XLSX = xlsxModule.default || xlsxModule;

test('matrix conversion creates unique headers, pads short rows, and supports files without a header', () => {
  const table = matrixToTable([
    [' Nama ', 'Nama', 'Nilai'],
    ['Ani', 'ANI', 0],
    ['Budi'],
  ]);
  assert.deepEqual(table.columns, ['Nama', 'Nama (2)', 'Nilai']);
  assert.deepEqual(table.rows, [['Ani', 'ANI', 0], ['Budi', '', '']]);

  const noHeader = matrixToTable([['A', 0], ['B', 2]], false);
  assert.deepEqual(noHeader.columns, ['Kolom 1', 'Kolom 2']);
  assert.deepEqual(noHeader.rows, [['A', 0], ['B', 2]]);
});

test('text cleanup normalizes spacing and proper-cases Indonesian names while preserving common acronyms', () => {
  const table = matrixToTable([['Nama', 'Unit'], ['  rINA   puTRi  ', ' pln   up3 barat ']]);
  const cleaned = cleanTableWhitespace(table);
  assert.deepEqual(cleaned.rows[0], ['rINA puTRi', 'pln up3 barat']);
  assert.equal(normalizeName(cleaned.rows[0][0]), 'Rina Putri');
  assert.equal(normalizeName(cleaned.rows[0][1]), 'PLN UP3 Barat');
  assert.equal(normalizeName(''), '');
});

test('blank-row and duplicate cleanup preserve the first matching row', () => {
  const rows = [['Ani', 1], ['', '  '], ['ANI', 1], ['Budi', 2]];
  const blank = removeBlankRows(rows);
  assert.equal(blank.removed, 1);
  const duplicates = removeDuplicateRows(blank.rows);
  assert.equal(duplicates.removed, 1);
  assert.deepEqual(duplicates.rows, [['Ani', 1], ['Budi', 2]]);

  const byName = removeDuplicateRows([['Ani', 'Unit A'], ['ANI', 'Unit B'], ['Budi', 'Unit A']], 0);
  assert.equal(byName.removed, 1);
  assert.deepEqual(byName.rows, [['Ani', 'Unit A'], ['Budi', 'Unit A']]);
});

test('splitting a column replaces it with generated columns and keeps unmatched values', () => {
  const source = { columns: ['Nama / unit', 'Nilai'], rows: [['Ani | Unit A', 10], ['Budi', 0], ['Cici | Unit B | Cadangan', 12]] };
  const result = splitTableColumn(source, 0, '|', 'Petugas');
  assert.equal(result.changed, true);
  assert.equal(result.parts, 3);
  assert.deepEqual(result.table.columns, ['Petugas 1', 'Petugas 2', 'Petugas 3', 'Nilai']);
  assert.deepEqual(result.table.rows, [
    ['Ani', 'Unit A', '', 10],
    ['Budi', '', '', 0],
    ['Cici', 'Unit B', 'Cadangan', 12],
  ]);
  assert.equal(splitTableColumn(source, 0, ';').changed, false);
});

test('renaming columns trims input and avoids duplicate labels', () => {
  const table = { columns: ['Unit', 'Nilai'], rows: [] };
  assert.deepEqual(renameTableColumn(table, 1, ' Unit '), { columns: ['Unit', 'Unit (2)'], rows: [] });
  assert.equal(renameTableColumn(table, 1, '  '), table);
});

test('numeric parser handles Indonesian and English number formats without treating dates as numbers', () => {
  assert.equal(parseNumericValue(0), 0);
  assert.equal(parseNumericValue('Rp 1.234,50'), 1234.5);
  assert.equal(parseNumericValue('(Rp 1.250,50)'), -1250.5);
  assert.equal(parseNumericValue('1,234.50'), 1234.5);
  assert.equal(parseNumericValue('1.234'), 1234);
  assert.equal(parseNumericValue('0.125'), 0.125);
  assert.equal(parseNumericValue('0,125'), 0.125);
  assert.equal(parseNumericValue('1.250 kWh'), 1250);
  assert.equal(parseNumericValue('12/02/2026'), null);
  assert.equal(parseNumericValue('belum ada'), null);
  assert.equal(parseNumericValue(new Date('2026-01-01T00:00:00.000Z')), null);
});

test('numeric summaries count valid values and group averages by a selected field', () => {
  const rows = [
    ['Unit A', '10'],
    ['Unit A', '20'],
    ['Unit B', '7,5'],
    ['Unit B', 'n/a'],
  ];
  assert.deepEqual(numericColumnIndexes({ columns: ['Unit', 'kWh'], rows }), [1]);
  assert.deepEqual(summarizeNumericColumn(rows, 1), {
    rowCount: 4,
    numericCount: 3,
    sum: 37.5,
    average: 12.5,
    min: 7.5,
    max: 20,
  });
  assert.deepEqual(summarizeBy(rows, 0, 1), [
    { group: 'Unit A', rowCount: 2, numericCount: 2, sum: 30, average: 15, min: 10, max: 20 },
    { group: 'Unit B', rowCount: 2, numericCount: 1, sum: 7.5, average: 7.5, min: 7.5, max: 7.5 },
  ]);
});

test('partitioning separates table rows by a group and normalizes whitespace in labels', () => {
  const table = { columns: ['Unit', 'kWh'], rows: [['Unit A', 10], [' unit   a ', 12], ['Unit/B', 20], ['', 0]] };
  const groups = partitionTableByColumn(table, 0);
  assert.deepEqual(groups.map((item) => [item.name, item.table.rows.length]), [['Unit A', 2], ['Unit/B', 1], ['(Kosong)', 1]]);
  assert.deepEqual(groups[0].table.rows, [['Unit A', 10], [' unit   a ', 12]]);
  assert.deepEqual(partitionTableByColumn(table, -1), []);
});

test('CSV and workbook matrix escape formulas while leaving numeric values numeric', () => {
  const table = { columns: ['Input', 'Jumlah'], rows: [['=1+1', -5], ['-HYPERLINK("x")', 0]] };
  assert.deepEqual(tableToMatrix(table), [['Input', 'Jumlah'], ["'=1+1", -5], ["'-HYPERLINK(\"x\")", 0]]);
  const csv = toCsv(table);
  assert.match(csv, /"'=1\+1","-5"/);
  assert.match(csv, /"'-HYPERLINK\(""x""\)","0"/);
  assert.ok(csv.startsWith('\ufeff'));
});

test('sheet names remain unique and within the Excel name limit', () => {
  assert.equal(uniqueSheetName(['Data'], 'Ringkasan'), 'Ringkasan');
  assert.equal(uniqueSheetName(['Ringkasan'], 'Ringkasan'), 'Ringkasan (2)');
  assert.ok(uniqueSheetName(['x'.repeat(31)], 'x'.repeat(40)).length <= 31);
});

test('processed XLSX updates the active sheet, retains other sheets, and adds split and summary tabs', async () => {
  const originalWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(originalWorkbook, XLSX.utils.aoa_to_sheet([['Nama', 'kWh'], ['rINA', 12]]), 'Data');
  XLSX.utils.book_append_sheet(originalWorkbook, XLSX.utils.aoa_to_sheet([['Catatan'], ['tetap']]), 'Catatan');
  const originalActiveCell = originalWorkbook.Sheets.Data.A2.v;
  const table = { columns: ['Unit', 'Nama', 'kWh'], rows: [['Unit A', 'Rina', 18], ['Unit/B', 'Dewa', 20]] };

  const blob = await createProcessedWorkbookBlob({
    originalWorkbook,
    sheetName: 'Data',
    table,
    splitTables: partitionTableByColumn(table, 0),
    summaryRows: [['Rata-rata', 19]],
  });
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const result = XLSX.read(Buffer.from(await blob.arrayBuffer()), { type: 'buffer' });
  assert.deepEqual(result.SheetNames, ['Data', 'Catatan', 'Unit A', 'Unit B', 'Ringkasan']);
  assert.equal(result.Sheets.Data.C2.v, 18);
  assert.equal(result.Sheets.Catatan.A2.v, 'tetap');
  assert.equal(result.Sheets['Unit A'].B2.v, 'Rina');
  assert.equal(result.Sheets['Unit B'].A2.v, 'Unit/B');
  assert.equal(result.Sheets.Ringkasan.A1.v, 'Rata-rata');
  assert.equal(originalWorkbook.Sheets.Data.A2.v, originalActiveCell, 'sumber tidak dimutasi');
});
