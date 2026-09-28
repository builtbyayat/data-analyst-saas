export interface AiTextGenerationRequest {
  systemPrompt: string;

  userPrompt: string;

  temperature?: number;

  maxOutputTokens?: number;

  responseMimeType?: string;

  responseSchema?: Record<
    string,
    unknown
  >;
}

export interface AiTextGenerationResponse {
  text: string;

  provider: string;

  model: string | null;

  inputTokens: number | null;

  outputTokens: number | null;
}

export interface AiProvider {
  generateText(
    request: AiTextGenerationRequest,
  ): Promise<AiTextGenerationResponse>;

  generateEmbedding(
    text: string,
  ): Promise<number[]>;
}
