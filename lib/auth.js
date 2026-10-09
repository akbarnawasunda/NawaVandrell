/** Server-side authentication helpers for the private admin area. */

import crypto from 'node:crypto';

export const ADMIN_SESSION_COOKIE = 'nawa_admin_session';
export const ADMIN_SESSION_TTL_SECONDS = 30 * 60;

const PIN_MIN_LENGTH = 16;
const SECRET_MIN_LENGTH = 32;
const WINDOW_MS = 10 * 60 * 1000;
const WINDOW_SECONDS = Math.ceil(WINDOW_MS / 1000);
const MAX_ATTEMPTS = 5;
const buckets = new Map();
const PLACEHOLDER_SECRET = /^(?:ganti|change[-_ ]?me|replace[-_ ]?me|your[-_ ]|example)/i;

function isSecret(value, minimumLength) {
  if (typeof value !== 'string') return false;
  const secret = value.trim();
  return secret.length >= minimumLength && !PLACEHOLDER_SECRET.test(secret);
}

/** Admin access is disabled unless long, non-placeholder secrets are configured. */
export function isConfigured() {
  return isSecret(process.env.ADMIN_PIN, PIN_MIN_LENGTH)
    && isSecret(process.env.ADMIN_SESSION_SECRET, SECRET_MIN_LENGTH);
}

export function verifyPin(pin) {
  const expected = process.env.ADMIN_PIN;
  if (!isSecret(expected, PIN_MIN_LENGTH) || typeof pin !== 'string' || pin.length > 256) return false;
  return safeEqual(pin, expected);
}

/** Hash before comparing so different input lengths do not leak through timing. */
export function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftHash = crypto.createHash('sha256').update(left, 'utf8').digest();
  const rightHash = crypto.createHash('sha256').update(right, 'utf8').digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function sessionSignature(encodedPayload) {
  return crypto
    .createHmac('sha256', process.env.ADMIN_SESSION_SECRET)
    .update(`nawa-admin-session-v1:${encodedPayload}`)
    .digest('base64url');
}

export function createAdminSession(now = Date.now()) {
  if (!isConfigured()) throw new Error('Admin session secrets are not configured');
  const issuedAt = Math.floor(now / 1000);
  const payload = {
    v: 1,
    iat: issuedAt,
    exp: issuedAt + ADMIN_SESSION_TTL_SECONDS,
    nonce: crypto.randomBytes(16).toString('base64url'),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encodedPayload}.${sessionSignature(encodedPayload)}`;
}

export function verifyAdminSessionValue(value, now = Date.now()) {
  if (!isConfigured() || typeof value !== 'string' || value.length > 1024) return false;
  const parts = value.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;

  const [encodedPayload, signature] = parts;
  if (!safeEqual(signature, sessionSignature(encodedPayload))) return false;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    const nowSeconds = Math.floor(now / 1000);
    return payload?.v === 1
      && Number.isInteger(payload.iat)
      && Number.isInteger(payload.exp)
      && payload.iat <= nowSeconds + 60
      && payload.exp > nowSeconds
      && payload.exp - payload.iat === ADMIN_SESSION_TTL_SECONDS
      && typeof payload.nonce === 'string'
      && payload.nonce.length >= 16;
  } catch {
    return false;
  }
}

function cookieValue(request, name) {
  const rawCookie = request?.headers?.get?.('cookie') || '';
  for (const part of rawCookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    return part.slice(separator + 1).trim();
  }
  return '';
}

export function verifyAdminSession(request) {
  return verifyAdminSessionValue(cookieValue(request, ADMIN_SESSION_COOKIE));
}

/** Optional machine-to-machine access. This credential is never sent to the browser. */
export function verifyBearer(request) {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!isSecret(expected, SECRET_MIN_LENGTH)) return false;
  const header = request?.headers?.get?.('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match || match[1].length > 1024) return false;
  return safeEqual(match[1].trim(), expected.trim());
}

export function verifyAdmin(request) {
  return verifyAdminSession(request) || verifyBearer(request);
}

/** Cookie-authenticated writes must be same-origin; bearer clients remain supported. */
export function verifyAdminMutation(request) {
  if (verifyAdminSession(request)) return isSameOriginRequest(request);
  return verifyBearer(request);
}

function firstHeaderValue(request, name) {
  return request?.headers?.get?.(name)?.split(',')[0]?.trim() || '';
}

function originForAuthority(authority, protocol) {
  if (!authority || (protocol !== 'http' && protocol !== 'https') || /[\s/?#@]/.test(authority)) {
    return '';
  }
  try {
    return new URL(`${protocol}://${authority}`).origin;
  } catch {
    return '';
  }
}

export function isSameOriginRequest(request) {
  const origin = request?.headers?.get?.('origin');
  if (origin) {
    try {
      const supplied = new URL(origin);
      if (supplied.username || supplied.password || supplied.pathname !== '/' || supplied.search || supplied.hash) {
        return false;
      }

      const requestUrl = new URL(request.url);
      const forwardedProtocol = firstHeaderValue(request, 'x-forwarded-proto').replace(/:$/, '').toLowerCase();
      const protocol = forwardedProtocol === 'https' || forwardedProtocol === 'http'
        ? forwardedProtocol
        : requestUrl.protocol.slice(0, -1);
      const candidates = new Set([requestUrl.origin]);
      const host = firstHeaderValue(request, 'host');
      const forwardedHost = firstHeaderValue(request, 'x-forwarded-host');

      for (const authority of new Set([host, forwardedHost])) {
        const candidate = originForAuthority(authority, protocol);
        if (candidate) candidates.add(candidate);
      }
      return candidates.has(supplied.origin);
    } catch {
      return false;
    }
  }
  const fetchSite = request?.headers?.get?.('sec-fetch-site');
  return !fetchSite || fetchSite === 'same-origin' || fetchSite === 'none';
}

export function serializeAdminSessionCookie(session, secure = process.env.NODE_ENV === 'production') {
  const attributes = [
    `${ADMIN_SESSION_COOKIE}=${session}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${ADMIN_SESSION_TTL_SECONDS}`,
  ];
  if (secure) attributes.push('Secure');
  return attributes.join('; ');
}

export function clearAdminSessionCookie(secure = process.env.NODE_ENV === 'production') {
  const attributes = [
    `${ADMIN_SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  if (secure) attributes.push('Secure');
  return attributes.join('; ');
}

export function unauthorized(message = 'Unauthorized') {
  return Response.json(
    { success: false, message },
    { status: 401, headers: { 'Cache-Control': 'no-store' } }
  );
}

function clientAddress(request) {
  const trustedAddress = request?.headers?.get?.('x-real-ip')?.trim();
  if (trustedAddress) return trustedAddress.slice(0, 128);
  const forwarded = request?.headers?.get?.('x-forwarded-for') || '';
  const firstForwardedAddress = forwarded.split(',')[0]?.trim();
  return (firstForwardedAddress || 'unknown').slice(0, 128);
}

function rateLimitKey(request) {
  const secret = isSecret(process.env.ADMIN_SESSION_SECRET, SECRET_MIN_LENGTH)
    ? process.env.ADMIN_SESSION_SECRET
    : 'nawa-admin-rate-limit-fallback';
  const addressHash = crypto.createHmac('sha256', secret).update(clientAddress(request)).digest('hex');
  return `nawa:admin:login:${addressHash}`;
}

async function redisCommand(command) {
  const base = process.env.KV_REST_API_URL?.replace(/\/$/, '');
  const token = process.env.KV_REST_API_TOKEN;
  if (!base || !token) throw new Error('KV rate limit is not configured');
  const path = command.map((part) => encodeURIComponent(String(part))).join('/');
  const response = await fetch(`${base}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(1500),
  });
  if (!response.ok) throw new Error(`KV rate limit returned ${response.status}`);
  const result = await response.json();
  if (result?.error) throw new Error('KV rate limit command failed');
  return result?.result;
}

function inMemoryRateLimit(key, now = Date.now()) {
  for (const [entry, bucket] of buckets) {
    if (now - bucket.first >= WINDOW_MS) buckets.delete(entry);
  }
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.first >= WINDOW_MS) {
    buckets.set(key, { first: now, count: 1 });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1, retryAfter: 0 };
  }
  bucket.count += 1;
  if (bucket.count > MAX_ATTEMPTS) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((WINDOW_MS - (now - bucket.first)) / 1000)),
    };
  }
  return { allowed: true, remaining: MAX_ATTEMPTS - bucket.count, retryAfter: 0 };
}

/** Use shared KV when available; otherwise fall back to a process-local limiter. */
export async function rateLimit(request) {
  const key = rateLimitKey(request);
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const count = Number(await redisCommand(['incr', key]));
      if (count === 1) await redisCommand(['expire', key, WINDOW_SECONDS]);
      if (count > MAX_ATTEMPTS) {
        const ttl = Number(await redisCommand(['ttl', key]));
        return { allowed: false, remaining: 0, retryAfter: Math.max(1, ttl) };
      }
      return { allowed: true, remaining: Math.max(0, MAX_ATTEMPTS - count), retryAfter: 0 };
    } catch {
      // Keep login protected during a KV outage; the local limiter still applies.
    }
  }
  return inMemoryRateLimit(key);
}

export async function resetRateLimit(request) {
  const key = rateLimitKey(request);
  buckets.delete(key);
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      await redisCommand(['del', key]);
    } catch {
      /* Login remains valid even if the distributed counter cannot be reset. */
    }
  }
}
