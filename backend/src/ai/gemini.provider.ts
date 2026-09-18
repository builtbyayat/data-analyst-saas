import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import type {
  AiProvider,
  AiTextGenerationRequest,
  AiTextGenerationResponse,
} from './ai-provider.interface.js';

@Injectable()
export class GeminiProvider implements AiProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly client: GoogleGenAI | null;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    this.model =
      process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash';

    this.client = apiKey
      ? new GoogleGenAI({ apiKey })
      : null;
  }

  async generateText(
    request: AiTextGenerationRequest,
  ): Promise<AiTextGenerationResponse> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Gemini AI provider is not configured',
      );
    }

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: request.userPrompt,
        config: {
          systemInstruction: request.systemPrompt,
          maxOutputTokens: request.maxOutputTokens ?? 2000,
        },
      });

      const text = response.text?.trim() ?? '';

      if (!text) {
        throw new ServiceUnavailableException(
          'Gemini returned an empty response',
        );
      }

      return {
        text,
        provider: 'gemini',
        model: this.model,
        inputTokens:
          response.usageMetadata?.promptTokenCount ?? null,
        outputTokens:
          response.usageMetadata?.candidatesTokenCount ?? null,
      };
    } catch (error) {
      this.logger.error(
        'Gemini request failed',
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'Gemini AI request failed',
      );
    }
  }
}