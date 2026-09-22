import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import {
  Job,
  Queue,
} from 'bullmq';

import {
  In,
  Repository,
} from 'typeorm';

import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';

import { tmpdir } from 'node:os';

import {
  join,
  resolve,
} from 'node:path';

import { AiService } from '../ai/ai.service.js';
import { Dataset } from '../datasets/dataset.entity.js';
import { DatasetsService } from '../datasets/datasets.service.js';
import { StorageService } from '../storage/storage.service.js';

import {
  DuckDBQueryError,
  DuckDBService,
} from './duckdb.service.js';

import {
  QueryHistory,
} from './query-history.entity.js';

import {
  ResultSummaryService,
} from './result-summary.service.js';

import {
  ResultVisualization,
  ResultVisualizationService,
} from './result-visualization.service.js';

import {
  SqlGenerationService,
} from './sql-generation.service.js';

import {
  SqlValidatorService,
} from './sql-validator.service.js';

import {
  AIInsightsResult,
  AIInsightsService,
} from './ai-insights.service.js';

export interface DatasetQueryResult {
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

  visualization: ResultVisualization;
  explanation: string | null;
  followUpQuestions: string[];
  analytics: PythonAnalyticsResult | null;
  aiInsights: AIInsightsResult | null;
}

export interface PythonAnalyticsResult {
  operation: string;

  status:
    | 'success'
    | 'error';

  result:
    | unknown
    | null;

  execution: {
    durationMs:
      | number
      | null;
  };

  error:
    | {
        code: string;
        message: string;
      }
    | null;
}

export interface NaturalLanguageQueryResult {
  question: string;
  sql: string;
  provider: string;
  model: string | null;
  result: DatasetQueryResult;
}

export interface QueryConversationContext {
  question: string | null;
  sql: string;
  rowCount: number | null;

  status:
    | 'success'
    | 'failed';

  createdAt: Date;
}

export interface SqlValidationResult {
  valid: boolean;
  message: string | null;
  line: number | null;
  column: number | null;
}

export interface MultiDatasetSqlGenerationResult {
  question: string;
  sql: string;
  provider: string;
  model: string | null;
}

export type AnalysisJobType =
  | 'sql'
  | 'natural_language'
  | 'multi_dataset_sql'
  | 'multi_dataset_natural_language';

export interface AnalysisJobData {
  type: AnalysisJobType;
  datasetIds: string[];
  workspaceId: string;
  userId: string;
  sql?: string;
  question?: string;
  conversationId?: string | null;
}

export interface AnalysisJobStatus {
  jobId: string;
  queue: 'analysis';
  type: AnalysisJobType;
  status:
    | 'waiting'
    | 'active'
    | 'delayed'
    | 'completed'
    | 'failed'
    | 'unknown';
progress: number | string | boolean | object | null;
  attemptsMade: number;
  maxAttempts: number;
  createdAt: string | null;
  processedAt: string | null;
  finishedAt: string | null;
  failedReason: string | null;
  result: unknown | null;
}

type DatasetAnalysisContext =
  Awaited<
    ReturnType<
      DatasetsService['getAnalysisContext']
    >
  >;

interface MultiDatasetContextEntry {
  dataset: Dataset;
  context: DatasetAnalysisContext;
  relationName: string;
}

interface MultiDatasetQueryFile {
  dataset: Dataset;
  context: DatasetAnalysisContext;
  relationName: string;
  parquetPath: string;
}

interface MultiDatasetRelationshipCandidate {
  leftRelation: string;
  leftColumn: string;
  rightRelation: string;
  rightColumn: string;
  reason: string;
}

@Injectable()
export class QueryService {
  private readonly logger =
    new Logger(QueryService.name);
  private readonly maxResultRows = 5000;

  private readonly conversationContextLimit = 8;

  private readonly multiDatasetContextLimit = 6;

  private readonly analysisJobAttempts = Math.max(
    1,
    Number.parseInt(
      process.env.ANALYSIS_JOB_ATTEMPTS ?? '3',
      10,
    ) || 3,
  );

  private readonly analysisJobBackoffMs = Math.max(
    1000,
    Number.parseInt(
      process.env.ANALYSIS_JOB_BACKOFF_MS ?? '5000',
      10,
    ) || 5000,
  );

  private readonly analysisJobRemoveOnComplete = Math.max(
    10,
    Number.parseInt(
      process.env.ANALYSIS_JOB_REMOVE_ON_COMPLETE ?? '500',
      10,
    ) || 500,
  );

  private readonly analysisJobRemoveOnFail = Math.max(
    10,
    Number.parseInt(
      process.env.ANALYSIS_JOB_REMOVE_ON_FAIL ?? '500',
      10,
    ) || 500,
  );


  private readonly pythonAnalyticsTimeoutMs =
    Math.max(
      1000,
      Number.parseInt(
        process.env.PYTHON_ANALYTICS_TIMEOUT_MS ??
          '120000',
        10,
      ) || 120000,
    );

  private readonly pythonAnalyticsMaxRows = 5000;

  constructor(
    @InjectQueue('analysis')
    private readonly analysisQueue: Queue<AnalysisJobData>,

    @InjectRepository(Dataset)
    private readonly datasetRepository: Repository<Dataset>,

    @InjectRepository(QueryHistory)
    private readonly queryHistoryRepository: Repository<QueryHistory>,

    private readonly storageService: StorageService,

    private readonly duckDbService: DuckDBService,

    private readonly sqlValidatorService: SqlValidatorService,

    private readonly sqlGenerationService: SqlGenerationService,

    private readonly resultSummaryService: ResultSummaryService,

    private readonly resultVisualizationService: ResultVisualizationService,

    private readonly aiService: AiService,

    private readonly aiInsightsService: AIInsightsService,

    private readonly datasetsService: DatasetsService,
  ) {}

  // ==========================================
  // AI INSIGHTS
  // ==========================================

  private async generateResultInsights(
    question: string | null | undefined,
    sql: string,
    datasets: Array<{
      id: string;
      name: string;
      columns?: Array<{
        name: string;
        type?: string;
      }>;
    }>,
    columns: string[],
    rows: unknown[][],
    rowCount: number,
    analytics: PythonAnalyticsResult | null,
  ): Promise<AIInsightsResult | null> {
    if (
      !columns.length ||
      !rows.length
    ) {
      return null;
    }

    try {
      const resultRows =
        rows.map(
          (row) =>
            Object.fromEntries(
              columns.map(
                (
                  column,
                  index,
                ) => [
                  column,
                  row[index] ?? null,
                ],
              ),
            ),
        );

      /*
       * PythonAnalyticsResult stores the actual
       * analytics payload inside `result`.
       *
       * Keep this bridge defensive because the Python
       * engine can evolve without changing the NestJS
       * transport contract.
       */
const analyticsPayload =
  analytics &&
  analytics.status === 'success' &&
  analytics.result &&
  typeof analytics.result === 'object' &&
  !Array.isArray(analytics.result)
    ? (analytics.result as Record<string, unknown>)
    : undefined;

const normalizedAnalytics = analytics
  ? {
      operation: analytics.operation,

      summary:
        analyticsPayload?.summary &&
        typeof analyticsPayload.summary === 'object' &&
        !Array.isArray(analyticsPayload.summary)
          ? (analyticsPayload.summary as Record<string, unknown>)
          : undefined,

      statistics:
        analyticsPayload?.statistics &&
        typeof analyticsPayload.statistics === 'object' &&
        !Array.isArray(analyticsPayload.statistics)
          ? (analyticsPayload.statistics as Record<string, unknown>)
          : undefined,

      tables: Array.isArray(analyticsPayload?.tables)
        ? analyticsPayload.tables
        : undefined,

      visualizations: Array.isArray(
        analyticsPayload?.visualizations,
      )
        ? analyticsPayload.visualizations
        : undefined,

      warnings: Array.isArray(analyticsPayload?.warnings)
        ? analyticsPayload.warnings.filter(
            (warning): warning is string =>
              typeof warning === 'string',
          )
        : undefined,
    }
  : undefined;

      return await this.aiInsightsService.generateInsights({
        ...(question?.trim()
          ? {
              question:
                question.trim(),
            }
          : {}),

        sql,

        datasets,

        result: {
          columns,
          rows: resultRows,
          rowCount,
        },

        ...(normalizedAnalytics
          ? {
              analytics:
                normalizedAnalytics,
            }
          : {}),
      });
    } catch {
      /*
       * AI Insights are an enrichment layer.
       * A failure here must never fail the user's
       * already-successful SQL query.
       */
      return null;
    }
  }

  // ==========================================
  // RESULT EXPLANATION
  // ==========================================

  private async generateResultExplanation(
    question: string | null | undefined,
    columns: string[],
    rows: unknown[][],
    rowCount: number,
    truncated: boolean,
    summary: DatasetQueryResult['summary'],
  ): Promise<string | null> {
    const normalizedQuestion =
      question?.trim() ||
      null;

    const languageInstruction =
      normalizedQuestion
        ? `
Answer in the same language, script, and natural writing style used by the user question.

Preserve:
- the user's language
- the user's script
- transliteration style
- code-switching or mixed-language usage
- informal/formal register

Do not translate the response into English unless the user question itself is in English.
Do not convert Romanized text into another script.
Do not convert Devanagari or another native script into Romanized text.
Do not convert another native script into Romanized text.
`
        : 'Answer in English because the SQL editor was used without a natural-language question.';

    const numericSummary =
      summary.numericColumns
        .slice(0, 12)
        .map(
          (item) =>
            `${item.column}: sum=${item.sum}, average=${item.average}, min=${item.min}, max=${item.max}`,
        )
        .join('\n');

    const sampleRows =
      rows
        .slice(0, 30)
        .map((row) =>
          row.map((value) => {
            if (
              value === null ||
              value === undefined
            ) {
              return null;
            }

            if (
              typeof value === 'string'
            ) {
              return value.slice(0, 500);
            }

            return value;
          }),
        );

    const systemPrompt = `
You are the result-explanation engine for an AI Data Analyst.

Your job is to explain what the returned query result shows to the end user.

Important rules:
- Explain the RESULT, not the SQL.
- Never explain SELECT, FROM, WHERE, GROUP BY, JOIN, LIMIT, aliases, SQL syntax, or query mechanics.
- Use only facts supported by the provided result metadata, numeric summary, and sample rows.
- Do not invent values, trends, causes, or business reasons.
- Mention important totals, averages, ranges, comparisons, rankings, or notable result patterns only when supported by the evidence.
- If the result is empty, clearly say that no rows were returned.
- If the result is truncated, do not imply that the displayed rows represent the complete result set.
- ${languageInstruction}
- Keep the explanation concise and useful: 2 to 5 short paragraphs or bullets.
- Return only the explanation text.
`.trim();

    const userPrompt = `
User question:
${normalizedQuestion ?? '(No natural-language question was provided. The SQL editor was used.)'}

Result metadata:
- Rows returned: ${rowCount}
- Result truncated: ${truncated ? 'yes' : 'no'}
- Columns: ${columns.join(', ')}

Numeric summary:
${numericSummary || '(No numeric summary is available.)'}

Sample rows from the returned result (evidence only; may be incomplete):
${JSON.stringify(sampleRows)}

Explain what this result means for the user.
Do not explain how the SQL query works.
`.trim();

    try {
      const generated =
        await this.aiService.generateText({
          systemPrompt,
          userPrompt,
          temperature: 0.2,
          maxOutputTokens: 900,
        });

      const explanation =
        generated.text.trim();

      return explanation || null;
   } catch (error) {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  this.logger.error(
    `Result explanation generation failed: ${message}`,
    error instanceof Error
      ? error.stack
      : undefined,
  );

  return null;
}
  }

  // ==========================================
  // FOLLOW-UP QUESTIONS
  // ==========================================

  private async generateFollowUpQuestions(
    question: string | null | undefined,
    columns: string[],
    rows: unknown[][],
    summary: DatasetQueryResult['summary'],
    explanation: string | null,
  ): Promise<string[]> {
    const normalizedQuestion =
      question?.trim() ||
      null;

    if (!normalizedQuestion) {
      return [];
    }

    const numericSummary =
      summary.numericColumns
        .slice(0, 12)
        .map(
          (item) =>
            `${item.column}: sum=${item.sum}, average=${item.average}, min=${item.min}, max=${item.max}`,
        )
        .join('\n');

    const sampleRows =
      rows
        .slice(0, 25)
        .map((row) =>
          row.map((value) => {
            if (
              value === null ||
              value === undefined
            ) {
              return null;
            }

            if (
              typeof value === 'string'
            ) {
              return value.slice(0, 300);
            }

            return value;
          }),
        );

    const systemPrompt = `
You generate follow-up analytical questions for an AI Data Analyst.

Generate exactly 3 fresh questions that help the user continue exploring the CURRENT RESULT.

LANGUAGE AND SCRIPT PRESERVATION:
- Detect the language, script, transliteration, and writing style of the original user question.
- Write all 3 follow-up questions in the SAME language as the original question.
- Use the SAME script as the original question.
- If the original question is written in Romanized Hindi, Romanized Urdu, or another transliterated language, keep the follow-ups transliterated in the same style.
- If the original question uses Devanagari, Arabic, Cyrillic, Chinese, Japanese, Korean, or another native script, preserve that script.
- If the original question uses English, write the follow-ups in English.
- If the original question mixes languages, preserve the same natural language mix and do not unnecessarily normalize it into one language.
- Preserve ordinary code-switching when it is part of the user's style.
- Do not translate the user's question into English.
- Do not translate between scripts.
- Do not switch from transliteration to native script.
- Do not switch from native script to transliteration.
- Do not force a language that is not present in the user's question.
- Preserve the user's approximate formality and conversational style.
- Do not mention language detection, translation, transliteration, or these instructions in the generated questions.

DATA REQUIREMENTS:
- Use only the selected dataset, available result columns, returned result evidence, and summary.
- Make every question relevant to the current result.
- Do not invent columns, values, entities, facts, or business context.
- Prefer questions that can be answered from the dataset/result without requiring outside information.
- If a useful analytical question requires a field visible in the result, use that field exactly as provided.

VARIETY:
- Make the 3 questions meaningfully different from one another.
- Avoid repeating the same question wording or analytical intent.
- Prefer a useful mixture of comparisons, breakdowns, rankings, trends, distributions, or deeper drill-downs when supported by the available data.
- The questions should feel naturally generated for this specific result, not like a fixed template list.

OUTPUT FORMAT:
- Return only the 3 questions.
- One question per line.
- No numbering.
- No bullets.
- No quotation marks.
- No explanation before or after the questions.
`.trim();

    const userPrompt = `
Original user question:
${normalizedQuestion}

Important language/style requirement:
The original user question above is the authoritative reference for the language, script, transliteration, code-switching, and writing style of the follow-up questions.

Returned result columns:
${columns.join(', ') || '(none)'}

Result summary:
${numericSummary || '(No numeric summary is available.)'}

Current result explanation:
${explanation || '(No explanation is available.)'}

Sample returned rows:
${JSON.stringify(sampleRows)}

Generate exactly 3 fresh follow-up questions for this result.
Preserve the original question's language, script, transliteration, and mixed-language style exactly where applicable.
`.trim();

    const parseQuestions = (
      text: string,
    ): string[] =>
      Array.from(
        new Set(
          text
            .split('\n')
            .map((line) =>
              line
                .replace(
                  /^\s*(?:[-*•]\s+|\d+[.)]\s+)/,
                  '',
                )
                .replace(
                  /^['"]|['"]$/g,
                  '',
                )
                .trim(),
            )
            .filter(Boolean),
        ),
      ).slice(0, 3);

    try {
      const generated =
        await this.aiService.generateText({
          systemPrompt,
          userPrompt,
          temperature: 0.8,
          maxOutputTokens: 700,
        });

      const questions =
        parseQuestions(
          generated.text,
        );

      if (questions.length === 3) {
        return questions;
      }

      const retry =
        await this.aiService.generateText({
          systemPrompt: `${systemPrompt}

CRITICAL:
Your previous response did not contain exactly 3 usable questions.

Return exactly 3 questions now.
Every question MUST preserve the original user's language, script, transliteration, code-switching, and writing style.
Do not translate or change scripts.`,
          userPrompt,
          temperature: 0.8,
          maxOutputTokens: 700,
        });

      return parseQuestions(
        retry.text,
      );
    } catch {
      return [];
    }
  }

  // ==========================================
  // CONVERSATION CONTEXT
  // ==========================================

  private async getConversationContext(
    workspaceId: string,
    datasetId: string,
    userId: string,
    conversationId: string | null | undefined,
  ): Promise<QueryConversationContext[]> {
    const normalizedConversationId =
      conversationId?.trim() ||
      null;

    if (!normalizedConversationId) {
      return [];
    }

    const history =
      await this.queryHistoryRepository.find({
        where: {
          workspaceId,
          datasetId,
          userId,
          conversationId:
            normalizedConversationId,
        },

        order: {
          createdAt: 'DESC',
        },

        take:
          this.conversationContextLimit,
      });

    return history
      .reverse()
      .map(
        (item) => ({
          question:
            item.question?.trim() ||
            null,

          sql:
            item.sql,

          rowCount:
            item.rowCount,

          status:
            item.status,

          createdAt:
            item.createdAt,
        }),
      );
  }

  // ==========================================
  // DATASET LOOKUP
  // ==========================================

  private async getDataset(
    datasetId: string,
    workspaceId: string,
  ): Promise<Dataset> {
    const dataset =
      await this.datasetRepository.findOne({
        where: {
          id: datasetId,
          workspaceId,
        },
      });

    if (!dataset) {
      throw new NotFoundException(
        'Dataset was not found for this workspace',
      );
    }

    if (!dataset.queryObjectKey) {
      throw new BadRequestException(
        'Dataset does not have a queryable Parquet object',
      );
    }

    return dataset;
  }

  // ==========================================
  // MULTI-DATASET CONTEXT
  // ==========================================

  private normalizeDatasetIds(
    datasetIds: string[] | undefined,
  ): string[] {
    if (!Array.isArray(datasetIds)) {
      throw new BadRequestException(
        'datasetIds must be an array of dataset IDs',
      );
    }

    const normalized =
      Array.from(
        new Set(
          datasetIds
            .filter(
              (
                datasetId,
              ): datasetId is string =>
                typeof datasetId ===
                  'string' &&
                datasetId.trim().length >
                  0,
            )
            .map(
              (
                datasetId,
              ) =>
                datasetId.trim(),
            ),
        ),
      );

    if (normalized.length < 2) {
      throw new BadRequestException(
        'At least two dataset IDs are required for multi-dataset analysis',
      );
    }

    return normalized;
  }

  private async getMultipleDatasetContexts(
    datasetIds: string[],
    workspaceId: string,
  ): Promise<MultiDatasetContextEntry[]> {
    const normalizedDatasetIds =
      this.normalizeDatasetIds(
        datasetIds,
      );

    const datasets =
      await this.datasetRepository.find({
        where: {
          workspaceId,
          id: In(normalizedDatasetIds),
        },
      });

    const datasetById =
      new Map(
        datasets.map(
          (dataset) => [
            dataset.id,
            dataset,
          ],
        ),
      );

    const missingDatasetIds =
      normalizedDatasetIds.filter(
        (datasetId) =>
          !datasetById.has(
            datasetId,
          ),
      );

    if (
      missingDatasetIds.length >
      0
    ) {
      throw new NotFoundException(
        `One or more datasets were not found for this workspace: ${missingDatasetIds.join(', ')}`,
      );
    }

    const orderedDatasets =
      normalizedDatasetIds.map(
        (datasetId) =>
          datasetById.get(
            datasetId,
          )!,
      );

    orderedDatasets.forEach(
      (dataset) => {
        if (!dataset.queryObjectKey) {
          throw new BadRequestException(
            `Dataset "${dataset.name}" does not have a queryable Parquet object`,
          );
        }

        if (
          dataset.status !==
          'ready'
        ) {
          throw new BadRequestException(
            `Dataset "${dataset.name}" is not ready for multi-dataset analysis`,
          );
        }
      },
    );

    const contexts =
      await Promise.all(
        orderedDatasets.map(
          async (dataset, index) => {
            const context =
              await this.datasetsService.getAnalysisContext(
                dataset.id,
                workspaceId,
              );

            return {
              dataset,
              context,
              relationName:
                `dataset_${index + 1}`,
            };
          },
        ),
      );

    return contexts;
  }

  private buildRelationshipCandidates(
    entries: MultiDatasetContextEntry[],
  ): MultiDatasetRelationshipCandidate[] {
    const candidates: MultiDatasetRelationshipCandidate[] =
      [];

    for (
      let leftIndex = 0;
      leftIndex < entries.length;
      leftIndex += 1
    ) {
      for (
        let rightIndex =
          leftIndex + 1;
        rightIndex < entries.length;
        rightIndex += 1
      ) {
        const left =
          entries[leftIndex];

        const right =
          entries[rightIndex];

        for (
          const leftColumn of left.context.columns
        ) {
          const normalizedLeftName =
            leftColumn.name
              .trim()
              .toLocaleLowerCase();

          if (
            !normalizedLeftName
          ) {
            continue;
          }

          const rightColumn =
            right.context.columns.find(
              (candidate) =>
                candidate.name
                  .trim()
                  .toLocaleLowerCase() ===
                normalizedLeftName,
            );

          if (!rightColumn) {
            continue;
          }

          const compatibleTypes =
            leftColumn.dataType
              .trim()
              .toLocaleLowerCase() ===
            rightColumn.dataType
              .trim()
              .toLocaleLowerCase();

          if (!compatibleTypes) {
            continue;
          }

          candidates.push({
            leftRelation:
              left.relationName,

            leftColumn:
              leftColumn.name,

            rightRelation:
              right.relationName,

            rightColumn:
              rightColumn.name,

            reason:
              'Same normalized column name with compatible data types',
          });
        }
      }
    }

    return candidates.slice(
      0,
      40,
    );
  }

  private buildMultiDatasetSchemaPrompt(
    entries: MultiDatasetContextEntry[],
  ): string {
    return entries
      .map(
        (entry) => {
          const schema =
            entry.context.columns
              .slice(
                0,
                this.multiDatasetContextLimit *
                  100,
              )
              .map(
                (column) =>
                  `${column.ordinalPosition}. ${column.name} | type=${column.dataType} | nullable=${column.nullable} | nullCount=${column.nullCount} | distinctCount=${column.distinctCount}`,
              )
              .join('\n');

          return `
RELATION:
- SQL relation: ${entry.relationName}
- Dataset name: ${entry.dataset.name}
- Original filename: ${entry.dataset.originalFilename}
- Rows: ${entry.dataset.rowCount}
- Columns: ${entry.dataset.columnCount}
- Status: ${entry.dataset.status}

COLUMNS:
${schema}
`.trim();
        },
      )
      .join('\n\n');
  }

  private buildMultiDatasetRelationshipPrompt(
    entries: MultiDatasetContextEntry[],
  ): string {
    const candidates =
      this.buildRelationshipCandidates(
        entries,
      );

    if (!candidates.length) {
      return `
RELATIONSHIP CANDIDATES:
- No automatically inferred relationship candidates were found.
- Do not invent relationships.
`.trim();
    }

    const lines =
      candidates.map(
        (candidate) =>
          `- ${candidate.leftRelation}.${candidate.leftColumn} ↔ ${candidate.rightRelation}.${candidate.rightColumn} | ${candidate.reason}`,
      );

    return `
RELATIONSHIP CANDIDATES:
These are heuristic candidates only. They are not declared foreign keys.
Use them only when they make sense for the user's request.
Do not invent other relationships.

${lines.join('\n')}
`.trim();
  }

  // ==========================================
  // MULTI-DATASET REQUEST SCOPE
  // ==========================================

  private questionRequiresAllDatasets(
    question: string,
  ): boolean {
    const normalized =
      question
        .trim()
        .toLocaleLowerCase();

    const patterns = [
      /\ball datasets?\b/,
      /\beach dataset\b/,
      /\bevery dataset\b/,
      /\ball selected datasets?\b/,
      /\beach selected dataset\b/,
      /\bevery selected dataset\b/,
      /\bselected datasets?\b/,
      /\bacross all datasets?\b/,
      /\bacross datasets?\b/,
      /\bacross all files?\b/,
      /\bacross files?\b/,
      /\ball files?\b/,
      /\beach file\b/,
      /\bevery file\b/,
      /\bselected files?\b/,
      /\bcompare datasets?\b/,
      /\bcompare all datasets?\b/,
      /\bcompare selected datasets?\b/,
      /\bcompare across datasets?\b/,
      /\bcompare across all datasets?\b/,
      /\bcombine datasets?\b/,
      /\bcombine all datasets?\b/,
      /\bcombine selected datasets?\b/,
      /\bfrom each dataset\b/,
      /\bfrom every dataset\b/,
      /\bfrom each selected dataset\b/,
      /\bfor each dataset\b/,
      /\bfor every dataset\b/,
      /\bfor each selected dataset\b/,
      /\bfrom all selected datasets?\b/,
      /\busing all selected datasets?\b/,
      /\busing all datasets?\b/,
      /\busing each dataset\b/,
      /\busing every dataset\b/,
      /\bin all datasets?\b/,
      /\bin each dataset\b/,
      /\bin every dataset\b/,
    ];

    return patterns.some(
      (pattern) =>
        pattern.test(normalized),
    );
  }

  private sqlReferencesRelation(
    sql: string,
    relationName: string,
  ): boolean {
    const normalizedSql =
      sql.toLocaleLowerCase();

    const normalizedRelation =
      relationName
        .trim()
        .toLocaleLowerCase();

    if (!normalizedRelation) {
      return false;
    }

    const escapedRelation =
      normalizedRelation.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&',
      );

    const relationPattern =
      new RegExp(
        `(?:^|[^a-z0-9_])${escapedRelation}(?:$|[^a-z0-9_])`,
        'i',
      );

    return relationPattern.test(
      normalizedSql,
    );
  }

  private sqlReferencesAllRelations(
    sql: string,
    entries: MultiDatasetContextEntry[],
  ): boolean {
    return entries.every(
      (entry) =>
        this.sqlReferencesRelation(
          sql,
          entry.relationName,
        ),
    );
  }

  private getMissingRelations(
    sql: string,
    entries: MultiDatasetContextEntry[],
  ): MultiDatasetContextEntry[] {
    return entries.filter(
      (entry) =>
        !this.sqlReferencesRelation(
          sql,
          entry.relationName,
        ),
    );
  }

  // ==========================================
  // MULTI-DATASET AI PROMPTS
  // ==========================================

  private buildMultiDatasetSystemPrompt(): string {
    return `
You are the multi-dataset SQL generation engine for an AI Data Analyst.

Your task is to convert the user's natural-language request into exactly ONE valid DuckDB SQL statement that analyzes the selected uploaded datasets.

OUTPUT:
- Return SQL only.
- Do not return Markdown.
- Do not use code fences.
- Do not prefix the response with "SQL:".
- Return exactly one SQL statement.
- The statement may contain a trailing semicolon.
- Do not return explanations or extra text.

AVAILABLE RELATIONS:
- Each selected dataset is exposed as one explicit SQL relation.
- Relation names are provided in the current multi-dataset context.
- These relations are the ONLY available dataset relations.
- Never invent a physical table.
- Never invent a dataset relation.
- Never replace a selected relation with an unrelated relation.

CRITICAL DATASET-SCOPE RULE:

If the user's request explicitly refers to ALL, EACH, EVERY, SELECTED DATASETS, ALL FILES, EACH FILE, EVERY FILE, ACROSS DATASETS, COMPARE DATASETS, or COMBINE DATASETS, then EVERY selected relation MUST appear in the SQL.

Examples:
- "show the first 10 rows from each dataset"
- "compare all selected datasets"
- "compare every dataset"
- "combine all datasets"
- "show sales across all datasets"
- "analyze each selected dataset"
- "give me data from all files"
- "compare selected datasets"

When such wording is present:
- DO NOT answer using only dataset_1.
- DO NOT silently ignore dataset_2.
- DO NOT silently ignore dataset_3.
- DO NOT choose only the first dataset.
- DO NOT discard a selected dataset.
- EVERY selected relation must be referenced by the generated SQL.

When the user clearly asks about only one dataset:
- One relation is allowed.
- Do not add unnecessary datasets.

MULTI-DATASET RESULT DESIGN:
- If compatible rows should be combined, prefer UNION ALL BY NAME.
- If datasets need matching records, use a valid JOIN.
- If datasets need comparison, preserve dataset identity where useful.
- If totals need to span datasets, aggregate across every requested dataset.
- If schemas differ, UNION ALL BY NAME can align columns by name and fill unavailable columns with NULL.
- CTEs can be used when they make a multi-dataset query clearer.
- Do not use JOIN merely because multiple datasets are selected.

ADVANCED SQL:
- JOIN
- INNER JOIN
- LEFT JOIN
- RIGHT JOIN
- FULL JOIN
- CROSS JOIN
- NATURAL JOIN
- GROUP BY
- HAVING
- subqueries
- correlated subqueries
- EXISTS
- NOT EXISTS
- IN
- NOT IN
- CTEs
- UNION
- UNION ALL
- UNION ALL BY NAME
- INTERSECT
- EXCEPT
- window functions
- window frames
- ORDER BY
- LIMIT
- OFFSET
- DISTINCT
- QUALIFY
- FILTER
- CASE
- CAST
- DuckDB-supported functions

RELATIONSHIP RULES:
- Relationship candidates are heuristic evidence only.
- They are NOT declared foreign keys.
- Prefer explicit matching keys and clear user intent.
- Do not invent foreign keys.
- Do not invent business meaning.
- Do not join datasets merely because their names sound related.
- Do not join incompatible columns.
- Do not invent relationships when no evidence exists.

CORRECTNESS:
- Use only columns present in the supplied schemas.
- Preserve exact column names.
- Quote identifiers when necessary.
- Qualify ambiguous columns.
- Ensure GROUP BY requirements are satisfied.
- Ensure JOIN conditions reference valid columns.
- Ensure aliases are valid and unique.
- Ensure subqueries return compatible values.
- Ensure CTE names are valid.
- Ensure window expressions are valid.
- Never invent tables.
- Never invent columns.
- Never invent values.
- Never invent relationships.
- Never silently remove requested operations.

LANGUAGE:
- Understand English, Hindi, Hinglish, transliterated language, native scripts, slang, and mixed-language requests.
- SQL output must always remain valid SQL.

FINAL RULE:
Return exactly one valid DuckDB SQL statement and nothing else.
`.trim();
  }

  private buildMultiDatasetUserPrompt(
    question: string,
    entries: MultiDatasetContextEntry[],
    requiresAllDatasets: boolean,
  ): string {
    const schemaPrompt =
      this.buildMultiDatasetSchemaPrompt(
        entries,
      );

    const relationshipPrompt =
      this.buildMultiDatasetRelationshipPrompt(
        entries,
      );

    const relationList =
      entries
        .map(
          (entry) =>
            `- ${entry.relationName} = ${entry.dataset.name}`,
        )
        .join('\n');

    return `
SELECTED DATASETS:
${schemaPrompt}

${relationshipPrompt}

AVAILABLE SQL RELATIONS:
${relationList}

CURRENT USER REQUEST:
${question}

REQUEST SCOPE:
${
  requiresAllDatasets
    ? `
THE USER EXPLICITLY REQUESTED ALL/EACH/EVERY SELECTED DATASET.

MANDATORY:
EVERY AVAILABLE SQL RELATION listed above MUST be referenced
by the generated SQL.

DO NOT:
- answer from only dataset_1
- ignore dataset_2
- ignore dataset_3
- choose the first dataset only
- silently drop any selected dataset

If compatible rows need to be combined, use UNION ALL BY NAME.
If records need to be matched, use an evidence-based JOIN.
If comparison is needed, preserve dataset identity where useful.
`
    : `
The user did not explicitly require every selected dataset.

Use only the dataset relations actually required by the request.
Do not add unnecessary joins or relations.
`
}

INSTRUCTIONS:
- The current request is the highest-priority instruction.
- Use only selected dataset relations.
- Use only actual schema columns.
- Use multiple relations when required by the request.
- Preserve requested filters.
- Preserve requested grouping.
- Preserve requested aggregation.
- Preserve requested ordering.
- Preserve requested limits.
- Preserve requested JOINs.
- Preserve requested subqueries.
- Preserve requested CTEs.
- Preserve requested window functions.
- Never invent a physical table.
- Never invent a column.
- Never invent a relationship.
- Never invent a value.
- Return exactly one valid DuckDB SQL statement.
- Return SQL only.
`.trim();
  }

  private escapeSqlStringLiteral(
    value: string,
  ): string {
    return value.replace(
      /'/g,
      "''",
    );
  }

  // ==========================================
  // MULTI-DATASET EXECUTABLE SQL
  // ==========================================

  private buildMultiDatasetExecutableSql(
    sql: string,
    queryFiles: MultiDatasetQueryFile[],
  ): string {
    const relationCtes =
      queryFiles
        .map(
          (
            queryFile,
            index,
          ) => {
            const relationName =
              queryFile.relationName.replace(
                /"/g,
                '""',
              );

            if (index === 0) {
              return `"${relationName}" AS (
  SELECT *
  FROM dataset
)`;
            }

            const escapedPath =
              this.escapeSqlStringLiteral(
                queryFile.parquetPath,
              );

            return `"${relationName}" AS (
  SELECT *
  FROM read_parquet('${escapedPath}')
)`;
          },
        )
        .join(',\n');

    const trimmedSql =
      sql.trim();

    if (!trimmedSql) {
      throw new BadRequestException(
        'SQL query cannot be empty',
      );
    }

    if (
      /^WITH\s+RECURSIVE\b/i.test(
        trimmedSql,
      )
    ) {
      return trimmedSql.replace(
        /^WITH\s+RECURSIVE\b/i,
        `WITH RECURSIVE ${relationCtes},`,
      );
    }

    if (
      /^WITH\b/i.test(
        trimmedSql,
      )
    ) {
      return trimmedSql.replace(
        /^WITH\b/i,
        `WITH ${relationCtes},`,
      );
    }

    return `
WITH ${relationCtes}
${trimmedSql}
`.trim();
  }

  private async getMultiDatasetQueryFiles(
    entries: MultiDatasetContextEntry[],
  ): Promise<{
    tempDirectory: string;
    queryFiles: MultiDatasetQueryFile[];
  }> {
    const tempDirectory =
      await mkdtemp(
        join(
          tmpdir(),
          'multi-dataset-query-',
        ),
      );

    try {
      const queryFiles =
        await Promise.all(
          entries.map(
            async (
              entry,
              index,
            ) => {
              const parquetBuffer =
                await this.storageService.download(
                  entry.dataset
                    .queryObjectKey!,
                );

              const parquetPath =
                join(
                  tempDirectory,
                  `dataset-${index + 1}.parquet`,
                );

              await writeFile(
                parquetPath,
                parquetBuffer,
              );

              return {
                dataset:
                  entry.dataset,

                context:
                  entry.context,

                relationName:
                  entry.relationName,

                parquetPath,
              };
            },
          ),
        );

      return {
        tempDirectory,
        queryFiles,
      };
    } catch (error) {
      await rm(
        tempDirectory,
        {
          recursive: true,
          force: true,
        },
      );

      throw error;
    }
  }

  // ==========================================
  // PYTHON ANALYTICS BRIDGE
  // ==========================================

  private getPythonAnalyticsWorkerPath(): string {
    const configuredPath =
      process.env.PYTHON_ANALYTICS_WORKER_PATH?.trim();

    return (
      configuredPath ||
      resolve(
        process.cwd(),
        'python-engine',
        'worker.py',
      )
    );
  }

  private getPythonAnalyticsExecutable(): string {
    const configuredExecutable =
      process.env.PYTHON_ANALYTICS_PYTHON?.trim();

    if (configuredExecutable) {
      return configuredExecutable;
    }

    const virtualEnvironmentExecutable =
      process.platform === 'win32'
        ? resolve(
            process.cwd(),
            'python-engine',
            '.venv',
            'Scripts',
            'python.exe',
          )
        : resolve(
            process.cwd(),
            'python-engine',
            '.venv',
            'bin',
            'python',
          );

    if (
      existsSync(
        virtualEnvironmentExecutable,
      )
    ) {
      return virtualEnvironmentExecutable;
    }

    return process.platform === 'win32'
      ? 'python'
      : 'python3';
  }

  private async runPythonAnalytics(
    operation: string,
    columns: string[],
    rows: unknown[][],
    args: Record<string, unknown> = {},
  ): Promise<PythonAnalyticsResult> {
    const requestId =
      randomUUID();

    const workerPath =
      this.getPythonAnalyticsWorkerPath();

    const pythonExecutable =
      this.getPythonAnalyticsExecutable();

    const limitedRows =
      rows.slice(
        0,
        this.pythonAnalyticsMaxRows,
      );

    const records =
      limitedRows.map(
        (row) => {
          const record:
            Record<string, unknown> =
            {};

          columns.forEach(
            (
              column,
              index,
            ) => {
              record[column] =
                row[index] ??
                null;
            },
          );

          return record;
        },
      );

    const request =
      JSON.stringify({
        requestId,
        operation,
        rows: records,
        args,
      });

    const startedAt =
      Date.now();

    return await new Promise<PythonAnalyticsResult>(
      (
        resolvePromise,
      ) => {
        let stdout = '';
        let stderr = '';
        let settled = false;

        const finish = (
          response: PythonAnalyticsResult,
        ) => {
          if (settled) {
            return;
          }

          settled = true;
          resolvePromise(response);
        };

        const child =
          spawn(
            pythonExecutable,
            [workerPath],
            {
              cwd: resolve(
                workerPath,
                '..',
              ),

              env:
                process.env,

              windowsHide:
                true,

              stdio: [
                'pipe',
                'pipe',
                'pipe',
              ],
            },
          );

        const timeout =
          setTimeout(
            () => {
              child.kill();

              finish({
                operation,
                status: 'error',

                result:
                  null,

                execution: {
                  durationMs:
                    Date.now() -
                    startedAt,
                },

                error: {
                  code:
                    'PYTHON_ANALYTICS_TIMEOUT',

                  message:
                    `Python analytics operation timed out after ${this.pythonAnalyticsTimeoutMs}ms`,
                },
              });
            },
            this.pythonAnalyticsTimeoutMs,
          );

        child.stdout.on(
          'data',
          (
            chunk: Buffer,
          ) => {
            stdout +=
              chunk.toString(
                'utf8',
              );
          },
        );

        child.stderr.on(
          'data',
          (
            chunk: Buffer,
          ) => {
            stderr +=
              chunk.toString(
                'utf8',
              );
          },
        );

        child.on(
          'error',
          (
            error,
          ) => {
            clearTimeout(
              timeout,
            );

            finish({
              operation,
              status: 'error',

              result:
                null,

              execution: {
                durationMs:
                  Date.now() -
                  startedAt,
              },

              error: {
                code:
                  'PYTHON_ANALYTICS_PROCESS_ERROR',

                message:
                  error.message.slice(
                    0,
                    2000,
                  ),
              },
            });
          },
        );

        child.on(
          'close',
          (
            exitCode,
          ) => {
            clearTimeout(
              timeout,
            );

            if (settled) {
              return;
            }

            const outputLine =
              stdout
                .split(/\r?\n/)
                .map(
                  (
                    line,
                  ) =>
                    line.trim(),
                )
                .find(Boolean);

            if (!outputLine) {
              finish({
                operation,
                status: 'error',

                result:
                  null,

                execution: {
                  durationMs:
                    Date.now() -
                    startedAt,
                },

                error: {
                  code:
                    'PYTHON_ANALYTICS_EMPTY_RESPONSE',

                  message:
                    stderr.trim().slice(
                      0,
                      2000,
                    ) ||
                    `Python analytics worker exited with code ${String(exitCode)}`,
                },
              });

              return;
            }

            try {
              const parsed =
                JSON.parse(
                  outputLine,
                ) as {
                  requestId?: unknown;

                  status?: unknown;

                  result?: unknown;

                  error?: {
                    code?: unknown;
                    message?: unknown;
                  };
                };

              if (
                parsed.requestId !==
                requestId
              ) {
                finish({
                  operation,
                  status: 'error',

                  result:
                    null,

                  execution: {
                    durationMs:
                      Date.now() -
                      startedAt,
                  },

                  error: {
                    code:
                      'PYTHON_ANALYTICS_REQUEST_MISMATCH',

                    message:
                      'Python analytics worker returned an unexpected requestId',
                  },
                });

                return;
              }

              if (
                parsed.status !==
                'success'
              ) {
                finish({
                  operation,
                  status: 'error',

                  result:
                    null,

                  execution: {
                    durationMs:
                      Date.now() -
                      startedAt,
                  },

                  error: {
                    code:
                      typeof parsed
                        .error
                        ?.code ===
                      'string'
                        ? parsed.error
                            .code
                        : 'PYTHON_ANALYTICS_ERROR',

                    message:
                      typeof parsed
                        .error
                        ?.message ===
                      'string'
                        ? parsed.error
                            .message.slice(
                              0,
                              2000,
                            )
                        : 'Python analytics operation failed',
                  },
                });

                return;
              }

              const resultPayload =
                parsed.result as
                  | {
                      result?: unknown;

                      execution?: {
                        durationMs?: unknown;
                      };
                    }
                  | undefined;

              finish({
                operation,

                status:
                  'success',

                result:
                  resultPayload?.result ??
                  resultPayload ??
                  null,

                execution: {
                  durationMs:
                    typeof resultPayload
                      ?.execution
                      ?.durationMs ===
                    'number'
                      ? resultPayload
                          .execution
                          .durationMs
                      : Date.now() -
                        startedAt,
                },

                error:
                  null,
              });
            } catch (
              error
            ) {
              finish({
                operation,
                status: 'error',

                result:
                  null,

                execution: {
                  durationMs:
                    Date.now() -
                    startedAt,
                },

                error: {
                  code:
                    'PYTHON_ANALYTICS_INVALID_RESPONSE',

                  message:
                    error instanceof
                    Error
                      ? error.message.slice(
                          0,
                          2000,
                        )
                      : 'Python analytics worker returned invalid JSON',
                },
              });
            }
          },
        );

        child.stdin.write(
          `${request}\n`,
        );

        child.stdin.end();
      },
    );
  }

  private async runResultAnalytics(
    columns: string[],
    rows: unknown[][],
  ): Promise<PythonAnalyticsResult | null> {
    if (
      !columns.length ||
      !rows.length
    ) {
      return null;
    }

    const analytics =
      await this.runPythonAnalytics(
        'profile',
        columns,
        rows,
      );

    return analytics.status ===
      'success'
      ? analytics
      : null;
  }

  // ==========================================
  // ERROR NORMALIZATION
  // ==========================================

  private normalizeQueryError(
    error: unknown,
  ): HttpException {
    if (
      error instanceof
      HttpException
    ) {
      return error;
    }

    if (
      error instanceof
      DuckDBQueryError
    ) {
      return new BadRequestException({
        code:
          error.code,

        message:
          error.message,

        line:
          error.line,

        column:
          error.column,
      });
    }

    return new BadRequestException(
      'Query execution failed',
    );
  }

  private getErrorMessage(
    error: unknown,
  ): string {
    if (
      error instanceof
      Error
    ) {
      return error.message.slice(
        0,
        4000,
      );
    }

    return 'Unknown query execution error';
  }

  private sqlValidationResultFromError(
    error: unknown,
  ): SqlValidationResult {
    const normalizedError =
      this.normalizeQueryError(
        error,
      );

    if (
      normalizedError instanceof
      HttpException
    ) {
      const response =
        normalizedError.getResponse();

      if (
        typeof response ===
          'object' &&
        response !== null
      ) {
        const body =
          response as {
            code?: unknown;
            message?: unknown;
            line?: unknown;
            column?: unknown;
          };

        return {
          valid: false,

          message:
            typeof body.message ===
            'string'
              ? body.message
              : normalizedError.message,

          line:
            typeof body.line ===
            'number'
              ? body.line
              : null,

          column:
            typeof body.column ===
            'number'
              ? body.column
              : null,
        };
      }

      return {
        valid: false,

        message:
          typeof response ===
          'string'
            ? response
            : normalizedError.message,

        line:
          null,

        column:
          null,
      };
    }

    return {
      valid: false,

      message:
        error instanceof
        Error
          ? error.message
          : 'SQL validation failed',

      line:
        null,

      column:
        null,
    };
  }

  // ==========================================
  // SINGLE-DATASET SQL VALIDATION
  // ==========================================

  async validateSql(
    datasetId: string,
    workspaceId: string,
    sql: string,
  ): Promise<SqlValidationResult> {
    try {
      const dataset =
        await this.getDataset(
          datasetId,
          workspaceId,
        );

      const validatedSql =
        this.sqlValidatorService.validate(
          sql,
        );

      const parquetBuffer =
        await this.storageService.download(
          dataset.queryObjectKey!,
        );

      const tempDirectory =
        await mkdtemp(
          join(
            tmpdir(),
            'dataset-sql-validation-',
          ),
        );

      const parquetPath =
        join(
          tempDirectory,
          'dataset.parquet',
        );

      try {
        await writeFile(
          parquetPath,
          parquetBuffer,
        );

        await this.duckDbService.validateDatasetQuery(
          parquetPath,
          validatedSql,
        );

        return {
          valid:
            true,

          message:
            null,

          line:
            null,

          column:
            null,
        };
      } finally {
        await rm(
          tempDirectory,
          {
            recursive: true,
            force: true,
          },
        );
      }
    } catch (
      error
    ) {
      return this.sqlValidationResultFromError(
        error,
      );
    }
  }

  // ==========================================
  // MULTI-DATASET SQL VALIDATION
  // ==========================================

  async validateSqlForMultipleDatasets(
    datasetIds: string[],
    workspaceId: string,
    sql: string,
  ): Promise<SqlValidationResult> {
    const entries =
      await this.getMultipleDatasetContexts(
        datasetIds,
        workspaceId,
      );

    let validatedSql: string;

    try {
      validatedSql =
        this.sqlValidatorService.validate(
          sql,
        );
    } catch (
      error
    ) {
      return this.sqlValidationResultFromError(
        error,
      );
    }

    let tempDirectory:
      | string
      | null = null;

    try {
      const prepared =
        await this.getMultiDatasetQueryFiles(
          entries,
        );

      tempDirectory =
        prepared.tempDirectory;

      const executableSql =
        this.buildMultiDatasetExecutableSql(
          validatedSql,
          prepared.queryFiles,
        );

      await this.duckDbService.validateDatasetQuery(
        prepared.queryFiles[0]
          .parquetPath,
        executableSql,
      );

      return {
        valid:
          true,

        message:
          null,

        line:
          null,

        column:
          null,
      };
    } catch (
      error
    ) {
      return this.sqlValidationResultFromError(
        error,
      );
    } finally {
      if (tempDirectory) {
        await rm(
          tempDirectory,
          {
            recursive: true,
            force: true,
          },
        );
      }
    }
  }

  // ==========================================
  // SINGLE-DATASET EXECUTION
  // ==========================================

  private async executeAgainstDataset(
    dataset: Dataset,
    sql: string,
    question?: string | null,
    generateExplanation = false,
    generateInsights = false,
  ): Promise<DatasetQueryResult> {
    const startedAt =
      Date.now();

    const parquetBuffer =
      await this.storageService.download(
        dataset.queryObjectKey!,
      );

    const tempDirectory =
      await mkdtemp(
        join(
          tmpdir(),
          'dataset-query-',
        ),
      );

    const parquetPath =
      join(
        tempDirectory,
        'dataset.parquet',
      );

    try {
      await writeFile(
        parquetPath,
        parquetBuffer,
      );

      const result =
        await this.duckDbService.queryDataset(
          parquetPath,
          sql,
        );

      const truncated =
        result.rows.length >
        this.maxResultRows;

      const rows =
        truncated
          ? result.rows.slice(
              0,
              this.maxResultRows,
            )
          : result.rows;

      const summary =
        this.resultSummaryService.summarize(
          result.columns,
          rows,
        );

      const visualization =
        this.resultVisualizationService.analyze(
          result.columns,
          rows,
          question,
        );

      const analytics =
        await this.runResultAnalytics(
          result.columns,
          rows,
        );

      /*
       * AI Insights are optional enrichment.
       *
       * Important:
       * - They run for actual analysis requests.
       * - They do NOT run for dataset preview requests.
       * - Failure never breaks successful SQL execution.
       */
      const aiInsights =
        generateInsights
          ? await this.generateResultInsights(
              question,
              sql,
              [
                {
                  id:
                    dataset.id,

                  name:
                    dataset.name,

                  columns:
                    result.columns.map(
                      (column) => ({
                        name:
                          column,
                      }),
                    ),
                },
              ],
              result.columns,
              rows,
              rows.length,
              analytics,
            )
          : null;

      const executionTimeMs =
        Date.now() -
        startedAt;

      const explanation =
        generateExplanation
          ? await this.generateResultExplanation(
              question,
              result.columns,
              rows,
              rows.length,
              truncated,
              summary,
            )
          : null;

      return {
        sql,

        columns:
          result.columns,

        rows,

        rowCount:
          rows.length,

        truncated,

        executionTimeMs,

        summary,

        visualization,

        explanation,

        analytics,

        aiInsights,

        followUpQuestions:
          generateExplanation
            ? await this.generateFollowUpQuestions(
                question,
                result.columns,
                rows,
                summary,
                explanation,
              )
            : [],
      };
    } finally {
      await rm(
        tempDirectory,
        {
          recursive: true,
          force: true,
        },
      );
    }
  }

  // ==========================================
  // MULTI-DATASET EXECUTION
  // ==========================================

  private async executeAgainstMultipleDatasets(
    entries: MultiDatasetContextEntry[],
    sql: string,
    question?: string | null,
    generateExplanation = false,
    generateInsights = false,
  ): Promise<DatasetQueryResult> {
    const startedAt =
      Date.now();

    const validatedSql =
      this.sqlValidatorService.validate(
        sql,
      );

    const prepared =
      await this.getMultiDatasetQueryFiles(
        entries,
      );

    try {
      const executableSql =
        this.buildMultiDatasetExecutableSql(
          validatedSql,
          prepared.queryFiles,
        );

      const result =
        await this.duckDbService.queryDataset(
          prepared.queryFiles[0]
            .parquetPath,
          executableSql,
        );

      const truncated =
        result.rows.length >
        this.maxResultRows;

      const rows =
        truncated
          ? result.rows.slice(
              0,
              this.maxResultRows,
            )
          : result.rows;

      const summary =
        this.resultSummaryService.summarize(
          result.columns,
          rows,
        );

      const visualization =
        this.resultVisualizationService.analyze(
          result.columns,
          rows,
          question,
        );

      const analytics =
        await this.runResultAnalytics(
          result.columns,
          rows,
        );

      /*
       * AI Insights operate on the FINAL combined
       * multi-dataset result.
       */
      const aiInsights =
        generateInsights
          ? await this.generateResultInsights(
              question,
              validatedSql,
              entries.map(
                (entry) => ({
                  id:
                    entry.dataset.id,

                  name:
                    entry.dataset.name,

                  columns:
                    entry.context.columns.map(
                      (column) => ({
                        name:
                          column.name,

                        type:
                          column.dataType,
                      }),
                    ),
                }),
              ),
              result.columns,
              rows,
              rows.length,
              analytics,
            )
          : null;

      const executionTimeMs =
        Date.now() -
        startedAt;

      const explanation =
        generateExplanation
          ? await this.generateResultExplanation(
              question,
              result.columns,
              rows,
              rows.length,
              truncated,
              summary,
            )
          : null;

      return {
        sql:
          validatedSql,

        columns:
          result.columns,

        rows,

        rowCount:
          rows.length,

        truncated,

        executionTimeMs,

        summary,

        visualization,

        explanation,

        analytics,

        aiInsights,

        followUpQuestions:
          generateExplanation
            ? await this.generateFollowUpQuestions(
                question,
                result.columns,
                rows,
                summary,
                explanation,
              )
            : [],
      };
    } finally {
      await rm(
        prepared.tempDirectory,
        {
          recursive: true,
          force: true,
        },
      );
    }
  }

  // ==========================================
  // PREVIEW
  // ==========================================

  async previewDataset(
    datasetId: string,
    workspaceId: string,
    limit = 100,
  ): Promise<DatasetQueryResult> {
    try {
      const dataset =
        await this.getDataset(
          datasetId,
          workspaceId,
        );

      const safeLimit =
        Math.max(
          1,
          Math.min(
            Math.floor(limit),
            1000,
          ),
        );

      const previewSql = `
        SELECT *
        FROM dataset
        LIMIT ${safeLimit}
      `;

      return await this.executeAgainstDataset(
        dataset,
        previewSql,
        null,
        false,
        false,
      );
    } catch (
      error
    ) {
      throw this.normalizeQueryError(
        error,
      );
    }
  }

  // ==========================================
  // SINGLE-DATASET GENERATION
  // ==========================================

  async generateSqlForUser(
    datasetId: string,
    workspaceId: string,
    userId: string,
    question: string,
    conversationId?: string | null,
  ) {
    const conversationContext =
      await this.getConversationContext(
        workspaceId,
        datasetId,
        userId,
        conversationId,
      );

    return this.sqlGenerationService.generateSql(
      datasetId,
      workspaceId,
      question,
      conversationContext,
    );
  }

  // ==========================================
  // MULTI-DATASET GENERATION
  // ==========================================

  async generateSqlForMultipleDatasets(
    datasetIds: string[],
    workspaceId: string,
    userId: string,
    question: string,
    conversationId?: string | null,
  ): Promise<MultiDatasetSqlGenerationResult> {
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

    const entries =
      await this.getMultipleDatasetContexts(
        datasetIds,
        workspaceId,
      );

    const previewSql =
      this.buildSimpleMultiDatasetPreviewSql(
        normalizedQuestion,
        entries,
      );

    if (previewSql) {
      const validatedSql =
        this.sqlValidatorService.validate(
          previewSql,
        );

      return {
        question:
          normalizedQuestion,

        sql:
          validatedSql,

        provider:
          'local',

        model:
          null,
      };
    }

    const requiresAllDatasets =
      this.questionRequiresAllDatasets(
        normalizedQuestion,
      );

    const relationshipCandidates =
      this.buildRelationshipCandidates(
        entries,
      );

    const previousContext =
      await this.getMultiDatasetConversationContext(
        workspaceId,
        userId,
        conversationId,
        entries,
      );

    const systemPrompt =
      this.buildMultiDatasetSystemPrompt();

    const userPrompt =
      `
${this.buildMultiDatasetUserPrompt(
  normalizedQuestion,
  entries,
  requiresAllDatasets,
)}

${previousContext}

RELATIONSHIP CANDIDATES COUNT:
${relationshipCandidates.length}

Generate exactly one SQL statement.
`.trim();

    const generated =
      await this.aiService.generateText({
        systemPrompt,
        userPrompt,
        temperature: 0,
        maxOutputTokens: 2500,
      });

    let generatedSql =
      this.normalizeGeneratedSql(
        generated.text,
      );

    if (!generatedSql) {
      throw new BadRequestException(
        'AI provider returned empty SQL',
      );
    }

    generatedSql =
      this.sqlValidatorService.validate(
        generatedSql,
      );

    if (
      requiresAllDatasets &&
      !this.sqlReferencesAllRelations(
        generatedSql,
        entries,
      )
    ) {
      const missingEntries =
        this.getMissingRelations(
          generatedSql,
          entries,
        );

      const missingRelations =
        missingEntries
          .map(
            (entry) =>
              `- ${entry.relationName} = ${entry.dataset.name}`,
          )
          .join('\n');

      const selectedRelations =
        entries
          .map(
            (entry) =>
              `- ${entry.relationName} = ${entry.dataset.name}`,
          )
          .join('\n');

      const correctionPrompt = `
The previous SQL is INVALID FOR THE USER'S REQUEST because the user explicitly requested analysis across ALL selected datasets.

USER REQUEST:
${normalizedQuestion}

SELECTED DATASETS / RELATIONS:
${selectedRelations}

RELATIONS MISSING FROM PREVIOUS SQL:
${missingRelations}

PREVIOUS SQL:
${generatedSql}

You MUST correct the SQL.

MANDATORY:
- Every selected relation MUST appear in the corrected SQL.
- Do NOT answer using only dataset_1.
- Do NOT ignore any selected dataset.
- Do NOT silently discard dataset_2, dataset_3, or any other selected relation.
- Preserve the user's requested analytical intent.
- Use UNION ALL BY NAME when combining compatible rows.
- Use JOINs only when a valid relationship exists.
- Use CTEs when useful.
- Use only columns from the supplied schemas.
- Do not invent tables.
- Do not invent columns.
- Do not invent relationships.
- Return exactly ONE valid DuckDB SQL statement.
- Return SQL only.
`.trim();

      const corrected =
        await this.aiService.generateText({
          systemPrompt,
          userPrompt:
            correctionPrompt,
          temperature: 0,
          maxOutputTokens: 2500,
        });

      const correctedSql =
        this.normalizeGeneratedSql(
          corrected.text,
        );

      if (!correctedSql) {
        throw new BadRequestException(
          'AI provider returned empty SQL during multi-dataset correction',
        );
      }

      generatedSql =
        this.sqlValidatorService.validate(
          correctedSql,
        );

      if (
        !this.sqlReferencesAllRelations(
          generatedSql,
          entries,
        )
      ) {
        const stillMissing =
          this.getMissingRelations(
            generatedSql,
            entries,
          )
            .map(
              (entry) =>
                entry.dataset.name,
            )
            .join(', ');

        throw new BadRequestException(
          `AI generated SQL did not reference all selected datasets. Missing: ${stillMissing}`,
        );
      }

      return {
        question:
          normalizedQuestion,

        sql:
          generatedSql,

        provider:
          corrected.provider,

        model:
          corrected.model,
      };
    }

    return {
      question:
        normalizedQuestion,

      sql:
        generatedSql,

      provider:
        generated.provider,

      model:
        generated.model,
    };
  }

  // ==========================================
  // MULTI-DATASET CONVERSATION CONTEXT
  // ==========================================

  private async getMultiDatasetConversationContext(
    workspaceId: string,
    userId: string,
    conversationId:
      | string
      | null
      | undefined,
    entries: MultiDatasetContextEntry[],
  ): Promise<string> {
    const normalizedConversationId =
      conversationId?.trim() ||
      null;

    if (!normalizedConversationId) {
      return `
CONVERSATION CONTEXT:
- No previous conversation context is available.
- Interpret the current multi-dataset request from the selected schemas.
`.trim();
    }

    const historyResults =
      await Promise.all(
        entries.map(
          async (entry) => {
            const history =
              await this.queryHistoryRepository.find({
                where: {
                  workspaceId,

                  datasetId:
                    entry.dataset.id,

                  userId,

                  conversationId:
                    normalizedConversationId,
                },

                order: {
                  createdAt:
                    'DESC',
                },

                take:
                  this.conversationContextLimit,
              });

            return history;
          },
        ),
      );

    const combinedHistory =
      historyResults
        .flat()
        .sort(
          (
            left,
            right,
          ) =>
            left.createdAt.getTime() -
            right.createdAt.getTime(),
        )
        .slice(
          -this.conversationContextLimit,
        );

    if (
      !combinedHistory.length
    ) {
      return `
CONVERSATION CONTEXT:
- No previous conversation context is available.
- Interpret the current multi-dataset request from the selected schemas.
`.trim();
    }

    const entriesPrompt =
      combinedHistory
        .map(
          (
            item,
            index,
          ) => `
Previous query ${index + 1}:
- Question: ${item.question?.trim() || '[question not available]'}
- SQL: ${item.sql}
- Result row count: ${item.rowCount === null ? 'unknown' : String(item.rowCount)}
- Status: ${item.status}
- Created at: ${item.createdAt.toISOString()}
`.trim(),
        )
        .join('\n\n');

    return `
CONVERSATION CONTEXT:
The following previous queries may help interpret the current request.

${entriesPrompt}

CONTEXT RULES:
- The current question has highest priority.
- Previous queries are contextual evidence only.
- Preserve previous intent only when the current request clearly continues it.
- Do not blindly copy previous SQL.
- Do not introduce relations or columns absent from the current selected dataset context.
`.trim();
  }

  // ==========================================
  // BACKGROUND ANALYSIS JOBS
  // ==========================================

  private getAnalysisJobOptions() {
    return {
      attempts: this.analysisJobAttempts,
      backoff: {
        type: 'exponential' as const,
        delay: this.analysisJobBackoffMs,
      },
      removeOnComplete: this.analysisJobRemoveOnComplete,
      removeOnFail: this.analysisJobRemoveOnFail,
    };
  }

  private async enqueueAnalysisJob(
    data: AnalysisJobData,
  ): Promise<{
    jobId: string;
    queue: 'analysis';
    status: 'queued';
  }> {
    const jobId = randomUUID();

    await this.analysisQueue.add(
      data.type,
      data,
      {
        ...this.getAnalysisJobOptions(),
        jobId,
      },
    );

    return {
      jobId,
      queue: 'analysis',
      status: 'queued',
    };
  }

  async enqueueSqlQuery(
    datasetId: string,
    workspaceId: string,
    userId: string,
    sql: string,
    question?: string | null,
    conversationId?: string | null,
  ) {
    await this.getDataset(
      datasetId,
      workspaceId,
    );

    return this.enqueueAnalysisJob({
      type: 'sql',
      datasetIds: [datasetId],
      workspaceId,
      userId,
      sql,
      ...(question?.trim()
        ? { question: question.trim() }
        : {}),
      conversationId:
        conversationId?.trim() || null,
    });
  }

  async enqueueNaturalLanguageQuery(
    datasetId: string,
    workspaceId: string,
    userId: string,
    question: string,
    conversationId?: string | null,
  ) {
    if (!question?.trim()) {
      throw new BadRequestException(
        'Question is required',
      );
    }

    await this.getDataset(
      datasetId,
      workspaceId,
    );

    return this.enqueueAnalysisJob({
      type: 'natural_language',
      datasetIds: [datasetId],
      workspaceId,
      userId,
      question: question.trim(),
      conversationId:
        conversationId?.trim() || null,
    });
  }

  async enqueueSqlQueryForMultipleDatasets(
    datasetIds: string[],
    workspaceId: string,
    userId: string,
    sql: string,
    question?: string | null,
    conversationId?: string | null,
  ) {
    const entries =
      await this.getMultipleDatasetContexts(
        datasetIds,
        workspaceId,
      );

    return this.enqueueAnalysisJob({
      type: 'multi_dataset_sql',
      datasetIds: entries.map(
        (entry) => entry.dataset.id,
      ),
      workspaceId,
      userId,
      sql,
      ...(question?.trim()
        ? { question: question.trim() }
        : {}),
      conversationId:
        conversationId?.trim() || null,
    });
  }

  async enqueueNaturalLanguageQueryForMultipleDatasets(
    datasetIds: string[],
    workspaceId: string,
    userId: string,
    question: string,
    conversationId?: string | null,
  ) {
    if (!question?.trim()) {
      throw new BadRequestException(
        'Question is required',
      );
    }

    const normalizedDatasetIds =
      this.normalizeDatasetIds(
        datasetIds,
      );

    await this.getMultipleDatasetContexts(
      normalizedDatasetIds,
      workspaceId,
    );

    return this.enqueueAnalysisJob({
      type: 'multi_dataset_natural_language',
      datasetIds: normalizedDatasetIds,
      workspaceId,
      userId,
      question: question.trim(),
      conversationId:
        conversationId?.trim() || null,
    });
  }

  async processAnalysisJob(
    job: Job<AnalysisJobData>,
  ): Promise<
    | DatasetQueryResult
    | NaturalLanguageQueryResult
  > {
    const data = job.data;

    await job.updateProgress({
      stage: 'started',
      percent: 5,
    });

    try {
      let result:
        | DatasetQueryResult
        | NaturalLanguageQueryResult;

      switch (data.type) {
        case 'sql': {
          await job.updateProgress({
            stage: 'validating',
            percent: 15,
          });

          result = await this.executeSql(
            data.datasetIds[0]!,
            data.workspaceId,
            data.userId,
            data.sql ?? '',
            data.question ?? null,
            data.conversationId ?? null,
          );
          break;
        }

        case 'natural_language': {
          await job.updateProgress({
            stage: 'generating_sql',
            percent: 15,
          });

          result =
            await this.executeNaturalLanguageQuery(
              data.datasetIds[0]!,
              data.workspaceId,
              data.userId,
              data.question ?? '',
              data.conversationId ?? null,
            );
          break;
        }

        case 'multi_dataset_sql': {
          await job.updateProgress({
            stage: 'validating',
            percent: 15,
          });

          result =
            await this.executeSqlForMultipleDatasets(
              data.datasetIds,
              data.workspaceId,
              data.userId,
              data.sql ?? '',
              data.question ?? null,
              data.conversationId ?? null,
            );
          break;
        }

        case 'multi_dataset_natural_language': {
          await job.updateProgress({
            stage: 'generating_sql',
            percent: 15,
          });

          result =
            await this.executeNaturalLanguageQueryForMultipleDatasets(
              data.datasetIds,
              data.workspaceId,
              data.userId,
              data.question ?? '',
              data.conversationId ?? null,
            );
          break;
        }

        default:
          throw new BadRequestException(
            'Unsupported analysis job type',
          );
      }

      await job.updateProgress({
        stage: 'completed',
        percent: 100,
      });

      return result;
    } catch (error) {
      await job.updateProgress({
        stage: 'failed',
        percent: 100,
      });

      throw error;
    }
  }

  async getAnalysisJobStatus(
    jobId: string,
    workspaceId: string,
    userId: string,
  ): Promise<AnalysisJobStatus> {
    const job =
      await this.analysisQueue.getJob(
        jobId,
      );

    if (!job) {
      throw new NotFoundException(
        'Analysis job was not found or has already been cleaned up',
      );
    }

    if (
      job.data.workspaceId !== workspaceId ||
      job.data.userId !== userId
    ) {
      throw new NotFoundException(
        'Analysis job was not found for this workspace',
      );
    }

    const state =
      await job.getState();

    const normalizedStatus:
      AnalysisJobStatus['status'] =
      state === 'waiting' ||
      state === 'active' ||
      state === 'delayed' ||
      state === 'completed' ||
      state === 'failed'
        ? state
        : 'unknown';

    return {
      jobId: String(job.id),
      queue: 'analysis',
      type: job.data.type,
      status: normalizedStatus,
      progress:
        job.progress ?? null,
      attemptsMade:
        job.attemptsMade,
      maxAttempts:
        job.opts.attempts ??
        this.analysisJobAttempts,
      createdAt: job.timestamp
        ? new Date(job.timestamp).toISOString()
        : null,
      processedAt: job.processedOn
        ? new Date(job.processedOn).toISOString()
        : null,
      finishedAt: job.finishedOn
        ? new Date(job.finishedOn).toISOString()
        : null,
      failedReason:
        job.failedReason ?? null,
      result:
        normalizedStatus === 'completed'
          ? job.returnvalue ?? null
          : null,
    };
  }

  // ==========================================
  // SINGLE-DATASET EXECUTION
  // ==========================================

  async executeSql(
    datasetId: string,
    workspaceId: string,
    userId: string,
    sql: string,
    question?: string | null,
    conversationId?: string | null,
  ): Promise<DatasetQueryResult> {
    const startedAt =
      Date.now();

    let failureType:
      | 'validation'
      | 'execution'
      | null = 'validation';

    try {
      const dataset =
        await this.getDataset(
          datasetId,
          workspaceId,
        );

      const validatedSql =
        this.sqlValidatorService.validate(
          sql,
        );

      failureType =
        'execution';

      const result =
        await this.executeAgainstDataset(
          dataset,
          validatedSql,
          question,
          true,
          true,

        );

      await this.queryHistoryRepository.save(
        this.queryHistoryRepository.create({
          workspaceId,

          datasetId,

          userId,

          conversationId:
            conversationId?.trim() ||
            null,

          question:
            question?.trim() ||
            null,

          sql:
            validatedSql,

          rowCount:
            result.rowCount,

          executionTimeMs:
            result.executionTimeMs,

          status:
            'success',

          failureType:
            null,

          errorMessage:
            null,
        }),
      );

      return result;
    } catch (
      error
    ) {
      const executionTimeMs =
        Date.now() -
        startedAt;

      await this.queryHistoryRepository.save(
        this.queryHistoryRepository.create({
          workspaceId,

          datasetId,

          userId,

          conversationId:
            conversationId?.trim() ||
            null,

          question:
            question?.trim() ||
            null,

          sql,

          rowCount:
            null,

          executionTimeMs,

          status:
            'failed',

          failureType,

          errorMessage:
            this.getErrorMessage(
              error,
            ),
        }),
      );

      throw this.normalizeQueryError(
        error,
      );
    }
  }

  // ==========================================
  // MULTI-DATASET EXECUTION
  // ==========================================

  async executeSqlForMultipleDatasets(
    datasetIds: string[],
    workspaceId: string,
    userId: string,
    sql: string,
    question?: string | null,
    conversationId?: string | null,
  ): Promise<DatasetQueryResult> {
    const startedAt =
      Date.now();

    let failureType:
      | 'validation'
      | 'execution' = 'validation';

    try {
      const entries =
        await this.getMultipleDatasetContexts(
          datasetIds,
          workspaceId,
        );

      const validation =
        await this.validateSqlForMultipleDatasets(
          datasetIds,
          workspaceId,
          sql,
        );

      if (!validation.valid) {
        throw new BadRequestException({
          message:
            validation.message ??
            'SQL semantic validation failed',

          line:
            validation.line,

          column:
            validation.column,
        });
      }

      failureType =
        'execution';

      const result =
        await this.executeAgainstMultipleDatasets(
          entries,
          sql,
          question,
          true,
          true,
        );

      if (
        question?.trim() &&
        result.rows.length > 0
      ) {
        result.followUpQuestions =
          await this.generateFollowUpQuestions(
            question,
            result.columns,
            result.rows,
            result.summary,
            result.explanation,
          );
      } else {
        result.followUpQuestions =
          [];
      }

      const normalizedConversationId =
        conversationId?.trim() ||
        null;

      const normalizedQuestion =
        question?.trim() ||
        null;

      const executionTimeMs =
        Date.now() -
        startedAt;

      await Promise.all(
        entries.map(
          (entry) =>
            this.queryHistoryRepository.save(
              this.queryHistoryRepository.create({
                workspaceId,

                datasetId:
                  entry.dataset.id,

                userId,

                conversationId:
                  normalizedConversationId,

                question:
                  normalizedQuestion,

                sql:
                  result.sql,

                rowCount:
                  result.rowCount,

                executionTimeMs,

                status:
                  'success',

                failureType:
                  null,

                errorMessage:
                  null,
              }),
            ),
        ),
      );

      return result;
    } catch (
      error
    ) {
      const executionTimeMs =
        Date.now() -
        startedAt;

      try {
        const entries =
          await this.getMultipleDatasetContexts(
            datasetIds,
            workspaceId,
          );

        const normalizedConversationId =
          conversationId?.trim() ||
          null;

        const normalizedQuestion =
          question?.trim() ||
          null;

        await Promise.all(
          entries.map(
            (entry) =>
              this.queryHistoryRepository.save(
                this.queryHistoryRepository.create({
                  workspaceId,

                  datasetId:
                    entry.dataset.id,

                  userId,

                  conversationId:
                    normalizedConversationId,

                  question:
                    normalizedQuestion,

                  sql,

                  rowCount:
                    null,

                  executionTimeMs,

                  status:
                    'failed',

                  failureType,

                  errorMessage:
                    this.getErrorMessage(
                      error,
                    ),
                }),
              ),
          ),
        );
      } catch {
        /*
         * History persistence must never hide the original
         * query error.
         */
      }

      throw this.normalizeQueryError(
        error,
      );
    }
  }

  // ==========================================
  // SINGLE-DATASET NATURAL LANGUAGE
  // ==========================================

  async executeNaturalLanguageQuery(
    datasetId: string,
    workspaceId: string,
    userId: string,
    question: string,
    conversationId?: string | null,
  ): Promise<NaturalLanguageQueryResult> {
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
        question,
        conversationContext,
      );

    const result =
      await this.executeSql(
        datasetId,
        workspaceId,
        userId,
        generation.sql,
        generation.question,
        conversationId,
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

      result,
    };
  }

  // ==========================================
  // MULTI-DATASET NATURAL LANGUAGE
  // ==========================================

  async executeNaturalLanguageQueryForMultipleDatasets(
    datasetIds: string[],
    workspaceId: string,
    userId: string,
    question: string,
    conversationId?: string | null,
  ): Promise<NaturalLanguageQueryResult> {
    const generation =
      await this.generateSqlForMultipleDatasets(
        datasetIds,
        workspaceId,
        userId,
        question,
        conversationId,
      );

    const result =
      await this.executeSqlForMultipleDatasets(
        datasetIds,
        workspaceId,
        userId,
        generation.sql,
        generation.question,
        conversationId,
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

      result,
    };
  }

  // ==========================================
  // SIMPLE MULTI-DATASET PREVIEW
  // ==========================================

  private buildSimpleMultiDatasetPreviewSql(
    question: string,
    entries: MultiDatasetContextEntry[],
  ): string | null {
    const normalizedQuestion =
      question
        .trim()
        .toLocaleLowerCase();

    const mentionsTenRows =
      normalizedQuestion.includes(
        'first 10 rows',
      ) ||
      normalizedQuestion.includes(
        'first ten rows',
      ) ||
      normalizedQuestion.includes(
        '10 rows',
      ) ||
      normalizedQuestion.includes(
        'ten rows',
      );

    const mentionsEveryDataset =
      normalizedQuestion.includes(
        'each dataset',
      ) ||
      normalizedQuestion.includes(
        'each selected dataset',
      ) ||
      normalizedQuestion.includes(
        'every dataset',
      ) ||
      normalizedQuestion.includes(
        'every selected dataset',
      ) ||
      normalizedQuestion.includes(
        'selected datasets',
      ) ||
      normalizedQuestion.includes(
        'all datasets',
      ) ||
      normalizedQuestion.includes(
        'all selected datasets',
      ) ||
      normalizedQuestion.includes(
        'each file',
      ) ||
      normalizedQuestion.includes(
        'every file',
      ) ||
      normalizedQuestion.includes(
        'all files',
      );

    const isPreviewRequest =
      mentionsTenRows &&
      mentionsEveryDataset;

    if (!isPreviewRequest) {
      return null;
    }

    const previewQueries =
      entries.map(
        (entry) =>
          `SELECT * FROM (
  SELECT *
  FROM ${entry.relationName}
  LIMIT 10
)`,
      );

    if (
      !previewQueries.length
    ) {
      return null;
    }

    return previewQueries.join(
      '\nUNION ALL BY NAME\n',
    );
  }

  // ==========================================
  // SQL NORMALIZATION
  // ==========================================

  private normalizeGeneratedSql(
    value: string,
  ): string {
    let sql =
      value.trim();

    if (!sql) {
      return '';
    }

    if (
      sql.startsWith(
        '\uFEFF',
      )
    ) {
      sql =
        sql
          .slice(1)
          .trim();
    }

    const fencedMatch =
      sql.match(
        /^```(?:sql)?\s*([\s\S]*?)\s*```$/i,
      );

    if (fencedMatch) {
      sql =
        fencedMatch[1].trim();
    }

    sql =
      sql
        .replace(
          /^SQL\s*:\s*/i,
          '',
        )
        .trim();

    return sql;
  }
}