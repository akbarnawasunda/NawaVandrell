export const featuredTools = [
  {
    slug: 'downloader',
    title: 'All-In-One Downloader',
    desc: 'Download video & audio dari TikTok, IG, YT, FB, Twitter, Spotify.',
    icon: '📲',
    group: ['populer', 'fun', 'kerja'],
    keywords:
      'download downloader tiktok instagram youtube twitter facebook spotify pinterest mp3 mp4',
  },
  {
    slug: 'qr-code',
    title: 'Bikin QR Code',
    desc: 'Ketik teks atau link, langsung jadi QR code.',
    icon: '📱',
    group: ['populer', 'kerja'],
    keywords: 'qr code barcode scan link wifi generate',
  },
  {
    slug: 'sticker-maker',
    title: 'Bikin Stiker WA',
    desc: 'Foto jadi stiker WhatsApp 512x512 WebP.',
    icon: '🎨',
    group: ['populer', 'fun'],
    keywords: 'sticker stiker whatsapp wa webp foto gambar',
  },
  {
    slug: 'image-compressor',
    title: 'Kompres Foto',
    desc: 'Perkecil ukuran foto tanpa ribet.',
    icon: '🗜️',
    group: ['populer', 'kerja'],
    keywords: 'kompres compress image foto gambar kecilin ukuran jpeg',
  },
  {
    slug: 'password',
    title: 'Bikin Password',
    desc: 'Password kuat dan acak, aman dipakai.',
    icon: '🔐',
    group: ['populer', 'kerja'],
    keywords: 'password sandi generator kuat acak random aman',
  },
  {
    slug: 'json-formatter',
    title: 'Rapikan JSON',
    desc: 'Format, minify, dan cek error JSON.',
    icon: '📋',
    group: ['kerja'],
    keywords: 'json format formatter minify beautify validate pretty',
  },
  {
    slug: 'text-case',
    title: 'Ubah Huruf',
    desc: 'UPPERCASE, lowercase, Title, slug, camelCase.',
    icon: '🔠',
    group: ['kerja'],
    keywords: 'text case uppercase lowercase title slug camel snake kapital',
  },
  {
    slug: 'color-picker',
    title: 'Pilih Warna',
    desc: 'Ambil kode HEX, RGB, HSL + palet warna.',
    icon: '🌈',
    group: ['kerja', 'fun'],
    keywords: 'color warna picker hex rgb hsl palette palet',
  },
  {
    slug: 'text-to-image',
    title: 'Teks ke Gambar',
    desc: 'Bikin quote/poster teks jadi PNG estetik.',
    icon: '🖼️',
    group: ['fun', 'kerja'],
    keywords: 'text to image canvas quote poster png gambar tulisan',
  },
  {
    slug: 'roasting',
    title: 'Mesin Roasting',
    desc: 'Minta di-roasting savage, siap-siap sakit hati.',
    icon: '🔥',
    group: ['populer', 'fun'],
    keywords: 'roasting roast savage nyindir jahat lucu ejek',
  },
  {
    slug: 'games',
    title: 'Semua Game Arcade',
    desc: '15 game: kuis, logika, ketik cepat, math rush.',
    icon: '🎮',
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
