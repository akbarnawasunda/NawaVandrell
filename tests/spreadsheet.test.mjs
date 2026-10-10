import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanTableWhitespace,
  createProcessedWorkbookBlob,
  matrixToTable,
  normalizeMatchKey,
  normalizeName,
  numericColumnIndexes,
  partitionTableByColumn,
  parseNumericValue,
  removeBlankRows,
  removeDuplicateRows,
  renameTableColumn,
  replaceTableValues,
  splitTableColumn,
  summarizeBy,
  summarizeNumericColumn,
  tableToMatrix,
  toCsv,
  uniqueSheetName,
} from '../lib/spreadsheet.mjs';

const xlsxModule = await import('@e965/xlsx');
const XLSX = xlsxModule.default || xlsxModule;
const excelJsModule = await import('exceljs');
const ExcelJS = excelJsModule.default || excelJsModule;

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

  const ranged = matrixToTable([['Nama', 'Nilai'], ['Ani', 1], ['Budi', 2]], true, { startRow: 4, startColumn: 2, endRow: 6, endColumn: 3 });
  assert.deepEqual(ranged.sourceRowIndexes, [5, 6]);
  assert.deepEqual(ranged.sourceColumnIndexes, [2, 3]);
  assert.deepEqual(ranged.sourceRange, { startRow: 4, startColumn: 2, endRow: 6, endColumn: 3 });
});

test('text cleanup normalizes spacing and proper-cases Indonesian names while preserving common acronyms', () => {
  const table = matrixToTable([['Nama', 'Unit'], ['  rINA   puTRi  ', ' pln   up3 barat ']]);
  const cleaned = cleanTableWhitespace(table);
  assert.deepEqual(cleaned.rows[0], ['rINA puTRi', 'pln up3 barat']);
  assert.equal(normalizeName(cleaned.rows[0][0]), 'Rina Putri');
  assert.equal(normalizeName(cleaned.rows[0][1]), 'PLN UP3 Barat');
  assert.equal(normalizeName('mUHAMMAD BIN aHMAD alI'), 'Muhammad bin Ahmad Ali');
  assert.equal(normalizeName('  nAMA   pEgAWAI ', 'preserve'), 'nAMA pEgAWAI');
  assert.equal(normalizeName('rina putri', 'upper'), 'RINA PUTRI');
  assert.equal(normalizeName(''), '');
  assert.equal(normalizeMatchKey('  DWI   SANTÓSO, S.H. '), 'dwi santoso s h');
});

test('value replacement previews exact and literal substring matches without changing numbers', () => {
  const table = { columns: ['Nama', 'Kode'], rows: [['Unit A', '01'], [' unit   a ', 2], ['Unit B', 3]] };
  const exact = replaceTableValues(table, { find: ' UNIT A ', replace: 'Unit A Barat', columnIndex: 0 });
  assert.equal(exact.changed, 2);
  assert.deepEqual(exact.examples, [
    { before: 'Unit A', after: 'Unit A Barat' },
    { before: ' unit   a ', after: 'Unit A Barat' },
  ]);
  assert.equal(table.rows[0][0], 'Unit A', 'replacement does not mutate source table');
  assert.deepEqual(exact.table.rows, [['Unit A Barat', '01'], ['Unit A Barat', 2], ['Unit B', 3]]);

  const literal = replaceTableValues({ columns: ['Nama'], rows: [['Budi (1)'], ['Budi 1']] }, {
    find: '(1)', replace: 'Satu', mode: 'contains',
  });
  assert.deepEqual(literal.table.rows, [['Budi Satu'], ['Budi 1']], 'pencarian substring tidak menafsirkan regex');
  const literalReplacement = replaceTableValues({ columns: ['Nama'], rows: [['A']] }, {
    find: 'A', replace: '$& $1', mode: 'contains',
  });
  assert.deepEqual(literalReplacement.table.rows, [['$& $1']], 'teks pengganti diperlakukan sebagai teks literal');
  assert.equal(replaceTableValues(table, { find: 'tidak ada', replace: 'x' }).changed, 0);
});

test('blank-row and duplicate cleanup preserve the first matching row', () => {
  const rows = [['Ani', 1], ['', '  '], ['ANI', 1], ['Budi', 2]];
  const blank = removeBlankRows(rows);
  assert.equal(blank.removed, 1);
  assert.deepEqual(blank.keptIndexes, [0, 2, 3]);
  const duplicates = removeDuplicateRows(blank.rows);
  assert.equal(duplicates.removed, 1);
  assert.deepEqual(duplicates.rows, [['Ani', 1], ['Budi', 2]]);
  assert.deepEqual(duplicates.keptIndexes, [0, 2]);

  const byName = removeDuplicateRows([['Ani', 'Unit A'], ['ANI', 'Unit B'], ['Budi', 'Unit A']], 0);
  assert.equal(byName.removed, 1);
  assert.deepEqual(byName.rows, [['Ani', 'Unit A'], ['Budi', 'Unit A']]);
  const byCanonicalName = removeDuplicateRows([['R. Santóso'], ['r santoso'], ['Rina Santoso']], 0);
  assert.deepEqual(byCanonicalName.rows, [['R. Santóso'], ['Rina Santoso']]);
  const byBlankKey = removeDuplicateRows([['', 'Unit A'], [null, 'Unit B'], [' ', 'Unit C']], 0);
  assert.equal(byBlankKey.removed, 0, 'kolom kunci kosong tidak cukup untuk menyatakan dua baris sama');
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
  assert.deepEqual(renameTableColumn(table, 1, ' Unit '), { columns: ['Unit', 'Unit (2)'], rows: [], headerEdited: [true, true] });
  assert.equal(renameTableColumn(table, 1, '  '), table);

  const imported = matrixToTable([[' Nama '], ['Budi']], true);
  assert.equal(imported.columns[0], 'Nama', 'judul bersih untuk kontrol dan pratinjau');
  assert.equal(tableToMatrix(imported)[0][0], ' Nama ', 'judul sumber dipertahankan saat ekspor tanpa edit');
  const explicitlyRenamed = renameTableColumn(imported, 0, 'Nama');
  assert.equal(tableToMatrix(explicitlyRenamed)[0][0], 'Nama');
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

test('processed XLSX keeps source formats and formulas, updates values, retains other sheets, and adds split tabs', async () => {
  const originalWorkbook = XLSX.utils.book_new();
  const sourceSheet = XLSX.utils.aoa_to_sheet([
    ['ID', ' Nama ', 'Unit', 'kWh', 'Rumus'],
    [123, 'rINA', 'Unit A', 12, 24],
    [7, 'Dewa', 'Unit/B', 15, 30],
  ]);
  sourceSheet.A2.z = '00000';
  sourceSheet.D2.z = '"Rp" #,##0.00';
  sourceSheet.E2.f = 'D2*2';
  sourceSheet.E2.v = 24;
  sourceSheet.E2.t = 'n';
  XLSX.utils.book_append_sheet(originalWorkbook, sourceSheet, 'Data');
  XLSX.utils.book_append_sheet(originalWorkbook, XLSX.utils.aoa_to_sheet([['Catatan'], ['tetap']]), 'Catatan');
  const originalNameCell = originalWorkbook.Sheets.Data.B2.v;
  const table = matrixToTable([
    ['ID', ' Nama ', 'Unit', 'kWh', 'Rumus'],
    [123, 'Rina', 'Unit A', 18, 24],
    [7, 'Dewa', 'Unit/B', 15, 30],
  ], true, { startRow: 0, startColumn: 0, endRow: 2, endColumn: 4 });

  const blob = await createProcessedWorkbookBlob({
    originalWorkbook,
    sheetName: 'Data',
    table,
    splitTables: partitionTableByColumn(table, 2),
    summaryRows: [['Rata-rata', 16.5]],
  });
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const result = XLSX.read(Buffer.from(await blob.arrayBuffer()), { type: 'buffer', cellDates: true, cellNF: true });
  assert.deepEqual(result.SheetNames, ['Data', 'Catatan', 'Unit A', 'Unit B', 'Ringkasan']);
  assert.equal(result.Sheets.Data.B1.v, ' Nama ', 'judul kolom sumber dipertahankan persis');
  assert.equal(result.Sheets.Data.B2.v, 'Rina');
  assert.equal(result.Sheets.Data.D2.v, 18);
  assert.equal(result.Sheets.Data.A2.z, '00000');
  assert.equal(XLSX.utils.format_cell(result.Sheets.Data.A2), '00123');
  assert.equal(result.Sheets.Data.D2.z, '"Rp" #,##0.00');
  assert.equal(result.Sheets.Data.E2.f, 'D2*2');
  assert.equal(result.Sheets.Catatan.A2.v, 'tetap');
  assert.equal(result.Sheets['Unit A'].B2.v, 'Rina');
  assert.equal(result.Sheets['Unit B'].C2.v, 'Unit/B');
  assert.equal(result.Sheets.Ringkasan.A1.v, 'Rata-rata');
  assert.equal(originalWorkbook.Sheets.Data.B2.v, originalNameCell, 'sumber tidak dimutasi');
});

test('XLSX export preserves full styles when values change and source rows move', async () => {
  const source = new ExcelJS.Workbook();
  const worksheet = source.addWorksheet('Data');
  worksheet.addRows([['Nama', 'Nilai', 'Rumus'], ['  rINA ', 12, null], ['Dewa', 17, null]]);
  worksheet.getCell('C3').value = { formula: 'B3*2', result: 34 };
  worksheet.getCell('A1').font = { bold: true, color: { argb: 'FF1F4E78' } };
  worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getCell('A1').border = { bottom: { style: 'thin', color: { argb: 'FF000000' } } };
  worksheet.getCell('A2').font = { italic: true };
  worksheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEEFF' } };
  worksheet.getCell('A3').font = { bold: true, color: { argb: 'FF008000' } };
  worksheet.getCell('A3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2F0D9' } };
  worksheet.getCell('B3').numFmt = '"Rp" #,##0.00';
  const sourceBytes = await source.xlsx.writeBuffer({ useStyles: true, useSharedStrings: true });
  const originalWorkbook = XLSX.read(sourceBytes, { type: 'array', cellDates: true, cellNF: true, cellStyles: true });
  const table = matrixToTable([['Nama', 'Nilai', 'Rumus'], ['Rina', 15, 24], ['Dewi', 17, 34]], true, {
    startRow: 0, startColumn: 0, endRow: 2, endColumn: 2,
  });
  table.rows = [['Dewi', 17, 34]];
  table.sourceRowIndexes = [2];
  const blob = await createProcessedWorkbookBlob({ originalWorkbook, sourceBytes, sheetName: 'Data', table });
  const exported = new ExcelJS.Workbook();
  await exported.xlsx.load(await blob.arrayBuffer());
  const outputSheet = exported.getWorksheet('Data');
  assert.equal(outputSheet.getCell('A1').font.bold, true);
  assert.equal(outputSheet.getCell('A1').fill.fgColor.argb, 'FFFFFF00');
  assert.equal(outputSheet.getCell('A1').alignment.horizontal, 'center');
  assert.equal(outputSheet.getCell('A1').border.bottom.style, 'thin');
  assert.equal(outputSheet.getCell('A2').value, 'Dewi');
  assert.equal(outputSheet.getCell('A2').font.bold, true, 'gaya baris sumber yang dipertahankan ikut dipindah');
  assert.equal(outputSheet.getCell('A2').fill.fgColor.argb, 'FFE2F0D9');
  assert.equal(outputSheet.getCell('B2').numFmt, '"Rp" #,##0.00');
  assert.equal(outputSheet.getCell('C2').value, 34, 'rumus disimpan sebagai nilai saat baris bergeser');
});

test('Excel table headers stay synchronized and table metadata follows structural edits', async () => {
  const source = new ExcelJS.Workbook();
  const worksheet = source.addWorksheet('Data');
  worksheet.addTable({
    name: 'DataTable', ref: 'A1:B3', headerRow: true,
    columns: [{ name: 'Nama' }, { name: 'Nilai' }],
    rows: [['Rina', 10], ['Budi', 20]],
  });
  const sourceBytes = await source.xlsx.writeBuffer({ useStyles: true, useSharedStrings: true });
  const originalWorkbook = XLSX.read(sourceBytes, { type: 'array', cellDates: true, cellNF: true, cellStyles: true });
  const table = matrixToTable([['Nama', 'Nilai'], ['Rina', 10], ['Budi', 20]], true, {
    startRow: 0, startColumn: 0, endRow: 2, endColumn: 1,
  });
  const renamed = renameTableColumn(table, 0, 'Nama Pegawai');
  const renamedBlob = await createProcessedWorkbookBlob({ originalWorkbook, sourceBytes, sheetName: 'Data', table: renamed });
  const renamedWorkbook = new ExcelJS.Workbook();
  await renamedWorkbook.xlsx.load(await renamedBlob.arrayBuffer());
  assert.equal(renamedWorkbook.getWorksheet('Data').getCell('A1').value, 'Nama Pegawai');
  assert.equal(renamedWorkbook.getWorksheet('Data').getTables()[0].model.columns[0].name, 'Nama Pegawai');

  const shortened = { ...table, rows: [table.rows[1]], sourceRowIndexes: [2] };
  const shortenedBlob = await createProcessedWorkbookBlob({ originalWorkbook, sourceBytes, sheetName: 'Data', table: shortened });
  const shortenedWorkbook = new ExcelJS.Workbook();
  await shortenedWorkbook.xlsx.load(await shortenedBlob.arrayBuffer());
  assert.equal(shortenedWorkbook.getWorksheet('Data').getCell('A2').value, 'Budi');
  assert.equal(shortenedWorkbook.getWorksheet('Data').getTables()[0].model.tableRef, 'A1:B2', 'referensi tabel disesuaikan dengan jumlah baris baru');
});

test('unchanged Excel error cells retain their type and formula on export', async () => {
  const sourceSheet = XLSX.utils.aoa_to_sheet([['Nama', 'Status'], ['Rina', '']]);
  sourceSheet.B2 = { t: 'e', v: 7, w: '#DIV/0!', f: '1/0' };
  const originalWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(originalWorkbook, sourceSheet, 'Data');
  const table = matrixToTable([['Nama', 'Status'], ['Rina', '#DIV/0!']], true, {
    startRow: 0, startColumn: 0, endRow: 1, endColumn: 1,
  });
  const blob = await createProcessedWorkbookBlob({ originalWorkbook, sheetName: 'Data', table });
  const result = XLSX.read(Buffer.from(await blob.arrayBuffer()), { type: 'buffer', cellNF: true });
  assert.equal(result.Sheets.Data.B2.t, 'e');
  assert.equal(result.Sheets.Data.B2.v, 7);
  assert.equal(result.Sheets.Data.B2.f, '1/0');
});
