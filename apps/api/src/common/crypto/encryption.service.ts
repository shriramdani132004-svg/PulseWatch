import { ConfigService } from '@nestjs/config';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, createHash, createHmac } from 'crypto';

export interface CustomHeader {
  name: string;
  value: string;
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const encoded = config.get<string>('MONITOR_ENCRYPTION_KEY');
    if (!encoded) {
      throw new Error('MONITOR_ENCRYPTION_KEY is required');
    }
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32) {
      throw new Error('MONITOR_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
    }
    this.key = key;
  }

  encryptHeaders(headers: CustomHeader[]): string {
    if (headers.length === 0) {
      return '';
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const plaintext = Buffer.from(JSON.stringify(headers), 'utf8');
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  decryptHeaders(payload: string | null | undefined): CustomHeader[] {
    if (!payload) {
      return [];
    }
    try {
      const [version, ivPart, tagPart, dataPart] = payload.split('.');
      if (version !== 'v1' || !ivPart || !tagPart || !dataPart) {
        throw new Error('Unsupported encrypted header format');
      }
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivPart, 'base64url'));
      decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(dataPart, 'base64url')),
        decipher.final(),
      ]);
      const parsed: unknown = JSON.parse(decrypted.toString('utf8'));
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(
        (item): item is CustomHeader =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as CustomHeader).name === 'string' &&
          typeof (item as CustomHeader).value === 'string',
      );
    } catch {
      this.logger.error('Stored monitor headers could not be decrypted');
      throw new BadRequestException('Stored monitor headers are unavailable; replace them before checking.');
    }
  }

  headerNames(payload: string | null | undefined): string[] {
    return this.decryptHeaders(payload).map((header) => header.name);
  }

  hashRefreshToken(token: string, secret: string): string {
    return createHmac('sha256', secret).update(token).digest('hex');
  }

  sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
