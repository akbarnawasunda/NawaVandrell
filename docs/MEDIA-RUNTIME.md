# Mesin Unduh Media (yt-dlp + FFmpeg) — catatan operasional

Nawa Editor bukan produk resmi atau afiliasi PLN.

## 1. Akar masalah pesan "FFmpeg belum tersedia untuk membuat aset media."

Dibuktikan dengan request nyata ke build baseline (HEAD `bda1ff9`):

| Kasus | Hasil baseline | Akar masalah |
|---|---|---|
| Lagu biasa (stream dari browser), FFmpeg tidak ada | HTTP 400 `FFmpeg belum tersedia untuk membuat aset media.` | Jalur stream selalu masuk ke `ensureDemoMediaAssets`, bukan konversi langsung. Pesan demo muncul untuk unduhan biasa. |
| Lagu biasa, FFmpeg ada | HTTP 200, berkas **sintetis** (artis/judul demo, bukan lagu yang dipilih) | Stream browser tidak dipakai; mesin demo menggantikannya diam-diam. |
| URL YouTube nyata, FFmpeg ada | HTTP 200, berkas **sintetis** "Nawa Studio" | Fallback demo untuk URL nyata (silent fallback). |
| Status | `ffmpeg: undefined` | Paket melempar string, bukan `Error`, sehingga diagnosis kosong. |
| Packaging | NFT `/api/ytdlp` hanya memuat `bin/yt-dlp` (0 entri ffmpeg) | FFmpeg tidak pernah di-trace ke function. |

Perbaikan yang sudah diterapkan:
- Stream browser dikonversi langsung (`convertBrowserStreams`). Pratinjau 30 detik diberi label `(Preview 30 detik)`.
- Jalur demo hanya untuk `demo:*` eksplisit. URL nyata tidak pernah diganti media sintetis.
- Non-demo tanpa stream: yt-dlp langsung dengan `--ffmpeg-location`. Kegagalan menjadi galat nyata.
- `customFile` dari klien dibuang (`sanitizeTracksMeta`). Klien tidak bisa menunjuk berkas lokal server.

## 2. Binari FFmpeg di function

Resolusi (`ffmpegCandidates`, urut prioritas):
1. `FFMPEG_PATH` (env, untuk operator)
2. `bin/ffmpeg` di akar proyek (hasil `npm run setup:ffmpeg`, di-trace ke `/api/ytdlp` lewat `outputFileTracingIncludes`)
3. `@ffmpeg-installer/linux-x64` di `node_modules`
4. `PATH`, `/usr/bin`, `/usr/local/bin`

Setiap kandidat diverifikasi (`probeFfmpegBinary`): bisa dieksekusi, `-version` terbaca, encoder wajib `libmp3lame` dan `aac` tersedia.

Catatan penting yang ditemukan saat pengujian:
- Bundel Next membekukan `import.meta.url` ke path **build** (mis. `/vercel/path0`). Karena itu akar proyek dan pencarian installer memakai `process.cwd()` lebih dulu (di Vercel = `/var/task`). Tanpa ini, binari di `bin/` ter-trace tidak terlihat saat runtime.
- Trace manifest bukan bukti binari tersedia. Bukti yang dipakai: simulasi function (lihat bagian 5).
- ffprobe **tidak dibutuhkan**. Semua tes integrasi (MP3/MP4/ZIP) lulus tanpa ffprobe, sehingga ffprobe (79 MB) tidak di-trace. Diagnosis tetap melaporkannya sebagai informasi.

Ukuran function `/api/ytdlp` (NFT lokal): `bin/ffmpeg` 68,2 MB + `bin/yt-dlp` 3,1 MB (build pip di sandbox) ≈ 72 MB tidak terkompresi. Batas Vercel 250 MB. Di Vercel, `yt-dlp` statis resmi berukuran lebih besar (perkiraan ~35 MB); total masih di bawah batas, tetapi ini belum diuji di Vercel.

## 3. Status dan galat

`GET /api/ytdlp?action=status` mengembalikan `runtime` dengan:
- `ready`, `ytdlpVersion`, `ytdlpSource`
- `ffmpegAvailable`, `ffmpegVersion`, `ffmpegSource`, `ffmpegDir`, `ffmpegEncoders`
- `ffprobeAvailable` (opsional)
- `downloadEnabled` = `ready && ffmpegAvailable`
- `diagnosis[]` berisi `{id, level, message, action}` untuk runtime, ytdlp, ffmpeg, ffprobe, download
- `diagnostics` berisi kandidat yang sudah dicoba beserta hasilnya

Unduhan saat FFmpeg/yt-dlp tidak siap: HTTP 503 dengan `code: FFMPEG_UNAVAILABLE` atau `YTDLP_UNAVAILABLE` dan `diagnosis`. UI menonaktifkan tombol unduh dan menampilkan alasan dari `diagnosis`.

Galat jaringan keluar (TLS/DNS/timeout) menjadi HTTP 502 dengan `networkRestricted: true`.

## 4. Spotify

Hanya metadata, tracklist, ekspor, dan pratinjau 30 detik berlabel. Unduhan audio penuh ditolak dengan `SPOTIFY_FULL_AUDIO_UNSUPPORTED` (HTTP 422). Tidak ada bypass DRM. Inspeksi Spotify tidak menampilkan pilihan resolusi video.

## 5. Verifikasi

Perintah:

```bash
npm test                       # unit + integrasi (228 tes)
npm run build                  # prebuild menjalankan setup:ffmpeg
npm run start -- -p 3101 &     # atau server lain
node scripts/smoke-ytdlp-api.mjs --base http://127.0.0.1:3101
```

`smoke-ytdlp-api.mjs` memeriksa: status siap; stream pratinjau → MP3 berlabel; stream video → MP4 H.264; `demo:song` eksplisit → MP3; URL publik → berkas nyata atau galat nyata (bukan demo). Output diverifikasi dengan FFmpeg terpisah (`FFMPEG_BIN` atau paket installer).

Simulasi function (dilakukan): salinan hasil build + `bin/` saja, `@ffmpeg-installer` dan `bin/ffmpeg` repo disembunyikan. Hasil: status `bin/ffmpeg (build)`, smoke 5/5 lulus. Tanpa `bin/ffmpeg`: status `downloadEnabled: false`, unduhan dan demo HTTP 503 `FFMPEG_UNAVAILABLE`, tanpa teks "aset demo".

## 6. Keterbatasan

- Deployment Vercel tidak bisa diuji dari sandbox. Bundling dibuktikan lewat NFT lokal dan simulasi function, bukan deployment nyata.
- Sandbox tidak bisa mengakses YouTube dan situs media publik. Unduhan dari URL publik **tidak diklaim berhasil**; yang diuji hanya galat nyata.
- Binari FFmpeg yang tersedia di sandbox adalah build statis 2018 (N-47683). Ini dipakai untuk memproses media dari sumber tidak tepercaya, sehingga disarankan diganti dengan build statis yang lebih baru dan dirawat.
- yt-dlp di sandbox diambil dari pip (zipapp) karena unduhan statis dari GitHub diblokir. Di build produksi, `setup:ytdlp` mengunduh binari resmi.
- Metadata `unverified` (kerangka hybrid) ditandai di UI. Judul, durasi, dan daftar item belum terverifikasi dari sumber.
