import { Injectable, Logger } from '@nestjs/common';
import { BaseAgent, AgentInput, AgentOutput } from './agent.interface.js';
import { AiService } from '../ai/ai.service.js';

@Injectable()
export class OrchestratorAgent implements BaseAgent {
  readonly agentType = 'orchestrator' as const;
  private readonly logger = new Logger(OrchestratorAgent.name);

  constructor(private readonly aiService: AiService) {}

  async execute(input: AgentInput): Promise<AgentOutput> {
    this.logger.log(`Orchestrator agent processing task ${input.task.id}`);

    const systemPrompt = `You are the Lead Orchestrator Agent in an AI Data Analytics Workspace.
Your role is to analyze user requests, break complex goals into sub-tasks, and coordinate sub-agents (Data Agent, Coding Agent, Research Agent).
Workspace context memories:
${(input.contextMemories ?? []).join('\n') || 'None'}
Available tools:
${JSON.stringify(input.tools ?? [])}
`;

    const userPrompt = input.task.prompt;

    const response = await this.aiService.generateText({
      systemPrompt,
      userPrompt,
    });

    return {
      status: 'completed',
      resultText: response.text,
      tokensUsed: {
        input: response.inputTokens,
        output: response.outputTokens,
      },
    };
  }
}
