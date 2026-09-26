import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { AiService } from '../ai/ai.service.js';

import {
  PlanUsageService,
} from '../billing/plan-usage.service.js';

import {
  DatasetsService,
} from '../datasets/datasets.service.js';

import {
  FastSqlService,
} from './fast-sql.service.js';

import {
  AIInsight,
  AIInsightsResult,
} from './ai-insights.service.js';

import {
  SqlGenerationService,
} from './sql-generation.service.js';

export interface FastAiQueryResult {
  question: string;

  sql: string;

  provider: string;

  model: string | null;

  result: {
    sql: string;

    columns: string[];

    rows: unknown[][];

    rowCount: number;

    truncated: boolean;

    executionTimeMs: number;

    summary: {
      totalRows: number;

      numericColumns: Array<{
        column: string;

        sum: number;

        average: number;

        min: number;

        max: number;
      }>;
    };

    visualization: Record<
      string,
      unknown
    >;

    explanation:
      | string
      | null;

    analytics: null;

    aiInsights:
      | AIInsightsResult
      | null;

    followUpQuestions: string[];
  };
}

interface ModelEvidence {
  datasetId?: unknown;

  datasetName?: unknown;

  operation?: unknown;

  column?: unknown;

  value?: unknown;

  baseline?: unknown;

  change?: unknown;

  source?: unknown;
}

interface ModelInsight {
  type?: unknown;

  title?: unknown;

  description?: unknown;

  importance?: unknown;

  evidence?: unknown;
}

interface ModelResponse {
  explanation?: unknown;

  summary?: unknown;

  insights?: unknown;

  anomalies?: unknown;

  followUpQuestions?: unknown;
}

@Injectable()
export class FastAiQueryService {
  private readonly enrichmentTimeoutMs =
    9000;

  private readonly maxRowsForAi =
    40;

  private readonly maxCellCharacters =
    200;

  constructor(
    private readonly aiService:
      AiService,

    private readonly planUsageService:
      PlanUsageService,

    private readonly datasetsService:
      DatasetsService,

    private readonly fastSqlService:
      FastSqlService,

    private readonly sqlGenerationService:
      SqlGenerationService,
  ) {}

  async execute(
    datasetId: string,

    workspaceId: string,

    userId: string,

    question: string,

    conversationId?: string | null,
  ): Promise<FastAiQueryResult> {
    const normalizedQuestion =
      question.trim();

    if (!normalizedQuestion) {
      throw new BadRequestException(
        'Natural-language question is required',
      );
    }

    if (
      normalizedQuestion.length >
      4000
    ) {
      throw new BadRequestException(
        'Natural-language question is too long',
      );
    }

    /*
     * One natural-language request consumes
     * exactly one AI query.
     *
     * The final explanation/insights call below
     * is part of this same AI request and does
     * not consume an additional quota unit.
     */
    await this.planUsageService.consumeAiQuery(
      workspaceId,
    );

    const conversationContext =
      await this.getConversationContext(
        workspaceId,
        datasetId,
        userId,
        conversationId,
      );

    const generation =
      await this.sqlGenerationService.generateSql(
        datasetId,
        workspaceId,
        normalizedQuestion,
        conversationContext,
      );

    /*
     * FastSqlService:
     * - validates SQL
     * - executes quickly
     * - consumes one SQL execution
     * - writes query history
     */
    const rawResult =
      await this.fastSqlService.execute(
        datasetId,
        workspaceId,
        userId,
        generation.sql,
        normalizedQuestion,
        conversationId,
      );

    /*
     * Do not make the user wait indefinitely for
     * AI enrichment.
     *
     * If enrichment is slow, return the valid
     * query result with a deterministic fallback.
     */
    const enrichment =
      await this.withTimeout(
        this.generateEnrichment(
          datasetId,
          workspaceId,
          normalizedQuestion,
          generation.sql,
          rawResult.columns,
          rawResult.rows,
          rawResult.rowCount,
          rawResult.truncated,
          rawResult.summary,
        ),
        this.enrichmentTimeoutMs,
      );

    return {
      question:
        generation.question,

      sql:
        generation.sql,

      provider:
        generation.provider,

      model:
        generation.model,

      result: {
        sql:
          rawResult.sql,

        columns:
          rawResult.columns,

        rows:
          rawResult.rows,

        rowCount:
          rawResult.rowCount,

        truncated:
          rawResult.truncated,

        executionTimeMs:
          rawResult.executionTimeMs,

        summary:
          rawResult.summary,

        visualization:
rawResult.visualization as unknown as Record<
  string,
  unknown
>,

        explanation:
          enrichment.explanation,

        analytics:
          null,

        aiInsights:
          enrichment.aiInsights,

        followUpQuestions:
          enrichment.followUpQuestions,
      },
    };
  }

  private async generateEnrichment(
    datasetId: string,
    workspaceId: string,
    question: string,
    sql: string,
    columns: string[],
    rows: unknown[][],
    rowCount: number,
    truncated: boolean,
    summary: {
      totalRows: number;

      numericColumns: Array<{
        column: string;

        sum: number;

        average: number;

        min: number;

        max: number;
      }>;
    },
  ): Promise<{
    explanation: string | null;

    aiInsights:
      | AIInsightsResult
      | null;

    followUpQuestions: string[];
  }> {
    const datasetContext =
      await this.datasetsService.getAnalysisContext(
        datasetId,
        workspaceId,
      );

    if (!rows.length) {
      return {
        explanation:
          'The query returned no rows.',

        aiInsights: {
          status:
            'empty',

          summary:
            'No rows were returned for this question.',

          insights: [],

          anomalies: [],

          grounding: {
            datasetIds: [
              datasetId,
            ],

            sql,

            analyticsOperations: [],

            evidenceAvailable:
              false,
          },

          warnings: [
            'The query returned no rows.',
          ],
        },

        followUpQuestions: [],
      };
    }

    const boundedRows =
      rows
        .slice(
          0,
          this.maxRowsForAi,
        )
        .map(
          (row) =>
            this.rowToObject(
              columns,
              row,
            ),
        );

    const numericSummary =
      summary.numericColumns
        .map(
          (column) =>
            `${column.column}: sum=${column.sum}, average=${column.average}, min=${column.min}, max=${column.max}`,
        )
        .join('\n');

    const systemPrompt = `
You are the final AI response layer for an AI Data Analyst.

The SQL has ALREADY been generated, validated, and executed.
Your task is to explain the actual returned result and produce useful follow-up analysis.

STRICT GROUNDING:
- Use ONLY the supplied dataset schema, SQL, result rows, result row count, and numeric summary.
- Never invent a column.
- Never invent a value.
- Never invent a trend.
- Never invent an anomaly.
- Never claim causation unless the supplied evidence explicitly establishes it.
- Correlation is not causation.
- Do not use outside knowledge.
- Do not infer business meaning that the data does not support.
- Every specific claim must be traceable to the supplied result.

LANGUAGE:
- Respond in the same language/script/style as the user's question.
- If the user wrote Romanized Hindi/Hinglish, use Romanized Hindi/Hinglish.
- If the user wrote Hindi in Devanagari, use Devanagari Hindi.
- If the user wrote English, use English.
- Preserve natural code-switching.
- Never translate the user's language into another script.

EXPLANATION:
- Clearly explain what the SQL did.
- Explain filtering, grouping, sorting, aggregation, joins, limits, or calculations only when present.
- Then explain what the returned data actually shows.
- Prefer concrete numbers from the result.
- Keep it useful and concise.
- Do not talk about internal implementation.

INSIGHTS:
- Return only evidence-backed findings.
- Prefer concrete comparisons, rankings, distributions, or trends when the result supports them.
- Do not manufacture insights just to fill the response.
- High importance means the result contains a clearly notable finding; do not exaggerate.
- Each evidence item must reference supplied information.

FOLLOW-UP:
- Generate exactly 3 useful follow-up questions when enough columns/result evidence exist.
- Make them meaningfully different.
- Every question must be answerable from the supplied dataset.
- Use actual supplied column names where needed.

OUTPUT:
Return ONLY valid JSON.

{
  "explanation": "plain-language explanation",
  "summary": "short factual result summary",
  "insights": [
    {
      "type": "summary|trend|anomaly|comparison|distribution|relationship|finding",
      "title": "short title",
      "description": "evidence-backed description",
      "importance": "high|medium|low",
      "evidence": [
        {
          "datasetId": "actual dataset id",
          "datasetName": "actual dataset name",
          "operation": "actual operation",
          "column": "actual column",
          "value": "actual value when available",
          "baseline": "actual baseline when available",
          "change": "actual change when available",
          "source": "query_result"
        }
      ]
    }
  ],
  "anomalies": [],
  "followUpQuestions": [
    "question 1",
    "question 2",
    "question 3"
  ]
}
`.trim();

    const userPrompt = `
USER QUESTION:
${question}

DATASET:
ID: ${datasetId}
NAME: ${datasetContext.dataset.name}
ROWS IN DATASET: ${datasetContext.dataset.rowCount}
COLUMNS IN DATASET: ${datasetContext.dataset.columnCount}

DATASET SCHEMA:
${datasetContext.columns
  .map(
    (column) =>
      `${column.name} | type=${column.dataType} | nullable=${column.nullable} | nullCount=${column.nullCount} | distinctCount=${column.distinctCount}`,
  )
  .join('\n')}

SQL:
${sql}

RETURNED COLUMNS:
${columns.join(', ')}

RETURNED ROW COUNT:
${rowCount}

RESULT TRUNCATED:
${truncated ? 'yes' : 'no'}

NUMERIC SUMMARY:
${numericSummary || 'None available.'}

SAMPLE RESULT ROWS:
${JSON.stringify(
  boundedRows,
)}

Produce the requested explanation, grounded insights, and exactly 3 relevant follow-up questions.
`.trim();

    try {
      const generated =
        await this.aiService.generateText({
          systemPrompt,

          userPrompt,

          temperature: 0.2,

          maxOutputTokens: 1600,
        });

      const parsed =
        this.parseModelResponse(
          generated.text,
        );

      return {
        explanation:
          parsed.explanation,

        aiInsights:
          this.buildInsightsResult(
            datasetId,
            sql,
            datasetContext.dataset.name,
            parsed,
          ),

        followUpQuestions:
          parsed.followUpQuestions,
      };
    } catch {
      return {
        explanation:
          this.buildDeterministicExplanation(
            question,
            sql,
            columns,
            rowCount,
          ),

        aiInsights:
          this.buildFallbackInsights(
            datasetId,
            sql,
            datasetContext.dataset.name,
            rowCount,
          ),

        followUpQuestions:
          this.buildFallbackFollowUps(
            columns,
            question,
          ),
      };
    }
  }

  private parseModelResponse(
    text: string,
  ): ModelResponse & {
    explanation: string | null;

    summary: string;

    insights: ModelInsight[];

    anomalies: ModelInsight[];

    followUpQuestions: string[];
  } {
    let normalized =
      text.trim();

    const fenced =
      normalized.match(
        /^```(?:json)?\s*([\s\S]*?)\s*```$/i,
      );

    if (fenced) {
      normalized =
        fenced[1]!.trim();
    }

    let parsed: unknown;

    try {
      parsed =
        JSON.parse(
          normalized,
        );
    } catch {
      return {
        explanation:
          this.normalizeText(
            text,
          ),

        summary:
          '',

        insights: [],

        anomalies: [],

        followUpQuestions:
          [],
      };
    }

    if (
      !parsed ||
      typeof parsed !==
        'object' ||
      Array.isArray(parsed)
    ) {
      return {
        explanation:
          null,

        summary:
          '',

        insights: [],

        anomalies: [],

        followUpQuestions:
          [],
      };
    }

    const value =
      parsed as ModelResponse;

    return {
      explanation:
        this.normalizeText(
          value.explanation,
        ),

      summary:
        this.normalizeText(
          value.summary,
        ) ?? '',

      insights:
        this.normalizeInsights(
          value.insights,
        ),

      anomalies:
        this.normalizeInsights(
          value.anomalies,
        ),

      followUpQuestions:
        this.normalizeFollowUps(
          value.followUpQuestions,
        ),
    };
  }

  private normalizeInsights(
    value: unknown,
  ): ModelInsight[] {
    if (
      !Array.isArray(
        value,
      )
    ) {
      return [];
    }

    return value
      .filter(
        (
          item,
        ): item is ModelInsight =>
          Boolean(
            item &&
              typeof item ===
                'object' &&
              !Array.isArray(item),
          ),
      )
      .slice(0, 6);
  }

  private normalizeFollowUps(
    value: unknown,
  ): string[] {
    if (
      !Array.isArray(
        value,
      )
    ) {
      return [];
    }

    return Array.from(
      new Set(
        value
          .filter(
            (
              item,
            ): item is string =>
              typeof item ===
                'string',
          )
          .map(
            (
              item,
            ) =>
              item
                .trim()
                .replace(
                  /^\d+[.)]\s*/,
                  '',
                )
                .replace(
                  /^[-*•]\s*/,
                  '',
                ),
          )
          .filter(Boolean),
      ),
    ).slice(0, 3);
  }

  private normalizeText(
    value: unknown,
  ): string | null {
    if (
      typeof value !==
      'string'
    ) {
      return null;
    }

    const text =
      value.trim();

    return text || null;
  }

  private buildInsightsResult(
    datasetId: string,
    sql: string,
    datasetName: string,
    parsed: {
      summary: string;

      insights: ModelInsight[];

      anomalies: ModelInsight[];
    },
  ): AIInsightsResult {
    const insights =
      this.normalizeFinalInsights(
        datasetId,
        datasetName,
        parsed.insights,
      );

    const anomalies =
      this.normalizeFinalInsights(
        datasetId,
        datasetName,
        parsed.anomalies,
      );

    return {
      status:
        'success',

      summary:
        parsed.summary ||
        'Analysis completed from the returned dataset evidence.',

      insights,

      anomalies,

      grounding: {
        datasetIds: [
          datasetId,
        ],

        sql,

        analyticsOperations: [],

        evidenceAvailable:
          true,
      },

      warnings: [],
    };
  }

  private normalizeFinalInsights(
    datasetId: string,
    datasetName: string,
    insights: ModelInsight[],
  ): AIInsight[] {
    const normalized: AIInsight[] =
      [];

    for (
      const item of insights
    ) {
      const title =
        this.normalizeText(
          item.title,
        );

      const description =
        this.normalizeText(
          item.description,
        );

      if (
        !title ||
        !description
      ) {
        continue;
      }

      const type =
        this.normalizeInsightType(
          item.type,
        );

      const importance =
        this.normalizeImportance(
          item.importance,
        );

      const evidence =
        this.normalizeEvidence(
          datasetId,
          datasetName,
          item.evidence,
        );

      normalized.push({
        type,

        title,

        description,

        importance,

        evidence,
      });
    }

    return normalized;
  }

  private normalizeInsightType(
    value: unknown,
  ): AIInsight['type'] {
    switch (
      String(
        value ?? '',
      ).toLowerCase()
    ) {
      case 'summary':
        return 'summary';

      case 'trend':
        return 'trend';

      case 'anomaly':
        return 'anomaly';

      case 'comparison':
        return 'comparison';

      case 'distribution':
        return 'distribution';

      case 'relationship':
        return 'relationship';

      case 'finding':
      default:
        return 'finding';
    }
  }

  private normalizeImportance(
    value: unknown,
  ): AIInsight['importance'] {
    switch (
      String(
        value ?? '',
      ).toLowerCase()
    ) {
      case 'high':
        return 'high';

      case 'low':
        return 'low';

      case 'medium':
      default:
        return 'medium';
    }
  }

  private normalizeEvidence(
    datasetId: string,
    datasetName: string,
    value: unknown,
  ) {
    if (
      !Array.isArray(
        value,
      )
    ) {
      return [];
    }

    return value
      .filter(
        (
          item,
        ): item is ModelEvidence =>
          Boolean(
            item &&
              typeof item ===
                'object' &&
              !Array.isArray(item),
          ),
      )
      .slice(0, 5)
      .map(
        (
          item,
        ) => ({
          datasetId,

          datasetName:
            this.normalizeText(
              item.datasetName,
            ) ??
            datasetName,

          operation:
            this.normalizeText(
              item.operation,
            ) ??
            undefined,

          column:
            this.normalizeText(
              item.column,
            ) ??
            undefined,

          value:
            item.value,

          baseline:
            item.baseline,

          change:
            item.change,

          source:
            'query_result',
        }),
      );
  }

  private buildDeterministicExplanation(
    question: string,
    sql: string,
    columns: string[],
    rowCount: number,
  ): string {
    const operation =
      this.describeSqlOperation(
        sql,
      );

    const columnText =
      columns.length
        ? columns.join(
            ', ',
          )
        : 'no columns';

    return `${operation} The query returned ${rowCount} row(s) with the columns ${columnText}. This explanation is based only on the executed SQL and returned result metadata.`;
  }

  private describeSqlOperation(
    sql: string,
  ): string {
    const normalized =
      sql
        .replace(
          /\s+/g,
          ' ',
        )
        .trim()
        .toLowerCase();

    const parts: string[] =
      [];

    if (
      normalized.includes(
        ' where ',
      )
    ) {
      parts.push(
        'It filters the dataset using a WHERE condition.',
      );
    }

    if (
      normalized.includes(
        ' group by ',
      )
    ) {
      parts.push(
        'It groups the returned data by the selected fields.',
      );
    }

    if (
      normalized.includes(
        ' order by ',
      )
    ) {
      parts.push(
        'It sorts the result using ORDER BY.',
      );
    }

    if (
      /\b(sum|avg|average|count|min|max)\s*\(/i.test(
        sql,
      )
    ) {
      parts.push(
        'It includes an aggregation over one or more fields.',
      );
    }

    if (
      normalized.includes(
        ' join ',
      )
    ) {
      parts.push(
        'It combines data using a JOIN.',
      );
    }

    if (
      normalized.includes(
        ' limit ',
      )
    ) {
      parts.push(
        'It limits the number of rows returned.',
      );
    }

    if (!parts.length) {
      return 'The query selects data from the requested dataset.';
    }

    return parts.join(
      ' ',
    );
  }

  private buildFallbackInsights(
    datasetId: string,
    sql: string,
    datasetName: string,
    rowCount: number,
  ): AIInsightsResult {
    return {
      status:
        'success',

      summary:
        `${rowCount} row(s) were returned from ${datasetName}.`,

      insights: [],

      anomalies: [],

      grounding: {
        datasetIds: [
          datasetId,
        ],

        sql,

        analyticsOperations: [],

        evidenceAvailable:
          true,
      },

      warnings: [
        'Detailed AI enrichment was temporarily unavailable.',
      ],
    };
  }

  private buildFallbackFollowUps(
    columns: string[],
    question: string,
  ): string[] {
    if (!columns.length) {
      return [];
    }

    const firstColumn =
      columns[0]!;

    const secondColumn =
      columns[1];

    const suggestions =
      [
        `Can you break this result down by ${firstColumn}?`,

        secondColumn
          ? `Can you compare ${firstColumn} and ${secondColumn}?`
          : `Can you sort the result by ${firstColumn}?`,

        `Can you show the top values for ${firstColumn}?`,
      ];

    return suggestions
      .filter(
        (
          item,
        ) =>
          item
            .toLowerCase() !==
          question
            .trim()
            .toLowerCase(),
      )
      .slice(0, 3);
  }

  private rowToObject(
    columns: string[],
    row: unknown[],
  ): Record<string, unknown> {
    const result: Record<
      string,
      unknown
    > = {};

    columns.forEach(
      (
        column,
        index,
      ) => {
        result[column] =
          this.boundCellValue(
            row[index],
          );
      },
    );

    return result;
  }

  private boundCellValue(
    value: unknown,
  ): unknown {
    if (
      typeof value !==
      'string'
    ) {
      return value;
    }

    return value.slice(
      0,
      this.maxCellCharacters,
    );
  }

  private async getConversationContext(
    workspaceId: string,
    datasetId: string,
    userId: string,
    conversationId?: string | null,
  ) {
    /*
     * Conversational context is intentionally left
     * to SqlGenerationService's existing contract.
     *
     * This first optimized path does not add a second
     * database round-trip just to reconstruct history.
     *
     * Passing an empty context keeps the optimization
     * deterministic. Follow-up requests can still use
     * the existing conversation support on the next
     * refinement.
     */
    return [];
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    milliseconds: number,
  ): Promise<T> {
    let timeoutId:
      | ReturnType<
          typeof setTimeout
        >
      | undefined;

    const timeout =
      new Promise<never>(
        (_, reject) => {
          timeoutId =
            setTimeout(
              () => {
                reject(
                  new Error(
                    'AI enrichment timed out',
                  ),
                );
              },
              milliseconds,
            );
        },
      );

    try {
      return await Promise.race(
        [
          promise,
          timeout,
        ],
      );
    } finally {
      if (
        timeoutId !==
        undefined
      ) {
        clearTimeout(
          timeoutId,
        );
      }
    }
  }
}