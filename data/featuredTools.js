/**
 * Master tool registry.
 * `group` drives the home chips: populer | kerja | fun
 */
export const featuredTools = [
  {
    slug: 'qr-code',
    title: 'Bikin QR',
    desc: 'Ketik teks atau link, langsung jadi QR code.',
    icon: '📱',
    group: ['populer', 'kerja'],
    keywords: 'qr code barcode scan link wifi generate',
  },
  {
    slug: 'sticker-maker',
    title: 'Bikin Stiker WA',
    desc: 'Foto jadi stiker WhatsApp 512x512.',
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
    slug: 'base64',
    title: 'Base64',
    desc: 'Encode atau decode teks Base64.',
    icon: '🔣',
    group: ['kerja'],
    keywords: 'base64 encode decode encrypt teks unicode emoji',
  },
  {
    slug: 'hash',
    title: 'Bikin Hash',
    desc: 'Hash SHA-1 dan SHA-256 dari teks.',
    icon: '#️⃣',
    group: ['kerja'],
    keywords: 'hash sha1 sha256 sha384 sha512 checksum digest',
  },
  {
    slug: 'text-case',
    title: 'Ubah Huruf',
    desc: 'UPPERCASE, lowercase, Title, slug, dll.',
    icon: '🔠',
    group: ['kerja'],
    keywords: 'text case uppercase lowercase title slug camel snake kapital',
  },
  {
    slug: 'uuid',
    title: 'Bikin UUID',
    desc: 'UUID v4 acak, bisa banyak sekaligus.',
    icon: '🆔',
    group: ['kerja'],
    keywords: 'uuid guid v4 id unique random identifier',
  },
  {
    slug: 'regex-tester',
    title: 'Tes Regex',
    desc: 'Coba pola regex, lihat semua match.',
    icon: '🔍',
    group: ['kerja'],
    keywords: 'regex regexp pattern match test replace pola',
  },
  {
    slug: 'lorem-ipsum',
    title: 'Teks Dummy',
    desc: 'Lorem ipsum buat isi desain.',
    icon: '📄',
    group: ['kerja'],
    keywords: 'lorem ipsum dummy placeholder teks paragraf filler',
  },
  {
    slug: 'color-picker',
    title: 'Pilih Warna',
    desc: 'Ambil kode HEX, RGB, HSL + palet.',
    icon: '🌈',
    group: ['kerja', 'fun'],
    keywords: 'color warna picker hex rgb hsl palette palet',
  },
  {
    slug: 'gradient',
    title: 'Bikin Gradient',
    desc: 'Gradient CSS siap copy-paste.',
    icon: '🎚️',
    group: ['kerja', 'fun'],
    keywords: 'gradient css linear radial warna background generator',
  },
  {
    slug: 'text-to-image',
    title: 'Teks ke Gambar',
    desc: 'Bikin quote/poster teks jadi PNG.',
    icon: '🖼️',
    group: ['fun', 'kerja'],
    keywords: 'text to image canvas quote poster png gambar tulisan',
  },
  {
    slug: 'alay',
    title: 'Teks Alay',
    desc: 'Ubah tulisan biasa jadi 4L4Y.',
    icon: '🤪',
    group: ['populer', 'fun'],
    keywords: 'alay 4l4y teks tulisan lebay generator norak',
  },
  {
    slug: 'roasting',
    title: 'Mesin Roasting',
    desc: 'Minta di-roasting savage, siap-siap sakit.',
    icon: '🔥',
    group: ['populer', 'fun'],
    keywords: 'roasting roast savage nyindir jahat lucu ejek',
  },
  {
    slug: 'funfact',
    title: 'Fakta Tanggal Lahir',
    desc: 'Fakta unik dari tanggal lahir kamu.',
    icon: '🎂',
    group: ['fun'],
    keywords: 'funfact fakta unik tanggal lahir zodiak ulang tahun umur',
  },
  {
    slug: 'random-gallery',
    title: 'Galeri Acak',
    desc: 'Cecan, waifu anime, wallpaper aesthetic.',
    icon: '📸',
    group: ['fun'],
    keywords: 'random cecan waifu anime wallpaper aesthetic foto galeri acak',
  },
  {
    slug: 'tiktok-downloader',
    title: 'Download TikTok',
    desc: 'Ambil video TikTok tanpa watermark.',
    icon: '🎵',
    group: ['populer', 'fun'],
    keywords: 'tiktok download downloader video nowatermark tt save',
  },
  {
    slug: 'youtube-downloader',
    title: 'Download YouTube',
    desc: 'Download video MP4 & convert MP3 YouTube.',
    icon: '▶️',
    group: ['populer', 'fun', 'kerja'],
    keywords: 'youtube yt download mp3 mp4 video lagu musik convert',
  },
  {
    slug: 'social-downloader',
    title: 'Download Sosmed',
    desc: 'Download video & foto dari IG, Twitter, FB, Pinterest, Reddit.',
    icon: '📲',
    group: ['populer', 'fun', 'kerja'],
    keywords: 'instagram ig twitter x facebook fb pinterest reddit reel story download',
  },
  {
    slug: 'games',
    title: 'Semua Game',
    desc: '15 game: kuis, logika, ketik cepat.',
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
