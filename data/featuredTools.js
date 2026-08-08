export const featuredTools = [
  // ================= POPULER =================
  {
    slug: 'downloader',
    title: 'All-In-One Downloader',
    desc: 'Download video & audio dari TikTok, IG, YT, FB, Twitter, Spotify.',
    icon: 'download',
    group: ['populer', 'fun', 'kerja'],
    keywords: 'download downloader tiktok instagram youtube twitter facebook spotify pinterest mp3 mp4',
  },
  {
    slug: 'sticker-maker',
    title: 'Bikin Stiker WA',
    desc: 'Foto jadi stiker WhatsApp 512x512 WebP.',
    icon: 'sticker',
    group: ['populer', 'fun'],
    keywords: 'sticker stiker whatsapp wa webp foto gambar',
  },
  {
    slug: 'text-sticker',
    title: 'Stiker Teks Polos',
    desc: 'Bikin stiker kata-kata ala ".brat" dengan custom font & warna.',
    icon: 'case',
    group: ['populer', 'fun'],
    keywords: 'stiker teks text brat kata kata quote WA sticker',
  },
  {
    slug: 'qr-code',
    title: 'Bikin QR Code',
    desc: 'Ketik teks atau link, langsung jadi QR code.',
    icon: 'qr',
    group: ['populer', 'kerja'],
    keywords: 'qr code barcode scan link wifi generate',
  },
  {
    slug: 'image-compressor',
    title: 'Kompres Foto',
    desc: 'Perkecil ukuran foto tanpa ribet.',
    icon: 'image',
    group: ['populer', 'kerja'],
    keywords: 'kompres compress image foto gambar kecilin ukuran jpeg',
  },
  {
    slug: 'password',
    title: 'Bikin Password',
    desc: 'Password kuat dan acak, aman dipakai.',
    icon: 'lock',
    group: ['populer', 'kerja'],
    keywords: 'password sandi generator kuat acak random aman',
  },
  {
    slug: 'roasting',
    title: 'Mesin Roasting',
    desc: 'Minta di-roasting savage, siap-siap sakit hati.',
    icon: 'flame',
    group: ['populer', 'fun'],
    keywords: 'roasting roast savage nyindir jahat lucu ejek',
  },

  // ================= KERJA =================
  {
    slug: 'json-formatter',
    title: 'Rapikan JSON',
    desc: 'Format, minify, dan cek error JSON.',
    icon: 'json',
    group: ['kerja'],
    keywords: 'json format formatter minify beautify validate pretty',
  },
  {
    slug: 'text-case',
    title: 'Ubah Huruf',
    desc: 'UPPERCASE, lowercase, Title, slug, camelCase.',
    icon: 'case',
    group: ['kerja'],
    keywords: 'text case uppercase lowercase title slug camel snake kapital',
  },
  {
    slug: 'color-picker',
    title: 'Pilih Warna',
    desc: 'Ambil kode HEX, RGB, HSL + palet warna.',
    icon: 'palette',
    group: ['kerja', 'fun'],
    keywords: 'color warna picker hex rgb hsl palette palet',
  },
  {
    slug: 'text-to-image',
    title: 'Teks ke Gambar',
    desc: 'Bikin quote/poster teks jadi PNG estetik.',
    icon: 'poster',
    group: ['fun', 'kerja'],
    keywords: 'text to image canvas quote poster png gambar tulisan',
  },

  // ================= GAMES =================
  {
    slug: 'games',
    title: 'Semua Game Arcade',
    desc: '15 game: kuis, logika, ketik cepat, math rush.',
    icon: 'gamepad',
    group: ['populer', 'fun'],
    keywords: 'game games kuis quiz main tebak asah otak logika',
    href: '/games',
  },
];

export const toolCategories = [
  { id: 'all', label: 'Semua' },
  { id: 'populer', label: 'Populer' },
  { id: 'kerja', label: 'Buat Kerja' },
  { id: 'fun', label: 'Buat Fun' },
];

export function getToolHref(tool) {
  return tool.href || `/tools/${tool.slug}`;
}

export function findTool(slug) {
  return featuredTools.find((t) => t.slug === slug) || null;
}
