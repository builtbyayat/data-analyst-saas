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

@Entity('saved_analyses')
@Index('IDX_saved_analyses_workspace_user', [
  'workspaceId',
  'userId',
])
@Index('IDX_saved_analyses_workspace_created_at', [
  'workspaceId',
  'createdAt',
])
export class SavedAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  workspaceId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid', array: true })
  datasetIds!: string[];

  @Column({
    type: 'varchar',
    length: 200,
  })
  title!: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description!: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  question!: string | null;

  @Column({ type: 'text' })
  sql!: string;

  @Column({ type: 'jsonb' })
  resultSnapshot!: Record<string, unknown>;

  @ManyToOne('Workspace', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'workspaceId',
  })
  workspace!: Workspace;

  @ManyToOne('User', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
  })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}