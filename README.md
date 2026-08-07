# NawaVandrell 2.0 — Neuro Core Digital Arsenal

Super-app **19 tools + 15 game** yang jalan cuma dengan **GitHub + Vercel**. Tanpa database
wajib, tanpa kvdb.io, tanpa API key.

Dua wajah dalam satu app:

| | Simple Mode (default) | Pro Mode |
|---|---|---|
| Latar | `#0A0A0B` solid, 1 orb emerald | 3 orb animasi + grid 80px |
| Aksen | 1 warna (`#10B981`) | emerald + indigo + violet |
| Font | Plus Jakarta Sans | Space Grotesk |
| Kaca | — | glassmorphism blur 24px |
| Game | soal + input + Jawab/Lewati | level, XP, streak 🔥, combo ×2/×3 |

Ganti mode dari tombol kanan atas. Pilihan tersimpan di `localStorage`, dan dibaca
sebelum halaman dilukis jadi tidak ada kedip tema.

---

## Jalanin di lokal

```bash
npm install
cp .env.example .env.local   # isi ADMIN_PIN & ADMIN_API_TOKEN
npm run dev                  # http://localhost:3000
```

Semua tool dan game jalan tanpa `.env`. Yang butuh env cuma `/admin` dan TikTok Downloader.

---

## Deploy ke Vercel

1. **Push ke GitHub**
   ```bash
   git init && git add . && git commit -m "NawaVandrell 2.0"
   git branch -M main
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
2. **Import ke Vercel** — buka [vercel.com/new](https://vercel.com/new), pilih repo-nya.
   Framework kedeteksi otomatis (Next.js), biarkan setelan default.
3. **Set Environment Variables** (Project Settings → Environment Variables):

   | Nama | Wajib | Isi |
   |---|---|---|
   | `ADMIN_PIN` | ya | PIN login `/admin` |
   | `ADMIN_API_TOKEN` | ya | token Bearer, bikin pakai `openssl rand -hex 32` |
   | `KV_REST_API_URL` | tidak | kalau mau leaderboard permanen |
   | `KV_REST_API_TOKEN` | tidak | pasangan URL di atas |
   | `UPSTREAM_API_BASE` | tidak | hanya untuk TikTok Downloader & waifu |

4. **Deploy.** Selesai.

> Tanpa `ADMIN_PIN`/`ADMIN_API_TOKEN`, situs tetap jalan penuh — hanya `/admin`
> yang balas `503` dengan pesan jelas, bukan error mentah.

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
  layout.js            root: font, orb, provider, service worker
  page.js              beranda: hero + search + preview game
  globals.css          satu token layer, dua identitas (data-mode)
  tools/<slug>/page.js 19 tool
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
context/               ModeContext, ToastContext
hooks/                 useSound, useStreak, usePlayer
lib/                   db.js, auth.js, quiz.js, funTools.js
data/                  featuredTools, quizDatabase, arcadeData, nexrayData
public/                manifest.json, sw.js, icon.svg
```

---

## Isi

**Tools (19).** QR Code · Password Generator · Base64 · JSON Formatter · Hash Lab
(SHA-1/256/384/512) · Text Case · UUID · Regex Tester · Lorem Ipsum · Image Compressor ·
Sticker WhatsApp · Color Picker · Gradient Generator · Text to Image · Teks Alay ·
Roasting Machine · Funfact Tanggal Lahir · Galeri Acak · TikTok Downloader

**Game (15).** Tebak-tebakan · Teka-teki · Siapakah Aku · Susun Kata · Tebak Kimia ·
Asah Otak · Tebak Lirik · Islamic Quiz · Logic Gate Puzzle · Angka Enigma ·
Kata Sambung · Emoji Story · Memory Matrix · Typing Blitz · Math Rush

Semua betulan jalan — bukan mockup. QR pakai canvas asli lalu diunduh PNG, hash pakai
`crypto.subtle`, password pakai `crypto.getRandomValues`, sticker keluar `.webp` 512×512
siap impor WhatsApp, suara game dibangkitkan WebAudio (tanpa file audio).

---

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

**4. Base64 rusak kena emoji.** `btoa()` mentah melempar error untuk karakter non-Latin1.
Sekarang lewat `TextEncoder` + chunking, jadi emoji dan huruf Jawa pun aman bolak-balik.

---

## Keamanan

- PIN dibanding pakai `crypto.timingSafeEqual` atas digest SHA-256 — panjang input tidak
  bocor lewat timing.
- Rate limit login admin: 5 percobaan / 10 menit per IP.
- Semua `/api/admin/*` cek `Bearer` token; tidak ada rahasia yang di-hardcode.
- Token admin disimpan di `sessionStorage`, hilang saat tab ditutup.
- Nama pemain dipotong 24 karakter, skor diklem `0..9.999.999` sebelum disimpan.
- `/admin` di-`Disallow` dari `robots.txt`, plus header `nosniff` & `SAMEORIGIN`.

---

## PWA

`public/manifest.json` + `public/sw.js` — bisa di-*install* ke home screen. Service
worker-nya: navigasi *network-first* (konten selalu segar, ada halaman offline kalau
mati), aset statis *stale-while-revalidate*, dan `/api/*` **tidak pernah** di-cache
supaya leaderboard tidak basi.

## Catatan

- TikTok Downloader butuh `UPSTREAM_API_BASE` karena TikTok tidak bisa diakses langsung
  dari browser (CORS). Tanpa env itu, tombolnya balas pesan jelas, bukan gagal diam-diam.
- Gambar di Galeri Acak diambil dari sumber publik pihak ketiga; NawaVandrell tidak
  menyimpannya.

Butuh Node **≥ 18.17**.
