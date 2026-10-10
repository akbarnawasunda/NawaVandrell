/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Binari yt-dlp dan FFmpeg hanya diakses via path string (bukan require/import statis),
    // jadi NFT tracing Next tidak menemukannya sendiri. Keduanya harus didaftarkan eksplisit
    // agar ikut ter-bundle ke serverless function /api/ytdlp.
    // Berkasnya disiapkan saat prebuild oleh `scripts/setup-ytdlp.mjs` (bin/yt-dlp) dan
    // `scripts/setup-ffmpeg.mjs` (bin/ffmpeg, binari statis dari @ffmpeg-installer).
    // Verifikasi hasil trace: `npm run build` lalu periksa .next/server/app/api/ytdlp/route.js.nft.json.
    outputFileTracingIncludes: {
      '/api/ytdlp': ['./bin/yt-dlp', './bin/ffmpeg'],
    },
  },
};

module.exports = nextConfig;
