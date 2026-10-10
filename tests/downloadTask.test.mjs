import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DOWNLOAD_TASK_TIMING,
  endDownloadTask,
  getDownloadTask,
  isDownloadTaskActive,
  runDownloadTask,
  startDownloadTask,
  updateDownloadTask,
  __resetDownloadTask,
} from '../lib/downloadTask.mjs';

const DEFAULT_TIMING = { minWorkMs: 1100, doneHoldMs: 1500, errorHoldMs: 2400 };
// Durasi cepat untuk test: flip ke done/error setelah 30ms, overlay tertutup setelah 150ms.
const FAST_TIMING = { minWorkMs: 30, doneHoldMs: 120, errorHoldMs: 120 };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function useFastTiming(t) {
  Object.assign(DOWNLOAD_TASK_TIMING, FAST_TIMING);
  t.after(() => {
    Object.assign(DOWNLOAD_TASK_TIMING, DEFAULT_TIMING);
    __resetDownloadTask();
  });
}

test('download task: working → done → tersembunyi, dengan durasi minimum animasi', async (t) => {
  useFastTiming(t);

  const end = startDownloadTask('Mengunduh lagu.mp3', 'menyimpan…', null);
  assert.equal(isDownloadTaskActive(), true);
  assert.equal(getDownloadTask().phase, 'working');

  // Sudah ditutup, tapi animasi working belum cukup lama → masih 'working'.
  end(true);
  assert.equal(getDownloadTask().phase, 'working');
  assert.equal(isDownloadTaskActive(), true);

  await sleep(80);
  assert.equal(getDownloadTask().phase, 'done');
  assert.equal(isDownloadTaskActive(), false);

  await sleep(100);
  assert.equal(getDownloadTask(), null);
});

test('download task: update menggabung field & membatas progress, aman tanpa tugas aktif', async (t) => {
  useFastTiming(t);

  // Tidak ada tugas aktif → tidak boleh melempar error.
  updateDownloadTask({ label: 'X', progress: 0.5 });
  endDownloadTask(false);

  startDownloadTask('Awal', 'detail lama', 0.25);
  updateDownloadTask({ label: 'Tengah', progress: 1.7 });
  let task = getDownloadTask();
  assert.equal(task.label, 'Tengah');
  assert.equal(task.detail, 'detail lama');
  assert.equal(task.progress, 1); // dibatasi di 0..1

  updateDownloadTask({ progress: null });
  task = getDownloadTask();
  assert.equal(task.progress, null); // kembali indeterminate
  assert.equal(task.label, 'Tengah');

  endDownloadTask(true);
  await sleep(200);
  assert.equal(getDownloadTask(), null);
});

test('download task: runDownloadTask sukses mengembalikan hasil & menutup overlay', async (t) => {
  useFastTiming(t);

  const result = await runDownloadTask('Menyiapkan docx…', async () => 'blob-selesai', 'nama.docx');
  assert.equal(result, 'blob-selesai');
  assert.equal(getDownloadTask().doneDetail, ''); // pakai teks sukses bawaan
  await sleep(200);
  assert.equal(getDownloadTask(), null);
});

test('download task: runDownloadTask gagal menampilkan error lalu tetap throw', async (t) => {
  useFastTiming(t);

  await assert.rejects(
    runDownloadTask('Mengunduh…', async () => {
      throw new Error('server mati');
    }),
    /server mati/
  );

  await sleep(80);
  assert.equal(getDownloadTask().phase, 'error');
  await sleep(120);
  assert.equal(getDownloadTask(), null);
});

test('download task: tugas baru tidak terpengaruh timer tugas lama', async (t) => {
  useFastTiming(t);

  const first = startDownloadTask('Tugas 1');
  first(true);
  // Segera ganti dengan tugas baru sebelum timer "durasi minimum" tugas lama matang.
  const second = startDownloadTask('Tugas 2');
  await sleep(80);
  // Timer tugas lama sudah lewat, tapi tidak boleh menutup/mengubah tugas baru.
  assert.equal(getDownloadTask().label, 'Tugas 2');
  assert.equal(getDownloadTask().phase, 'working');
  second(true);
  await sleep(160);
  assert.equal(getDownloadTask(), null);
});
