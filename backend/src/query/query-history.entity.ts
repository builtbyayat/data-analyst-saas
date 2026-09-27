import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { User } from '../users/user.entity.js';
import type { Workspace } from '../workspaces/workspace.entity.js';
import type { Dataset } from '../datasets/dataset.entity.js';

@Entity('query_history')
@Index(
  'IDX_query_history_workspace_user_created_at',
  ['workspaceId', 'userId', 'createdAt'],
)
@Index(
  'IDX_query_history_workspace_dataset_created_at',
  ['workspaceId', 'datasetId', 'createdAt'],
)
export class QueryHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  workspaceId!: string;

  @Column({ type: 'uuid' })
  datasetId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid', nullable: true })
  conversationId!: string | null;

  @Column({ type: 'text', nullable: true })
  question!: string | null;

  @Column({ type: 'text' })
  sql!: string;

  @Column({ type: 'integer', nullable: true })
  rowCount!: number | null;

  @Column({ type: 'integer', nullable: true })
  executionTimeMs!: number | null;

  @Column({ type: 'varchar', default: 'success' })
  status!: 'success' | 'failed';

  @Column({ type: 'varchar', nullable: true })
  failureType!: 'validation' | 'execution' | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @ManyToOne('Workspace', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;

  @ManyToOne('Dataset', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'datasetId' })
  dataset!: Dataset;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;
}