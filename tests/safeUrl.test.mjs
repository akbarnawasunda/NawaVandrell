import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicHttpUrl, fetchPublicUrl, isPrivateAddress, UnsafeUrlError } from '../lib/safeUrl.mjs';

const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];
const privateLookup = async () => [{ address: '10.0.0.5', family: 4 }];

test('private, loopback, link-local, and metadata addresses are recognised', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.5.4', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fe80::1', 'fd00::1', '::ffff:10.0.0.1']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111']) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

test('only public http(s) URLs on default ports are accepted', async () => {
  await assertPublicHttpUrl('https://cdn.example.com/video.mp4', { lookup: publicLookup });
  await assert.rejects(assertPublicHttpUrl('file:///etc/passwd', { lookup: publicLookup }), UnsafeUrlError);
  await assert.rejects(assertPublicHttpUrl('ftp://example.com/a', { lookup: publicLookup }), UnsafeUrlError);
  await assert.rejects(assertPublicHttpUrl('https://user:pass@example.com/', { lookup: publicLookup }), UnsafeUrlError);
  await assert.rejects(assertPublicHttpUrl('http://example.com:8080/', { lookup: publicLookup }), UnsafeUrlError);
  await assert.rejects(assertPublicHttpUrl('not a url', { lookup: publicLookup }), UnsafeUrlError);
});

test('localhost, internal names, and IP literals inside private ranges are blocked without DNS lookups', async () => {
  let looked = false;
  const lookup = async () => { looked = true; return publicLookup(); };
  for (const url of ['http://localhost/admin', 'http://127.0.0.1:3000/', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]/', 'http://service.internal/']) {
    await assert.rejects(assertPublicHttpUrl(url, { lookup }), UnsafeUrlError, url);
  }
  assert.equal(looked, false);
});

test('hostnames that resolve to private addresses are rejected (DNS rebinding guard)', async () => {
  await assert.rejects(assertPublicHttpUrl('https://evil.example.com/', { lookup: privateLookup }), /privat/);
});

test('redirects are followed only when every hop stays public', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith('/start')) return new Response(null, { status: 302, headers: { location: 'https://cdn.example.com/final' } });
    return new Response('ok', { status: 200 });
  };
  const response = await fetchPublicUrl('https://example.com/start', {}, { lookup: publicLookup, fetchImpl });
  assert.equal(await response.text(), 'ok');
  assert.deepEqual(calls, ['https://example.com/start', 'https://cdn.example.com/final']);

  const blocked = async (url) => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/secret' } });
  await assert.rejects(fetchPublicUrl('https://example.com/a', {}, { lookup: publicLookup, fetchImpl: blocked }), UnsafeUrlError);
});
