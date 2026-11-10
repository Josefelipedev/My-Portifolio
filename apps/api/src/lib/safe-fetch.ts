// Fetching URLs that come from outside: job listings, careers pages, saved
// jobs. The API container shares the host's network, so an unchecked URL (or
// a redirect from a public page) could make it call services that are only
// meant to be reachable from inside the server: Ollama, the scraper, anything
// on the WireGuard VPN. Every hop must be http(s) and resolve to a public
// address.
//
// The address is checked before the request, and fetch resolves the name again
// when it connects, so a DNS answer that changes in between (rebinding) is not
// covered. That is acceptable for these GET-only page reads.

import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

const MAX_REDIRECTS = 5;

// Node checks IPv4-mapped IPv6 addresses (::ffff:a.b.c.d) against the IPv4
// rules too, so those need no separate entry.
const NON_PUBLIC = new BlockList();
const IPV4_RANGES: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 3], // multicast, reserved and broadcast
];
const IPV6_RANGES: Array<[string, number]> = [
  ['::', 96], // unspecified, loopback and IPv4-compatible
  ['64:ff9b::', 96], // NAT64
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
];
IPV4_RANGES.forEach(([network, prefix]) => NON_PUBLIC.addSubnet(network, prefix, 'ipv4'));
IPV6_RANGES.forEach(([network, prefix]) => NON_PUBLIC.addSubnet(network, prefix, 'ipv6'));

export class BlockedUrlError extends Error {}

/** Throws BlockedUrlError unless the URL is http(s) and every address it resolves to is public. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError(`Invalid URL: ${raw}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BlockedUrlError(`Only http(s) URLs can be fetched: ${url.protocol}`);
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const literalFamily = isIP(host);
  const addresses = literalFamily
    ? [{ address: host, family: literalFamily }]
    : await lookup(host, { all: true, verbatim: true });

  for (const { address, family } of addresses) {
    if (NON_PUBLIC.check(address, family === 6 ? 'ipv6' : 'ipv4')) {
      throw new BlockedUrlError(`URL points to a non-public address: ${url.hostname}`);
    }
  }
  return url;
}

/** fetch() for outside URLs: validates the URL and every redirect it follows. */
export async function fetchPublicUrl(raw: string, init: RequestInit = {}): Promise<Response> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    const response = await fetch(url.href, { ...init, redirect: 'manual' });
    const location = response.headers?.get('location');
    if (response.status < 300 || response.status >= 400 || !location) return response;

    await response.body?.cancel();
    current = new URL(location, url).href;
  }
  throw new BlockedUrlError(`Too many redirects: ${raw}`);
}
