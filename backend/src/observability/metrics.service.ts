import { Injectable } from '@nestjs/common';

interface MetricValue {
  count: number;
  total: number;
  max: number;
}

@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, number>();
  private readonly durations = new Map<
    string,
    MetricValue
  >();

  increment(
    name: string,
    value = 1,
  ): void {
    if (
      !Number.isFinite(value) ||
      value <= 0
    ) {
      return;
    }

    this.counters.set(
      name,
      (this.counters.get(name) ?? 0) + value,
    );
  }

  observe(
    name: string,
    value: number,
  ): void {
    if (
      !Number.isFinite(value) ||
      value < 0
    ) {
      return;
    }

    const current =
      this.durations.get(name) ?? {
        count: 0,
        total: 0,
        max: 0,
      };

    current.count += 1;
    current.total += value;
    current.max = Math.max(
      current.max,
      value,
    );

    this.durations.set(name, current);
  }

  snapshot(): Record<string, unknown> {
    const counters: Record<string, number> = {};

    for (const [name, value] of this.counters) {
      counters[name] = value;
    }

    const durations: Record<string, unknown> = {};

    for (const [name, value] of this.durations) {
      durations[name] = {
        count: value.count,
        totalMs: Number(
          value.total.toFixed(2),
        ),
        averageMs: Number(
          (
            value.total / value.count
          ).toFixed(2),
        ),
        maxMs: Number(
          value.max.toFixed(2),
        ),
      };
    }

    return {
      counters,
      durations,
      generatedAt:
        new Date().toISOString(),
    };
  }
}
