# Prinsip Desain Nawa Editor

Ringkasan sistem desain baru (Oktober 2026): sederhana, rapi, mobile-first, dan ringan.
Gaya glassmorphism (permukaan transparan + `backdrop-filter`) dihapus sepenuhnya.
Semua nilai dipakai lewat variabel CSS di `app/globals.css`; halaman tinggal memakai kelas yang ada.

## 1. Warna

| Token | Nilai | Pemakaian |
|---|---|---|
| `--bg` | `#f4f5f7` | Latar halaman (kertas terang) |
| `--surface` | `#ffffff` | Panel, kartu, topbar |
| `--surface-2` | `#eef0f3` | Kartu sekunder, baris tabel |
| `--field` | `#fbfbfc` | Input, area isian |
| `--border` / `--border-strong` | `#e3e7ec` / `#c9cfd8` | Garis pemisah |
| `--text` / `--text-dim` / `--text-faint` | `#181b21` / `#4d5563` / `#626b79` | Teks utama / sekunder / petunjuk |
| `--accent` | `#4f46e5` | **Satu aksen tunggal** (indigo): tombol utama, fokus, tautan |
| `--ok` / `--warn` / `--danger` / `--info` | `#036b4e` / `#a04a08` / `#c81e14` / `#026293` | Status semantik saja |

Aturan:

- **Satu aksen.** Tidak ada warna identitas per-alat (hijau Excel dsb.) — status boleh memakai warna semantik.
- **Kontras AA.** Semua pasangan teks/latar lulus WCAG AA (≥ 4,5:1 teks normal, ≥ 3:1 teks besar), termasuk teks di atas latar ber-tint (`*-ghost`). Terverifikasi otomatis di 68 halaman.
- Tanpa gradien berat, tanpa blur (`backdrop-filter` = 0), tanpa permukaan transparan.

## 2. Tipografi

- Font sistem: `system-ui, -apple-system, 'Segoe UI', Roboto, …` (tanpa unduhan font).
- Skala: 11px label/eyebrow (mono, huruf besar) · 12,5–13px petunjuk · 14–15px teks isi · 17–19px judul bagian · `clamp(24px …)` judul halaman.
- Minimum teks fungsional 10,5px; judul memakai `letter-spacing: -0.02 … -0.04em`, bobot 700–800.
- Angka memakai `font-variant-numeric: tabular-nums`.

## 3. Spacing & bentuk

- Skala jarak: 4 · 7 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 32 · 44 px (padding kartu 14–20px, gap grid 8–14px).
- Radius konsisten: **4** mikro · **6** kecil · **8** tombol-ikon · **10** kontrol (input/tombol) · **12** kartu (`--radius`) · **16** panel (`--radius-lg`) · **999** pill.
- Bayangan tipis saja: `--shadow` (1px) untuk kartu, `--shadow-lift` untuk modal/popover.
- Lebar halaman: `shell-tool` 560px (alat tunggal), `shell` 1080px, workbench 1240px, SIM 1420px.

## 4. Komponen dasar

- **Kontrol:** `.input` / `.textarea` / `.select` (tinggi 48px, fokus = border aksen + ring `--accent-ghost`), `.btn` `.btn-primary` `.btn-ghost` `.btn-danger` `.btn-sm`, `.chip` (pill, `aria-pressed`), `.label` + `.hint` + `.nv-error`.
- **Panel:** `.panel`, `.nv-section`, `.nv-notice` (is-info/ok/warn/bad), `.nv-metric`, `.nv-table-wrap` (bisa digulir keyboard), `.result`.
- **Navigasi:** `.topbar` (sticky, menu mobile di ≤720px), `.back`, `.site-footer`, palet perintah Ctrl/Cmd+K.
- **Umpan balik:** `.toast`, `.modal`, `.skel` (loading), `.feedback`.

## 5. Aksesibilitas

- `:focus-visible` selalu terlihat (outline aksen 2px).
- `prefers-reduced-motion: reduce` mematikan animasi/transisi; `prefers-reduced-transparency` tidak lagi diperlukan (tidak ada efek transparan).
- Setiap input punya `<label>`/`aria-label`; tombol ikon punya `aria-label`; target sentuh ≥ 24×24px.
- Mode cetak: lembar dokumen tetap putih dengan tinta hitam (`body.nv-printing`).

## 6. Larangan

- `backdrop-filter`/efek kaca, gradien latar besar, bayangan tebal, warna aksen di luar token, radius di luar skala, ukuran font < 10,5px untuk teks fungsional.
