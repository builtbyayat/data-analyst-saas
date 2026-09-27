import { BadRequestException } from '@nestjs/common';
import { SqlValidatorService } from './sql-validator.service.js';

describe('SqlValidatorService security hardening', () => {
  const service = new SqlValidatorService();

  it('blocks DuckDB environment access functions', () => {
    expect(() =>
      service.validate(
        "SELECT getenv('RAZORPAY_KEY_SECRET')",
      ),
    ).toThrowError(
      new BadRequestException(
        'SQL function is not allowed: GETENV',
      ),
    );
  });

  it('blocks catalog and metadata relations', () => {
    expect(() =>
      service.validate(
        'SELECT * FROM information_schema.tables',
      ),
    ).toThrow('SQL relation is not allowed: INFORMATION_SCHEMA');
  });

  it('blocks direct external file table references', () => {
    expect(() =>
      service.validate(
        "SELECT * FROM '/tmp/secret.parquet'",
      ),
    ).toThrow('External file table references are not allowed');
  });

  it('continues to allow the application dataset relation', () => {
    expect(
      service.validate(
        'SELECT * FROM dataset LIMIT 10',
      ),
    ).toBe('SELECT * FROM dataset LIMIT 10');
  });
});
