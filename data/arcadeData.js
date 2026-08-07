/** Data untuk 7 game arcade baru. Semua lokal, tanpa API. */

export const LOGIC_GATES = {
  AND: (a, b) => a && b,
  OR: (a, b) => a || b,
  NAND: (a, b) => !(a && b),
  NOR: (a, b) => !(a || b),
  XOR: (a, b) => a !== b,
  XNOR: (a, b) => a === b,
};

export const GATE_NAMES = Object.keys(LOGIC_GATES);

/** Deret angka: rumus + label pola. */
export const SEQUENCE_RULES = [
  { label: 'tambah tetap', gen: () => { const s = rnd(1, 9), d = rnd(2, 9); return { seq: [0, 1, 2, 3].map((i) => s + d * i), next: s + d * 4 }; } },
  { label: 'kali tetap', gen: () => { const s = rnd(1, 5), r = rnd(2, 4); return { seq: [0, 1, 2, 3].map((i) => s * r ** i), next: s * r ** 4 }; } },
  { label: 'kuadrat', gen: () => { const s = rnd(1, 6); return { seq: [0, 1, 2, 3].map((i) => (s + i) ** 2), next: (s + 4) ** 2 }; } },
  { label: 'fibonacci', gen: () => { const a = rnd(1, 5), b = rnd(2, 7); const s = [a, b, a + b, a + 2 * b]; return { seq: s, next: s[2] + s[3] }; } },
  { label: 'selisih naik', gen: () => { const s = rnd(1, 8); const out = [s]; let d = rnd(1, 4); for (let i = 0; i < 3; i++) { out.push(out[out.length - 1] + d); d++; } return { seq: out, next: out[3] + d }; } },
  { label: 'kurang tetap', gen: () => { const s = rnd(60, 99), d = rnd(3, 9); return { seq: [0, 1, 2, 3].map((i) => s - d * i), next: s - d * 4 }; } },
  { label: 'kali lalu tambah', gen: () => { const s = rnd(1, 4); const out = [s]; for (let i = 0; i < 4; i++) out.push(out[out.length - 1] * 2 + 1); return { seq: out.slice(0, 4), next: out[4] }; } },
];

function rnd(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function makeSequence() {
  const rule = SEQUENCE_RULES[Math.floor(Math.random() * SEQUENCE_RULES.length)];
  const { seq, next } = rule.gen();
  return { seq, next, label: rule.label };
}

/** Kata Sambung — kamus kata Indonesia. */
export const WORD_BANK = [
  'apel', 'anggur', 'ayam', 'awan', 'api', 'anjing', 'asap', 'akar', 'atap', 'angin',
  'buku', 'bunga', 'bola', 'batu', 'baju', 'bulan', 'bintang', 'bebek', 'botol', 'bantal',
  'cabai', 'cermin', 'cicak', 'cangkir', 'coklat', 'celana', 'cahaya', 'cendol',
  'daun', 'domba', 'durian', 'dapur', 'danau', 'dinding', 'dompet', 'duri',
  'ember', 'emas', 'elang', 'empat', 'es',
  'gula', 'gajah', 'garam', 'gunung', 'gitar', 'genteng', 'gelas', 'guru',
  'hujan', 'hutan', 'harimau', 'hidung', 'handuk', 'hati',
  'ikan', 'itik', 'induk', 'istana', 'ilmu',
  'jeruk', 'jalan', 'jendela', 'jamur', 'jagung', 'jarum', 'jaket',
  'kucing', 'kursi', 'kelapa', 'kunci', 'kapal', 'kamera', 'kertas', 'kopi', 'kota',
  'lampu', 'laut', 'lemari', 'lilin', 'langit', 'lidah', 'labu',
  'meja', 'mangga', 'motor', 'mata', 'madu', 'malam', 'mobil', 'musik',
  'nasi', 'naga', 'nanas', 'negara', 'nelayan',
  'obat', 'ombak', 'oven', 'orang', 'otak',
  'pisang', 'pintu', 'payung', 'piring', 'pohon', 'pensil', 'pantai', 'padi',
  'radio', 'roti', 'rumah', 'rambut', 'rusa', 'rantai',
  'sepatu', 'sapu', 'susu', 'sungai', 'semut', 'salju', 'sendok', 'sabun', 'sekolah',
  'tas', 'tikus', 'topi', 'telur', 'taman', 'tangga', 'tanah', 'tomat', 'tali',
  'ubi', 'udang', 'ular', 'uang', 'ungu',
  'wajan', 'warna', 'wortel', 'waktu',
];

export const EMOJI_STORIES = [
  { emoji: '🐱🎩', answer: 'Cat in the Hat', alt: ['kucing bertopi', 'cat hat'] },
  { emoji: '🌧️☂️', answer: 'Hujan', alt: ['musim hujan', 'rain'] },
  { emoji: '🍚🍗', answer: 'Ayam Geprek', alt: ['nasi ayam', 'ayam goreng', 'nasi goreng ayam'] },
  { emoji: '🚗💨', answer: 'Ngebut', alt: ['balap', 'kebut', 'mobil kabur'] },
  { emoji: '📚😴', answer: 'Ngantuk Belajar', alt: ['belajar ngantuk', 'bosan belajar', 'ngantuk'] },
  { emoji: '💰🔥', answer: 'Boros', alt: ['bakar duit', 'buang uang', 'habis uang'] },
  { emoji: '🎂🎉', answer: 'Ulang Tahun', alt: ['pesta ulang tahun', 'birthday'] },
  { emoji: '☕🌅', answer: 'Kopi Pagi', alt: ['ngopi pagi', 'sarapan kopi'] },
  { emoji: '⚽🏆', answer: 'Juara Bola', alt: ['juara sepak bola', 'menang bola', 'piala'] },
  { emoji: '🌙⭐', answer: 'Malam', alt: ['langit malam', 'bintang malam'] },
  { emoji: '👨‍💻🌙', answer: 'Ngoding Malam', alt: ['lembur', 'kerja malam', 'ngoding'] },
  { emoji: '🍜🌶️', answer: 'Mie Pedas', alt: ['indomie pedas', 'mie ayam pedas', 'ramen pedas'] },
  { emoji: '✈️🌍', answer: 'Traveling', alt: ['jalan jalan', 'liburan', 'keliling dunia'] },
  { emoji: '💔😢', answer: 'Patah Hati', alt: ['sakit hati', 'putus', 'sedih'] },
  { emoji: '🎓📜', answer: 'Lulus', alt: ['wisuda', 'kelulusan', 'graduation'] },
  { emoji: '🐝🍯', answer: 'Madu', alt: ['lebah madu', 'sarang madu'] },
  { emoji: '🏠🔥', answer: 'Kebakaran', alt: ['rumah kebakaran', 'rumah terbakar'] },
  { emoji: '🎣🐟', answer: 'Mancing', alt: ['memancing', 'nangkap ikan'] },
  { emoji: '💍👰', answer: 'Menikah', alt: ['pernikahan', 'nikah', 'lamaran'] },
  { emoji: '🌧️🌈', answer: 'Pelangi', alt: ['setelah hujan', 'hujan pelangi'] },
  { emoji: '🚑🏥', answer: 'Rumah Sakit', alt: ['ambulans', 'darurat', 'sakit'] },
  { emoji: '📱🔋', answer: 'Baterai Habis', alt: ['lowbat', 'charge hp', 'batre habis'] },
  { emoji: '🥊🏅', answer: 'Juara Boxing', alt: ['juara tinju', 'boxing', 'tinju'] },
  { emoji: '🐒🍌', answer: 'Monyet Makan Pisang', alt: ['monyet pisang', 'monyet'] },
];

export const TYPING_SENTENCES = [
  'Kode yang bersih lebih baik daripada kode yang pintar tapi bikin bingung',
  'Belajar itu proses seumur hidup jangan pernah berhenti mencoba hal baru',
  'Sebuah perjalanan seribu mil dimulai dari satu langkah kecil hari ini',
  'Konsistensi kecil setiap hari mengalahkan usaha besar sekali saja',
  'Jangan takut gagal karena gagal adalah bagian dari proses belajar',
  'Teknologi harus memudahkan hidup bukan malah menambah beban pikiran',
  'Menulis catatan setiap hari membantu ingatan jadi lebih tajam dan rapi',
  'Semakin banyak kamu berlatih semakin cepat tanganmu mengikuti pikiran',
  'Air yang tenang bukan berarti tidak punya kedalaman yang luar biasa',
  'Setiap orang punya waktunya sendiri jadi berhenti membandingkan diri',
  'Fokus pada satu hal sampai selesai lebih baik daripada memulai banyak',
  'Bahasa Indonesia adalah bahasa persatuan yang menyatukan ribuan pulau',
];

export const MATH_OPS = ['+', '-', '*'];

export function makeMathQuestion(round = 0) {
  const hard = round > 6;
  const op = MATH_OPS[Math.floor(Math.random() * (hard ? 3 : 2))];
  let a, b;
  if (op === '*') {
    a = rnd(2, hard ? 15 : 9);
    b = rnd(2, hard ? 12 : 9);
  } else if (op === '-') {
    a = rnd(10, hard ? 199 : 60);
    b = rnd(1, a - 1);
  } else {
    a = rnd(hard ? 20 : 5, hard ? 180 : 50);
    b = rnd(hard ? 20 : 5, hard ? 180 : 50);
  }
  const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
  return { text: `${a} ${op === '*' ? '×' : op} ${b}`, answer };
}

export function makeLogicQuestion() {
  const gate = GATE_NAMES[Math.floor(Math.random() * GATE_NAMES.length)];
  const a = Math.random() > 0.5 ? 1 : 0;
  const b = Math.random() > 0.5 ? 1 : 0;
  const out = LOGIC_GATES[gate](!!a, !!b) ? 1 : 0;
  return { gate, a, b, answer: out };
}
