import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSavedQueries1789579300000
  implements MigrationInterface
{
  name = 'AddSavedQueries1789579300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "saved_queries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "datasetId" uuid,
        "title" character varying(200) NOT NULL,
        "description" text,
        "question" text,
        "sql" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saved_queries_id"
          PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "saved_queries"
      ADD CONSTRAINT "FK_saved_queries_workspace"
      FOREIGN KEY ("workspaceId")
      REFERENCES "workspaces"("id")
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "saved_queries"
      ADD CONSTRAINT "FK_saved_queries_user"
      FOREIGN KEY ("userId")
      REFERENCES "users"("id")
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "saved_queries"
      ADD CONSTRAINT "FK_saved_queries_dataset"
      FOREIGN KEY ("datasetId")
      REFERENCES "datasets"("id")
      ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_saved_queries_workspace_user"
      ON "saved_queries" ("workspaceId", "userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_saved_queries_workspace_created_at"
      ON "saved_queries" ("workspaceId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_saved_queries_dataset"
      ON "saved_queries" ("datasetId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "IDX_saved_queries_dataset"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_saved_queries_workspace_created_at"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_saved_queries_workspace_user"
    `);

    await queryRunner.query(`
      ALTER TABLE "saved_queries"
      DROP CONSTRAINT "FK_saved_queries_dataset"
    `);

    await queryRunner.query(`
      ALTER TABLE "saved_queries"
      DROP CONSTRAINT "FK_saved_queries_user"
    `);

    await queryRunner.query(`
      ALTER TABLE "saved_queries"
      DROP CONSTRAINT "FK_saved_queries_workspace"
    `);

    await queryRunner.query(`
      DROP TABLE "saved_queries"
    `);
  }
}