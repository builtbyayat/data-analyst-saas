import {
  Injectable,
} from '@nestjs/common';

import * as XLSX from 'xlsx';

import type {
  GeneratedReport,
} from './report-presentation.service.js';

@Injectable()
export class ReportExportService {
  toJson(
    report: GeneratedReport,
  ): Buffer {
    return Buffer.from(
      JSON.stringify(
        report,
        null,
        2,
      ),
      'utf8',
    );
  }

  toCsv(
    report: GeneratedReport,
  ): Buffer {
    const lines: string[] = [];

    lines.push(
      `${this.escapeCsvCell('Report')},${this.escapeCsvCell(report.report.title)}`,
    );

    if (report.report.description) {
      lines.push(
        `${this.escapeCsvCell('Description')},${this.escapeCsvCell(report.report.description)}`,
      );
    }

    lines.push('');

    report.sections.forEach((section, index) => {
      lines.push(
        `${this.escapeCsvCell(`Analysis ${index + 1}`)},${this.escapeCsvCell(section.title)}`,
      );

      if (section.question) {
        lines.push(
          `${this.escapeCsvCell('Question')},${this.escapeCsvCell(section.question)}`,
        );
      }

      const table =
        this.snapshotToTable(
          section.resultSnapshot,
        );

      if (table.columns.length > 0) {
        lines.push(
          table.columns
            .map((column) =>
              this.escapeCsvCell(column),
            )
            .join(','),
        );

        for (const row of table.rows) {
          lines.push(
            table.columns
              .map((_, columnIndex) =>
                this.escapeCsvCell(
                  row[columnIndex],
                ),
              )
              .join(','),
          );
        }
      }

      if (index < report.sections.length - 1) {
        lines.push('');
        lines.push('');
      }
    });

    return Buffer.from(
      `\uFEFF${lines.join('\r\n')}\r\n`,
      'utf8',
    );
  }

  toXlsx(
    report: GeneratedReport,
  ): Buffer {
    const workbook =
      XLSX.utils.book_new();

    const summaryRows: unknown[][] = [
      ['Report', report.report.title],
      ['Description', report.report.description ?? ''],
      ['Generated at', report.generatedAt.toISOString()],
      ['Sections', report.sections.length],
    ];

    if (report.missingSectionCount > 0) {
      summaryRows.push([
        'Missing sections',
        report.missingSectionCount,
      ]);
    }

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(
        summaryRows,
      ),
      'Report',
    );

    report.sections.forEach((section, index) => {
      const table =
        this.snapshotToTable(
          section.resultSnapshot,
        );

      const rows: unknown[][] = [
        ['Analysis', section.title],
      ];

      if (section.question) {
        rows.push([
          'Question',
          section.question,
        ]);
      }

      rows.push([]);

      if (table.columns.length > 0) {
        rows.push(table.columns);
        rows.push(...table.rows);
      } else {
        rows.push([
          'No tabular result snapshot',
        ]);
      }

      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet(rows),
        this.sheetName(
          section.title,
          index,
        ),
      );
    });

    return XLSX.write(
      workbook,
      {
        type: 'buffer',
        bookType: 'xlsx',
      },
    );
  }

  private snapshotToTable(
    snapshot: Record<string, unknown>,
  ): {
    columns: string[];
    rows: unknown[][];
  } {
    const columns =
      Array.isArray(snapshot.columns)
        ? snapshot.columns.filter(
            (value): value is string =>
              typeof value === 'string',
          )
        : [];

    const rows =
      Array.isArray(snapshot.rows)
        ? snapshot.rows.filter(
            (value): value is unknown[] =>
              Array.isArray(value),
          )
        : [];

    return {
      columns,
      rows,
    };
  }

  private escapeCsvCell(
    value: unknown,
  ): string {
    const raw =
      value === null ||
      value === undefined
        ? ''
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);

    const safe =
      /^[=+\-@]/.test(raw)
        ? `'${raw}`
        : raw;

    return /[",\r\n]/.test(safe)
      ? `"${safe.replace(/"/g, '""')}"`
      : safe;
  }

  private sheetName(
    title: string,
    index: number,
  ): string {
    const base =
      title
        .replace(/[\\/?*\[\]:]/g, ' ')
        .trim() ||
      `Analysis ${index + 1}`;

    const suffix =
      ` ${index + 1}`;

    return `${base.slice(
      0,
      31 - suffix.length,
    )}${suffix}`;
  }
}
