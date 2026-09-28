import {
  GoogleGenAI,
  ThinkingLevel,
} from '@google/genai';

import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import type {
  AiProvider,
  AiTextGenerationRequest,
  AiTextGenerationResponse,
} from './ai-provider.interface.js';

import {
  GEMINI_EMBEDDING_DIMENSION_DEFAULT,
  GEMINI_EMBEDDING_MODEL_DEFAULT,
} from './ai.constants.js';

@Injectable()
export class GeminiProvider
  implements AiProvider
{
  private readonly logger =
    new Logger(
      GeminiProvider.name,
    );

  private readonly client:
    | GoogleGenAI
    | null;

  private readonly model: string;

  private readonly embeddingModel: string;

  private readonly embeddingDimension: number;

  private readonly timeoutMs: number;

  private readonly retryAttempts: number;

  private readonly thinkingLevel:
    ThinkingLevel;

  constructor() {
    const apiKey =
      process.env.GEMINI_API_KEY?.trim();

    this.model =
      process.env.GEMINI_MODEL?.trim() ||
      'gemini-3.8-flash';

    this.embeddingModel =
      process.env.GEMINI_EMBEDDING_MODEL?.trim() ||
      GEMINI_EMBEDDING_MODEL_DEFAULT;

    this.embeddingDimension =
      Number.parseInt(
        process.env.GEMINI_EMBEDDING_DIMENSION ?? '',
        10,
      ) || GEMINI_EMBEDDING_DIMENSION_DEFAULT;

    /*
     * Keep the request deadline bounded.
     *
     * Multi-dataset SQL generation should not
     * sit behind a two-minute provider timeout.
     */
    this.timeoutMs =
      Math.max(
        20_000,
        Number.parseInt(
          process.env.GEMINI_TIMEOUT_MS ??
            '60000',
          10,
        ) || 60_000,
      );

    /*
     * A single provider attempt is intentional.
     * The application already has its own bounded
     * analysis-job retry behavior.
     */
    this.retryAttempts =
      Math.max(
        1,
        Number.parseInt(
          process.env.GEMINI_RETRY_ATTEMPTS ??
            '1',
          10,
        ) || 1,
      );

    const configuredThinkingLevel =
      process.env.GEMINI_THINKING_LEVEL
        ?.trim()
        .toLowerCase();

    switch (
      configuredThinkingLevel
    ) {
      case 'medium':
        this.thinkingLevel =
          ThinkingLevel.MEDIUM;
        break;

      case 'high':
        this.thinkingLevel =
          ThinkingLevel.HIGH;
        break;

      case 'low':
      default:
        this.thinkingLevel =
          ThinkingLevel.LOW;
        break;
    }

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
      const config: Record<
        string,
        unknown
      > = {
        systemInstruction:
          request.systemPrompt,

        maxOutputTokens:
          request.maxOutputTokens ??
          1600,

        thinkingConfig: {
          thinkingLevel:
            this.thinkingLevel,
        },

        httpOptions: {
          timeout:
            this.timeoutMs,

          retryOptions: {
            attempts:
              this.retryAttempts,

            initialDelay:
              0.5,

            expBase:
              2,

            maxDelay:
              3,

            jitter:
              0.2,

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
      };

      /*
       * Structured output is opt-in.
       * Normal explanation/SQL calls remain plain text.
       */
      if (
        request.responseMimeType
      ) {
        config.responseMimeType =
          request.responseMimeType;
      }

      if (
        request.responseSchema
      ) {
        config.responseSchema =
          request.responseSchema;
      }

      const response =
        await this.client.models.generateContent(
          {
            model:
              this.model,

            contents:
              request.userPrompt,

            config,
          },
        );

      const text =
        response.text?.trim() ??
        '';

      if (!text) {
        throw new ServiceUnavailableException(
          'Gemini returned an empty response',
        );
      }

      return {
        text,

        provider:
          'gemini',

        model:
          this.model,

        inputTokens:
          response
            .usageMetadata
            ?.promptTokenCount ??
          null,

        outputTokens:
          response
            .usageMetadata
            ?.candidatesTokenCount ??
          null,
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

  async generateEmbedding(
    text: string,
  ): Promise<number[]> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Gemini AI provider is not configured',
      );
    }

    try {
      const response =
        await this.client.models.embedContent({
          model: this.embeddingModel,
          contents: text,
          config: {
            outputDimensionality:
              this.embeddingDimension,
          },
        });

      const values =
        response.embedding?.values;

      if (!values || !Array.isArray(values)) {
        throw new ServiceUnavailableException(
          'Gemini returned empty embedding values',
        );
      }

      return values;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      this.logger.error(
        `Gemini embedding request failed: ${message}`,
      );

      if (
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'Gemini embedding request failed. Please try again.',
      );
    }
  }
}
