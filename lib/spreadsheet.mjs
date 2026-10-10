/**
 * Utilitas pengolahan spreadsheet yang aman dipakai di browser dan Node.
 * File pengguna tidak perlu dikirim ke server.
 */

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const CSV_MIME = 'text/csv;charset=utf-8';
export const MAX_SPREADSHEET_BYTES = 25 * 1024 * 1024;
export const MAX_SPREADSHEET_CELLS = 1_000_000;

const NAME_ACRONYMS = new Set([
  'AMR', 'ASN', 'CV', 'GIS', 'GITET', 'ID', 'JTM', 'KTP', 'KWH', 'NIK', 'NIP', 'NPWP', 'PBB', 'PDAM', 'PJU',
  'PLN', 'PLTA', 'PLTD', 'PLTS', 'PLTU', 'PT', 'RI', 'SCADA', 'SD', 'SLO', 'SMA', 'SMP', 'SUTET', 'SUTT',
  'UID', 'UIP', 'UIW', 'UIT', 'ULP', 'UP2B', 'UP2D', 'UP3', 'UPK',
]);
const NAME_PARTICLES = new Set(['al', 'bin', 'binti', 'da', 'de', 'di', 'du', 'el', 'ibn', 'la', 'le', 'van', 'von']);

export function isBlankCell(value) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

export function cellToText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if (Array.isArray(value)) return value.map(cellToText).join(', ');
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('result' in value) return cellToText(value.result);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function cleanWhitespace(value) {
  if (value instanceof Date || value === null || value === undefined || typeof value !== 'string') return value;
  return value
    .normalize('NFKC')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[\t\r\n\f\v ]+/g, ' ')
    .trim();
}

export function normalizeName(value, mode = 'title') {
  if (value === null || value === undefined || value === '') return value;
  if (typeof value !== 'string') return value;
  const text = cleanWhitespace(value);
  if (!text) return '';
  if (mode === 'preserve') return text;
  if (mode === 'upper') return text.toLocaleUpperCase('id-ID');
  if (mode === 'lower') return text.toLocaleLowerCase('id-ID');
  return text.toLocaleLowerCase('id-ID').replace(/[\p{L}\p{N}]+/gu, (part, offset) => {
    const acronym = part.toLocaleUpperCase('id-ID');
    if (NAME_ACRONYMS.has(acronym)) return acronym;
    if (offset > 0 && NAME_PARTICLES.has(part)) return part;
    const [first, ...rest] = [...part];
    return `${first.toLocaleUpperCase('id-ID')}${rest.join('')}`;
  });
}

export function makeUniqueHeaders(values, width = values.length) {
  const seen = new Map();
  const used = new Set();
  return Array.from({ length: width }, (_, index) => {
    const raw = cleanWhitespace(cellToText(values[index]));
    const base = String(raw || `Kolom ${index + 1}`).slice(0, 120);
    let count = (seen.get(base.toLocaleLowerCase('id-ID')) || 0) + 1;
    let candidate = count === 1 ? base : `${base} (${count})`;
    while (used.has(candidate.toLocaleLowerCase('id-ID'))) {
      count += 1;
      candidate = `${base} (${count})`;
    }
    seen.set(base.toLocaleLowerCase('id-ID'), count);
    used.add(candidate.toLocaleLowerCase('id-ID'));
    return candidate;
  });
}

export function matrixToTable(matrix, hasHeader = true, sourceMeta = {}) {
  const source = Array.isArray(matrix) ? matrix : [];
  const width = source.reduce((largest, row) => Math.max(largest, Array.isArray(row) ? row.length : 0), 0);
  if (!width) return { columns: [], rows: [] };
  const startRow = Number.isInteger(sourceMeta.startRow) ? sourceMeta.startRow : 0;
  const startColumn = Number.isInteger(sourceMeta.startColumn) ? sourceMeta.startColumn : 0;
  const columns = hasHeader
    ? makeUniqueHeaders(source[0] || [], width)
    : makeUniqueHeaders([], width);
  const body = hasHeader ? source.slice(1) : source;
  const rows = body.map((row) => Array.from({ length: width }, (_, index) => (Array.isArray(row) ? row[index] : '') ?? ''));
  const sourceHeight = source.length;
  return {
    columns,
    rows,
    sourceHasHeader: hasHeader,
    sourceHeaderValues: hasHeader ? Array.from({ length: width }, (_, index) => source[0]?.[index] ?? '') : undefined,
    headerEdited: hasHeader ? Array.from({ length: width }, () => false) : undefined,
    sourceRowIndexes: body.map((_, index) => startRow + index + (hasHeader ? 1 : 0)),
    sourceColumnIndexes: Array.from({ length: width }, (_, index) => startColumn + index),
    sourceRange: {
      startRow,
      startColumn,
      endRow: Number.isInteger(sourceMeta.endRow) ? sourceMeta.endRow : startRow + sourceHeight - 1,
      endColumn: Number.isInteger(sourceMeta.endColumn) ? sourceMeta.endColumn : startColumn + width - 1,
    },
  };
}

export function cleanTableWhitespace(table) {
  return {
    ...table,
    rows: table.rows.map((row) => row.map((value) => cleanWhitespace(value))),
  };
}

export function transformColumn(table, columnIndex, transform) {
  if (!Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= table.columns.length) return table;
  return {
    ...table,
    rows: table.rows.map((row) => row.map((value, index) => (index === columnIndex ? transform(value) : value))),
  };
}

export function replaceTableValues(table, { find, replace = '', columnIndex = null, mode = 'exact', caseSensitive = false } = {}) {
  const needle = String(find ?? '');
  if (!needle.trim() || !table?.columns?.length) return { table, changed: 0, examples: [] };
  if (columnIndex !== null && (!Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= table.columns.length)) {
    return { table, changed: 0, examples: [] };
  }
  let changed = 0;
  let rows = table.rows;
  let copiedRows = false;
  const examples = [];
  const exactSearch = cleanWhitespace(needle);
  const search = caseSensitive ? exactSearch : exactSearch.toLocaleLowerCase('id-ID');
  const escapedNeedle = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const substringPattern = mode === 'contains' ? new RegExp(escapedNeedle, caseSensitive ? 'g' : 'gi') : null;
  table.rows.forEach((row, rowIndex) => {
    let updatedRow = null;
    row.forEach((value, index) => {
      if (typeof value !== 'string' || (columnIndex !== null && index !== columnIndex)) return;
      let result = value;
      if (substringPattern) {
        substringPattern.lastIndex = 0;
        result = value.replace(substringPattern, () => String(replace ?? ''));
      } else {
        const candidate = cleanWhitespace(value);
        const comparable = caseSensitive ? candidate : candidate.toLocaleLowerCase('id-ID');
        if (comparable === search) result = String(replace ?? '');
      }
      if (result === value) return;
      changed += 1;
      if (examples.length < 3) examples.push({ before: value, after: result });
      if (!updatedRow) updatedRow = row.slice();
      updatedRow[index] = result;
    });
    if (!updatedRow) return;
    if (!copiedRows) {
      rows = table.rows.slice();
      copiedRows = true;
    }
    rows[rowIndex] = updatedRow;
  });
  return changed ? { table: { ...table, rows }, changed, examples } : { table, changed, examples };
}

export function removeBlankRows(rows) {
  const keptIndexes = [];
  const kept = [];
  rows.forEach((row, index) => {
    if (!row.every(isBlankCell)) {
      keptIndexes.push(index);
      kept.push(row);
    }
  });
  return { rows: kept, keptIndexes, removed: rows.length - kept.length };
}

export function normalizeMatchKey(value) {
  return cleanWhitespace(cellToText(value))
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('id-ID')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function comparisonValue(value, loose = false) {
  if (value instanceof Date) return `date:${value.toISOString()}`;
  if (typeof value === 'number') return `number:${Number.isNaN(value) ? '' : value}`;
  if (typeof value === 'boolean') return `boolean:${value}`;
  const text = loose
    ? normalizeMatchKey(value)
    : cleanWhitespace(cellToText(value)).toLocaleLowerCase('id-ID');
  return `text:${text}`;
}

export function removeDuplicateRows(rows, columnIndex = null) {
  const seen = new Set();
  const kept = [];
  const keptIndexes = [];
  const duplicateIndexes = [];
  for (const [index, row] of rows.entries()) {
    const isSingleColumn = Number.isInteger(columnIndex);
    if (isSingleColumn && isBlankCell(row[columnIndex])) {
      kept.push(row);
      keptIndexes.push(index);
      continue;
    }
    const values = isSingleColumn ? [row[columnIndex]] : row;
    const key = JSON.stringify(values.map((value) => comparisonValue(value, isSingleColumn)));
    if (seen.has(key)) {
      duplicateIndexes.push(index);
      continue;
    }
    seen.add(key);
    kept.push(row);
    keptIndexes.push(index);
  }
  return { rows: kept, keptIndexes, duplicateIndexes, removed: rows.length - kept.length };
}

export function splitTableColumn(table, columnIndex, delimiter, prefix = '') {
  if (!Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= table.columns.length) {
    return { table, changed: false, parts: 0 };
  }
  const separator = String(delimiter ?? '');
  if (!separator) return { table, changed: false, parts: 0 };

  const splitRows = table.rows.map((row) => {
    const original = row[columnIndex];
    const text = cellToText(original);
    if (isBlankCell(original) || !text.includes(separator)) return [original];
    return text.split(separator).map((part) => cleanWhitespace(part));
  });
  const parts = splitRows.reduce((largest, partsForRow) => Math.max(largest, partsForRow.length), 1);
  if (parts < 2) return { table, changed: false, parts };

  const base = cleanWhitespace(String(prefix || table.columns[columnIndex])) || `Kolom ${columnIndex + 1}`;
  const proposed = [
    ...table.columns.slice(0, columnIndex),
    ...Array.from({ length: parts }, (_, index) => `${base} ${index + 1}`),
    ...table.columns.slice(columnIndex + 1),
  ];
  const columns = makeUniqueHeaders(proposed, proposed.length);
  const rows = splitRows.map((row, rowIndex) => {
    const originalRow = table.rows[rowIndex] || [];
    const values = row.length === 1 && row[0] === originalRow[columnIndex]
      ? [row[0]]
      : row;
    const padded = Array.from({ length: parts }, (_, index) => values[index] ?? '');
    return [...originalRow.slice(0, columnIndex), ...padded, ...originalRow.slice(columnIndex + 1)];
  });
  const sourceColumnIndexes = table.sourceColumnIndexes || table.columns.map((_, index) => index);
  const nextSourceColumnIndexes = [
    ...sourceColumnIndexes.slice(0, columnIndex),
    ...Array.from({ length: parts }, () => sourceColumnIndexes[columnIndex]),
    ...sourceColumnIndexes.slice(columnIndex + 1),
  ];
  const sourceHeaderValues = table.sourceHeaderValues
    ? [...table.sourceHeaderValues.slice(0, columnIndex), ...Array.from({ length: parts }, () => ''), ...table.sourceHeaderValues.slice(columnIndex + 1)]
    : undefined;
  const headerEdited = table.headerEdited
    ? [...table.headerEdited.slice(0, columnIndex), ...Array.from({ length: parts }, () => true), ...table.headerEdited.slice(columnIndex + 1)]
    : undefined;
  return { table: { ...table, columns, rows, sourceColumnIndexes: nextSourceColumnIndexes, sourceHeaderValues, headerEdited }, changed: true, parts };
}

export function renameTableColumn(table, columnIndex, name) {
  if (!Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= table.columns.length) return table;
  const requested = cleanWhitespace(String(name ?? ''));
  if (!requested) return table;
  const wasEdited = table.headerEdited?.[columnIndex] ?? !table.sourceHeaderValues;
  if (requested === table.columns[columnIndex] && wasEdited) return table;
  const proposed = [...table.columns];
  proposed[columnIndex] = requested;
  const headerEdited = table.headerEdited ? [...table.headerEdited] : Array.from({ length: table.columns.length }, () => true);
  headerEdited[columnIndex] = true;
  return { ...table, columns: makeUniqueHeaders(proposed, proposed.length), headerEdited };
}

/** Parse numeric values from numbers or common Indonesian/English formatted text. */
export function parseNumericValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date || value === null || value === undefined || typeof value === 'boolean') return null;

  let text = cellToText(value).trim();
  if (!text) return null;
  const negativeByParentheses = /^\(.*\)$/.test(text);
  text = text.replace(/^\((.*)\)$/, '$1');
  text = text
    .replace(/(?:^|\s)(?:idr|rp\.?)\s*/gi, '')
    .replace(/\s*(?:kwh|kva|kw|mw|wh|menit|jam|persen|%)\s*$/i, '')
    .replace(/\s+/g, '');
  if (!/^[+-]?(?:\d[\d.,]*|[.,]\d+)$/.test(text)) return null;

  const sign = text.startsWith('-') || negativeByParentheses ? -1 : 1;
  text = text.replace(/^[+-]/, '');
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  let normalized;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const decimalAt = Math.max(lastComma, lastDot);
    const whole = text.slice(0, decimalAt).replace(/[.,]/g, '');
    const decimal = text.slice(decimalAt + 1).replace(/[.,]/g, '');
    normalized = decimal ? `${whole || '0'}.${decimal}` : whole;
  } else if (lastComma >= 0 || lastDot >= 0) {
    const separator = lastComma >= 0 ? ',' : '.';
    const positions = [...text].flatMap((char, index) => (char === separator ? [index] : []));
    const lastAt = positions[positions.length - 1];
    const tailLength = text.length - lastAt - 1;
    const head = text.slice(0, lastAt);
    const tail = text.slice(lastAt + 1);
    const headDigits = head.replace(/\D/g, '');
    const isGroupedThousands = tailLength === 3 && headDigits.length >= 1 && headDigits.length <= 3 && !/^0+$/.test(headDigits);
    if (positions.length > 1 && tailLength === 3) {
      normalized = text.replace(/[.,]/g, '');
    } else if (positions.length === 1 && isGroupedThousands) {
      normalized = `${head}${tail}`;
    } else {
      normalized = `${head.replace(/[.,]/g, '')}.${tail}`;
    }
  } else {
    normalized = text;
  }

  const number = Number(normalized);
  return Number.isFinite(number) ? sign * number : null;
}

export function numericColumnIndexes(table) {
  return table.columns.map((_, columnIndex) => columnIndex).filter((columnIndex) => (
    table.rows.some((row) => parseNumericValue(row[columnIndex]) !== null)
  ));
}

export function summarizeNumericColumn(rows, columnIndex) {
  const values = rows.map((row) => parseNumericValue(row[columnIndex])).filter((value) => value !== null);
  const sum = values.reduce((total, value) => total + value, 0);
  const min = values.length ? values.reduce((smallest, value) => Math.min(smallest, value), values[0]) : null;
  const max = values.length ? values.reduce((largest, value) => Math.max(largest, value), values[0]) : null;
  return {
    rowCount: rows.length,
    numericCount: values.length,
    sum,
    average: values.length ? sum / values.length : null,
    min,
    max,
  };
}

function groupKey(value) {
  if (value instanceof Date) return `date:${value.toISOString()}`;
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return 'empty:';
  return `${typeof value}:${String(cleanWhitespace(cellToText(value))).toLocaleLowerCase('id-ID')}`;
}

export function partitionTableByColumn(table, columnIndex) {
  if (!Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= table.columns.length) return [];
  const groups = new Map();
  for (const row of table.rows) {
    const value = row[columnIndex];
    const key = groupKey(value);
    if (!groups.has(key)) {
      const label = isBlankCell(value) ? '(Kosong)' : String(cleanWhitespace(cellToText(value)));
      groups.set(key, { name: label, rows: [] });
    }
    groups.get(key).rows.push(row);
  }
  return [...groups.values()].map((group) => ({
    name: group.name,
    table: { columns: table.columns, rows: group.rows },
  }));
}

export function summarizeBy(rows, groupColumnIndex, valueColumnIndex) {
  const groups = new Map();
  for (const row of rows) {
    const groupValue = Number.isInteger(groupColumnIndex) && groupColumnIndex >= 0
      ? row[groupColumnIndex]
      : 'Semua data';
    const key = Number.isInteger(groupColumnIndex) && groupColumnIndex >= 0 ? groupKey(groupValue) : 'all';
    if (!groups.has(key)) {
      groups.set(key, {
        group: isBlankCell(groupValue) ? '(Kosong)' : String(cleanWhitespace(cellToText(groupValue))),
        rowCount: 0,
        values: [],
      });
    }
    const item = groups.get(key);
    item.rowCount += 1;
    const numeric = parseNumericValue(row[valueColumnIndex]);
    if (numeric !== null) item.values.push(numeric);
  }

  return [...groups.values()].map((item) => {
    const sum = item.values.reduce((total, value) => total + value, 0);
    const min = item.values.length ? item.values.reduce((smallest, value) => Math.min(smallest, value), item.values[0]) : null;
    const max = item.values.length ? item.values.reduce((largest, value) => Math.max(largest, value), item.values[0]) : null;
    return {
      group: item.group,
      rowCount: item.rowCount,
      numericCount: item.values.length,
      sum,
      average: item.values.length ? sum / item.values.length : null,
      min,
      max,
    };
  });
}

export function tableToMatrix(table, { escapeFormulas = true } = {}) {
  const safeValue = (value) => {
    if (typeof value !== 'string' || !escapeFormulas) return value ?? '';
    return /^[\s\uFEFF]*[=+\-@]/u.test(value) ? `'${value}` : value;
  };
  const headers = table.columns.map((column, index) => (
    table.sourceHeaderValues && table.headerEdited?.[index] !== true
      ? table.sourceHeaderValues[index] ?? ''
      : column
  ));
  return [
    headers.map(safeValue),
    ...table.rows.map((row) => table.columns.map((_, index) => safeValue(row[index] ?? ''))),
  ];
}

export function toCsv(table) {
  const escape = (value) => {
    let text = cellToText(value);
    if (typeof value === 'string' && /^[\s\uFEFF]*[=+\-@]/u.test(value)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const lines = tableToMatrix(table, { escapeFormulas: false }).map((row) => row.map(escape).join(','));
  return `\ufeff${lines.join('\r\n')}`;
}
export function uniqueSheetName(existingNames, base = 'Ringkasan') {
  const taken = new Set(existingNames.map((name) => String(name).toLocaleLowerCase('id-ID')));
  let candidate = String(base).slice(0, 31);
  let suffix = 2;
  while (taken.has(candidate.toLocaleLowerCase('id-ID'))) {
    const tail = ` (${suffix})`;
    candidate = `${String(base).slice(0, 31 - tail.length)}${tail}`;
    suffix += 1;
  }
  return candidate;
}

function copyExcelStyle(style) {
  if (!style || typeof style !== 'object') return {};
  if (typeof structuredClone === 'function') return structuredClone(style);
  return JSON.parse(JSON.stringify(style));
}

function comparableExcelValue(value) {
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  if (Object.prototype.hasOwnProperty.call(value, 'error')) return String(value.error);
  if (Object.prototype.hasOwnProperty.call(value, 'formula') || Object.prototype.hasOwnProperty.call(value, 'sharedFormula')) {
    return comparableExcelValue(value.result);
  }
  if (Array.isArray(value.richText)) return value.richText.map((part) => part?.text || '').join('');
  if (typeof value.text === 'string') return value.text;
  return value;
}

function excelValuesEqual(left, right) {
  const a = comparableExcelValue(left);
  const b = comparableExcelValue(right);
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a === null || a === undefined) return b === null || b === undefined || b === '';
  if (b === null || b === undefined) return a === null || a === undefined || a === '';
  return Object.is(a, b);
}

function outputExcelValue(value, sourceValue) {
  const original = sourceValue && typeof sourceValue === 'object' ? sourceValue : null;
  const result = original && (Object.prototype.hasOwnProperty.call(original, 'formula') || Object.prototype.hasOwnProperty.call(original, 'sharedFormula'))
    ? original.result
    : original;
  const error = result && typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, 'error')
    ? result.error
    : null;
  if (error && String(value) === String(error)) return { error };
  return value ?? null;
}

function tableHasOriginalShape(table, range) {
  if (!range || table.sourceHasHeader !== true) return false;
  const width = range.endColumn - range.startColumn + 1;
  const bodyRows = range.endRow - range.startRow;
  if (table.columns.length !== width || table.rows.length !== bodyRows) return false;
  if (table.sourceColumnIndexes?.length !== width || table.sourceRowIndexes?.length !== bodyRows) return false;
  return table.sourceColumnIndexes.every((column, index) => column === range.startColumn + index)
    && table.sourceRowIndexes.every((row, index) => row === range.startRow + index + 1);
}

async function loadExcelJsWorkbook(ExcelJS, XLSX, sourceBytes, originalWorkbook) {
  if (sourceBytes) {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(sourceBytes);
      if (workbook.worksheets.length) return workbook;
    } catch {
      // Legacy XLS and CSV files are parsed by SheetJS and rebuilt below.
    }
  }
  if (originalWorkbook?.SheetNames?.length) {
    const workbook = new ExcelJS.Workbook();
    const bytes = XLSX.write(originalWorkbook, { bookType: 'xlsx', type: 'array', compression: true });
    await workbook.xlsx.load(bytes);
    return workbook;
  }
  return new ExcelJS.Workbook();
}

function applyProcessedTable(workbook, XLSX, sheetName, table) {
  const worksheet = workbook.getWorksheet(sheetName) || workbook.addWorksheet(sheetName || 'Data');
  const source = table.sourceRange;
  if (!source || !Number.isInteger(source.startRow) || !Number.isInteger(source.startColumn)) {
    worksheet.eachRow({ includeEmpty: true }, (row) => row.eachCell({ includeEmpty: true }, (cell) => { cell.value = null; }));
    worksheet.addRows(tableToMatrix(table));
    return worksheet;
  }

  const startRow = source.startRow;
  const startColumn = source.startColumn;
  const endRow = Number.isInteger(source.endRow) ? source.endRow : startRow + table.rows.length;
  const endColumn = Number.isInteger(source.endColumn) ? source.endColumn : startColumn + table.columns.length - 1;
  const structureUnchanged = tableHasOriginalShape(table, source);
  const headerSourceRow = table.sourceHasHeader
    ? startRow
    : (table.sourceRowIndexes?.[0] ?? startRow);
  const sourceColumns = table.sourceColumnIndexes || table.columns.map((_, index) => startColumn + index);
  const headerValues = table.columns.map((header, index) => (
    table.sourceHeaderValues && table.headerEdited?.[index] !== true
      ? table.sourceHeaderValues[index] ?? ''
      : header
  ));
  const headerTemplates = table.columns.map((_, index) => worksheet.getCell(headerSourceRow + 1, (sourceColumns[index] ?? startColumn + index) + 1));
  const rowTemplates = table.rows.map((_, rowIndex) => {
    const sourceRow = table.sourceRowIndexes?.[rowIndex] ?? startRow + rowIndex + (table.sourceHasHeader ? 1 : 0);
    return table.columns.map((__, columnIndex) => worksheet.getCell(sourceRow + 1, (sourceColumns[columnIndex] ?? startColumn + columnIndex) + 1));
  });
  const headerStyles = headerTemplates.map((cell) => copyExcelStyle(cell.style));
  const rowStyles = rowTemplates.map((row) => row.map((cell) => copyExcelStyle(cell.style)));
  const headerRowModel = worksheet.getRow(headerSourceRow + 1).model;
  const rowModels = table.rows.map((_, rowIndex) => {
    const sourceRow = table.sourceRowIndexes?.[rowIndex] ?? startRow + rowIndex + (table.sourceHasHeader ? 1 : 0);
    return worksheet.getRow(sourceRow + 1).model;
  });
  const sourceColumnModels = sourceColumns.map((column) => {
    const sourceModel = worksheet.getColumn(column + 1);
    return { width: sourceModel.width, hidden: sourceModel.hidden, outlineLevel: sourceModel.outlineLevel, style: copyExcelStyle(sourceModel.style) };
  });
  for (const excelTable of worksheet.getTables()) {
    const tableModel = excelTable.model;
    const ref = tableModel.ref || tableModel.tableRef;
    if (!ref) continue;
    const range = XLSX.utils.decode_range(ref);
    const overlaps = range.s.r <= endRow && range.e.r >= startRow && range.s.c <= endColumn && range.e.c >= startColumn;
    if (!overlaps) continue;
    if (!structureUnchanged) {
      const coversActiveRange = range.s.r === startRow && range.s.c === startColumn
        && range.e.r === endRow && range.e.c === endColumn;
      if (coversActiveRange) {
        const originalColumns = tableModel.columns || [];
        tableModel.columns = table.columns.map((name, columnIndex) => {
          const originalIndex = (sourceColumns[columnIndex] ?? startColumn + columnIndex) - range.s.c;
          const definition = originalColumns[originalIndex] || {};
          const next = { ...definition, name };
          if (tableModel.totalsRow) {
            delete next.totalsRowFunction;
            delete next.totalsRowFormula;
            delete next.totalsRowResult;
            delete next.totalsRowLabel;
          }
          return next;
        });
        tableModel.headerRow = true;
        tableModel.totalsRow = false;
        const updatedRef = XLSX.utils.encode_range({
          s: { r: startRow, c: startColumn },
          e: { r: startRow + table.rows.length, c: startColumn + table.columns.length - 1 },
        });
        const anchor = XLSX.utils.encode_cell({ r: startRow, c: startColumn });
        tableModel.ref = updatedRef;
        tableModel.tableRef = updatedRef;
        tableModel.autoFilterRef = updatedRef;
        tableModel.tl = { address: anchor, row: startRow + 1, col: startColumn + 1, '$col$row': `$${XLSX.utils.encode_col(startColumn)}$${startRow + 1}` };
      } else {
        // Keep all cells and styles, but avoid a stale table reference when the edited range is only part of the table.
        worksheet.removeTable(excelTable.name);
        continue;
      }
    } else if (tableModel.headerRow && table.sourceHasHeader && range.s.r === startRow) {
      table.columns.forEach((name, columnIndex) => {
        if (table.headerEdited?.[columnIndex] !== true) return;
        const tableColumn = startColumn + columnIndex - range.s.c;
        if (tableColumn >= 0 && tableColumn < tableModel.columns.length) tableModel.columns[tableColumn].name = name;
      });
    }
  }

  if (!structureUnchanged) {
    for (const merge of Object.keys(worksheet._merges || {})) {
      const range = XLSX.utils.decode_range(merge);
      const overlaps = range.s.r <= endRow && range.e.r >= startRow && range.s.c <= endColumn && range.e.c >= startColumn;
      if (overlaps) worksheet.unMergeCells(merge);
    }
    for (let row = startRow; row <= endRow; row += 1) {
      for (let column = startColumn; column <= endColumn; column += 1) {
        worksheet.getCell(row + 1, column + 1).value = null;
      }
    }
  }

  table.columns.forEach((_, columnIndex) => {
    const target = worksheet.getCell(startRow + 1, startColumn + columnIndex + 1);
    const sourceValue = headerTemplates[columnIndex]?.value;
    if (!structureUnchanged) target.style = headerStyles[columnIndex];
    if (!excelValuesEqual(headerValues[columnIndex], sourceValue) || !structureUnchanged) {
      target.value = outputExcelValue(headerValues[columnIndex], sourceValue);
    }
  });

  table.rows.forEach((row, rowIndex) => {
    table.columns.forEach((_, columnIndex) => {
      const target = worksheet.getCell(startRow + rowIndex + 2, startColumn + columnIndex + 1);
      const sourceCell = rowTemplates[rowIndex]?.[columnIndex];
      const sourceValue = sourceCell?.value;
      if (!structureUnchanged) target.style = rowStyles[rowIndex][columnIndex];
      if (!excelValuesEqual(row[columnIndex] ?? '', sourceValue) || !structureUnchanged) {
        target.value = outputExcelValue(row[columnIndex] ?? '', sourceValue);
      }
    });
    if (!structureUnchanged && rowModels[rowIndex]) {
      const targetRow = worksheet.getRow(startRow + rowIndex + 2);
      targetRow.height = rowModels[rowIndex].height;
      targetRow.hidden = rowModels[rowIndex].hidden;
      targetRow.outlineLevel = rowModels[rowIndex].outlineLevel || 0;
      targetRow.style = copyExcelStyle(rowModels[rowIndex].style);
    }
  });

  if (!structureUnchanged && headerRowModel) {
    const targetRow = worksheet.getRow(startRow + 1);
    targetRow.height = headerRowModel.height;
    targetRow.hidden = headerRowModel.hidden;
    targetRow.outlineLevel = headerRowModel.outlineLevel || 0;
    targetRow.style = copyExcelStyle(headerRowModel.style);
  }
  if (!structureUnchanged) {
    sourceColumnModels.forEach((model, index) => {
      const targetColumn = worksheet.getColumn(startColumn + index + 1);
      targetColumn.width = model.width;
      targetColumn.hidden = model.hidden;
      targetColumn.outlineLevel = model.outlineLevel || 0;
      targetColumn.style = copyExcelStyle(model.style);
    });
    if (worksheet.autoFilter && table.columns.length) {
      worksheet.autoFilter = {
        from: { row: startRow + 1, column: startColumn + 1 },
        to: { row: startRow + table.rows.length + 1, column: startColumn + table.columns.length },
      };
    }
  }
  return worksheet;
}

/** Rebuild the active worksheet while preserving ExcelJS-supported formatting and other sheets. */
export async function createProcessedWorkbookBlob({ originalWorkbook, sourceBytes = null, sheetName, table, summaryRows = [], splitTables = [] }) {
  const XLSXModule = await import('@e965/xlsx');
  const XLSX = XLSXModule.default || XLSXModule;
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;
  const output = await loadExcelJsWorkbook(ExcelJS, XLSX, sourceBytes, originalWorkbook);
  output.calcProperties = { ...(output.calcProperties || {}), ...(originalWorkbook?.CalcPr || {}), calcMode: 'auto', fullCalcOnLoad: true, forceFullCalc: true };

  if (!output.worksheets.length && table) output.addWorksheet(sheetName || 'Data');
  if (table) applyProcessedTable(output, XLSX, sheetName, table);

  for (const group of splitTables) {
    const baseName = String(group?.name || 'Kelompok kosong').replace(/[\\/:*?\[\]]/g, ' ').replace(/^'+|'+$/g, '').trim() || 'Kelompok';
    const groupName = uniqueSheetName(output.worksheets.map((worksheet) => worksheet.name), baseName);
    const worksheet = output.addWorksheet(groupName);
    worksheet.addRows(tableToMatrix(group.table));
  }
  if (summaryRows.length) {
    const summaryName = uniqueSheetName(output.worksheets.map((worksheet) => worksheet.name), 'Ringkasan');
    const worksheet = output.addWorksheet(summaryName);
    worksheet.addRows(summaryRows);
  }

  const bytes = await output.xlsx.writeBuffer({ useStyles: true, useSharedStrings: true });
  return new Blob([bytes], { type: XLSX_MIME });
}
