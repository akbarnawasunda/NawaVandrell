import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Privasi dan data',
  description: 'Ketahui bagaimana Nawa Editor menangani data tools, rekap SIM kolektif, dan papan peringkat.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <article className="shell content-page">
      <p className="tool-eyebrow">NAWA EDITOR <i /> PRIVASI</p>
      <h1>Data tetap milikmu.</h1>
      <p className="content-page-lede">Kami merancang fitur agar data yang tidak perlu dikirim tetap berada di perangkatmu. Berikut ringkasan yang benar-benar perlu diketahui sebelum menggunakan situs.</p>

      <section>
        <h2>Rekap KTP dan SIM kolektif</h2>
        <p>Foto KTP, hasil OCR, koreksi, susunan foto, dan ekspor diproses di browser. Foto dan data KTP tidak dikirim ke API Nawa Editor.</p>
        <p>Jika kamu mengaktifkan <strong>Simpan otomatis</strong>, draf disimpan di IndexedDB pada browser/perangkat yang sama dan kedaluwarsa setelah 7 hari. Fitur ini mati sampai kamu mengaktifkannya. Kamu dapat menghapus draf dari alat kapan saja; menghapus data situs/browser juga menghapus salinan lokalnya. Jangan aktifkan di perangkat bersama.</p>
        <p>Ekspor dapat memuat NIK, data identitas, dan foto. Simpan serta bagikan file itu dengan hati-hati. Periksa seluruh hasil OCR dengan KTP asli; hasil OCR bukan verifikasi identitas.</p>
      </section>

      <section>
        <h2>Tools yang terhubung ke internet</h2>
        <p>Banyak tools berjalan langsung di browser. Saat kamu menggunakan fitur yang memerlukan layanan online—misalnya downloader atau galeri tertentu—URL atau permintaan terkait dapat diproses oleh server Nawa Editor dan penyedia pihak ketiga agar hasilnya tersedia. Jangan masukkan data KTP, kata sandi, atau informasi rahasia ke fitur tersebut.</p>
        <p>Tautan eksternal seperti WhatsApp akan membuka layanan tujuan dan tunduk pada kebijakan layanan tersebut.</p>
      </section>

      <section>
        <h2>Nama dan skor papan peringkat</h2>
        <p>Jika kamu mengirim skor game, nama tampilan dan skor dikirim ke layanan leaderboard Nawa Editor dan dapat dilihat publik. Gunakan nama samaran; jangan gunakan nama lengkap, NIK, nomor telepon, atau data sensitif lainnya.</p>
        <p>Nama dan skor lokal juga dapat tersimpan di browser untuk melanjutkan permainan. Pengiriman skor tidak mengirim foto KTP.</p>
      </section>

      <section>
        <h2>Kontrol dan pertanyaan</h2>
        <p>Untuk menghapus draf KTP, gunakan kontrol di halaman Rekap SIM Kolektif atau hapus data situs dari pengaturan browser. Untuk pertanyaan privasi atau melaporkan masalah, <a href="https://github.com/akbarnawasunda/nawaeditor/issues" target="_blank" rel="noopener noreferrer">buat issue di GitHub</a>.</p>
      </section>

      <p className="content-page-updated">Terakhir diperbarui: 9 Oktober 2026.</p>
      <Link href="/" className="btn btn-ghost content-page-back">Kembali ke beranda</Link>
    </article>
  );
}
