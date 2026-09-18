import {
  Test,
  TestingModule,
} from '@nestjs/testing';

import {
  ResultExportService,
} from './result-export.service.js';

describe(
  'ResultExportService',
  () => {
    let service: ResultExportService;

    beforeEach(
      async () => {
        const module: TestingModule =
          await Test.createTestingModule({
            providers: [
              ResultExportService,
            ],
          }).compile();

        service =
          module.get<ResultExportService>(
            ResultExportService,
          );
      },
    );

    it(
      'should export query results as CSV',
      () => {
        const result =
          service.toCsv({
            sql:
              'SELECT city, sales FROM dataset',

            columns: [
              'city',
              'sales',
            ],

            rows: [
              [
                'Delhi',
                '2400',
              ],
              [
                'Lucknow',
                '1800',
              ],
            ],

            rowCount:
              2,

            truncated:
              false,

            executionTimeMs:
              10,

            summary: {
              totalRows:
                2,

              numericColumns: [],
            },

            visualization: {
              enabled:
                false,

              type:
                null,

              source:
                'automatic',

              language:
                'english',

              xAxis:
                null,

              yAxis:
                null,

              series: [],

              title:
                null,

              warning:
                null,

              reason:
                'No chartable result structure was detected.',
            },

            explanation:
              null,
          });

        expect(
          result.toString(
            'utf8',
          ),
        ).toBe(
          '\uFEFFcity,sales\r\nDelhi,2400\r\nLucknow,1800\r\n',
        );
      },
    );

    it(
      'should escape commas quotes and line breaks',
      () => {
        const result =
          service.toCsv({
            sql:
              'SELECT name FROM dataset',

            columns: [
              'name',
            ],

            rows: [
              [
                'Ali, "The Analyst"',
              ],
              [
                'Line 1\nLine 2',
              ],
            ],

            rowCount:
              2,

            truncated:
              false,

            executionTimeMs:
              5,

            summary: {
              totalRows:
                2,

              numericColumns: [],
            },

            visualization: {
              enabled:
                false,

              type:
                null,

              source:
                'automatic',

              language:
                'english',

              xAxis:
                null,

              yAxis:
                null,

              series: [],

              title:
                null,

              warning:
                null,

              reason:
                'No chartable result structure was detected.',
            },

            explanation:
              null,
          });

        const csv =
          result.toString(
            'utf8',
          );

        expect(
          csv,
        ).toContain(
          '"Ali, ""The Analyst"""',
        );

        expect(
          csv,
        ).toContain(
          '"Line 1\nLine 2"',
        );
      },
    );

    it(
      'should protect spreadsheet formulas',
      () => {
        const result =
          service.toCsv({
            sql:
              'SELECT value FROM dataset',

            columns: [
              'value',
            ],

            rows: [
              [
                '=SUM(A1:A2)',
              ],
              [
                '+123',
              ],
              [
                '@command',
              ],
              [
                '-10+20',
              ],
              [
                '100',
              ],
            ],

            rowCount:
              5,

            truncated:
              false,

            executionTimeMs:
              5,

            summary: {
              totalRows:
                5,

              numericColumns: [],
            },

            visualization: {
              enabled:
                false,

              type:
                null,

              source:
                'automatic',

              language:
                'english',

              xAxis:
                null,

              yAxis:
                null,

              series: [],

              title:
                null,

              warning:
                null,

              reason:
                'No chartable result structure was detected.',
            },

            explanation:
              null,
          });

        const csv =
          result.toString(
            'utf8',
          );

        expect(
          csv,
        ).toContain(
          "'=SUM(A1:A2)",
        );

        expect(
          csv,
        ).toContain(
          "'+123",
        );

        expect(
          csv,
        ).toContain(
          "'@command",
        );

        expect(
          csv,
        ).toContain(
          "'-10+20",
        );

        expect(
          csv,
        ).toContain(
          '100',
        );
      },
    );

    it(
      'should export headers even when there are no rows',
      () => {
        const result =
          service.toCsv({
            sql:
              'SELECT city FROM dataset WHERE 1 = 0',

            columns: [
              'city',
            ],

            rows: [],

            rowCount:
              0,

            truncated:
              false,

            executionTimeMs:
              3,

            summary: {
              totalRows:
                0,

              numericColumns: [],
            },

            visualization: {
              enabled:
                false,

              type:
                null,

              source:
                'automatic',

              language:
                'english',

              xAxis:
                null,

              yAxis:
                null,

              series: [],

              title:
                null,

              warning:
                null,

              reason:
                'No chartable result structure was detected.',
            },

            explanation:
              null,
          });

        expect(
          result.toString(
            'utf8',
          ),
        ).toBe(
          '\uFEFFcity\r\n',
        );
      },
    );
  },
);