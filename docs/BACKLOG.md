# Backlog Nawa Vandrell (urutan prioritas)

Urutan disusun dari manfaat nyata, risiko, dan kecocokan dengan produk. Setiap item punya kriteria penerimaan (AC) yang harus terpenuhi sebelum dianggap selesai.

## P1 — fitur yang masih kurang dari pilar

### 1. Catatan kas & stok sederhana (UMKM)
- Lingkup: pemasukan dan pengeluaran dengan kategori dan tanggal; stok barang (masuk, keluar, saldo); laporan per bulan.
- AC: saldo kas = total pemasukan − pengeluaran pada periode yang sama (tes unit); stok tidak negatif kecuali dikonfirmasi; ekspor CSV dan XLSX memuat total; cadangan JSON, impor, dan hapus data berfungsi; tidak ada data yang dikirim ke server.

### 2. Anggaran bulanan (Keuangan)
- Lingkup: kategori anggaran per bulan (rencana vs realisasi), sisa, persentase terpakai, salin/ekspor CSV.
- AC: sisa = rencana − realisasi untuk setiap kategori dan total (tes); peringatan saat realisasi melewati rencana; asumsi dan disclaimer tampil; cadangan dan hapus data.

### 3. Sensor gambar (KTP dan dokumen)
- Lingkup: kotak hitam di atas foto (seret, undo, hapus kotak), ekspor PNG/JPG hasil render ulang di canvas.
- AC: piksel di dalam kotak menjadi hitam pada hasil (uji browser); file hasil tidak membawa metadata EXIF; geometri kotak (normalisasi, klip ke batas gambar) diuji unit; teks peringatan bahwa sensor tidak menghapus file asli.

### 4. Tabel TER PPh 21 resmi (PMK 168/2023)
- Lingkup: tarif efektif bulanan kategori A, B, C dari tabel resmi, sebagai pilihan metode di kalkulator gaji.
- AC: tabel dimuat dari sumber yang bisa diverifikasi (catat URL dan tanggal); contoh resmi dalam PMK (mis. kategori A, bruto Rp60 juta, Desember) menghasilkan angka yang sama; minimal 20 kasus tes; sisa perbedaan dengan metode tahunan ditampilkan.
- Catatan: salinan PDF pajak.go.id tidak terbaca saat riset; perlu sumber lain yang bisa diverifikasi.

### 5. Alat PDF dan gambar (Dokumen)
- Lingkup: gabung PDF, pisah halaman, gambar menjadi PDF (`pdf-lib`, dimuat malas). Kompresi PDF hanya sejauh mengurangi gambar; batasan dijelaskan.
- AC: hasil dibuka di pembaca PDF; jumlah halaman sesuai; ukuran sebelum dan sesudah tampil; diuji dengan PDF contoh; semua proses lokal.

### 6. OCR gambar umum (Dokumen)
- Lingkup: teks dari foto dokumen memakai worker Tesseract yang sudah ada (`ind`), tombol salin dan unduh .txt.
- AC: teks keluar untuk contoh cetak yang jelas; progres tampil; tidak ada permintaan jaringan selain aset lokal (periksa di DevTools); pembersihan hasil diuji unit.

### 7. Kuis dari catatan (Belajar, privat)
- Lingkup: isian rumpang dibuat lokal dari kalimat catatan (pilih kata kunci sederhana), tanpa AI eksternal.
- AC: hanya kalimat yang memenuhi syarat menjadi soal; setiap soal diberi label “otomatis, periksa ulang”; jawaban bisa dicek dengan toleransi ejaan; tes unit untuk pemilihan kata dan pemeriksaan jawaban.

## P2 — pengerasan dan kualitas

### 8. Content-Security-Policy
- AC: CSP dengan nonce/hash untuk skrip JSON-LD dan registrasi service worker; laporan pelanggaran kosong di halaman utama, tiga alat baru, dan SIM; header diuji lewat `vercel.json`.

### 9. Rate limit untuk leaderboard publik
- AC: POST `/api/leaderboard` dibatasi per IP (KV bila tersedia, fallback per proses); respons 429 dengan `Retry-After`; tes unit.

### 10. Hapus berkas `n` di root
- AC: konfirmasi pemilik; setelah dihapus, build dan tes tetap lulus; tidak ada impor yang rusak.

### 11. Audit SIM di HP
- Lingkup: beberapa kelas `.sim-*` masih memakai 8–9px pada layar kecil.
- AC: minimum 10,5px untuk teks fungsional; tata letak tabel lima kolom tetap tanpa overflow pada 390px; ekspor dan cetak tidak berubah (uji `sim-check`).

### 12. Pengujian end-to-end resmi
- Lingkup: skrip browser di repositori (saat ini diuji manual dengan Chromium headless di luar repo).
- AC: alur utama setiap alat baru dijalankan di CI; axe-core tanpa pelanggaran serius/kritis pada halaman yang diuji.

### 17. Slug game ganda `susunkata`
- Temuan: kuis dan arcade sama-sama memakai slug `susunkata` (16 entri, 15 slug unik).
- AC: setiap game punya slug unik; URL lama tetap berfungsi lewat pengalihan; daftar game tidak lagi menampilkan dua “Susun Kata”; leaderboard tidak terpengaruh (diuji).

## P3 — nice to have (setelah P1–P2)

### 13. Sinkron kalender langsung (Google/Outlook)
- Ditunda: membutuhkan OAuth dan pengiriman data ke pihak ketiga. Saat ini cukup berkas `.ics`.
- AC bila dikerjakan: persetujuan eksplisit, data yang dikirim dijelaskan, token tidak masuk ke browser.

### 14. QR check-in daftar hadir
- AC: QR berisi ID peserta saja (tanpa nama); check-in tercatat lokal; tes unit untuk pemetaan ID.

### 15. Rekaman suara latihan wawancara
- AC: rekaman hanya di perangkat, dengan indikator jelas dan tombol hapus; izin mikrofon diminta saat dibutuhkan.

### 16. Riwayat patungan
- AC: riwayat tagihan lokal dengan ekspor dan hapus; tidak wajib (tetap bisa tanpa menyimpan).

## Checklist pemeliharaan aturan (setiap awal tahun dan saat ada perubahan)
- Batas upah JP (PP 45/2015 dan surat BPJS Ketenagakerjaan tahunan).
- Iuran JHT/JP/JKes dan batas upah BPJS Kesehatan (Perpres JKN).
- PTKP dan biaya jabatan (PMK terkait).
- Tarif lapisan PPh Pasal 17 (UU HPP).
- UMP/UMK tidak dipakai di kalkulator saat ini, tetapi perlu diperiksa jika ditambahkan.
- Perbarui `PAYROLL_RULES.diperiksaPada` dan tanggal sumber setiap kali aturan dicek ulang.
