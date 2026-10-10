/**
 * Utilitas pengolahan spreadsheet yang aman dipakai di browser dan Node.
 * File pengguna tidak perlu dikirim ke server.
 */

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const CSV_MIME = 'text/csv;charset=utf-8';
export const MAX_SPREADSHEET_BYTES = 25 * 1024 * 1024;

const NAME_ACRONYMS = new Set([
  'CV', 'ID', 'KTP', 'NIK', 'NPWP', 'PBB', 'PDAM', 'PLN', 'PT', 'RI',
  'SD', 'SMA', 'SMP', 'UIP', 'UID', 'UIW', 'UIT', 'UP2B', 'UP2D', 'UP3', 'UPK', 'ULP',
]);

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

export function normalizeName(value) {
  if (value === null || value === undefined || value === '') return value;
  if (typeof value !== 'string') return value;
  const text = cleanWhitespace(value);
  if (!text) return '';
  return text.toLocaleLowerCase('id-ID').replace(/[\p{L}\p{N}]+/gu, (part) => {
    const acronym = part.toLocaleUpperCase('id-ID');
    if (NAME_ACRONYMS.has(acronym)) return acronym;
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

export function matrixToTable(matrix, hasHeader = true) {
  const source = Array.isArray(matrix) ? matrix : [];
  const width = source.reduce((largest, row) => Math.max(largest, Array.isArray(row) ? row.length : 0), 0);
  if (!width) return { columns: [], rows: [] };
  const columns = hasHeader
    ? makeUniqueHeaders(source[0] || [], width)
    : makeUniqueHeaders([], width);
  const body = hasHeader ? source.slice(1) : source;
  const rows = body.map((row) => Array.from({ length: width }, (_, index) => (Array.isArray(row) ? row[index] : '') ?? ''));
  return { columns, rows };
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

export function removeBlankRows(rows) {
  const kept = rows.filter((row) => row.some((value) => !isBlankCell(value)));
  return { rows: kept, removed: rows.length - kept.length };
}

function comparisonValue(value) {
  if (value instanceof Date) return `date:${value.toISOString()}`;
  if (typeof value === 'number') return `number:${Number.isNaN(value) ? '' : value}`;
  if (typeof value === 'boolean') return `boolean:${value}`;
  return `text:${cleanWhitespace(cellToText(value)).toLocaleLowerCase('id-ID')}`;
}

export function removeDuplicateRows(rows, columnIndex = null) {
  const seen = new Set();
  const kept = [];
  for (const row of rows) {
    const values = Number.isInteger(columnIndex) ? [row[columnIndex]] : row;
    const key = JSON.stringify(values.map(comparisonValue));
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(row);
  }
  return { rows: kept, removed: rows.length - kept.length };
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
  return { table: { ...table, columns, rows }, changed: true, parts };
}

export function renameTableColumn(table, columnIndex, name) {
  if (!Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= table.columns.length) return table;
  const requested = cleanWhitespace(String(name ?? ''));
  if (!requested) return table;
  const proposed = [...table.columns];
  proposed[columnIndex] = requested;
  return { ...table, columns: makeUniqueHeaders(proposed, proposed.length) };
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
  return [
    table.columns.map(safeValue),
    ...table.rows.map((row) => table.columns.map((_, index) => safeValue(row[index] ?? ''))),
  ];
}

export function toCsv(table) {
  const escape = (value) => {
    let text = cellToText(value);
    if (typeof value === 'string' && /^[\s\uFEFF]*[=+\-@]/u.test(value)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const lines = [table.columns, ...table.rows].map((row) => table.columns.map((_, index) => escape(row[index] ?? '')).join(','));
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

/** Rebuild the active worksheet and append a summary worksheet to an XLSX file. */
export async function createProcessedWorkbookBlob({ originalWorkbook, sheetName, table, summaryRows = [], splitTables = [] }) {
  const XLSXModule = await import('@e965/xlsx');
  const XLSX = XLSXModule.default || XLSXModule;
  const output = XLSX.utils.book_new();
  const sourceNames = Array.isArray(originalWorkbook?.SheetNames) ? originalWorkbook.SheetNames : [];
  const names = sourceNames.length ? sourceNames : [sheetName || 'Data'];

  for (const name of names) {
    const sheet = name === sheetName
      ? XLSX.utils.aoa_to_sheet(tableToMatrix(table))
      : originalWorkbook?.Sheets?.[name];
    if (!sheet) continue;
    XLSX.utils.book_append_sheet(output, sheet, name);
  }
  if (!output.SheetNames.length && table) {
    XLSX.utils.book_append_sheet(output, XLSX.utils.aoa_to_sheet(tableToMatrix(table)), sheetName || 'Data');
  }
  for (const group of splitTables) {
    const baseName = String(group?.name || 'Kelompok kosong').replace(/[\\/:*?\[\]]/g, ' ').replace(/^'+|'+$/g, '').trim() || 'Kelompok';
    const groupName = uniqueSheetName(output.SheetNames, baseName);
    XLSX.utils.book_append_sheet(output, XLSX.utils.aoa_to_sheet(tableToMatrix(group.table)), groupName);
  }
  if (summaryRows.length) {
    const summaryName = uniqueSheetName(output.SheetNames, 'Ringkasan');
    XLSX.utils.book_append_sheet(output, XLSX.utils.aoa_to_sheet(summaryRows), summaryName);
  }

  const bytes = XLSX.write(output, { bookType: 'xlsx', type: 'array', compression: true });
  return new Blob([bytes], { type: XLSX_MIME });
}
