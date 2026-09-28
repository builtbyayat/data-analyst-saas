export interface McpToolParameterSchema {
  type: string;
  properties?: Record<string, { type: string; description?: string }>;
  required?: string[];
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: McpToolParameterSchema;
}

export interface McpToolExecutionContext {
  workspaceId: string;
  userId: string;
}

export interface McpTool<TParams = Record<string, unknown>, TResult = unknown> {
  readonly definition: McpToolDefinition;
  execute(params: TParams, context: McpToolExecutionContext): Promise<TResult>;
}
