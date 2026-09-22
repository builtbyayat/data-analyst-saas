import { getAccessToken } from "./auth";

export interface QuerySummary {
  totalRows: number;
  numericColumns: Array<{
    column: string;
    sum: number;
    average: number;
    min: number;
    max: number;
  }>;
}

export interface QueryVisualization {
  type?: string;
  xAxis?: string;
  yAxis?: string;
  category?: string;
  value?: string;
  [key: string]: unknown;
}

export type AIInsightType =
  | "summary"
  | "trend"
  | "anomaly"
  | "comparison"
  | "distribution"
  | "relationship"
  | "finding";

export interface AIInsightEvidence {
  datasetId?: string;
  datasetName?: string;
  operation?: string;
  column?: string;
  value?: unknown;
  baseline?: unknown;
  change?: unknown;
  source?: string;
}

export interface AIInsight {
  type: AIInsightType;
  title: string;
  description: string;
  importance: "high" | "medium" | "low";
  evidence: AIInsightEvidence[];
}

export interface AIInsightsResult {
  status: "success" | "empty" | "error";
  summary: string;
  insights: AIInsight[];
  anomalies: AIInsight[];
  grounding: {
    datasetIds: string[];
    sql?: string;
    analyticsOperations: string[];
    evidenceAvailable: boolean;
  };
  warnings: string[];
}

export interface QueryResult {
  sql: string;
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
  executionTimeMs: number;
  summary: QuerySummary;
  visualization: QueryVisualization;
  explanation?: string | null;
  aiInsights?: AIInsightsResult | null;
  followUpQuestions: string[];
}

export interface GenerateSqlResult {
  question: string;
  sql: string;
  provider: string;
  model: string | null;
}

export interface NaturalLanguageQueryResult {
  question: string;
  sql: string;
  provider: string;
  model: string | null;
  result: QueryResult;
}

export interface QueryRequestOptions {
  workspaceId: string;
  datasetId: string;
  conversationId?: string | null;
}

export interface MultiDatasetQueryRequestOptions {
  workspaceId: string;
  datasetIds: string[];
  conversationId?: string | null;
}

export interface SqlValidationResult {
  valid: boolean;
  message: string | null;
  line: number | null;
  column: number | null;
}

export class QueryApiError extends Error {
  status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);
    this.name = "QueryApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();

  if (!token) {
    throw new QueryApiError(
      "Your session is missing. Please log in again.",
      401,
    );
  }

  const headers = new Headers(
    options.headers,
  );

  headers.set(
    "Authorization",
    `Bearer ${token}`,
  );

  if (
    options.body &&
    !headers.has("Content-Type")
  ) {
    headers.set(
      "Content-Type",
      "application/json",
    );
  }

  let response: Response;

  try {
    response = await fetch(
      path,
      {
        ...options,
        headers,
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new QueryApiError(
        error.message ||
          "Network request failed.",
        0,
      );
    }

    throw new QueryApiError(
      "Network request failed.",
      0,
    );
  }

  const contentType =
    response.headers.get(
      "content-type",
    ) ?? "";

  let data: unknown = null;

  if (
    contentType.includes(
      "application/json",
    )
  ) {
    data = await response
      .json()
      .catch(() => null);
  } else {
    data = await response
      .text()
      .catch(() => "");
  }

  if (!response.ok) {
    let message =
      "Request failed.";

    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof (
        data as {
          message?: unknown;
        }
      ).message === "string"
    ) {
      message = (
        data as {
          message: string;
        }
      ).message;
    } else if (
      typeof data === "string" &&
      data.trim()
    ) {
      message = data.trim();
    }

    throw new QueryApiError(
      message,
      response.status,
    );
  }

  return data as T;
}

function buildDatasetPath(
  options: QueryRequestOptions,
): string {
  return `/backend/workspaces/${encodeURIComponent(
    options.workspaceId,
  )}/datasets/${encodeURIComponent(
    options.datasetId,
  )}`;
}

function buildMultiDatasetPath(
  workspaceId: string,
): string {
  return `/backend/workspaces/${encodeURIComponent(
    workspaceId,
  )}/multi-datasets`;
}

function normalizeDatasetIds(
  datasetIds: string[],
): string[] {
  return Array.from(
    new Set(
      datasetIds
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );
}

function assertMultiDatasetIds(
  datasetIds: string[],
): string[] {
  const normalized =
    normalizeDatasetIds(
      datasetIds,
    );

  if (normalized.length < 2) {
    throw new QueryApiError(
      "At least two datasets are required for combined analysis.",
      400,
    );
  }

  return normalized;
}

export const queryApi = {
  async generateSql(
    options: QueryRequestOptions,
    question: string,
  ): Promise<GenerateSqlResult> {
    return request<GenerateSqlResult>(
      `${buildDatasetPath(
        options,
      )}/generate-sql`,
      {
        method: "POST",
        body: JSON.stringify({
          question: question.trim(),
          conversationId:
            options.conversationId ??
            null,
        }),
      },
    );
  },

  async executeSql(
    options: QueryRequestOptions,
    sql: string,
    question?: string | null,
  ): Promise<QueryResult> {
    return request<QueryResult>(
      `${buildDatasetPath(
        options,
      )}/query`,
      {
        method: "POST",
        body: JSON.stringify({
          sql,
          question:
            question?.trim() ||
            null,
          conversationId:
            options.conversationId ??
            null,
        }),
      },
    );
  },

  async queryFromQuestion(
    options: QueryRequestOptions,
    question: string,
  ): Promise<NaturalLanguageQueryResult> {
    return request<NaturalLanguageQueryResult>(
      `${buildDatasetPath(
        options,
      )}/query-from-question`,
      {
        method: "POST",
        body: JSON.stringify({
          question:
            question.trim(),
          conversationId:
            options.conversationId ??
            null,
        }),
      },
    );
  },

  async generateMultiDatasetSql(
    options: MultiDatasetQueryRequestOptions,
    question: string,
  ): Promise<GenerateSqlResult> {
    const datasetIds =
      assertMultiDatasetIds(
        options.datasetIds,
      );

    return request<GenerateSqlResult>(
      `${buildMultiDatasetPath(
        options.workspaceId,
      )}/generate-sql`,
      {
        method: "POST",
        body: JSON.stringify({
          datasetIds,
          question: question.trim(),
          conversationId:
            options.conversationId ??
            null,
        }),
      },
    );
  },

  async validateMultiDatasetSql(
    options: MultiDatasetQueryRequestOptions,
    sql: string,
  ): Promise<SqlValidationResult> {
    const datasetIds =
      assertMultiDatasetIds(
        options.datasetIds,
      );

    return request<SqlValidationResult>(
      `${buildMultiDatasetPath(
        options.workspaceId,
      )}/validate-sql`,
      {
        method: "POST",
        body: JSON.stringify({
          datasetIds,
          sql,
        }),
      },
    );
  },

  async executeMultiDatasetSql(
    options: MultiDatasetQueryRequestOptions,
    sql: string,
    question?: string | null,
  ): Promise<QueryResult> {
    const datasetIds =
      assertMultiDatasetIds(
        options.datasetIds,
      );

    return request<QueryResult>(
      `${buildMultiDatasetPath(
        options.workspaceId,
      )}/query`,
      {
        method: "POST",
        body: JSON.stringify({
          datasetIds,
          sql,
          question:
            question?.trim() ||
            null,
          conversationId:
            options.conversationId ??
            null,
        }),
      },
    );
  },

  async queryMultiDatasetFromQuestion(
    options: MultiDatasetQueryRequestOptions,
    question: string,
  ): Promise<NaturalLanguageQueryResult> {
    const datasetIds =
      assertMultiDatasetIds(
        options.datasetIds,
      );

    return request<NaturalLanguageQueryResult>(
      `${buildMultiDatasetPath(
        options.workspaceId,
      )}/query-from-question`,
      {
        method: "POST",
        body: JSON.stringify({
          datasetIds,
          question:
            question.trim(),
          conversationId:
            options.conversationId ??
            null,
        }),
      },
    );
  },
};