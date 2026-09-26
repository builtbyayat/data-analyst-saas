import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

export class AddWorkspaceDailyUsage1789580000000
  implements MigrationInterface
{
  name =
    'AddWorkspaceDailyUsage1789580000000';

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "workspace_usage_daily" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),

        "workspaceId" uuid NOT NULL,

        "usageDate" date NOT NULL,

        "aiQueryCount" integer NOT NULL DEFAULT 0,

        "sqlExecutionCount" integer NOT NULL DEFAULT 0,

        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),

        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "PK_workspace_usage_daily_id"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_workspace_usage_daily_workspace_date"
          UNIQUE ("workspaceId", "usageDate"),

        CONSTRAINT "CHK_workspace_usage_daily_ai_non_negative"
          CHECK ("aiQueryCount" >= 0),

        CONSTRAINT "CHK_workspace_usage_daily_sql_non_negative"
          CHECK ("sqlExecutionCount" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_workspace_usage_daily_workspace"
      ON "workspace_usage_daily" ("workspaceId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_workspace_usage_daily_date"
      ON "workspace_usage_daily" ("usageDate")
    `);

    await queryRunner.query(`
      ALTER TABLE "workspace_usage_daily"
      ADD CONSTRAINT "FK_workspace_usage_daily_workspace"
      FOREIGN KEY ("workspaceId")
      REFERENCES "workspaces"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_usage_daily"
      DROP CONSTRAINT "FK_workspace_usage_daily_workspace"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_workspace_usage_daily_date"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_workspace_usage_daily_workspace"
    `);

    await queryRunner.query(`
      DROP TABLE "workspace_usage_daily"
    `);
  }
}