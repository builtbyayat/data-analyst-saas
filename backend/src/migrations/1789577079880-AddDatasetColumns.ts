import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDatasetColumns1789577079880 implements MigrationInterface {
    name = 'AddDatasetColumns1789577079880'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "dataset_columns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "datasetId" uuid NOT NULL, "name" character varying NOT NULL, "dataType" character varying NOT NULL, "ordinalPosition" integer NOT NULL, "nullable" boolean NOT NULL DEFAULT false, "nullCount" integer NOT NULL DEFAULT '0', "distinctCount" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d7be492a5de7d5adc98729f7972" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "dataset_columns"`);
    }

}
