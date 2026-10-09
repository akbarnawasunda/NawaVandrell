import test from 'node:test';
import assert from 'node:assert/strict';
import { INTERVIEW_QUESTIONS, STAR_STEPS } from '../data/interviewBank.js';
import { countWords, pickQuestion, questionById, scoreAnswer } from '../lib/interviewPractice.mjs';

const STRONG = 'Saat bekerja sebagai staf gudang, tugas saya memastikan stok selalu akurat. Saya membuat daftar periksa mingguan dan menyusun laporan selisih. Akhirnya selisih stok turun 40% dalam tiga bulan, sehingga tim bisa menyelesaikan pengiriman tepat waktu. Hasil ini membuat pelanggan puas.';

test('question bank has unique ids, valid categories, and tips for every question', () => {
  const ids = new Set(INTERVIEW_QUESTIONS.map((q) => q.id));
  assert.equal(ids.size, INTERVIEW_QUESTIONS.length);
  assert.ok(INTERVIEW_QUESTIONS.every((q) => q.tanya && q.tip && q.kategori));
  assert.equal(STAR_STEPS.length, 4);
  assert.equal(questionById('q-7').kategori, 'perilaku');
});

test('a structured answer with numbers scores well and gets no structure warning', () => {
  const result = scoreAnswer(STRONG);
  assert.ok(result.score >= 70, `skor ${result.score}`);
  assert.equal(result.hasNumber, true);
  assert.equal(Object.values(result.star).filter(Boolean).length, 4);
  assert.ok(!result.tips.some((tip) => /STAR/.test(tip)));
  assert.match(result.disclaimer, /Bukan penilaian perekrut/);
});

test('a very short answer receives concrete tips rather than a silent low score', () => {
  const result = scoreAnswer('Saya suka bekerja.');
  assert.ok(result.score < 40);
  assert.ok(result.tips.some((tip) => /sangat singkat/.test(tip)));
  assert.ok(result.tips.some((tip) => /angka/.test(tip)));
});

test('word counting ignores extra spaces', () => {
  assert.equal(countWords('  satu   dua\ntiga  '), 3);
  assert.equal(countWords(''), 0);
});

test('question picker respects the category and avoids repeats when possible', () => {
  for (let i = 0; i < 20; i += 1) {
    assert.equal(pickQuestion('motivasi').kategori, 'motivasi');
  }
  const motivasi = INTERVIEW_QUESTIONS.filter((q) => q.kategori === 'motivasi').map((q) => q.id);
  const next = pickQuestion('motivasi', motivasi.slice(0, -1));
  assert.equal(next.id, motivasi.at(-1));
  assert.equal(pickQuestion('tidak-ada'), null);
});
