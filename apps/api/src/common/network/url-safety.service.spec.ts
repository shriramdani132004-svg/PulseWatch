import { BadRequestException } from '@nestjs/common';
import {
  isPublicIp,
  normalizeHostname,
  UnsafeTargetError,
  UrlSafetyService,
} from './url-safety.service';

describe('UrlSafetyService', () => {
  let service: UrlSafetyService;

  beforeEach(() => {
    service = new UrlSafetyService();
  });

  it('classifies public and reserved addresses', () => {
    expect(isPublicIp('1.1.1.1')).toBe(true);
    expect(isPublicIp('93.184.216.34')).toBe(true);
    expect(isPublicIp('2606:4700:4700::1111')).toBe(true);

    for (const address of [
      '127.0.0.1',
      '10.0.0.1',
      '172.16.0.1',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '240.0.0.1',
      '::1',
      'fc00::1',
      'fe80::1',
      'ff02::1',
      '::ffff:127.0.0.1',
      '2001:db8::1',
    ]) {
      expect(isPublicIp(address)).toBe(false);
    }
  });

  it('normalizes hostnames', () => {
    expect(normalizeHostname('[::1]')).toBe('::1');
    expect(normalizeHostname('Example.COM.')).toBe('example.com');
  });

  it('accepts a public IP literal without DNS', async () => {
    const target = await service.assertSafeUrl('https://1.1.1.1/health?ready=1#fragment');
    expect(target.hostname).toBe('1.1.1.1');
    expect(target.addresses).toEqual(['1.1.1.1']);
    expect(target.family).toBe(4);
    expect(target.url.hash).toBe('');
  });

  it('rejects localhost, metadata hostnames, credentials, and non-HTTP protocols', async () => {
    await expect(service.assertSafeUrl('http://localhost:4000')).rejects.toBeInstanceOf(UnsafeTargetError);
    await expect(service.assertSafeUrl('http://metadata.google.internal/')).rejects.toBeInstanceOf(UnsafeTargetError);
    await expect(service.assertSafeUrl('https://user:pass@example.com/')).rejects.toBeInstanceOf(UnsafeTargetError);
    await expect(service.assertSafeUrl('ftp://example.com/file')).rejects.toBeInstanceOf(UnsafeTargetError);
    await expect(service.assertSafeUrl('not a url')).rejects.toBeInstanceOf(UnsafeTargetError);
  });

  it('rejects a hostname that resolves to a private address', async () => {
    service.lookup = jest.fn().mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]) as unknown as typeof service.lookup;

    await expect(service.assertSafeUrl('https://api.example.com/health')).rejects.toThrow(
      'resolves to a non-public address',
    );
  });

  it('rejects mixed public and private IPv6 answers', async () => {
    service.lookup = jest.fn().mockResolvedValue([
      { address: '2606:4700:4700::1111', family: 6 },
      { address: 'fd00::1', family: 6 },
    ]) as unknown as typeof service.lookup;

    await expect(service.assertSafeUrl('https://api.example.com/health')).rejects.toThrow(
      'resolves to a non-public address',
    );
  });

  it('accepts only when every DNS answer is public', async () => {
    service.lookup = jest.fn().mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:4700:4700::1111', family: 6 },
    ]) as unknown as typeof service.lookup;

    const target = await service.assertSafeUrl('https://api.example.com/health');
    expect(target.addresses).toEqual(['93.184.216.34', '2606:4700:4700::1111']);
    expect(target.family).toBe(4);
  });

  it('rejects an empty DNS answer and maps errors to BadRequestException', async () => {
    service.lookup = jest.fn().mockResolvedValue([]) as unknown as typeof service.lookup;
    await expect(service.validateUrlOrThrow('https://api.example.com/health')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
