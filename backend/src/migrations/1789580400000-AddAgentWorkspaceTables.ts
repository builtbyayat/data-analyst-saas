import { MigrationInterface, QueryRunner } from 'typeorm';
import { GEMINI_EMBEDDING_DIMENSION_DEFAULT } from '../ai/ai.constants.js';

export class AddAgentWorkspaceTables1789580400000
  implements MigrationInterface
{
  name = 'AddAgentWorkspaceTables1789580400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Ensure vector extension exists
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

    // 2. Create agent_sessions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "agent_sessions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "title" VARCHAR(255) NOT NULL,
        "status" VARCHAR(50) NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // 3. Create agent_tasks table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "agent_tasks" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "sessionId" UUID NOT NULL REFERENCES "agent_sessions"("id") ON DELETE CASCADE,
        "workspaceId" UUID NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "assignedAgent" VARCHAR(50) NOT NULL,
        "prompt" TEXT NOT NULL,
        "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
        "dependsOnTaskIds" UUID[] DEFAULT '{}',
        "inputArtifacts" JSONB DEFAULT '{}',
        "outputArtifact" JSONB DEFAULT '{}',
        "errorMessage" TEXT,
        "executionTimeMs" INT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // 4. Create workspace_memories table with vector(768)
    const dim = GEMINI_EMBEDDING_DIMENSION_DEFAULT;
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspace_memories" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "category" VARCHAR(50) NOT NULL,
        "content" TEXT NOT NULL,
        "metadata" JSONB DEFAULT '{}',
        "embedding" vector(${dim}),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // 5. Indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_agent_sessions_workspace_created_at"
      ON "agent_sessions" ("workspaceId", "createdAt");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_agent_tasks_session_created_at"
      ON "agent_tasks" ("sessionId", "createdAt");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_workspace_memories_workspace_category"
      ON "workspace_memories" ("workspaceId", "category");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workspace_memories_workspace_category";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agent_tasks_session_created_at";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agent_sessions_workspace_created_at";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_memories";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_tasks";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_sessions";`);
  }
}
