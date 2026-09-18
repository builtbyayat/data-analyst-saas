import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  ResultVisualizationService,
} from './result-visualization.service.js';

describe(
  'ResultVisualizationService',
  () => {
    const service =
      new ResultVisualizationService();

    it(
      'should automatically select a bar chart for categorical and numeric data',
      () => {
        const result =
          service.analyze(
            [
              'city',
              'total_sales',
            ],
            [
              [
                'Delhi',
                '2400',
              ],
              [
                'Lucknow',
                '1800',
              ],
              [
                'Kanpur',
                '1200',
              ],
            ],
            'Show total sales by city',
          );

        expect(
          result.enabled,
        ).toBe(true);

        expect(
          result.type,
        ).toBe('bar');

        expect(
          result.source,
        ).toBe('automatic');

        expect(
          result.xAxis,
        ).toBe('city');

        expect(
          result.yAxis,
        ).toBe('total_sales');

        expect(
          result.warning,
        ).toBeNull();
      },
    );

    it(
      'should automatically select a line chart for date and numeric data',
      () => {
        const result =
          service.analyze(
            [
              'month',
              'revenue',
            ],
            [
              [
                '2026-01-01',
                '1000',
              ],
              [
                '2026-02-01',
                '1400',
              ],
              [
                '2026-03-01',
                '1900',
              ],
            ],
            'Show revenue over time',
          );

        expect(
          result.type,
        ).toBe('line');

        expect(
          result.source,
        ).toBe('automatic');

        expect(
          result.xAxis,
        ).toBe('month');

        expect(
          result.yAxis,
        ).toBe('revenue');
      },
    );

    it(
      'should honor a valid user-requested chart type',
      () => {
        const result =
          service.analyze(
            [
              'category',
              'sales',
            ],
            [
              [
                'A',
                '100',
              ],
              [
                'B',
                '200',
              ],
              [
                'C',
                '300',
              ],
            ],
            'Show sales by category as a bar chart',
          );

        expect(
          result.type,
        ).toBe('bar');

        expect(
          result.source,
        ).toBe('user_requested');

        expect(
          result.enabled,
        ).toBe(true);

        expect(
          result.warning,
        ).toBeNull();
      },
    );

    it(
      'should reject an unsuitable user-requested line chart',
      () => {
        const result =
          service.analyze(
            [
              'city',
              'sales',
            ],
            [
              [
                'Delhi',
                '2400',
              ],
              [
                'Lucknow',
                '1800',
              ],
              [
                'Kanpur',
                '1200',
              ],
            ],
            'Show sales by city as a line chart',
          );

        expect(
          result.enabled,
        ).toBe(false);

        expect(
          result.type,
        ).toBeNull();

        expect(
          result.warning,
        ).toContain(
          'Line chart was not generated',
        );
      },
    );

    it(
      'should detect Hinglish and return a Hinglish warning',
      () => {
        const result =
          service.analyze(
            [
              'city',
              'sales',
            ],
            [
              [
                'Delhi',
                '2400',
              ],
              [
                'Lucknow',
                '1800',
              ],
            ],
            'city ke sales ko line chart me dikhao',
          );

        expect(
          result.enabled,
        ).toBe(false);

        expect(
          result.language,
        ).toBe('hinglish');

        expect(
          result.warning,
        ).toContain(
          'generate nahi kiya gaya',
        );
      },
    );

    it(
      'should support a valid pie chart request',
      () => {
        const result =
          service.analyze(
            [
              'category',
              'share',
            ],
            [
              [
                'A',
                '40',
              ],
              [
                'B',
                '35',
              ],
              [
                'C',
                '25',
              ],
            ],
            'Show category share as a pie chart',
          );

        expect(
          result.enabled,
        ).toBe(true);

        expect(
          result.type,
        ).toBe('pie');

        expect(
          result.source,
        ).toBe('user_requested');
      },
    );

    it(
      'should fall back to table when no reliable chart structure exists',
      () => {
        const result =
          service.analyze(
            [
              'name',
              'email',
              'address',
            ],
            [
              [
                'Ali',
                'ali@example.com',
                'Kanpur',
              ],
              [
                'Sara',
                'sara@example.com',
                'Lucknow',
              ],
            ],
            'Show customer details',
          );

        expect(
          result.enabled,
        ).toBe(true);

        expect(
          result.type,
        ).toBe('table');

        expect(
          result.source,
        ).toBe('automatic');
      },
    );
  },
);