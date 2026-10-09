/**
 * lib/splitBill.mjs — pembagi tagihan dan patungan kegiatan kelompok.
 *
 * Aturan:
 *  - Setiap barang/jasa dibagi ke orang yang dipilih (atau semua orang). Pembagian memakai metode
 *    "sisa terbesar" sehingga jumlah bagian selalu sama persis dengan harga (tanpa selisih rupiah).
 *  - PPN dan biaya layanan dihitung dari total, lalu dibagi sebanding dengan subtotal masing-masing orang.
 *  - Penyelesaian: siapa membayar berapa, lalu daftar transfer paling sedikit (metode serakah).
 * Semua nilai dibulatkan ke rupiah utuh. Tidak ada data yang disimpan atau dikirim.
 */

import { toAmount } from './format.mjs';

/** Membagi total bulat ke beberapa bagian sebanding bobot. Jumlah hasil selalu sama dengan total. */
export function allocate(total, weights) {
  const amount = Math.round(toAmount(total, { max: 1e13 }));
  const count = weights.length;
  if (!count) return [];
  const safeWeights = weights.map((w) => toAmount(w, { max: 1e13 }));
  const sum = safeWeights.reduce((a, b) => a + b, 0);
  const effective = sum > 0 ? safeWeights : safeWeights.map(() => 1);
  const effectiveSum = effective.reduce((a, b) => a + b, 0);
  const raw = effective.map((w) => (amount * w) / effectiveSum);
  const floors = raw.map((value) => Math.floor(value));
  let rest = amount - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of order) {
    if (rest <= 0) break;
    floors[index] += 1;
    rest -= 1;
  }
  return floors;
}

/**
 * @param {object} input
 * @param {{id:string,nama:string}[]} input.people
 * @param {{id:string,nama:string,harga:number,qty?:number,pembagi:'semua'|string[]}[]} input.items
 * @param {number} [input.pajakPersen]
 * @param {number} [input.servicePersen]
 * @param {{personId:string,jumlah:number}[]} [input.dibayar]
 */
export function splitBill({ people = [], items = [], pajakPersen = 0, servicePersen = 0, dibayar = [] } = {}) {
  const errors = [];
  const cleanPeople = people
    .map((person, index) => ({ id: person?.id || `orang-${index}`, nama: String(person?.nama || '').trim().slice(0, 60) }))
    .filter((person) => person.nama);
  if (cleanPeople.length < 1) errors.push('Tambahkan minimal satu orang.');
  const ids = new Set(cleanPeople.map((person) => person.id));

  const perPerson = new Map(cleanPeople.map((person) => [person.id, { subtotal: 0 }]));
  const itemRows = [];
  let subtotal = 0;
  items.forEach((item, index) => {
    const label = String(item?.nama || '').trim() || `Barang ${index + 1}`;
    const qty = toAmount(item?.qty ?? 1, { max: 100_000 }) || 1;
    const harga = toAmount(item?.harga, { max: 1e12 });
    const lineTotal = Math.round(qty * harga);
    const assigned = item?.pembagi === 'semua' || !Array.isArray(item?.pembagi)
      ? cleanPeople.map((person) => person.id)
      : item.pembagi.filter((id) => ids.has(id));
    if (lineTotal > 0 && assigned.length === 0) errors.push(`“${label}” belum dibagi ke siapa pun.`);
    if (lineTotal <= 0) return;
    const parts = allocate(lineTotal, assigned.map(() => 1));
    assigned.forEach((id, i) => {
      perPerson.get(id).subtotal += parts[i];
    });
    subtotal += lineTotal;
    itemRows.push({ id: item?.id || `barang-${index}`, nama: label, qty, harga, total: lineTotal, dibagiKe: assigned.length });
  });

  const pajakTotal = Math.round(subtotal * (toAmount(pajakPersen, { max: 100 }) / 100));
  const serviceTotal = Math.round(subtotal * (toAmount(servicePersen, { max: 100 }) / 100));
  const weights = cleanPeople.map((person) => perPerson.get(person.id).subtotal);
  const pajakPerOrang = allocate(pajakTotal, weights);
  const servicePerOrang = allocate(serviceTotal, weights);

  const shares = cleanPeople.map((person, i) => {
    const sub = perPerson.get(person.id).subtotal;
    const total = sub + pajakPerOrang[i] + servicePerOrang[i];
    return { personId: person.id, nama: person.nama, subtotal: sub, pajak: pajakPerOrang[i], service: servicePerOrang[i], total };
  });
  const grandTotal = subtotal + pajakTotal + serviceTotal;

  const paidMap = new Map(cleanPeople.map((person) => [person.id, 0]));
  for (const payment of dibayar) {
    if (!paidMap.has(payment?.personId)) continue;
    paidMap.set(payment.personId, paidMap.get(payment.personId) + Math.round(toAmount(payment.jumlah, { max: 1e13 })));
  }
  const paid = shares.map((share) => ({ personId: share.personId, nama: share.nama, dibayar: paidMap.get(share.personId) || 0 }));
  const totalPaid = paid.reduce((sum, row) => sum + row.dibayar, 0);

  const balances = shares.map((share) => ({
    personId: share.personId,
    nama: share.nama,
    selisih: (paidMap.get(share.personId) || 0) - share.total, // positif: menerima kembali; negatif: harus membayar
  }));
  const transfers = settle(balances);

  return {
    errors,
    people: cleanPeople,
    items: itemRows,
    subtotal,
    pajakTotal,
    serviceTotal,
    grandTotal,
    shares,
    paid,
    totalPaid,
    selisihTotal: totalPaid - grandTotal,
    balances,
    transfers,
    seimbang: totalPaid === grandTotal,
  };
}

/** Transfer minimum: pasangkan yang harus membayar dengan yang harus menerima. */
export function settle(balances) {
  const debtors = balances.filter((b) => b.selisih < 0).map((b) => ({ nama: b.nama, amount: -b.selisih }));
  const creditors = balances.filter((b) => b.selisih > 0).map((b) => ({ nama: b.nama, amount: b.selisih }));
  const transfers = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    if (pay > 0) transfers.push({ dari: debtors[i].nama, ke: creditors[j].nama, jumlah: pay });
    debtors[i].amount -= pay;
    creditors[j].amount -= pay;
    if (debtors[i].amount <= 0) i += 1;
    if (creditors[j].amount <= 0) j += 1;
  }
  return transfers;
}
