import { describe, expect, it, vi } from 'vitest';
import { QueryCacheService } from './query-cache.service.js';

function createCacheMock() {
  return {
    get: vi.fn(),
    set: vi.fn(),
  };
}

describe('QueryCacheService', () => {
  it('normalizes SQL when building the cache key', async () => {
    const cache = createCacheMock();
    cache.get.mockResolvedValue(null);

    const service = new QueryCacheService(
      cache as never,
    );

    await service.get(
      'workspace-1',
      'dataset-1',
      '2026-09-27T10:00:00.000Z',
      'SELECT   *\nFROM dataset',
    );

    await service.get(
      'workspace-1',
      'dataset-1',
      '2026-09-27T10:00:00.000Z',
      'SELECT * FROM dataset',
    );

    expect(cache.get).toHaveBeenCalledTimes(2);
    expect(cache.get.mock.calls[0][0]).toBe(
      cache.get.mock.calls[1][0],
    );
  });

  it('does not cache oversized result sets', async () => {
    const cache = createCacheMock();
    cache.set.mockResolvedValue(true);

    const service = new QueryCacheService(
      cache as never,
    );

    const rows = Array.from(
      { length: 5001 },
      () => [1],
    );

    await expect(
      service.set(
        'workspace-1',
        'dataset-1',
        'v1',
        'SELECT * FROM dataset',
        {
          columns: ['value'],
          rows,
        },
      ),
    ).resolves.toBe(false);

    expect(cache.set).not.toHaveBeenCalled();
  });
});
