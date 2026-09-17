import 'dotenv/config';
import 'reflect-metadata';

import { DataSource } from 'typeorm';

import { User } from './users/user.entity.js';
import { Workspace } from './workspaces/workspace.entity.js';
import { WorkspaceMember } from './workspaces/workspace-member.entity.js';
import { Dataset } from './datasets/dataset.entity.js';
import { DatasetColumn } from './datasets/dataset-column.entity.js';

const dataSource = new DataSource({
  type: 'postgres',

  host:
    process.env.DATABASE_HOST ?? 'localhost',

  port: Number(
    process.env.DATABASE_PORT ?? '5432',
  ),

  username:
    process.env.DATABASE_USER ?? 'app',

  password:
    process.env.DATABASE_PASSWORD ?? '',

  database:
    process.env.DATABASE_NAME ?? 'b2b_saas',

  entities: [
    User,
    Workspace,
    WorkspaceMember,
    Dataset,
    DatasetColumn,
  ],

  migrations: [
    'src/migrations/*.ts',
  ],

  synchronize: false,
});

export default dataSource;