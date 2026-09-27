import { describe, expect, it } from 'vitest';
import { sanitizeLogValue } from './log-sanitizer.js';

describe('log sanitizer', () => {
  it('redacts secret-like keys', () => {
    expect(
      sanitizeLogValue({
        password: 'super-secret',
        apiKey: 'hidden',
        safe: 'value',
      }),
    ).toEqual({
      password: '[REDACTED]',
      apiKey: '[REDACTED]',
      safe: 'value',
    });
  });

  it('redacts bearer tokens', () => {
    expect(
      sanitizeLogValue({
        authorization:
          'Bearer abcdefghijklmnopqrstuvwxyz123456',
      }),
    ).toEqual({
      authorization: '[REDACTED]',
    });
  });
});
