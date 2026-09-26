import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

export class AddPlans1789579600000
  implements MigrationInterface
{
  name =
    'AddPlans1789579600000';

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "plans" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(50) NOT NULL,
        "name" character varying(100) NOT NULL,
        "description" text,
        "aiQueriesPerDay" integer NOT NULL,
        "sqlExecutionsPerDay" integer NOT NULL,
        "datasetLimit" integer NOT NULL,
        "storageLimitBytes" integer NOT NULL,
        "maxFileSizeBytes" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "PK_plans_id"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_plans_code"
          UNIQUE ("code"),

        CONSTRAINT "CHK_plans_ai_queries_positive"
          CHECK ("aiQueriesPerDay" > 0),

        CONSTRAINT "CHK_plans_sql_executions_positive"
          CHECK ("sqlExecutionsPerDay" > 0),

        CONSTRAINT "CHK_plans_dataset_limit_positive"
          CHECK ("datasetLimit" > 0),

        CONSTRAINT "CHK_plans_storage_limit_positive"
          CHECK ("storageLimitBytes" > 0),

        CONSTRAINT "CHK_plans_max_file_size_positive"
          CHECK ("maxFileSizeBytes" > 0)
      )
    `);

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
        'free',
        'Free',
        'Core AI data analysis for individual workspaces.',
        10,
        1000,
        15,
        1073741824,
        104857600
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "workspaces"
      ADD "planCode"
      character varying(50)
      NOT NULL
      DEFAULT 'free'
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_workspaces_plan_code"
      ON "workspaces" ("planCode")
    `);

    await queryRunner.query(`
      ALTER TABLE "workspaces"
      ADD CONSTRAINT "FK_workspaces_plan_code"
      FOREIGN KEY ("planCode")
      REFERENCES "plans"("code")
      ON DELETE RESTRICT
      ON UPDATE NO ACTION
    `);
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspaces"
      DROP CONSTRAINT "FK_workspaces_plan_code"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_workspaces_plan_code"
    `);

    await queryRunner.query(`
      ALTER TABLE "workspaces"
      DROP COLUMN "planCode"
    `);

    await queryRunner.query(`
      DROP TABLE "plans"
    `);
  }
}