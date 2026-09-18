import {
  Injectable,
} from '@nestjs/common';

import { AiService } from '../ai/ai.service.js';

export type SqlExplanationLanguage =
  | 'english'
  | 'hindi'
  | 'hinglish';

export interface SqlExplanationInput {
  sql: string;
  question?: string | null;
  columns: string[];
  rowCount: number;
  truncated: boolean;
  summary: {
    totalRows: number;
    numericColumns: Array<{
      column: string;
      sum: number;
      average: number;
      min: number;
      max: number;
    }>;
  };
}

export interface SqlExplanationResult {
  enabled: boolean;
  language: SqlExplanationLanguage;
  text: string | null;
  provider: string | null;
  model: string | null;
  warning: string | null;
}

@Injectable()
export class SqlExplanationService {
  constructor(
    private readonly aiService: AiService,
  ) {}

  async explain(
    input: SqlExplanationInput,
  ): Promise<SqlExplanationResult> {
    const language =
      this.detectLanguage(
        input.question,
      );

    try {
      const generated =
        await this.aiService.generateText({
          systemPrompt:
            this.buildSystemPrompt(
              language,
            ),

          userPrompt:
            this.buildUserPrompt(
              input,
            ),

          temperature: 0,

          maxOutputTokens: 700,
        });

      const text =
        this.normalizeExplanation(
          generated.text,
        );

      if (!text) {
        return {
          enabled: false,

          language,

          text: null,

          provider: generated.provider,

          model: generated.model,

          warning:
            this.getUnavailableMessage(
              language,
            ),
        };
      }

      return {
        enabled: true,

        language,

        text,

        provider:
          generated.provider,

        model:
          generated.model,

        warning: null,
      };
    } catch {
      return {
        enabled: false,

        language,

        text: null,

        provider: null,

        model: null,

        warning:
          this.getUnavailableMessage(
            language,
          ),
      };
    }
  }

  private detectLanguage(
    question?: string | null,
  ): SqlExplanationLanguage {
    const normalized =
      question
        ?.trim()
        .toLowerCase() ??
      '';

    if (!normalized) {
      return 'english';
    }

    if (
      /[\u0900-\u097F]/.test(
        normalized,
      )
    ) {
      return 'hindi';
    }

    const hinglishIndicators = [
      'dikhao',
      'batao',
      'kitna',
      'kitni',
      'kitne',
      'ka',
      'ke',
      'ki',
      'mein',
      'me',
      'par',
      'se',
      'sabse',
      'zyada',
      'kam',
      'wale',
      'wali',
      'wala',
      'chahiye',
      'dikhana',
      'nikalo',
      'nikalna',
      'total bata',
      'average bata',
      'sales bata',
    ];

    const matchedIndicator =
      hinglishIndicators.some(
        (indicator) =>
          normalized
            .includes(indicator),
      );

    if (matchedIndicator) {
      return 'hinglish';
    }

    return 'english';
  }

  private buildSystemPrompt(
    language: SqlExplanationLanguage,
  ): string {
    const languageInstruction =
      this.getLanguageInstruction(
        language,
      );

    return `
You are the SQL explanation engine for an AI Data Analyst product.

Your job is to explain an already validated and executed SQL query.

${languageInstruction}

Strict rules:
- Explain only what is supported by the supplied SQL and result metadata.
- Do not invent business insights.
- Do not invent values that are not provided.
- Do not claim causation.
- Do not assume columns mean something beyond their names and SQL usage.
- Explain the SQL operation clearly.
- Explain what the returned result represents.
- Mention aggregation, grouping, filtering, sorting, joins, limits, or other operations only when they are actually present.
- Do not mention internal implementation details.
- Do not mention the AI provider.
- Keep the explanation concise.
- Return plain text only.
- Do not use Markdown.
`.trim();
  }

  private buildUserPrompt(
    input: SqlExplanationInput,
  ): string {
    const numericSummary =
      input.summary.numericColumns
        .map(
          (column) =>
            `${column.column} | sum=${column.sum} | average=${column.average} | min=${column.min} | max=${column.max}`,
        )
        .join('\n');

    return `
User question:
${input.question?.trim() || 'No natural-language question was provided.'}

Validated SQL:
${input.sql}

Result columns:
${input.columns.join(', ')}

Result row count:
${input.rowCount}

Result truncated:
${input.truncated ? 'yes' : 'no'}

Result numeric summary:
${numericSummary || 'No numeric columns were summarized.'}

Explain what this SQL does and what the returned result represents.
`.trim();
  }

  private getLanguageInstruction(
    language: SqlExplanationLanguage,
  ): string {
    switch (language) {
      case 'hindi':
        return `
Write the explanation in natural Hindi using Devanagari script.
`;

      case 'hinglish':
        return `
Write the explanation in natural Hinglish using Roman script.
`;

      case 'english':
      default:
        return `
Write the explanation in natural English.
`;
    }
  }

  private getUnavailableMessage(
    language: SqlExplanationLanguage,
  ): string {
    switch (language) {
      case 'hindi':
        return 'SQL explanation फिलहाल उपलब्ध नहीं है।';

      case 'hinglish':
        return 'SQL explanation abhi temporarily available nahi hai.';

      case 'english':
      default:
        return 'SQL explanation is temporarily unavailable.';
    }
  }

  private normalizeExplanation(
    value: string,
  ): string {
    return value
      .trim()
      .replace(/^```(?:text)?/i, '')
      .replace(/```$/i, '')
      .trim();
  }
}