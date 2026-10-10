import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicOcr = path.join(projectRoot, 'public', 'ocr');
const coreDir = path.join(projectRoot, 'node_modules', 'tesseract.js-core');
const workerFile = path.join(projectRoot, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js');
const languageFile = path.join(projectRoot, 'node_modules', '@tesseract.js-data', 'ind', '4.0.0_best_int', 'ind.traineddata.gz');

const assets = [
  [workerFile, 'worker.min.js'],
  [languageFile, 'ind.traineddata.gz'],
  [path.join(coreDir, 'tesseract-core-lstm.wasm.js'), 'tesseract-core-lstm.wasm.js'],
  [path.join(coreDir, 'tesseract-core-simd-lstm.wasm.js'), 'tesseract-core-simd-lstm.wasm.js'],
  [path.join(coreDir, 'tesseract-core-relaxedsimd-lstm.wasm.js'), 'tesseract-core-relaxedsimd-lstm.wasm.js'],
];

await mkdir(publicOcr, { recursive: true });
for (const [source, filename] of assets) {
  await copyFile(source, path.join(publicOcr, filename));
}

// Catatan: penyiapan binari yt-dlp TIDAK lagi di sini — ditangani khusus oleh
// `scripts/setup-ytdlp.mjs` (dipanggil dari postinstall/predev/prebuild) yang
// menyimpan binari statis ke `bin/yt-dlp` agar ikut ter-bundle ke serverless.

console.log(`Prepared ${assets.length} local OCR assets in public/ocr (KTP images are not included).`);
