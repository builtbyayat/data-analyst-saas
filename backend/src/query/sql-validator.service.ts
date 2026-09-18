import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class SqlValidatorService {
  private readonly maxSqlLength = 50_000;

  private readonly maxJoins = 10;

  private readonly maxUnions = 10;

  private readonly maxSubqueries = 10;

  private readonly blockedKeywords = [
    'ATTACH',
    'CALL',
    'CHECKPOINT',
    'COPY',
    'CREATE',
    'DELETE',
    'DETACH',
    'DROP',
    'EXPORT',
    'IMPORT',
    'INSERT',
    'INSTALL',
    'LOAD',
    'PRAGMA',
    'REPLACE',
    'RESET',
    'SET',
    'TRUNCATE',
    'UPDATE',
    'VACUUM',
  ];

  private readonly blockedFunctions = [
    'READ_CSV',
    'READ_CSV_AUTO',
    'READ_JSON',
    'READ_JSON_AUTO',
    'READ_PARQUET',
    'PARQUET_SCAN',
    'GLOB',
    'HTTPFS',
    'SQLITE_SCAN',
    'POSTGRES_SCAN',
    'MYSQL_SCAN',
  ];

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

    if (
      normalizedSql.includes(';')
    ) {
      throw new BadRequestException(
        'Multiple SQL statements are not allowed',
      );
    }

    if (
      /--/.test(normalizedSql) ||
      /\/\*/.test(normalizedSql) ||
      /\*\//.test(normalizedSql)
    ) {
      throw new BadRequestException(
        'SQL comments are not allowed',
      );
    }

    const withoutLeadingWhitespace =
      normalizedSql.trimStart();

    const firstKeywordMatch =
      withoutLeadingWhitespace.match(
        /^([A-Za-z_][A-Za-z0-9_]*)/,
      );

    const firstKeyword =
      firstKeywordMatch?.[1]
        ?.toUpperCase();

    if (
      firstKeyword !== 'SELECT' &&
      firstKeyword !== 'WITH'
    ) {
      throw new BadRequestException(
        'Only SELECT and WITH queries are allowed',
      );
    }

    const upperSql =
      normalizedSql.toUpperCase();

    for (
      const keyword of
        this.blockedKeywords
    ) {
      const pattern =
        new RegExp(
          `\\b${keyword}\\b`,
          'i',
        );

      if (
        pattern.test(upperSql)
      ) {
        throw new BadRequestException(
          `SQL operation is not allowed: ${keyword}`,
        );
      }
    }

    for (
      const functionName of
        this.blockedFunctions
    ) {
      const pattern =
        new RegExp(
          `\\b${functionName}\\s*\\(`,
          'i',
        );

      if (
        pattern.test(upperSql)
      ) {
        throw new BadRequestException(
          `SQL function is not allowed: ${functionName}`,
        );
      }
    }

    const joinCount =
      this.countMatches(
        upperSql,
        /\b(?:INNER\s+|LEFT\s+|RIGHT\s+|FULL\s+|CROSS\s+)?JOIN\b/gi,
      );

    if (
      joinCount >
      this.maxJoins
    ) {
      throw new BadRequestException(
        `Query contains too many JOIN operations. Maximum allowed: ${this.maxJoins}`,
      );
    }

    const unionCount =
      this.countMatches(
        upperSql,
        /\bUNION(?:\s+ALL)?\b/gi,
      );

    if (
      unionCount >
      this.maxUnions
    ) {
      throw new BadRequestException(
        `Query contains too many UNION operations. Maximum allowed: ${this.maxUnions}`,
      );
    }

    const subqueryCount =
      this.countMatches(
        normalizedSql,
        /\(\s*(?:SELECT|WITH)\b/gi,
      );

    if (
      subqueryCount >
      this.maxSubqueries
    ) {
      throw new BadRequestException(
        `Query contains too many nested subqueries. Maximum allowed: ${this.maxSubqueries}`,
      );
    }

    return normalizedSql;
  }

  private countMatches(
    value: string,
    pattern: RegExp,
  ): number {
    return Array.from(
      value.matchAll(pattern),
    ).length;
  }
}