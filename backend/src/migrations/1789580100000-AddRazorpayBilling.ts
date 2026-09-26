import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddRazorpayBilling1789580100000
  implements MigrationInterface
{
  name =
    'AddRazorpayBilling1789580100000';

  async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name:
          'workspace_subscriptions',

        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy:
              'uuid',
          },

          {
            name: 'workspaceId',
            type: 'uuid',
            isUnique: true,
          },

          {
            name: 'provider',
            type: 'varchar',
            length: '30',
            default: "'razorpay'",
          },

          {
            name:
              'providerCustomerId',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },

          {
            name:
              'providerSubscriptionId',
            type: 'varchar',
            length: '100',
            isNullable: true,
            isUnique: true,
          },

          {
            name:
              'providerPlanId',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },

          {
            name: 'planCode',
            type: 'varchar',
            length: '50',
            default: "'pro'",
          },

          {
            name: 'status',
            type: 'varchar',
            length: '30',
            default: "'created'",
          },

          {
            name: 'shortUrl',
            type: 'text',
            isNullable: true,
          },

          {
            name: 'currentStart',
            type: 'timestamptz',
            isNullable: true,
          },

          {
            name: 'currentEnd',
            type: 'timestamptz',
            isNullable: true,
          },

          {
            name:
              'cancelAtPeriodEnd',
            type: 'boolean',
            default: false,
          },

          {
            name:
              'lastPaymentAt',
            type: 'timestamptz',
            isNullable: true,
          },

          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
          },

          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'workspace_subscriptions',
      new TableForeignKey({
        name:
          'FK_workspace_subscriptions_workspace',

        columnNames: [
          'workspaceId',
        ],

        referencedTableName:
        'workspaces',

        referencedColumnNames: [
          'id',
        ],

        onDelete:
          'CASCADE',

        onUpdate:
          'NO ACTION',
      }),
    );

    await queryRunner.createIndex(
      'workspace_subscriptions',
      new TableIndex({
        name:
          'IDX_workspace_subscriptions_workspace',

        columnNames: [
          'workspaceId',
        ],

        isUnique: true,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name:
          'billing_webhook_events',

        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy:
              'uuid',
          },

          {
            name: 'provider',
            type: 'varchar',
            length: '30',
          },

          {
            name: 'eventId',
            type: 'varchar',
            length: '255',
          },

          {
            name: 'eventType',
            type: 'varchar',
            length: '100',
          },

          {
            name: 'processedAt',
            type: 'timestamptz',
            isNullable: true,
          },

          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'billing_webhook_events',
      new TableIndex({
        name:
          'UQ_billing_webhook_events_provider_event',

        columnNames: [
          'provider',
          'eventId',
        ],

        isUnique: true,
      }),
    );
  }

  async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.dropTable(
      'billing_webhook_events',
      true,
    );

    await queryRunner.dropTable(
      'workspace_subscriptions',
      true,
    );
  }
}