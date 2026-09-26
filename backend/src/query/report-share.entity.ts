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
import type { Report } from './report.entity.js';

@Entity('report_share_links')
@Index('IDX_report_share_links_report', ['reportId'])
@Index('IDX_report_share_links_workspace', ['workspaceId'])
@Index('IDX_report_share_links_token_hash', ['tokenHash'], {
  unique: true,
})
export class ReportShareLink {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  reportId!: string;

  @Column({ type: 'uuid' })
  workspaceId!: string;

  @Column({ type: 'uuid' })
  createdByUserId!: string;

  @Column({ type: 'varchar', length: 20 })
  permission!: 'viewer' | 'exporter';

  @Column({ type: 'varchar', length: 64 })
  tokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @ManyToOne('Report', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reportId' })
  report!: Report;

  @ManyToOne('Workspace', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;

  @ManyToOne('User', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
