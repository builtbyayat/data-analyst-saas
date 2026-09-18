import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { AiService } from '../ai/ai.service.js';
import { DatasetsService } from '../datasets/datasets.service.js';

import { SqlValidatorService } from './sql-validator.service.js';

export interface SqlGenerationResult {
  question: string;
  sql: string;
  provider: string;
  model: string | null;
}

@Injectable()
export class SqlGenerationService {
  constructor(
    private readonly aiService: AiService,

    private readonly datasetsService: DatasetsService,

    private readonly sqlValidatorService: SqlValidatorService,
  ) {}

  async generateSql(
    datasetId: string,
    workspaceId: string,
    question: string,
  ): Promise<SqlGenerationResult> {
    const normalizedQuestion =
      question.trim();

    if (!normalizedQuestion) {
      throw new BadRequestException(
        'Natural-language question is required',
      );
    }

    if (
      normalizedQuestion.length > 4000
    ) {
      throw new BadRequestException(
        'Natural-language question is too long',
      );
    }

    const context =
      await this.datasetsService.getAnalysisContext(
        datasetId,
        workspaceId,
      );

    const systemPrompt =
      this.buildSystemPrompt();

    const userPrompt =
      this.buildUserPrompt(
        normalizedQuestion,
        context,
      );

    const generated =
      await this.aiService.generateText({
        systemPrompt,
        userPrompt,
        temperature: 0,
        maxOutputTokens: 2000,
      });

    const generatedSql =
      this.normalizeGeneratedSql(
        generated.text,
      );

    if (!generatedSql) {
      throw new BadRequestException(
        'AI provider returned empty SQL',
      );
    }

    const validatedSql =
      this.sqlValidatorService.validate(
        generatedSql,
      );

    return {
      question:
        normalizedQuestion,

      sql:
        validatedSql,

      provider:
        generated.provider,

      model:
        generated.model,
    };
  }

  private normalizeGeneratedSql(
    value: string,
  ): string {
    let sql =
      value.trim();

    if (!sql) {
      return '';
    }

    if (
      sql.startsWith('\uFEFF')
    ) {
      sql =
        sql.slice(1).trim();
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
      sql.replace(
        /^SQL\s*:\s*/i,
        '',
      ).trim();

    return sql;
  }

  private buildSystemPrompt(): string {
    return `
You are a SQL generation engine for an AI Data Analyst.

Your task is to convert the user's natural-language
question into ONE safe, read-only SQL query.

Rules:
- Return SQL only.
- Do not return Markdown.
- Do not use code fences.
- Do not prefix the response with "SQL:".
- Use only the columns provided in the dataset schema.
- The dataset is available as the table named "dataset".
- Generate only SELECT or WITH queries.
- Never modify data or schema.
- Never access files, external tables, URLs, or other databases.
- Do not invent columns or tables.
- Prefer clear, deterministic SQL.
`.trim();
  }

  private buildUserPrompt(
    question: string,
    context: {
      dataset: {
        name: string;
        rowCount: number;
        columnCount: number;
        status: string;
      };
      columns: Array<{
        name: string;
        dataType: string;
        nullable: boolean;
        nullCount: number;
        distinctCount: number;
        ordinalPosition: number;
      }>;
    },
  ): string {
    const schema =
      context.columns
        .map(
          (column) =>
            `${column.name} | type=${column.dataType} | nullable=${column.nullable} | nullCount=${column.nullCount} | distinctCount=${column.distinctCount}`,
        )
        .join('\n');

    return `
Dataset:
- Name: ${context.dataset.name}
- Rows: ${context.dataset.rowCount}
- Columns: ${context.dataset.columnCount}
- Table name: dataset

Columns:
${schema}

User question:
${question}

Return one SQL query only.
`.trim();
  }
}