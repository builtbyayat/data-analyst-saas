import { Injectable, Logger } from '@nestjs/common';
import { DuckDBService, DuckDBDatasetSource, DuckDBQueryResult } from '../../query/duckdb.service.js';
import { McpTool, McpToolDefinition, McpToolExecutionContext } from '../mcp-tool.interface.js';

export interface DuckDbMcpParams {
  sql: string;
  sources?: DuckDBDatasetSource[];
}

@Injectable()
export class DuckDbMcpTool implements McpTool<DuckDbMcpParams, DuckDBQueryResult> {
  private readonly logger = new Logger(DuckDbMcpTool.name);

  readonly definition: McpToolDefinition = {
    name: 'execute_duckdb_query',
    description: 'Executes analytical SQL queries safely inside an isolated in-memory DuckDB sandbox.',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'Analytical SQL query to run' },
      },
      required: ['sql'],
    },
  };

  constructor(private readonly duckDbService: DuckDBService) {}

  async execute(
    params: DuckDbMcpParams,
    _context: McpToolExecutionContext,
  ): Promise<DuckDBQueryResult> {
    this.logger.log(`MCP execution: execute_duckdb_query`);
    if (params.sources && params.sources.length > 0) {
      return this.duckDbService.queryMultipleDatasets(params.sources, params.sql);
    }
    return this.duckDbService.query(params.sql);
  }
}
