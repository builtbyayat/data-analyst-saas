import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('plan_entitlements')
@Unique(
  'UQ_plan_entitlements_plan_feature',
  [
    'planCode',
    'featureCode',
  ],
)
export class PlanEntitlement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  planCode!: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  featureCode!: string;

  @Column({
    type: 'boolean',
    default: false,
  })
  enabled!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}