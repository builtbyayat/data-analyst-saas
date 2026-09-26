import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

export class WidenPlanStorageColumns1789579650000
  implements MigrationInterface
{
  name =
    'WidenPlanStorageColumns1789579650000';

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "plans"
      ALTER COLUMN "storageLimitBytes"
      TYPE bigint
      USING "storageLimitBytes"::bigint
    `);

    await queryRunner.query(`
      ALTER TABLE "plans"
      ALTER COLUMN "maxFileSizeBytes"
      TYPE bigint
      USING "maxFileSizeBytes"::bigint
    `);
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "plans"
      ALTER COLUMN "maxFileSizeBytes"
      TYPE integer
      USING "maxFileSizeBytes"::integer
    `);

    await queryRunner.query(`
      ALTER TABLE "plans"
      ALTER COLUMN "storageLimitBytes"
      TYPE integer
      USING "storageLimitBytes"::integer
    `);
  }
}