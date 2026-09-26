import {
  describe,
  expect,
  it,
} from 'vitest';

import { ReportExportService } from './report-export.service.js';

const report = {
  report: {
    id: 'report-1',
    workspaceId: 'workspace-1',
    title: 'Revenue Report',
    description: 'Monthly review',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  },
  generatedAt: new Date('2026-01-03T00:00:00.000Z'),
  sections: [
    {
      title: 'Revenue',
      description: null,
      question: 'How much revenue?',
      datasetCount: 1,
      resultSnapshot: {
        columns: ['month', 'amount'],
        rows: [
          ['Jan', 100],
          ['Feb', '=SUM(A1)'],
        ],
      },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    },
  ],
  missingSectionCount: 0,
} as const;

describe('ReportExportService', () => {
  const service = new ReportExportService();

  it('exports the generated report as JSON', () => {
    const json = service.toJson(report).toString('utf8');

    expect(json).toContain('Revenue Report');
    expect(json).toContain('How much revenue?');
  });

  it('exports report sections as CSV with formula injection protection', () => {
    const csv = service.toCsv(report).toString('utf8');

    expect(csv).toContain('Revenue Report');
    expect(csv).toContain("'=SUM(A1)");
  });

  it('exports report sections as XLSX', () => {
    const xlsx = service.toXlsx(report);

    expect(Buffer.isBuffer(xlsx)).toBe(true);
    expect(xlsx.subarray(0, 2).toString('hex')).toBe('504b');
  });
});
