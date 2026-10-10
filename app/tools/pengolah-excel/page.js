'use client';

import { useMemo, useRef, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import Icon from '@/components/icons';
import { useToast } from '@/context/ToastContext';
import { downloadBlob, downloadText, safeFileName } from '@/lib/fileDownload.mjs';
import {
  MAX_SPREADSHEET_BYTES,
  MAX_SPREADSHEET_CELLS,
  cellToText,
  cleanTableWhitespace,
  matrixToTable,
  normalizeName,
  numericColumnIndexes,
  parseNumericValue,
  partitionTableByColumn,
  removeBlankRows,
  removeDuplicateRows,
  renameTableColumn,
  replaceTableValues,
  splitTableColumn,
  summarizeBy,
  summarizeNumericColumn,
  toCsv,
  transformColumn,
  createProcessedWorkbookBlob,
} from '@/lib/spreadsheet.mjs';

const ACCEPTED_FILE = /\.(?:xlsx|xls|xlsm|csv)$/i;
const PAGE_SIZE = 20;
const SAMPLE_MATRIX = [
  ['Bulan', 'Unit Operasi', 'ULP', 'kWh Tersalur', 'Target kWh', 'Gangguan', 'Durasi Gangguan (menit)', 'Petugas'],
  ['Jan 2026', 'Unit Barat', 'ULP Cendana', 125000, 130000, 3, 42, '  rINA   puTRi  '],
  ['Jan 2026', 'Unit Barat', 'ULP Melati', 101500, 100000, 2, 28, 'bUDI sANTOSO'],
  ['Jan 2026', 'Unit Timur', 'ULP Anggrek', 143200, 140000, 1, 15, 'dewi  LESTARI'],
  ['Feb 2026', 'Unit Barat', 'ULP Cendana', 129400, 131000, 2, 24, '  rINA   puTRi  '],
  ['Feb 2026', 'Unit Barat', 'ULP Melati', 99500, 100000, 4, 57, 'BUDI SANTOSO'],
  ['Feb 2026', 'Unit Timur', 'ULP Anggrek', 146750, 142000, 1, 12, 'Dewi Lestari'],
  ['Mar 2026', 'Unit Barat', 'ULP Cendana', 133250, 132000, 2, 20, 'Rina Putri'],
  ['Mar 2026', 'Unit Timur', 'ULP Anggrek', 148000, 143000, 0, 0, 'Dewi Lestari'],
];

const DELIMITERS = [
  { value: ',', label: 'Koma (,)' },
  { value: ';', label: 'Titik koma (;)' },
  { value: '|', label: 'Pipa (|)' },
  { value: '-', label: 'Tanda hubung (-)' },
  { value: '/', label: 'Garis miring (/)' },
  { value: ' ', label: 'Spasi' },
  { value: '\t', label: 'Tab' },
  { value: 'custom', label: 'Pemisah lain…' },
];

const numberFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

function formatNumber(value) {
  return value === null || value === undefined || !Number.isFinite(value) ? '—' : numberFormat.format(value);
}

function formatCell(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '—' : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(value);
  if (typeof value === 'number') return numberFormat.format(value);
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
  return cellToText(value);
}

function sameSourceValue(value, sourceValue) {
  if (value instanceof Date && sourceValue instanceof Date) return value.getTime() === sourceValue.getTime();
  if (value === null || value === undefined) return sourceValue === null || sourceValue === undefined || sourceValue === '';
  return Object.is(value, sourceValue);
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value < 0) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function likelyNameColumn(columns) {
  const found = columns.findIndex((column) => /nama|pegawai|petugas|pelanggan|pelapor|name/i.test(column));
  return found >= 0 ? found : 0;
}

function compareCell(a, b) {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  const numericA = parseNumericValue(a);
  const numericB = parseNumericValue(b);
  if (numericA !== null && numericB !== null) return numericA - numericB;
  return cellToText(a).localeCompare(cellToText(b), 'id-ID', { numeric: true, sensitivity: 'base' });
}

function ActionButton({ icon, children, onClick, disabled = false, primary = false, title }) {
  return (
    <button type="button" className={`btn ${primary ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={onClick} disabled={disabled} title={title}>
      <Icon name={icon} size={14} /> {children}
    </button>
  );
}

export default function PengolahExcelPage() {
  const { addToast } = useToast();
  const fileInputRef = useRef(null);
  const workbookRef = useRef(null);
  const xlsxRef = useRef(null);
  const sourceFileObjectRef = useRef(null);
  const [sourceFile, setSourceFile] = useState('');
  const [sourceSize, setSourceSize] = useState(0);
  const [sheetNames, setSheetNames] = useState([]);
  const [activeSheet, setActiveSheet] = useState('');
  const [tables, setTables] = useState({});
  const [hasHeader, setHasHeader] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState({ column: -1, direction: 'asc' });
  const [nameColumn, setNameColumn] = useState(0);
  const [nameMode, setNameMode] = useState('title');
  const [splitColumn, setSplitColumn] = useState(0);
  const [valueColumn, setValueColumn] = useState(0);
  const [groupColumn, setGroupColumn] = useState(-1);
  const [delimiter, setDelimiter] = useState(',');
  const [customDelimiter, setCustomDelimiter] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [duplicateColumn, setDuplicateColumn] = useState(-1);
  const [replaceColumn, setReplaceColumn] = useState(0);
  const [findValue, setFindValue] = useState('');
  const [replacementValue, setReplacementValue] = useState('');
  const [replaceMode, setReplaceMode] = useState('exact');
  const [replaceCaseSensitive, setReplaceCaseSensitive] = useState(false);
  const [exporting, setExporting] = useState(false);

  const table = activeSheet ? tables[activeSheet] || null : null;
  const numericColumns = useMemo(() => table ? numericColumnIndexes(table) : [], [table]);
  const safeValueColumn = table?.columns.length
    ? (numericColumns.includes(valueColumn) ? valueColumn : numericColumns[0] ?? 0)
    : 0;
  const summary = useMemo(() => table && table.columns.length
    ? summarizeNumericColumn(table.rows, safeValueColumn)
    : { rowCount: 0, numericCount: 0, sum: 0, average: null, min: null, max: null }, [table, safeValueColumn]);
  const groupedSummary = useMemo(() => table && table.columns.length
    ? summarizeBy(table.rows, groupColumn, safeValueColumn)
    : [], [table, groupColumn, safeValueColumn]);
  const namePreview = useMemo(() => {
    if (!table || !table.columns.length) return { changed: 0, examples: [] };
    const examples = [];
    let changed = 0;
    for (const row of table.rows) {
      const before = row[nameColumn];
      const after = normalizeName(before, nameMode);
      if (Object.is(before, after)) continue;
      changed += 1;
      if (examples.length < 3) examples.push({ before: cellToText(before), after: cellToText(after) });
    }
    return { changed, examples };
  }, [table, nameColumn, nameMode]);
  const duplicatePreview = useMemo(() => table
    ? removeDuplicateRows(table.rows, duplicateColumn >= 0 ? duplicateColumn : null)
    : { rows: [], keptIndexes: [], duplicateIndexes: [], removed: 0 }, [table, duplicateColumn]);
  const replacePreview = useMemo(() => table
    ? replaceTableValues(table, {
      find: findValue,
      replace: replacementValue,
      columnIndex: replaceColumn >= 0 ? replaceColumn : null,
      mode: replaceMode,
      caseSensitive: replaceCaseSensitive,
    })
    : { table: null, changed: 0, examples: [] }, [table, findValue, replacementValue, replaceColumn, replaceMode, replaceCaseSensitive]);
  const filteredRows = useMemo(() => {
    if (!table) return [];
    const term = search.trim().toLocaleLowerCase('id-ID');
    const items = table.rows.map((row, index) => ({ row, index })).filter(({ row, index }) => (
      !term || row.some((value, columnIndex) => (
        cellToText(value).toLocaleLowerCase('id-ID').includes(term)
        || displayTableCell(value, index, columnIndex).toLocaleLowerCase('id-ID').includes(term)
      ))
    ));
    if (sort.column >= 0 && sort.column < table.columns.length) {
      items.sort((left, right) => {
        const result = compareCell(left.row[sort.column], right.row[sort.column]);
        return sort.direction === 'desc' ? -result : result;
      });
    }
    return items;
  }, [table, search, sort, activeSheet]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const visibleRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const emptyRows = table ? table.rows.filter((row) => row.every((value) => value === null || value === undefined || String(value).trim() === '')).length : 0;
  const emptyCells = table ? table.rows.reduce((total, row) => total + table.columns.filter((_, index) => row[index] === null || row[index] === undefined || (typeof row[index] === 'string' && row[index].trim() === '')).length, 0) : 0;

  function displayTableCell(value, rowIndex, columnIndex, sourceTable = table) {
    const sheet = workbookRef.current?.Sheets?.[activeSheet];
    const XLSX = xlsxRef.current;
    if (!sheet || !XLSX || !sourceTable?.sourceRange) return formatCell(value);
    const sourceRow = rowIndex === null
      ? (sourceTable.sourceHasHeader ? sourceTable.sourceRange.startRow : sourceTable.sourceRowIndexes?.[0])
      : sourceTable.sourceRowIndexes?.[rowIndex];
    const sourceColumn = sourceTable.sourceColumnIndexes?.[columnIndex];
    if (!Number.isInteger(sourceRow) || !Number.isInteger(sourceColumn)) return formatCell(value);
    const sourceCell = sheet[XLSX.utils.encode_cell({ r: sourceRow, c: sourceColumn })];
    if (typeof sourceCell?.w === 'string' && sourceCell.w && sameSourceValue(value, sourceCell.v ?? '')) return sourceCell.w;
    return formatCell(value);
  }

  function resetColumnSelections(nextTable) {
    const namesIndex = likelyNameColumn(nextTable.columns);
    const nextNumericColumns = numericColumnIndexes(nextTable);
    setNameColumn(namesIndex);
    setNameMode('title');
    setSplitColumn(0);
    setValueColumn(nextNumericColumns[0] ?? 0);
    setGroupColumn(-1);
    setDuplicateColumn(-1);
    setReplaceColumn(namesIndex);
    setFindValue('');
    setReplacementValue('');
    setReplaceMode('exact');
    setReplaceCaseSensitive(false);
    setRenameValue('');
  }

  function extractTable(workbook, XLSX, sheetName, headerMode = true) {
    const worksheet = workbook?.Sheets?.[sheetName];
    if (!worksheet) throw new Error(`Sheet “${sheetName}” tidak bisa dibaca.`);
    if (!worksheet['!ref']) return matrixToTable([], headerMode);
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const rowCount = range.e.r - range.s.r + 1;
    const columnCount = range.e.c - range.s.c + 1;
    const cellCount = rowCount * columnCount;
    if (rowCount < 1 || columnCount < 1 || !Number.isSafeInteger(cellCount) || cellCount > MAX_SPREADSHEET_CELLS) {
      throw new Error(`Rentang sheet terlalu besar (${Number.isFinite(cellCount) ? numberFormat.format(cellCount) : 'tidak valid'} sel). Batas tool ini ${numberFormat.format(MAX_SPREADSHEET_CELLS)} sel per sheet.`);
    }
    const matrix = [];
    for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
      const row = [];
      for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
        row.push(cell?.t === 'e' ? (cell.w || cell.v || '') : (cell?.v ?? ''));
      }
      matrix.push(row);
    }
    return matrixToTable(matrix, headerMode, {
      startRow: range.s.r,
      startColumn: range.s.c,
      endRow: range.e.r,
      endColumn: range.e.c,
    });
  }

  function installWorkbook(workbook, XLSX, fileName, fileSize = 0, sample = false, sourceFile = null) {
    if (!workbook?.SheetNames?.length) throw new Error('Tidak ada sheet atau data yang bisa dibaca di file ini.');
    const firstSheet = workbook.SheetNames[0];
    const firstTable = extractTable(workbook, XLSX, firstSheet, true);
    workbookRef.current = workbook;
    xlsxRef.current = XLSX;
    sourceFileObjectRef.current = sourceFile;
    setSourceFile(fileName);
    setSourceSize(fileSize);
    setSheetNames([...workbook.SheetNames]);
    setActiveSheet(firstSheet);
    setTables({ [firstSheet]: firstTable });
    setHasHeader(true);
    setHistory([]);
    setSearch('');
    setPage(0);
    setSort({ column: -1, direction: 'asc' });
    resetColumnSelections(firstTable);
    setLoadError('');
    if (sample) addToast('Contoh data fiktif siap diolah.', 'success');
    else addToast(`“${fileName}” berhasil dibuka.`, 'success');
  }

  async function openFile(file) {
    if (!file) return;
    setLoadError('');
    if (!ACCEPTED_FILE.test(file.name)) {
      setLoadError('Pilih file Excel (.xlsx, .xls, .xlsm) atau CSV (.csv).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > MAX_SPREADSHEET_BYTES) {
      setLoadError(`Ukuran file melebihi batas ${formatBytes(MAX_SPREADSHEET_BYTES)}. Pecah file menjadi beberapa bagian terlebih dahulu.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setLoading(true);
    try {
      const imported = await import('@e965/xlsx');
      const XLSX = imported.default || imported;
      const sourceBytes = await file.arrayBuffer();
      const workbook = XLSX.read(sourceBytes, { type: 'array', cellDates: true, cellNF: true, cellStyles: true });
      installWorkbook(workbook, XLSX, file.name, file.size, false, file);
    } catch (error) {
      console.error('Tidak bisa membuka spreadsheet:', error);
      setLoadError(error?.message ? `File belum bisa dibuka: ${error.message}` : 'File belum bisa dibuka. Pastikan file tidak rusak atau diproteksi kata sandi.');
      addToast('Gagal membaca file spreadsheet.', 'error');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function useSampleData() {
    setLoading(true);
    setLoadError('');
    try {
      const imported = await import('@e965/xlsx');
      const XLSX = imported.default || imported;
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(SAMPLE_MATRIX), 'Rekap Unit');
      installWorkbook(workbook, XLSX, 'Contoh operasional fiktif.xlsx', 0, true);
    } catch (error) {
      console.error('Tidak bisa membuat contoh spreadsheet:', error);
      setLoadError('Contoh data belum bisa dimuat. Coba muat ulang halaman.');
      addToast('Gagal menyiapkan contoh data.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function selectSheet(sheetName) {
    if (!sheetName || sheetName === activeSheet) return;
    try {
      const existing = tables[sheetName];
      const nextTable = existing || extractTable(workbookRef.current, xlsxRef.current, sheetName, hasHeader);
      if (!existing) setTables((current) => ({ ...current, [sheetName]: nextTable }));
      setActiveSheet(sheetName);
      setHistory([]);
      setSearch('');
      setPage(0);
      setSort({ column: -1, direction: 'asc' });
      resetColumnSelections(nextTable);
    } catch (error) {
      addToast(error.message || 'Sheet tidak bisa dibuka.', 'error');
    }
  }

  function changeHeaderMode(enabled) {
    setHasHeader(enabled);
    if (!workbookRef.current || !activeSheet) return;
    try {
      const nextTable = extractTable(workbookRef.current, xlsxRef.current, activeSheet, enabled);
      setTables({ [activeSheet]: nextTable });
      setHistory([]);
      setSearch('');
      setPage(0);
      resetColumnSelections(nextTable);
    } catch (error) {
      addToast(error.message || 'Sheet tidak bisa diperbarui.', 'error');
    }
  }

  function commitTable(nextTable, label) {
    if (!table || !nextTable || nextTable === table) return;
    setHistory((current) => [...current.slice(-7), { sheetName: activeSheet, table, label }]);
    setTables((current) => ({ ...current, [activeSheet]: nextTable }));
    setPage(0);
    addToast(label, 'success');
  }

  function runCleanWhitespace() {
    if (!table) return;
    commitTable(cleanTableWhitespace(table), 'Spasi ekstra sudah dirapikan di semua kolom teks.');
  }

  function runNameCleanup() {
    if (!table?.columns.length) return;
    const next = transformColumn(table, nameColumn, (value) => normalizeName(value, nameMode));
    commitTable(next, `Nama pada kolom “${table.columns[nameColumn]}” sudah dirapikan.`);
  }

  function runReplaceValues() {
    if (!table || !findValue.trim()) {
      addToast('Isi nilai yang ingin dicari terlebih dahulu.', 'warning');
      return;
    }
    if (!replacePreview.changed) {
      addToast('Tidak ada nilai yang cocok untuk diganti.', 'info');
      return;
    }
    const target = replaceColumn >= 0 ? ` di kolom “${table.columns[replaceColumn]}”` : ' pada semua kolom teks';
    commitTable(replacePreview.table, `${replacePreview.changed} nilai disamakan${target}.`);
  }

  function runRemoveBlankRows() {
    if (!table) return;
    const result = removeBlankRows(table.rows);
    if (!result.removed) {
      addToast('Tidak ada baris kosong untuk dihapus.', 'info');
      return;
    }
    commitTable({
      ...table,
      rows: result.rows,
      sourceRowIndexes: table.sourceRowIndexes ? result.keptIndexes.map((index) => table.sourceRowIndexes[index]) : undefined,
    }, `${result.removed} baris kosong dihapus.`);
  }

  function runRemoveDuplicates() {
    if (!table) return;
    const result = removeDuplicateRows(table.rows, duplicateColumn >= 0 ? duplicateColumn : null);
    if (!result.removed) {
      addToast('Tidak ada baris duplikat yang ditemukan.', 'info');
      return;
    }
    const criterion = duplicateColumn >= 0 ? ` berdasarkan “${table.columns[duplicateColumn]}”` : '';
    commitTable({
      ...table,
      rows: result.rows,
      sourceRowIndexes: table.sourceRowIndexes ? result.keptIndexes.map((index) => table.sourceRowIndexes[index]) : undefined,
    }, `${result.removed} baris duplikat dihapus${criterion}.`);
  }

  function runSplitColumn() {
    if (!table) return;
    const separator = delimiter === 'custom' ? customDelimiter : delimiter;
    if (!separator) {
      addToast('Isi karakter pemisah terlebih dahulu.', 'warning');
      return;
    }
    const result = splitTableColumn(table, splitColumn, separator);
    if (!result.changed) {
      addToast('Pemisah tidak ditemukan di kolom tersebut.', 'info');
      return;
    }
    commitTable(result.table, `Kolom “${table.columns[splitColumn]}” dipecah menjadi ${result.parts} kolom.`);
    const shift = result.parts - 1;
    const adjust = (value) => (value > splitColumn ? value + shift : value);
    setNameColumn((value) => adjust(value));
    setValueColumn((value) => adjust(value));
    setGroupColumn((value) => (value >= 0 ? adjust(value) : value));
    setDuplicateColumn((value) => (value >= 0 ? adjust(value) : value));
    setReplaceColumn((value) => (value >= 0 ? adjust(value) : value));
    setSplitColumn(splitColumn);
  }

  function runRenameColumn() {
    if (!table) return;
    const next = renameTableColumn(table, splitColumn, renameValue);
    if (next === table) {
      addToast('Masukkan nama kolom baru yang berbeda.', 'warning');
      return;
    }
    commitTable(next, `Nama kolom diperbarui menjadi “${next.columns[splitColumn]}”.`);
    setRenameValue('');
  }

  function undoLastChange() {
    const previous = history[history.length - 1];
    if (!previous || previous.sheetName !== activeSheet) return;
    setTables((current) => ({ ...current, [activeSheet]: previous.table }));
    setHistory((current) => current.slice(0, -1));
    setPage(0);
    resetColumnSelections(previous.table);
    addToast(`Perubahan dibatalkan: ${previous.label}`, 'info');
  }

  function resetActiveSheet() {
    if (!activeSheet || !workbookRef.current) return;
    try {
      const original = extractTable(workbookRef.current, xlsxRef.current, activeSheet, hasHeader);
      setTables((current) => ({ ...current, [activeSheet]: original }));
      setHistory([]);
      setSearch('');
      setPage(0);
      resetColumnSelections(original);
      addToast('Sheet dikembalikan ke data asli dari file.', 'info');
    } catch (error) {
      addToast(error.message || 'Sheet tidak bisa dipulihkan.', 'error');
    }
  }

  function handleSort(columnIndex) {
    setSort((current) => ({
      column: columnIndex,
      direction: current.column === columnIndex && current.direction === 'asc' ? 'desc' : 'asc',
    }));
    setPage(0);
  }

  function buildSummaryRows() {
    const groupName = groupColumn >= 0 ? table.columns[groupColumn] : 'Semua data';
    return [
      ['RINGKASAN PENGOLAHAN DATA'],
      ['Nama file sumber', sourceFile],
      ['Sheet yang diolah', activeSheet],
      ['Jumlah baris data', summary.rowCount],
      ['Kolom angka', table.columns[safeValueColumn] || '—'],
      ['Kolom pengelompokan', groupName],
      ['Jumlah nilai angka', summary.numericCount],
      ['Rata-rata', summary.average ?? '—'],
      ['Total', summary.sum],
      ['Minimum', summary.min ?? '—'],
      ['Maksimum', summary.max ?? '—'],
      [],
      ['Kelompok', 'Jumlah baris', 'Data numerik', 'Rata-rata', 'Total', 'Minimum', 'Maksimum'],
      ...groupedSummary.map((item) => [item.group, item.rowCount, item.numericCount, item.average ?? '—', item.sum, item.min ?? '—', item.max ?? '—']),
    ];
  }

  async function exportExcel() {
    if (!table || !table.columns.length) return;
    setExporting(true);
    try {
      const blob = await createProcessedWorkbookBlob({
        originalWorkbook: workbookRef.current,
        sourceBytes: sourceFileObjectRef.current ? await sourceFileObjectRef.current.arrayBuffer() : null,
        sheetName: activeSheet,
        table,
        summaryRows: buildSummaryRows(),
      });
      downloadBlob(blob, `${safeFileName(sourceFile.replace(/\.[^.]+$/, ''), 'rekap-operasional')}-olah.xlsx`);
      addToast('Excel hasil olahan berhasil diunduh. Sheet lain tetap disertakan.', 'success');
    } catch (error) {
      console.error('Gagal mengekspor Excel:', error);
      addToast('Excel belum bisa diekspor. Coba lagi atau unduh sebagai CSV.', 'error');
    } finally {
      setExporting(false);
    }
  }

  async function exportSplitExcel() {
    if (!table || !table.columns.length) return;
    if (groupColumn < 0) {
      addToast('Pilih kolom pengelompokan pada panel rata-rata terlebih dahulu.', 'warning');
      return;
    }
    const splitTables = partitionTableByColumn(table, groupColumn);
    if (splitTables.length < 2) {
      addToast('Hanya ada satu kelompok. Pilih kolom lain untuk memisahkan data.', 'info');
      return;
    }
    if (splitTables.length > 200) {
      addToast('Ada lebih dari 200 kelompok. Pilih kolom dengan jumlah kelompok lebih sedikit.', 'warning', 6000);
      return;
    }
    setExporting(true);
    try {
      const blob = await createProcessedWorkbookBlob({
        originalWorkbook: workbookRef.current,
        sourceBytes: sourceFileObjectRef.current ? await sourceFileObjectRef.current.arrayBuffer() : null,
        sheetName: activeSheet,
        table,
        summaryRows: buildSummaryRows(),
        splitTables,
      });
      const groupSlug = safeFileName(table.columns[groupColumn], 'kelompok');
      downloadBlob(blob, `${safeFileName(sourceFile.replace(/\.[^.]+$/, ''), 'rekap-operasional')}-per-${groupSlug}.xlsx`);
      addToast(`Excel terpisah menjadi ${splitTables.length} sheet berdasarkan “${table.columns[groupColumn]}”.`, 'success', 5200);
    } catch (error) {
      console.error('Gagal memisahkan Excel per kelompok:', error);
      addToast('Excel per kelompok belum bisa dibuat. Coba lagi.', 'error');
    } finally {
      setExporting(false);
    }
  }
  function exportCsv() {
    if (!table || !table.columns.length) return;
    downloadText(toCsv(table), `${safeFileName(activeSheet, 'data')}-olah.csv`, 'text/csv;charset=utf-8');
    addToast('CSV hasil olahan berhasil diunduh.', 'success');
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void openFile(file);
  }

  const largestGroupAverage = groupedSummary.reduce((largest, item) => Math.max(largest, Math.abs(item.average || 0)), 0);

  return (
    <ToolShell
      title="Pengolah Data Excel"
      desc="Pisahkan kolom, rapikan nama dan spasi, bersihkan duplikat, hitung rata-rata atau total per unit, lalu ekspor kembali ke Excel."
      icon="chart"
      className="nv-tool-wide npx-tool"
    >
      <div className="nv-stack npx-stack">
        <div className="nv-notice is-info npx-privacy-note" role="note">
          <strong>Data diproses di browser kamu</strong>
          <div className="nv-notice-body">File tidak diunggah oleh tool ini. Tetap ikuti aturan klasifikasi dan keamanan internal PLN, serta verifikasi hasil sebelum dipakai sebagai laporan resmi.</div>
        </div>

        <section className={`npx-upload${dragging ? ' is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} aria-labelledby="npx-upload-title">
          <div className="npx-upload-mark" aria-hidden="true"><Icon name="upload" size={24} /></div>
          <div className="npx-upload-copy">
            <h2 id="npx-upload-title">Mulai dari file Excel atau CSV</h2>
            <p>Format .xlsx, .xls, .xlsm, dan .csv · batas 25 MB dan 1.000.000 sel per sheet · baris pertama dianggap sebagai judul kolom.</p>
          </div>
          <div className="npx-upload-actions">
            <label className="btn btn-primary btn-sm npx-file-button" htmlFor="npx-file-input">
              <Icon name="upload" size={14} /> Pilih file
              <input ref={fileInputRef} id="npx-file-input" type="file" accept=".xlsx,.xls,.xlsm,.csv" onChange={(event) => void openFile(event.target.files?.[0])} disabled={loading} />
            </label>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void useSampleData()} disabled={loading}>
              <Icon name="sparkles" size={14} /> Coba data contoh
            </button>
          </div>
          <p className="npx-drop-hint">atau seret file ke area ini. Untuk uji coba, tersedia data operasional fiktif—bukan data PLN asli.</p>
          {loading ? <p className="npx-status" role="status">Membaca spreadsheet…</p> : null}
          {loadError ? <p className="npx-load-error" role="alert">{loadError}</p> : null}
        </section>

        {table ? (
          <>
            <section className="npx-workbook-bar" aria-label="Pengaturan workbook">
              <div className="npx-file-meta">
                <span className="npx-file-badge" aria-hidden="true">XLS</span>
                <div><strong title={sourceFile}>{sourceFile}</strong><small>{sourceSize ? formatBytes(sourceSize) : 'Data contoh'} · {sheetNames.length} sheet</small></div>
              </div>
              <div className="npx-workbook-controls">
                {sheetNames.length > 1 ? (
                  <label className="npx-compact-field"><span>Sheet aktif</span><select className="select" value={activeSheet} onChange={(event) => selectSheet(event.target.value)}>
                    {sheetNames.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select></label>
                ) : <span className="npx-current-sheet"><Icon name="file" size={14} /> {activeSheet}</span>}
                <label className="npx-checkbox"><input type="checkbox" checked={hasHeader} onChange={(event) => changeHeaderMode(event.target.checked)} /> Baris pertama adalah judul</label>
              </div>
            </section>

            {!table.columns.length ? (
              <div className="nv-notice is-warn" role="note"><strong>Sheet ini belum berisi tabel.</strong><div className="nv-notice-body">Pilih sheet lain, atau periksa apakah lembar kerja memiliki data.</div></div>
            ) : (
              <>
                <div className="npx-stat-strip" aria-label="Ringkasan isi sheet">
                  <div><span>Baris data</span><b>{numberFormat.format(table.rows.length)}</b></div>
                  <div><span>Kolom</span><b>{numberFormat.format(table.columns.length)}</b></div>
                  <div><span>Sel kosong</span><b>{numberFormat.format(emptyCells)}</b></div>
                  <div><span>Baris kosong</span><b>{numberFormat.format(emptyRows)}</b></div>
                  <div className="npx-stat-note"><Icon name="shield" size={15} /><span>Perubahan hanya pada sheet aktif</span></div>
                </div>

                <div className="npx-workbench">
                  <section className="npx-card npx-table-card" aria-labelledby="npx-table-title">
                    <div className="npx-card-head npx-table-head">
                      <div><p className="nv-eyebrow">PRATINJAU DATA</p><h2 id="npx-table-title">{activeSheet}</h2><p>{numberFormat.format(filteredRows.length)} baris cocok dari {numberFormat.format(table.rows.length)}</p></div>
                      <div className="npx-export-actions">
                        <ActionButton icon="download" onClick={() => void exportExcel()} disabled={exporting || !table.rows.length} primary>{exporting ? 'Menyiapkan…' : 'Unduh Excel'}</ActionButton>
                        <ActionButton icon="users" onClick={() => void exportSplitExcel()} disabled={exporting || !table.rows.length || groupColumn < 0 || groupedSummary.length < 2} title="Buat sheet terpisah untuk setiap kelompok yang dipilih">Pisah per grup</ActionButton>
                        <ActionButton icon="file" onClick={exportCsv} disabled={!table.rows.length}>CSV</ActionButton>
                      </div>
                    </div>
                    <div className="npx-preview-tools">
                      <label className="npx-search"><Icon name="search" size={15} /><span className="visually-hidden">Cari isi spreadsheet</span><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Cari di semua kolom…" /></label>
                      <div className="npx-preview-meta">Menampilkan {filteredRows.length ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filteredRows.length)}` : '0'} dari {numberFormat.format(filteredRows.length)}</div>
                    </div>
                    <div className="npx-table-wrap" tabIndex={0} role="region" aria-label="Pratinjau tabel, geser untuk melihat kolom lainnya">
                      <table className="npx-table">
                        <thead><tr><th scope="col" className="npx-row-number">#</th>{table.columns.map((column, index) => <th scope="col" key={`${index}-${column}`}><button type="button" className="npx-sort-button" onClick={() => handleSort(index)} aria-label={`Urutkan berdasarkan ${column}`} aria-pressed={sort.column === index}>{displayTableCell(column, null, index)}<span aria-hidden="true">{sort.column === index ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span></button></th>)}</tr></thead>
                        <tbody>
                          {visibleRows.length ? visibleRows.map(({ row, index }) => (
                            <tr key={`${activeSheet}-${index}`}><th scope="row" className="npx-row-number">{index + 1}</th>{table.columns.map((_, columnIndex) => <td key={columnIndex} title={displayTableCell(row[columnIndex], index, columnIndex)}>{displayTableCell(row[columnIndex], index, columnIndex)}</td>)}</tr>
                          )) : <tr><td className="npx-empty-table" colSpan={table.columns.length + 1}>Tidak ada baris yang cocok dengan pencarian.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    <div className="npx-pagination">
                      <span>Halaman {Math.min(page + 1, totalPages)} dari {totalPages}</span>
                      <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0}>Sebelumnya</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))} disabled={page >= totalPages - 1}>Berikutnya</button></div>
                    </div>
                    <p className="npx-export-hint">Ekspor mencakup semua baris, bukan hanya hasil pencarian. Format sel umum dipertahankan. Jika struktur diubah, rumus sheet aktif dijadikan nilai, rumus sheet lain perlu diperiksa, dan tabel terstruktur mungkin disesuaikan. File .xlsm diekspor sebagai .xlsx tanpa makro.</p>
                  </section>

                  <aside className="npx-side-column">
                    <section className="npx-card npx-summary-card" aria-labelledby="npx-summary-title">
                      <div className="npx-card-head"><div><p className="nv-eyebrow">HITUNG CEPAT</p><h2 id="npx-summary-title">Rata-rata &amp; rekap</h2><p>Pilih kolom angka dan, bila perlu, kelompokkan per unit.</p></div></div>
                      <div className="npx-select-stack">
                        <label className="npx-compact-field"><span>Nilai angka</span><select className="select" value={safeValueColumn} onChange={(event) => { const next = Number(event.target.value); setValueColumn(next); if (groupColumn === next) setGroupColumn(-1); }}>
                          {table.columns.map((column, index) => <option key={index} value={index}>{column}{numericColumns.includes(index) ? '' : ' · belum ada angka'}</option>)}
                        </select></label>
                        <label className="npx-compact-field"><span>Kelompokkan berdasarkan</span><select className="select" value={groupColumn} onChange={(event) => setGroupColumn(Number(event.target.value))}>
                          <option value={-1}>Semua data</option>{table.columns.map((column, index) => <option key={index} value={index} disabled={index === safeValueColumn}>{column}</option>)}
                        </select></label>
                      </div>
                      <div className="npx-summary-metrics">
                        <div><span>Rata-rata</span><b>{formatNumber(summary.average)}</b><small>{summary.numericCount} nilai angka</small></div>
                        <div><span>Total</span><b>{formatNumber(summary.sum)}</b><small>{table.columns[safeValueColumn]}</small></div>
                        <div><span>Minimum</span><b>{formatNumber(summary.min)}</b><small>Nilai terkecil</small></div>
                        <div><span>Maksimum</span><b>{formatNumber(summary.max)}</b><small>Nilai terbesar</small></div>
                      </div>
                      {!summary.numericCount ? <p className="npx-no-numbers">Kolom ini belum memiliki nilai angka. Pilih kolom lain atau bersihkan format angkanya dulu.</p> : null}
                      {groupedSummary.length ? (
                        <div className="npx-groups">
                          <h3>{groupColumn >= 0 ? `Rata-rata per ${table.columns[groupColumn]}` : 'Ringkasan keseluruhan'}</h3>
                          <div className="npx-group-list">
                            {groupedSummary.slice(0, 12).map((item, index) => {
                              const width = largestGroupAverage ? Math.max(2, (Math.abs(item.average || 0) / largestGroupAverage) * 100) : 0;
                              return <div className="npx-group-row" key={`${item.group}-${index}`}><div className="npx-group-label"><strong title={item.group}>{item.group}</strong><span>{item.numericCount} angka · {item.rowCount} baris</span></div><div className="npx-group-value"><b>{formatNumber(item.average)}</b><span className="npx-bar"><i style={{ width: `${width}%` }} /></span></div></div>;
                            })}
                          </div>
                          {groupedSummary.length > 12 ? <p className="npx-more-groups">+ {numberFormat.format(groupedSummary.length - 12)} kelompok lain disertakan saat ekspor Excel.</p> : null}
                        </div>
                      ) : null}
                    </section>

                    <section className="npx-card npx-actions-card" aria-labelledby="npx-actions-title">
                      <div className="npx-card-head"><div><p className="nv-eyebrow">BERSIHKAN &amp; PISAHKAN</p><h2 id="npx-actions-title">Alat pengolahan</h2><p>Perubahan dapat dibatalkan dengan Undo atau dipulihkan per sheet.</p></div></div>

                      <div className="npx-action-block">
                        <h3>Rapikan teks dan nama</h3>
                        <label className="npx-compact-field"><span>Kolom nama</span><select className="select" value={nameColumn} onChange={(event) => setNameColumn(Number(event.target.value))}>{table.columns.map((column, index) => <option key={index} value={index}>{column}</option>)}</select></label>
                        <label className="npx-compact-field"><span>Format nama</span><select className="select" value={nameMode} onChange={(event) => setNameMode(event.target.value)}><option value="title">Kapitalisasi wajar (Rina Putri)</option><option value="preserve">Rapikan spasi saja—pertahankan huruf</option><option value="upper">HURUF BESAR</option><option value="lower">huruf kecil</option></select></label>
                        <div className="npx-name-preview" aria-live="polite"><strong>{numberFormat.format(namePreview.changed)} nilai akan berubah</strong>{namePreview.examples.length ? <ul>{namePreview.examples.map((example, index) => <li key={`${index}-${example.before}`}><span>{example.before || '—'}</span><b aria-hidden="true">→</b><span>{example.after || '—'}</span></li>)}</ul> : <small>Tidak ada perubahan yang diperlukan dengan format ini.</small>}</div>
                        <div className="npx-button-row"><ActionButton icon="sparkles" onClick={runNameCleanup} disabled={!namePreview.changed}>Terapkan format nama</ActionButton><ActionButton icon="check" onClick={runCleanWhitespace} disabled={!table.rows.length}>Rapikan spasi semua kolom</ActionButton></div>
                        <p className="npx-help">Periksa pratinjau sebelum menerapkan. Singkatan umum seperti PLN, ULP, dan SUTT dipertahankan.</p>
                      </div>

                      <div className="npx-action-block">
                        <h3>Samakan nilai yang berbeda</h3>
                        <label className="npx-compact-field"><span>Kolom target</span><select className="select" value={replaceColumn} onChange={(event) => setReplaceColumn(Number(event.target.value))}><option value={-1}>Semua kolom teks</option>{table.columns.map((column, index) => <option key={index} value={index}>{column}</option>)}</select></label>
                        <label className="npx-compact-field"><span>Cari nilai</span><input className="input" value={findValue} onChange={(event) => setFindValue(event.target.value)} maxLength={500} placeholder="Contoh: ULP Cibiru" /></label>
                        <label className="npx-compact-field"><span>Ganti menjadi</span><input className="input" value={replacementValue} onChange={(event) => setReplacementValue(event.target.value)} maxLength={500} placeholder="Contoh: ULP Cibiru Kota" /></label>
                        <label className="npx-compact-field"><span>Jenis pencarian</span><select className="select" value={replaceMode} onChange={(event) => setReplaceMode(event.target.value)}><option value="exact">Nilai sama persis</option><option value="contains">Mengandung teks</option></select></label>
                        <label className="npx-checkbox"><input type="checkbox" checked={replaceCaseSensitive} onChange={(event) => setReplaceCaseSensitive(event.target.checked)} />Bedakan huruf besar dan kecil</label>
                        <div className="npx-name-preview" aria-live="polite"><strong>{numberFormat.format(replacePreview.changed)} nilai akan diganti</strong>{replacePreview.examples.length ? <ul>{replacePreview.examples.map((example, index) => <li key={`${index}-${example.before}`}><span>{example.before || '—'}</span><b aria-hidden="true">→</b><span>{example.after || '—'}</span></li>)}</ul> : <small>Isi nilai pencarian untuk melihat pratinjau perubahan.</small>}</div>
                        <ActionButton icon="edit" onClick={runReplaceValues} disabled={!findValue.trim() || !replacePreview.changed}>Terapkan penggantian</ActionButton>
                        <p className="npx-help">Untuk merapikan ejaan/label yang tidak seragam. Pencarian persis mengabaikan kapital dan merapikan spasi; pratinjau menunjukkan jumlah dan contoh sebelum diterapkan.</p>
                      </div>

                      <div className="npx-action-block">
                        <h3>Pisahkan kolom</h3>
                        <label className="npx-compact-field"><span>Kolom yang dipisah</span><select className="select" value={splitColumn} onChange={(event) => { setSplitColumn(Number(event.target.value)); setRenameValue(''); }}>{table.columns.map((column, index) => <option key={index} value={index}>{column}</option>)}</select></label>
                        <label className="npx-compact-field"><span>Pemisah</span><select className="select" value={delimiter} onChange={(event) => setDelimiter(event.target.value)}>{DELIMITERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                        {delimiter === 'custom' ? <label className="npx-compact-field"><span>Karakter pemisah lain</span><input className="input" value={customDelimiter} onChange={(event) => setCustomDelimiter(event.target.value.slice(0, 12))} maxLength={12} placeholder="Contoh: ::" /></label> : null}
                        <ActionButton icon="sliders" onClick={runSplitColumn} disabled={!table.rows.length} primary>Pisahkan jadi beberapa kolom</ActionButton>
                        <p className="npx-help">Contoh: “Nama | Unit” dipisah memakai tanda pipa menjadi dua kolom.</p>
                      </div>

                      <div className="npx-action-block">
                        <h3>Nama kolom</h3>
                        <label className="npx-compact-field"><span>Nama baru untuk kolom terpilih</span><input className="input" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} maxLength={120} placeholder={table.columns[splitColumn] || 'Nama kolom'} /></label>
                        <ActionButton icon="edit" onClick={runRenameColumn} disabled={!renameValue.trim()}>Ubah judul kolom</ActionButton>
                      </div>

                      <div className="npx-action-block">
                        <h3>Hapus baris tak perlu</h3>
                        <ActionButton icon="close" onClick={runRemoveBlankRows} disabled={!emptyRows}>Hapus {numberFormat.format(emptyRows)} baris kosong</ActionButton>
                        <label className="npx-compact-field"><span>Duplikat berdasarkan</span><select className="select" value={duplicateColumn} onChange={(event) => setDuplicateColumn(Number(event.target.value))}><option value={-1}>Seluruh isi baris</option>{table.columns.map((column, index) => <option key={index} value={index}>{column}</option>)}</select></label>
                        <p className="npx-help" aria-live="polite">{duplicatePreview.removed ? `${numberFormat.format(duplicatePreview.removed)} kandidat duplikat ditemukan; baris pertama akan dipertahankan.` : 'Belum ada duplikat yang ditemukan.'}{duplicateColumn >= 0 ? ' Pada satu kolom, kapital, aksen, spasi, dan tanda baca diabaikan.' : ''}</p>
                        <ActionButton icon="trash" onClick={runRemoveDuplicates} disabled={!duplicatePreview.removed}>Hapus {numberFormat.format(duplicatePreview.removed)} duplikat</ActionButton>
                      </div>

                      <div className="npx-recovery-actions">
                        <ActionButton icon="repeat" onClick={undoLastChange} disabled={!history.length}>Undo perubahan</ActionButton>
                        <ActionButton icon="close" onClick={resetActiveSheet} disabled={!history.length && !sourceFile}>Pulihkan sheet asli</ActionButton>
                      </div>
                    </section>
                  </aside>
                </div>
              </>
            )}
          </>
        ) : null}
      </div>
    </ToolShell>
  );
}
