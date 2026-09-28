import { AgentSession } from './agent-session.entity.js';
import { AgentTask } from './agent-task.entity.js';
import { McpToolDefinition } from '../mcp/mcp-tool.interface.js';

export interface AgentInput {
  session: AgentSession;
  task: AgentTask;
  contextMemories?: string[];
  tools?: McpToolDefinition[];
}

export interface AgentOutput {
  status: 'completed' | 'failed';
  resultText: string;
  dataArtifact?: Record<string, unknown>;
  toolCalls?: Array<{ tool: string; params: Record<string, unknown>; result: unknown }>;
  tokensUsed?: { input: number | null; output: number | null };
}

export interface BaseAgent {
  readonly agentType: 'orchestrator' | 'data' | 'coding' | 'research';
  execute(input: AgentInput): Promise<AgentOutput>;
}
