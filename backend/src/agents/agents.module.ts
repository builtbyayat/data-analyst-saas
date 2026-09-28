import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentSession } from './agent-session.entity.js';
import { AgentTask } from './agent-task.entity.js';
import { AgentsService } from './agents.service.js';
import { AgentsController } from './agents.controller.js';
import { OrchestratorAgent } from './orchestrator.agent.js';
import { DataAgent } from './data.agent.js';
import { CodingAgent } from './coding.agent.js';
import { ResearchAgent } from './research.agent.js';
import { AiModule } from '../ai/ai.module.js';
import { MemoryModule } from '../memory/memory.module.js';
import { McpModule } from '../mcp/mcp.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentSession, AgentTask]),
    AiModule,
    MemoryModule,
    McpModule,
    BillingModule,
    WorkspacesModule,
  ],
  controllers: [AgentsController],
  providers: [
    AgentsService,
    OrchestratorAgent,
    DataAgent,
    CodingAgent,
    ResearchAgent,
  ],
  exports: [AgentsService],
})
export class AgentsModule {}
