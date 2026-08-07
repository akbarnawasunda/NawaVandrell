/**
 * lib/auth.js — verifikasi admin.
 *
 * PIN & token DIBACA DARI ENV, tidak pernah di-hardcode:
 *   ADMIN_PIN        -> PIN yang diketik di /admin
 *   ADMIN_API_TOKEN  -> Bearer token untuk semua /api/admin/* dan POST /api/leaderboard
 *
 * Perbandingan pakai crypto.timingSafeEqual supaya tidak bocor lewat timing attack.
 */

import crypto from 'node:crypto';

/** Hash dulu lalu bandingkan, jadi panjang input tidak pernah bocor. */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ha = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hb = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function isConfigured() {
  return Boolean(process.env.ADMIN_PIN && process.env.ADMIN_API_TOKEN);
}

/** Cek PIN dari body /api/admin/verify. */
export function verifyPin(pin) {
  const expected = process.env.ADMIN_PIN;
  if (!expected) return false;
  return safeEqual(String(pin ?? ''), expected);
}

/** Cek header Authorization: Bearer <ADMIN_API_TOKEN>. */
export function verifyBearer(request) {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) return false;
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  return safeEqual(match[1].trim(), expected);
}

/** Response 401 standar. */
export function unauthorized(message = 'Unauthorized') {
  return Response.json({ success: false, message }, { status: 401 });
}

// ---------------------------- rate limiting ----------------------------

/**
 * Rate limiter in-memory per instance.
 * Cukup untuk melindungi brute force PIN pada satu lambda;
 * kalau butuh global, ganti store-nya ke KV.
 */
const buckets = new Map();
const WINDOW_MS = 10 * 60 * 1000; // 10 menit
const MAX_ATTEMPTS = 5;

function prune(now) {
  for (const [key, bucket] of buckets) {
    if (now - bucket.first > WINDOW_MS) buckets.delete(key);
  }
}

export function clientKey(request) {
  const fwd = request.headers.get('x-forwarded-for') || '';
  const ip = fwd.split(',')[0].trim() || request.headers.get('x-real-ip') || 'local';
  return ip;
}

/** @returns {{allowed: boolean, remaining: number, retryAfter: number}} */
export function rateLimit(request) {
  const now = Date.now();
  if (buckets.size > 500) prune(now);

  const key = clientKey(request);
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.first > WINDOW_MS) {
    buckets.set(key, { first: now, count: 1 });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1, retryAfter: 0 };
  }

  bucket.count += 1;
  if (bucket.count > MAX_ATTEMPTS) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((WINDOW_MS - (now - bucket.first)) / 1000),
    };
  }
  return { allowed: true, remaining: MAX_ATTEMPTS - bucket.count, retryAfter: 0 };
}

/** Reset counter setelah login sukses. */
export function resetRateLimit(request) {
  buckets.delete(clientKey(request));
}
