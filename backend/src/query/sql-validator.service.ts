import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class SqlValidatorService {
  private readonly maxSqlLength = 50_000;

  /*
   * Query execution is intentionally read-only.
   *
   * These statement types can modify:
   * - data
   * - schema
   * - catalog state
   * - external connections/files
   *
   * They must never reach the execution layer.
   */
  private readonly blockedStatementKeywords =
    new Set([
      'INSERT',
      'UPDATE',
      'DELETE',
      'MERGE',
      'CREATE',
      'ALTER',
      'DROP',
      'TRUNCATE',
      'COPY',
      'ATTACH',
      'DETACH',
      'INSTALL',
      'LOAD',
      'EXPORT',
      'IMPORT',
      'CALL',
      'SET',
      'RESET',
      'USE',
      'VACUUM',
    ]);

  /*
   * External file/network table functions are deliberately blocked.
   *
   * The application already exposes the authorized uploaded dataset
   * through the `dataset` relation. User SQL must not bypass that boundary
   * by opening an arbitrary local/remote file.
   */
  private readonly blockedFunctions =
    new Set([
      'READ_PARQUET',
      'PARQUET_SCAN',
      'READ_CSV',
      'READ_CSV_AUTO',
      'READ_JSON',
      'READ_JSON_AUTO',
      'READ_TEXT',
      'READ_BLOB',
      'GLOB',
      'HTTP_GET',
      'HTTP_HEAD',
      'HTTP_POST',
      'HTTP_DELETE',
      'HTTP_PATCH',
      'HTTP_PUT',
      'LOAD_EXTENSION',
    ]);

  validate(sql: string): string {
    if (typeof sql !== 'string') {
      throw new BadRequestException(
        'SQL query must be a string',
      );
    }

    const normalizedSql = sql.trim();

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

    this.validateReadOnlyStatement(
      normalizedSql,
    );

    this.validateBlockedFunctions(
      normalizedSql,
    );

    return normalizedSql;
  }

  private validateReadOnlyStatement(
    sql: string,
  ): void {
    const firstKeyword =
      this.getFirstKeyword(sql);

    /*
     * Allowed read-only statement families.
     *
     * SELECT:
     * - ordinary queries
     * - aggregations
     * - JOINs
     * - subqueries
     * - set operations
     * - window functions
     *
     * WITH:
     * - CTE based read-only queries
     *
     * VALUES:
     * - read-only literal relations
     *
     * EXPLAIN / DESCRIBE / SUMMARIZE:
     * - read-only inspection/query-plan statements
     */
    const allowedStatementKeywords =
      new Set([
        'SELECT',
        'WITH',
        'VALUES',
        'EXPLAIN',
        'DESCRIBE',
        'SUMMARIZE',
      ]);

    if (
      this.blockedStatementKeywords.has(
        firstKeyword,
      )
    ) {
      throw new BadRequestException(
        `SQL statement is not allowed in read-only query mode: ${firstKeyword}`,
      );
    }

    if (
      !allowedStatementKeywords.has(
        firstKeyword,
      )
    ) {
      throw new BadRequestException(
        'Only read-only SQL queries are allowed',
      );
    }
  }

  private getFirstKeyword(
    sql: string,
  ): string {
    const length = sql.length;

    let index = 0;

    while (index < length) {
      while (
        index < length &&
        /\s/.test(
          sql[index]!,
        )
      ) {
        index += 1;
      }

      if (
        sql[index] === '-' &&
        sql[index + 1] === '-'
      ) {
        index += 2;

        while (
          index < length &&
          sql[index] !== '\n' &&
          sql[index] !== '\r'
        ) {
          index += 1;
        }

        continue;
      }

      if (
        sql[index] === '/' &&
        sql[index + 1] === '*'
      ) {
        const endIndex =
          sql.indexOf(
            '*/',
            index + 2,
          );

        if (endIndex === -1) {
          throw new BadRequestException(
            'Unterminated block comment',
          );
        }

        index =
          endIndex + 2;

        continue;
      }

      break;
    }

    const keywordMatch =
      sql
        .slice(index)
        .match(
          /^([A-Za-z_][A-Za-z0-9_$]*)\b/,
        );

    if (!keywordMatch) {
      throw new BadRequestException(
        'SQL query must begin with a valid SQL statement',
      );
    }

    return (
      keywordMatch[1]!
        .trim()
        .toUpperCase()
    );
  }

  private validateBlockedFunctions(
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

        if (character === '\\') {
          escaped = true;
          continue;
        }

        if (
          character === quote
        ) {
          if (
            nextCharacter === quote
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
        quote =
          character;

        continue;
      }

      if (
        !/[A-Za-z_]/.test(
          character ?? '',
        )
      ) {
        continue;
      }

      let endIndex =
        index + 1;

      while (
        endIndex < sql.length &&
        /[A-Za-z0-9_$]/.test(
          sql[endIndex]!,
        )
      ) {
        endIndex += 1;
      }

      const identifier =
        sql
          .slice(
            index,
            endIndex,
          )
          .toUpperCase();

      let openParenIndex =
        endIndex;

      while (
        openParenIndex <
          sql.length &&
        /\s/.test(
          sql[
            openParenIndex
          ]!,
        )
      ) {
        openParenIndex += 1;
      }

      if (
        sql[openParenIndex] ===
        '(' &&
        this.blockedFunctions.has(
          identifier,
        )
      ) {
        throw new BadRequestException(
          `SQL function is not allowed: ${identifier}`,
        );
      }

      index =
        endIndex - 1;
    }
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

        if (character === '\\') {
          escaped = true;
          continue;
        }

        if (
          character === quote
        ) {
          /*
           * SQL quote escaping:
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
        quote =
          character;

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
          parentheses.length === 0
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
      parentheses.length > 0
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

        if (character === '\\') {
          escaped = true;
          continue;
        }

        if (
          character === quote
        ) {
          if (
            nextCharacter === quote
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
        quote =
          character;

        continue;
      }

      if (
        character === ';'
      ) {
        /*
         * A semicolon is allowed when it is the final
         * SQL statement terminator.
         *
         * These are both valid:
         *
         * SELECT * FROM dataset;
         *
         * SELECT * FROM dataset; -- explanation
         *
         * SELECT * FROM dataset; /* explanation *\/
         *
         * But this is rejected:
         *
         * SELECT * FROM dataset;
         * SELECT * FROM another_dataset;
         */
        if (
          this.hasMeaningfulContentAfter(
            sql,
            index + 1,
          )
        ) {
          return true;
        }
      }
    }

    return false;
  }

  private hasMeaningfulContentAfter(
    sql: string,
    startIndex: number,
  ): boolean {
    let index =
      startIndex;

    while (
      index < sql.length
    ) {
      /*
       * Skip whitespace.
       */
      while (
        index < sql.length &&
        /\s/.test(
          sql[index]!,
        )
      ) {
        index += 1;
      }

      if (
        index >= sql.length
      ) {
        return false;
      }

      /*
       * Skip SQL line comments.
       *
       * -- comment
       */
      if (
        sql[index] === '-' &&
        sql[index + 1] === '-'
      ) {
        index += 2;

        while (
          index < sql.length &&
          sql[index] !== '\n' &&
          sql[index] !== '\r'
        ) {
          index += 1;
        }

        continue;
      }

      /*
       * Skip SQL block comments.
       *
       * /* comment *\/
       */
      if (
        sql[index] === '/' &&
        sql[index + 1] === '*'
      ) {
        const commentEnd =
          sql.indexOf(
            '*/',
            index + 2,
          );

        /*
         * An unterminated block comment will already
         * be caught by validateStructure().
         */
        if (
          commentEnd === -1
        ) {
          return false;
        }

        index =
          commentEnd + 2;

        continue;
      }

      /*
       * Anything else after the semicolon is meaningful
       * SQL content and therefore means another statement.
       */
      return true;
    }

    return false;
  }
}