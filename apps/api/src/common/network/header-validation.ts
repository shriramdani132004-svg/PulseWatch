import { BadRequestException } from '@nestjs/common';
import type { CustomHeader } from '../crypto/encryption.service';

const HEADER_NAME_PATTERN = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;
const RESTRICTED_HEADERS = new Set([
  'host',
  'content-length',
  'transfer-encoding',
  'connection',
  'upgrade',
  'proxy-connection',
  'keep-alive',
  'te',
  'trailer',
  'expect',
]);

export function validateCustomHeaders(headers: CustomHeader[]): CustomHeader[] {
  if (headers.length > 20) {
    throw new BadRequestException('A monitor may define at most 20 custom headers');
  }
  const seen = new Set<string>();
  return headers.map((header) => {
    const name = header.name.trim();
    const value = header.value;
    const lower = name.toLowerCase();
    if (!HEADER_NAME_PATTERN.test(name) || name.length > 64) {
      throw new BadRequestException(`Custom header name "${name.slice(0, 20)}" is invalid`);
    }
    if (RESTRICTED_HEADERS.has(lower)) {
      throw new BadRequestException(`Custom header "${name}" is reserved and cannot be set`);
    }
    if (seen.has(lower)) {
      throw new BadRequestException(`Custom header "${name}" is defined more than once`);
    }
    seen.add(lower);
    if (/[\r\n\0]/.test(value) || value.length > 2048) {
      throw new BadRequestException(`Custom header "${name}" has an invalid value`);
    }
    return { name, value };
  });
}
