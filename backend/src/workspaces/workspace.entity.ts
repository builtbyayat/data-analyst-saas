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

import { WorkspaceMember } from './workspace-member.entity.js';

import { Plan } from '../billing/plan.entity.js';

@Entity('workspaces')
export class Workspace {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'varchar',
  })
  name!: string;

  @Column({
    type: 'varchar',
    unique: true,
  })
  slug!: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'free',
  })
  planCode!: string;

  @ManyToOne(
    () => Plan,
    {
      nullable: false,
      onDelete: 'RESTRICT',
      onUpdate: 'NO ACTION',
    },
  )
  @JoinColumn({
    name: 'planCode',
    referencedColumnName: 'code',
  })
  plan!: Plan;

  @OneToMany(
    () => WorkspaceMember,
    (member) => member.workspace,
  )
  members!: WorkspaceMember[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}