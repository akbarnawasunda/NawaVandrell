/**
 * lib/db.js — abstraksi penyimpanan leaderboard.
 *
 * Urutan prioritas:
 *  1. Vercel KV / Upstash Redis REST  (kalau KV_REST_API_URL + KV_REST_API_TOKEN ada)
 *  2. /tmp/leaderboard.json           (writable di serverless Vercel, ephemeral)
 *  3. data/leaderboard.json           (read-only seed, dipakai kalau /tmp kosong)
 *  4. in-memory                       (last resort, misal filesystem terkunci total)
 *
 * Bentuk data: { [username: string]: number }
 *
 * TIDAK pakai kvdb.io lagi.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const KEY = 'nawa_leaderboard';
const SEED_PATH = path.join(process.cwd(), 'data', 'leaderboard.json');
const TMP_PATH = path.join(os.tmpdir(), 'leaderboard.json');

/** Cache proses (mengurangi I/O + fallback terakhir). */
let memory = null;

function hasKV() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export function storageDriver() {
  return hasKV() ? 'kv' : 'file';
}

// ------------------------------- KV driver -------------------------------

async function kvFetch(cmdPath, init = {}) {
  const base = process.env.KV_REST_API_URL.replace(/\/$/, '');
  const res = await fetch(`${base}/${cmdPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`KV ${res.status}`);
  return res.json();
}

async function kvGet() {
  const json = await kvFetch(`get/${KEY}`);
  if (!json || json.result == null) return {};
  try {
    const parsed = typeof json.result === 'string' ? JSON.parse(json.result) : json.result;
    return sanitize(parsed);
  } catch {
    return {};
  }
}

async function kvSet(data) {
  await kvFetch(`set/${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// ------------------------------ file driver ------------------------------

async function readJson(file) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return sanitize(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function fileGet() {
  // /tmp lebih baru daripada seed
  const tmp = await readJson(TMP_PATH);
  if (tmp) return tmp;
  const seed = await readJson(SEED_PATH);
  if (seed) return seed;
  return {};
}

async function fileSet(data) {
  const body = JSON.stringify(data, null, 2);
  // /tmp selalu writable di Vercel
  try {
    await fs.writeFile(TMP_PATH, body, 'utf8');
  } catch (err) {
    // dev lokal: /tmp gagal, coba data/ langsung
    try {
      await fs.writeFile(SEED_PATH, body, 'utf8');
    } catch {
      throw err;
    }
    return;
  }
  // di lokal (bukan Vercel) sekalian persist ke data/ biar gak hilang saat restart
  if (!process.env.VERCEL) {
    try {
      await fs.writeFile(SEED_PATH, body, 'utf8');
    } catch {
      /* read-only, abaikan */
    }
  }
}

// -------------------------------- helpers --------------------------------

/** Buang entri invalid, clamp skor, batasi panjang nama. */
function sanitize(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const name = String(k).trim().slice(0, 24);
    if (!name) continue;
    const score = Number(v);
    if (!Number.isFinite(score)) continue;
    out[name] = Math.max(0, Math.min(9_999_999, Math.floor(score)));
  }
  return out;
}

// ------------------------------- public API -------------------------------

/** Ambil seluruh map { name: score }. */
export async function getLeaderboard() {
  try {
    const data = hasKV() ? await kvGet() : await fileGet();
    memory = data;
    return data;
  } catch {
    return memory || {};
  }
}

/** Timpa seluruh leaderboard. */
export async function saveLeaderboard(data) {
  const clean = sanitize(data);
  memory = clean;
  try {
    if (hasKV()) await kvSet(clean);
    else await fileSet(clean);
    return true;
  } catch {
    // tetap tersimpan di memory sampai instance mati
    return false;
  }
}

/**
 * Naikkan skor 1 user. Hanya menyimpan nilai tertinggi (best score),
 * jadi client tidak bisa menurunkan skor orang lain.
 */
export async function submitScore(name, score) {
  const username = String(name || '').trim().slice(0, 24);
  if (!username) return { ok: false, error: 'Nama tidak valid' };

  const value = Number(score);
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, error: 'Skor tidak valid' };
  }

  const board = await getLeaderboard();
  const current = board[username] || 0;
  const next = Math.max(current, Math.floor(value));
  board[username] = next;
  const persisted = await saveLeaderboard(board);
  return { ok: true, username, score: next, persisted };
}

/** Array terurut untuk ditampilkan. */
export async function getRanked(limit = 20) {
  const board = await getLeaderboard();
  return Object.entries(board)
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, Math.max(1, Math.min(100, Number(limit) || 20)));
}

export async function deletePlayer(name) {
  const board = await getLeaderboard();
  if (!(name in board)) return false;
  delete board[name];
  await saveLeaderboard(board);
  return true;
}
