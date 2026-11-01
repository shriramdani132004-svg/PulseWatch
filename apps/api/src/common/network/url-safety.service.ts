import { BadRequestException, Injectable } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import ipaddr from 'ipaddr.js';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
  'metadata',
  'metadata.azure.com',
]);

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa', '.test', '.invalid', '.example'];

const BLOCKED_IPV4_CIDRS = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.88.99.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
  '255.255.255.255/32',
] as const;

const BLOCKED_IPV6_CIDRS = [
  '::/128',
  '::1/128',
  '64:ff9b::/96',
  '64:ff9b:1::/48',
  '100::/64',
  '2001::/32',
  '2001:2::/48',
  '2001:10::/28',
  '2001:20::/28',
  '2001:db8::/32',
  '2002::/16',
  '3fff::/20',
  '5f00::/16',
  'fc00::/7',
  'fe80::/10',
  'ff00::/8',
] as const;

export class UnsafeTargetError extends Error {
  constructor(message = 'Target address is not allowed') {
    super(message);
    this.name = 'UnsafeTargetError';
  }
}

export interface SafeTarget {
  url: URL;
  hostname: string;
  addresses: string[];
  family: 4 | 6;
}

export interface DnsAnswer {
  address: string;
  family: number;
}

function ipv4ToInt(address: string): number {
  const parts = address.split('.').map(Number);
  return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

function inIpv4Cidr(address: string, cidr: string): boolean {
  const [network, bitsRaw] = cidr.split('/');
  const bits = Number(bitsRaw);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4ToInt(address) & mask) === (ipv4ToInt(network) & mask);
}

function inIpv6Cidr(address: ipaddr.IPv6, cidr: string): boolean {
  const [network, bitsRaw] = cidr.split('/');
  const parsedNetwork = ipaddr.IPv6.parse(network);
  return address.match(parsedNetwork, Number(bitsRaw));
}

export function isPublicIp(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    for (const cidr of BLOCKED_IPV4_CIDRS) {
      if (inIpv4Cidr(address, cidr)) {
        return false;
      }
    }
    const parsed = ipaddr.IPv4.parse(address);
    return parsed.range() === 'unicast';
  }

  if (family === 6) {
    let parsed: ipaddr.IPv6;
    try {
      parsed = ipaddr.IPv6.parse(address);
    } catch {
      return false;
    }
    if (parsed.isIPv4MappedAddress()) {
      return isPublicIp(parsed.toIPv4Address().toString());
    }
    if (parsed.range() !== 'unicast') {
      return false;
    }
    for (const cidr of BLOCKED_IPV6_CIDRS) {
      if (inIpv6Cidr(parsed, cidr)) {
        return false;
      }
    }
    return true;
  }

  return false;
}

export function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[/, '').replace(/\]$/, '').replace(/\.$/, '').toLowerCase();
}

@Injectable()
export class UrlSafetyService {
  // Assigned as a property so tests can provide deterministic DNS answers.
  lookup: typeof lookup = lookup;

  async assertSafeUrl(raw: string): Promise<SafeTarget> {
    let parsed: URL;
    try {
      parsed = new URL(raw.trim());
    } catch {
      throw new UnsafeTargetError('Target URL is invalid');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new UnsafeTargetError('Only HTTP and HTTPS targets are allowed');
    }
    if (parsed.username || parsed.password) {
      throw new UnsafeTargetError('Target URLs must not contain embedded credentials');
    }
    if (!parsed.hostname) {
      throw new UnsafeTargetError('Target URL must include a hostname');
    }

    parsed.hash = '';
    const hostname = normalizeHostname(parsed.hostname);
    if (!hostname || hostname.length > 253) {
      throw new UnsafeTargetError('Target hostname is invalid');
    }
    if (hostname.includes('%')) {
      throw new UnsafeTargetError('IPv6 zone identifiers are not allowed');
    }
    if (BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
      throw new UnsafeTargetError('Target hostname is not allowed');
    }

    const literalFamily = isIP(hostname);
    let addresses: string[];
    if (literalFamily) {
      if (!isPublicIp(hostname)) {
        throw new UnsafeTargetError('Target IP address is not public');
      }
      addresses = [hostname];
    } else {
      const answers = await this.resolveWithTimeout(hostname);
      if (answers.length === 0) {
        throw new UnsafeTargetError('Target hostname did not resolve');
      }
      const unique = [...new Set(answers.map((answer) => answer.address))];
      for (const address of unique) {
        if (!isPublicIp(address)) {
          throw new UnsafeTargetError('Target hostname resolves to a non-public address');
        }
      }
      addresses = unique;
    }

    const family = isIP(addresses[0]) as 4 | 6;
    return { url: parsed, hostname, addresses, family };
  }

  private async resolveWithTimeout(hostname: string): Promise<DnsAnswer[]> {
    const timeout = new Promise<never>((_resolve, reject) => {
      const timer = setTimeout(() => reject(new UnsafeTargetError('DNS resolution timed out')), 5_000);
      timer.unref?.();
    });
    try {
      const answers = await Promise.race([
        this.lookup(hostname, { all: true, verbatim: true }) as Promise<DnsAnswer[]>,
        timeout,
      ]);
      return answers.filter(
        (answer): answer is DnsAnswer =>
          typeof answer?.address === 'string' && (answer.family === 4 || answer.family === 6),
      );
    } catch (error) {
      if (error instanceof UnsafeTargetError) {
        throw error;
      }
      throw new UnsafeTargetError('Target hostname could not be resolved');
    }
  }

  async validateUrlOrThrow(raw: string): Promise<SafeTarget> {
    try {
      return await this.assertSafeUrl(raw);
    } catch (error) {
      if (error instanceof UnsafeTargetError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
