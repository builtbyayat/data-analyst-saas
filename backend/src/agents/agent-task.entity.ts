import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Workspace } from '../workspaces/workspace.entity.js';
import type { AgentSession } from './agent-session.entity.js';
import type { Relation } from 'typeorm';
import type { Relation } from 'typeorm';

@Entity('agent_tasks')
export class AgentTask {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  sessionId!: string;

  @ManyToOne('AgentSession', 'tasks', { onDelete: 'CASCADE' })
  session!: Relation<AgentSession>;

  @Column({ type: 'uuid' })
  workspaceId!: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  workspace!: Workspace;

  @Column({ type: 'varchar', length: 50 })
  assignedAgent!: string;

  @Column({ type: 'text' })
  prompt!: string;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status!: string;

  @Column({ type: 'uuid', array: true, default: '{}' })
  dependsOnTaskIds!: string[];

  @Column({ type: 'jsonb', default: {} })
  inputArtifacts!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: {} })
  outputArtifact!: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'int', nullable: true })
  executionTimeMs!: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

