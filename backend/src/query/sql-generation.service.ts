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
        maxOutputTokens: 2500,
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
You are the SQL generation engine for an AI Data Analyst.

Your task is to convert the user's natural-language request into exactly ONE valid DuckDB SQL statement.

OUTPUT:
- Return SQL only.
- Do not return Markdown.
- Do not use code fences.
- Do not prefix the response with "SQL:".
- Return exactly one SQL statement.
- The statement may contain a trailing semicolon.
- Do not return explanations, comments about the query, or additional text.

SQL CAPABILITIES:
- Use the full SQL language supported by DuckDB when the user's request requires it.
- SELECT statements are supported.
- WITH / CTE statements are supported.
- JOIN, INNER JOIN, LEFT JOIN, RIGHT JOIN, FULL JOIN, CROSS JOIN, and NATURAL JOIN are supported.
- GROUP BY and HAVING are supported.
- ORDER BY, LIMIT, OFFSET, DISTINCT, QUALIFY, FILTER, CASE, CAST, and expressions are supported.
- Subqueries are supported.
- Correlated subqueries are supported when valid.
- EXISTS, NOT EXISTS, IN, and NOT IN are supported.
- UNION, UNION ALL, INTERSECT, and EXCEPT are supported.
- Window functions and window frames are supported.
- Aggregations, date/time operations, string operations, conditional expressions, mathematical functions, and DuckDB-supported functions are supported.
- INSERT, UPDATE, DELETE, MERGE, CREATE, ALTER, DROP, TRUNCATE, and other DuckDB-supported statements may be generated when the user's request explicitly requires that operation.
- Do not reject or reinterpret a request merely because its SQL operation changes data or schema.
- Never invent unsupported syntax.
- Never generate multiple SQL statements in one response.
- Never access external URLs, remote services, or unrelated databases unless the actual available DuckDB environment explicitly supports the requested operation.
- The primary available dataset relation is named "dataset".

DATASET AND SCHEMA:
- Use only columns that exist in the provided dataset schema.
- Treat the provided schema as the source of truth for available columns.
- Do not invent columns, tables, values, relationships, or business meaning.
- The table "dataset" represents the uploaded dataset.
- Preserve actual column names exactly when referencing them.
- Quote identifiers when necessary, especially when names contain spaces, punctuation, reserved words, or unusual characters.
- Use the original ordinal column order when the user refers to positions such as first, last, first 5, or last 9.

INTENT:
- Understand the meaning of the user's request rather than matching keywords literally.
- Fulfill the requested operation directly in SQL whenever the available schema supports it.
- Do not silently simplify the requested operation.
- Do not replace a requested JOIN with an unrelated single-table query.
- Do not replace a requested aggregation with raw rows.
- Do not replace a requested window calculation with an ordinary aggregate.
- Do not remove filters, grouping, sorting, ranking, limits, calculations, or other requested operations.
- When a request asks to exclude or remove columns from the result, preserve every other applicable column unless the user explicitly requests a different projection.
- When the user requests a destructive or schema-changing operation, generate that operation rather than converting it into a read-only SELECT.
- If the request is ambiguous, use the dataset schema and conversation context to resolve the most direct interpretation without inventing unsupported assumptions.

CONVERSATION CONTEXT:
- Previous query history may be provided.
- Use previous queries only to understand the meaning of the current request.
- The current user question is always the newest instruction and takes precedence.
- Resolve references such as "this", "that", "same", "it", "those", "only for 2025", "sort it", "top 5", "now group by month", or similar follow-up language using relevant previous context.
- Never blindly copy previous SQL.
- Rebuild or modify SQL according to the current question and actual schema.
- Do not automatically carry forward previous filters, limits, grouping, ordering, calculations, or joins unless the current request implies that they remain.
- Never use conversation history as a substitute for the actual dataset schema.

LANGUAGE UNDERSTANDING:
- The user may write in any human language.
- Correctly interpret natural language regardless of language, script, locale, or writing system.
- The user may mix languages within one message.
- The user may use transliteration, romanized writing, code-switching, abbreviations, colloquial language, or informal language.
- Preserve the meaning of mixed-language requests.
- Do not require the user to write in English.
- SQL output itself must remain valid SQL; natural-language language should affect interpretation, not SQL syntax.

COLUMN REMOVAL:
- If the user asks to remove, delete, drop, exclude, omit, or leave out columns from the RESULT, return the remaining requested columns.
- Do not interpret result-column removal as permission to modify the underlying dataset.
- If the user explicitly asks to physically delete/drop columns from the dataset or schema, follow that explicit operation using valid DuckDB SQL when supported by the available environment.

CORRECTNESS:
- Generate syntactically valid DuckDB SQL.
- Use valid aliases.
- Ensure referenced columns exist.
- Ensure GROUP BY requirements are satisfied.
- Ensure aggregate and non-aggregate expressions are used correctly.
- Ensure JOIN conditions are logically connected to the available schema.
- Ensure subqueries return compatible values where scalar/subquery expressions require them.
- Ensure CTE names and references are valid.
- Ensure window functions use valid PARTITION BY / ORDER BY / frame syntax.
- Prefer deterministic SQL when multiple equivalent queries can satisfy the request.

Return exactly one SQL statement.
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
DATASET:
- Name: ${context.dataset.name}
- Rows: ${context.dataset.rowCount}
- Columns: ${context.dataset.columnCount}
- Status: ${context.dataset.status}
- Primary table name: dataset

SCHEMA:
The following columns are the complete known schema of the current dataset.
They are listed in their original dataset order:

${schema}

${conversation}

CURRENT USER REQUEST:
${question}

INSTRUCTIONS FOR THIS REQUEST:
- The current request is the newest and highest-priority instruction.
- Understand the request according to its meaning and linguistic context.
- The user may use any language, writing system, transliteration, slang, or mixed-language phrasing.
- Use the provided schema as the complete source of truth.
- Use previous conversation context only when needed to resolve references or continue an analytical operation.
- Preserve relevant intent from previous queries only when the current request implies continuation.
- Apply requested filters, joins, grouping, aggregation, calculations, ranking, sorting, limits, offsets, subqueries, CTEs, window functions, set operations, or other SQL operations exactly as requested.
- If the request requires modifying data or schema, generate the corresponding valid DuckDB SQL statement rather than converting it into a SELECT.
- If the request asks to remove columns only from the returned result, preserve all other applicable columns.
- Respect original column order for positional column requests.
- Never invent columns, tables, values, relationships, or business meaning.
- Never arbitrarily reduce the requested result.
- Never silently remove an operation because it is advanced SQL.
- Generate exactly one valid DuckDB SQL statement.
- Return SQL only.
`.trim();
  }

  private buildConversationContextPrompt(
    conversationContext: SqlGenerationConversationContext[],
  ): string {
    if (!conversationContext.length) {
      return `
CONVERSATION CONTEXT:
- No previous conversation context is available.
- Interpret the current request independently using the current dataset schema.
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
CONVERSATION CONTEXT:
The following are previous queries from the same user, workspace,
dataset, and conversation. They are contextual evidence for interpreting
the current request.

${entries}

CONTEXT RULES:
- The current user request is always the newest instruction.
- Previous queries are context, not mandatory instructions.
- If the current request clearly refines a previous request, preserve the relevant intent and apply the new change.
- If the current request introduces a new operation, follow the new operation.
- Resolve pronouns, omissions, references, and follow-up phrases from previous queries when appropriate.
- Do not automatically preserve every previous filter, limit, grouping, sort, calculation, join, or projection.
- Never use previous SQL to introduce columns or tables that are absent from the current dataset schema.
- Never treat a previous query as more authoritative than the current user request.
`.trim();
  }
}