import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddQueryHistory1789579000000
  implements MigrationInterface
{
  async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'query_history',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'workspaceId',
            type: 'uuid',
          },
          {
            name: 'datasetId',
            type: 'uuid',
          },
          {
            name: 'userId',
            type: 'uuid',
          },
          {
            name: 'sql',
            type: 'text',
          },
          {
            name: 'rowCount',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'executionTimeMs',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            default: "'success'",
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    const workspaceForeignKey =
      new TableForeignKey({
        name: 'FK_query_history_workspace',
        columnNames: ['workspaceId'],
        referencedTableName: 'workspaces',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      });

    const datasetForeignKey =
      new TableForeignKey({
        name: 'FK_query_history_dataset',
        columnNames: ['datasetId'],
        referencedTableName: 'datasets',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      });

    const userForeignKey =
      new TableForeignKey({
        name: 'FK_query_history_user',
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      });

    await queryRunner.createForeignKey(
      'query_history',
      workspaceForeignKey,
    );

    await queryRunner.createForeignKey(
      'query_history',
      datasetForeignKey,
    );

    await queryRunner.createForeignKey(
      'query_history',
      userForeignKey,
    );

    await queryRunner.createIndex(
      'query_history',
      new TableIndex({
        name: 'IDX_query_history_workspace_createdAt',
        columnNames: [
          'workspaceId',
          'createdAt',
        ],
      }),
    );

    await queryRunner.createIndex(
      'query_history',
      new TableIndex({
        name: 'IDX_query_history_dataset_createdAt',
        columnNames: [
          'datasetId',
          'createdAt',
        ],
      }),
    );

    await queryRunner.createIndex(
      'query_history',
      new TableIndex({
        name: 'IDX_query_history_user_createdAt',
        columnNames: [
          'userId',
          'createdAt',
        ],
      }),
    );
  }

  async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.dropIndex(
      'query_history',
      'IDX_query_history_user_createdAt',
    );

    await queryRunner.dropIndex(
      'query_history',
      'IDX_query_history_dataset_createdAt',
    );

    await queryRunner.dropIndex(
      'query_history',
      'IDX_query_history_workspace_createdAt',
    );

    await queryRunner.dropForeignKey(
      'query_history',
      'FK_query_history_user',
    );

    await queryRunner.dropForeignKey(
      'query_history',
      'FK_query_history_dataset',
    );

    await queryRunner.dropForeignKey(
      'query_history',
      'FK_query_history_workspace',
    );

    await queryRunner.dropTable(
      'query_history',
    );
  }
}