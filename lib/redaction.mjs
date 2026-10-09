/**
 * lib/redaction.mjs — deteksi dan sensor data pribadi di dalam teks (berjalan lokal, tanpa AI).
 *
 * Batasan: deteksi memakai pola. Pola bisa melewatkan data yang ditulis tidak standar atau salah mengenali
 * deret angka lain. Selalu periksa hasil sensor sebelum membagikan dokumen.
 */

export const REDACTION_TYPES = [
  { id: 'nik', label: 'NIK (16 digit)', default: true },
  { id: 'npwp', label: 'NPWP', default: true },
  { id: 'telepon', label: 'Nomor telepon', default: true },
  { id: 'email', label: 'Alamat email', default: true },
  { id: 'rekening', label: 'Nomor rekening (10–16 digit)', default: false },
];

// Urutan prioritas: jika dua pola bertabrakan, yang lebih awal dipakai.
const PATTERNS = [
  { type: 'nik', re: /(?<![\d.-])\d{16}(?![\d])/g },
  { type: 'npwp', re: /(?<![\d])\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}(?![\d])/g },
  { type: 'npwp', re: /(?<![\d])\d{15}(?![\d])/g },
  { type: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g },
  { type: 'telepon', re: /(?<![\d])(?:\+62|62|0)[ -]?8\d{1,3}(?:[ -]?\d{2,4}){2,3}(?![\d])/g },
  { type: 'rekening', re: /(?<![\d])\d{10,16}(?![\d])/g },
];

const LABELS = Object.fromEntries(REDACTION_TYPES.map((t) => [t.id, t.label.split(' (')[0]]));

/** Mengembalikan daftar temuan tanpa tumpang-tindih, diurutkan menurut posisi. */
export function detectSensitive(text, types = REDACTION_TYPES.filter((t) => t.default).map((t) => t.id)) {
  const wanted = new Set(types);
  const taken = [];
  const found = [];
  for (const { type, re } of PATTERNS) {
    if (!wanted.has(type)) continue;
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(String(text ?? ''))) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (taken.some(([s, e]) => start < e && end > s)) continue;
      taken.push([start, end]);
      found.push({ type, start, end, value: match[0] });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

/**
 * Menyensor temuan.
 * style: 'label' → [NIK disensor]; 'bintang' → ********; 'akhir4' → ********1234 (4 karakter terakhir tetap)
 */
export function redactText(text, { types, style = 'label' } = {}) {
  const source = String(text ?? '');
  const matches = detectSensitive(source, types);
  let output = '';
  let cursor = 0;
  for (const m of matches) {
    output += source.slice(cursor, m.start);
    output += maskFor(m, style);
    cursor = m.end;
  }
  output += source.slice(cursor);
  return { output, count: matches.length, matches, byType: countByType(matches) };
}

function maskFor(match, style) {
  if (style === 'bintang') return '*'.repeat(match.value.length);
  if (style === 'akhir4') {
    const digits = match.value.replace(/\D/g, '');
    const keep = digits.slice(-4);
    return `${'*'.repeat(Math.max(0, match.value.length - keep.length))}${keep}`;
  }
  return `[${LABELS[match.type]} disensor]`;
}

function countByType(matches) {
  return matches.reduce((acc, m) => {
    acc[m.type] = (acc[m.type] || 0) + 1;
    return acc;
  }, {});
}

export function redactionLabel(type) {
  return LABELS[type] || type;
}
