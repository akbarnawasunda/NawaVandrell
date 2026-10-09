/**
 * lib/format.mjs — format angka, rupiah, dan tanggal untuk fitur Nawa Vandrell.
 * Murni fungsi (tanpa DOM) supaya bisa diuji dengan node --test.
 */

const RUPIAH = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const DECIMAL = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

/** Rp 1.234.567 (pembulatan ke rupiah terdekat). */
export function formatRupiah(value) {
  const n = Math.round(Number(value) || 0);
  const sign = n < 0 ? '-' : '';
  return `${sign}Rp ${RUPIAH.format(Math.abs(n))}`;
}

/** Angka biasa dengan pemisah ribuan Indonesia, maksimal dua desimal. */
export function formatNumber(value) {
  const n = Number(value) || 0;
  return DECIMAL.format(n);
}

/** Persen dengan dua desimal maksimum, mis. "12,5%". */
export function formatPercent(value, digits = 2) {
  const n = Number(value) || 0;
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(n)}%`;
}

/**
 * Mengubah input bebas menjadi angka. Aturan:
 *  - "1.500" / "12.500.000" / "1.500,75" → pemisah ribuan Indonesia (titik ribuan, koma desimal)
 *  - "0.5" / "1,5" / "12.5" → desimal
 * Hasil selalu dijepit ke [min, max]; input tidak valid menjadi min.
 */
export function toAmount(value, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (typeof value === 'number') return Number.isFinite(value) ? clampNumber(value, min, max) : min;
  let text = String(value ?? '').trim().replace(/\s/g, '');
  if (/^-?[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(text)) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else {
    text = text.replace(',', '.');
  }
  const n = Number(text);
  return Number.isFinite(n) ? clampNumber(n, min, max) : min;
}

export function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Tanggal lokal hari ini dalam format YYYY-MM-DD. */
export function todayIso(now = new Date()) {
  return isoDate(now);
}

export function isoDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isValidIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Menambah hari pada tanggal ISO (zona waktu lokal, tanpa geser jam). */
export function addDaysIso(iso, days) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const date = new Date(y, m - 1, d + Math.trunc(Number(days) || 0));
  return isoDate(date);
}

/** Selisih hari dari a ke b (b - a). Positif bila b di masa depan. */
export function daysBetweenIso(a, b) {
  const [ay, am, ad] = String(a).split('-').map(Number);
  const [by, bm, bd] = String(b).split('-').map(Number);
  const msA = Date.UTC(ay, am - 1, ad);
  const msB = Date.UTC(by, bm - 1, bd);
  return Math.round((msB - msA) / 86_400_000);
}

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** 9 Oktober 2026 */
export function formatDateId(iso) {
  if (!isValidIsoDate(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_ID[m - 1]} ${y}`;
}

/** Nama bulan Indonesia dari YYYY-MM, mis. "Oktober 2026". */
export function formatMonthId(yearMonth) {
  const match = String(yearMonth || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return '';
  const month = Number(match[2]);
  if (month < 1 || month > 12) return '';
  return `${MONTHS_ID[month - 1]} ${match[1]}`;
}

export const MONTH_NAMES_ID = MONTHS_ID;

/** Escape HTML minimal untuk string yang dimasukkan ke dokumen cetak buatan sendiri. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Mencegah formula spreadsheet (=, +, -, @) saat teks ditulis ke CSV/XLSX.
 * Sel teks yang diawali karakter tersebut diberi awalan apostrof.
 */
export function safeSpreadsheetText(value) {
  const text = String(value ?? '');
  return /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
}

/** Membuat satu baris CSV (RFC 4180) dengan proteksi formula. */
export function csvLine(cells) {
  return cells
    .map((cell) => {
      // Angka ditulis apa adanya agar tetap terbaca sebagai angka di spreadsheet.
      if (typeof cell === 'number' && Number.isFinite(cell)) return String(cell);
      const text = safeSpreadsheetText(cell);
      return `"${text.replace(/"/g, '""')}"`;
    })
    .join(',');
}
