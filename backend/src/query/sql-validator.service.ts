import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class SqlValidatorService {
  private readonly maxSqlLength = 50_000;

  validate(sql: string): string {
    if (typeof sql !== 'string') {
      throw new BadRequestException(
        'SQL query must be a string',
      );
    }

    const normalizedSql =
      sql.trim();

    if (!normalizedSql) {
      throw new BadRequestException(
        'SQL query cannot be empty',
      );
    }

    if (
      normalizedSql.length >
      this.maxSqlLength
    ) {
      throw new BadRequestException(
        `SQL query cannot exceed ${this.maxSqlLength} characters`,
      );
    }

    /*
     * Keep SQL validation correctness-oriented.
     *
     * Do not reject valid SQL keywords or statement types such as:
     * DELETE, UPDATE, INSERT, DROP, ALTER, CREATE, TRUNCATE, MERGE,
     * CTEs, JOINs, UNIONs, subqueries, window functions, etc.
     *
     * This service performs lightweight structural validation only.
     * DuckDB remains the source of truth for SQL syntax and semantics.
     */

    this.validateStructure(
      normalizedSql,
    );

    if (
      this.hasMultipleStatements(
        normalizedSql,
      )
    ) {
      throw new BadRequestException(
        'Multiple SQL statements are not allowed',
      );
    }

    return normalizedSql;
  }

  private validateStructure(
    sql: string,
  ): void {
    let quote:
      | "'"
      | '"'
      | '`'
      | null = null;

    let escaped = false;
    let blockComment = false;
    let lineComment = false;

    const parentheses: number[] = [];

    for (
      let index = 0;
      index < sql.length;
      index += 1
    ) {
      const character =
        sql[index];

      const nextCharacter =
        sql[index + 1];

      if (lineComment) {
        if (
          character === '\n' ||
          character === '\r'
        ) {
          lineComment = false;
        }

        continue;
      }

      if (blockComment) {
        if (
          character === '*' &&
          nextCharacter === '/'
        ) {
          blockComment = false;
          index += 1;
        }

        continue;
      }

      if (quote !== null) {
        if (escaped) {
          escaped = false;
          continue;
        }

        if (
          character === '\\'
        ) {
          escaped = true;
          continue;
        }

        if (
          character === quote
        ) {
          /*
           * SQL escapes quotes by doubling them:
           *
           * 'John''s'
           * "some ""identifier"""
           * `some ``identifier```
           */
          if (
            nextCharacter ===
            quote
          ) {
            index += 1;
            continue;
          }

          quote = null;
        }

        continue;
      }

      if (
        character === '-' &&
        nextCharacter === '-'
      ) {
        lineComment = true;
        index += 1;
        continue;
      }

      if (
        character === '/' &&
        nextCharacter === '*'
      ) {
        blockComment = true;
        index += 1;
        continue;
      }

      if (
        character === "'" ||
        character === '"' ||
        character === '`'
      ) {
        quote = character;
        continue;
      }

      if (
        character === '('
      ) {
        parentheses.push(
          index,
        );
        continue;
      }

      if (
        character === ')'
      ) {
        if (
          parentheses.length ===
          0
        ) {
          throw new BadRequestException(
            `Unexpected closing parenthesis at character ${index + 1}`,
          );
        }

        parentheses.pop();
      }
    }

    if (blockComment) {
      throw new BadRequestException(
        'Unterminated block comment',
      );
    }

    if (quote !== null) {
      const quoteLabel =
        quote === "'"
          ? 'single'
          : quote === '"'
            ? 'double'
            : 'backtick';

      throw new BadRequestException(
        `Unterminated ${quoteLabel}-quoted string or identifier`,
      );
    }

    if (
      parentheses.length >
      0
    ) {
      const firstOpen =
        parentheses[0];

      throw new BadRequestException(
        `Unclosed parenthesis at character ${firstOpen + 1}`,
      );
    }
  }

  private hasMultipleStatements(
    sql: string,
  ): boolean {
    let quote:
      | "'"
      | '"'
      | '`'
      | null = null;

    let escaped = false;
    let blockComment = false;
    let lineComment = false;

    for (
      let index = 0;
      index < sql.length;
      index += 1
    ) {
      const character =
        sql[index];

      const nextCharacter =
        sql[index + 1];

      if (lineComment) {
        if (
          character === '\n' ||
          character === '\r'
        ) {
          lineComment = false;
        }

        continue;
      }

      if (blockComment) {
        if (
          character === '*' &&
          nextCharacter === '/'
        ) {
          blockComment = false;
          index += 1;
        }

        continue;
      }

      if (quote !== null) {
        if (escaped) {
          escaped = false;
          continue;
        }

        if (
          character === '\\'
        ) {
          escaped = true;
          continue;
        }

        if (
          character === quote
        ) {
          if (
            nextCharacter ===
            quote
          ) {
            index += 1;
            continue;
          }

          quote = null;
        }

        continue;
      }

      if (
        character === '-' &&
        nextCharacter === '-'
      ) {
        lineComment = true;
        index += 1;
        continue;
      }

      if (
        character === '/' &&
        nextCharacter === '*'
      ) {
        blockComment = true;
        index += 1;
        continue;
      }

      if (
        character === "'" ||
        character === '"' ||
        character === '`'
      ) {
        quote = character;
        continue;
      }

      if (
        character === ';'
      ) {
        const remaining =
          sql
            .slice(index + 1)
            .trim();

        /*
         * A trailing semicolon is valid.
         * Anything meaningful after it means
         * another SQL statement.
         */
        if (
          remaining.length > 0
        ) {
          return true;
        }
      }
    }

    return false;
  }
}