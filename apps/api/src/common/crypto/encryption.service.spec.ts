import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

function service(key = Buffer.alloc(32, 3).toString('base64')): EncryptionService {
  return new EncryptionService({
    get: (name: string) => (name === 'MONITOR_ENCRYPTION_KEY' ? key : undefined),
  } as ConfigService);
}

describe('EncryptionService', () => {
  it('round-trips custom headers and exposes names without values', () => {
    const encryption = service();
    const headers = [
      { name: 'Authorization', value: 'Bearer secret-value' },
      { name: 'X-Environment', value: 'production' },
    ];
    const payload = encryption.encryptHeaders(headers);
    expect(payload.startsWith('v1.')).toBe(true);
    expect(payload).not.toContain('secret-value');
    expect(encryption.decryptHeaders(payload)).toEqual(headers);
    expect(encryption.headerNames(payload)).toEqual(['Authorization', 'X-Environment']);
  });

  it('rejects tampered ciphertext', () => {
    const encryption = service();
    const payload = encryption.encryptHeaders([{ name: 'Authorization', value: 'secret' }]);
    const parts = payload.split('.');
    const tampered = [parts[0], parts[1], parts[2], `${parts[3]}x`].join('.');
    expect(() => encryption.decryptHeaders(tampered)).toThrow(BadRequestException);
  });

  it('requires a 32-byte base64 key', () => {
    expect(() => service(Buffer.alloc(16).toString('base64'))).toThrow('32-byte');
    expect(() => service('')).toThrow('MONITOR_ENCRYPTION_KEY is required');
  });

  it('hashes refresh tokens deterministically with a secret', () => {
    const encryption = service();
    const first = encryption.hashRefreshToken('refresh-token', 'secret-a');
    const second = encryption.hashRefreshToken('refresh-token', 'secret-a');
    const different = encryption.hashRefreshToken('refresh-token', 'secret-b');
    expect(first).toBe(second);
    expect(first).not.toBe(different);
    expect(first).toHaveLength(64);
  });
});
