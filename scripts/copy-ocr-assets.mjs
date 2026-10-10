import { copyFile, mkdir, access, chmod } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
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

const localYtdlp = path.join(publicOcr, 'yt-dlp');
try {
  await access(localYtdlp);
  await chmod(localYtdlp, 0o755);
} catch {
  try {
    await execFileAsync('python3', [
      '-c',
      [
        'import zipfile, os, yt_dlp',
        'pkgs = [os.path.dirname(yt_dlp.__file__)]',
        'try:',
        '    import mutagen',
        '    pkgs.append(os.path.dirname(mutagen.__file__))',
        'except ImportError: pass',
        `out = ${JSON.stringify(localYtdlp)}`,
        'with open(out, "wb") as f: f.write(b"#!/usr/bin/env python3\\n")',
        'with zipfile.ZipFile(out, "a", compression=zipfile.ZIP_DEFLATED) as zf:',
        '    zf.writestr("__main__.py", "import sys\\nfrom yt_dlp import main\\nsys.exit(main())\\n")',
        '    for pkg_dir in pkgs:',
        '        for root, dirs, files in os.walk(pkg_dir):',
        '            dirs[:] = [d for d in dirs if d != "__pycache__"]',
        '            for file in files:',
        '                if file.endswith(".pyc"): continue',
        '                full = os.path.join(root, file)',
        '                rel = os.path.relpath(full, os.path.dirname(pkg_dir))',
        '                zf.write(full, rel)',
        'os.chmod(out, 0o755)',
      ].join('\n'),
    ]);
  } catch {
    // Abaikan bila lingkungan build tanpa python3/yt_dlp
  }
}

console.log(`Prepared ${assets.length} local OCR assets in public/ocr (KTP images are not included).`);
