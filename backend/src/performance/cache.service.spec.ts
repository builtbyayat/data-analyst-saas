import { describe, expect, it, vi } from 'vitest';
import { CacheService } from './cache.service.js';

function createRedisMock() {
  return {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  };
}

describe('CacheService', () => {
  it('returns parsed cached JSON', async () => {
    const redis = createRedisMock();
    redis.get.mockResolvedValue(
      JSON.stringify({ ok: true }),
    );

    const service = new CacheService(redis as never);

    await expect(
      service.get('cache-key'),
    ).resolves.toEqual({ ok: true });
  });

  it('fails open when Redis read fails', async () => {
    const redis = createRedisMock();
    redis.get.mockRejectedValue(
      new Error('redis unavailable'),
    );

    const service = new CacheService(redis as never);

    await expect(
      service.get('cache-key'),
    ).resolves.toBeNull();
  });

  it('hashes cache keys deterministically', () => {
    const first = CacheService.hashKey('abc');
    const second = CacheService.hashKey('abc');

    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });
});
