/**
 * Logika tool "Fun" versi LOKAL (tidak proxy ke api.nexray.eu.cc).
 * Dipakai baik oleh /api/tool-proxy maupun langsung di client.
 * Fix bug lama: dulu tool-proxy cuma handle `alay`.
 */

// ------------------------------- ALAY -------------------------------

const ALAY_MAP = {
  a: '4', b: 'B', c: 'C', d: 'd', e: '3', f: 'F', g: '9', h: 'H',
  i: '1', j: 'j', k: 'K', l: 'L', m: 'M', n: 'N', o: '0', p: 'P',
  q: 'Q', r: 'R', s: '5', t: '7', u: 'U', v: 'V', w: 'W', x: 'X',
  y: 'Y', z: 'Z',
};

const ALAY_SUFFIX = ['~', ' xixixi', ' wkwk', ' :v', ' ea', ' cuy', ''];

export function toAlay(text) {
  if (!text) return '';
  let out = '';
  let i = 0;
  for (const ch of String(text)) {
    const low = ch.toLowerCase();
    if (ALAY_MAP[low]) {
      // alternate case biar makin alay
      const mapped = ALAY_MAP[low];
      out += i % 2 === 0 ? mapped.toUpperCase() : mapped.toLowerCase();
      i++;
    } else {
      out += ch;
    }
  }
  const suffix = ALAY_SUFFIX[Math.floor(Math.random() * ALAY_SUFFIX.length)];
  return out + suffix;
}

// ------------------------------ ROASTING ------------------------------

const ROAST_LINES = [
  'Lihat {name}, orangnya baik banget. Sayang cuma itu yang bisa dibanggain.',
  '{name} tuh kayak update software: ditunda terus, dan kalau jalan malah nambah masalah.',
  'Kalau kepercayaan diri bisa jadi mata uang, {name} udah bangkrut dari lahir.',
  '{name} bukan gagal, cuma sukses yang salah alamat terus-terusan.',
  'Otak {name} itu RAM 512MB tapi maunya buka 40 tab.',
  '{name} unik banget, kayak error yang gak ada di Stack Overflow.',
  'Ada dua tipe orang: yang bikin solusi, dan {name}.',
  '{name} rajin banget mikirin masa depan. Sayang masa depannya gak mikirin {name}.',
  'Kalau {name} jadi WiFi, pasti sinyal 1 bar dan minta password terus.',
  '{name} itu bukti hidup bahwa kuota internet bisa kepake buat hal gak penting.',
  'Bakat terbesar {name} adalah bikin orang lain sabar.',
  '{name} kalau dikasih dua pilihan, pasti milih yang ketiga yang gak ada.',
  'Sifat {name} kayak Senin pagi: gak ada yang nunggu, tapi tetep datang.',
  '{name} tipe orang yang baca tutorial 3 jam, praktek 3 detik, nyerah 3 kali.',
  'Kalau ada lomba nunda kerjaan, {name} pun bakal daftar besok.',
  '{name} punya potensi besar. Besar banget, sampai belum ketemu sampai sekarang.',
  'Muka {name} bukan jelek, cuma butuh loading lebih lama buat diproses mata.',
  '{name} itu kayak baterai HP jam 5 sore: udah gak bisa diandalkan.',
  'Yang konsisten dari {name} cuma satu: gak konsisten.',
  '{name} kalau ngomong bijak, semesta langsung minta sumbernya.',
  'Dompet {name} lebih rapi dari isi kepalanya, karena dua-duanya kosong.',
  '{name} tuh definisi hidup: nge-scroll dari pagi, nyesel dari malam.',
  'Kalau overthinking olahraga, {name} udah atlet nasional.',
  '{name} sebenernya pinter, tapi kepinterannya lagi cuti panjang.',
];

const ROAST_CLOSERS = [
  'Tapi tenang, ini cuma bercanda kok. Setengahnya doang. 😌',
  'Jangan diambil hati, ambil pelajaran aja. 🔥',
  'Kalau kena, berarti akurat. 💀',
  'Sisi baiknya: kamu masih dibaca sampai akhir. 😁',
  'Udah gitu aja, jangan nangis ya. 🥲',
];

export function roast(name) {
  const target = (name || 'kamu').toString().trim().slice(0, 40) || 'kamu';
  const pool = [...ROAST_LINES];
  const picked = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0].replaceAll('{name}', target));
  }
  const closer = ROAST_CLOSERS[Math.floor(Math.random() * ROAST_CLOSERS.length)];
  return `${picked.map((l, i) => `${i + 1}. ${l}`).join('\n\n')}\n\n${closer}`;
}

// ------------------------------- FUNFACT -------------------------------

const ZODIACS = [
  { name: 'Capricorn', until: [1, 19], trait: 'disiplin dan tahan banting' },
  { name: 'Aquarius', until: [2, 18], trait: 'unik dan suka mikir out of the box' },
  { name: 'Pisces', until: [3, 20], trait: 'sensitif dan imajinatif' },
  { name: 'Aries', until: [4, 19], trait: 'berani dan gak sabaran' },
  { name: 'Taurus', until: [5, 20], trait: 'keras kepala tapi setia' },
  { name: 'Gemini', until: [6, 21], trait: 'gampang bosan dan komunikatif' },
  { name: 'Cancer', until: [7, 22], trait: 'perhatian dan gampang baper' },
  { name: 'Leo', until: [8, 22], trait: 'percaya diri dan suka jadi pusat perhatian' },
  { name: 'Virgo', until: [9, 22], trait: 'perfeksionis dan detail' },
  { name: 'Libra', until: [10, 23], trait: 'suka damai dan susah ambil keputusan' },
  { name: 'Scorpio', until: [11, 21], trait: 'intens dan penuh misteri' },
  { name: 'Sagittarius', until: [12, 21], trait: 'bebas dan suka petualangan' },
  { name: 'Capricorn', until: [12, 31], trait: 'disiplin dan tahan banting' },
];

const SHIO = ['Tikus', 'Kerbau', 'Macan', 'Kelinci', 'Naga', 'Ular', 'Kuda', 'Kambing', 'Monyet', 'Ayam', 'Anjing', 'Babi'];
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const ELEMENTS = ['Kayu', 'Api', 'Tanah', 'Logam', 'Air'];

const LIFE_FACTS = [
  'Jantung kamu udah berdetak sekitar {beats} kali sejak lahir.',
  'Kamu udah tarik napas kurang lebih {breaths} kali.',
  'Kalau rata-rata tidur 8 jam, kamu udah tidur sekitar {sleepYears} tahun penuh.',
  'Rambut kamu total udah tumbuh sekitar {hair} meter sejak lahir.',
  'Bumi udah bawa kamu keliling Matahari {orbits} kali.',
];

function getZodiac(month, day) {
  for (const z of ZODIACS) {
    const [m, d] = z.until;
    if (month < m || (month === m && day <= d)) return z;
  }
  return ZODIACS[ZODIACS.length - 1];
}

export function funfact(birthdate) {
  const raw = String(birthdate || '').trim();
  const m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) {
    return { error: 'Format tanggal harus YYYY-MM-DD, contoh: 2004-08-17' };
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { error: 'Tanggal itu gak ada di kalender. Cek lagi ya.' };
  }

  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (date.getTime() > todayUTC) {
    return { error: 'Tanggal lahir kok di masa depan? 🤨' };
  }

  const days = Math.floor((todayUTC - date.getTime()) / 86400000);
  let age = now.getUTCFullYear() - year;
  const hadBirthday =
    now.getUTCMonth() + 1 > month ||
    (now.getUTCMonth() + 1 === month && now.getUTCDate() >= day);
  if (!hadBirthday) age -= 1;

  const zodiac = getZodiac(month, day);
  const shio = SHIO[(year - 4) % 12];
  const element = ELEMENTS[Math.floor(((year - 4) % 10) / 2)];
  const dayName = DAYS[date.getUTCDay()];

  const stats = {
    beats: (days * 24 * 60 * 72).toLocaleString('id-ID'),
    breaths: (days * 24 * 60 * 16).toLocaleString('id-ID'),
    sleepYears: (days / 3 / 365).toFixed(1),
    hair: ((days / 30) * 1.25 / 100).toFixed(2),
    orbits: age,
  };

  const fact = LIFE_FACTS[Math.floor(Math.random() * LIFE_FACTS.length)].replace(
    /\{(\w+)\}/g,
    (_, k) => stats[k]
  );

  // hari ulang tahun berikutnya
  let nextY = now.getUTCFullYear();
  if (!(month > now.getUTCMonth() + 1 || (month === now.getUTCMonth() + 1 && day > now.getUTCDate()))) {
    nextY += 1;
  }
  const nextBday = Date.UTC(nextY, month - 1, day);
  const daysToBday = Math.ceil((nextBday - todayUTC) / 86400000);

  return {
    result: [
      `🎂 Lahir hari ${dayName}, ${day}/${month}/${year}`,
      `🎈 Umur kamu ${age} tahun (${days.toLocaleString('id-ID')} hari)`,
      `♈ Zodiak: ${zodiac.name} — ${zodiac.trait}`,
      `🐉 Shio: ${shio} (elemen ${element})`,
      `🌍 ${fact}`,
      `⏳ Ulang tahun berikutnya ${daysToBday} hari lagi`,
    ].join('\n'),
    meta: { age, days, zodiac: zodiac.name, shio, element, dayName, daysToBday },
  };
}

// ------------------------------ LOREM IPSUM ------------------------------

const LOREM_WORDS = `lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor
incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation
ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit
voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non
proident sunt culpa qui officia deserunt mollit anim id est laborum`
  .split(/\s+/)
  .filter(Boolean);

export function loremIpsum({ count = 3, unit = 'paragraph' } = {}) {
  const n = Math.max(1, Math.min(50, Number(count) || 3));
  const word = () => LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)];

  const sentence = () => {
    const len = 8 + Math.floor(Math.random() * 10);
    const words = Array.from({ length: len }, word);
    const s = words.join(' ');
    return s.charAt(0).toUpperCase() + s.slice(1) + '.';
  };

  if (unit === 'word') return Array.from({ length: n }, word).join(' ');
  if (unit === 'sentence') return Array.from({ length: n }, sentence).join(' ');

  return Array.from({ length: n }, () => {
    const sents = 3 + Math.floor(Math.random() * 3);
    return Array.from({ length: sents }, sentence).join(' ');
  }).join('\n\n');
}
