import {
  Injectable,
  Logger,
} from '@nestjs/common';

import { GeminiProvider } from '../ai/gemini.provider.js';

import type {
  AiTextGenerationResponse,
} from '../ai/ai-provider.interface.js';

export type InsightType =
  | 'summary'
  | 'trend'
  | 'anomaly'
  | 'comparison'
  | 'distribution'
  | 'relationship'
  | 'finding';

export interface InsightEvidence {
  datasetId?: string;
  datasetName?: string;
  operation?: string;
  column?: string;
  value?: unknown;
  baseline?: unknown;
  change?: unknown;
  source?: string;
}

export interface AIInsight {
  type: InsightType;
  title: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
  evidence: InsightEvidence[];
}

export interface AIInsightsInput {
  question?: string;
  sql?: string;

  datasets?: Array<{
    id: string;
    name: string;
    columns?: Array<{
      name: string;
      type?: string;
    }>;
  }>;

  result?: {
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount?: number;
  };

  analytics?: {
    operation?: string;
    summary?: Record<string, unknown>;
    statistics?: Record<string, unknown>;
    tables?: unknown[];
    visualizations?: unknown[];
    warnings?: string[];
  };
}

export interface AIInsightsResult {
  status: 'success' | 'empty' | 'error';

  summary: string;

  insights: AIInsight[];

  anomalies: AIInsight[];

  grounding: {
    datasetIds: string[];
    sql?: string;
    analyticsOperations: string[];
    evidenceAvailable: boolean;
  };

  warnings: string[];
}

interface NormalizedInput extends AIInsightsInput {
  datasets: NonNullable<
    AIInsightsInput['datasets']
  >;

  result: {
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
  };
}

interface ModelInsightResponse {
  summary?: unknown;
  insights?: unknown;
  anomalies?: unknown;
}

@Injectable()
export class AIInsightsService {
  private readonly logger =
    new Logger(AIInsightsService.name);

  constructor(
    private readonly geminiProvider: GeminiProvider,
  ) {}

  /**
   * Generate grounded insights from an already executed
   * query/result.
   *
   * This service does NOT:
   * - execute SQL
   * - modify SQL
   * - invent missing data
   * - run arbitrary Python
   *
   * It only interprets supplied query results and
   * analytics evidence.
   */
  async generateInsights(
    input: AIInsightsInput,
  ): Promise<AIInsightsResult> {
    const normalized =
      this.normalizeInput(input);

    const analyticsOperations =
      this.getAnalyticsOperations(
        normalized.analytics,
      );

    if (
      !normalized.result.rows.length
    ) {
      return {
        status: 'empty',

        summary:
          'No rows were returned for analysis.',

        insights: [],

        anomalies: [],

        grounding: {
          datasetIds:
            normalized.datasets.map(
              (dataset) => dataset.id,
            ),

          sql: normalized.sql,

          analyticsOperations,

          evidenceAvailable: false,
        },

        warnings: [
          'The query returned no rows.',
        ],
      };
    }

    const evidence =
      this.buildEvidence(normalized);

    if (!evidence) {
      return {
        status: 'empty',

        summary:
          'There is not enough structured evidence to generate insights.',

        insights: [],

        anomalies: [],

        grounding: {
          datasetIds:
            normalized.datasets.map(
              (dataset) => dataset.id,
            ),

          sql: normalized.sql,

          analyticsOperations,

          evidenceAvailable: false,
        },

        warnings: [
          'Insufficient structured analytics evidence.',
        ],
      };
    }

    try {
      const modelResponse =
        await this.generateModelInsights(
          evidence,
        );

      const parsed =
        this.parseModelOutput(
          modelResponse.text,
        );

      const grounded =
        this.enforceGrounding(
          parsed,
          normalized,
        );

      return {
        status: 'success',

        summary: grounded.summary,

        insights: grounded.insights,

        anomalies: grounded.anomalies,

        grounding: {
          datasetIds:
            normalized.datasets.map(
              (dataset) => dataset.id,
            ),

          sql: normalized.sql,

          analyticsOperations,

          evidenceAvailable: true,
        },

        warnings: [
          ...(normalized.analytics
            ?.warnings ?? []),
        ],
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      this.logger.warn(
        `AI insight generation failed: ${message}`,
      );

      /*
       * AI failure must not destroy an otherwise
       * successful analytics query.
       *
       * Return deterministic fallback insights.
       */
      return {
        status: 'error',

        summary:
          this.buildFallbackSummary(
            normalized,
          ),

        insights:
          this.buildFallbackInsights(
            normalized,
          ),

        anomalies:
          this.buildFallbackAnomalies(
            normalized,
          ),

        grounding: {
          datasetIds:
            normalized.datasets.map(
              (dataset) => dataset.id,
            ),

          sql: normalized.sql,

          analyticsOperations,

          evidenceAvailable: true,
        },

        warnings: [
          'AI insight generation failed; deterministic analytics were returned instead.',
        ],
      };
    }
  }

  /**
   * Send only bounded, structured evidence to Gemini.
   */
  private async generateModelInsights(
    evidence: Record<string, unknown>,
  ): Promise<AiTextGenerationResponse> {
    const systemPrompt = `
You are the AI Insights Engine for a data analytics application.

Your job is to explain ONLY what is supported by the supplied evidence.

STRICT GROUNDING RULES:

1. Never invent numbers.
2. Never invent columns.
3. Never invent datasets.
4. Never invent trends.
5. Never invent anomalies.
6. Never claim causation unless explicit causal evidence is provided.
7. Correlation must never be described as causation.
8. Do not make claims about data that is not present in the evidence.
9. If evidence is insufficient, omit the insight.
10. Every analytical insight should contain concrete evidence.
11. Use the supplied Python analytics when available.
12. Do not recalculate unsupported values from memory.
13. Do not mention internal implementation details unless relevant.
14. Keep descriptions concise and decision-oriented.
15. Return ONLY valid JSON.
16. Do not wrap JSON in markdown fences.

Return exactly this structure:

{
  "summary": "short factual summary",
  "insights": [
    {
      "type": "summary|trend|comparison|distribution|relationship|finding",
      "title": "short title",
      "description": "factual explanation",
      "importance": "high|medium|low",
      "evidence": [
        {
          "datasetId": "actual supplied dataset id",
          "datasetName": "actual supplied dataset name",
          "operation": "actual analytics operation",
          "column": "actual column",
          "value": "actual supplied value",
          "baseline": "actual supplied baseline when available",
          "change": "actual supplied change when available",
          "source": "query_result|python_analytics"
        }
      ]
    }
  ],
  "anomalies": [
    {
      "type": "anomaly",
      "title": "short title",
      "description": "factual anomaly explanation",
      "importance": "high|medium|low",
      "evidence": [
        {
          "datasetId": "actual supplied dataset id",
          "datasetName": "actual supplied dataset name",
          "operation": "actual analytics operation",
          "column": "actual column",
          "value": "actual supplied value",
          "baseline": "actual supplied baseline",
          "change": "actual supplied change",
          "source": "python_analytics|query_result"
        }
      ]
    }
  ]
}
`.trim();

    const userPrompt = `
Analyze the following verified analytics evidence.

Do not treat the user's question, SQL text, or dataset metadata as numerical evidence.

The query result and Python analytics are the authoritative evidence.

EVIDENCE:

${JSON.stringify(
  evidence,
  null,
  2,
)}
`.trim();

    return this.geminiProvider.generateText({
      systemPrompt,

      userPrompt,

      maxOutputTokens: 3000,
    });
  }

  private normalizeInput(
    input: AIInsightsInput,
  ): NormalizedInput {
    const columns =
      Array.isArray(
        input.result?.columns,
      )
        ? input.result.columns.map(
            String,
          )
        : [];

    const rows =
      Array.isArray(
        input.result?.rows,
      )
        ? input.result.rows
            .filter(
              (
                row,
              ): row is Record<
                string,
                unknown
              > =>
                !!row &&
                typeof row ===
                  'object' &&
                !Array.isArray(row),
            )
            .slice(0, 200)
        : [];

    return {
      ...input,

      datasets:
        input.datasets ?? [],

      result: {
        columns,

        rows,

        rowCount:
          input.result?.rowCount ??
          rows.length,
      },
    };
  }

  private buildEvidence(
    input: NormalizedInput,
  ): Record<string, unknown> | null {
    if (
      !input.result.rows.length
    ) {
      return null;
    }

    return {
      userQuestion:
        input.question ?? null,

      datasets:
        input.datasets.map(
          (dataset) => ({
            id: dataset.id,

            name: dataset.name,

            columns:
              dataset.columns ?? [],
          }),
        ),

      executedSql:
        input.sql ?? null,

      result: {
        columns:
          input.result.columns,

        rowCount:
          input.result.rowCount,

        sampleRows:
          input.result.rows,
      },

      pythonAnalytics:
        input.analytics ?? null,

      groundingRules: [
        'Use only supplied evidence.',
        'Do not invent values.',
        'Do not invent causes.',
        'Do not claim unsupported trends.',
        'Do not claim unsupported anomalies.',
        'Do not infer causality from correlation.',
        'Do not mention unavailable datasets.',
      ],
    };
  }

  private parseModelOutput(
    raw: string,
  ): ModelInsightResponse {
    const cleaned =
      raw
        .trim()
        .replace(
          /^```json\s*/i,
          '',
        )
        .replace(
          /^```\s*/i,
          '',
        )
        .replace(
          /\s*```$/i,
          '',
        )
        .trim();

    const firstBrace =
      cleaned.indexOf('{');

    const lastBrace =
      cleaned.lastIndexOf('}');

    if (
      firstBrace === -1 ||
      lastBrace === -1 ||
      lastBrace <= firstBrace
    ) {
      throw new Error(
        'AI response did not contain a JSON object.',
      );
    }

    const jsonText =
      cleaned.slice(
        firstBrace,
        lastBrace + 1,
      );

    let parsed: unknown;

    try {
      parsed =
        JSON.parse(jsonText);
    } catch {
      throw new Error(
        'AI insight response contained invalid JSON.',
      );
    }

    if (
      !parsed ||
      typeof parsed !==
        'object' ||
      Array.isArray(parsed)
    ) {
      throw new Error(
        'AI insight response must be a JSON object.',
      );
    }

    return parsed as ModelInsightResponse;
  }

  private normalizeInsights(
    value: unknown,
  ): AIInsight[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map(
        (
          item,
        ): AIInsight | null => {
          if (
            !item ||
            typeof item !==
              'object' ||
            Array.isArray(item)
          ) {
            return null;
          }

          const record =
            item as Record<
              string,
              unknown
            >;

          const type =
            this.normalizeInsightType(
              record.type,
            );

          const title =
            typeof record.title ===
            'string'
              ? record.title.trim()
              : '';

          const description =
            typeof record.description ===
            'string'
              ? record.description.trim()
              : '';

          if (
            !title ||
            !description
          ) {
            return null;
          }

          const importance =
            record.importance ===
              'high' ||
            record.importance ===
              'medium' ||
            record.importance ===
              'low'
              ? record.importance
              : 'medium';

          return {
            type,

            title:
              title.slice(
                0,
                200,
              ),

            description:
              description.slice(
                0,
                1000,
              ),

            importance,

            evidence:
              this.normalizeEvidence(
                record.evidence,
              ),
          };
        },
      )
      .filter(
        (
          item,
        ): item is AIInsight =>
          item !== null,
      )
      .slice(0, 20);
  }

  private normalizeInsightType(
    value: unknown,
  ): InsightType {
    switch (value) {
      case 'summary':
      case 'trend':
      case 'anomaly':
      case 'comparison':
      case 'distribution':
      case 'relationship':
      case 'finding':
        return value;

      default:
        return 'finding';
    }
  }

  private normalizeEvidence(
    value: unknown,
  ): InsightEvidence[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map(
        (
          item,
        ): InsightEvidence | null => {
          if (
            !item ||
            typeof item !==
              'object' ||
            Array.isArray(item)
          ) {
            return null;
          }

          const record =
            item as Record<
              string,
              unknown
            >;

          return {
            datasetId:
              typeof record.datasetId ===
              'string'
                ? record.datasetId
                : undefined,

            datasetName:
              typeof record.datasetName ===
              'string'
                ? record.datasetName
                : undefined,

            operation:
              typeof record.operation ===
              'string'
                ? record.operation
                : undefined,

            column:
              typeof record.column ===
              'string'
                ? record.column
                : undefined,

            value:
              record.value,

            baseline:
              record.baseline,

            change:
              record.change,

            source:
              typeof record.source ===
              'string'
                ? record.source
                : undefined,
          };
        },
      )
      .filter(
        (
          item,
        ): item is InsightEvidence =>
          item !== null,
      )
      .slice(0, 10);
  }

  private enforceGrounding(
    model: ModelInsightResponse,
    input: NormalizedInput,
  ): {
    summary: string;
    insights: AIInsight[];
    anomalies: AIInsight[];
  } {
    const datasetIds =
      new Set(
        input.datasets.map(
          (dataset) =>
            dataset.id,
        ),
      );

    const datasetNames =
      new Set(
        input.datasets.map(
          (dataset) =>
            dataset.name
              .trim()
              .toLocaleLowerCase(),
        ),
      );

    const filterGrounded =
      (
        items: AIInsight[],
      ): AIInsight[] =>
        items
          .map(
            (insight) => ({
              ...insight,

              evidence:
                insight.evidence.filter(
                  (evidence) => {
                    if (
                      evidence.datasetId &&
                      !datasetIds.has(
                        evidence.datasetId,
                      )
                    ) {
                      return false;
                    }

                    if (
                      evidence.datasetName &&
                      !datasetNames.has(
                        evidence.datasetName
                          .trim()
                          .toLocaleLowerCase(),
                      )
                    ) {
                      return false;
                    }

                    return true;
                  },
                ),
            }),
          )
          .filter(
            (insight) => {
              if (
                insight.type !==
                  'finding' &&
                insight.type !==
                  'summary' &&
                insight.evidence
                  .length === 0
              ) {
                return false;
              }

              return true;
            },
          );

    const insights =
      filterGrounded(
        this.normalizeInsights(
          model.insights,
        ),
      );

    const anomalies =
      filterGrounded(
        this.normalizeInsights(
          model.anomalies,
        ),
      ).map(
        (insight) => ({
          ...insight,

          type:
            'anomaly' as const,
        }),
      );

    const summary =
      typeof model.summary ===
        'string' &&
      model.summary.trim()
        ? model.summary
            .trim()
            .slice(0, 1500)
        : this.buildFallbackSummary(
            input,
          );

    return {
      summary,

      insights,

      anomalies,
    };
  }

  private getAnalyticsOperations(
    analytics:
      AIInsightsInput['analytics'],
  ): string[] {
    if (!analytics) {
      return [];
    }

    const operations: string[] =
      [];

    if (analytics.operation) {
      operations.push(
        analytics.operation,
      );
    }

    if (
      analytics.statistics &&
      typeof analytics.statistics ===
        'object'
    ) {
      operations.push(
        'statistics',
      );
    }

    if (
      Array.isArray(
        analytics.visualizations,
      )
    ) {
      operations.push(
        'visualization',
      );
    }

    if (
      Array.isArray(
        analytics.tables,
      )
    ) {
      operations.push(
        'table-analysis',
      );
    }

    return [
      ...new Set(
        operations,
      ),
    ];
  }

  private buildFallbackSummary(
    input: NormalizedInput,
  ): string {
    const datasetCount =
      input.datasets.length;

    const rowCount =
      input.result.rowCount;

    if (datasetCount > 1) {
      return `Analysis completed across ${datasetCount} datasets with ${rowCount} result rows.`;
    }

    if (datasetCount === 1) {
      return `Analysis completed for ${input.datasets[0].name} with ${rowCount} result rows.`;
    }

    return `Analysis completed with ${rowCount} result rows.`;
  }

  private buildFallbackInsights(
    input: NormalizedInput,
  ): AIInsight[] {
    const insights: AIInsight[] =
      [];

    const numericColumns =
      input.result.columns.filter(
        (column) =>
          input.result.rows.some(
            (row) => {
              const value =
                row[column];

              return (
                typeof value ===
                  'number' &&
                Number.isFinite(
                  value,
                )
              );
            },
          ),
      );

    if (
      numericColumns.length === 0
    ) {
      return [];
    }

    const column =
      numericColumns[0];

    const values =
      input.result.rows
        .map(
          (row) =>
            row[column],
        )
        .filter(
          (
            value,
          ): value is number =>
            typeof value ===
              'number' &&
            Number.isFinite(
              value,
            ),
        );

    if (values.length === 0) {
      return [];
    }

    const min =
      Math.min(...values);

    const max =
      Math.max(...values);

    const mean =
      values.reduce(
        (
          sum,
          value,
        ) =>
          sum + value,
        0,
      ) / values.length;

    insights.push({
      type: 'finding',

      title:
        `${column} summary`,

      description:
        `The result contains ${values.length} numeric observations for ${column}, ranging from ${min} to ${max}, with an average of ${mean}.`,

      importance: 'medium',

      evidence: [
        {
          column,

          value: {
            count:
              values.length,

            min,

            max,

            mean,
          },

          source:
            'query_result',
        },
      ],
    });

    return insights.slice(
      0,
      5,
    );
  }

  private buildFallbackAnomalies(
    input: NormalizedInput,
  ): AIInsight[] {
    const warnings =
      input.analytics?.warnings;

    if (
      !Array.isArray(warnings) ||
      warnings.length === 0
    ) {
      return [];
    }

    return [
      {
        type: 'anomaly',

        title:
          'Analytics warning',

        description:
          String(warnings[0]),

        importance:
          'medium',

        evidence: [
          {
            operation:
              input.analytics
                ?.operation,

            source:
              'python_analytics',
          },
        ],
      },
    ];
  }
}