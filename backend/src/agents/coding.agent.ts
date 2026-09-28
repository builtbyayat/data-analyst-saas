import { Injectable, Logger } from '@nestjs/common';
import { BaseAgent, AgentInput, AgentOutput } from './agent.interface.js';
import { AiService } from '../ai/ai.service.js';

@Injectable()
export class CodingAgent implements BaseAgent {
  readonly agentType = 'coding' as const;
  private readonly logger = new Logger(CodingAgent.name);

  constructor(private readonly aiService: AiService) {}

  async execute(input: AgentInput): Promise<AgentOutput> {
    this.logger.log(`Coding agent processing task ${input.task.id}`);

    const systemPrompt = `You are the Coding Agent in an AI Workspace.
Your job is to generate Python data analysis code, statistical computations, and custom visualizations.
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
