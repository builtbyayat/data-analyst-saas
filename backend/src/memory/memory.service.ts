import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceMemory } from './workspace-memory.entity.js';
import { AiService } from '../ai/ai.service.js';

export interface MemorySearchResult {
  id: string;
  category: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    @InjectRepository(WorkspaceMemory)
    private readonly memoryRepository: Repository<WorkspaceMemory>,
    private readonly aiService: AiService,
  ) {}

  async storeMemory(
    workspaceId: string,
    category: string,
    content: string,
    metadata: Record<string, unknown> = {},
  ): Promise<WorkspaceMemory> {
    let embeddingVectorStr: string | null = null;
    try {
      const embedding = await this.aiService.generateEmbedding(content);
      embeddingVectorStr = `[${embedding.join(',')}]`;
    } catch (err) {
      this.logger.warn(`Failed to generate embedding for memory: ${err instanceof Error ? err.message : err}`);
    }

    const memory = this.memoryRepository.create({
      workspaceId,
      category,
      content,
      metadata,
      embedding: embeddingVectorStr,
    });

    return this.memoryRepository.save(memory);
  }

  async searchMemory(
    workspaceId: string,
    queryText: string,
    limit: number = 5,
  ): Promise<MemorySearchResult[]> {
    try {
      const queryEmbedding = await this.aiService.generateEmbedding(queryText);
      const vectorStr = `[${queryEmbedding.join(',')}]`;

      const rawResults = await this.memoryRepository.query(
        `SELECT id, category, content, metadata, 1 - (embedding <=> $1::vector) as similarity
         FROM workspace_memories
         WHERE "workspaceId" = $2 AND embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector
         LIMIT $3`,
        [vectorStr, workspaceId, limit],
      );

      return rawResults.map((row: any) => ({
        id: row.id,
        category: row.category,
        content: row.content,
        metadata: row.metadata ?? {},
        similarity: parseFloat(row.similarity ?? '0'),
      }));
    } catch (err) {
      this.logger.error(`Vector search memory failed: ${err instanceof Error ? err.message : err}`);
      // Fallback keyword search
      const fallback = await this.memoryRepository.find({
        where: { workspaceId },
        take: limit,
        order: { createdAt: 'DESC' },
      });
      return fallback.map((item) => ({
        id: item.id,
        category: item.category,
        content: item.content,
        metadata: item.metadata ?? {},
        similarity: 0.5,
      }));
    }
  }
}
