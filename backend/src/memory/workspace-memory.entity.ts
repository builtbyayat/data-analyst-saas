import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Workspace } from '../workspaces/workspace.entity.js';

@Entity('workspace_memories')
export class WorkspaceMemory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  workspaceId!: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  workspace!: Workspace;

  @Column({ type: 'varchar', length: 50 })
  category!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  embedding!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
