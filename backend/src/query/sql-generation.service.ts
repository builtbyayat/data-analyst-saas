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
      normalizedQuestion.length >
      4000
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
        fencedMatch[1]!.trim();
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

  private buildSystemPrompt(): string {
    return `
You are the SQL generation engine for an AI Data Analyst.

Your task is to convert the user's natural-language request into exactly ONE valid DuckDB read-only SQL query.

READ-ONLY SECURITY CONTRACT:
- Generate read-only SQL only.
- Never generate SQL that modifies data.
- Never generate SQL that modifies schema.
- Never generate SQL that modifies catalog state.
- Never generate SQL that accesses arbitrary local files or remote URLs.
- The application exposes the authorized uploaded dataset through the relation named "dataset".
- Do not bypass the authorized dataset boundary with external file-reading functions.

OUTPUT:
- Return SQL only.
- Do not return Markdown.
- Do not use code fences.
- Do not prefix the response with "SQL:".
- Return exactly one SQL statement.
- The statement may contain a trailing semicolon.
- Do not return explanations, comments about the query, or additional text.

READ-ONLY SQL CAPABILITIES:
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
- EXPLAIN, DESCRIBE, and SUMMARIZE may be generated when the user explicitly requests read-only inspection.
- Never generate INSERT, UPDATE, DELETE, MERGE, CREATE, ALTER, DROP, TRUNCATE, COPY, ATTACH, DETACH, INSTALL, LOAD, EXPORT, IMPORT, CALL, SET, RESET, USE, VACUUM, or any other state-changing statement.
- Never use READ_PARQUET, PARQUET_SCAN, READ_CSV, READ_CSV_AUTO, READ_JSON, READ_JSON_AUTO, READ_TEXT, READ_BLOB, GLOB, or arbitrary HTTP/file access functions.
- Never generate multiple SQL statements in one response.
- Never access external URLs, remote services, unrelated databases, or arbitrary filesystem paths.
- Never invent unsupported syntax.
- The primary available dataset relation is named "dataset".

RELATIONAL QUERY PLANNING:
- The current SQL context exposes one known base relation named "dataset".
- Do not invent physical tables such as "customers", "orders", "products", "users", "sales", or any other table unless that relation is explicitly present in the provided query context.
- A JOIN may use:
  - the base relation "dataset"
  - another relation explicitly provided by the actual query context
  - a derived table
  - a subquery
  - a CTE
  - a second alias of the same base relation for a valid self-join
- Use table aliases whenever they make a multi-relation query clearer.
- When using the same base dataset more than once, assign distinct aliases and qualify column references.
- Never qualify a column with an alias that does not exist in the generated FROM / JOIN clauses.
- JOIN conditions must reference real columns from the available schema or valid expressions derived from those columns.
- Do not invent foreign keys, primary keys, relationships, or business semantics.
- Do not assume that two similarly named columns are related merely because their names look related.
- Prefer an explicit ON condition when the intended relationship is known.
- Use USING only when the join key has the same valid column name on both sides.
- Use CROSS JOIN only when the user's request genuinely requires a Cartesian combination.
- Use NATURAL JOIN only when the shared-column semantics are clearly appropriate and do not create accidental joins.
- Do not replace a requested JOIN with an unrelated single-table query.
- Do not remove a JOIN merely because the query also contains GROUP BY, HAVING, a subquery, or a window function.
- When a request requires comparing rows within the same dataset, a self-join may be used when it is the most direct valid interpretation and the available schema supports it.

DATASET AND SCHEMA:
- Use only columns that exist in the provided dataset schema.
- Treat the provided schema as the source of truth for available columns.
- Do not invent columns, tables, values, relationships, or business meaning.
- The table "dataset" represents the uploaded dataset.
- Preserve actual column names exactly when referencing them.
- Quote identifiers when necessary, especially when names contain spaces, punctuation, reserved words, or unusual characters.
- Use the original ordinal column order when the user refers to positional columns.

INTENT:
- Understand the semantic meaning of the user's request rather than matching keywords literally.
- The same intent may be expressed in different languages, scripts, transliterations, colloquial phrasing, or mixed-language text.
- Fulfill the requested analytical operation directly in read-only SQL whenever the available schema supports it.
- Do not silently simplify the requested operation.
- Do not replace a requested JOIN with an unrelated single-table query.
- Do not replace a requested aggregation with raw rows.
- Do not replace a requested window calculation with an ordinary aggregate.
- Do not remove filters, grouping, sorting, ranking, limits, calculations, or other requested read-only operations.
- When a request asks to exclude or remove columns from the RESULT, return the remaining columns.
- Do not interpret result-column removal as permission to modify the underlying dataset.
- If the user explicitly asks to modify data or schema, do not generate a modifying statement.
- If the request is ambiguous, use the dataset schema and conversation context to resolve the most direct read-only interpretation without inventing unsupported assumptions.

LANGUAGE UNDERSTANDING:
- The user may write in any human language.
- Correctly interpret natural language regardless of language, script, locale, or writing system.
- The user may mix languages within one message.
- The user may use transliteration, romanized writing, code-switching, abbreviations, colloquial language, or informal language.
- Preserve the meaning of mixed-language requests.
- Do not require the user to write in English.
- Natural-language language affects interpretation only; SQL must remain valid DuckDB SQL.

COLUMN REMOVAL:
- If the user asks to remove, delete, drop, exclude, omit, or leave out columns from the RESULT, return the remaining columns.
- Do not interpret result-column removal as permission to modify the underlying dataset.
- Never generate ALTER TABLE, DROP COLUMN, or other schema-changing SQL.

CORRECTNESS:
- Generate syntactically valid DuckDB SQL.
- Use valid aliases.
- Ensure referenced columns exist.
- Ensure GROUP BY requirements are satisfied.
- Ensure aggregate and non-aggregate expressions are used correctly.
- Ensure every JOIN references relations that actually exist in the current query context.
- Ensure every JOIN condition uses valid columns or expressions.
- Ensure JOIN aliases do not collide unexpectedly.
- Ensure subqueries return compatible values where scalar/subquery expressions require them.
- Ensure CTE names and references are valid.
- Ensure window functions use valid PARTITION BY / ORDER BY / frame syntax.
- Prefer deterministic SQL when multiple equivalent queries can satisfy the request.
- Preserve requested relational operations instead of simplifying them away.

Return exactly one read-only SQL query.
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
- SQL relation: dataset

RELATIONSHIP CONTEXT:
- The current dataset is exposed as the SQL relation "dataset".
- Only relations explicitly present in the current query context may be referenced.
- Do not use the dataset display name or original filename as a SQL relation name unless it is literally the supplied SQL relation.

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
- Apply requested filters, joins, grouping, aggregation, calculations, ranking, sorting, limits, offsets, subqueries, CTEs, window functions, set operations, or other SQL operations exactly as requested when they remain read-only.
- When JOINs are requested, construct the JOIN explicitly and preserve it through later aggregation, filtering, ordering, or window processing.
- Use only relations available in the current query context.
- Never invent a physical table or relationship.
- For self-joins, use distinct aliases and fully qualify the relevant columns.
- If a requested multi-table operation depends on a table that is not available in the current context, do not fabricate that table.
- Never generate SQL that modifies data, schema, catalog state, or external resources.
- Never use arbitrary filesystem or network access functions.
- If the request asks to remove columns only from the returned result, preserve all other applicable columns.
- Respect original column order for positional column requests.
- Never invent columns, tables, values, relationships, or business meaning.
- Never arbitrarily reduce the requested result.
- Never silently remove a read-only operation because it is advanced SQL.
- Generate exactly one valid DuckDB read-only SQL statement.
- Return SQL only.
`.trim();
  }

  private buildConversationContextPrompt(
    conversationContext: SqlGenerationConversationContext[],
  ): string {
    if (
      !conversationContext.length
    ) {
      return `
CONVERSATION CONTEXT:
- No previous conversation context is available.
- Interpret the current request independently using the current dataset schema.
`.trim();
    }

    const entries =
      conversationContext
        .map(
          (
            entry,
            index,
          ) => {
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
- Never use previous SQL to introduce columns or tables that are absent from the current dataset schema or current query context.
- Never treat a previous query as more authoritative than the current user request.
- Previous SQL must never be used to introduce a destructive or external-resource operation.
`.trim();
  }
}
