import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { Workspace } from '../workspaces/workspace.entity.js';
import { DatasetColumn } from './dataset-column.entity.js';

@Entity('datasets')
export class Dataset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  workspaceId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  originalFilename!: string;

  @Column({ type: 'varchar' })
  objectKey!: string;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  queryObjectKey!: string | null;

  @Column({ type: 'varchar' })
  fileType!: string;

  @Column({ type: 'bigint' })
  fileSize!: string;

  @Column({ type: 'integer', default: 0 })
  rowCount!: number;

  @Column({ type: 'integer', default: 0 })
  columnCount!: number;

  @Column({ type: 'varchar', default: 'pending' })
  status!: 'pending' | 'processing' | 'ready' | 'failed';

  @OneToMany(
    () => DatasetColumn,
    (column) => column.dataset,
  )
  columns!: DatasetColumn[];

  @ManyToOne('Workspace', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}