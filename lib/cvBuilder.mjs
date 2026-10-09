/**
 * lib/cvBuilder.mjs — data CV, pemeriksa keterbacaan ATS (heuristik), dan ekspor teks/DOCX.
 *
 * Batasan jujur: pemeriksa ini hanya mengecek hal-hal yang bisa diperiksa lokal (format, kelengkapan,
 * kata kunci, tanggal, karakter yang sering salah dibaca). Tidak ada jaminan lolos seleksi ATS atau
 * seleksi perekrut. Semua data tetap di perangkat; tidak ada yang dikirim ke AI atau server.
 */

import { formatMonthId } from './format.mjs';

const MAX_TEXT = 600;
const MAX_LIST = 20;

export const CV_SECTION_LABELS = {
  ringkasan: 'RINGKASAN PROFESIONAL',
  pengalaman: 'PENGALAMAN KERJA',
  pendidikan: 'PENDIDIKAN',
  keterampilan: 'KETERAMPILAN',
  sertifikat: 'SERTIFIKAT & PELATIHAN',
  bahasa: 'BAHASA',
};

/** Kata kerja aksi yang umum di CV berbahasa Indonesia; dipakai untuk saran, bukan penilaian mutlak. */
export const ACTION_VERBS = [
  'membuat', 'mengelola', 'meningkatkan', 'menyusun', 'mengoordinasi', 'mengkoordinasi', 'menangani',
  'melayani', 'melakukan', 'memimpin', 'menjalankan', 'mengembangkan', 'mengurangi', 'menurunkan',
  'menyelesaikan', 'merancang', 'mengatur', 'membantu', 'memastikan', 'mengoptimalkan', 'menganalisis',
  'melatih', 'menjual', 'merekrut', 'mengawasi', 'menginput', 'mencatat', 'membangun', 'mengirim',
  'memproses', 'menyiapkan', 'mengurus', 'memelihara', 'menjaga', 'mengawal', 'mengimplementasikan',
  'merancang', 'menerapkan', 'mempresentasikan', 'menjadwalkan', 'mengendalikan', 'mengintegrasikan',
  'menciptakan', 'memperbaiki', 'menghasilkan', 'mengorganisir', 'menyusun', 'menjalin', 'mengelola',
  'developed', 'managed', 'led', 'built', 'created', 'improved', 'designed', 'reduced', 'increased',
];

const STOPWORDS = new Set([
  'dan', 'atau', 'untuk', 'yang', 'dengan', 'dari', 'pada', 'dalam', 'serta', 'the', 'and', 'of', 'to',
  'di', 'ke', 'ini', 'itu', 'saya', 'anda', 'kami', 'juga', 'agar', 'sebagai', 'karena', 'oleh',
]);

export function emptyExperience() {
  return { id: newRowId('kerja'), posisi: '', perusahaan: '', lokasi: '', mulai: '', selesai: '', sekarang: false, poin: '' };
}

export function emptyEducation() {
  return { id: newRowId('didik'), jenjang: '', institusi: '', jurusan: '', mulai: '', selesai: '' };
}

function newRowId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createCv(now = new Date()) {
  return {
    id: 'cv-utama',
    nama: '',
    judulTarget: '',
    email: '',
    telepon: '',
    kota: '',
    tautan: '',
    ringkasan: '',
    pengalaman: [emptyExperience()],
    pendidikan: [emptyEducation()],
    keterampilan: '',
    sertifikat: '',
    bahasa: '',
    updatedAt: now.toISOString(),
  };
}

function text(value, max = MAX_TEXT) {
  return String(value ?? '').replace(/[ \t]+/g, ' ').trim().slice(0, max);
}

function month(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || '')) ? value : '';
}

/** Membersihkan CV dari penyimpanan atau impor. */
export function sanitizeCv(raw) {
  const base = createCv();
  if (!raw || typeof raw !== 'object') return base;
  const experiences = (Array.isArray(raw.pengalaman) ? raw.pengalaman : []).slice(0, MAX_LIST).map((row) => ({
    id: text(row?.id, 80) || newRowId('kerja'),
    posisi: text(row?.posisi, 120),
    perusahaan: text(row?.perusahaan, 120),
    lokasi: text(row?.lokasi, 120),
    mulai: month(row?.mulai),
    selesai: month(row?.selesai),
    sekarang: Boolean(row?.sekarang),
    poin: String(row?.poin ?? '').split('\n').map((line) => text(line, 300)).filter(Boolean).slice(0, 12).join('\n'),
  }));
  const educations = (Array.isArray(raw.pendidikan) ? raw.pendidikan : []).slice(0, MAX_LIST).map((row) => ({
    id: text(row?.id, 80) || newRowId('didik'),
    jenjang: text(row?.jenjang, 80),
    institusi: text(row?.institusi, 120),
    jurusan: text(row?.jurusan, 120),
    mulai: month(row?.mulai),
    selesai: month(row?.selesai),
  }));
  return {
    id: 'cv-utama',
    nama: text(raw.nama, 80),
    judulTarget: text(raw.judulTarget, 120),
    email: text(raw.email, 120),
    telepon: text(raw.telepon, 40),
    kota: text(raw.kota, 80),
    tautan: text(raw.tautan, 200),
    ringkasan: text(raw.ringkasan, 1200),
    pengalaman: experiences.length ? experiences : base.pengalaman,
    pendidikan: educations.length ? educations : base.pendidikan,
    keterampilan: text(raw.keterampilan, 800),
    sertifikat: String(raw.sertifikat ?? '').split('\n').map((l) => text(l, 200)).filter(Boolean).slice(0, 15).join('\n'),
    bahasa: text(raw.bahasa, 200),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : base.updatedAt,
  };
}

/** Daftar keterampilan dari teks dipisah koma atau baris baru. */
export function skillList(cv) {
  return String(cv?.keterampilan || '').split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
}

/** Poin pengalaman sebagai array baris. */
export function bulletsOf(experience) {
  return String(experience?.poin || '').split('\n').map((line) => line.trim()).filter(Boolean);
}

function periodLabel(row) {
  const start = formatMonthId(row.mulai);
  const end = row.sekarang ? 'Sekarang' : formatMonthId(row.selesai);
  if (start && end) return `${start} – ${end}`;
  return start || end || '';
}

/** Isi CV tanpa judul target (judul target bukan bukti bahwa pengalaman sudah ditulis). */
function bodyText(cv) {
  return [
    cv.nama, cv.ringkasan, cv.keterampilan, cv.sertifikat, cv.bahasa,
    ...cv.pengalaman.flatMap((row) => [row.posisi, row.perusahaan, row.lokasi, row.poin]),
    ...cv.pendidikan.flatMap((row) => [row.jenjang, row.institusi, row.jurusan]),
  ].join(' \n ');
}

function allText(cv) {
  return [cv.judulTarget, bodyText(cv)].join(' \n ');
}

function wordsOf(value) {
  return String(value || '').toLowerCase().split(/[^a-z0-9\u00C0-\u024F]+/i).filter(Boolean);
}

/** Pemeriksaan ATS heuristik. Mengembalikan skor 0–100 dan daftar temuan. */
export function atsReport(cv) {
  const checks = [];
  const add = (id, level, title, detail) => checks.push({ id, level, title, detail });

  if (cv.nama.length < 3) add('nama', 'perbaiki', 'Nama lengkap belum jelas', 'Tulis nama lengkap seperti di KTP atau paspor, di bagian paling atas.');
  else add('nama', 'ok', 'Nama lengkap terisi', 'Nama ditampilkan sebagai judul dokumen.');

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cv.email);
  const phoneOk = /^\+?[\d\s()-]{9,18}$/.test(cv.telepon);
  if (!cv.email && !cv.telepon) add('kontak', 'perbaiki', 'Kontak belum diisi', 'Cantumkan email dan nomor telepon yang aktif.');
  else if (cv.email && !emailOk) add('kontak', 'perbaiki', 'Format email belum benar', 'Contoh format yang benar: nama@contoh.com.');
  else if (cv.telepon && !phoneOk) add('kontak', 'perbaiki', 'Format nomor telepon belum benar', 'Gunakan 9–15 digit, boleh diawali +62.');
  else add('kontak', 'ok', 'Kontak lengkap', 'Email dan telepon terbaca sebagai teks biasa.');

  if (!cv.judulTarget) add('judul', 'info', 'Judul posisi target kosong', 'Isi judul posisi yang dituju agar kata kunci bisa dicocokkan dengan isi CV.');

  const ringkasanLen = cv.ringkasan.length;
  if (!ringkasanLen) add('ringkasan', 'info', 'Ringkasan belum ada', 'Dua sampai empat kalimat tentang pengalaman dan kekuatan utama membantu pembaca cepat paham.');
  else if (ringkasanLen < 60) add('ringkasan', 'perbaiki', 'Ringkasan terlalu pendek', 'Tambahkan pengalaman singkat, bidang kerja, dan hasil utama.');
  else if (ringkasanLen > 600) add('ringkasan', 'info', 'Ringkasan cukup panjang', 'Pangkas menjadi 2–4 kalimat agar mudah dibaca.');
  else add('ringkasan', 'ok', 'Ringkasan terisi', 'Panjang ringkasan sudah wajar.');

  const complete = cv.pengalaman.filter((row) => row.posisi && row.perusahaan);
  if (!complete.length) add('pengalaman', 'perbaiki', 'Pengalaman kerja belum lengkap', 'Isi posisi dan nama perusahaan. Untuk lulusan baru, isi pengalaman organisasi atau magang.');
  else add('pengalaman', 'ok', `${complete.length} pengalaman terisi`, 'Setiap pengalaman perlu posisi, perusahaan, dan periode.');

  const withoutBullets = complete.filter((row) => bulletsOf(row).length === 0);
  if (withoutBullets.length) add('poin', 'perbaiki', 'Ada pengalaman tanpa poin tugas', 'Tambahkan 2–4 poin per pengalaman, satu baris untuk satu poin.');

  const bullets = complete.flatMap((row) => bulletsOf(row));
  if (bullets.length) {
    const withNumbers = bullets.filter((line) => /\d/.test(line)).length;
    const ratio = withNumbers / bullets.length;
    if (ratio < 0.3) add('angka', 'info', 'Hasil terukur masih sedikit', `Baru ${withNumbers} dari ${bullets.length} poin memakai angka. Contoh: “menurunkan waktu layanan 20%”.`);
    else add('angka', 'ok', 'Poin memakai angka', `${withNumbers} dari ${bullets.length} poin menyebut angka atau hasil.`);
    const verbStart = bullets.filter((line) => ACTION_VERBS.includes(line.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, ''))).length;
    if (verbStart / bullets.length < 0.5) add('kata-kerja', 'info', 'Mulai poin dengan kata kerja', 'Contoh: “Mengelola stok 300 SKU”, “Menyusun laporan bulanan”.');
  }

  const badDates = cv.pengalaman.filter((row) => {
    if (!row.mulai) return false;
    if (row.sekarang) return false;
    return row.selesai && row.selesai < row.mulai;
  });
  if (badDates.length) add('tanggal', 'perbaiki', 'Tanggal selesai lebih awal dari mulai', 'Periksa periode kerja pada pengalaman yang ditandai.');
  const missingDates = cv.pengalaman.filter((row) => row.posisi && !row.mulai);
  if (missingDates.length) add('tanggal-kosong', 'info', 'Ada pengalaman tanpa tanggal mulai', 'Tanggal membantu pembaca melihat riwayat karier.');

  const completeEdu = cv.pendidikan.filter((row) => row.institusi || row.jenjang);
  if (!completeEdu.length) add('pendidikan', 'info', 'Pendidikan belum diisi', 'Cantumkan jenjang dan nama institusi.');
  else add('pendidikan', 'ok', 'Pendidikan terisi', 'Jenjang dan institusi sudah ada.');

  const skills = skillList(cv);
  if (skills.length < 3) add('keterampilan', 'info', 'Keterampilan masih sedikit', 'Tulis 5–12 keterampilan yang relevan dengan posisi, dipisah koma.');
  else add('keterampilan', 'ok', `${skills.length} keterampilan terdaftar`, 'Keterampilan dibaca sebagai daftar biasa.');

  const decorative = /[|│┃▪■●★☆✔✓➤➔🔹🔸📌📞📧📍💼🎓]/u;
  const emojiLike = /\p{Extended_Pictographic}/u;
  if (decorative.test(allText(cv)) || emojiLike.test(allText(cv))) {
    add('dekorasi', 'perbaiki', 'Ada ikon, simbol, atau tabel tiruan', 'Hapus emoji dan simbol dekoratif. Sistem pembaca CV sering salah membaca karakter seperti ini.');
  } else {
    add('dekorasi', 'ok', 'Tanpa ikon atau simbol dekoratif', 'Teks bersih untuk dibaca mesin.');
  }

  const words = bodyText(cv).split(/\s+/).filter(Boolean).length;
  if (words < 150) add('panjang', 'info', 'CV terlihat terlalu singkat', `Sekitar ${words} kata. Biasanya 1–2 halaman sudah cukup untuk pengalaman yang lengkap.`);
  else if (words > 900) add('panjang', 'info', 'CV terlihat terlalu panjang', `Sekitar ${words} kata. Pangkas hal yang tidak relevan dengan posisi.`);
  else add('panjang', 'ok', 'Panjang CV wajar', `Sekitar ${words} kata.`);

  const targetWords = [...new Set(wordsOf(cv.judulTarget).filter((w) => w.length > 2 && !STOPWORDS.has(w)))];
  const cvTokens = new Set(wordsOf(bodyText(cv)));
  const found = targetWords.filter((word) => cvTokens.has(word));
  if (targetWords.length) {
    const ratio = found.length / targetWords.length;
    if (ratio >= 0.5) add('kata-kunci', 'ok', 'Kata kunci posisi muncul', `${found.length} dari ${targetWords.length} kata kunci judul target ada di CV.`);
    else add('kata-kunci', 'info', 'Kata kunci posisi masih kurang', `Hanya ${found.length} dari ${targetWords.length} kata dari judul target yang muncul. Gunakan istilah dari lowongan yang Anda lamar.`);
  }

  let score = 100;
  for (const check of checks) {
    if (check.level === 'perbaiki') score -= 10;
    if (check.level === 'info') score -= 3;
  }
  return {
    score: Math.max(0, Math.min(100, score)),
    checks,
    keywords: { total: targetWords.length, found, missing: targetWords.filter((word) => !found.includes(word)) },
    words,
    disclaimer: 'Skor ini heuristik dari pemeriksaan format dan kelengkapan. Bukan skor ATS resmi dan tidak menjamin lolos seleksi.',
  };
}

/** Teks polos untuk ditempel ke formulir lamaran: judul di atas, heading kapital, poin dengan tanda hubung. */
export function cvPlainText(cv) {
  const lines = [];
  if (cv.nama) lines.push(cv.nama.toUpperCase());
  if (cv.judulTarget) lines.push(cv.judulTarget);
  const contact = [cv.kota, cv.email, cv.telepon, cv.tautan].filter(Boolean).join(' | ');
  if (contact) lines.push(contact);
  if (cv.ringkasan) lines.push('', CV_SECTION_LABELS.ringkasan, cv.ringkasan);
  const experiences = cv.pengalaman.filter((row) => row.posisi || row.perusahaan);
  if (experiences.length) {
    lines.push('', CV_SECTION_LABELS.pengalaman);
    for (const row of experiences) {
      lines.push(`${row.posisi}${row.perusahaan ? ` — ${row.perusahaan}` : ''}${row.lokasi ? `, ${row.lokasi}` : ''}`);
      const period = periodLabel(row);
      if (period) lines.push(period);
      for (const bullet of bulletsOf(row)) lines.push(`- ${bullet}`);
      lines.push('');
    }
  }
  const education = cv.pendidikan.filter((row) => row.institusi || row.jenjang);
  if (education.length) {
    lines.push(CV_SECTION_LABELS.pendidikan);
    for (const row of education) {
      lines.push(`${[row.jenjang, row.jurusan].filter(Boolean).join(' ')}${row.institusi ? ` — ${row.institusi}` : ''}`);
      const period = [formatMonthId(row.mulai), formatMonthId(row.selesai)].filter(Boolean).join(' – ');
      if (period) lines.push(period);
    }
    lines.push('');
  }
  const skills = skillList(cv);
  if (skills.length) lines.push(CV_SECTION_LABELS.keterampilan, skills.join(', '), '');
  const certs = cv.sertifikat.split('\n').filter(Boolean);
  if (certs.length) lines.push(CV_SECTION_LABELS.sertifikat, ...certs.map((c) => `- ${c}`), '');
  if (cv.bahasa) lines.push(CV_SECTION_LABELS.bahasa, cv.bahasa, '');
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

/**
 * DOCX satu kolom tanpa tabel, tanpa gambar, dan tanpa kotak teks: format yang paling aman dibaca sistem.
 * @returns {Promise<Blob>}
 */
export async function createCvDocxBlob(cv) {
  const { AlignmentType, BorderStyle, Document, Packer, Paragraph, TextRun } = await import('docx');
  const children = [];
  const heading = (label) => new Paragraph({
    spacing: { before: 220, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '555555', space: 2 } },
    children: [new TextRun({ text: label, bold: true, size: 22, color: '111111' })],
  });
  const body = (value, options = {}) => new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text: value, size: 20, color: '111111', ...options })],
  });
  const bullet = (value) => new Paragraph({
    indent: { left: 360, hanging: 240 },
    spacing: { after: 40 },
    children: [new TextRun({ text: `•  ${value}`, size: 20, color: '111111' })],
  });

  children.push(new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 60 },
    children: [new TextRun({ text: cv.nama || 'Nama lengkap', bold: true, size: 32, color: '111111' })],
  }));
  if (cv.judulTarget) children.push(body(cv.judulTarget, { bold: true }));
  const contact = [cv.kota, cv.email, cv.telepon, cv.tautan].filter(Boolean).join(' | ');
  if (contact) children.push(body(contact));

  if (cv.ringkasan) {
    children.push(heading(CV_SECTION_LABELS.ringkasan));
    children.push(body(cv.ringkasan));
  }
  const experiences = cv.pengalaman.filter((row) => row.posisi || row.perusahaan);
  if (experiences.length) {
    children.push(heading(CV_SECTION_LABELS.pengalaman));
    for (const row of experiences) {
      children.push(body(`${row.posisi}${row.perusahaan ? ` — ${row.perusahaan}` : ''}${row.lokasi ? `, ${row.lokasi}` : ''}`, { bold: true }));
      const period = periodLabel(row);
      if (period) children.push(body(period, { italics: true }));
      for (const item of bulletsOf(row)) children.push(bullet(item));
    }
  }
  const education = cv.pendidikan.filter((row) => row.institusi || row.jenjang);
  if (education.length) {
    children.push(heading(CV_SECTION_LABELS.pendidikan));
    for (const row of education) {
      children.push(body(`${[row.jenjang, row.jurusan].filter(Boolean).join(' ')}${row.institusi ? ` — ${row.institusi}` : ''}`, { bold: true }));
      const period = [formatMonthId(row.mulai), formatMonthId(row.selesai)].filter(Boolean).join(' – ');
      if (period) children.push(body(period, { italics: true }));
    }
  }
  const skills = skillList(cv);
  if (skills.length) {
    children.push(heading(CV_SECTION_LABELS.keterampilan));
    children.push(body(skills.join(', ')));
  }
  const certs = cv.sertifikat.split('\n').filter(Boolean);
  if (certs.length) {
    children.push(heading(CV_SECTION_LABELS.sertifikat));
    for (const item of certs) children.push(bullet(item));
  }
  if (cv.bahasa) {
    children.push(heading(CV_SECTION_LABELS.bahasa));
    children.push(body(cv.bahasa));
  }

  const document = new Document({
    creator: 'Nawa Editor — dibuat di perangkat pengguna',
    title: `CV ${cv.nama || ''}`.trim(),
    description: 'CV dibuat dengan Nawa Editor. Periksa kembali sebelum dikirim.',
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
      children,
    }],
  });
  const buffer = await Packer.toBlob(document);
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
