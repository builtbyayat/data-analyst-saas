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

export interface QueryResult {
  sql: string;
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
  executionTimeMs: number;
  summary: QuerySummary;
  visualization: QueryVisualization;
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

interface QueryRequestOptions {
  workspaceId: string;
  datasetId: string;
}

class QueryApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
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
      "You are not authenticated.",
      401,
    );
  }

  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body
        ? {
            "Content-Type": "application/json",
          }
        : {}),
      ...(options.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });

  const contentType =
    response.headers.get("content-type") ?? "";

  let data: unknown = null;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();

    data = text || null;
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;

    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data
    ) {
      const value = (data as { message?: unknown }).message;

      if (typeof value === "string") {
        message = value;
      } else if (Array.isArray(value)) {
        message = value.join(", ");
      }
    } else if (typeof data === "string" && data) {
      message = data;
    }

    throw new QueryApiError(
      message,
      response.status,
    );
  }

  return data as T;
}

function buildDatasetPath({
  workspaceId,
  datasetId,
}: QueryRequestOptions): string {
  return `/backend/workspaces/${encodeURIComponent(
    workspaceId,
  )}/datasets/${encodeURIComponent(datasetId)}`;
}

export const queryApi = {
  async generateSql(
    options: QueryRequestOptions,
    question: string,
  ): Promise<GenerateSqlResult> {
    return request<GenerateSqlResult>(
      `${buildDatasetPath(options)}/generate-sql`,
      {
        method: "POST",
        body: JSON.stringify({
          question,
        }),
      },
    );
  },

  async executeSql(
    options: QueryRequestOptions,
    sql: string,
  ): Promise<QueryResult> {
    return request<QueryResult>(
      `${buildDatasetPath(options)}/query`,
      {
        method: "POST",
        body: JSON.stringify({
          sql,
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
          question,
        }),
      },
    );
  },
};

export { QueryApiError };