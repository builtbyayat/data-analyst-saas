import { Module } from '@nestjs/common';
import { AI_PROVIDER } from './ai.constants.js';
import { AiService } from './ai.service.js';
import { GeminiProvider } from './gemini.provider.js';

@Module({
  providers: [
    AiService,
    GeminiProvider,
    {
      provide: AI_PROVIDER,
      useExisting: GeminiProvider,
    },
  ],
  exports: [AiService, AI_PROVIDER],
})
export class AiModule {}