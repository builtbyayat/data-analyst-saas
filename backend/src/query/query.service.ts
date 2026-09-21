import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';

import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AiService } from '../ai/ai.service.js';
import { Dataset } from '../datasets/dataset.entity.js';
import { StorageService } from '../storage/storage.service.js';

import {
  DuckDBQueryError,
  DuckDBService,
} from './duckdb.service.js';
import { QueryHistory } from './query-history.entity.js';
import { ResultSummaryService } from './result-summary.service.js';
import {
  ResultVisualization,
  ResultVisualizationService,
} from './result-visualization.service.js';
import { SqlGenerationService } from './sql-generation.service.js';
import { SqlValidatorService } from './sql-validator.service.js';

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
  status: 'success' | 'failed';
  createdAt: Date;
}

export interface SqlValidationResult {
  valid: boolean;
  message: string | null;
  line: number | null;
  column: number | null;
}

@Injectable()
export class QueryService {
  private readonly maxResultRows = 5000;

  private readonly conversationContextLimit = 8;

  constructor(
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
  ) {}

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
    } catch {
      return null;
    }
  }

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

  private normalizeQueryError(
    error: unknown,
  ): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    if (error instanceof DuckDBQueryError) {
      return new BadRequestException({
        code: error.code,
        message: error.message,
        line: error.line,
        column: error.column,
      });
    }

    return new BadRequestException(
      'Query execution failed',
    );
  }

  private getErrorMessage(
    error: unknown,
  ): string {
    if (error instanceof Error) {
      return error.message.slice(
        0,
        4000,
      );
    }

    return 'Unknown query execution error';
  }

  /**
   * Performs lightweight local SQL validation first and then
   * validates the SQL against the actual dataset through DuckDB.
   *
   * The DuckDB validation path uses prepare() without executing
   * the statement, allowing semantic errors such as unknown
   * columns, invalid functions, and invalid dataset references
   * to be detected before Run.
   */
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
          valid: true,
          message: null,
          line: null,
          column: null,
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
    } catch (error) {
      const normalizedError =
        this.normalizeQueryError(
          error,
        );

      if (
        normalizedError instanceof HttpException
      ) {
        const response =
          normalizedError.getResponse();

        if (
          typeof response === 'object' &&
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
              typeof body.message === 'string'
                ? body.message
                : normalizedError.message,
            line:
              typeof body.line === 'number'
                ? body.line
                : null,
            column:
              typeof body.column === 'number'
                ? body.column
                : null,
          };
        }

        return {
          valid: false,
          message:
            typeof response === 'string'
              ? response
              : normalizedError.message,
          line: null,
          column: null,
        };
      }

        return {
        valid: false,
        message:
          error instanceof Error
            ? error.message
            : 'SQL validation failed',
        line: null,
        column: null,
      };
    }
  }

  private async executeAgainstDataset(
    dataset: Dataset,
    sql: string,
    question?: string | null,
    generateExplanation = false,
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

      /*
       * Execute the user's SQL directly.
       *
       * The query is not wrapped inside another SELECT.
       * DuckDB remains the source of truth for SQL syntax
       * and semantic validation.
       */
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
      );
    } catch (error) {
      throw this.normalizeQueryError(
        error,
      );
    }
  }

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

      failureType = 'execution';

      const result =
        await this.executeAgainstDataset(
          dataset,
          validatedSql,
          question,
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
    } catch (error) {
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
}