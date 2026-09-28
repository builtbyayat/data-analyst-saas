import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceMemory } from './workspace-memory.entity.js';
import { MemoryService } from './memory.service.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceMemory]),
    AiModule,
  ],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
