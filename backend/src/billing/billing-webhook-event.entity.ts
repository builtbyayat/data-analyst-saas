import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('billing_webhook_events')
@Index(
  'UQ_billing_webhook_events_provider_event',
  ['provider', 'eventId'],
  { unique: true },
)
export class BillingWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'varchar',
    length: 30,
  })
  provider!: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  eventId!: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  eventType!: string;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  processedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}