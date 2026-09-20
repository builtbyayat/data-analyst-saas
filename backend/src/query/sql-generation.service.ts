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

export interface SqlGenerationConversationContext {
  question: string | null;
  sql: string;
  rowCount: number | null;
  status: 'success' | 'failed';
  createdAt: Date;
}

interface DatasetAnalysisContext {
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
    conversationContext: SqlGenerationConversationContext[] = [],
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

    /*
     * Positional column operations such as:
     *
     * - remove last 10 columns
     * - delete last 10 columns
     * - drop last 10 columns
     * - exclude last 10 columns
     * - remove first 5 columns
     *
     * are deterministic operations because the dataset schema already
     * contains the original ordinal position of every column.
     *
     * Handle these before AI generation so the model cannot reinterpret
     * "last N columns" as an arbitrary SELECT projection.
     */
    const positionalSql =
      this.buildPositionalColumnSql(
        normalizedQuestion,
        context,
      );

    if (positionalSql) {
      const validatedSql =
        this.sqlValidatorService.validate(
          positionalSql,
        );

      return {
        question:
          normalizedQuestion,

        sql:
          validatedSql,

        provider:
          'deterministic',

        model:
          null,
      };
    }

    const systemPrompt =
      this.buildSystemPrompt();

    const userPrompt =
      this.buildUserPrompt(
        normalizedQuestion,
        context,
        conversationContext,
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

  private buildPositionalColumnSql(
    question: string,
    context: DatasetAnalysisContext,
  ): string | null {
    const columns =
      [...context.columns].sort(
        (a, b) =>
          a.ordinalPosition -
          b.ordinalPosition,
      );

    if (!columns.length) {
      return null;
    }

    const normalized =
      question
        .trim()
        .toLocaleLowerCase();

    const removalIntent =
      this.hasColumnRemovalIntent(
        normalized,
      );

    if (!removalIntent) {
      return null;
    }

    const countMatch =
      normalized.match(
        /(?:first|last)\s+(\d+)\s+(?:columns?|cols?)/i,
      ) ||
      normalized.match(
        /(?:first|last)\s+(?:the\s+)?(\d+)\s+(?:columns?|cols?)/i,
      ) ||
      normalized.match(
        /(?:पहले|आखिरी|अंतिम|पिछले)\s+(\d+)\s+(?:कॉलम|कॉलम्स|स्तंभ)/i,
      ) ||
      normalized.match(
        /(?:los\s+primeros|los\s+últimos|los\s+ultimos)\s+(\d+)\s+columnas?/i,
      ) ||
      normalized.match(
        /(?:les\s+premières|les\s+dernières|les\s+dernieres)\s+(\d+)\s+colonnes?/i,
      ) ||
      normalized.match(
        /(?:die\s+ersten|die\s+letzten)\s+(\d+)\s+spalten?/i,
      );

    if (!countMatch) {
      return null;
    }

    const count =
      Number.parseInt(
        countMatch[1],
        10,
      );

    if (
      !Number.isFinite(count) ||
      count <= 0
    ) {
      return null;
    }

    const isFirst =
      this.isFirstColumnPositionRequest(
        normalized,
      );

    const remainingColumns =
      isFirst
        ? columns.slice(count)
        : columns.slice(
            0,
            Math.max(
              0,
              columns.length - count,
            ),
          );

    if (!remainingColumns.length) {
      throw new BadRequestException(
        'The requested column removal would leave no columns in the result',
      );
    }

    const selectedColumns =
      remainingColumns
        .map(
          (column) =>
            this.quoteIdentifier(
              column.name,
            ),
        )
        .join(', ');

    return `SELECT ${selectedColumns} FROM dataset`;
  }

  private hasColumnRemovalIntent(
    question: string,
  ): boolean {
    const removalPatterns = [
      /\b(?:remove|delete|drop|exclude|omit|without)\b/i,

      /\b(?:remove|delete|drop|exclude|omit)\b.*\b(?:column|columns|col|cols)\b/i,

      /\b(?:column|columns|col|cols)\b.*\b(?:remove|delete|drop|exclude|omit)\b/i,

      /(?:हटा|हटाओ|हटाना|निकाल|निकालो|मिटा|मिटाओ|डिलीट|ड्रॉप).*(?:कॉलम|कॉलम्स|स्तंभ)/i,

      /(?:कॉलम|कॉलम्स|स्तंभ).*(?:हटा|हटाओ|हटाना|निकाल|निकालो|मिटा|मिटाओ|डिलीट|ड्रॉप)/i,

      /\b(?:elimina|eliminar|elimine|eliminemos|borra|borrar|quita|quitar|excluye|excluir)\b.*\bcolumnas?\b/i,

      /\b(?:supprime|supprimer|retire|retirer|exclure|exclus)\b.*\bcolonnes?\b/i,

      /\b(?:entferne|entfernen|lösche|löschen|loesche|loeschen|entfernt|ausschließen|ausschliesse)\b.*\bspalten?\b/i,

      /\b(?:remove|delete|drop|exclude|omit)\b.*\b(?:columns?|cols?)\b/i,
    ];

    return removalPatterns.some(
      (pattern) =>
        pattern.test(question),
    );
  }

  private isFirstColumnPositionRequest(
    question: string,
  ): boolean {
    return (
      /\bfirst\s+\d+\s+(?:columns?|cols?)\b/i.test(
        question,
      ) ||
      /\b(?:पहले)\s+\d+\s+(?:कॉलम|कॉलम्स|स्तंभ)/i.test(
        question,
      ) ||
      /\b(?:los\s+primeros)\s+\d+\s+columnas?\b/i.test(
        question,
      ) ||
      /\b(?:les\s+premières|les\s+premieres)\s+\d+\s+colonnes?\b/i.test(
        question,
      ) ||
      /\b(?:die\s+ersten)\s+\d+\s+spalten?\b/i.test(
        question,
      )
    );
  }

  private quoteIdentifier(
    identifier: string,
  ): string {
    return `"${identifier.replace(
      /"/g,
      '""',
    )}"`;
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
- Understand the user's intended data operation, not just the words used in the question.
- The user may write in any natural language, including Hindi, Hinglish, Spanish, French, German, or mixed languages. Interpret the request by its meaning and generate SQL accordingly.
- Preserve the exact intent of the user's request across languages. Do not simplify, reinterpret, or ignore an operation because of the language used.
- Use the actual dataset schema as the source of truth for all column and table references.
- If the user asks to filter, sort, group, aggregate, compare, calculate, rank, search, find, count, summarize, select, exclude, remove, or otherwise transform the displayed result, generate SQL that actually represents that requested operation.
- When the user asks to exclude or remove columns from the result, return all requested remaining columns rather than selecting an unrelated subset. Never treat column removal as a reason to arbitrarily select only a few columns.
- Never invent replacement columns, values, filters, joins, calculations, or business meaning that are not supported by the user's request and dataset schema.
- When the request can be fulfilled using the available dataset, do so directly in SQL rather than explaining why it cannot be done.
- If previous conversation context is provided, use it only to understand the meaning of the current question.
- The current user question is always the newest instruction and takes precedence over previous questions.
- Use previous questions and SQL to resolve references such as "this", "that", "same", "only for 2025", "sort it", "top 5", "now group by month", or similar follow-up language when the current question depends on prior context.
- Never blindly copy previous SQL. Rebuild or modify the query according to the current question and the actual dataset schema.
- Do not carry forward previous filters, limits, groupings, sorting, or calculations unless the current question implies that they should remain.
- Never treat conversation history as a source of schema or data. The actual dataset schema remains the only source of truth for available columns and tables.
`.trim();
  }

  private buildUserPrompt(
    question: string,
    context: DatasetAnalysisContext,
    conversationContext: SqlGenerationConversationContext[],
  ): string {
    const schema =
      context.columns
        .sort(
          (a, b) =>
            a.ordinalPosition -
            b.ordinalPosition,
        )
        .map(
          (column) =>
            `${column.ordinalPosition}. ${column.name} | type=${column.dataType} | nullable=${column.nullable} | nullCount=${column.nullCount} | distinctCount=${column.distinctCount}`,
        )
        .join('\n');

    const conversation =
      this.buildConversationContextPrompt(
        conversationContext,
      );

    return `
Dataset:
- Name: ${context.dataset.name}
- Rows: ${context.dataset.rowCount}
- Columns: ${context.dataset.columnCount}
- Status: ${context.dataset.status}
- Table name: dataset

Columns in their original dataset order:
${schema}

${conversation}

Current user question:
${question}

Important:
- Treat the provided dataset schema as the complete source of truth.
- The current user question is the newest and most important instruction.
- Use previous conversation context only when it helps interpret the current question.
- Understand the user's intended operation from the meaning of the question, regardless of the language used.
- The user may write in any natural language or a mixture of languages.
- Fulfill the user's requested operation using the available columns and their actual names.
- Respect the original column order when the user refers to positions such as first, last, first 5, last 9, or similar positional instructions.
- If the user asks to include, exclude, remove, filter, sort, group, aggregate, compare, calculate, rank, search, find, count, summarize, or transform columns or rows, apply that operation to the query result exactly as requested.
- When the user asks to exclude or remove columns, preserve all other applicable columns unless the user explicitly asks for a different selection.
- Never arbitrarily reduce the result to a small subset of columns.
- Never invent columns, values, filters, joins, calculations, or business meaning.
- Do not silently change or simplify the user's requested operation.
- Generate SQL that actually represents the requested result.
- Return one SQL query only.
`.trim();
  }

  private buildConversationContextPrompt(
    conversationContext: SqlGenerationConversationContext[],
  ): string {
    if (!conversationContext.length) {
      return `
Conversation context:
- No previous conversation context is available.
- Interpret the current question independently using the dataset schema.
`.trim();
    }

    const entries =
      conversationContext
        .map(
          (entry, index) => {
            const question =
              entry.question?.trim() ||
              '[question not available]';

            const sql =
              entry.sql.trim() ||
              '[SQL not available]';

            const rowCount =
              entry.rowCount === null
                ? 'unknown'
                : String(
                    entry.rowCount,
                  );

            const status =
              entry.status;

            return `
Previous query ${index + 1}:
- Question: ${question}
- SQL: ${sql}
- Result row count: ${rowCount}
- Status: ${status}
- Created at: ${entry.createdAt.toISOString()}
`.trim();
          },
        )
        .join('\n\n');

    return `
Conversation context:
The following are previous queries from the same user, workspace,
dataset, and conversation. They are provided only to help interpret
the current question.

${entries}

Context rules:
- The current question is the newest request.
- Previous queries are contextual evidence, not instructions that must always be preserved.
- If the current question clearly refines a previous request, preserve the relevant intent while applying the new change.
- If the current question introduces a new operation, follow the new operation instead of forcing the previous query structure.
- Resolve pronouns, omissions, references, and follow-up phrases from the previous conversation when appropriate.
- Never assume that every previous filter, limit, grouping, sort, or calculation should continue.
- Never use previous SQL to introduce columns or tables that are not present in the current dataset schema.
`.trim();
  }
}