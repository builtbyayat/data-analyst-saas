import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

export class AddProPlan1789579700000
  implements MigrationInterface
{
  name =
    'AddProPlan1789579700000';

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "plans" (
        "code",
        "name",
        "description",
        "aiQueriesPerDay",
        "sqlExecutionsPerDay",
        "datasetLimit",
        "storageLimitBytes",
        "maxFileSizeBytes"
      )
      VALUES (
        'pro',
        'Pro',
        'Advanced AI-powered data analysis for serious and regular use.',
        100,
        10000,
        100,
        26843545600,
        1073741824
      )
    `);
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "plans"
      WHERE "code" = 'pro'
    `);
  }
}