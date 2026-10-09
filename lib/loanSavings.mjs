/**
 * lib/loanSavings.mjs — kalkulator cicilan (anuitas dan flat) dan target tabungan.
 *
 * Rumus:
 *  - Anuitas  : angsuran = P × r ÷ (1 − (1 + r)^−n), dengan r = bunga tahunan ÷ 12
 *  - Flat     : bunga total = P × bunga tahunan × (n ÷ 12); angsuran = (P + bunga total) ÷ n
 *  - Tabungan : setoran bulanan = sisa target × r ÷ ((1 + r)^n − 1), setoran di akhir bulan
 * Hasil adalah estimasi. Bukan penawaran kredit dan bukan nasihat keuangan.
 */

import { toAmount } from './format.mjs';

const MAX_MONTHS = 360;

export const LOAN_METHODS = [
  { value: 'anuitas', label: 'Anuitas (bunga menurun sesuai sisa pokok)' },
  { value: 'flat', label: 'Flat (bunga dihitung dari pokok awal)' },
];

/** Hitung cicilan. Mengembalikan errors bila input tidak masuk akal. */
export function calcLoan({ principal = 0, annualRatePct = 0, months = 12, method = 'anuitas', schedule = true } = {}) {
  const pokok = toAmount(principal, { max: 1e13 });
  const rate = toAmount(annualRatePct, { max: 200 });
  // Jangka waktu tidak di-clamp sebelum divalidasi agar nilai di luar batas tetap tercatat sebagai kesalahan.
  const n = Math.floor(toAmount(months, { max: 1e6 }));
  const errors = [];
  if (!(pokok > 0)) errors.push('Jumlah pinjaman harus lebih dari nol.');
  if (!(n >= 1)) errors.push('Jangka waktu minimal 1 bulan.');
  if (n > MAX_MONTHS) errors.push(`Jangka waktu maksimal ${MAX_MONTHS} bulan.`);
  if (errors.length) return { errors, valid: false };

  const r = rate / 100 / 12;
  const rows = [];
  let monthly;
  let totalBunga;
  if (method === 'flat') {
    totalBunga = pokok * (rate / 100) * (n / 12);
    monthly = (pokok + totalBunga) / n;
    if (schedule) {
      let sisa = pokok;
      for (let bulan = 1; bulan <= n; bulan += 1) {
        const bunga = totalBunga / n;
        const pokokBayar = pokok / n;
        sisa = Math.max(0, sisa - pokokBayar);
        rows.push({ bulan, angsuran: monthly, bunga, pokok: pokokBayar, sisa });
      }
    }
  } else {
    monthly = r === 0 ? pokok / n : (pokok * r) / (1 - (1 + r) ** -n);
    totalBunga = monthly * n - pokok;
    if (schedule) {
      let sisa = pokok;
      for (let bulan = 1; bulan <= n; bulan += 1) {
        const bunga = sisa * r;
        const pokokBayar = monthly - bunga;
        sisa = Math.max(0, sisa - pokokBayar);
        rows.push({ bulan, angsuran: monthly, bunga, pokok: pokokBayar, sisa });
      }
    }
  }
  return {
    errors: [],
    valid: true,
    method,
    monthly,
    totalBayar: monthly * n,
    totalBunga,
    effectiveAnnualPct: method === 'flat' && pokok > 0 ? effectiveRateFlat(pokok, totalBunga, n) : rate,
    schedule: rows,
    months: n,
  };
}

/** Perkiraan bunga efektif tahunan untuk pinjaman flat (metode bisection pada anuitas yang setara). */
function effectiveRateFlat(pokok, totalBunga, n) {
  const target = (pokok + totalBunga) / n;
  let lo = 0;
  let hi = 0.2; // 20% per bulan sebagai batas atas aman
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    const pmt = (pokok * mid) / (1 - (1 + mid) ** -n);
    if (pmt > target) hi = mid;
    else lo = mid;
  }
  return ((lo + hi) / 2) * 12 * 100;
}

/**
 * Target tabungan: setoran bulanan yang dibutuhkan agar target tercapai.
 * @returns {{remaining:number, monthlyNeeded:number, totalSetor:number, bungaEstimasi:number, errors:string[]}}
 */
export function calcSavingsGoal({ target = 0, saved = 0, months = 12, annualRatePct = 0 } = {}) {
  const goal = toAmount(target, { max: 1e13 });
  const now = toAmount(saved, { max: 1e13 });
  const n = Math.floor(toAmount(months, { max: 1e6 }));
  const rate = toAmount(annualRatePct, { max: 100 });
  const errors = [];
  if (!(goal > 0)) errors.push('Target tabungan harus lebih dari nol.');
  if (!(n >= 1)) errors.push('Jangka waktu minimal 1 bulan.');
  if (n > MAX_MONTHS) errors.push(`Jangka waktu maksimal ${MAX_MONTHS} bulan.`);
  if (errors.length) return { errors, remaining: 0, monthlyNeeded: 0, totalSetor: 0, bungaEstimasi: 0 };
  const remaining = Math.max(0, goal - now);
  const r = rate / 100 / 12;
  const monthlyNeeded = remaining === 0 ? 0 : r === 0 ? remaining / n : (remaining * r) / ((1 + r) ** n - 1);
  const totalSetor = monthlyNeeded * n;
  return {
    errors: [],
    remaining,
    monthlyNeeded,
    totalSetor,
    bungaEstimasi: Math.max(0, remaining - totalSetor),
  };
}

/**
 * Berapa bulan dibutuhkan bila menabung sejumlah tertentu per bulan.
 * @returns {number|null} null bila tabungan bulanan nol
 */
export function monthsToGoal({ target = 0, saved = 0, monthlySaving = 0, annualRatePct = 0 } = {}) {
  const remaining = Math.max(0, toAmount(target, { max: 1e13 }) - toAmount(saved, { max: 1e13 }));
  const setor = toAmount(monthlySaving, { max: 1e13 });
  if (remaining === 0) return 0;
  if (!(setor > 0)) return null;
  const r = toAmount(annualRatePct, { max: 100 }) / 100 / 12;
  if (r === 0) return Math.ceil(remaining / setor);
  return Math.ceil(Math.log(1 + (remaining * r) / setor) / Math.log(1 + r));
}
