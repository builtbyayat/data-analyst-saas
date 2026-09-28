import { Injectable, Logger } from '@nestjs/common';
import { BaseAgent, AgentInput, AgentOutput } from './agent.interface.js';
import { AiService } from '../ai/ai.service.js';

@Injectable()
export class ResearchAgent implements BaseAgent {
  readonly agentType = 'research' as const;
  private readonly logger = new Logger(ResearchAgent.name);

  constructor(private readonly aiService: AiService) {}

  async execute(input: AgentInput): Promise<AgentOutput> {
    this.logger.log(`Research agent processing task ${input.task.id}`);

    const systemPrompt = `You are the Research Agent in an AI Workspace.
Your job is to synthesize findings, summarize datasets, cross-reference workspace memory, and assemble business intelligence reports.
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
