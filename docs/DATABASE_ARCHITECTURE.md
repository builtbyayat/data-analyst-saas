# DATABASE_ARCHITECTURE.md — AI Data Analyst

## Purpose

This document defines the initial PostgreSQL data architecture for the AI Data Analyst SaaS.

The database must support:

- Authentication
- Multi-tenant workspaces
- Workspace membership and roles
- Uploaded datasets
- Dataset metadata
- User queries
- Query execution history
- Background analysis jobs
- Usage tracking
- Future billing and entitlements

---

## Database

Database Engine:

- PostgreSQL

ORM:

- TypeORM

Schema Synchronization:

- Disabled

Current TypeORM configuration:

```ts
synchronize: false


# IMPLEMENTATION UPDATE — AUTHENTICATION & WORKSPACE ARCHITECTURE

This section records the database architecture that has been implemented after the initial database foundation.

---

## 1. Authentication Database Model

Implemented table:

```text
users

Current schema:

id
email
passwordHash
name
createdAt
updatedAt

Column behavior:

id            UUID PRIMARY KEY
email         VARCHAR NOT NULL UNIQUE
passwordHash  VARCHAR NOT NULL
name          VARCHAR NOT NULL
createdAt     TIMESTAMP NOT NULL
updatedAt     TIMESTAMP NOT NULL

Authentication passwords are stored as bcrypt hashes.

Plain-text passwords must never be stored in PostgreSQL.

2. Workspace Database Model

Implemented table:

workspaces

Current schema:

id
name
slug
createdAt
updatedAt

Constraints:

PRIMARY KEY (id)
UNIQUE (slug)

Purpose:

The workspace represents the primary tenant boundary for the B2B SaaS application.

3. Workspace Membership Model

Implemented table:

workspace_members

Current schema:

id
workspaceId
userId
role
createdAt

Constraints:

PRIMARY KEY (id)
UNIQUE (workspaceId, userId)

Foreign keys:

workspaceId → workspaces.id
userId      → users.id

Delete behavior:

ON DELETE CASCADE
4. Workspace Roles

Current role values:

owner
admin
member

Current implementation creates the user who creates a workspace as:

owner

Fine-grained role authorization is not yet fully implemented.

5. Entity Relationship Model

Current database relationship:

users
   │
   │ userId
   ▼
workspace_members
   │
   │ workspaceId
   ▼
workspaces

Meaning:

One user may belong to multiple workspaces.
One workspace may contain multiple users.
One membership belongs to one user and one workspace.
The (workspaceId, userId) pair must be unique.
6. Tenant Isolation Rule

Workspace is the current tenant boundary.

Future tenant-owned tables must contain a workspace reference.

Examples:

datasets.workspaceId
queries.workspaceId
queryExecutions.workspaceId
analysisJobs.workspaceId
usageRecords.workspaceId

The backend must verify workspace membership before allowing access to workspace-owned resources.

A client-supplied workspace ID must never be treated as proof of authorization.

7. Workspace Authorization

Current authorization service:

WorkspaceAccessService

The service verifies:

authenticated user ID
        +
requested workspace ID
        ↓
workspace_members lookup
        ↓
membership exists
        ↓
access allowed

If membership does not exist, the workspace is not accessible to that user.

8. Workspace Creation Transaction

Workspace creation is transactional.

Logical operation:

BEGIN

Create workspace

Create workspace_members row
with role = owner

COMMIT

If any part fails, the transaction must roll back.

This prevents a workspace from being created without its owner membership.

9. Database Migration History

Schema synchronization remains disabled:

synchronize: false

All schema changes are managed through TypeORM migrations.

Current migration sequence:

1. InitialSchema
2. AddWorkspaces
3. AddWorkspaceRelations

Migration directory:

backend/src/migrations/

DataSource:

backend/src/data-source.ts

Migration CLI:

typeorm-ts-node-esm
10. InitialSchema Migration

Migration:

InitialSchema1789572660451

Created:

users

The migration was successfully executed against the local PostgreSQL database.

11. AddWorkspaces Migration

Migration:

AddWorkspaces1789573796028

Created:

workspaces
workspace_members

The migration was successfully executed.

12. AddWorkspaceRelations Migration

Migration:

AddWorkspaceRelations1789574078248

Added:

UNIQUE(workspaceId, userId)

FOREIGN KEY workspaceId
REFERENCES workspaces(id)

FOREIGN KEY userId
REFERENCES users(id)

Delete behavior:

ON DELETE CASCADE

The migration was successfully executed.

13. Object Storage Boundary

Uploaded files are not stored as PostgreSQL binary data.

The intended architecture is:

Uploaded File
     ↓
Object Storage
     ↓
Dataset Metadata in PostgreSQL

Current local object storage:

MinIO

Current SDK:

@aws-sdk/client-s3

The application should use an S3-compatible abstraction rather than hard-coding MinIO-specific behavior.

14. Planned Dataset Architecture

The next database domain is:

datasets
dataset_columns

Planned relationship:

workspace
    ↓
dataset
    ↓
dataset_columns

Every dataset must belong to a workspace.

Every dataset column must belong to a dataset.

15. Planned Dataset Metadata

The database is expected to store dataset metadata such as:

dataset identity
workspace ownership
original filename
object-storage key
file type
file size
row count
column count
processing status
createdAt
updatedAt

Exact final fields will be defined before the Dataset migration is generated.

16. Planned Processing Flow

Dataset processing will use asynchronous background jobs.

Planned flow:

Upload
   ↓
Object Storage
   ↓
Dataset metadata
   ↓
BullMQ job
   ↓
Dataset ingestion
   ↓
Dataset profiling
   ↓
DatasetColumn metadata

Heavy processing must not block the primary API request unnecessarily.

17. Current Database Status

Implemented:

users                    ✅
workspaces               ✅
workspace_members        ✅

users.email UNIQUE       ✅
workspaces.slug UNIQUE   ✅
membership UNIQUE        ✅

workspace foreign key    ✅
user foreign key         ✅

TypeORM migrations       ✅

Not yet implemented:

datasets
dataset_columns
queries
query_executions
analysis_jobs
usage_records
billing/entitlements
18. Current Core Architecture Status

Database architecture currently supports:

Authentication
      ↓
User
      ↓
Workspace
      ↓
Workspace Membership
      ↓
Tenant Authorization

The next database boundary to implement is:

Workspace
    ↓
Dataset
    ↓
DatasetColumn
19. Database Design Rules

All future database work must follow these rules:

1. Tenant-owned data must have an explicit workspace boundary.

2. Foreign keys must be defined for ownership relationships.

3. Duplicate memberships must be prevented at the database level.

4. Schema synchronization remains disabled.

5. Schema changes must use migrations.

6. Uploaded files belong in object storage.

7. PostgreSQL remains the durable source of business metadata.

8. Redis must not be the only durable source of business-critical data.

9. Authorization must be enforced server-side.

10. New schema changes must be reviewed before migration execution.
20. Current Database Architecture Milestone

Completed:

[x] PostgreSQL foundation
[x] TypeORM configuration
[x] Migration system
[x] User table
[x] Workspace table
[x] Workspace membership table
[x] Workspace foreign keys
[x] Membership uniqueness constraint
[x] Tenant authorization foundation

Next:

[ ] Dataset schema
[ ] Dataset column schema
[ ] Dataset object-storage metadata
[ ] Dataset ingestion state
[ ] Dataset processing jobs
CURRENT DATABASE FOCUS

Next implementation:

DATASET / DATA INGESTION ARCHITECTURE

Expected ownership chain:

User
  ↓
Workspace
  ↓
Dataset
  ↓
DatasetColumn

Every dataset resource must remain workspace-scoped.