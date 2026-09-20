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

import { DuckDBService } from './duckdb.service.js';
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
        ? 'Answer in the same natural language and script used by the user question. Do not translate it to English unless the question itself is in English.'
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

LANGUAGE REQUIREMENT:
- Detect the language and linguistic style of the user's original question yourself.
- Write all 3 questions in the same natural language and script.
- If the user mixes languages, preserve the same natural mixed-language style.
- Do not default to English.
- Do not translate the question into another language.
- Do not restrict yourself to a predefined language list.

DATA REQUIREMENTS:
- Use only the selected dataset, available result columns, returned result evidence, and summary.
- Make every question relevant to the current result.
- Do not invent columns, values, entities, facts, or business context.
- Explore different useful analytical angles rather than three versions of the same question.
- Prefer questions that can be answered from the dataset/result without requiring outside information.

VARIETY:
- Make the 3 questions meaningfully different from one another.
- Avoid repeating the same question wording or analytical intent.
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

Returned result columns:
${columns.join(', ') || '(none)'}

Result summary:
${numericSummary || '(No numeric summary is available.)'}

Current result explanation:
${explanation || '(No explanation is available.)'}

Sample returned rows:
${JSON.stringify(sampleRows)}

Generate exactly 3 fresh follow-up questions for this result.
`.trim();

    const parseQuestions = (text: string): string[] =>
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
                .replace(/^['"]|['"]$/g, '')
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
        parseQuestions(generated.text);

      if (questions.length === 3) {
        return questions;
      }

      const retry =
        await this.aiService.generateText({
          systemPrompt: `${systemPrompt}\n\nCRITICAL: Your previous response did not contain exactly 3 usable questions. Return exactly 3 now.`,
          userPrompt,
          temperature: 0.9,
          maxOutputTokens: 700,
        });

      return parseQuestions(retry.text);
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

      const limitedSql = `
        SELECT *
        FROM (
          ${sql}
        ) AS user_query
        LIMIT ${this.maxResultRows + 1}
      `;

      const result =
        await this.duckDbService.queryDataset(
          parquetPath,
          limitedSql,
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