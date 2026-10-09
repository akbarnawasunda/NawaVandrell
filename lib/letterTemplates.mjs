/**
 * lib/letterTemplates.mjs — template surat kerja dan administrasi (Bahasa Indonesia).
 *
 * Template disusun dari bentuk umum surat resmi. Isinya tetap perlu diperiksa dan disesuaikan
 * dengan kebutuhan penerima. Tidak ada klausul hukum yang dijanjikan; bila dokumen perlu meterai
 * atau legalisasi, ikuti ketentuan instansi tujuan.
 */

import { formatDateId, isValidIsoDate } from './format.mjs';

export const LETTER_TEMPLATES = [
  { id: 'lamaran', label: 'Surat lamaran kerja', group: 'Kerja' },
  { id: 'kuasa', label: 'Surat kuasa', group: 'Administrasi' },
  { id: 'pernyataan', label: 'Surat pernyataan', group: 'Administrasi' },
  { id: 'undangan', label: 'Surat undangan rapat atau acara', group: 'Administrasi' },
];

const clean = (value, max = 500) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const lines = (value) => String(value ?? '').split('\n').map((line) => clean(line, 400)).filter(Boolean);

export function emptyLetterValues() {
  return {
    kota: '',
    tanggal: '',
    // lamaran
    nama: '',
    alamat: '',
    telepon: '',
    email: '',
    posisi: '',
    perusahaan: '',
    penerima: '',
    alamatPerusahaan: '',
    sumber: '',
    kualifikasi: '',
    motivasi: '',
    lampiran: '',
    // kuasa
    pemberiNama: '',
    pemberiAlamat: '',
    pemberiNik: '',
    penerimaNama: '',
    penerimaAlamat: '',
    penerimaNik: '',
    keperluan: '',
    masaBerlaku: '',
    // pernyataan
    nik: '',
    pernyataan: '',
    tanggungJawab: true,
    // undangan
    acara: '',
    hari: '',
    waktu: '',
    tempat: '',
    agenda: '',
    kontakKonfirmasi: '',
    penyelenggara: '',
    jabatanPenyelenggara: '',
  };
}

/** Field yang ditampilkan per template: { key, label, type, required, hint }. */
export const LETTER_FIELDS = {
  lamaran: [
    { key: 'nama', label: 'Nama lengkap pelamar', required: true },
    { key: 'alamat', label: 'Alamat', type: 'textarea' },
    { key: 'telepon', label: 'Telepon / WhatsApp' },
    { key: 'email', label: 'Email' },
    { key: 'posisi', label: 'Posisi yang dilamar', required: true },
    { key: 'perusahaan', label: 'Nama perusahaan', required: true },
    { key: 'penerima', label: 'Ditujukan kepada (opsional)', hint: 'Contoh: Bapak Andi, HRD. Kosongkan untuk “Bagian HRD”.' },
    { key: 'alamatPerusahaan', label: 'Alamat perusahaan (opsional)', type: 'textarea' },
    { key: 'sumber', label: 'Sumber lowongan (opsional)', hint: 'Contoh: situs lowongan, Instagram, referensi teman.' },
    { key: 'kualifikasi', label: 'Ringkasan kualifikasi', type: 'textarea', hint: 'Satu atau dua kalimat tentang pengalaman yang relevan.' },
    { key: 'motivasi', label: 'Alasan tertarik (opsional)', type: 'textarea' },
    { key: 'lampiran', label: 'Lampiran (satu per baris)', type: 'textarea', hint: 'Contoh: CV, fotokopi ijazah, sertifikat.' },
  ],
  kuasa: [
    { key: 'pemberiNama', label: 'Pemberi kuasa: nama', required: true },
    { key: 'pemberiAlamat', label: 'Pemberi kuasa: alamat', type: 'textarea', required: true },
    { key: 'pemberiNik', label: 'Pemberi kuasa: NIK (opsional)' },
    { key: 'penerimaNama', label: 'Penerima kuasa: nama', required: true },
    { key: 'penerimaAlamat', label: 'Penerima kuasa: alamat', type: 'textarea', required: true },
    { key: 'penerimaNik', label: 'Penerima kuasa: NIK (opsional)' },
    { key: 'keperluan', label: 'Untuk keperluan', type: 'textarea', required: true, hint: 'Contoh: mengambil dokumen di kantor kelurahan atas nama saya.' },
    { key: 'masaBerlaku', label: 'Masa berlaku (opsional)', hint: 'Contoh: 30 hari sejak surat ini dibuat.' },
  ],
  pernyataan: [
    { key: 'nama', label: 'Nama lengkap', required: true },
    { key: 'nik', label: 'NIK (opsional)' },
    { key: 'alamat', label: 'Alamat', type: 'textarea', required: true },
    { key: 'pernyataan', label: 'Isi pernyataan (satu poin per baris)', type: 'textarea', required: true, hint: 'Contoh: Data yang saya isikan adalah benar.' },
  ],
  undangan: [
    { key: 'acara', label: 'Nama acara atau rapat', required: true },
    { key: 'hari', label: 'Hari dan tanggal', required: true, hint: 'Contoh: Senin, 19 Oktober 2026' },
    { key: 'waktu', label: 'Waktu', hint: 'Contoh: 09.00 – 11.00 WIB' },
    { key: 'tempat', label: 'Tempat', required: true },
    { key: 'agenda', label: 'Agenda (satu per baris)', type: 'textarea' },
    { key: 'penerima', label: 'Ditujukan kepada', required: true, hint: 'Contoh: Seluruh anggota pengurus RT 03.' },
    { key: 'kontakKonfirmasi', label: 'Kontak konfirmasi kehadiran', hint: 'Nomor telepon atau email.' },
    { key: 'penyelenggara', label: 'Nama penyelenggara', required: true },
    { key: 'jabatanPenyelenggara', label: 'Jabatan penyelenggara (opsional)' },
  ],
};

/** Bidang umum (kota, tanggal) tampil di semua template. */
export const COMMON_FIELDS = [
  { key: 'kota', label: 'Kota', required: true },
  { key: 'tanggal', label: 'Tanggal surat', type: 'date', required: true },
];

export function requiredFieldsFor(templateId) {
  return [...COMMON_FIELDS, ...(LETTER_FIELDS[templateId] || [])].filter((field) => field.required);
}

/** Membuat dokumen surat. Mengembalikan errors bila data wajib belum lengkap. */
export function buildLetter(templateId, rawValues = {}) {
  const v = { ...emptyLetterValues(), ...rawValues };
  const template = LETTER_TEMPLATES.find((item) => item.id === templateId) || LETTER_TEMPLATES[0];
  const errors = [];
  for (const field of requiredFieldsFor(template.id)) {
    if (!clean(v[field.key])) errors.push(`${field.label} belum diisi.`);
  }
  if (v.tanggal && !isValidIsoDate(v.tanggal)) errors.push('Tanggal surat belum valid.');
  if (template.id === 'lamaran' && !clean(v.telepon) && !clean(v.email)) errors.push('Isi telepon atau email agar HRD bisa menghubungi.');
  if (template.id === 'pernyataan' && lines(v.pernyataan).length === 0) errors.push('Isi minimal satu poin pernyataan.');
  if (errors.length) return { errors, doc: null };

  const tanggal = formatDateId(v.tanggal);
  const place = `${clean(v.kota)}, ${tanggal}`;
  const base = { templateId: template.id, judul: '', kota: clean(v.kota), tanggal, tempatTanggal: place, pembuka: [], paragraphs: [], penutup: '', tandaTangan: [], lampiran: [], catatan: [] };

  if (template.id === 'lamaran') {
    const penerima = clean(v.penerima) || 'Bagian Human Resources (HRD)';
    const kontak = [clean(v.telepon) && `Telepon: ${clean(v.telepon)}`, clean(v.email) && `Email: ${clean(v.email)}`].filter(Boolean);
    const sumber = clean(v.sumber) ? `melalui ${clean(v.sumber)}` : 'dari informasi yang saya peroleh';
    Object.assign(base, {
      pembuka: [
        place,
        `Hal: Lamaran pekerjaan sebagai ${clean(v.posisi)}`,
        ['Kepada Yth.', penerima, clean(v.perusahaan), clean(v.alamatPerusahaan)].filter(Boolean).join('\n'),
        'Dengan hormat,',
      ],
      paragraphs: [
        [
          'Saya yang bertanda tangan di bawah ini:',
          `Nama: ${clean(v.nama)}`,
          clean(v.alamat) && `Alamat: ${clean(v.alamat)}`,
          ...kontak,
        ].filter(Boolean).join('\n'),
        `Saya mengetahui adanya kesempatan untuk posisi ${clean(v.posisi)} di ${clean(v.perusahaan)} ${sumber}. Dengan surat ini saya mengajukan lamaran untuk posisi tersebut.`,
        clean(v.kualifikasi) && clean(v.kualifikasi),
        clean(v.motivasi) && clean(v.motivasi),
      ].filter(Boolean),
      penutup: 'Demikian surat lamaran ini saya sampaikan. Terima kasih atas perhatian dan kesempatan yang diberikan. Saya siap mengikuti proses seleksi lebih lanjut dan dapat dihubungi melalui kontak di atas.',
      tandaTangan: [{ label: 'Hormat saya,', nama: clean(v.nama) }],
      lampiran: lines(v.lampiran),
    });
  } else if (template.id === 'kuasa') {
    Object.assign(base, {
      judul: 'SURAT KUASA',
      pembuka: [],
      paragraphs: [
        ['Yang bertanda tangan di bawah ini:', `Nama: ${clean(v.pemberiNama)}`, `Alamat: ${clean(v.pemberiAlamat)}`, clean(v.pemberiNik) && `NIK: ${clean(v.pemberiNik)}`].filter(Boolean).join('\n'),
        'selanjutnya disebut sebagai Pemberi Kuasa.',
        ['Dengan ini memberikan kuasa kepada:', `Nama: ${clean(v.penerimaNama)}`, `Alamat: ${clean(v.penerimaAlamat)}`, clean(v.penerimaNik) && `NIK: ${clean(v.penerimaNik)}`].filter(Boolean).join('\n'),
        'selanjutnya disebut sebagai Penerima Kuasa.',
        `Untuk keperluan: ${clean(v.keperluan)}.`,
        `Kuasa ini berlaku ${clean(v.masaBerlaku) || 'sampai keperluan di atas selesai'}.`,
      ],
      penutup: 'Demikian surat kuasa ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.',
      tandaTangan: [
        { label: 'Penerima kuasa', nama: clean(v.penerimaNama) },
        { label: 'Pemberi kuasa', nama: clean(v.pemberiNama) },
      ],
      catatan: ['Bubuhkan meterai dan tanda tangan asli bila diminta penerima dokumen. Ikuti ketentuan instansi tujuan.'],
    });
  } else if (template.id === 'pernyataan') {
    const points = lines(v.pernyataan).map((line, index) => `${index + 1}. ${line}`);
    const closing = v.tanggungJawab ? ['Apabila di kemudian hari pernyataan ini tidak benar, saya bersedia menanggung akibat yang timbul sesuai ketentuan yang berlaku.'] : [];
    Object.assign(base, {
      judul: 'SURAT PERNYATAAN',
      pembuka: [],
      paragraphs: [
        ['Yang bertanda tangan di bawah ini:', `Nama: ${clean(v.nama)}`, clean(v.nik) && `NIK: ${clean(v.nik)}`, `Alamat: ${clean(v.alamat)}`].filter(Boolean).join('\n'),
        'Dengan ini menyatakan dengan sebenarnya bahwa:',
        points.join('\n'),
        ...closing,
      ],
      penutup: 'Demikian surat pernyataan ini saya buat dengan sebenarnya.',
      tandaTangan: [{ label: 'Yang menyatakan', nama: clean(v.nama) }],
    });
  } else {
    const agenda = lines(v.agenda).map((item, index) => `${index + 1}. ${item}`);
    Object.assign(base, {
      judul: 'SURAT UNDANGAN',
      pembuka: [['Kepada Yth.', clean(v.penerima)].join('\n'), 'Dengan hormat,'],
      paragraphs: [
        `Kami mengundang Bapak/Ibu/Saudara/i untuk menghadiri ${clean(v.acara)} yang akan diselenggarakan dengan rincian sebagai berikut:`,
        [
          `Hari/tanggal: ${clean(v.hari)}`,
          clean(v.waktu) && `Waktu: ${clean(v.waktu)}`,
          `Tempat: ${clean(v.tempat)}`,
          agenda.length ? `Agenda:\n${agenda.join('\n')}` : '',
        ].filter(Boolean).join('\n'),
        clean(v.kontakKonfirmasi) ? `Mohon konfirmasi kehadiran melalui ${clean(v.kontakKonfirmasi)}.` : 'Mohon konfirmasi kehadiran Bapak/Ibu/Saudara/i kepada panitia.',
      ],
      penutup: 'Atas perhatian dan kehadirannya, kami ucapkan terima kasih.',
      tandaTangan: [{ label: 'Hormat kami,', nama: clean(v.penyelenggara), jabatan: clean(v.jabatanPenyelenggara) }],
    });
  }

  return { errors: [], doc: base };
}

/** Teks polos surat, siap ditempel atau disalin. */
export function letterPlainText(doc) {
  const parts = [];
  if (doc.judul) parts.push(doc.judul, '');
  if (doc.pembuka.length) parts.push(...doc.pembuka, '');
  parts.push(...doc.paragraphs.flatMap((paragraph) => [paragraph, '']));
  if (doc.penutup) parts.push(doc.penutup, '');
  // Surat selain lamaran mencantumkan kota dan tanggal tepat sebelum tanda tangan.
  if (doc.templateId !== 'lamaran' && doc.tempatTanggal) parts.push(doc.tempatTanggal, '');
  for (const signer of doc.tandaTangan) {
    parts.push(signer.label, '', '', signer.nama || '(nama)', signer.jabatan || '', '');
  }
  if (doc.lampiran.length) parts.push('Lampiran:', ...doc.lampiran.map((item) => `- ${item}`));
  return `${parts.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

/** Memastikan tidak ada placeholder kurung kurawal yang lolos ke dokumen. */
export function hasLeftoverPlaceholder(doc) {
  return /\{[a-zA-Z]+\}/.test(letterPlainText(doc));
}

/** Isi awal surat lamaran dari data CV yang tersimpan di perangkat (hanya dibaca, tidak diubah). */
export function letterValuesFromCv(cv) {
  if (!cv || typeof cv !== 'object') return {};
  const firstExperience = (cv.pengalaman || []).find((row) => row.posisi) || {};
  return {
    nama: clean(cv.nama),
    email: clean(cv.email),
    telepon: clean(cv.telepon),
    posisi: clean(cv.judulTarget || firstExperience.posisi),
    kualifikasi: clean(cv.ringkasan, 300),
    pemberiNama: clean(cv.nama),
    kota: clean(cv.kota),
  };
}

/**
 * DOCX surat: paragraf biasa, judul tebal, tanpa tabel. Memakai paket docx yang sudah ada di proyek.
 * @returns {Promise<Blob>}
 */
export async function createLetterDocxBlob(doc) {
  const { AlignmentType, Document, Packer, Paragraph, TextRun } = await import('docx');
  const children = [];
  const pushBlock = (block, options = {}) => {
    for (const line of String(block).split('\n')) {
      children.push(new Paragraph({
        alignment: options.align || AlignmentType.LEFT,
        spacing: { after: options.after ?? 120, line: 300 },
        children: [new TextRun({ text: line, bold: options.bold, size: 22, color: '111111' })],
      }));
    }
  };
  if (doc.judul) pushBlock(doc.judul, { align: AlignmentType.CENTER, bold: true, after: 240 });
  for (const block of doc.pembuka) pushBlock(block);
  for (const paragraph of doc.paragraphs) pushBlock(paragraph);
  if (doc.penutup) pushBlock(doc.penutup, { after: 240 });
  if (doc.templateId !== 'lamaran' && doc.tempatTanggal) pushBlock(doc.tempatTanggal);
  for (const signer of doc.tandaTangan) {
    pushBlock(signer.label, { after: 600 });
    pushBlock(signer.nama || '(nama)', { bold: true, after: signer.jabatan ? 40 : 240 });
    if (signer.jabatan) pushBlock(signer.jabatan, { after: 240 });
  }
  if (doc.lampiran.length) {
    pushBlock('Lampiran:', { bold: true, after: 60 });
    for (const item of doc.lampiran) pushBlock(`- ${item}`, { after: 40 });
  }
  const document = new Document({
    creator: 'Nawa Editor — dibuat di perangkat pengguna',
    title: doc.judul || 'Surat',
    description: 'Surat dibuat dengan Nawa Editor. Periksa kembali sebelum dikirim.',
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
      children,
    }],
  });
  const buffer = await Packer.toBlob(document);
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
