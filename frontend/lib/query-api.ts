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

  importance:
    | "high"
    | "medium"
    | "low";

  evidence: AIInsightEvidence[];
}

export interface AIInsightsResult {
  status:
    | "success"
    | "empty"
    | "error";

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

  analytics?: unknown | null;

  aiInsights?:
    | AIInsightsResult
    | null;

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

export interface AnalysisJobResponse {
  jobId: string;

  queue: "analysis";

  status: "queued";
}

export interface AnalysisJobStatus {
  jobId: string;

  queue: "analysis";

  type:
    | "sql"
    | "natural_language"
    | "multi_dataset_sql"
    | "multi_dataset_natural_language";

  status:
    | "waiting"
    | "active"
    | "delayed"
    | "completed"
    | "failed"
    | "unknown";

  progress:
    | number
    | string
    | boolean
    | Record<string, unknown>
    | null;

  attemptsMade: number;

  maxAttempts: number;

  createdAt: string | null;

  processedAt: string | null;

  finishedAt: string | null;

  failedReason: string | null;

  result: unknown | null;
}

export class QueryApiError extends Error {
  status: number;

  constructor(
    message: string,

    status: number,
  ) {
    super(message);

    this.name =
      "QueryApiError";

    this.status =
      status;
  }
}

const JOB_POLL_INTERVAL_MS =
  500;

const JOB_MAX_WAIT_MS =
  15 * 60 * 1000;

function sleep(
  milliseconds: number,
): Promise<void> {
  return new Promise(
    (resolve) => {
      window.setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}

async function request<T>(
  path: string,

  options: RequestInit = {},
): Promise<T> {
  const token =
    getAccessToken();

  if (!token) {
    throw new QueryApiError(
      "Your session is missing. Please log in again.",

      401,
    );
  }

  const headers =
    new Headers(
      options.headers,
    );

  headers.set(
    "Authorization",
    `Bearer ${token}`,
  );

  if (
    options.body &&
    !headers.has(
      "Content-Type",
    )
  ) {
    headers.set(
      "Content-Type",
      "application/json",
    );
  }

  let response: Response;

  try {
    response =
      await fetch(
        path,
        {
          ...options,

          headers,
        },
      );
  } catch (
    error
  ) {
    throw new QueryApiError(
      error instanceof Error
        ? error.message
        : "Network request failed.",

      0,
    );
  }

  const contentType =
    response.headers.get(
      "content-type",
    ) ?? "";

  let data: unknown =
    null;

  if (
    contentType.includes(
      "application/json",
    )
  ) {
    data =
      await response
        .json()
        .catch(
          () => null,
        );
  } else {
    data =
      await response
        .text()
        .catch(
          () => "",
        );
  }

  if (!response.ok) {
    let message =
      `Request failed with status ${response.status}.`;

    if (
      typeof data ===
        "object" &&
      data !== null &&
      "message" in data
    ) {
      const candidate =
        (
          data as {
            message?: unknown;
          }
        ).message;

      if (
        typeof candidate ===
        "string"
      ) {
        message =
          candidate;
      } else if (
        Array.isArray(
          candidate,
        )
      ) {
        message =
          candidate.join(
            ", ",
          );
      }
    } else if (
      typeof data ===
        "string" &&
      data.trim()
    ) {
      message =
        data.trim();
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

function buildJobStatusPath(
  workspaceId: string,

  jobId: string,
): string {
  return `/backend/workspaces/${encodeURIComponent(
    workspaceId,
  )}/analysis-jobs/${encodeURIComponent(
    jobId,
  )}`;
}

function normalizeDatasetIds(
  datasetIds: string[],
): string[] {
  return Array.from(
    new Set(
      datasetIds
        .map(
          (id) =>
            id.trim(),
        )
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

  if (
    normalized.length <
    2
  ) {
    throw new QueryApiError(
      "At least two datasets are required for combined analysis.",

      400,
    );
  }

  return normalized;
}

async function enqueueJob(
  path: string,

  body: unknown,
): Promise<AnalysisJobResponse> {
  return request<AnalysisJobResponse>(
    path,

    {
      method: "POST",

      body: JSON.stringify(
        body,
      ),
    },
  );
}

async function getJobStatus(
  workspaceId: string,

  jobId: string,
): Promise<AnalysisJobStatus> {
  return request<AnalysisJobStatus>(
    buildJobStatusPath(
      workspaceId,

      jobId,
    ),
  );
}

async function waitForAnalysisJob<T>(
  workspaceId: string,

  jobId: string,
): Promise<T> {
  const startedAt =
    Date.now();

  while (
    Date.now() -
      startedAt <
    JOB_MAX_WAIT_MS
  ) {
    const status =
      await getJobStatus(
        workspaceId,

        jobId,
      );

    if (
      status.status ===
      "completed"
    ) {
      return status.result as T;
    }

    if (
      status.status ===
      "failed"
    ) {
      throw new QueryApiError(
        status.failedReason ||
          "The analysis job failed.",

        500,
      );
    }

    await sleep(
      JOB_POLL_INTERVAL_MS,
    );
  }

  throw new QueryApiError(
    "The analysis is taking longer than expected. Please check query history and try again.",

    408,
  );
}

async function runBackgroundJob<T>(
  workspaceId: string,

  enqueuePath: string,

  body: unknown,
): Promise<T> {
  const queued =
    await enqueueJob(
      enqueuePath,

      body,
    );

  if (
    !queued.jobId
  ) {
    throw new QueryApiError(
      "The analysis job could not be created.",

      500,
    );
  }

  return waitForAnalysisJob<T>(
    workspaceId,

    queued.jobId,
  );
}

export const queryApi = {
  async generateSql(
    options: QueryRequestOptions,

    question: string,
  ): Promise<GenerateSqlResult> {
    const trimmedQuestion =
      question.trim();

    if (!trimmedQuestion) {
      throw new QueryApiError(
        "Enter a natural-language question first.",

        400,
      );
    }

    return request<GenerateSqlResult>(
      `${buildDatasetPath(
        options,
      )}/generate-sql`,

      {
        method: "POST",

        body: JSON.stringify({
          question:
            trimmedQuestion,

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
    const trimmedSql =
      sql.trim();

    if (!trimmedSql) {
      throw new QueryApiError(
        "SQL query is required.",

        400,
      );
    }

    return request<QueryResult>(
      `${buildDatasetPath(
        options,
      )}/query/fast`,

      {
        method: "POST",

        body: JSON.stringify({
          sql:
            trimmedSql,

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

  /*
   * Optimized single-dataset AI analysis.
   *
   * This intentionally uses the new fast endpoint:
   *
   * question
   * → SQL generation
   * → fast SQL execution
   * → one bounded AI enrichment call
   */
  async queryFromQuestion(
    options: QueryRequestOptions,

    question: string,
  ): Promise<NaturalLanguageQueryResult> {
    const trimmedQuestion =
      question.trim();

    if (!trimmedQuestion) {
      throw new QueryApiError(
        "Enter a natural-language question first.",

        400,
      );
    }

    return request<NaturalLanguageQueryResult>(
      `${buildDatasetPath(
        options,
      )}/query-from-question/fast`,

      {
        method: "POST",

        body: JSON.stringify({
          question:
            trimmedQuestion,

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

    const trimmedQuestion =
      question.trim();

    if (!trimmedQuestion) {
      throw new QueryApiError(
        "Enter a natural-language question first.",

        400,
      );
    }

    return request<GenerateSqlResult>(
      `${buildMultiDatasetPath(
        options.workspaceId,
      )}/generate-sql`,

      {
        method: "POST",

        body: JSON.stringify({
          datasetIds,

          question:
            trimmedQuestion,

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

    const trimmedSql =
      sql.trim();

    if (!trimmedSql) {
      throw new QueryApiError(
        "SQL query is required.",

        400,
      );
    }

    return runBackgroundJob<QueryResult>(
      options.workspaceId,

      `${buildMultiDatasetPath(
        options.workspaceId,
      )}/query/jobs`,

      {
        datasetIds,

        sql:
          trimmedSql,

        question:
          question?.trim() ||
          null,

        conversationId:
          options.conversationId ??
          null,
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

    const trimmedQuestion =
      question.trim();

    if (!trimmedQuestion) {
      throw new QueryApiError(
        "Enter a natural-language question first.",

        400,
      );
    }

    return runBackgroundJob<NaturalLanguageQueryResult>(
      options.workspaceId,

      `${buildMultiDatasetPath(
        options.workspaceId,
      )}/query-from-question/jobs`,

      {
        datasetIds,

        question:
          trimmedQuestion,

        conversationId:
          options.conversationId ??
          null,
      },
    );
  },

  async getAnalysisJobStatus(
    workspaceId: string,

    jobId: string,
  ): Promise<AnalysisJobStatus> {
    return getJobStatus(
      workspaceId,

      jobId,
    );
  },
};