/*
 * SKEMA SOAL NAWAVANDRELL QUIZ v1.0
 * 
 * TIAP FILE KATEGORI WAJIB NGEXPORT ARRAY DENGAN STRUKTUR INI:
 *
 * export const category = 'kimia';           // slug, huruf kecil, no spasi
 * export const displayName = 'Tebak Kimia';  // nama yang ditampilin
 * 
 * export const questions = [
 *   {
 *     id: 'k001',                    // unik per kategori (format: [huruf-kategori][nomor-urut])
 *     d: 'easy',                     // 'easy' | 'medium' | 'hard'
 *     q: 'Apa nama unsur dengan simbol Fe?',  // pertanyaan (teks)
 *     a: 'Besi',                              // jawaban utama (case-insensitive match)
 *     alt: ['iron'],                          // alternatif jawaban yang dianggap bener (opsional)
 *     hint: 'Logam yang banyak dipake di konstruksi',  // petunjuk pas user klik '?' (opsional)
 *     explain: 'Fe itu singkatan dari Ferrum (Latin), bahasa Indonesianya Besi.',  // penjelasan pas user nyerah (wajib)
 *   },
 * ];
 */
