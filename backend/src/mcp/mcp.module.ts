import { Module } from '@nestjs/common';
import { QueryModule } from '../query/query.module.js';
import { McpRegistryService } from './mcp-registry.service.js';
import { DuckDbMcpTool } from './tools/duckdb-mcp.tool.js';
import { PythonMcpTool } from './tools/python-mcp.tool.js';

@Module({
  imports: [QueryModule],
  providers: [
    DuckDbMcpTool,
    PythonMcpTool,
    McpRegistryService,
  ],
  exports: [
    McpRegistryService,
    DuckDbMcpTool,
    PythonMcpTool,
  ],
})
export class McpModule {}
