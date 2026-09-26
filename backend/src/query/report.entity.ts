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

@Entity('reports')
@Index(
  'IDX_reports_workspace_user',
  ['workspaceId', 'userId'],
)
@Index(
  'IDX_reports_workspace_created_at',
  ['workspaceId', 'createdAt'],
)
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'uuid',
  })
  workspaceId!: string;

  @Column({
    type: 'uuid',
  })
  userId!: string;

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
    type: 'uuid',
    array: true,
  })
  savedAnalysisIds!: string[];

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

  @ManyToOne(
    'User',
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'userId',
  })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}