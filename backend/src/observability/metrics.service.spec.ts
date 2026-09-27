import { describe, expect, it } from 'vitest';
import { MetricsService } from './metrics.service.js';

describe('MetricsService', () => {
  it('tracks counters and durations', () => {
    const service = new MetricsService();

    service.increment('requests');
    service.increment('requests', 2);
    service.observe('latency', 10);
    service.observe('latency', 20);

    expect(
      service.snapshot(),
    ).toMatchObject({
      counters: {
        requests: 3,
      },
      durations: {
        latency: {
          count: 2,
          totalMs: 30,
          averageMs: 15,
          maxMs: 20,
        },
      },
    });
  });
});
