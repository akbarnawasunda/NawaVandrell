import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deckCsv,
  deckStats,
  dueCards,
  newCard,
  parseCardsText,
  previewIntervals,
  review,
  sanitizeDeck,
} from '../lib/flashcards.mjs';

const TODAY = '2026-10-09';

test('a card that is remembered well follows 1, 6, then interval × ease', () => {
  let card = newCard('apple', 'apel', TODAY);
  card = review(card, 'baik', TODAY);
  assert.equal(card.interval, 1);
  assert.equal(card.due, '2026-10-10');
  card = review(card, 'baik', '2026-10-10');
  assert.equal(card.interval, 6);
  assert.equal(card.due, '2026-10-16');
  card = review(card, 'baik', '2026-10-16');
  assert.equal(card.interval, 15, '6 × 2,5 = 15');
  assert.equal(card.reps, 3);
});

test('easy answers raise the ease factor and hard answers lower it, never below 1.3', () => {
  const base = newCard('a', 'b', TODAY);
  assert.ok(review(base, 'mudah', TODAY).ef > base.ef);
  assert.ok(review(base, 'sulit', TODAY).ef < base.ef);
  let card = base;
  for (let i = 0; i < 10; i += 1) card = review(card, 'lupa', TODAY);
  assert.equal(card.ef, 1.3);
});

test('forgetting resets progress, counts a lapse, and brings the card back today', () => {
  let card = newCard('a', 'b', TODAY);
  card = review(card, 'baik', TODAY);
  card = review(card, 'baik', '2026-10-10');
  const lapsed = review(card, 'lupa', '2026-10-16');
  assert.equal(lapsed.reps, 0);
  assert.equal(lapsed.lapses, 1);
  assert.equal(lapsed.interval, 0);
  assert.equal(lapsed.due, '2026-10-16');
  assert.equal(review(lapsed, 'baik', '2026-10-16').interval, 1, 'after a lapse the schedule starts again');
});

test('preview shows how many days until each answer brings the card back', () => {
  const card = newCard('a', 'b', TODAY);
  const preview = previewIntervals(card, TODAY);
  assert.deepEqual(preview.map((row) => row.grade), ['lupa', 'sulit', 'baik', 'mudah']);
  assert.equal(preview.find((row) => row.grade === 'lupa').days, 0);
  assert.equal(preview.find((row) => row.grade === 'baik').days, 1);
  assert.equal(preview.find((row) => row.grade === 'mudah').days, 1);
});

test('due queue shows overdue and new cards first and skips cards scheduled later', () => {
  const cards = [
    { ...newCard('later', 'x', TODAY), due: '2026-10-20', reps: 2 },
    { ...newCard('overdue', 'y', TODAY), due: '2026-10-01', reps: 4 },
    { ...newCard('new', 'z', TODAY), due: TODAY, reps: 0 },
  ];
  assert.deepEqual(dueCards(cards, TODAY).map((card) => card.depan), ['overdue', 'new']);
  assert.deepEqual(deckStats(cards, TODAY), { total: 3, due: 2, baru: 1, dikuasai: 0 });
});

test('bulk text import accepts semicolons, tabs, and pipes, and counts invalid lines', () => {
  const { cards, skipped } = parseCardsText('apple;apel\nbook\tbuku\nhouse | rumah\nrusak tanpa pemisah\n;kosong\nlong;a;b');
  assert.deepEqual(cards.map((c) => [c.depan, c.belakang]), [['apple', 'apel'], ['book', 'buku'], ['house', 'rumah'], ['long', 'a;b']]);
  assert.equal(skipped, 2);
});

test('deck CSV protects against spreadsheet formulas and quotes the text', () => {
  const deck = sanitizeDeck({ id: 'd1', nama: 'Kosakata', cards: [{ id: 'k1', depan: '=1+1', belakang: 'dua "dua"', due: TODAY }] });
  const csv = deckCsv(deck);
  assert.match(csv, /"'=1\+1","dua ""dua"""/);
});

test('sanitizer repairs out-of-range scheduling values and drops empty cards', () => {
  const deck = sanitizeDeck({
    id: 'd2',
    nama: '   ',
    cards: [
      { id: 'k', depan: 'ok', belakang: 'oke', ef: 99, interval: -5, reps: 'x', due: '2026-02-31' },
      { id: 'kosong', depan: '', belakang: 'tidak ada depan' },
    ],
  });
  assert.equal(deck.nama, 'Dek tanpa nama');
  assert.equal(deck.cards.length, 1);
  assert.equal(deck.cards[0].ef, 4);
  assert.equal(deck.cards[0].interval, 0);
  assert.equal(deck.cards[0].reps, 0);
  assert.equal(deck.cards[0].due.length, 10);
  assert.equal(sanitizeDeck({ nama: 'tanpa id' }), null);
});

test('review rejects unknown grades', () => {
  assert.throws(() => review(newCard('a', 'b', TODAY), 'entah', TODAY), TypeError);
});
