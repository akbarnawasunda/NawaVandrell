/**
 * lib/interviewPractice.mjs — penilaian mandiri jawaban latihan wawancara (heuristik lokal).
 * Ini bukan penilaian dari perekrut dan tidak memakai AI. Hanya memeriksa panjang, struktur, dan angka.
 */

import { INTERVIEW_QUESTIONS } from '../data/interviewBank.js';

const STAR_MARKERS = {
  situasi: /\b(saat|ketika|waktu|di\s+(tempat|perusahaan|kantor|toko|sekolah|kampus|proyek)|pada\s+(saat|tahun|bulan))\b/i,
  tugas: /\b(tugas|tanggung jawab|target|harus|bertugas|diminta|ditugaskan)\b/i,
  tindakan: /\b(saya\s+(membuat|menyusun|menghubungi|mengatur|memutuskan|mencoba|melakukan|mengajukan|menjelaskan|membantu|memimpin|menangani|belajar|mengecek))\b/i,
  hasil: /\b(akhirnya|hasilnya|hasil|sehingga|dampaknya|berhasil|meningkat|menurun|selesai tepat|pelanggan|kepuasan)\b/i,
};

export function countWords(text) {
  return String(text ?? '').trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Menilai jawaban. Mengembalikan skor 0–100 dan saran yang bisa langsung diperbaiki.
 */
export function scoreAnswer(text) {
  const words = countWords(text);
  const sentences = String(text ?? '').split(/[.!?]+\s/).filter((s) => s.trim()).length;
  const hasNumber = /\d/.test(String(text ?? ''));
  const starFound = Object.fromEntries(Object.entries(STAR_MARKERS).map(([key, re]) => [key, re.test(String(text ?? ''))]));
  const starScore = Object.values(starFound).filter(Boolean).length;

  const tips = [];
  let score = 0;
  if (words < 20) tips.push('Jawaban masih sangat singkat. Tambahkan contoh konkret.');
  else if (words > 220) tips.push('Jawaban terlalu panjang untuk wawancara. Targetkan sekitar 1–2 menit (±120–200 kata).');
  score += words >= 60 && words <= 220 ? 30 : words >= 30 ? 18 : 6;

  score += Math.round((starScore / 4) * 40);
  if (starScore < 3) {
    const missing = Object.entries(starFound).filter(([, ok]) => !ok).map(([key]) => key);
    tips.push(`Struktur STAR belum lengkap. Belum terlihat bagian: ${missing.join(', ')}.`);
  }

  score += hasNumber ? 20 : 0;
  if (!hasNumber) tips.push('Tambahkan angka hasil, misalnya persentase, jumlah, atau waktu.');

  score += sentences >= 3 ? 10 : 4;
  if (sentences < 3) tips.push('Pecah jawaban menjadi beberapa kalimat yang jelas.');

  return {
    score: Math.min(100, Math.max(0, score)),
    words,
    sentences,
    hasNumber,
    star: starFound,
    tips,
    disclaimer: 'Penilaian mandiri berdasarkan panjang, struktur, dan angka. Bukan penilaian perekrut.',
  };
}

/** Memilih pertanyaan acak dari kategori tertentu, menghindari pertanyaan yang baru saja muncul. */
export function pickQuestion(category = 'semua', exclude = []) {
  const pool = INTERVIEW_QUESTIONS.filter((q) => category === 'semua' || q.kategori === category);
  if (!pool.length) return null;
  const fresh = pool.filter((q) => !exclude.includes(q.id));
  const list = fresh.length ? fresh : pool;
  return list[Math.floor(Math.random() * list.length)];
}

export function questionById(id) {
  return INTERVIEW_QUESTIONS.find((q) => q.id === id) || null;
}
