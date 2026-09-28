import { Injectable, Logger } from '@nestjs/common';
import { PythonAnalyticsService, PythonAnalyticsResult } from '../../query/python-analytics.service.js';
import { McpTool, McpToolDefinition, McpToolExecutionContext } from '../mcp-tool.interface.js';

export interface PythonMcpParams {
  operation: string;
  rows?: Array<Record<string, unknown>>;
  columns?: Array<Record<string, unknown>>;
  question?: string;
  args?: Record<string, unknown>;
}

@Injectable()
export class PythonMcpTool implements McpTool<PythonMcpParams, PythonAnalyticsResult> {
  private readonly logger = new Logger(PythonMcpTool.name);

  readonly definition: McpToolDefinition = {
    name: 'run_python_analytics',
    description: 'Runs statistical and data science python operations on structured datasets.',
    inputSchema: {
      type: 'object',
      properties: {
        operation: { type: 'string', description: 'Operation to perform (e.g. summary, correlation, forecast)' },
        question: { type: 'string', description: 'Optional natural-language question for planner-aware analytics' },
      },
      required: ['operation'],
    },
  };

  constructor(private readonly pythonService: PythonAnalyticsService) {}

  async execute(
    params: PythonMcpParams,
    _context: McpToolExecutionContext,
  ): Promise<PythonAnalyticsResult> {
    this.logger.log(`MCP execution: run_python_analytics operation=${params.operation}`);

    const rows = params.rows ?? [];

    if (params.question && params.columns) {
      return this.pythonService.analyzeQuestion(
        rows,
        params.columns,
        params.question,
      );
    }

    return this.pythonService.analyze(
      rows,
      params.operation,
      params.args ?? {},
    );
  }
}
