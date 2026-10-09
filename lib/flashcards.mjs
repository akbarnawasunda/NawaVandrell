/**
 * lib/flashcards.mjs — flashcard dengan pengulangan terjadwal (varian SM-2).
 *
 * Aturan jadwal:
 *  - Nilai "lupa"   : kartu diulang hari ini, faktor kemudahan (ef) turun 0,2 (minimum 1,3)
 *  - Nilai "sulit"  : lulus dengan nilai 3; ef turun sedikit; interval mengikuti aturan biasa
 *  - Nilai "baik"   : lulus dengan nilai 4; interval naik
 *  - Nilai "mudah"  : lulus dengan nilai 5; ef naik 0,1
 *  - Pengulangan lulus pertama = 1 hari, kedua = 6 hari, berikutnya = interval × ef (dibulatkan)
 * Semua tanggal dalam format YYYY-MM-DD, zona waktu lokal pengguna.
 */

import { addDaysIso, isValidIsoDate, safeSpreadsheetText, todayIso } from './format.mjs';
import { newId } from './localData.mjs';

export const GRADES = [
  { value: 'lupa', label: 'Lupa', kualitas: 0, hint: 'Ulangi hari ini' },
  { value: 'sulit', label: 'Sulit', kualitas: 3, hint: 'Ingat, tapi berat' },
  { value: 'baik', label: 'Baik', kualitas: 4, hint: 'Ingat dengan wajar' },
  { value: 'mudah', label: 'Mudah', kualitas: 5, hint: 'Langsung ingat' },
];

const MIN_EF = 1.3;
const MAX_TEXT = 500;
export const MAX_CARDS_PER_DECK = 500;

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
}

export function newCard(depan, belakang, today = todayIso()) {
  return {
    id: newId('kartu'),
    depan: cleanText(depan),
    belakang: cleanText(belakang),
    ef: 2.5,
    interval: 0,
    reps: 0,
    lapses: 0,
    due: today,
  };
}

/** Menerapkan satu penilaian. Mengembalikan kartu baru (tidak mengubah input). */
export function review(card, grade, today = todayIso()) {
  const info = GRADES.find((item) => item.value === grade);
  if (!info) throw new TypeError('Nilai tidak dikenal.');
  const q = info.kualitas;
  const next = { ...card };
  if (q < 3) {
    next.reps = 0;
    next.lapses = (card.lapses || 0) + 1;
    next.interval = 0;
    next.ef = Math.max(MIN_EF, card.ef - 0.2);
    next.due = today;
    return next;
  }
  if (card.reps === 0) next.interval = 1;
  else if (card.reps === 1) next.interval = 6;
  else next.interval = Math.max(1, Math.round(card.interval * card.ef));
  next.reps = card.reps + 1;
  next.ef = Math.max(MIN_EF, card.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  next.due = addDaysIso(today, next.interval);
  return next;
}

/** Berapa hari lagi kartu muncul untuk setiap nilai, untuk ditampilkan di tombol. */
export function previewIntervals(card, today = todayIso()) {
  return GRADES.map((grade) => {
    const after = review(card, grade.value, today);
    const days = after.interval === 0 ? 0 : Math.max(0, Math.round((new Date(`${after.due}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86_400_000));
    return { grade: grade.value, days };
  });
}

export function isDue(card, today = todayIso()) {
  return isValidIsoDate(card?.due) && card.due <= today;
}

/** Kartu yang harus diulang hari ini: jatuh tempo dulu, kartu baru sebelum kartu lama. */
export function dueCards(cards = [], today = todayIso()) {
  return cards
    .filter((card) => isDue(card, today))
    .sort((a, b) => (a.due.localeCompare(b.due)) || (a.reps - b.reps));
}

export function deckStats(cards = [], today = todayIso()) {
  const due = cards.filter((card) => isDue(card, today)).length;
  const baru = cards.filter((card) => card.reps === 0).length;
  const dikuasai = cards.filter((card) => card.interval >= 21).length;
  return { total: cards.length, due, baru, dikuasai };
}

/**
 * Membaca daftar kartu dari teks. Setiap baris: "depan;belakang", "depan<TAB>belakang", atau "depan | belakang".
 * Baris kosong dan baris tanpa pemisah dilewati dan dihitung.
 */
export function parseCardsText(text) {
  const cards = [];
  let skipped = 0;
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const separator = line.includes('\t') ? '\t' : line.includes(';') ? ';' : line.includes(' | ') ? ' | ' : null;
    if (!separator) {
      skipped += 1;
      continue;
    }
    const [front, ...rest] = line.split(separator);
    const back = rest.join(separator);
    const depan = cleanText(front);
    const belakang = cleanText(back);
    if (!depan || !belakang) {
      skipped += 1;
      continue;
    }
    cards.push({ depan, belakang });
  }
  return { cards, skipped };
}

/** Membersihkan dek dari penyimpanan atau impor. */
export function sanitizeDeck(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  const cards = (Array.isArray(raw.cards) ? raw.cards : []).slice(0, MAX_CARDS_PER_DECK).map((card) => ({
    id: typeof card?.id === 'string' && card.id ? card.id.slice(0, 80) : newId('kartu'),
    depan: cleanText(card?.depan),
    belakang: cleanText(card?.belakang),
    ef: Math.max(MIN_EF, Math.min(4, Number(card?.ef) || 2.5)),
    interval: Math.max(0, Math.min(3650, Math.floor(Number(card?.interval) || 0))),
    reps: Math.max(0, Math.floor(Number(card?.reps) || 0)),
    lapses: Math.max(0, Math.floor(Number(card?.lapses) || 0)),
    due: isValidIsoDate(card?.due) ? card.due : todayIso(),
  })).filter((card) => card.depan && card.belakang);
  return {
    id: raw.id.slice(0, 80),
    nama: cleanText(raw.nama).slice(0, 80) || 'Dek tanpa nama',
    cards,
    dibuat: typeof raw.dibuat === 'string' ? raw.dibuat : new Date().toISOString(),
    diubah: typeof raw.diubah === 'string' ? raw.diubah : new Date().toISOString(),
  };
}

export function createDeck(nama, now = new Date()) {
  const stamp = now.toISOString();
  return { id: newId('dek'), nama: cleanText(nama).slice(0, 80) || 'Dek baru', cards: [], dibuat: stamp, diubah: stamp };
}

/** CSV untuk dibuka di spreadsheet atau dibagikan ke teman. */
export function deckCsv(deck) {
  const esc = (value) => `"${safeSpreadsheetText(value).replace(/"/g, '""')}"`;
  const rows = [['depan', 'belakang'].map(esc).join(','), ...deck.cards.map((card) => [card.depan, card.belakang].map(esc).join(','))];
  return `\uFEFF${rows.join('\r\n')}\r\n`;
}
