import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { User } from '../users/user.entity.js';
import type { Workspace } from '../workspaces/workspace.entity.js';
import type { Dataset } from '../datasets/dataset.entity.js';

@Entity('saved_queries')
@Index('IDX_saved_queries_workspace_user', ['workspaceId', 'userId'])
@Index('IDX_saved_queries_workspace_created_at', [
  'workspaceId',
  'createdAt',
])
@Index('IDX_saved_queries_dataset', ['datasetId'])
export class SavedQuery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  workspaceId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid', nullable: true })
  datasetId!: string | null;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  question!: string | null;

  @Column({ type: 'text' })
  sql!: string;

  @ManyToOne('Workspace', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne('Dataset', {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'datasetId' })
  dataset!: Dataset | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}