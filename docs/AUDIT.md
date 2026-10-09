# Audit Nawa Vandrell — sesi pengembangan toolbox

Basis: branch `arena/75a4758e-nawavandrell` dari `main` @ `7381d35`.
Stack: Next.js 14.2 (App Router), React 18, CSS global di `app/globals.css`, Node `>=24` (sandbox memakai Node 22; build dan tes lulus di 22).

## 1. Fitur yang sudah ada (sebelum sesi)

| Area | Yang sudah ada | Catatan |
|---|---|---|
| Tools (23) | Downloader, Stiker WA, Stiker Teks, QR Code, Kompres Foto, Password, WA Direct, Rekap SIM Kolektif, Roasting, Steganografi, JSON, Text Case, Color Picker, Gradient, Hash, Base64, UUID, Regex, Lorem, Teks ke Gambar, Alay, Funfact, Galeri Acak | Semua dipertahankan tanpa perubahan perilaku |
| SIM | Rekap SIM Kolektif (banyak KTP, OCR lokal, foto per baris, ekspor PDF/DOCX/XLSX/CSV/JSON, draf IndexedDB) dan Lembar Persiapan SIM Pribadi (rute tersembunyi, tidak di katalog) | Tabel default lima kolom, NIK opsional — diverifikasi di browser |
| Game | 8 kuis (16 kategori soal) + 8 arcade (termasuk Logic Gate, selalu 2 poin) | Logic Gate tidak memakai GATE_HINT/isPro |
| Komunitas | Leaderboard publik (`/api/leaderboard`), panel admin (`/admin`) dengan sesi cookie bertanda tangan | Admin tidak ditautkan dari navigasi publik |
| Platform | PWA (manifest, service worker offline), palet perintah Ctrl+K, pencarian katalog, sitemap, metadata SEO | |

## 2. Pemetaan terhadap pilar yang diminta

| Pilar | Sudah ada | Dibuat di sesi ini | Backlog |
|---|---|---|---|
| 1. Kerja | Tidak ada | CV + Cek ATS (heuristik), Pelacak lamaran (+ .ics), Surat lamaran & template administrasi, Kalkulator gaji/PPh 21/BPJS/THR/lembur, Latihan wawancara | — |
| 2. UMKM | Kompres Foto (bukan keperluan usaha) | Kalkulator HPP & harga (+ titik impas), Invoice/penawaran/kuitansi (PDF lewat cetak, Excel) | Catatan kas & stok |
| 3. Keuangan | Tidak ada | Cicilan (anuitas & flat) + target tabungan, Pembagi tagihan | Anggaran bulanan |
| 4. Dokumen | Kompres Foto, Stego (privasi gambar) | Sensor data teks (NIK, NPWP, telepon, email, rekening) | Sensor gambar, alat PDF, OCR umum |
| 5. Belajar | Kuis & arcade | Flashcard SM-2, Timer fokus + rencana belajar | Kuis dari catatan (privat) |
| 6. Komunitas | Rekap SIM kolektif (pola roster) | Daftar hadir + ekspor roster + sertifikat cetak; patungan memakai Pembagi Tagihan yang sama | QR check-in |
| 7. Harian & aksesibilitas | Skip link, focus-visible, reduced motion, forced-colors, PWA offline | Checklist rutinitas + pengingat selama halaman terbuka; perbaikan aksesibilitas (lihat §4) | Audit SIM mobile |

Keputusan anti-duplikasi:
- Satu **Pembagi Tagihan** untuk tagihan makan dan patungan kegiatan (pilar 3 & 6).
- Satu **Pembuat Surat** untuk surat lamaran dan template administrasi (pilar 1 & 4).
- **Cek ATS** berada di dalam Pembuat CV, bukan alat terpisah.
- **Kompres Foto** yang sudah ada tidak diduplikasi.

## 3. Hasil riset aturan (kalkulator gaji)

Setiap angka diberi sumber dan tanggal pemeriksaan di `lib/payrollCalc.mjs` (`PAYROLL_RULES.sumber`), ditampilkan juga di halaman.

- PPh Pasal 17 (UU HPP): 5% / 15% / 25% / 30% / 35% — dikonfirmasi lewat pajak.go.id.
- PTKP (PMK 101/2016): TK/0 Rp54 juta, K/0 Rp58,5 juta, +Rp4,5 juta per tanggungan (maks 3).
- Biaya jabatan 5%, maks Rp500 ribu/bulan atau Rp6 juta/tahun; pengurang iuran JHT 2% dan JP 1% (PMK 168/2023 Pasal 10).
- Tanpa NPWP: PPh 21 dikali 120% (Pasal 21 ayat 5a UU PPh).
- BPJS Kesehatan: pekerja 1%, batas upah Rp12 juta (Perpres 64/2020).
- JP: batas upah **Rp11.086.300 sejak Maret 2026** (surat BPJS Ketenagakerjaan B/1226/022026). Beberapa artikel lama masih menyebut Rp10.547.400; itu sudah tidak berlaku.
- THR (Permenaker 6/2016 Pasal 3): ≥12 bulan = 1 bulan upah; 1–11 bulan proporsional; dibayar H-7.
- Lembur (PP 35/2021 Pasal 31–32): upah sejam = 1/173 upah sebulan; hari kerja 1,5× lalu 2×; tabel hari istirahat/libur sesuai pekan 5 atau 6 hari.

Batasan yang disengaja: PPh 21 memakai **metode tahunan (Pasal 17) dibagi 12**, bukan tabel TER PMK 168/2023. Salinan PDF PMK 168 yang bisa diakses dari riset tidak terbaca (font rusak), sehingga tabel TER belum diimplementasikan (lihat backlog #4).

## 4. Temuan audit dan perbaikan

| # | Temuan | Dampak | Perbaikan |
|---|---|---|---|
| A1 | `/api/download-proxy` mengambil URL sembarang dari query (SSRF); redirect diikuti otomatis | Server bisa diminta mengakses jaringan internal / metadata cloud | `lib/safeUrl.mjs`: hanya http(s) pada port 80/443, tolak host privat/loopback/link-local, cek DNS, cek setiap redirect; 5 tes |
| A2 | Kontroler suara global memanggil `e.target.closest` tanpa pengecekan | Error runtime pada target non-elemen | Pengecekan elemen yang aman |
| A3 | Aturan `@media print` pertama kali ditulis global (`body *`) | Akan ikut menyembunyikan dokumen SIM saat dicetak | Dibatasi ke `body.nv-printing` lewat `lib/printDoc.mjs`; tes regresi + verifikasi cetak SIM di browser |
| A4 | Parsing angka: "0.500" terbaca 500 | Salah hitung jumlah/harga | `toAmount` memakai aturan pemisah ribuan yang ketat; tes |
| A5 | Pembulatan PPN/diskon pada invoice dan pembagian tagihan | Total bisa berselisih rupiah | Metode sisa terbesar; total bagian selalu sama dengan total tagihan |
| A6 | Hydration error pada halaman baru (HTML `<ul>` di dalam `<p>`, tanggal berbeda server/klien) | Error di konsol, render ulang | Diperbaiki; diverifikasi dengan React dev mode di 14 halaman |
| A7 | Navigasi/brand: `aria-label` tidak memuat teks yang terlihat (TopBar) | Pelanggaran WCAG 2.5.3 | Label disesuaikan |
| A8 | Input file impor cadangan dan input file SIM tanpa nama aksesibel | Pembaca layar | Nama ditambahkan |
| A9 | Area tabel yang bisa digulir tidak bisa difokus keyboard | Pengguna keyboard tidak bisa menggeser | `tabIndex=0` + `role=region` + nama |
| A10 | Ukuran huruf 8–10px pada katalog, navigasi, dan footer | Sulit dibaca di HP | Minimum dinaikkan ke 10,5–11px (blok akhir `globals.css`) |
| A11 | Kontras teks sekunder (`--text-faint`) | — | Diukur: 5,9–6,4:1 pada latar utama, sudah lulus AA (4,5:1). Tidak diubah |
| A12 | Error generik proxy mengembalikan pesan internal | Kebocoran detail | Diganti pesan umum |
| A13 | Service worker tidak pernah terdaftar: pendaftaran memakai `window.addEventListener('load')` di dalam skrip `afterInteractive`, sehingga bisa melewatkan event `load` | Dukungan offline tidak andal untuk semua pengunjung (diverifikasi: `registrations: []` sebelum perbaikan) | Pendaftaran langsung bila dokumen sudah `complete`; setelah perbaikan SW aktif; halaman HPP terverifikasi tampil saat offline (alat lain belum diuji offline) |
| A14 | Cetak PDF: margin tercetak gelap (#121212) karena `color-scheme: dark` pada `:root` | Dokumen cetak tampak berbingkai gelap bila browser mencetak latar | Kanvas cetak dipaksa putih (`html:has(body.nv-printing)`); diverifikasi piksel margin 255,255,255 |
| A15 | Cetak memakai `visibility: hidden` untuk menyembunyikan halaman | Halaman kosong ikut tercetak (invoice satu barang menjadi 3 halaman) | Diganti `display: none` untuk semua yang di luar lembar; invoice dan CV kini 1 halaman |
| A16 | “Hapus semua data” hanya menghapus koleksi utama; penanda pengingat (`nawa:v1:lamaran-notif`, `nawa:v1:rutinitas-notif`) dan status timer fokus (`nawa:v1:fokus-timer`) tetap tersisa, dan timer yang masih berjalan bisa menulis ulang statusnya | Sisa data lokal setelah “hapus semua” (berisi ID dan tanggal, bukan nama atau teks pribadi) | `createLocalCollection({ auxKeys })` menghapus kunci tambahan bersama koleksi (hanya kunci berawalan `nawa:v1:`); halaman fokus mereset timer saat data dihapus; 2 tes unit dan 18 pemeriksaan browser |

Temuan yang **belum** diubah (dicatat di backlog):
- File `n` di root repositori adalah salinan rute `quiz/reveal` yang tidak diimpor di mana pun. Tidak dihapus karena bukan keputusan teknis saya; konfirmasi pemilik repo.
- Tidak ada Content-Security-Policy. Menambahkannya perlu nonce/hash untuk skrip JSON-LD dan registrasi service worker.
- `/api/leaderboard` POST publik belum memiliki rate limit (hanya bisa menaikkan skor sendiri, tetapi bisa di-spam).
- `engines` di `package.json` menyebut Node `>=24.x`; sandbox audit memakai Node 22 dan semuanya lulus.
- Slug game ganda: `susunkata` dipakai oleh kuis (`quizDatabase`) dan arcade (`nexrayData`). Daftar game menampilkan 16 entri dengan 15 slug unik. Tidak diubah karena menyentuh rute dan katalog game yang sudah berjalan (lihat backlog #17).

## 5. Yang tidak berubah (sesuai batasan)

- Admin: tetap cookie `HttpOnly`/`SameSite=Strict` bertanda tangan, validasi same-origin, token tidak pernah dikirim ke browser, tidak ada tautan admin publik.
- Tidak ada version label, tidak ada pemilih mode produk.
- Tidak ada akun, tidak ada layanan AI, tidak ada pembayaran. Semua data baru disimpan di perangkat dengan ekspor/impor/hapus.

## 6. Verifikasi

- `npm test`: **165/165 lulus** (22 baseline + 143 baru).
- `npm run build`: lulus (Next.js 14.2.35, rute baru tercantum sebagai statis).
- Browser (Chromium headless, server produksi), pemeriksaan otomatis:
  - 36 kombinasi halaman × viewport (14 alat baru, beranda, games, leaderboard, SIM kolektif; 390px dan 1280px): status 200/304, **0 overflow horizontal**, **0 error console**, **0 pelanggaran axe-core** (serius, kritis, maupun kecil).
  - 37 pemeriksaan alur fungsi: contoh HPP, gaji (10 juta → take-home Rp9.365.000; tanpa NPWP → PPh Rp282.000), cicilan (anuitas 10 juta/12%/12 bulan → Rp888.488), pembagi (Rp30.000 per orang), pelacak (simpan dan tampil), CV (simpan lalu muat ulang), surat kuasa, flashcard (nilai dan kartu berikutnya), timer, daftar hadir, rutinitas, sensor (NIK dan email tersensor), latihan wawancara, invoice (total, simpan, kuitansi dengan terbilang). **37/37 lulus.**
  - SIM kolektif tidak berubah: tabel default lima kolom, dokumen tetap tampil saat dicetak.
  - Cetak: invoice dan CV menghasilkan **1 halaman A4** dengan margin putih (diperiksa dari berkas PDF yang dirender).
  - Offline: setelah dibuka sekali, halaman HPP tetap tampil saat jaringan dimatikan (service worker aktif).
- Pemeriksaan React dev mode (peringatan `validateDOMNesting` dan hydration) pada commit final untuk 14 alat baru, beranda, games, leaderboard, dan SIM kolektif (18 halaman, semuanya HTTP 200): tidak ada peringatan. Sebelumnya ditemukan dan diperbaiki satu `<ul>` di dalam `<p>`.

Keterbatasan verifikasi:
- Skrip Chromium headless (puppeteer-core + axe-core) belum ada di repositori; lihat backlog #12. Tidak ada pengujian pada Safari, Firefox, atau perangkat Android/iOS nyata.
- Penilaian ATS, latihan wawancara, dan sensor teks adalah heuristik dan tidak diuji terhadap sistem ATS atau perekrut sungguhan.
- Perhitungan PPh 21 memakai metode tahunan; belum dibandingkan dengan slip gaji dari perusahaan.
