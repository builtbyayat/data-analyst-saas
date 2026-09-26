import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

export class AddReports1789579500000
  implements MigrationInterface
{
  name =
    'AddReports1789579500000';

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "title" character varying(200) NOT NULL,
        "description" text,
        "savedAnalysisIds" uuid[] NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reports_id"
          PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_reports_workspace_user"
      ON "reports" ("workspaceId", "userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_reports_workspace_created_at"
      ON "reports" ("workspaceId", "createdAt")
    `);

    await queryRunner.query(`
      ALTER TABLE "reports"
      ADD CONSTRAINT "FK_reports_workspace"
      FOREIGN KEY ("workspaceId")
      REFERENCES "workspaces"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "reports"
      ADD CONSTRAINT "FK_reports_user"
      FOREIGN KEY ("userId")
      REFERENCES "users"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reports"
      DROP CONSTRAINT "FK_reports_user"
    `);

    await queryRunner.query(`
      ALTER TABLE "reports"
      DROP CONSTRAINT "FK_reports_workspace"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_reports_workspace_created_at"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_reports_workspace_user"
    `);

    await queryRunner.query(`
      DROP TABLE "reports"
    `);
  }
}