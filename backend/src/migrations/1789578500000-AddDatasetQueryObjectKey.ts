import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
} from 'typeorm';

export class AddDatasetQueryObjectKey1789578500000
  implements MigrationInterface
{
  async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.addColumn(
      'datasets',
      new TableColumn({
        name: 'queryObjectKey',
        type: 'varchar',
        isNullable: true,
      }),
    );
  }

  async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.dropColumn(
      'datasets',
      'queryObjectKey',
    );
  }
}