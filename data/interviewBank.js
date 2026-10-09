/**
 * Bank pertanyaan latihan wawancara (Bahasa Indonesia). Konten statis, tanpa data pribadi.
 * Kategori: perkenalan, motivasi, perilaku (STAR), situasional, dan umum.
 */
export const INTERVIEW_CATEGORIES = [
  { id: 'semua', label: 'Semua' },
  { id: 'perkenalan', label: 'Perkenalan' },
  { id: 'motivasi', label: 'Motivasi' },
  { id: 'perilaku', label: 'Perilaku (STAR)' },
  { id: 'situasional', label: 'Situasional' },
];

export const INTERVIEW_QUESTIONS = [
  { id: 'q-1', kategori: 'perkenalan', tanya: 'Ceritakan tentang diri Anda dalam 1–2 menit.', tip: 'Urutkan: latar belakang singkat, pengalaman paling relevan, lalu alasan melamar posisi ini.' },
  { id: 'q-2', kategori: 'perkenalan', tanya: 'Apa kekuatan utama Anda untuk posisi ini?', tip: 'Pilih 1–2 kekuatan yang relevan dan beri satu contoh nyata.' },
  { id: 'q-3', kategori: 'perkenalan', tanya: 'Apa kelemahan Anda, dan bagaimana Anda mengatasinya?', tip: 'Pilih kelemahan yang nyata tetapi tidak fatal, lalu jelaskan langkah perbaikannya.' },
  { id: 'q-4', kategori: 'motivasi', tanya: 'Mengapa Anda tertarik bekerja di perusahaan kami?', tip: 'Sebutkan hal spesifik yang Anda ketahui tentang perusahaan, bukan pujian umum.' },
  { id: 'q-5', kategori: 'motivasi', tanya: 'Di mana Anda ingin berada dalam tiga sampai lima tahun ke depan?', tip: 'Fokus pada keterampilan yang ingin dikembangkan dan bagaimana posisi ini mendukungnya.' },
  { id: 'q-6', kategori: 'motivasi', tanya: 'Mengapa Anda meninggalkan pekerjaan sebelumnya?', tip: 'Jawab jujur dan singkat. Hindari mengkritik mantan atasan atau perusahaan.' },
  { id: 'q-7', kategori: 'perilaku', tanya: 'Ceritakan saat Anda menghadapi tenggat waktu yang sangat ketat.', tip: 'Gunakan STAR: Situasi, Tugas, Tindakan, Hasil. Sebutkan angka hasil bila ada.' },
  { id: 'q-8', kategori: 'perilaku', tanya: 'Ceritakan saat Anda berbeda pendapat dengan rekan kerja.', tip: 'Tunjukkan cara Anda mendengarkan dan mencapai kesepakatan.' },
  { id: 'q-9', kategori: 'perilaku', tanya: 'Ceritakan saat Anda melakukan kesalahan. Apa yang Anda lakukan?', tip: 'Akui kesalahan, jelaskan perbaikannya, dan apa yang Anda pelajari.' },
  { id: 'q-10', kategori: 'perilaku', tanya: 'Ceritakan pencapaian yang paling Anda banggakan.', tip: 'Ukur hasilnya dengan angka (persentase, jumlah, atau waktu) bila memungkinkan.' },
  { id: 'q-11', kategori: 'perilaku', tanya: 'Ceritakan saat Anda harus belajar keterampilan baru dengan cepat.', tip: 'Jelaskan cara belajar Anda dan bagaimana hasilnya dipakai di pekerjaan.' },
  { id: 'q-12', kategori: 'perilaku', tanya: 'Ceritakan saat Anda membantu rekan yang kesulitan.', tip: 'Fokus pada tindakan Anda dan dampaknya bagi tim.' },
  { id: 'q-13', kategori: 'situasional', tanya: 'Jika atasan meminta pekerjaan yang di luar deskripsi tugas, apa yang Anda lakukan?', tip: 'Tunjukkan keseimbangan: membantu dengan baik, tetapi memastikan prioritas dan kapasitas jelas.' },
  { id: 'q-14', kategori: 'situasional', tanya: 'Bagaimana cara Anda mengatur banyak tugas dengan prioritas yang berbeda?', tip: 'Sebutkan cara Anda menentukan prioritas dan melaporkan kemajuan.' },
  { id: 'q-15', kategori: 'situasional', tanya: 'Apa yang akan Anda lakukan di 30 hari pertama bekerja di sini?', tip: 'Tunjukkan rencana belajar, membangun hubungan, dan target yang realistis.' },
  { id: 'q-16', kategori: 'situasional', tanya: 'Jika pelanggan marah karena layanan yang terlambat, bagaimana Anda menanganinya?', tip: 'Dengarkan, minta maaf dengan tulus, tawarkan solusi, dan tindak lanjuti.' },
  { id: 'q-17', kategori: 'situasional', tanya: 'Bagaimana Anda memastikan kualitas hasil kerja tetap baik saat terburu-buru?', tip: 'Sebutkan langkah pengecekan yang Anda pakai, seperti daftar periksa atau tinjauan rekan.' },
  { id: 'q-18', kategori: 'motivasi', tanya: 'Berapa ekspektasi gaji Anda?', tip: 'Siapkan rentang yang sudah Anda riset dan jelaskan Anda terbuka untuk diskusi.' },
  { id: 'q-19', kategori: 'perilaku', tanya: 'Ceritakan saat Anda harus bekerja dengan target yang tidak Anda setujui sebelumnya.', tip: 'Tunjukkan cara Anda menyampaikan keberatan secara profesional dan tetap berkontribusi.' },
  { id: 'q-20', kategori: 'perkenalan', tanya: 'Apakah ada pertanyaan untuk kami?', tip: 'Siapkan 2–3 pertanyaan tentang tim, tantangan posisi, atau proses kerja.' },
];

export const STAR_STEPS = [
  { id: 'situasi', label: 'Situasi', hint: 'Konteks singkat: di mana dan kapan?' },
  { id: 'tugas', label: 'Tugas', hint: 'Apa tanggung jawab atau target Anda?' },
  { id: 'tindakan', label: 'Tindakan', hint: 'Apa yang Anda lakukan, langkah demi langkah?' },
  { id: 'hasil', label: 'Hasil', hint: 'Apa hasilnya? Sebutkan angka bila ada.' },
];
