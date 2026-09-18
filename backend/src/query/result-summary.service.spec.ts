import { ResultSummaryService } from './result-summary.service.js';

describe('ResultSummaryService', () => {
  let service: ResultSummaryService;

  beforeEach(() => {
    service =
      new ResultSummaryService();
  });

  it('should summarize numeric columns', () => {
    const result =
      service.summarize(
        [
          'city',
          'sales',
        ],
        [
          ['Delhi', 2400],
          ['Lucknow', 1800],
          ['Kanpur', 1200],
        ],
      );

    expect(result).toEqual({
      totalRows: 3,

      numericColumns: [
        {
          column: 'sales',
          sum: 5400,
          average: 1800,
          min: 1200,
          max: 2400,
        },
      ],
    });
  });

  it('should support numeric strings', () => {
    const result =
      service.summarize(
        [
          'sales',
        ],
        [
          ['1200'],
          ['1800'],
          ['2400'],
        ],
      );

    expect(result.numericColumns).toEqual([
      {
        column: 'sales',
        sum: 5400,
        average: 1800,
        min: 1200,
        max: 2400,
      },
    ]);
  });

  it('should ignore nullable numeric values', () => {
    const result =
      service.summarize(
        [
          'sales',
        ],
        [
          ['1200'],
          [null],
          ['1800'],
          [''],
        ],
      );

    expect(result).toEqual({
      totalRows: 4,

      numericColumns: [
        {
          column: 'sales',
          sum: 3000,
          average: 1500,
          min: 1200,
          max: 1800,
        },
      ],
    });
  });

  it('should ignore non-numeric columns', () => {
    const result =
      service.summarize(
        [
          'city',
        ],
        [
          ['Delhi'],
          ['Lucknow'],
          ['Kanpur'],
        ],
      );

    expect(result).toEqual({
      totalRows: 3,
      numericColumns: [],
    });
  });

  it('should return no numeric summaries for an empty result', () => {
    const result =
      service.summarize(
        [
          'city',
          'sales',
        ],
        [],
      );

    expect(result).toEqual({
      totalRows: 0,
      numericColumns: [],
    });
  });
});