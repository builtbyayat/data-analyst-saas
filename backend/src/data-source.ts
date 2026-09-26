import 'dotenv/config';

import 'reflect-metadata';

import { DataSource } from 'typeorm';

import { User } from './users/user.entity.js';

import { Workspace } from './workspaces/workspace.entity.js';

import { WorkspaceMember } from './workspaces/workspace-member.entity.js';

import { Dataset } from './datasets/dataset.entity.js';

import { DatasetColumn } from './datasets/dataset-column.entity.js';

import { QueryHistory } from './query/query-history.entity.js';

import { SavedQuery } from './query/saved-query.entity.js';

import { SavedAnalysis } from './query/saved-analysis.entity.js';

import { Report } from './query/report.entity.js';

import { Plan } from './billing/plan.entity.js';

import { PlanEntitlement } from './billing/plan-entitlement.entity.js';

import { WorkspaceUsageDaily } from './billing/workspace-usage-daily.entity.js';

import { WorkspaceSubscription } from './billing/workspace-subscription.entity.js';

import { BillingWebhookEvent } from './billing/billing-webhook-event.entity.js';

const dataSource =
  new DataSource({
    type: 'postgres',

    host:
      process.env.DATABASE_HOST ??
      'localhost',

    port: Number(
      process.env.DATABASE_PORT ??
        '5432',
    ),

    username:
      process.env.DATABASE_USER ??
      'app',

    password:
      process.env.DATABASE_PASSWORD ??
      '',

    database:
      process.env.DATABASE_NAME ??
      'b2b_saas',

    entities: [
      User,

      Workspace,

      WorkspaceMember,

      Dataset,

      DatasetColumn,

      QueryHistory,

      SavedQuery,

      SavedAnalysis,

      Report,

      Plan,

      PlanEntitlement,

      WorkspaceUsageDaily,

      WorkspaceSubscription,

      BillingWebhookEvent,
    ],

    migrations: [
      'src/migrations/*.ts',
    ],

    synchronize: false,
  });

export default dataSource;