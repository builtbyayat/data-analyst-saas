import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

export class AddReportSharing1789580200000
  implements MigrationInterface
{
  name =
    'AddReportSharing1789580200000';

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "report_share_links" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reportId" uuid NOT NULL,
        "workspaceId" uuid NOT NULL,
        "createdByUserId" uuid NOT NULL,
        "permission" character varying(20) NOT NULL DEFAULT 'viewer',
        "tokenHash" character varying(64) NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "revokedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_share_links_id"
          PRIMARY KEY ("id"),
        CONSTRAINT "CHK_report_share_links_permission"
          CHECK ("permission" IN ('viewer', 'exporter')),
        CONSTRAINT "UQ_report_share_links_token_hash"
          UNIQUE ("tokenHash")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_report_share_links_report"
      ON "report_share_links" ("reportId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_report_share_links_workspace"
      ON "report_share_links" ("workspaceId")
    `);

    await queryRunner.query(`
      ALTER TABLE "report_share_links"
      ADD CONSTRAINT "FK_report_share_links_report"
      FOREIGN KEY ("reportId")
      REFERENCES "reports"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "report_share_links"
      ADD CONSTRAINT "FK_report_share_links_workspace"
      FOREIGN KEY ("workspaceId")
      REFERENCES "workspaces"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "report_share_links"
      ADD CONSTRAINT "FK_report_share_links_user"
      FOREIGN KEY ("createdByUserId")
      REFERENCES "users"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "report_share_links"
      DROP CONSTRAINT "FK_report_share_links_user"
    `);

    await queryRunner.query(`
      ALTER TABLE "report_share_links"
      DROP CONSTRAINT "FK_report_share_links_workspace"
    `);

    await queryRunner.query(`
      ALTER TABLE "report_share_links"
      DROP CONSTRAINT "FK_report_share_links_report"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_report_share_links_workspace"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_report_share_links_report"
    `);

    await queryRunner.query(`
      DROP TABLE "report_share_links"
    `);
  }
}
