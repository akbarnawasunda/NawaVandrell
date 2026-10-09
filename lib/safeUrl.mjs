/**
 * lib/safeUrl.mjs — pembatasan URL untuk proxy server (mencegah SSRF).
 * Hanya http/https ke host publik. Alamat loopback, privat, link-local, dan metadata cloud ditolak.
 * Setiap redirect juga diperiksa ulang oleh pemanggil.
 */

import dns from 'node:dns/promises';
import net from 'node:net';

const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', 'metadata.google.internal', 'metadata']);
const ALLOWED_PORTS = new Set(['', '80', '443']);

export class UnsafeUrlError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

/** true bila IPv4/IPv6 termasuk rentang yang tidak boleh dijangkau dari server. */
export function isPrivateAddress(address) {
  const version = net.isIP(address);
  if (version === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 192 && b === 0)
      || (a === 198 && (b === 18 || b === 19))
      || a >= 224;
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === '::1' || lower === '::' || lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return lower.startsWith('ff');
  }
  return true;
}

/**
 * Memastikan URL aman untuk diambil server.
 * @param {string} raw
 * @param {{ lookup?: (host:string)=>Promise<{address:string}[]> }} [options] resolver untuk tes
 * @returns {Promise<URL>}
 */
export async function assertPublicHttpUrl(raw, { lookup = (host) => dns.lookup(host, { all: true }) } = {}) {
  let url;
  try {
    url = new URL(String(raw || ''));
  } catch {
    throw new UnsafeUrlError('Alamat tidak valid.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new UnsafeUrlError('Hanya alamat http atau https yang diizinkan.');
  if (url.username || url.password) throw new UnsafeUrlError('Alamat dengan kredensial tidak diizinkan.');
  if (!ALLOWED_PORTS.has(url.port)) throw new UnsafeUrlError('Port tidak diizinkan.');
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || BLOCKED_HOSTNAMES.has(host) || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    throw new UnsafeUrlError('Alamat lokal tidak diizinkan.');
  }
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new UnsafeUrlError('Alamat jaringan privat tidak diizinkan.');
    return url;
  }
  let addresses;
  try {
    addresses = await lookup(host);
  } catch {
    throw new UnsafeUrlError('Host tidak dapat ditemukan.');
  }
  if (!addresses?.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new UnsafeUrlError('Host mengarah ke jaringan privat dan tidak diizinkan.');
  }
  return url;
}

/**
 * Mengambil URL dengan pemeriksaan setiap redirect (maks. 5 lompatan).
 * @returns {Promise<Response>}
 */
export async function fetchPublicUrl(raw, init = {}, { maxRedirects = 5, lookup, fetchImpl = fetch } = {}) {
  let current = await assertPublicHttpUrl(raw, { lookup });
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const response = await fetchImpl(current, { ...init, redirect: 'manual' });
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      if (hop === maxRedirects) throw new UnsafeUrlError('Terlalu banyak pengalihan.');
      current = await assertPublicHttpUrl(new URL(response.headers.get('location'), current).toString(), { lookup });
      continue;
    }
    return response;
  }
  throw new UnsafeUrlError('Terlalu banyak pengalihan.');
}
