import { describe, expect, it, vi } from 'vitest';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('reports healthy dependencies', async () => {
    const dataSource = {
      query: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const redis = {
      ping: vi.fn().mockResolvedValue('PONG'),
    };

    const service = new HealthService(
      dataSource as never,
      redis as never,
    );

    await expect(
      service.check(),
    ).resolves.toMatchObject({
      status: 'ok',
      checks: {
        postgres: 'ok',
        redis: 'ok',
      },
    });
  });

  it('reports degraded state when a dependency fails', async () => {
    const dataSource = {
      query: vi.fn().mockRejectedValue(
        new Error('database unavailable'),
      ),
    };
    const redis = {
      ping: vi.fn().mockResolvedValue('PONG'),
    };

    const service = new HealthService(
      dataSource as never,
      redis as never,
    );

    await expect(
      service.check(),
    ).resolves.toMatchObject({
      status: 'degraded',
      checks: {
        postgres: 'error',
        redis: 'ok',
      },
    });
  });
});
