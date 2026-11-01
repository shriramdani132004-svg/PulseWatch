import { BadRequestException } from '@nestjs/common';
import { validateCustomHeaders } from './header-validation';

describe('validateCustomHeaders', () => {
  it('trims names and preserves values', () => {
    expect(validateCustomHeaders([{ name: ' Authorization ', value: 'Bearer token' }])).toEqual([
      { name: 'Authorization', value: 'Bearer token' },
    ]);
  });

  it('rejects reserved, duplicate, and newline-injected headers', () => {
    expect(() => validateCustomHeaders([{ name: 'Host', value: 'example.com' }])).toThrow(
      BadRequestException,
    );
    expect(() =>
      validateCustomHeaders([
        { name: 'X-Token', value: 'one' },
        { name: 'x-token', value: 'two' },
      ]),
    ).toThrow('more than once');
    expect(() =>
      validateCustomHeaders([{ name: 'X-Token', value: 'one\r\nInjected: yes' }]),
    ).toThrow('invalid value');
    expect(() => validateCustomHeaders([{ name: 'Bad Header', value: 'value' }])).toThrow(
      'invalid',
    );
  });

  it('rejects more than twenty headers', () => {
    const headers = Array.from({ length: 21 }, (_, index) => ({
      name: `X-Header-${index}`,
      value: 'value',
    }));
    expect(() => validateCustomHeaders(headers)).toThrow('at most 20');
  });
});
