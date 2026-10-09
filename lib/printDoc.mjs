/**
 * lib/printDoc.mjs — cetak dokumen Nawa Vandrell (invoice, CV, surat, daftar hadir, sertifikat).
 * Menandai <body> dengan kelas khusus selama dialog cetak, supaya aturan cetak untuk
 * dokumen baru tidak ikut menyembunyikan halaman lain (misalnya Rekap SIM Kolektif).
 */
export function printNvDocument() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const body = document.body;
  body.classList.add('nv-printing');
  const cleanup = () => {
    body.classList.remove('nv-printing');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}
