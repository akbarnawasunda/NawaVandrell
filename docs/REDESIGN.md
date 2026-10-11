# Laporan Redesain Visual Nawa Editor — 11 Oktober 2026

Branch: `arena/f64315f8-nawaeditor` (kelanjutan pekerjaan PR #8 yang sudah ter-merge ke `main` @ `e7f845f`).
Tujuan: gaya lebih sederhana, rapi, responsif (mobile-first), dan ringan; glassmorphism **dihapus sepenuhnya**
dan diganti sistem "kertas terang" yang sudah dirintis di `app/globals.css` (lihat `docs/DESIGN.md`).

## 1. Halaman & komponen yang diubah, beserta alasannya

### Lapisan tema (dipakai semua halaman)

| Berkas | Perubahan | Alasan |
|---|---|---|
| `app/glass-theme.css` | **Dihapus** (301 baris) | Seluruh lapisan glassmorphism: permukaan transparan `rgba(255,255,255,.68)`, `backdrop-filter: blur(18px)` di ~30 kelas, gradien ambient `background-attachment: fixed`. Mahal di HP, bentrok dengan sistem datar, dan tidak lagi diwajibkan. |
| `app/layout.js` | Impor `glass-theme.css` dihapus | — |
| `app/globals.css` | Token kontras (`--text-faint` `#8a93a0`→`#626b79`; `--ok/--warn/--danger/--info` digelapkan), skala radius diseragamkan (4/6/8/10/12/16/pill), tap target footer & `.back` ≥ 24px, `.sim-doc-footer` lebih gelap, grid hero SIM tak lagi menyisakan kolom kosong | Semua pasangan teks/latar lulus WCAG AA (termasuk di atas `*-ghost`); radius 12/16 konsisten; kolom hero kosong (markup tinggal 1 anak) terlihat bolong di desktop. |
| `app/workbench.css` | Hero beranda: kaca-gelap (gradien `#171b27`, cincin ornamen, `backdrop-filter`) → kartu terang datar; kartu samping, ikon orbit, pencarian hero, dan meta disamakan ke token; judul hero mobile `clamp(27px…36px)` (dulu 39–56px) | Ini satu-satunya bagian gelap yang tersisa; ukuran judul lama memaksa wrap 3 baris di 390px. |
| `app/spreadsheet-tool.css` | Warna identitas hijau (`#078768`/`#087653`/tint hijau) → token aksen indigo & semantik | "Satu aksen" di seluruh aplikasi (konsisten dengan SIM yang sudah indigo). Status sukses tetap `--ok`, catatan privasi tetap `is-info`. |
| `app/sim-tool.css` | Gradien dekoratif dihapus, cincin hero dihapus, radius 17–23px → 16px, `--sim-subtle`/`#8a93a0`/`#d0d9e5` → warna lulus AA | Konsistensi & kontras; ekspor/cetak tidak tersentuh. |

### Halaman (JSX murni gaya + aksesibilitas, fungsi identik)

| Halaman | Perubahan | Alasan |
|---|---|---|
| `tools/gradient` | `aria-label` pada 2 input hex; label preset di pill gelap; warna dasar padat di balik gradien preset | Input hex tak bernama; teks putih 11px di atas gradien Emerald/Sunset gagal AA (kini ~5:1). |
| `tools/qr-code` | 2 `input type=color` dikaitkan ke `<label>` ("Warna QR (Foreground)", "Warna Background") | Label terlihat tidak terasosiasi (WCAG 1.3.1/3.3.2). |
| `tools/text-sticker` | Slider ukuran dikaitkan ke labelnya; tombol tema dapat latar padat pengaman | Slider tak bernama. |
| `tools/password` | Warna indikator kekuatan `#f87171/#fbbf24/#34d399/#10b981` → `var(--danger)/var(--warn)/var(--ok)` | Teks "Sangat Kuat" 2,5:1 → 5,5:1. |
| `tools/color-picker` | Label status "lolos AA"/"kurang" diberi warna tetap terbaca (tetap menampilkan rasio warna pengguna) | Sebelumnya ikut warna pilihan pengguna (bisa 2,5:1). |
| `tools/uuid` | Chip salin `rgba(255,255,255,.03)` → `var(--surface)` | Sisa permukaan transparan. |

Komponen bersama (`TopBar`, `Ui`, `ToolShell`, `GameShell`, `CommandPalette`, `SearchHome`, `ConfirmModal`, `SkeletonLoader`, `LocalDataPanel`, `AdminDashboard`) **tidak diubah** — sudah memakai sistem kelas `globals.css`/`nv-tools.css`; perubahan glass murni di CSS.

### Verifikasi fungsi (tidak berubah)

- Pengolah Excel & seluruh ekspornya, Workbench v1 (papan tugas, notulen & tindak lanjut, roster 7 hari, rekap nilai berbobot, inventaris + mutasi stok) — hanya CSS; `npm test` 228/228 (termasuk `workbenchV1`, `spreadsheet`, `simDocumentExports`, `collectiveSimExports`).
- Downloader: status FFmpeg/yt-dlp tetap tampil ("Mesin Server Aktif", "FFmpeg Siap"); tombol unduh tetap `disabled` bila FFmpeg/yt-dlp tidak siap (`downloadBlocked`, `app/downloader/page.js`).
- Print/export (`lib/printDoc.mjs`, `body.nv-printing`) tidak diubah; lembar cetak tetap putih.
- Perilaku privasi tidak diubah (semua lokal, tanpa API data pribadi). Disclaimer "Nawa Editor bukan layanan resmi PLN dan tidak terafiliasi dengannya" tetap ada di Pengolah Excel, `data/featuredTools.js`, dan `docs/MEDIA-RUNTIME.md`.

## 2. Prinsip desain baru

Satu dokumen singkat: **`docs/DESIGN.md`** (warna, tipografi, spacing/radius, komponen dasar, aksesibilitas, larangan).

## 3. Ukuran bundel & CSS (npm run build)

| Metrik | Sebelum | Sesudah | Δ |
|---|---|---|---|
| First Load JS shared | 87,5 kB | 87,5 kB | 0 (redesain hampir murni CSS) |
| First Load JS `/` | 112 kB | 112 kB | 0 |
| First Load JS `/tools/pengolah-excel` | 119 kB | 119 kB | 0 |
| First Load JS `/tools/sim-application` | 133 kB | 133 kB | 0 |
| CSS terkompilasi (`.next/static/css`) | 134.923 B (2 berkas) | **126.387 B** (2 berkas) | **−8.536 B (−6,3%)** |
| CSS sumber (`app/*.css`) | 158.912 B (6 berkas) | **147.696 B** (5 berkas) | −11.216 B (−7,1%) |
| `backdrop-filter` di CSS | 22 aturan | **0** | — |

Catatan: `docs/redesign-metrics/build-before.txt` dan `build-after.txt` menyimpan keluaran build lengkap.

## 4. Hasil `npm test` dan `npm run build`

- `npm test`: **228 pass, 0 fail** (sebelum = sesudah; tidak ada perilaku yang diubah).
- `npm run build`: **sukses** (sebelum & sesudah), semua rute terprerender/SSR seperti biasa.

## 5. Metrik browser mobile (sebelum & sesudah)

Lingkungan: Chromium headless 153 (via `@sparticuz/chromium`), viewport **390×844** DPR2, **CPU throttle 4×**, perenderan perangkat lunak (tanpa GPU), halaman dinetralkan (`networkidle0`). Setiap kondisi **3 kali jalan**, angka = median.

| Halaman | LCP sebelum → sesudah (ms) | FPS saat scroll sebelum → sesudah | "INP" sebelum → sesudah (ms) |
|---|---|---|---|
| `/` (beranda) | 440 → 480* | **36,7 → 58,9** | 408 → 400 |
| `/tools/pengolah-excel` | **336 → 220** | 59,9 → 60,1 | 160 → 168* |
| `/tools/papan-tugas` | 272 → 272 | **49,0 → 59,9** | 240 → 176 |
| `/downloader` | **380 → 312** | **31,3 → 59,7** | 144 → 120 |
| `/games` | **432 → 308** | 55,6 → 59,8 | **216 → 128** |

\* = setara (dalam bising pengukuran; lihat keterbatasan).

Angka mentah 3× per kondisi: `docs/redesign-metrics/` (metrik lengkap JSON ada di `browserlab/metrics-*.json` saat sesi).

**Keterbatasan (jujur):**

- **Tidak ada browser ber-GPU sungguhan di sandbox** — Playwright/CDN browser diblokir; Chromium headless dipakai sebagai gantinya. Angka FPS adalah perenderan perangkat lunak, bukan perangkat nyata; **perbandingan sebelum→sesudah valid karena lingkungan identik**, tetapi angka absolut tidak mewakili HP pasar.
- **"INP" adalah proksi**: sentuhan disintetis (pointerdown/up + click pada input pencarian/chip/kartu), diukur lewat Event Timing `durationThreshold:16`. Ini **bukan INP lapangan** (butuh interaksi pengguna nyata). Variasi antar-jalan besar (mis. beranda 168–544 ms) karena beban re-render katalog; median dilaporkan apa adanya.
- LCP dipengaruhi waktu `networkidle0`; beranda memiliki galat ±100 ms antar-jalan.
- Metrik kuantitatif yang **paling stabil** dan paling langsung terkait penghapusan glassmorphism adalah **FPS saat scroll**: penghapusan `backdrop-filter` di permukaan yang ikut di-scroll menaikkan FPS dari ~31–37 menjadi ~59–60 (batas rAF) di beranda dan downloader.

## 6. Verifikasi halaman per halaman (mobile & desktop)

Otomasi (`sweep` + `probe-style`) menyambangi **68 halaman × 2 viewport (390px & 1440px)** pada build final dan memeriksa: error konsol, overflow horizontal, nama aksesibel setiap form/tombol/gambar, `backdrop-filter` (harus 0), kontras setiap teks (harus AA), warna permukaan di luar token, dan ukuran target sentuh. Hasil:

- **0** error konsol (kecuali `/admin` & `/admin/login` yang memang sengaja `notFound()` saat token admin tidak dikonfigurasi, dan `/tools/random-gallery` yang butuh internet eksternal untuk foto acak — keduanya perilaku lama yang disengaja).
- **0** overflow horizontal di 68 halaman × 2 viewport.
- **0** elemen tanpa nama aksesibel (3 temuan awal — input hex gradient, warna QR, slider stiker — sudah diperbaiki).
- **0** `backdrop-filter`; **0** pelanggaran kontras teks (4 temuan awal diperbaiki: eyebrow hero, label kekuatan password, status color-picker, teks kecil SIM).
- Target sentuh: semua ≥ 24×24px atau terbungkus `<label>`/inline-link (dikecualikan WCAG 2.5.8).
- Tinjauan visual manual pada sampel representatif (beranda, pengolah-excel, papan-tugas, stok-inventaris, rekap-nilai, jadwal-shift, downloader, SIM kolektif, games) di kedua viewport memastikan gaya yang sama rata: kertas terang, indigo tunggal, tanpa kaca.

## 7. Cara reproduksi metrik

```bash
npm install && npm test && npm run build
# browser: npm i @sparticuz/chromium puppeteer-core (di luar repo), lalu
# BASE=http://127.0.0.1:3000 LABEL=after node measure.mjs   # LCP/INP/FPS mobile
# BASE=http://127.0.0.1:3000 node sweep.mjs                  # 68 halaman × 2 viewport
# BASE=http://127.0.0.1:3000 node probe-style.mjs            # kontras/glass/token/target
```
