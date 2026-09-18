export interface AiTextGenerationRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
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
}