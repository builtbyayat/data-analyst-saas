import {
  Injectable,
} from '@nestjs/common';

export interface ResultNumericColumnSummary {
  column: string;
  sum: number;
  average: number;
  min: number;
  max: number;
}

export interface QueryResultSummary {
  totalRows: number;
  numericColumns: ResultNumericColumnSummary[];
}

@Injectable()
export class ResultSummaryService {
  summarize(
    columns: string[],
    rows: unknown[][],
  ): QueryResultSummary {
    const numericColumns: ResultNumericColumnSummary[] =
      [];

    columns.forEach(
      (
        column,
        columnIndex,
      ) => {
        const values: number[] = [];

        let nonEmptyValueCount = 0;

        for (const row of rows) {
          const value =
            row[columnIndex];

          if (
            value === null ||
            value === undefined ||
            (
              typeof value === 'string' &&
              value.trim() === ''
            )
          ) {
            continue;
          }

          nonEmptyValueCount += 1;

          const numericValue =
            this.toFiniteNumber(
              value,
            );

          if (
            numericValue === null
          ) {
            return;
          }

          values.push(
            numericValue,
          );
        }

        if (
          nonEmptyValueCount === 0 ||
          values.length !==
            nonEmptyValueCount
        ) {
          return;
        }

        const sum =
          values.reduce(
            (
              total,
              value,
            ) =>
              total + value,
            0,
          );

        const average =
          sum / values.length;

        const min =
          Math.min(
            ...values,
          );

        const max =
          Math.max(
            ...values,
          );

        numericColumns.push({
          column,
          sum,
          average,
          min,
          max,
        });
      },
    );

    return {
      totalRows:
        rows.length,

      numericColumns,
    };
  }

  private toFiniteNumber(
    value: unknown,
  ): number | null {
    if (
      typeof value === 'number'
    ) {
      return Number.isFinite(
        value,
      )
        ? value
        : null;
    }

    if (
      typeof value === 'bigint'
    ) {
      const numberValue =
        Number(value);

      return Number.isFinite(
        numberValue,
      )
        ? numberValue
        : null;
    }

    if (
      typeof value === 'string'
    ) {
      const normalized =
        value.trim();

      if (!normalized) {
        return null;
      }

      const numberValue =
        Number(normalized);

      return Number.isFinite(
        numberValue,
      )
        ? numberValue
        : null;
    }

    return null;
  }
}