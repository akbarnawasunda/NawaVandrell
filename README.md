# Nawa Vandrell

Nawa Vandrell menyatukan tools kerja dan harian, alat usaha kecil, pengelola keuangan pribadi, ruang belajar, workflow rekap SIM kolektif, dan game ringan dalam satu website. Aplikasi dibangun dengan Next.js dan bisa dijalankan tanpa layanan database wajib. Beberapa fitur integrasi online memerlukan konfigurasi API opsional.

Website memakai satu tampilan konsisten yang dirancang agar ringkas, jelas, dan nyaman digunakan di desktop maupun ponsel.

---

## Jalanin di lokal

```bash
npm install
cp .env.example .env.local   # set ADMIN_PIN + ADMIN_SESSION_SECRET yang kuat
npm run dev                  # http://localhost:3000
```

Semua tool dan game publik jalan tanpa `.env`. Area admin hanya aktif bila secret kuat dikonfigurasi; TikTok Downloader dan beberapa integrasi online dapat memerlukan `UPSTREAM_API_BASE`.

---

## Deploy ke Vercel

1. **Push ke GitHub**
   ```bash
   git init && git add . && git commit -m "Nawa Vandrell"
   git branch -M main
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
2. **Import ke Vercel** — buka [vercel.com/new](https://vercel.com/new), pilih repo-nya.
   Framework kedeteksi otomatis (Next.js), biarkan setelan default.
3. **Set Environment Variables** (Project Settings → Environment Variables):

   | Nama | Wajib | Isi |
   |---|---|---|
   | `ADMIN_PIN` | ya | Kunci login acak minimal 16 karakter; contoh `openssl rand -hex 16` |
   | `ADMIN_SESSION_SECRET` | ya | Kunci HMAC acak minimal 32 karakter, berbeda dari PIN; `openssl rand -hex 32` |
   | `ADMIN_API_TOKEN` | tidak | Bearer rahasia untuk otomasi server; jangan pernah taruh di browser |
   | `KV_REST_API_URL` | tidak | URL Upstash/Vercel KV untuk leaderboard dan rate limit lintas instance |
   | `KV_REST_API_TOKEN` | tidak | Token KV pasangannya |
   | `UPSTREAM_API_BASE` | tidak | hanya untuk TikTok Downloader & waifu |

4. **Deploy.** Selesai.

> Tanpa `ADMIN_PIN` dan `ADMIN_SESSION_SECRET` yang cukup kuat, fitur publik tetap jalan,
> sedangkan `/admin` dan `/admin/login` sengaja membalas 404 dan tidak menyediakan akses admin.

### Leaderboard permanen (opsional)

Vercel → **Storage → KV → Create Database → Connect Project**. `KV_REST_API_URL` dan
`KV_REST_API_TOKEN` terisi otomatis, `lib/db.js` langsung pindah driver tanpa ubah kode.

Kalau KV tidak ada, urutan fallback-nya:
`Vercel KV` → `/tmp/leaderboard.json` → `data/leaderboard.json` (seed) → memori.
Di Vercel, `/tmp` hidup selama instance masih hangat — cukup untuk main-main, tapi
buat skor yang beneran awet pakai KV.

---

## Struktur

```
app/
  layout.js            root: font, shared shell, toast, service worker
  page.js              beranda: pintasan, SIM kolektif, peringkat, katalog
  globals.css          sistem desain responsif, satu tema konsisten
  tools/<slug>/page.js 23 tool
  games/page.js        indeks + filter
  games/<slug>/page.js 8 kuis + 7 arcade
  leaderboard/page.js  top 20
  admin/page.js        PIN → stats, edit skor, quiz manager
  api/
    leaderboard/       GET publik, POST bertingkat
    quiz/              soal, check, reveal
    admin/             verify, stats, player  (Bearer)
    tool-proxy/        alay, roasting, funfact, lorem, waifu, tiktok
components/            ToolShell, GameShell, QuizEngine, ConfirmModal, ...
context/               ToastContext
hooks/                 useSound, useStreak, usePlayer
lib/                   db.js, auth.js, quiz.js, funTools.js
data/                  featuredTools, quizDatabase, arcadeData, nexrayData
public/                manifest.json, sw.js, icon.svg
```

---

## Isi

**Tools (37).** Yang sudah ada: All-In-One Downloader · Stiker WhatsApp · Stiker Teks · QR Code ·
Kompres Foto · Password Generator · WA Direct Chat · Rekap SIM Kolektif · Mesin Roasting ·
Steganografi · JSON Formatter · Text Case · Color Picker · Gradient Generator · Hash Lab ·
Base64 · UUID · Regex Tester · Lorem Ipsum · Text to Image · Teks Alay · Funfact Tanggal Lahir ·
Galeri Acak.

Yang baru, dikelompokkan per kebutuhan:

- **Kerja dan karier:** Pembuat CV & Cek ATS (heuristik, bukan jaminan lolos) · Pelacak Lamaran Kerja
  (status, tindak lanjut, ekspor `.ics`) · Pembuat Surat Lamaran & Resmi · Gaji Bersih, THR & Lembur
  (estimasi PPh 21, BPJS, THR, lembur; aturan dan sumber ditampilkan) · Latihan Wawancara.
- **UMKM:** Kalkulator HPP & Harga (margin, markup, diskon, titik impas) · Invoice, Penawaran & Kuitansi
  (PDF lewat dialog cetak, Excel, terbilang).
- **Keuangan:** Cicilan & Target Tabungan (anuitas dan flat) · Pembagi Tagihan & Patungan.
- **Dokumen:** Sensor Data Sebelum Dibagikan (NIK, NPWP, telepon, email di dalam teks).
- **Belajar:** Flashcard Pengulangan (jadwal SM-2) · Timer Fokus & Rencana Belajar.
- **Komunitas:** Daftar Hadir & Sertifikat (ekspor roster Excel/CSV dan cetak sertifikat).
- **Harian:** Checklist Rutinitas & Pengingat.

**Game (15).** Tebak-tebakan · Teka-teki · Siapakah Aku · Susun Kata · Tebak Kimia ·
Asah Otak · Tebak Lirik · Islamic Quiz · Logic Gate Puzzle · Angka Enigma ·
Kata Sambung · Emoji Story · Memory Matrix · Typing Blitz · Math Rush

Semua betulan jalan — bukan mockup. Alat baru diuji dengan tes unit (`npm test`) dan dijalankan di Chromium headless untuk alur utamanya. OCR KTP untuk berkas persiapan SIM berjalan di browser, QR pakai canvas asli lalu diunduh PNG, hash pakai
`crypto.subtle`, password pakai `crypto.getRandomValues`, sticker keluar `.webp` 512×512
siap impor WhatsApp, suara game dibangkitkan WebAudio (tanpa file audio).

---

## Data lokal, cadangan, dan privasi

- Alat yang menyimpan data (CV, pelacak lamaran, invoice, flashcard, rutinitas, daftar hadir, latihan wawancara,
  catatan sesi fokus) menyimpan **di browser ini** (`localStorage`, kunci `nawa:v1:*`). Tidak ada akun dan tidak ada
  pengiriman ke server atau layanan AI.
- Setiap koleksi punya **Ekspor cadangan (JSON)**, **Impor** (gabung atau ganti, dengan validasi), dan **Hapus semua data**. Hapus semua data juga menghapus penanda pengingat dan status timer milik fitur itu.
  Data yang rusak tidak ditimpa diam-diam.
- Alat yang tidak menyimpan apa pun: Kalkulator HPP, Gaji, Cicilan, Pembagi Tagihan, Sensor Data, dan Surat
  (unduh atau cetak sebelum menutup halaman).
- Pengingat (pelacak lamaran, rutinitas, timer fokus) hanya berjalan selama halaman terbuka. Untuk pengingat yang tetap
  muncul, unduh berkas kalender `.ics` atau gunakan alarm di HP.
- Hasil hitung gaji, pajak, dan BPJS adalah **estimasi**. Aturan dan sumbernya tampil di halaman; periksa ulang sebelum dipakai untuk keputusan.

---

## OCR KTP dan rekap SIM kolektif

Tool **Rekap SIM Kolektif** menerima banyak foto KTP sekaligus, membaca saran nama/NIK/data KTP
dengan Tesseract.js di browser, lalu membuat tabel yang dapat dikoreksi dengan kolom utama
**No, NAMA, SIM, KETERANGAN, FOTO KTP**. File mesin OCR disalin dari dependensi npm ke
`public/ocr/` oleh `predev` / `prebuild`; folder hasil generasi ini sengaja tidak masuk Git.
Foto dan data KTP diproses di perangkat pengguna dan tidak dikirim ke API. Simpan otomatis draf bersifat opsional: setelah diaktifkan, data tersimpan di IndexedDB browser ini dan kedaluwarsa setelah tujuh hari; pengguna dapat menghapusnya kapan saja. Mode cermat menggabungkan pembacaan foto asli, peningkatan kontras, dan pembersihan tambahan bila data inti belum terbaca; mode cepat tersedia untuk batch besar. Setiap foto bisa digeser, di-zoom, dan diatur utuh atau isi bingkai—hasil posisi tersimpan pada pratinjau serta ekspor yang memuat gambar. Daftar bisa dicari dan disaring tanpa mengurangi baris pada ekspor; tersedia juga opsi teks besar dan navigasi keyboard pada editor foto. Periksa dan koreksi semua hasil OCR.

Hasil ekspor adalah **draf rekap pribadi**, bukan SIM, bukti pendaftaran, atau formulir resmi.
Tersedia PDF (dialog cetak browser), DOCX, Excel dengan foto KTP tertanam dan sheet data,
CSV berisi seluruh data KTP, serta JSON yang turut memuat foto terkompres; semua file dibuat
lokal di browser. Syarat dan golongan SIM harus dikonfirmasi lewat kanal resmi/Satpas.

## Ganti ke database soal penuh

`data/quizDatabase.js` di repo ini berisi **240 soal** (8 kategori × 3 level × 10).
Timpa saja dengan `quizDatabase.js` versi penuh kamu, selama bentuknya tetap:

```js
export const quizDatabase = {
  tebaktebakan: {
    easy:   [{ soal: '...', jawaban: '...', alt: ['...'] }],
    medium: [...],
    hard:   [...],
  },
};
```

`alt` opsional. Tidak ada file lain yang perlu disentuh — ID soal dihitung dari posisi
array, jadi API otomatis menyesuaikan.

---

## Bug lama yang diperbaiki

**1. Leaderboard bisa ditimpa siapa saja.** Dulu `POST /api/leaderboard` menerima map
penuh `{nama: skor}` tanpa auth — satu request bisa menghapus semua skor. Sekarang
dipisah: submit satu pemain boleh publik tapi **cuma bisa menaikkan** skornya sendiri,
sedangkan tulis-massal wajib `Bearer ADMIN_API_TOKEN`.

**2. ID soal tidak sinkron.** Dulu ID dibuat acak per request, jadi `/check` dan
`/reveal` sering tidak menemukan soal yang sama (parah di serverless yang statenya
hilang). Sekarang ID deterministik `kategori.level.index`, bisa di-resolve endpoint mana
pun tanpa state server sama sekali.

**3. tool-proxy cuma nangani alay.** Aksi lain balas error membingungkan. Sekarang satu
`switch` menangani alay, roasting, funfact, lorem (lokal) plus waifu dan tiktok (jaringan,
dengan timeout `AbortController`), dan aksi tak dikenal dapat pesan yang jelas.

**5. Proxy unduhan bisa diarahkan ke jaringan internal (SSRF).** Dulu `/api/download-proxy` mengambil URL apa pun
dan mengikuti redirect otomatis. Sekarang hanya http/https ke host publik yang diizinkan, port 80/443, IP privat dan
metadata cloud ditolak, dan setiap redirect diperiksa ulang (`lib/safeUrl.mjs`).

**4. Base64 rusak kena emoji.** `btoa()` mentah melempar error untuk karakter non-Latin1.
Sekarang lewat `TextEncoder` + chunking, jadi emoji dan huruf Jawa pun aman bolak-balik.

---

## Keamanan

- `/admin` merespons 404 tanpa sesi sah; dashboard hanya dirender server setelah validasi cookie.
  Form login berada di `/admin/login` dan tidak ditautkan dari navigasi publik.
- Login memerlukan secret minimal 16 karakter dan memakai perbandingan constant-time.
  Sesi ditandatangani HMAC, berlaku 30 menit, serta disimpan di cookie `HttpOnly`, `Secure`
  (produksi), `SameSite=Strict`; API tidak mengirim token admin ke browser.
- Percobaan login dibatasi 5 kali per 10 menit; KV dipakai untuk hitungan bersama bila tersedia,
  dengan fallback limiter per proses.
- Endpoint admin memerlukan sesi atau Bearer rahasia server; perubahan berbasis cookie
  memeriksa origin untuk mengurangi risiko CSRF.
- `ADMIN_API_TOKEN` hanya opsional untuk otomasi server-ke-server. Rotasi `ADMIN_SESSION_SECRET`
  akan membatalkan seluruh sesi yang masih berlaku.
- Area admin tanpa indeks, tidak dicantumkan di sitemap, dan tidak ditautkan dari footer/pencarian.
- Proxy unduhan memeriksa setiap tujuan (lihat “Bug lama yang diperbaiki” nomor 5).

## Pengujian

```bash
npm test          # tes unit: logika hitung, validasi, ekspor, penyimpanan lokal, keamanan, katalog
npm run build     # build produksi
```

Audit dan rencana selanjutnya ada di `docs/AUDIT.md` dan `docs/BACKLOG.md`.

---

## PWA

`public/manifest.json` + `public/sw.js` — bisa di-*install* ke home screen. Service
worker-nya: navigasi *network-first* (konten selalu segar, ada halaman offline kalau
mati), aset statis *stale-while-revalidate*, dan `/api/*` **tidak pernah** di-cache
supaya leaderboard tidak basi.

## Catatan

- TikTok Downloader butuh `UPSTREAM_API_BASE` karena TikTok tidak bisa diakses langsung
  dari browser (CORS). Tanpa env itu, tombolnya balas pesan jelas, bukan gagal diam-diam.
- Gambar di Galeri Acak diambil dari sumber publik pihak ketiga; Nawa Vandrell tidak
  menyimpannya.

Butuh Node **≥ 18.17**.
