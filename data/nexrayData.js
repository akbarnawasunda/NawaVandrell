/**
 * Katalog game & konten non-tool.
 * quiz  -> pakai engine /api/quiz (data dari quizDatabase.js)
 * arcade-> game lokal murni client-side (komponen sendiri)
 */
import { quizMeta, quizCategoryKeys } from './quizDatabase';

const quizGames = quizCategoryKeys.map((key) => ({
  slug: key,
  name: quizMeta[key].name,
  desc: quizMeta[key].desc,
  icon: quizMeta[key].icon,
  type: 'quiz',
}));

const arcadeGames = [
  {
    slug: 'logic-gate',
    name: 'Logic Gate Puzzle',
    desc: 'Tentukan output gerbang logika',
    icon: '⚡',
    type: 'arcade',
  },
  {
    slug: 'angka-enigma',
    name: 'Angka Enigma',
    desc: 'Cari angka lanjutan dari deret',
    icon: '🔢',
    type: 'arcade',
  },
  {
    slug: 'kata-sambung',
    name: 'Kata Sambung',
    desc: 'Sambung kata pakai huruf terakhir',
    icon: '🔗',
    type: 'arcade',
  },
  {
    slug: 'emoji-story',
    name: 'Emoji Story',
    desc: 'Tebak arti rangkaian emoji',
    icon: '🎭',
    type: 'arcade',
  },
  {
    slug: 'memory-matrix',
    name: 'Memory Matrix',
    desc: 'Ingat pola kotak yang menyala',
    icon: '🧠',
    type: 'arcade',
  },
  {
    slug: 'typing-blitz',
    name: 'Typing Blitz',
    desc: 'Ketik secepat mungkin 30 detik',
    icon: '⌨️',
    type: 'arcade',
  },
  {
    slug: 'math-rush',
    name: 'Math Rush',
    desc: 'Hitung cepat lawan waktu',
    icon: '➗',
    type: 'arcade',
  },
];

export const allGames = [...quizGames, ...arcadeGames];

export function findGame(slug) {
  return allGames.find((g) => g.slug === slug) || null;
}

export const gameFilters = [
  { id: 'all', label: 'Semua' },
  { id: 'quiz', label: 'Kuis' },
  { id: 'arcade', label: 'Arcade' },
];

/** Galeri acak. */
export const galleryModes = [
  { id: 'cecan', label: 'Cecan Indonesia', icon: '💃' },
  { id: 'waifu', label: 'Anime Waifu', icon: '🌸' },
  { id: 'aesthetic', label: 'Wallpaper Aesthetic', icon: '🖼️' },
];
