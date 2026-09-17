import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDatasetColumnRelation1789577760707 implements MigrationInterface {
    name = 'AddDatasetColumnRelation1789577760707'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dataset_columns" ADD CONSTRAINT "UQ_32d43b2093da2e84b3b6cfba830" UNIQUE ("datasetId", "ordinalPosition")`);
        await queryRunner.query(`ALTER TABLE "dataset_columns" ADD CONSTRAINT "FK_f44b0f747f144611e189140a5fb" FOREIGN KEY ("datasetId") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dataset_columns" DROP CONSTRAINT "FK_f44b0f747f144611e189140a5fb"`);
        await queryRunner.query(`ALTER TABLE "dataset_columns" DROP CONSTRAINT "UQ_32d43b2093da2e84b3b6cfba830"`);
    }

}
