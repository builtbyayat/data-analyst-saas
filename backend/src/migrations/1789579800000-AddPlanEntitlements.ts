import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

export class AddPlanEntitlements1789579800000
  implements MigrationInterface
{
  name =
    'AddPlanEntitlements1789579800000';

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "plan_entitlements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),

        "planCode" character varying(50) NOT NULL,

        "featureCode" character varying(100) NOT NULL,

        "enabled" boolean NOT NULL DEFAULT false,

        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),

        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "PK_plan_entitlements_id"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_plan_entitlements_plan_feature"
          UNIQUE ("planCode", "featureCode")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_plan_entitlements_plan_code"
      ON "plan_entitlements" ("planCode")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_plan_entitlements_feature_code"
      ON "plan_entitlements" ("featureCode")
    `);

    await queryRunner.query(`
      ALTER TABLE "plan_entitlements"
      ADD CONSTRAINT "FK_plan_entitlements_plan"
      FOREIGN KEY ("planCode")
      REFERENCES "plans"("code")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      INSERT INTO "plan_entitlements"
        (
          "planCode",
          "featureCode",
          "enabled"
        )
      VALUES
        ('free', 'dataset.upload', true),
        ('free', 'dataset.profiling', true),
        ('free', 'query.ai.basic', true),
        ('free', 'query.sql', true),
        ('free', 'query.saved', true),
        ('free', 'analysis.saved', true),
        ('free', 'reports', true),
        ('free', 'history', true),
        ('free', 'results.export', true),
        ('free', 'visualization.basic', true),
        ('free', 'sql.advanced', false),
        ('free', 'analytics.python', false),
        ('free', 'analysis.multi_file', false),
        ('free', 'insights.ai', false),
        ('free', 'visualization.advanced', false),
        ('free', 'ai.priority', false)
    `);

    await queryRunner.query(`
      INSERT INTO "plan_entitlements"
        (
          "planCode",
          "featureCode",
          "enabled"
        )
      VALUES
        ('pro', 'dataset.upload', true),
        ('pro', 'dataset.profiling', true),
        ('pro', 'query.ai.basic', true),
        ('pro', 'query.sql', true),
        ('pro', 'query.saved', true),
        ('pro', 'analysis.saved', true),
        ('pro', 'reports', true),
        ('pro', 'history', true),
        ('pro', 'results.export', true),
        ('pro', 'visualization.basic', true),
        ('pro', 'sql.advanced', true),
        ('pro', 'analytics.python', true),
        ('pro', 'analysis.multi_file', true),
        ('pro', 'insights.ai', true),
        ('pro', 'visualization.advanced', true),
        ('pro', 'ai.priority', true)
    `);
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "plan_entitlements"
      DROP CONSTRAINT "FK_plan_entitlements_plan"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_plan_entitlements_feature_code"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_plan_entitlements_plan_code"
    `);

    await queryRunner.query(`
      DROP TABLE "plan_entitlements"
    `);
  }
}