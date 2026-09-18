import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import type {
  AiProvider,
  AiTextGenerationRequest,
  AiTextGenerationResponse,
} from './ai-provider.interface.js';

@Injectable()
export class UnavailableAiProvider
  implements AiProvider
{
  async generateText(
    _request: AiTextGenerationRequest,
  ): Promise<AiTextGenerationResponse> {
    throw new ServiceUnavailableException(
      'AI provider is not configured',
    );
  }
}