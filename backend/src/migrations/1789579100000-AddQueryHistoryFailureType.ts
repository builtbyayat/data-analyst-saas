import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

export class AddQueryHistoryFailureType1789579100000
  implements MigrationInterface
{
  name =
    'AddQueryHistoryFailureType1789579100000';

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "query_history"
      ADD COLUMN "failureType" character varying
    `);
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "query_history"
      DROP COLUMN "failureType"
    `);
  }
}