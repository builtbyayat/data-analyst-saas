import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Dataset } from './dataset.entity.js';

@Entity('dataset_columns')
@Unique(['datasetId', 'ordinalPosition'])
export class DatasetColumn {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  datasetId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  dataType!: string;

  @Column({ type: 'integer' })
  ordinalPosition!: number;

  @Column({ type: 'boolean', default: false })
  nullable!: boolean;

  @Column({ type: 'integer', default: 0 })
  nullCount!: number;

  @Column({ type: 'integer', default: 0 })
  distinctCount!: number;

  @ManyToOne('Dataset', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'datasetId' })
  dataset!: Dataset;

  @CreateDateColumn()
  createdAt!: Date;
}