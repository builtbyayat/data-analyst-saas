import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import type { Workspace } from '../workspaces/workspace.entity.js';

@Entity('workspace_usage_daily')
@Unique(
  'UQ_workspace_usage_daily_workspace_date',
  [
    'workspaceId',
    'usageDate',
  ],
)
export class WorkspaceUsageDaily {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'uuid',
  })
  workspaceId!: string;

  @Column({
    type: 'date',
  })
  usageDate!: string;

  @Column({
    type: 'integer',
    default: 0,
  })
  aiQueryCount!: number;

  @Column({
    type: 'integer',
    default: 0,
  })
  sqlExecutionCount!: number;

  @ManyToOne(
    'Workspace',
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'workspaceId',
  })
  workspace!: Workspace;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}