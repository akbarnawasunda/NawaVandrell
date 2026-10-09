import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSession,
  isConfigured,
  isSameOriginRequest,
  rateLimit,
  resetRateLimit,
  safeEqual,
  serializeAdminSessionCookie,
  verifyAdmin,
  verifyAdminMutation,
  verifyAdminSession,
  verifyAdminSessionValue,
  verifyPin,
} from '../lib/auth.js';

const SECRET_ENV = ['ADMIN_PIN', 'ADMIN_SESSION_SECRET', 'ADMIN_API_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN'];

function configureSecrets() {
  const previous = Object.fromEntries(SECRET_ENV.map((name) => [name, process.env[name]]));
  process.env.ADMIN_PIN = 'a91f7ce3d42b8a65';
  process.env.ADMIN_SESSION_SECRET = 'e39a85d4a0f447df9170a3c2a4b8c9e1e39a85d4a0f447df9170a3c2a4b8c9e1';
  process.env.ADMIN_API_TOKEN = '2c7d92fb1e6a4d8087e532ab9f4c21d52c7d92fb1e6a4d8087e532ab9f4c21d5';
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  return () => {
    for (const name of SECRET_ENV) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  };
}

test('admin access fails closed for missing, short, or example secrets', (t) => {
  const restore = configureSecrets();
  t.after(restore);
  assert.equal(isConfigured(), true);
  process.env.ADMIN_PIN = 'ganti-pin-ini-1234';
  assert.equal(isConfigured(), false);
  process.env.ADMIN_PIN = 'short';
  assert.equal(isConfigured(), false);
  delete process.env.ADMIN_SESSION_SECRET;
  assert.equal(isConfigured(), false);
});

test('signed admin sessions are tamper-proof and expire after thirty minutes', (t) => {
  const restore = configureSecrets();
  t.after(restore);
  const now = 1_800_000_000_000;
  const session = createAdminSession(now);
  assert.equal(verifyAdminSessionValue(session, now + 5_000), true);
  assert.equal(verifyAdminSessionValue(session, now + ADMIN_SESSION_TTL_SECONDS * 1000), false);
  assert.equal(verifyAdminSessionValue(`${session.slice(0, -1)}x`, now), false);
  assert.equal(verifyAdminSessionValue('not-a-session', now), false);
  assert.equal(verifyPin('a91f7ce3d42b8a65'), true);
  assert.equal(verifyPin('a91f7ce3d42b8a66'), false);
  assert.equal(safeEqual('same', 'same'), true);
  assert.equal(safeEqual('different', 'same'), false);
});

test('admin session cookie is HttpOnly, Strict, scoped to the site, and never exposes the API token', (t) => {
  const restore = configureSecrets();
  t.after(restore);
  const session = createAdminSession();
  const cookie = serializeAdminSessionCookie(session, true);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Secure/);
  assert.doesNotMatch(cookie, new RegExp(process.env.ADMIN_API_TOKEN));
  const request = new Request('https://nawa.example/admin', { headers: { cookie: `other=x; nawa_admin_session=${session}` } });
  assert.equal(verifyAdminSession(request), true);
  assert.equal(verifyAdmin(request), true);
});

test('cookie-authenticated writes require same origin while a private bearer remains server-only', (t) => {
  const restore = configureSecrets();
  t.after(restore);
  const session = createAdminSession();
  const sameOrigin = new Request('https://nawa.example/api/admin/player', {
    method: 'POST',
    headers: { cookie: `nawa_admin_session=${session}`, origin: 'https://nawa.example' },
  });
  const crossOrigin = new Request('https://nawa.example/api/admin/player', {
    method: 'POST',
    headers: { cookie: `nawa_admin_session=${session}`, origin: 'https://attacker.example' },
  });
  const bearer = new Request('https://nawa.example/api/admin/player', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.ADMIN_API_TOKEN}` },
  });
  const localListener = new Request('http://0.0.0.0:3001/api/admin/player', {
    method: 'POST',
    headers: {
      cookie: `nawa_admin_session=${session}`,
      host: '127.0.0.1:3001',
      origin: 'http://127.0.0.1:3001',
    },
  });
  const reverseProxy = new Request('http://internal:3000/api/admin/player', {
    method: 'POST',
    headers: {
      cookie: `nawa_admin_session=${session}`,
      host: 'internal:3000',
      origin: 'https://nawa.example',
      'x-forwarded-host': 'nawa.example',
      'x-forwarded-proto': 'https',
    },
  });
  const wrongProxyScheme = new Request('http://internal:3000/api/admin/player', {
    method: 'POST',
    headers: {
      cookie: `nawa_admin_session=${session}`,
      host: 'internal:3000',
      origin: 'http://nawa.example',
      'x-forwarded-host': 'nawa.example',
      'x-forwarded-proto': 'https',
    },
  });
  assert.equal(verifyAdminMutation(sameOrigin), true);
  assert.equal(verifyAdminMutation(crossOrigin), false);
  assert.equal(verifyAdminMutation(localListener), true);
  assert.equal(isSameOriginRequest(reverseProxy), true);
  assert.equal(verifyAdminMutation(wrongProxyScheme), false);
  assert.equal(verifyAdminMutation(bearer), true);
});

test('login rate limiting blocks the sixth attempt and can be reset after success', async (t) => {
  const restore = configureSecrets();
  t.after(restore);
  const request = new Request('https://nawa.example/api/admin/verify', { headers: { 'x-real-ip': '203.0.113.91' } });
  await resetRateLimit(request);
  for (let i = 0; i < 5; i += 1) assert.equal((await rateLimit(request)).allowed, true);
  assert.equal((await rateLimit(request)).allowed, false);
  await resetRateLimit(request);
  assert.equal((await rateLimit(request)).allowed, true);
  await resetRateLimit(request);
});
