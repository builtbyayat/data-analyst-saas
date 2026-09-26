import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('workspace_subscriptions')
@Index(
  'IDX_workspace_subscriptions_workspace',
  ['workspaceId'],
  { unique: true },
)
export class WorkspaceSubscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'uuid',
  })
  workspaceId!: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: 'razorpay',
  })
  provider!: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  providerCustomerId!: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
    nullable: true,
  })
  providerSubscriptionId!: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  providerPlanId!: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'pro',
  })
  planCode!: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: 'created',
  })
  status!: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  shortUrl!: string | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  currentStart!: Date | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  currentEnd!: Date | null;

  @Column({
    type: 'boolean',
    default: false,
  })
  cancelAtPeriodEnd!: boolean;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  lastPaymentAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}