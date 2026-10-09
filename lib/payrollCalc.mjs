/**
 * lib/payrollCalc.mjs — estimasi gaji bersih, PPh Pasal 21, BPJS, THR, dan lembur (Indonesia).
 *
 * PENTING: hasil adalah ESTIMASI untuk gaji tetap. Ini bukan slip gaji resmi dan bukan nasihat pajak.
 * Metode PPh 21 yang dipakai: perhitungan tahunan (PPh Pasal 17 UU HPP) dibagi 12. Pemotong pajak perusahaan
 * memakai Tarif Efektif Rata-rata (PMK 168/2023) dan selisihnya disesuaikan pada masa pajak Desember,
 * sehingga angka bulanan bisa berbeda dari perusahaan Anda.
 *
 * Semua aturan berada di PAYROLL_RULES beserta sumbernya agar mudah diperbarui dan diperiksa.
 */

import { toAmount } from './format.mjs';

export const PAYROLL_RULES = {
  diperiksaPada: '2026-10-09',
  ptkp: {
    dasarTahunan: 54_000_000, // TK/0
    tambahanPerStatusKawinAtauTanggungan: 4_500_000,
    maksTanggungan: 3,
  },
  pphLapisan: [
    { batas: 60_000_000, tarif: 0.05 },
    { batas: 250_000_000, tarif: 0.15 },
    { batas: 500_000_000, tarif: 0.25 },
    { batas: 5_000_000_000, tarif: 0.3 },
    { batas: Infinity, tarif: 0.35 },
  ],
  biayaJabatan: { persen: 0.05, maksBulan: 500_000, maksTahun: 6_000_000 },
  npwpTidakPunya: 1.2,
  bpjs: {
    jhtKaryawan: 0.02,
    jhtPerusahaan: 0.037,
    jpKaryawan: 0.01,
    jpPerusahaan: 0.02,
    jpBatasUpah: 11_086_300, // berlaku sejak 1 Maret 2026
    jkesKaryawan: 0.01,
    jkesPerusahaan: 0.04,
    jkesBatasUpah: 12_000_000,
    jkmPerusahaan: 0.003,
  },
  lembur: { pembagiJam: 173, maksJamPerHari: 4, maksJamPerMinggu: 18 },
  sumber: [
    { judul: 'UU HPP (UU 7/2021), Pasal 17: lapisan tarif PPh orang pribadi 5%, 15%, 25%, 30%, 35%', tautan: 'https://pajak.go.id/en/node/74861', dicek: '2026-10-09' },
    { judul: 'PMK 101/PMK.010/2016: nilai PTKP (TK/0 Rp54 juta; K/0 Rp58,5 juta; tambahan Rp4,5 juta per tanggungan)', tautan: 'https://jdih.kemenkeu.go.id', dicek: '2026-10-09' },
    { judul: 'PMK 168/2023: biaya jabatan 5% (maks Rp500 ribu/bulan; Rp6 juta/tahun) dan pengurang iuran JHT & JP yang dibayar pegawai (Pasal 10)', tautan: 'https://jdih.kemenkeu.go.id', dicek: '2026-10-09' },
    { judul: 'Pasal 21 ayat (5a) UU PPh: tarif 120% bagi penerima penghasilan tanpa NPWP', tautan: 'https://jdih.kemenkeu.go.id', dicek: '2026-10-09' },
    { judul: 'Perpres 64/2020 (Pasal 30): iuran JKN 5% (pemberi kerja 4%, pekerja 1%), batas upah Rp12 juta', tautan: 'https://www.bpk.go.id', dicek: '2026-10-09' },
    { judul: 'Surat BPJS Ketenagakerjaan No. B/1226/022026 (25 Februari 2026): batas upah Jaminan Pensiun Rp11.086.300 mulai Maret 2026', tautan: 'https://www.bpjsketenagakerjaan.go.id', dicek: '2026-10-09' },
    { judul: 'PP 35/2021 Pasal 31–32: upah lembur, 1/173 upah sebulan, pengali 1,5 dan 2 pada hari kerja', tautan: 'https://jdih.kemenkeu.go.id', dicek: '2026-10-09' },
    { judul: 'Permenaker 6/2016 Pasal 3 & 5: THR keagamaan 1 bulan upah (≥12 bulan masa kerja) atau proporsional; dibayar H-7', tautan: 'https://setkab.go.id/pekerja-dengan-masa-kerja-1-bulan-kini-berhak-dapat-thr/', dicek: '2026-10-09' },
  ],
};

/** Status PTKP yang didukung. K/I (istri penghasilan digabung) belum didukung. */
export const PTKP_STATUS = [
  { value: 'TK', label: 'Belum kawin (TK)' },
  { value: 'K', label: 'Kawin (K)' },
];

/** PTKP tahunan. TK/0 = 54 juta; setiap status kawin atau tanggungan +4,5 juta; tanggungan maks 3. */
export function ptkpFor(status, tanggungan = 0) {
  const { dasarTahunan, tambahanPerStatusKawinAtauTanggungan, maksTanggungan } = PAYROLL_RULES.ptkp;
  const n = Math.min(maksTanggungan, Math.max(0, Math.floor(toAmount(tanggungan, { max: 10 }))));
  const kawin = status === 'K' ? 1 : 0;
  return dasarTahunan + (kawin + n) * tambahanPerStatusKawinAtauTanggungan;
}

/** Label kode PTKP, mis. "K/2". */
export function ptkpCode(status, tanggungan = 0) {
  const n = Math.min(PAYROLL_RULES.ptkp.maksTanggungan, Math.max(0, Math.floor(toAmount(tanggungan, { max: 10 }))));
  return `${status === 'K' ? 'K' : 'TK'}/${n}`;
}

/** PPh Pasal 17 atas PKP tahunan (progresif per lapisan). */
export function pphTahunan(pkp) {
  const amount = Math.max(0, Number(pkp) || 0);
  let tax = 0;
  let lower = 0;
  for (const { batas, tarif } of PAYROLL_RULES.pphLapisan) {
    const width = batas - lower;
    const slice = Math.min(Math.max(0, amount - lower), width);
    if (slice > 0) tax += slice * tarif;
    lower = batas;
    if (amount <= batas) break;
  }
  return tax;
}

/** Iuran BPJS Ketenagakerjaan dan Kesehatan yang dipotong dari gaji (bagian pekerja). */
export function bpjsEmployeeShare(upah, { jht = true, jp = true, jkes = true } = {}) {
  const b = PAYROLL_RULES.bpjs;
  const base = Math.max(0, Number(upah) || 0);
  return {
    jht: jht ? Math.round(base * b.jhtKaryawan) : 0,
    jp: jp ? Math.round(Math.min(base, b.jpBatasUpah) * b.jpKaryawan) : 0,
    jkes: jkes ? Math.round(Math.min(base, b.jkesBatasUpah) * b.jkesKaryawan) : 0,
  };
}

/** Iuran yang ditanggung perusahaan. JKK tidak dihitung karena tarifnya bergantung kelas risiko usaha. */
export function bpjsEmployerShare(upah, { jht = true, jp = true, jkes = true } = {}) {
  const b = PAYROLL_RULES.bpjs;
  const base = Math.max(0, Number(upah) || 0);
  return {
    jht: jht ? Math.round(base * b.jhtPerusahaan) : 0,
    jp: jp ? Math.round(Math.min(base, b.jpBatasUpah) * b.jpPerusahaan) : 0,
    jkes: jkes ? Math.round(Math.min(base, b.jkesBatasUpah) * b.jkesPerusahaan) : 0,
    jkm: Math.round(base * b.jkmPerusahaan),
  };
}

/** Estimasi PPh 21 tahunan (metode tahunan) untuk gaji tetap. */
export function annualTax({ brutoSetahun, iuranPengurangSetahun = 0, status = 'TK', tanggungan = 0, punyaNpwp = true }) {
  const bruto = Math.max(0, brutoSetahun);
  const biayaJabatan = Math.min(bruto * PAYROLL_RULES.biayaJabatan.persen, PAYROLL_RULES.biayaJabatan.maksTahun);
  const ptkp = ptkpFor(status, tanggungan);
  const rawPkp = bruto - biayaJabatan - Math.max(0, iuranPengurangSetahun) - ptkp;
  const pkp = rawPkp > 0 ? Math.floor(rawPkp / 1000) * 1000 : 0;
  const pajak = pphTahunan(pkp) * (punyaNpwp ? 1 : PAYROLL_RULES.npwpTidakPunya);
  return { bruto, biayaJabatan, iuranPengurang: Math.max(0, iuranPengurangSetahun), ptkp, pkp, pajak };
}

/**
 * Hitung gaji bulanan lengkap.
 * @param {object} input
 * @param {number} input.gajiPokok
 * @param {number} input.tunjanganTetap
 * @param {number} input.tunjanganTidakTetap   bonus rutin bulanan, tidak masuk dasar BPJS
 * @param {number} input.lemburPerBulan        nilai lembur rata-rata per bulan (dari kalkulator lembur)
 * @param {'TK'|'K'} input.status
 * @param {number} input.tanggungan
 * @param {boolean} input.punyaNpwp
 * @param {{jht:boolean,jp:boolean,jkes:boolean}} input.bpjs
 */
export function calcMonthlyPayroll(input = {}) {
  const gajiPokok = toAmount(input.gajiPokok, { max: 1e12 });
  const tunjanganTetap = toAmount(input.tunjanganTetap, { max: 1e12 });
  const tunjanganTidakTetap = toAmount(input.tunjanganTidakTetap, { max: 1e12 });
  const lembur = toAmount(input.lemburPerBulan, { max: 1e12 });
  const status = input.status === 'K' ? 'K' : 'TK';
  const tanggungan = toAmount(input.tanggungan, { max: PAYROLL_RULES.ptkp.maksTanggungan });
  const punyaNpwp = input.punyaNpwp !== false;
  const aktif = { jht: input.bpjs?.jht !== false, jp: input.bpjs?.jp !== false, jkes: input.bpjs?.jkes !== false };

  const upah = gajiPokok + tunjanganTetap; // dasar BPJS: gaji pokok + tunjangan tetap
  const bruto = upah + tunjanganTidakTetap + lembur;
  const iuranKaryawan = bpjsEmployeeShare(upah, aktif);
  const iuranPerusahaan = bpjsEmployerShare(upah, aktif);
  const iuranPengurangBulanan = iuranKaryawan.jht + iuranKaryawan.jp; // JHT & JP pegawai menjadi pengurang PPh 21

  const tahunan = annualTax({
    brutoSetahun: bruto * 12,
    iuranPengurangSetahun: iuranPengurangBulanan * 12,
    status,
    tanggungan,
    punyaNpwp,
  });
  const pphBulan = Math.round(tahunan.pajak / 12);
  const totalPotongan = iuranKaryawan.jht + iuranKaryawan.jp + iuranKaryawan.jkes + pphBulan;
  return {
    upah,
    bruto,
    iuranKaryawan,
    iuranPerusahaan,
    iuranPengurangBulanan,
    pphBulan,
    pphSetahun: Math.round(tahunan.pajak),
    tahunan,
    ptkp: tahunan.ptkp,
    totalPotongan,
    takeHome: bruto - totalPotongan,
    punyaNpwp,
    status,
    tanggungan,
    ptkpKode: ptkpCode(status, tanggungan),
  };
}

/** Tambahan PPh 21 setahun akibat THR, dihitung sebagai selisih metode tahunan dengan dan tanpa THR. */
export function thrTaxImpact({ monthly, thr, punyaNpwp = true }) {
  const bpjsIuran = monthly.iuranPengurangBulanan;
  const base = annualTax({
    brutoSetahun: monthly.bruto * 12,
    iuranPengurangSetahun: bpjsIuran * 12,
    status: monthly.status,
    tanggungan: monthly.tanggungan,
    punyaNpwp,
  });
  const withThr = annualTax({
    brutoSetahun: monthly.bruto * 12 + Math.max(0, thr),
    iuranPengurangSetahun: bpjsIuran * 12,
    status: monthly.status,
    tanggungan: monthly.tanggungan,
    punyaNpwp,
  });
  return Math.max(0, Math.round(withThr.pajak - base.pajak));
}

/** THR keagamaan menurut Permenaker 6/2016. */
export function calcThr({ masaKerjaBulan = 12, upahSebulan = 0 } = {}) {
  const masa = Math.floor(toAmount(masaKerjaBulan, { max: 1200 }));
  const upah = toAmount(upahSebulan, { max: 1e12 });
  if (masa < 1) {
    return { thr: 0, pengali: 0, rumus: 'Masa kerja kurang dari 1 bulan belum berhak atas THR keagamaan.' };
  }
  if (masa >= 12) {
    return { thr: Math.round(upah), pengali: 1, rumus: '1 bulan upah (masa kerja 12 bulan atau lebih).' };
  }
  return {
    thr: Math.round((upah * masa) / 12),
    pengali: masa / 12,
    rumus: `Proporsional: ${masa} ÷ 12 × 1 bulan upah.`,
  };
}

/**
 * Pengali lembur per jam menurut PP 35/2021 Pasal 31.
 * Kunci jenis hari:
 *  - biasa                 : jam 1 = 1,5×; jam berikutnya 2×
 *  - istirahat-5           : pekan 5 hari, hari istirahat/libur resmi: jam 1–8 = 2×; 9 = 3×; 10–12 = 4×
 *  - istirahat-6           : pekan 6 hari: jam 1–7 = 2×; 8 = 3×; 9–11 = 4×
 *  - libur-terpendek-6     : libur resmi di hari kerja terpendek pekan 6 hari: jam 1–5 = 2×; 6 = 3×; 7–9 = 4×
 */
export const OVERTIME_DAY_TYPES = [
  { value: 'biasa', label: 'Hari kerja biasa' },
  { value: 'istirahat-5', label: 'Hari istirahat atau libur, pekan 5 hari kerja' },
  { value: 'istirahat-6', label: 'Hari istirahat, pekan 6 hari kerja' },
  { value: 'libur-terpendek-6', label: 'Libur resmi di hari kerja terpendek (pekan 6 hari)' },
];

const OVERTIME_SCHEDULE = {
  biasa: (hour) => (hour === 1 ? 1.5 : 2),
  'istirahat-5': (hour) => (hour <= 8 ? 2 : hour === 9 ? 3 : hour <= 12 ? 4 : null),
  'istirahat-6': (hour) => (hour <= 7 ? 2 : hour === 8 ? 3 : hour <= 11 ? 4 : null),
  'libur-terpendek-6': (hour) => (hour <= 5 ? 2 : hour === 6 ? 3 : hour <= 9 ? 4 : null),
};

/** Upah lembur. upahSebulan = gaji pokok + tunjangan tetap (dasar sesuai PP 35/2021 Pasal 32). */
export function calcOvertime({ upahSebulan = 0, jenisHari = 'biasa', jam = 0 } = {}) {
  const upah = toAmount(upahSebulan, { max: 1e12 });
  const schedule = OVERTIME_SCHEDULE[jenisHari] || OVERTIME_SCHEDULE.biasa;
  const hours = Math.floor(toAmount(jam, { max: 24 }));
  const upahSejam = upah / PAYROLL_RULES.lembur.pembagiJam;
  const detail = [];
  let total = 0;
  let beyondSchedule = 0;
  for (let hour = 1; hour <= hours; hour += 1) {
    const multiplier = schedule(hour);
    if (multiplier === null) {
      beyondSchedule += 1;
      continue;
    }
    total += upahSejam * multiplier;
    detail.push({ jam: hour, pengali: multiplier });
  }
  const warnings = [];
  if (jenisHari === 'biasa' && hours > PAYROLL_RULES.lembur.maksJamPerHari) {
    warnings.push(`Lembur ${hours} jam melewati batas umum ${PAYROLL_RULES.lembur.maksJamPerHari} jam per hari (PP 35/2021). Periksa ketentuan perusahaan.`);
  }
  if (beyondSchedule > 0) {
    warnings.push(`${beyondSchedule} jam di luar tabel pengali tidak dihitung. Periksa aturan perusahaan.`);
  }
  return {
    upahSejam: Math.round(upahSejam),
    upahSejamPresisi: upahSejam,
    total: Math.round(total),
    detail,
    warnings,
    jamDihitung: detail.length,
  };
}
