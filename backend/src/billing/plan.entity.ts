import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
  })
  code!: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  name!: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description!: string | null;

  @Column({
    type: 'integer',
  })
  aiQueriesPerDay!: number;

  @Column({
    type: 'integer',
  })
  sqlExecutionsPerDay!: number;

  @Column({
    type: 'integer',
  })
  datasetLimit!: number;

  @Column({
    type: 'bigint',
    transformer: {
      to(value: number): number {
        return value;
      },

      from(value: string | number): number {
        return Number(value);
      },
    },
  })
  storageLimitBytes!: number;

  @Column({
    type: 'bigint',
    transformer: {
      to(value: number): number {
        return value;
      },

      from(value: string | number): number {
        return Number(value);
      },
    },
  })
  maxFileSizeBytes!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}