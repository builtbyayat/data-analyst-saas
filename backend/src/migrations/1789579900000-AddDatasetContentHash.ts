import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

export class AddDatasetContentHash1789579900000
  implements MigrationInterface
{
  name =
    'AddDatasetContentHash1789579900000';

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "datasets"
      ADD "contentHash"
      character varying(64)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX
      "IDX_datasets_workspace_content_hash"
      ON "datasets"
      ("workspaceId", "contentHash")
      WHERE "contentHash" IS NOT NULL
    `);
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      DROP INDEX
      "IDX_datasets_workspace_content_hash"
    `);

    await queryRunner.query(`
      ALTER TABLE "datasets"
      DROP COLUMN "contentHash"
    `);
  }
}