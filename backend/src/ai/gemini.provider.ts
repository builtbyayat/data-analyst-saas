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

  private readonly timeoutMs: number;

  private readonly retryAttempts: number;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    this.model =
      process.env.GEMINI_MODEL?.trim() ||
      'gemini-3.8-flash';

    this.timeoutMs = Math.max(
      10_000,
      Number.parseInt(
        process.env.GEMINI_TIMEOUT_MS ?? '45000',
        10,
      ) || 45_000,
    );

    this.retryAttempts = Math.max(
      1,
      Number.parseInt(
        process.env.GEMINI_RETRY_ATTEMPTS ?? '2',
        10,
      ) || 2,
    );

    this.client = apiKey
      ? new GoogleGenAI({
          apiKey,
        })
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
      const response =
        await this.client.models.generateContent({
          model: this.model,

          contents: request.userPrompt,

          config: {
            systemInstruction:
              request.systemPrompt,

            maxOutputTokens:
              request.maxOutputTokens ?? 2000,

            httpOptions: {
              timeout: this.timeoutMs,

              retryOptions: {
                attempts: this.retryAttempts,
                initialDelay: 0.5,
                expBase: 2,
                maxDelay: 3,
                jitter: 0.2,
                httpStatusCodes: [
                  408,
                  429,
                  500,
                  502,
                  503,
                  504,
                ],
              },
            },
          },
        });

      const text =
        response.text?.trim() ?? '';

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
          response.usageMetadata
            ?.promptTokenCount ?? null,

        outputTokens:
          response.usageMetadata
            ?.candidatesTokenCount ?? null,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      const stack =
        error instanceof Error
          ? error.stack
          : undefined;

      this.logger.error(
        `Gemini request failed: ${message}`,
        stack,
      );

      if (
        error instanceof
        ServiceUnavailableException
      ) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'Gemini AI request failed. Please try again.',
      );
    }
  }
}