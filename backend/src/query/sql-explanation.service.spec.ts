import {
  Test,
  TestingModule,
} from '@nestjs/testing';

import { vi } from 'vitest';

import { AiService } from '../ai/ai.service.js';

import {
  SqlExplanationService,
} from './sql-explanation.service.js';

describe(
  'SqlExplanationService',
  () => {
    let service: SqlExplanationService;

    const aiServiceMock = {
      generateText: vi.fn(),
    };

    const input = {
      sql:
        'SELECT city, SUM(sales) AS total_sales FROM dataset GROUP BY city',

      question:
        'Show total sales by city',

      columns: [
        'city',
        'total_sales',
      ],

      rowCount: 3,

      truncated: false,

      summary: {
        totalRows: 3,

        numericColumns: [
          {
            column: 'total_sales',
            sum: 5400,
            average: 1800,
            min: 1200,
            max: 2400,
          },
        ],
      },
    };

    beforeEach(
      async () => {
        vi.clearAllMocks();

        aiServiceMock.generateText.mockResolvedValue(
          {
            text:
              'The query groups sales by city and calculates total sales for each city.',

            provider:
              'test-provider',

            model:
              'test-model',

            inputTokens: 100,

            outputTokens: 30,
          },
        );

        const module: TestingModule =
          await Test.createTestingModule({
            providers: [
              SqlExplanationService,

              {
                provide:
                  AiService,

                useValue:
                  aiServiceMock,
              },
            ],
          }).compile();

        service =
          module.get<SqlExplanationService>(
            SqlExplanationService,
          );
      },
    );

    it(
      'should generate an English explanation',
      async () => {
        const result =
          await service.explain(
            input,
          );

        expect(
          result,
        ).toEqual({
          enabled: true,

          language:
            'english',

          text:
            'The query groups sales by city and calculates total sales for each city.',

          provider:
            'test-provider',

          model:
            'test-model',

          warning: null,
        });
      },
    );

    it(
      'should detect Hindi questions',
      async () => {
        const result =
          await service.explain({
            ...input,
            question:
              'शहर के हिसाब से कुल बिक्री बताओ',
          });

        expect(
          result.language,
        ).toBe('hindi');
      },
    );

    it(
      'should detect Hinglish questions',
      async () => {
        const result =
          await service.explain({
            ...input,
            question:
              'city wise total sales batao',
          });

        expect(
          result.language,
        ).toBe('hinglish');
      },
    );

    it(
      'should pass actual SQL and result metadata to the AI provider',
      async () => {
        await service.explain(
          input,
        );

        expect(
          aiServiceMock.generateText,
        ).toHaveBeenCalledTimes(1);

        const request =
          aiServiceMock
            .generateText
            .mock.calls[0]![0];

        expect(
          request.userPrompt,
        ).toContain(
          input.sql,
        );

        expect(
          request.userPrompt,
        ).toContain(
          'Result row count:',
        );

        expect(
          request.userPrompt,
        ).toContain(
          '5400',
        );
      },
    );

    it(
      'should return a warning when AI returns empty text',
      async () => {
        aiServiceMock.generateText.mockResolvedValue(
          {
            text: '   ',

            provider:
              'test-provider',

            model:
              'test-model',

            inputTokens: 100,

            outputTokens: 0,
          },
        );

        const result =
          await service.explain(
            input,
          );

        expect(
          result.enabled,
        ).toBe(false);

        expect(
          result.text,
        ).toBeNull();

        expect(
          result.warning,
        ).toBe(
          'SQL explanation is temporarily unavailable.',
        );
      },
    );

    it(
      'should not fail the query flow when the AI provider fails',
      async () => {
        aiServiceMock.generateText.mockRejectedValue(
          new Error(
            'AI provider unavailable',
          ),
        );

        const result =
          await service.explain(
            input,
          );

        expect(
          result.enabled,
        ).toBe(false);

        expect(
          result.text,
        ).toBeNull();

        expect(
          result.provider,
        ).toBeNull();

        expect(
          result.model,
        ).toBeNull();

        expect(
          result.warning,
        ).toBe(
          'SQL explanation is temporarily unavailable.',
        );
      },
    );
  },
);