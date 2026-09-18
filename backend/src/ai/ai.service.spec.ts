import {
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  Test,
  TestingModule,
} from '@nestjs/testing';

import { AI_PROVIDER } from './ai.constants.js';
import { AiService } from './ai.service.js';
import { UnavailableAiProvider } from './unavailable-ai.provider.js';

describe('AiService', () => {
  let aiService: AiService;

  beforeEach(async () => {
    const app: TestingModule =
      await Test.createTestingModule({
        providers: [
          AiService,
          UnavailableAiProvider,
          {
            provide: AI_PROVIDER,
            useExisting:
              UnavailableAiProvider,
          },
        ],
      }).compile();

    aiService =
      app.get<AiService>(AiService);
  });

  it('should resolve AiService through the AI provider abstraction', () => {
    expect(aiService).toBeDefined();
  });

  it('should report that no AI provider is configured', async () => {
    await expect(
      aiService.generateText({
        systemPrompt:
          'You are a test assistant.',
        userPrompt:
          'Return a test response.',
      }),
    ).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});