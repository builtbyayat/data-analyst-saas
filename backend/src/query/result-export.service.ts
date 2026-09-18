import {
  Injectable,
} from '@nestjs/common';

import type {
  DatasetQueryResult,
} from './query.service.js';

@Injectable()
export class ResultExportService {
  toCsv(
    result: DatasetQueryResult,
  ): Buffer {
    const header =
      result.columns
        .map(
          (column) =>
            this.escapeCsvCell(
              column,
            ),
        )
        .join(',');

    const rows =
      result.rows.map(
        (row) =>
          row
            .map(
              (value) =>
                this.escapeCsvCell(
                  value,
                ),
            )
            .join(','),
      );

    const csv =
      [
        header,
        ...rows,
      ].join('\r\n') +
      '\r\n';

    return Buffer.from(
      `\uFEFF${csv}`,
      'utf8',
    );
  }

  private escapeCsvCell(
    value: unknown,
  ): string {
    const raw =
      value === null ||
      value === undefined
        ? ''
        : String(value);

    const safeValue =
      this.preventSpreadsheetFormulaInjection(
        raw,
      );

    if (
      /[",\r\n]/.test(
        safeValue,
      )
    ) {
      return `"${safeValue.replace(
        /"/g,
        '""',
      )}"`;
    }

    return safeValue;
  }

  private preventSpreadsheetFormulaInjection(
    value: string,
  ): string {
    const trimmed =
      value.trim();

    if (
      /^[-+@=]/.test(trimmed) &&
      !/^-?\d+(?:\.\d+)?$/.test(
        trimmed,
      )
    ) {
      return `'${value}`;
    }

    return value;
  }
}