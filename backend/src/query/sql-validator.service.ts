import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class SqlValidatorService {
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
      normalizedSql.length > 50_000
    ) {
      throw new BadRequestException(
        'SQL query is too long',
      );
    }

    const withoutLeadingComments =
      normalizedSql.replace(
        /^(?:\s|--[^\r\n]*(?:\r?\n|$)|\/\*[\s\S]*?\*\/)*/,
        '',
      );

    const firstKeyword =
      withoutLeadingComments
        .split(/\s+/)[0]
        ?.toUpperCase();

    if (
      firstKeyword !== 'SELECT' &&
      firstKeyword !== 'WITH'
    ) {
      throw new BadRequestException(
        'Only SELECT and WITH queries are allowed',
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

    const upperSql =
      normalizedSql.toUpperCase();

    for (const keyword of this.blockedKeywords) {
      const pattern =
        new RegExp(
          `\\b${keyword}\\b`,
          'i',
        );

      if (pattern.test(upperSql)) {
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

    return normalizedSql;
  }
}