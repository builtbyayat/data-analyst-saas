import type { MigrationInterface, QueryRunner } from 'typeorm';
import {
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddQueryHistoryConversation1789579200000
  implements MigrationInterface
{
  name = 'AddQueryHistoryConversation1789579200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'query_history',
      new TableColumn({
        name: 'conversationId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'query_history',
      new TableColumn({
        name: 'question',
        type: 'text',
        isNullable: true,
      }),
    );

    await queryRunner.createIndex(
      'query_history',
      new TableIndex({
        name: 'IDX_query_history_conversation_createdAt',
        columnNames: [
          'conversationId',
          'createdAt',
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'query_history',
      'IDX_query_history_conversation_createdAt',
    );

    await queryRunner.dropColumn(
      'query_history',
      'question',
    );

    await queryRunner.dropColumn(
      'query_history',
      'conversationId',
    );
  }
}