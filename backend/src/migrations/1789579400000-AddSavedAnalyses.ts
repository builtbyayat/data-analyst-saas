import type {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

export class AddSavedAnalyses1789579400000
  implements MigrationInterface
{
  name =
    'AddSavedAnalyses1789579400000';

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "saved_analyses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "datasetIds" uuid[] NOT NULL,
        "title" character varying(200) NOT NULL,
        "description" text,
        "question" text,
        "sql" text NOT NULL,
        "resultSnapshot" jsonb NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saved_analyses_id"
          PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "saved_analyses"
      ADD CONSTRAINT "FK_saved_analyses_workspace"
      FOREIGN KEY ("workspaceId")
      REFERENCES "workspaces"("id")
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "saved_analyses"
      ADD CONSTRAINT "FK_saved_analyses_user"
      FOREIGN KEY ("userId")
      REFERENCES "users"("id")
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_saved_analyses_workspace_user"
      ON "saved_analyses" ("workspaceId", "userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_saved_analyses_workspace_created_at"
      ON "saved_analyses" ("workspaceId", "createdAt")
    `);
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "IDX_saved_analyses_workspace_created_at"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_saved_analyses_workspace_user"
    `);

    await queryRunner.query(`
      ALTER TABLE "saved_analyses"
      DROP CONSTRAINT "FK_saved_analyses_user"
    `);

    await queryRunner.query(`
      ALTER TABLE "saved_analyses"
      DROP CONSTRAINT "FK_saved_analyses_workspace"
    `);

    await queryRunner.query(`
      DROP TABLE "saved_analyses"
    `);
  }
}