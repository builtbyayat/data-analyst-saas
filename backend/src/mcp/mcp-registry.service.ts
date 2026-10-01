import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import {
  McpTool,
  McpToolDefinition,
  McpToolExecutionContext,
} from './mcp-tool.interface.js';

import {
  DuckDbMcpTool,
} from './tools/duckdb-mcp.tool.js';

import {
  PythonMcpTool,
} from './tools/python-mcp.tool.js';

@Injectable()
export class McpRegistryService {
  private readonly logger =
    new Logger(
      McpRegistryService.name,
    );

  private readonly tools =
    new Map<
      string,
      McpTool<any, any>
    >();

  constructor(
    duckDbTool: DuckDbMcpTool,
    pythonTool: PythonMcpTool,
  ) {
    this.registerTool(
      duckDbTool,
    );

    this.registerTool(
      pythonTool,
    );
  }

  registerTool(
    tool: McpTool<any, any>,
  ): void {
    this.tools.set(
      tool.definition.name,
      tool,
    );

    this.logger.log(
      `Registered MCP tool: ${tool.definition.name}`,
    );
  }

  getToolDefinitions():
    McpToolDefinition[] {
    return Array.from(
      this.tools.values(),
    ).map(
      (tool) =>
        tool.definition,
    );
  }

  async executeTool(
    name: string,
    params: Record<
      string,
      unknown
    >,
    context: McpToolExecutionContext,
  ): Promise<unknown> {
    const tool =
      this.tools.get(name);

    if (!tool) {
      throw new NotFoundException(
        `MCP tool '${name}' not registered in registry.`,
      );
    }

    if (
      !context.workspaceId ||
      !context.userId
    ) {
      throw new Error(
        'Workspace and user context must be provided for MCP tool execution',
      );
    }

    this.logger.log(
      `Executing MCP tool '${name}' for workspace=${context.workspaceId} user=${context.userId}`,
    );

    return tool.execute(
      params,
      context,
    );
  }
}