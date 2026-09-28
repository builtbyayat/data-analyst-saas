import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentSession } from './agent-session.entity.js';
import { AgentTask } from './agent-task.entity.js';
import { BaseAgent, AgentOutput } from './agent.interface.js';
import { OrchestratorAgent } from './orchestrator.agent.js';
import { DataAgent } from './data.agent.js';
import { CodingAgent } from './coding.agent.js';
import { ResearchAgent } from './research.agent.js';
import { MemoryService } from '../memory/memory.service.js';
import { McpRegistryService } from '../mcp/mcp-registry.service.js';
import { PlanUsageService } from '../billing/plan-usage.service.js';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);
  private readonly agentsMap = new Map<string, BaseAgent>();

  constructor(
    @InjectRepository(AgentSession)
    private readonly sessionRepository: Repository<AgentSession>,
    @InjectRepository(AgentTask)
    private readonly taskRepository: Repository<AgentTask>,
    private readonly memoryService: MemoryService,
    private readonly mcpRegistryService: McpRegistryService,
    private readonly planUsageService: PlanUsageService,
    orchestratorAgent: OrchestratorAgent,
    dataAgent: DataAgent,
    codingAgent: CodingAgent,
    researchAgent: ResearchAgent,
  ) {
    this.agentsMap.set('orchestrator', orchestratorAgent);
    this.agentsMap.set('data', dataAgent);
    this.agentsMap.set('coding', codingAgent);
    this.agentsMap.set('research', researchAgent);
  }

  async createSession(workspaceId: string, userId: string, title: string): Promise<AgentSession> {
    const session = this.sessionRepository.create({
      workspaceId,
      userId,
      title: title || 'New AI Workspace Session',
      status: 'active',
    });
    return this.sessionRepository.save(session);
  }

  async getSessions(workspaceId: string): Promise<AgentSession[]> {
    return this.sessionRepository.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  async getSession(sessionId: string, workspaceId: string): Promise<AgentSession> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, workspaceId },
      relations: ['tasks'],
    });

    if (!session) {
      throw new NotFoundException(`Agent session ${sessionId} not found`);
    }

    return session;
  }

  async createAndExecuteTask(
    sessionId: string,
    workspaceId: string,
    userId: string,
    assignedAgentName: string,
    prompt: string,
  ): Promise<AgentTask> {
    const session = await this.getSession(sessionId, workspaceId);

    // 1. Enforce AI quota
    await this.planUsageService.consumeAiQuery(workspaceId, userId);

    // 2. Create pending task
    const task = this.taskRepository.create({
      sessionId: session.id,
      workspaceId,
      assignedAgent: assignedAgentName || 'orchestrator',
      prompt,
      status: 'running',
    });
    const savedTask = await this.taskRepository.save(task);

    const startTime = Date.now();

    try {
      // 3. Fetch context from RAG memory & MCP tools
      const memories = await this.memoryService.searchMemory(workspaceId, prompt, 3);
      const memoryContextTexts = memories.map((m) => `[${m.category}] ${m.content}`);
      const tools = this.mcpRegistryService.getToolDefinitions();

      // 4. Resolve agent
      const agent = this.agentsMap.get(assignedAgentName) || this.agentsMap.get('orchestrator')!;

      // 5. Execute agent
      const output: AgentOutput = await agent.execute({
        session,
        task: savedTask,
        contextMemories: memoryContextTexts,
        tools,
      });

      const durationMs = Date.now() - startTime;

      // 6. Store completed output
      savedTask.status = output.status;
      savedTask.outputArtifact = {
        resultText: output.resultText,
        dataArtifact: output.dataArtifact ?? {},
        toolCalls: output.toolCalls ?? [],
        tokensUsed: output.tokensUsed ?? {},
      };
      savedTask.executionTimeMs = durationMs;

      // 7. Store summary to long-term memory automatically
      await this.memoryService.storeMemory(
        workspaceId,
        'task_result',
        `Task prompt: ${prompt}\nResult: ${output.resultText.substring(0, 500)}`,
        { taskId: savedTask.id, sessionId: session.id },
      );

      return this.taskRepository.save(savedTask);
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Agent task failed: ${errorMsg}`);

      savedTask.status = 'failed';
      savedTask.errorMessage = errorMsg;
      savedTask.executionTimeMs = durationMs;
      return this.taskRepository.save(savedTask);
    }
  }
}
