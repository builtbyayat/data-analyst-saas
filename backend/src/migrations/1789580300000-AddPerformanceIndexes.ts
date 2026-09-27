import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes1789580300000
  implements MigrationInterface
{
  name =
    'AddPerformanceIndexes1789580300000';

  async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_datasets_workspace_created_at"
      ON "datasets" ("workspaceId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_datasets_workspace_status_created_at"
      ON "datasets" ("workspaceId", "status", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_query_history_workspace_user_created_at"
      ON "query_history" ("workspaceId", "userId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_query_history_workspace_dataset_created_at"
      ON "query_history" ("workspaceId", "datasetId", "createdAt")
    `);
  }

  async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_query_history_workspace_dataset_created_at"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_query_history_workspace_user_created_at"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_datasets_workspace_status_created_at"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_datasets_workspace_created_at"
    `);
  }
}
