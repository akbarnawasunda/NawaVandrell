/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Binari yt-dlp hanya diakses via path string (bukan require/import statis),
    // jadi harus didaftarkan eksplisit agar ikut ter-bundle ke serverless function.
    // Berkasnya disiapkan saat build oleh `scripts/setup-ytdlp.mjs` ke `bin/yt-dlp`.
    outputFileTracingIncludes: {
      '/api/ytdlp': ['./bin/yt-dlp'],
    },
  },
};

module.exports = nextConfig;
