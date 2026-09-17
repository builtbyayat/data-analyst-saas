import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDatasetWorkspaceRelation1789577520037 implements MigrationInterface {
    name = 'AddDatasetWorkspaceRelation1789577520037'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "datasets" ADD CONSTRAINT "FK_9933dca0cee1a0bbc92e0086b87" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "datasets" DROP CONSTRAINT "FK_9933dca0cee1a0bbc92e0086b87"`);
    }

}
