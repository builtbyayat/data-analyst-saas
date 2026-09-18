import { Inject, Injectable } from '@nestjs/common';
import { AI_PROVIDER } from './ai.constants.js';
import type {
  AiProvider,
  AiTextGenerationRequest,
  AiTextGenerationResponse,
} from './ai-provider.interface.js';

@Injectable()
export class AiService {
  constructor(
    @Inject(AI_PROVIDER)
    private readonly provider: AiProvider,
  ) {}

  generateText(
    request: AiTextGenerationRequest,
  ): Promise<AiTextGenerationResponse> {
    return this.provider.generateText(request);
  }
}