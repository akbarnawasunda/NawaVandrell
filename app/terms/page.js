import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Ketentuan penggunaan',
  description: 'Ketentuan penggunaan tools, game, downloader, dan rekap SIM kolektif Nawa Vandrell.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <article className="shell content-page">
      <p className="tool-eyebrow">NAWA VANDRELL <i /> KETENTUAN</p>
      <h1>Gunakan dengan bijak.</h1>
      <p className="content-page-lede">Dengan menggunakan Nawa Vandrell, kamu setuju untuk bertanggung jawab atas data yang dimasukkan, file yang dibuat, dan cara setiap hasil digunakan.</p>

      <section>
        <h2>Hasil tools dan OCR</h2>
        <p>Tools disediakan untuk membantu, bukan menggantikan pemeriksaan profesional atau sumber resmi. Hasil OCR dapat salah dan harus dicocokkan dengan dokumen asli.</p>
        <p>Rekap SIM adalah draf persiapan pribadi. Ini bukan SIM, bukti pendaftaran/pembayaran, atau formulir resmi. Persyaratan, golongan, biaya, dan alur terkini harus dikonfirmasi melalui Satpas atau kanal resmi Korlantas.</p>
      </section>

      <section>
        <h2>Hak atas konten dan penggunaan layanan lain</h2>
        <p>Kamu bertanggung jawab memastikan punya hak untuk menggunakan, mengunduh, mengubah, atau membagikan konten yang diproses. Patuhi hak cipta, aturan platform asal, dan hukum yang berlaku. Nawa Vandrell tidak mengizinkan penggunaan untuk melanggar hak orang lain.</p>
        <p>Fitur yang memakai layanan pihak ketiga dapat berubah atau tidak tersedia sewaktu-waktu. Layanan tersebut memiliki ketentuan dan kebijakan privasinya sendiri.</p>
      </section>

      <section>
        <h2>Ketersediaan</h2>
        <p>Kami berusaha menjaga situs tetap berjalan, tetapi tidak menjamin layanan selalu tersedia, bebas kesalahan, atau cocok untuk setiap kebutuhan. Simpan salinan ekspor penting di tempat yang aman.</p>
      </section>

      <section>
        <h2>Hubungi pengelola</h2>
        <p>Laporkan masalah atau kirim saran melalui <a href="https://github.com/akbarnawasunda/NawaVandrell/issues" target="_blank" rel="noopener noreferrer">GitHub Issues Nawa Vandrell</a>.</p>
      </section>

      <p className="content-page-updated">Terakhir diperbarui: 9 Oktober 2026.</p>
      <Link href="/" className="btn btn-ghost content-page-back">Kembali ke beranda</Link>
    </article>
  );
}
