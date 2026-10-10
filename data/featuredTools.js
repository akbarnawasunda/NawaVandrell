export const featuredTools = [
  // ================= POPULER =================
  {
    slug: 'downloader',
    title: 'All-In-One Downloader (yt-dlp)',
    desc: 'Download lagu (MP3 320kbps, FLAC, WAV, M4A), full playlist tanpa henti, video 4K/HD, dan subtitle berbasis yt-dlp.',
    icon: 'download',
    group: ['populer', 'fun', 'kerja'],
    keywords: 'download downloader ytdlp yt-dlp playlist full album lagu musik mp3 flac wav m4a opus mp4 mkv 4k subtitle lirik tiktok instagram youtube soundcloud twitter facebook spotify unduh',
    href: '/downloader',
  },
  {
    slug: 'sticker-maker',
    title: 'Bikin Stiker WA',
    desc: 'Foto jadi stiker WhatsApp 512x512 WebP instan.',
    icon: 'sticker',
    group: ['populer', 'fun'],
    keywords: 'sticker stiker whatsapp wa webp foto gambar convert',
  },
  {
    slug: 'text-sticker',
    title: 'Stiker Teks Polos',
    desc: 'Bikin stiker kata-kata ala ".brat", breaking news, struk.',
    icon: 'case',
    group: ['populer', 'fun'],
    keywords: 'stiker teks text brat kata kata quote WA sticker status struk kasir news',
  },
  {
    slug: 'qr-code',
    title: 'Bikin QR Code',
    desc: 'Ketik teks atau link, langsung jadi QR code estetik.',
    icon: 'qr',
    group: ['populer', 'kerja'],
    keywords: 'qr code barcode scan link wifi generate download warna visual',
  },
  {
    slug: 'image-compressor',
    title: 'Kompres Foto',
    desc: 'Perkecil ukuran foto JPG/PNG/WebP tanpa ribet.',
    icon: 'image',
    group: ['populer', 'kerja'],
    keywords: 'kompres compress image foto gambar kecilin ukuran jpeg png webp',
  },
  {
    slug: 'password',
    title: 'Bikin Password',
    desc: 'Password acak dan kuat, aman diproses lokal.',
    icon: 'lock',
    group: ['populer', 'kerja'],
    keywords: 'password sandi generator kuat acak random aman security generator',
  },
  {
    slug: 'wa-direct',
    title: 'WA Direct Chat',
    desc: 'Chat WhatsApp tanpa save nomor, lengkap sama template pesan.',
    icon: 'chat',
    group: ['populer', 'kerja'],
    keywords: 'wa whatsapp chat direct nomor kurir olshop tanpa simpan kontak',
  },
  {
    slug: 'sim-application',
    title: 'Rekap SIM Kolektif',
    desc: 'Unggah banyak KTP, koreksi hasil OCR, lalu susun satu baris per orang dengan foto KTP dan ekspor ke PDF, DOCX, Excel, CSV, atau JSON.',
    icon: 'fingerprint',
    group: ['populer', 'kerja'],
    keywords: 'ktp nik sim kolektif kelompok rekap roster data peserta foto identitas OCR pindai scan pembuatan baru SIM A B C D cetak pdf excel docx',
  },
  {
    slug: 'roasting',
    title: 'Mesin Roasting',
    desc: 'Minta di-roasting savage, siap-siap sakit hati buat seru-seruan.',
    icon: 'flame',
    group: ['populer', 'fun'],
    keywords: 'roasting roast savage nyindir jahat lucu ejek candaan humor',
  },
  {
    slug: 'stego',
    title: 'Anti-Kepo (Steganografi)',
    desc: 'Selundupin pesan rahasia di dalam piksel foto tanpa ketahuan.',
    icon: 'eye',
    group: ['populer', 'fun'],
    keywords: 'steganografi stego rahasia pesan foto piksel anti kepo enkripsi gambar',
  },

  // ================= KERJA / DEVELOPER =================
  {
    slug: 'pengolah-excel',
    title: 'Pengolah Data Excel',
    desc: 'Pisahkan kolom, rapikan nama dan spasi, hapus duplikat, hitung rata-rata atau total per unit, lalu ekspor ke Excel. Data diproses di browser.',
    icon: 'chart',
    group: ['kerja', 'dokumen'],
    keywords: 'excel spreadsheet xlsx xls csv olah data pisahkan kolom split bersihkan rapikan nama pegawai unit ulp kwh rata rata average mean total sum min max rekap operasional laporan tabel duplikat data PLN',
  },
  {
    slug: 'json-formatter',
    title: 'Rapikan JSON',
    desc: 'Format, minify, dan cek posisi error JSON dengan detail.',
    icon: 'json',
    group: ['kerja'],
    keywords: 'json format formatter minify beautify validate pretty lint parser',
  },
  {
    slug: 'text-case',
    title: 'Ubah Huruf',
    desc: 'UPPERCASE, lowercase, Title, slug, camelCase, snake_case.',
    icon: 'case',
    group: ['kerja'],
    keywords: 'text case uppercase lowercase title slug camel snake kebab kapital konversi',
  },
  {
    slug: 'color-picker',
    title: 'Pilih Warna',
    desc: 'Ambil kode HEX, RGB, HSL, RGBA + harmoni palet & cek kontras.',
    icon: 'palette',
    group: ['kerja', 'fun'],
    keywords: 'color warna picker hex rgb hsl palette palet kontras wcag desain',
  },
  {
    slug: 'gradient',
    title: 'Bikin Gradient',
    desc: 'Generator gradasi warna CSS linear/radial & Tailwind CSS.',
    icon: 'sliders',
    group: ['kerja', 'fun'],
    keywords: 'gradient gradasi css tailwind linear radial warna background latar generator',
  },
  {
    slug: 'hash',
    title: 'Bikin Hash',
    desc: 'Hitung hash SHA-1, SHA-256, SHA-384, dan SHA-512 instan.',
    icon: 'hash',
    group: ['kerja'],
    keywords: 'hash sha sha256 sha1 sha512 sha384 crypto enkripsi digest checksum',
  },
  {
    slug: 'base64',
    title: 'Base64 Converter',
    desc: 'Encode & decode teks ke Base64, aman Unicode dan emoji.',
    icon: 'binary',
    group: ['kerja'],
    keywords: 'base64 encode decode btoa atob konversi teks utf8 urlsafe',
  },
  {
    slug: 'uuid',
    title: 'Bikin UUID / GUID',
    desc: 'Generate UUID v4 acak banyak sekaligus dengan custom format.',
    icon: 'fingerprint',
    group: ['kerja'],
    keywords: 'uuid guid v4 generator random id unique identifier pengenal batch',
  },
  {
    slug: 'regex-tester',
    title: 'Tes Regex',
    desc: 'Coba pola regex interaktif dengan visual highlight & replace.',
    icon: 'code',
    group: ['kerja'],
    keywords: 'regex tester regular expression pattern pola cari replace match flags',
  },
  {
    slug: 'lorem-ipsum',
    title: 'Teks Dummy (Lorem)',
    desc: 'Generate teks dummy lorem ipsum per paragraf, kalimat, atau kata.',
    icon: 'fileText',
    group: ['kerja'],
    keywords: 'lorem ipsum dummy text tiruan mockup kata kalimat paragraf placeholder',
  },

  // ================= FUN & CREATIVE =================
  {
    slug: 'text-to-image',
    title: 'Teks ke Gambar',
    desc: 'Bikin quote/poster teks jadi PNG estetik beresolusi tinggi.',
    icon: 'poster',
    group: ['fun', 'kerja'],
    keywords: 'text to image canvas quote poster png gambar tulisan typography estetik',
  },
  {
    slug: 'alay',
    title: 'Teks Alay',
    desc: 'Ubah tulisan biasa jadi 4L4Y maksimal ala chat gaul.',
    icon: 'smile',
    group: ['fun'],
    keywords: 'alay tulisan gaul lebay 4l4y generator ubah teks unik chat',
  },
  {
    slug: 'funfact',
    title: 'Fakta Tanggal Lahir',
    desc: 'Hitung umur hari, zodiak, shio, dan fakta unik hari ultah kamu.',
    icon: 'calendar',
    group: ['fun'],
    keywords: 'funfact tanggal lahir ultah umur zodiak shio hari fakta unik ulang tahun',
  },
  {
    slug: 'random-gallery',
    title: 'Galeri Foto Acak',
    desc: 'Foto cecan Indonesia, anime waifu, dan wallpaper aesthetic.',
    icon: 'camera',
    group: ['fun'],
    keywords: 'galeri foto cecan waifu anime aesthetic wallpaper gambar acak photos',
  },

  // ================= KERJA, UMKM, UANG, BELAJAR, KOMUNITAS, HARIAN =================
  {
    slug: 'hpp-harga',
    title: 'Kalkulator HPP & Harga',
    desc: 'Hitung HPP per produk, harga jual, diskon, laba, dan titik impas usaha kecil.',
    icon: 'calculator',
    group: ['umkm'],
    keywords: 'hpp harga pokok produksi modal margin markup diskon laba titik impas bep umkm usaha jualan dagang produk biaya tetap',
  },

  {
    slug: 'invoice',
    title: 'Invoice, Penawaran & Kuitansi',
    desc: 'Buat invoice, penawaran harga, atau kuitansi dengan total otomatis. Cetak PDF atau unduh Excel.',
    icon: 'receipt',
    group: ['umkm'],
    keywords: 'invoice tagihan penawaran kuitansi nota faktur bon umkm usaha pdf excel ppn diskon terbilang pembeli penjual',
  },

  {
    slug: 'pelacak-lamaran',
    title: 'Pelacak Lamaran Kerja',
    desc: 'Catat lamaran, status, dan tanggal tindak lanjut. Unduh pengingat ke kalender atau CSV.',
    icon: 'briefcase',
    group: ['kerja'],
    keywords: 'lamaran kerja pelacak tracker status wawancara loker lowongan tindak lanjut follow up pengingat hrd karir melamar csv kalender',
  },

  {
    slug: 'kalkulator-gaji',
    title: 'Gaji Bersih, THR & Lembur',
    desc: 'Estimasi take-home pay dengan PPh 21, BPJS, THR, dan lembur. Aturan dan sumbernya ditampilkan.',
    icon: 'wallet',
    group: ['kerja'],
    keywords: 'gaji bersih take home pay thr lembur pph 21 pajak bpjs jht jp jkes ptkp npwp slip gaji tunjangan upah minimum estimasi',
  },

  {
    slug: 'cv-builder',
    title: 'Pembuat CV & Cek ATS',
    desc: 'Susun CV satu kolom yang rapi. Cek kelengkapan dan kata kunci, lalu cetak PDF, unduh DOCX, atau salin teks.',
    icon: 'file',
    group: ['kerja'],
    keywords: 'cv curriculum vitae resume ats cek keterbacaan lamaran kerja pengalaman pendidikan keterampilan pdf docx word kata kunci posisi',
  },

  {
    slug: 'surat-lamaran',
    title: 'Pembuat Surat Lamaran & Resmi',
    desc: 'Surat lamaran kerja dan template surat administrasi: kuasa, pernyataan, dan undangan. Cetak PDF atau unduh DOCX.',
    icon: 'mail',
    group: ['kerja'],
    keywords: 'surat lamaran kerja cover letter surat kuasa surat pernyataan surat undangan rapat administrasi template dokumen docx pdf',
  },

  {
    slug: 'cicilan-tabungan',
    title: 'Cicilan & Target Tabungan',
    desc: 'Hitung angsuran, total bunga, dan setoran tabungan untuk mencapai target. Hasil berupa estimasi.',
    icon: 'chart',
    group: ['uang'],
    keywords: 'cicilan kredit pinjaman angsuran bunga flat anuitas tabungan target setoran bulanan simulasi kpr motor elektronik paylater estimasi',
  },

  {
    slug: 'pembagi-tagihan',
    title: 'Pembagi Tagihan & Patungan',
    desc: 'Bagi tagihan makan, belanja, atau biaya kegiatan kelompok sampai ke rupiah. Lihat siapa harus transfer ke siapa.',
    icon: 'users',
    group: ['uang'],
    keywords: 'pembagi tagihan split bill patungan bagi tagihan makan bareng kelompok kegiatan iuran ppn service charge utang transfer',
  },

  {
    slug: 'flashcard',
    title: 'Flashcard Pengulangan',
    desc: 'Hafalkan materi dengan jadwal ulang otomatis. Kartu yang sulit muncul lebih sering. Tersimpan di perangkat.',
    icon: 'book',
    group: ['belajar'],
    keywords: 'flashcard kartu hafalan hafal belajar spaced repetition ulang jadwal anki kosakata rumus materi ujian sm-2 pengulangan',
  },

  {
    slug: 'fokus',
    title: 'Timer Fokus & Rencana Belajar',
    desc: 'Timer fokus dengan jeda otomatis, catatan waktu belajar, dan rencana belajar dari daftar topik.',
    icon: 'timer',
    group: ['belajar'],
    keywords: 'timer fokus pomodoro belajar rencana belajar jadwal belajar konsentrasi produktivitas istirahat catatan sesi ujian',
  },

  {
    slug: 'daftar-hadir',
    title: 'Daftar Hadir & Sertifikat',
    desc: 'Catat peserta dan kehadiran kegiatan. Ekspor ke Excel atau CSV, lalu cetak sertifikat untuk yang hadir.',
    icon: 'users',
    group: ['komunitas'],
    keywords: 'daftar hadir absensi absen kehadiran peserta roster sertifikat pelatihan kegiatan acara komunitas rt rw karang taruna event tanda tangan excel',
  },

  {
    slug: 'rutinitas',
    title: 'Checklist Rutinitas & Pengingat',
    desc: 'Atur kebiasaan harian, centang langkahnya, lihat streak, dan terima pengingat selama halaman terbuka.',
    icon: 'check',
    group: ['harian'],
    keywords: 'rutinitas checklist kebiasaan harian habit tracker pengingat jadwal streak olahraga minum air ibadah belajar rumah kebiasaan sehat',
  },

  {
    slug: 'papan-tugas',
    title: 'Papan Tugas Harian',
    desc: 'Susun prioritas, tenggat, dan tindak lanjut. Filter pekerjaan selesai, ekspor CSV, dan simpan lokal.',
    icon: 'clipboard',
    group: ['kerja', 'kantor'],
    keywords: 'tugas kerja to-do todo task tracker administrasi kantor BUMN follow up prioritas tenggat deadline harian pekerjaan checklist',
  },

  {
    slug: 'notulen-rapat',
    title: 'Notulen & Tindak Lanjut Rapat',
    desc: 'Catat agenda, keputusan, PIC, dan tenggat tindak lanjut. Cetak notulen atau ekspor aksi ke CSV.',
    icon: '🗒️',
    group: ['kerja', 'kantor', 'dokumen'],
    keywords: 'notulen rapat meeting agenda keputusan action item tindak lanjut pic kantor BUMN administrasi berita acara rapat',
  },

  {
    slug: 'jadwal-shift',
    title: 'Jadwal Shift & Roster Tim',
    desc: 'Buat roster 7 hari dengan rotasi yang merata, tukar penugasan manual, dan unduh jadwal CSV.',
    icon: '🗓️',
    group: ['kerja', 'operasional'],
    keywords: 'jadwal shift roster jadwal kerja karyawan toko ritel minimarket alfamart indomaret operasional piket giliran jadwal tim',
  },

  {
    slug: 'rekap-nilai',
    title: 'Rekap Nilai Kelas',
    desc: 'Kelola daftar siswa, bobot asesmen, nilai akhir berbobot, dan status ketuntasan. Ekspor rekap CSV.',
    icon: '🎓',
    group: ['belajar', 'sekolah'],
    keywords: 'rekap nilai rapor guru sekolah kelas siswa murid nilai akhir asesmen tugas uts uas bobot ketuntasan lulus remedial',
  },

  {
    slug: 'stok-inventaris',
    title: 'Stok & Inventaris',
    desc: 'Catat barang, batas stok minimum, nilai persediaan, dan mutasi masuk/keluar. Ekspor daftar ke CSV.',
    icon: '📦',
    group: ['operasional', 'umkm'],
    keywords: 'stok inventaris inventory persediaan barang gudang stok opname retail toko minimarket sekolah kantor ATK barang masuk keluar',
  },

  {
    slug: 'sensor-data',
    title: 'Sensor Data Sebelum Dibagikan',
    desc: 'Cari dan sensor NIK, NPWP, nomor telepon, dan email di dalam teks sebelum dibagikan. Diproses di perangkat.',
    icon: 'shield',
    group: ['dokumen'],
    keywords: 'sensor redaksi redact sembunyikan data pribadi nik npwp telepon email dokumen privasi bagikan aman masking teks',
  },

  {
    slug: 'latihan-wawancara',
    title: 'Latihan Wawancara',
    desc: 'Latih jawaban wawancara dengan pertanyaan umum, timer dua menit, dan panduan STAR. Tersimpan di perangkat.',
    icon: 'mic',
    group: ['kerja'],
    keywords: 'latihan wawancara interview pertanyaan wawancara kerja jawaban star perkenalan kelemahan kekuatan simulasi karir melamar',
  },

  // ================= GAMES =================
  {
    slug: 'games',
    title: 'Semua Game Arcade & Kuis',
    desc: '16 game seru: kuis pengetahuan, logika, asah otak, susun kata.',
    icon: 'gamepad',
    group: ['populer', 'fun'],
    keywords: 'game games kuis quiz main tebak asah otak logika arcade susun kata math',
    href: '/games',
  },
];

export const toolCategories = [
  { id: 'all', label: 'Semua' },
  { id: 'populer', label: 'Populer' },
  { id: 'kerja', label: 'Buat Kerja' },
  { id: 'kantor', label: 'Kantor' },
  { id: 'operasional', label: 'Operasional' },
  { id: 'sekolah', label: 'Sekolah' },
  { id: 'umkm', label: 'UMKM' },
  { id: 'uang', label: 'Keuangan' },
  { id: 'dokumen', label: 'Dokumen' },
  { id: 'belajar', label: 'Belajar' },
  { id: 'komunitas', label: 'Komunitas' },
  { id: 'harian', label: 'Harian' },
  { id: 'fun', label: 'Buat Fun' },
];



export function getToolHref(tool) {
  if (!tool) return '/';
  if (tool.href) return tool.href;
  if (tool.slug === 'downloader') return '/downloader';
  return `/tools/${tool.slug}`;
}

export function findTool(slug) {
  return featuredTools.find((t) => t.slug === slug) || null;
}
