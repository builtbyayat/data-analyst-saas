import { Injectable, Logger } from '@nestjs/common';
import { BaseAgent, AgentInput, AgentOutput } from './agent.interface.js';
import { AiService } from '../ai/ai.service.js';

@Injectable()
export class DataAgent implements BaseAgent {
  readonly agentType = 'data' as const;
  private readonly logger = new Logger(DataAgent.name);

  constructor(private readonly aiService: AiService) {}

  async execute(input: AgentInput): Promise<AgentOutput> {
    this.logger.log(`Data agent processing task ${input.task.id}`);

    const systemPrompt = `You are the Data Agent in an AI Workspace.
Your job is to generate optimized analytical SQL queries, construct DuckDB pipelines, and analyze structured datasets.
Workspace memories:
${(input.contextMemories ?? []).join('\n') || 'None'}
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
