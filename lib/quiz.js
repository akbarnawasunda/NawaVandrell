/**
 * lib/quiz.js — engine kuis stateless.
 *
 * FIX BUG LAMA: dulu questionId di-generate acak dan tidak sinkron antara
 * /api/quiz, /api/quiz/check, dan /api/quiz/reveal, jadi cek jawaban sering
 * mengambil soal yang salah.
 *
 * Sekarang ID = "category.level.index" (deterministik). Server bisa
 * mengambil soal yang tepat dari ID tanpa menyimpan state apa pun,
 * jadi aman di serverless (tiap request bisa beda instance).
 */

import { quizDatabase, QUIZ_POINTS } from '@/data/quizDatabase';

export const LEVELS = ['easy', 'medium', 'hard'];

export function isValidCategory(category) {
  return Object.prototype.hasOwnProperty.call(quizDatabase, category);
}

export function normalizeLevel(level) {
  return LEVELS.includes(level) ? level : 'easy';
}

export function getPool(category, level) {
  if (!isValidCategory(category)) return null;
  const pool = quizDatabase[category][normalizeLevel(level)];
  return Array.isArray(pool) && pool.length ? pool : null;
}

export function makeId(category, level, index) {
  return `${category}.${normalizeLevel(level)}.${index}`;
}

/** @returns {{category, level, index}|null} */
export function parseId(id) {
  if (typeof id !== 'string') return null;
  const parts = id.split('.');
  if (parts.length !== 3) return null;
  const [category, level, rawIndex] = parts;
  if (!isValidCategory(category)) return null;
  if (!LEVELS.includes(level)) return null;
  const index = Number(rawIndex);
  if (!Number.isInteger(index) || index < 0) return null;
  const pool = quizDatabase[category][level];
  if (!pool || index >= pool.length) return null;
  return { category, level, index };
}

export function getQuestionById(id) {
  const parsed = parseId(id);
  if (!parsed) return null;
  const item = quizDatabase[parsed.category][parsed.level][parsed.index];
  return { ...parsed, item };
}

/**
 * Ambil 1 soal acak.
 * `exclude` = daftar id yang baru saja keluar, supaya tidak langsung berulang.
 */
export function pickQuestion(category, level, exclude = []) {
  const lvl = normalizeLevel(level);
  const pool = getPool(category, lvl);
  if (!pool) return null;

  const excluded = new Set(exclude.filter(Boolean));
  let candidates = pool
    .map((_, i) => i)
    .filter((i) => !excluded.has(makeId(category, lvl, i)));

  if (!candidates.length) candidates = pool.map((_, i) => i);

  const index = candidates[Math.floor(Math.random() * candidates.length)];
  return {
    id: makeId(category, lvl, index),
    soal: pool[index].soal,
    level: lvl,
    category,
    points: QUIZ_POINTS[lvl],
    total: pool.length,
  };
}

/** Normalisasi jawaban: lowercase, buang tanda baca & spasi ganda. */
export function normalizeAnswer(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Jarak Levenshtein untuk toleransi typo kecil. */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

/**
 * Cek jawaban: case-insensitive, abaikan tanda baca,
 * terima `alt`, dan maafkan 1 typo untuk jawaban >= 5 huruf.
 */
export function checkAnswer(item, answer) {
  const given = normalizeAnswer(answer);
  if (!given) return false;

  const accepted = [item.jawaban, ...(item.alt || [])].map(normalizeAnswer);

  for (const target of accepted) {
    if (!target) continue;
    if (given === target) return true;
    // toleransi typo: 1 huruf untuk kata >= 5, 2 huruf untuk >= 10
    const allowed = target.length >= 10 ? 2 : target.length >= 5 ? 1 : 0;
    if (allowed && levenshtein(given, target) <= allowed) return true;
    // jawaban benar terkandung utuh (mis. "nabi nuh" vs "nuh")
    if (target.length >= 4 && given.includes(target)) return true;
  }
  return false;
}

export function pointsFor(level) {
  return QUIZ_POINTS[normalizeLevel(level)] ?? 1;
}
