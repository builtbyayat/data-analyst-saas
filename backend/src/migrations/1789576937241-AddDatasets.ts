import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDatasets1789576937241 implements MigrationInterface {
    name = 'AddDatasets1789576937241'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "datasets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "name" character varying NOT NULL, "originalFilename" character varying NOT NULL, "objectKey" character varying NOT NULL, "fileType" character varying NOT NULL, "fileSize" bigint NOT NULL, "rowCount" integer NOT NULL DEFAULT '0', "columnCount" integer NOT NULL DEFAULT '0', "status" character varying NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bf831e43c559a240303e23d038" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "datasets"`);
    }

}
