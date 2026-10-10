#!/usr/bin/env node
/**
 * scripts/setup-ytdlp.mjs — menyiapkan binari `yt-dlp` agar mesin server siap.
 *
 * Dijalankan otomatis via `postinstall`, `predev`, dan `prebuild` (termasuk saat
 * deploy ke Vercel). Binari disimpan di `bin/yt-dlp` lalu ikut ter-bundle ke
 * serverless function lewat `outputFileTracingIncludes` di `next.config.js`.
 *
 * Strategi (berurutan sampai ada yang berhasil):
 *  1. Pakai `bin/yt-dlp` yang sudah ada bila lolos verifikasi `--version`.
 *  2. Unduh binari statis `yt-dlp_linux` dari GitHub Releases (tidak butuh python
 *     saat runtime — cocok untuk serverless yang read-only & tanpa python3).
 *  3. Bangun zipapp dari modul pip `yt-dlp` (+ `mutagen`) sebagai fallback lokal.
 *
 * Script ini TIDAK PERNAH gagal (selalu exit 0) agar tidak menggagalkan install/build;
 * bila semua cara gagal, hanya peringatan yang dicetak dan mesin berjalan dalam
 * "Mode Terbantu" sampai binari tersedia.
 *
 * Env opsional:
 *  - YTDLP_VERSION : versi rilis yang diunduh, mis. "2024.10.07" (default: "latest").
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN_PATH = path.join(projectRoot, 'bin', 'yt-dlp');
const VERSION = (process.env.YTDLP_VERSION || 'latest').trim() || 'latest';
const MIN_STATIC_SIZE = 10 * 1024 * 1024; // binari statis normalnya > 30 MB

async function checkBinary(binPath) {
  try {
    const { stdout } = await execFileAsync(binPath, ['--version'], { timeout: 20000 });
    const ver = String(stdout || '').trim().split('\n')[0];
    return ver || null;
  } catch {
    return null;
  }
}

async function downloadStaticBinary() {
  const tag = VERSION === 'latest' ? 'latest/download' : `download/${VERSION}`;
  const url = `https://github.com/yt-dlp/yt-dlp/releases/${tag}/yt-dlp_linux`;
  console.log(`[setup:ytdlp] Mengunduh binari statis yt-dlp (${VERSION})...`);

  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(120000) });
  if (!res.ok) {
    throw new Error(`unduhan gagal (HTTP ${res.status}) dari ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < MIN_STATIC_SIZE) {
    throw new Error(`ukuran berkas tidak wajar (${buf.length} byte) — kemungkinan halaman error, bukan binari`);
  }
  // Verifikasi magic number ELF (binari Linux) agar tidak menyimpan HTML error.
  if (buf[0] !== 0x7f || buf[1] !== 0x45 || buf[2] !== 0x4c || buf[3] !== 0x46) {
    throw new Error('berkas unduhan bukan binari ELF Linux yang valid');
  }

  await fs.mkdir(path.dirname(BIN_PATH), { recursive: true });
  const tmpPath = `${BIN_PATH}.download`;
  await fs.writeFile(tmpPath, buf);
  await fs.chmod(tmpPath, 0o755);
  const ver = await checkBinary(tmpPath);
  if (!ver) {
    await fs.rm(tmpPath, { force: true });
    throw new Error('verifikasi `--version` gagal setelah unduhan');
  }
  await fs.rename(tmpPath, BIN_PATH);
  return ver;
}

async function pipInstallYtDlp() {
  const attempts = [
    ['-m', 'pip', 'install', '--quiet', '-U', 'yt-dlp', 'mutagen'],
    ['-m', 'pip', 'install', '--quiet', '-U', '--break-system-packages', 'yt-dlp', 'mutagen'],
  ];
  let lastError = null;
  for (const args of attempts) {
    try {
      await execFileAsync('python3', args, { timeout: 180000 });
      return true;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('pip install gagal');
}

async function buildZipappFromPip() {
  console.log('[setup:ytdlp] Mencoba membangun yt-dlp dari modul pip (fallback)...');
  await pipInstallYtDlp();
  await fs.mkdir(path.dirname(BIN_PATH), { recursive: true });
  await execFileAsync(
    'python3',
    [
      '-c',
      [
        'import zipfile, os, yt_dlp',
        'pkgs = [os.path.dirname(yt_dlp.__file__)]',
        'try:',
        '    import mutagen',
        '    pkgs.append(os.path.dirname(mutagen.__file__))',
        'except ImportError: pass',
        `out = ${JSON.stringify(BIN_PATH)}`,
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
    ],
    { timeout: 120000 }
  );
  const ver = await checkBinary(BIN_PATH);
  if (!ver) {
    throw new Error('verifikasi `--version` gagal setelah build pip');
  }
  return ver;
}

async function main() {
  if (existsSync(BIN_PATH)) {
    const existing = await checkBinary(BIN_PATH);
    if (existing) {
      console.log(`[setup:ytdlp] Siap: bin/yt-dlp v${existing} (sudah terpasang, dilewati).`);
      return;
    }
    console.log('[setup:ytdlp] Berkas bin/yt-dlp ada tapi rusak — akan dipasang ulang.');
    await fs.rm(BIN_PATH, { force: true });
  }

  try {
    const ver = await downloadStaticBinary();
    console.log(`[setup:ytdlp] Berhasil: bin/yt-dlp v${ver} (binari statis, siap untuk serverless).`);
    return;
  } catch (err) {
    console.warn(`[setup:ytdlp] Unduhan statis gagal: ${err.message}`);
  }

  try {
    const ver = await buildZipappFromPip();
    console.log(`[setup:ytdlp] Berhasil: bin/yt-dlp v${ver} (dibangun dari pip — butuh python3 saat runtime).`);
    return;
  } catch (err) {
    console.warn(`[setup:ytdlp] Build dari pip gagal: ${err.message || err}`);
  }

  console.warn(
    '[setup:ytdlp] PERINGATAN: binari yt-dlp tidak tersedia. Mesin server akan berjalan dalam "Mode Terbantu" ' +
      'sampai binari terpasang. Jalankan manual: npm run setup:ytdlp (butuh internet ke github.com atau pypi.org).'
  );
}

await main();
