"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor, Position } from "monaco-editor";
import { Parser } from "node-sql-parser";
import {
  ApiError,
  type Dataset,
  type DatasetContext,
  datasetApi,
} from "../../../lib/api";
import { getAccessToken } from "../../../lib/auth";
import {
  QueryApiError,
  type QueryResult,
  queryApi,
} from "../../../lib/query-api";
import ResultVisualization from "../../../components/query/ResultVisualization";
import SqlExplanation from "../../../components/query/SqlExplanation";

type Theme = "dark" | "light";

type SqlValidationState =
  | "idle"
  | "checking"
  | "valid"
  | "invalid";

interface WorkspaceMembershipResponse {
  role: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface SqlProblem {
  message: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  severity: "error" | "warning";
}

interface SqlValidationResponse {
  valid: boolean;
  message: string | null;
  line: number | null;
  column: number | null;
}

interface SqlValidationTarget {
  editorValue: string;
  startOffset: number;
}

interface ParserErrorLike {
  message?: unknown;
  line?: unknown;
  column?: unknown;
  offset?: unknown;
  location?: {
    start?: {
      line?: unknown;
      column?: unknown;
      offset?: unknown;
    };
    end?: {
      line?: unknown;
      column?: unknown;
      offset?: unknown;
    };
  };
  token?: {
    loc?: {
      start?: {
        line?: unknown;
        column?: unknown;
        offset?: unknown;
      };
      end?: {
        line?: unknown;
        column?: unknown;
        offset?: unknown;
      };
    };
  };
}

const DEFAULT_SQL = `SELECT *
FROM dataset
LIMIT 100`;

const DEFAULT_QUESTION =
  "Show me a summary of this dataset";

const SQL_KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP BY",
  "ORDER BY",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "AS",
  "DISTINCT",
  "ASC",
  "DESC",
  "AND",
  "OR",
  "NOT",
  "IN",
  "IS",
  "NULL",
  "LIKE",
  "BETWEEN",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "UNION",
  "ALL",
  "WITH",
  "EXISTS",
  "ON",
  "JOIN",
  "INNER",
  "LEFT",
  "RIGHT",
  "FULL",
  "CROSS",
  "OUTER",
  "USING",
  "NATURAL",
  "LATERAL",
  "WINDOW",
  "OVER",
  "PARTITION BY",
  "ROWS",
  "RANGE",
  "GROUPS",
  "FILTER",
  "QUALIFY",
  "RECURSIVE",
  "REPLACE",
  "INSERT",
  "INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE",
  "MERGE",
  "UPSERT",
  "CREATE",
  "TABLE",
  "VIEW",
  "INDEX",
  "SCHEMA",
  "DATABASE",
  "ALTER",
  "DROP",
  "TRUNCATE",
  "RENAME",
  "GRANT",
  "REVOKE",
  "BEGIN",
  "COMMIT",
  "ROLLBACK",
  "TRANSACTION",
  "EXPLAIN",
  "ANALYZE",
  "DESCRIBE",
  "SHOW",
  "PRAGMA",
  "CAST",
  "TRY_CAST",
];

const SQL_FUNCTIONS = [
  "AVG",
  "SUM",
  "COUNT",
  "MIN",
  "MAX",
  "ROUND",
  "COALESCE",
  "NULLIF",
  "LOWER",
  "UPPER",
  "TRIM",
  "LENGTH",
  "SUBSTR",
  "SUBSTRING",
  "CONCAT",
  "ABS",
  "CEIL",
  "FLOOR",
  "POWER",
  "DATE",
  "EXTRACT",
  "YEAR",
  "MONTH",
  "DAY",
  "ROW_NUMBER",
  "RANK",
  "DENSE_RANK",
  "NTILE",
  "LAG",
  "LEAD",
  "FIRST_VALUE",
  "LAST_VALUE",
  "NTH_VALUE",
  "MEDIAN",
  "MODE",
  "STDDEV",
  "STDDEV_POP",
  "STDDEV_SAMP",
  "VARIANCE",
  "VAR_POP",
  "VAR_SAMP",
  "PERCENTILE_CONT",
  "PERCENTILE_DISC",
];

/*
 * BigQuery-style syntax parser.
 *
 * Syntax validation is client-side and runs immediately
 * on every editor value change.
 *
 * Semantic validation remains backend-owned because the
 * backend has the real uploaded dataset and DuckDB engine.
 */
const sqlParser = new Parser();

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.5 14.7A8.5 8.5 0 0 1 9.3 3.5 8.5 8.5 0 1 0 20.5 14.7Z" />
    </svg>
  );
}

function PlayIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function SparkleIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3-1.2 5.1L6 9.5l4.8 1.4L12 16l1.2-5.1L18 9.5l-4.8-1.4L12 3Z" />
      <path d="m19 15-.6 2.4L16 18l2.4.6L19 21l.6-2.4L22 18l-2.4-.6Z" />
    </svg>
  );
}

// ==========================================
// HELPERS
// ==========================================

function createConversationId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function getLineColumnFromIndex(
  value: string,
  index: number,
) {
  const safeIndex = Math.max(
    0,
    Math.min(index, value.length),
  );

  const before = value.slice(0, safeIndex);
  const lines = before.split("\n");

  return {
    line: lines.length,
    column:
      (lines[lines.length - 1]?.length ?? 0) + 1,
  };
}

function getIndexFromLineColumn(
  value: string,
  line: number,
  column: number,
) {
  const targetLine = Math.max(
    Number.isFinite(line) ? line : 1,
    1,
  );

  const targetColumn = Math.max(
    Number.isFinite(column)
      ? column
      : 1,
    1,
  );

  let currentLine = 1;
  let offset = 0;

  while (
    currentLine < targetLine &&
    offset < value.length
  ) {
    const newlineIndex =
      value.indexOf("\n", offset);

    if (newlineIndex === -1) {
      return value.length;
    }

    offset = newlineIndex + 1;
    currentLine += 1;
  }

  return Math.min(
    offset + targetColumn - 1,
    value.length,
  );
}

function createSqlProblem(
  sql: string,
  index: number,
  message: string,
  severity: SqlProblem["severity"] = "error",
  length = 1,
): SqlProblem {
  const position =
    getLineColumnFromIndex(
      sql,
      index,
    );

  return {
    message,
    line: position.line,
    column: position.column,
    endLine: position.line,
    endColumn:
      position.column +
      Math.max(length, 1),
    severity,
  };
}

function mapProblemToEditor(
  problem: SqlProblem,
  target: SqlValidationTarget,
): SqlProblem {
  if (target.startOffset === 0) {
    return problem;
  }

  const selectedValue =
    target.editorValue.slice(
      target.startOffset,
    );

  const relativeOffset =
    getIndexFromLineColumn(
      selectedValue,
      problem.line,
      problem.column,
    );

  const absoluteOffset =
    Math.max(
      0,
      Math.min(
        target.startOffset +
          relativeOffset,
        target.editorValue.length,
      ),
    );

  const position =
    getLineColumnFromIndex(
      target.editorValue,
      absoluteOffset,
    );

  const problemLength =
    Math.max(
      problem.endColumn -
        problem.column,
      1,
    );

  return {
    ...problem,
    line: position.line,
    column: position.column,
    endLine: position.line,
    endColumn:
      position.column +
      problemLength,
  };
}

function getParserPosition(
  error: ParserErrorLike,
): {
  line: number | null;
  column: number | null;
  offset: number | null;
} {
  const locationStart =
    error.location?.start;

  const tokenStart =
    error.token?.loc?.start;

  const lineCandidates: unknown[] = [
    locationStart?.line,
    tokenStart?.line,
    error.line,
  ];

  const columnCandidates: unknown[] = [
    locationStart?.column,
    tokenStart?.column,
    error.column,
  ];

  const offsetCandidates: unknown[] = [
    locationStart?.offset,
    tokenStart?.offset,
    error.offset,
  ];

  const lineValue =
    lineCandidates.find(
      (
        value,
      ): value is number =>
        typeof value ===
          "number" &&
        Number.isFinite(value) &&
        value > 0,
    );

  const columnValue =
    columnCandidates.find(
      (
        value,
      ): value is number =>
        typeof value ===
          "number" &&
        Number.isFinite(value) &&
        value > 0,
    );

  const offsetValue =
    offsetCandidates.find(
      (
        value,
      ): value is number =>
        typeof value ===
          "number" &&
        Number.isFinite(value) &&
        value >= 0,
    );

  return {
    line:
      lineValue ??
      null,

    column:
      columnValue ??
      null,

    offset:
      offsetValue ??
      null,
  };
}

function extractPositionFromMessage(
  message: string,
): {
  line: number | null;
  column: number | null;
} {
  const lineColumnPatterns = [
    /line\s+(\d+)\s*(?:,|at)?\s*(?:col(?:umn)?\.?|column)\s+(\d+)/i,
    /line\s+(\d+).*?column\s+(\d+)/i,
    /\((\d+)\s*[,;]\s*(\d+)\)/,
  ];

  for (
    const pattern of lineColumnPatterns
  ) {
    const match =
      message.match(pattern);

    if (!match) continue;

    const line =
      Number(match[1]);

    const column =
      Number(match[2]);

    if (
      Number.isFinite(line) &&
      Number.isFinite(column)
    ) {
      return {
        line,
        column,
      };
    }
  }

  return {
    line: null,
    column: null,
  };
}

function normalizeParserError(
  error: unknown,
): {
  message: string;
  line: number | null;
  column: number | null;
  offset: number | null;
} {
  const parserError =
    error as ParserErrorLike;

  const rawMessage =
    typeof parserError.message ===
    "string"
      ? parserError.message
      : error instanceof Error
        ? error.message
        : "SQL syntax error.";

  const message =
    rawMessage.trim() ||
    "SQL syntax error.";

  const parserPosition =
    getParserPosition(
      parserError,
    );

  if (
    parserPosition.line !==
      null &&
    parserPosition.column !==
      null
  ) {
    return {
      message,
      line: parserPosition.line,
      column:
        parserPosition.column,
      offset:
        parserPosition.offset,
    };
  }

  const textPosition =
    extractPositionFromMessage(
      message,
    );

  return {
    message,
    line: textPosition.line,
    column: textPosition.column,
    offset: null,
  };
}

/*
 * Real client-side syntax validation.
 *
 * IMPORTANT:
 * This intentionally does not try to decide whether a table
 * or column exists. That is the backend semantic validator's job.
 */
function validateSqlSyntax(
  value: string,
): SqlProblem[] {
  const sql = value.trim();

  if (!sql) {
    return [
      createSqlProblem(
        value,
        0,
        "SQL query is empty.",
        "error",
        1,
      ),
    ];
  }

  if (value.length > 50000) {
    return [
      createSqlProblem(
        value,
        50000,
        "SQL query exceeds the 50,000 character editor limit.",
        "error",
        1,
      ),
    ];
  }

  const onlySemicolons =
    /^[;\s]*$/.test(value);

  if (onlySemicolons) {
    return [
      createSqlProblem(
        value,
        0,
        "Enter a SQL statement.",
        "error",
        Math.max(value.trim().length, 1),
      ),
    ];
  }

  try {
    /*
     * BigQuery grammar is used deliberately for the
     * user-facing syntax layer.
     *
     * The actual dataset engine remains DuckDB on backend.
     */
    sqlParser.astify(sql, {
      database: "BigQuery",
      parseOptions: {
        includeLocations: true,
      },
    });

    return [];
  } catch (error) {
    const normalized =
      normalizeParserError(error);

    let index = 0;

    if (
      normalized.offset !== null
    ) {
      index = Math.max(
        0,
        Math.min(
          normalized.offset,
          value.length,
        ),
      );
    } else if (
      normalized.line !== null &&
      normalized.column !== null
    ) {
      index =
        getIndexFromLineColumn(
          value,
          normalized.line,
          normalized.column,
        );
    } else {
      /*
       * Parser errors that do not expose a location are
       * most commonly end-of-input errors.
       */
      index = Math.max(
        value.length - 1,
        0,
      );
    }

    const remainingLength =
      Math.max(
        value.length - index,
        1,
      );

    return [
      createSqlProblem(
        value,
        index,
        normalized.message,
        "error",
        Math.min(
          remainingLength,
          200,
        ),
      ),
    ];
  }
}

// ==========================================
// PAGE COMPONENT
// ==========================================

export default function QueryWorkspacePage() {
  const [theme, setTheme] =
    useState<Theme>("dark");

  const [mounted, setMounted] =
    useState(false);

  const [activeTab, setActiveTab] =
    useState<
      "result" | "explanation" | "visualization"
    >("result");

  const [datasetId, setDatasetId] =
    useState("");

  const [workspace, setWorkspace] =
    useState<Workspace | null>(null);

  const [datasets, setDatasets] =
    useState<Dataset[]>([]);

  const [dataset, setDataset] =
    useState<Dataset | null>(null);

  const [context, setContext] =
    useState<DatasetContext | null>(null);

  const [conversationId, setConversationId] =
    useState<string>("");

  const [question, setQuestion] =
    useState(DEFAULT_QUESTION);

  const [sql, setSql] =
    useState(DEFAULT_SQL);

  const [result, setResult] =
    useState<QueryResult | null>(null);

  // ==========================================
  // SQL VALIDATION / EDITOR INTELLIGENCE
  // ==========================================

  const sqlEditorRef =
    useRef<editor.IStandaloneCodeEditor | null>(
      null,
    );

  const monacoRef =
    useRef<
      typeof import("monaco-editor") | null
    >(null);

  const validationTimerRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const validationAbortRef =
    useRef<AbortController | null>(
      null,
    );

  /*
   * Each editor value gets a new validation
   * sequence. Older results cannot win races.
   */
  const validationRequestRef =
    useRef(0);

  /*
   * onChange/onMount may be attached to an editor
   * instance created during an older render.
   *
   * Refs keep the current validation context alive.
   */
  const scheduleSqlValidationRef =
    useRef<(value: string) => void>(
      () => {},
    );

  const workspaceValidationRef =
    useRef<Workspace | null>(null);

  const datasetIdValidationRef =
    useRef("");

  const queryReadyValidationRef =
    useRef(false);

  const [sqlProblems, setSqlProblems] =
    useState<SqlProblem[]>([]);

  const [
    sqlValidationPending,
    setSqlValidationPending,
  ] = useState(false);

  const [
    sqlValidationState,
    setSqlValidationState,
  ] =
    useState<SqlValidationState>("idle");

  const [loadingWorkspace, setLoadingWorkspace] =
    useState(true);

  const [loadingDatasets, setLoadingDatasets] =
    useState(false);

  const [loadingContext, setLoadingContext] =
    useState(false);

  const [generatingSql, setGeneratingSql] =
    useState(false);

  const [executingSql, setExecutingSql] =
    useState(false);

  const [runningQuestion, setRunningQuestion] =
    useState(false);

  const [error, setError] =
    useState("");

  const [info, setInfo] =
    useState("");

  const columnNamesRef =
    useRef<string[]>([]);

  const queryReadyRef =
    useRef(false);

  const executeSqlRef =
    useRef<() => Promise<void>>(
      async () => {},
    );

  // ==========================================
  // THEME
  // ==========================================

  useEffect(() => {
    setMounted(true);

    const saved =
      window.localStorage.getItem(
        "ai-data-analyst-theme",
      ) as Theme | null;

    if (
      saved === "light" ||
      saved === "dark"
    ) {
      setTheme(saved);
    } else {
      setTheme("dark");
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    window.localStorage.setItem(
      "ai-data-analyst-theme",
      theme,
    );

    if (theme === "dark") {
      document.documentElement.classList.add(
        "dark",
      );
    } else {
      document.documentElement.classList.remove(
        "dark",
      );
    }
  }, [theme, mounted]);

  const colors = useMemo(
    () =>
      theme === "dark"
        ? {
            bg: "#050505",
            text: "#ffffff",
            muted: "#888888",
            mutedStrong: "#a1a1aa",
            border:
              "rgba(255,255,255,0.08)",
            borderStrong:
              "rgba(255,255,255,0.15)",
            card: "#0a0a0a",
            surface: "#121212",
            accent: "#818cf8",
            codeBg: "#000000",
          }
        : {
            bg: "#f8fafc",
            text: "#050505",
            muted: "#666666",
            mutedStrong: "#404040",
            border:
              "rgba(15,23,42,0.08)",
            borderStrong:
              "rgba(15,23,42,0.15)",
            card: "#ffffff",
            surface: "#f1f5f9",
            accent: "#4f46e5",
            codeBg: "#ffffff",
          },
    [theme],
  );

  const themeStyle = {
    "--bg": colors.bg,
    "--text": colors.text,
    "--muted": colors.muted,
    "--muted-strong":
      colors.mutedStrong,
    "--border": colors.border,
    "--border-strong":
      colors.borderStrong,
    "--card": colors.card,
    "--surface": colors.surface,
    "--accent": colors.accent,
    "--code-bg": colors.codeBg,
  } as CSSProperties;

  // ==========================================
  // CONVERSATION
  // ==========================================

  useEffect(() => {
    if (!mounted) return;

    setConversationId(
      createConversationId(),
    );
  }, [mounted]);

  function resetConversation() {
    setConversationId(
      createConversationId(),
    );
  }

  // ==========================================
  // URL PARAMS
  // ==========================================

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search,
      );

    const id =
      params.get("datasetId") ?? "";

    setDatasetId(id);
    datasetIdValidationRef.current =
      id;
  }, []);

  // ==========================================
  // LOAD WORKSPACE
  // ==========================================

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      const token = getAccessToken();

      if (!token) {
        if (active) {
          setLoadingWorkspace(false);
          setError(
            "Your session is missing. Please log in again.",
          );
        }

        return;
      }

      try {
        setLoadingWorkspace(true);
        setError("");

        const response = await fetch(
          "/backend/workspaces",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const data: unknown =
          await response.json();

        if (!response.ok) {
          const message =
            typeof data ===
              "object" &&
            data !== null &&
            "message" in data &&
            typeof (
              data as {
                message?: unknown;
              }
            ).message === "string"
              ? (
                  data as {
                    message: string;
                  }
                ).message
              : "Unable to load workspace.";

          throw new ApiError(
            message,
            response.status,
          );
        }

        if (!Array.isArray(data)) {
          throw new Error(
            "Invalid workspace response.",
          );
        }

        const memberships =
          data as WorkspaceMembershipResponse[];

        const firstWorkspace =
          memberships[0]?.workspace;

        if (!firstWorkspace) {
          throw new Error(
            "No workspace is available for this account.",
          );
        }

        if (active) {
          workspaceValidationRef.current =
            firstWorkspace;

          setWorkspace(
            firstWorkspace,
          );
        }
      } catch (err) {
        if (!active) return;

        if (
          err instanceof ApiError &&
          (err.status === 401 ||
            err.status === 403)
        ) {
          setError(
            "Your session is no longer valid. Please log in again.",
          );
        } else if (
          err instanceof Error
        ) {
          setError(err.message);
        } else {
          setError(
            "Unable to load workspace.",
          );
        }
      } finally {
        if (active) {
          setLoadingWorkspace(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      active = false;
    };
  }, []);

  // ==========================================
  // LOAD DATASETS
  // ==========================================

  useEffect(() => {
    if (!workspace) return;

    const workspaceId =
      workspace.id;

    workspaceValidationRef.current =
      workspace;

    let active = true;

    async function loadDatasets() {
      const token = getAccessToken();

      if (!token) return;

      try {
        setLoadingDatasets(true);
        setError("");
        setInfo("");

        const datasetList =
          await datasetApi.list(
            token,
            workspaceId,
          );

        if (!active) return;

        setDatasets(datasetList);

        const params =
          new URLSearchParams(
            window.location.search,
          );

        const requestedDatasetId =
          params.get("datasetId");

        const requestedDataset =
          requestedDatasetId
            ? datasetList.find(
                (item) =>
                  item.id ===
                  requestedDatasetId,
              ) ?? null
            : null;

        const firstReadyDataset =
          datasetList.find(
            (item) =>
              item.status === "ready",
          ) ?? null;

        const fallbackDataset =
          datasetList[0] ?? null;

        const selectedDataset:
          | Dataset
          | null =
          requestedDataset ??
          firstReadyDataset ??
          fallbackDataset;

        if (!selectedDataset) {
          setDatasetId("");
          datasetIdValidationRef.current =
            "";

          setDataset(null);
          setContext(null);
          setResult(null);
          setSqlProblems([]);
          setSqlValidationPending(false);
          setSqlValidationState("idle");

          queryReadyValidationRef.current =
            false;

          resetConversation();

          window.history.replaceState(
            null,
            "",
            "/dashboard/query",
          );

          return;
        }

        setDatasetId(
          selectedDataset.id,
        );

        datasetIdValidationRef.current =
          selectedDataset.id;

        const nextUrl =
          `/dashboard/query?datasetId=${encodeURIComponent(
            selectedDataset.id,
          )}`;

        if (
          window.location.pathname +
            window.location.search !==
          nextUrl
        ) {
          window.history.replaceState(
            null,
            "",
            nextUrl,
          );
        }
      } catch (err) {
        if (!active) return;

        if (
          err instanceof ApiError
        ) {
          if (
            err.status === 401 ||
            err.status === 403
          ) {
            setError(
              "You are not authorized to access your datasets.",
            );
          } else {
            setError(err.message);
          }
        } else if (
          err instanceof Error
        ) {
          setError(err.message);
        } else {
          setError(
            "Unable to load datasets.",
          );
        }
      } finally {
        if (active) {
          setLoadingDatasets(false);
        }
      }
    }

    void loadDatasets();

    return () => {
      active = false;
    };
  }, [workspace]);

  // ==========================================
  // LOAD DATASET CONTEXT
  // ==========================================

  useEffect(() => {
    if (
      !workspace ||
      !datasetId ||
      datasets.length === 0
    ) {
      return;
    }

    const selectedDataset:
      | Dataset
      | null =
      datasets.find(
        (item) =>
          item.id === datasetId,
      ) ?? null;

    if (!selectedDataset) return;

    const workspaceId =
      workspace.id;

    const currentDatasetId =
      datasetId;

    const selectedDatasetStatus =
      selectedDataset.status;

    workspaceValidationRef.current =
      workspace;

    datasetIdValidationRef.current =
      currentDatasetId;

    let active = true;

    async function loadDatasetContext() {
      const token = getAccessToken();

      if (!token) return;

      try {
        setLoadingContext(true);
        setError("");
        setInfo("");

        setDataset(
          selectedDataset,
        );

        const datasetContext =
          await datasetApi.context(
            token,
            workspaceId,
            currentDatasetId,
          );

        if (!active) return;

        setContext(
          datasetContext,
        );

        if (
          selectedDatasetStatus !==
          "ready"
        ) {
          setInfo(
            `Dataset status: ${selectedDatasetStatus}. Querying is available after ingestion is ready.`,
          );
        }
      } catch (err) {
        if (!active) return;

        setContext(null);

        if (
          err instanceof ApiError
        ) {
          if (
            err.status === 401 ||
            err.status === 403
          ) {
            setError(
              "You are not authorized to access this dataset.",
            );
          } else {
            setError(err.message);
          }
        } else if (
          err instanceof Error
        ) {
          setError(err.message);
        } else {
          setError(
            "Unable to load dataset context.",
          );
        }
      } finally {
        if (active) {
          setLoadingContext(false);
        }
      }
    }

    void loadDatasetContext();

    return () => {
      active = false;
    };
  }, [
    workspace,
    datasetId,
    datasets,
  ]);

  // ==========================================
  // COLUMN DATA
  // ==========================================

  const columnNames = useMemo(() => {
    return (
      context?.columns?.map(
        (column) =>
          column.name,
      ) ?? []
    );
  }, [context]);

  const suggestedQuestions =
    useMemo(() => {
      const suggestions = [
        "Show me a summary of this dataset",
        "Show the top 5 rows by the most useful numeric metric",
        "Show the count of rows by the most common category",
        "Show the key trends in this dataset",
      ];

      const [
        firstColumn,
        secondColumn,
      ] = columnNames;

      if (firstColumn) {
        suggestions[1] =
          `Show the top 5 records by ${firstColumn}`;
      }

      if (
        firstColumn &&
        secondColumn
      ) {
        suggestions[2] =
          `Show ${firstColumn} by ${secondColumn}`;
      }

      return suggestions;
    }, [columnNames]);

  const followUpQuestions =
    useMemo(() => {
      if (!result) {
        return [];
      }

      return (
        result.followUpQuestions
          ?.filter(
            (question) =>
              typeof question ===
                "string" &&
              question.trim()
                .length > 0,
          )
          .map((question) =>
            question.trim(),
          )
          .slice(0, 3) ?? []
      );
    }, [result]);

  useEffect(() => {
    columnNamesRef.current =
      columnNames;
  }, [columnNames]);

  // ==========================================
  // DATASET CHANGE
  // ==========================================

  function handleDatasetChange(
    nextDatasetId: string,
  ) {
    setDatasetId(
      nextDatasetId,
    );

    datasetIdValidationRef.current =
      nextDatasetId;

    queryReadyValidationRef.current =
      false;

    setDataset(null);
    setContext(null);
    setResult(null);
    setError("");
    setInfo("");
    setQuestion(
      DEFAULT_QUESTION,
    );
    setSql(DEFAULT_SQL);
    setSqlProblems([]);
    setSqlValidationPending(false);
    setSqlValidationState("idle");

    resetConversation();

    validationRequestRef.current +=
      1;

    validationAbortRef.current?.abort();
    validationAbortRef.current =
      null;

    if (
      validationTimerRef.current
    ) {
      clearTimeout(
        validationTimerRef.current,
      );

      validationTimerRef.current =
        null;
    }

    const editorInstance =
      sqlEditorRef.current;

    const monaco =
      monacoRef.current;

    const model =
      editorInstance?.getModel();

    if (
      model &&
      monaco
    ) {
      monaco.editor.setModelMarkers(
        model,
        "ai-data-analyst-sql",
        [],
      );
    }

    const nextUrl =
      nextDatasetId
        ? `/dashboard/query?datasetId=${encodeURIComponent(
            nextDatasetId,
          )}`
        : "/dashboard/query";

    window.history.replaceState(
      null,
      "",
      nextUrl,
    );
  }

  const workspaceReady =
    !loadingWorkspace &&
    Boolean(workspace);

  const datasetReady =
    workspaceReady &&
    !loadingDatasets &&
    !loadingContext &&
    Boolean(dataset);

  const queryReady =
    dataset?.status === "ready";

  useEffect(() => {
    queryReadyRef.current =
      queryReady;

    queryReadyValidationRef.current =
      queryReady;
  }, [queryReady]);

  useEffect(() => {
    workspaceValidationRef.current =
      workspace;
  }, [workspace]);

  useEffect(() => {
    datasetIdValidationRef.current =
      datasetId;
  }, [datasetId]);

  // ==========================================
  // SQL MARKERS
  // ==========================================

  function applySqlMarkers(
    problems: SqlProblem[],
  ) {
    const editorInstance =
      sqlEditorRef.current;

    const monaco =
      monacoRef.current;

    if (
      !editorInstance ||
      !monaco
    ) {
      return;
    }

    const model =
      editorInstance.getModel();

    if (!model) {
      return;
    }

    const markers =
      problems.map((problem) => ({
        startLineNumber:
          Math.max(problem.line, 1),

        startColumn:
          Math.max(problem.column, 1),

        endLineNumber:
          Math.max(
            problem.endLine,
            problem.line,
            1,
          ),

        endColumn: Math.max(
          problem.endColumn,
          problem.column + 1,
        ),

        message:
          problem.message,

        severity:
          problem.severity ===
          "error"
            ? monaco.MarkerSeverity
                .Error
            : monaco.MarkerSeverity
                .Warning,

        source:
          "AI Data Analyst SQL",
      }));

    monaco.editor.setModelMarkers(
      model,
      "ai-data-analyst-sql",
      markers,
    );
  }

  // ==========================================
  // BACKEND SEMANTIC VALIDATION
  // ==========================================

  async function validateSqlWithBackend(
    value: string,
    requestId: number,
    target: SqlValidationTarget = {
      editorValue: value,
      startOffset: 0,
    },
  ): Promise<boolean> {
    if (
      requestId !==
      validationRequestRef.current
    ) {
      return false;
    }

    /*
     * Syntax parser is authoritative for syntax.
     * Backend is only reached after syntax passes.
     */
    const syntaxProblems =
      validateSqlSyntax(value);

    const mappedSyntaxProblems =
      syntaxProblems.map(
        (problem) =>
          mapProblemToEditor(
            problem,
            target,
          ),
      );

    if (
      mappedSyntaxProblems.length >
      0
    ) {
      setSqlProblems(
        mappedSyntaxProblems,
      );

      applySqlMarkers(
        mappedSyntaxProblems,
      );

      setSqlValidationPending(
        false,
      );

      setSqlValidationState(
        "invalid",
      );

      return false;
    }

    const currentWorkspace =
      workspaceValidationRef.current;

    const currentDatasetId =
      datasetIdValidationRef.current;

    const currentQueryReady =
      queryReadyValidationRef.current;

    if (
      !currentWorkspace ||
      !currentDatasetId ||
      !currentQueryReady ||
      !value.trim()
    ) {
      setSqlValidationPending(
        false,
      );

      setSqlValidationState(
        "idle",
      );

      return false;
    }

    const token =
      getAccessToken();

    if (!token) {
      const problem =
        createSqlProblem(
          target.editorValue,
          target.startOffset,
          "Your session is missing. Please log in again.",
        );

      if (
        requestId ===
        validationRequestRef.current
      ) {
        setSqlProblems([
          problem,
        ]);

        applySqlMarkers([
          problem,
        ]);

        setSqlValidationPending(
          false,
        );

        setSqlValidationState(
          "invalid",
        );
      }

      return false;
    }

    if (
      requestId !==
      validationRequestRef.current
    ) {
      return false;
    }

    validationAbortRef.current?.abort();

    const abortController =
      new AbortController();

    validationAbortRef.current =
      abortController;

    try {
      /*
       * This endpoint performs the backend dry-run
       * equivalent against the actual Parquet dataset
       * through DuckDB without executing the query.
       */
      const response =
        await fetch(
          `/backend/workspaces/${encodeURIComponent(
            currentWorkspace.id,
          )}/datasets/${encodeURIComponent(
            currentDatasetId,
          )}/validate-sql`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              sql: value,
            }),
            signal:
              abortController.signal,
          },
        );

      const data: unknown =
        await response
          .json()
          .catch(() => null);

      if (
        requestId !==
        validationRequestRef.current
      ) {
        return false;
      }

      const responseObject =
        typeof data ===
            "object" &&
          data !== null
          ? (data as {
              valid?: unknown;
              message?: unknown;
              line?: unknown;
              column?: unknown;
            })
          : null;

      if (!response.ok) {
        const message =
          typeof responseObject
            ?.message === "string"
            ? responseObject.message
            : "Unable to validate SQL.";

        const backendLine =
          typeof responseObject
            ?.line === "number" &&
          responseObject.line > 0
            ? responseObject.line
            : null;

        const backendColumn =
          typeof responseObject
            ?.column === "number" &&
          responseObject.column > 0
            ? responseObject.column
            : null;

        const problem: SqlProblem =
          backendLine !== null &&
          backendColumn !== null
            ? mapProblemToEditor(
                {
                  message,
                  line: backendLine,
                  column:
                    backendColumn,
                  endLine:
                    backendLine,
                  endColumn:
                    backendColumn +
                    1,
                  severity: "error",
                },
                target,
              )
            : mapProblemToEditor(
                createSqlProblem(
                  value,
                  0,
                  message,
                ),
                target,
              );

        setSqlProblems([
          problem,
        ]);

        applySqlMarkers([
          problem,
        ]);

        setSqlValidationState(
          "invalid",
        );

        if (
          response.status === 401 ||
          response.status === 403
        ) {
          setError(
            "Your session is no longer valid. Please log in again.",
          );
        }

        return false;
      }

      /*
       * Never infer validity from a truthy value.
       * The API MUST explicitly say true.
       */
      if (
        responseObject?.valid ===
        true
      ) {
        setSqlProblems([]);
        applySqlMarkers([]);
        setSqlValidationState(
          "valid",
        );

        return true;
      }

      const line =
        typeof responseObject
          ?.line === "number" &&
        responseObject.line > 0
          ? responseObject.line
          : 1;

      const column =
        typeof responseObject
          ?.column === "number" &&
        responseObject.column > 0
          ? responseObject.column
          : 1;

      const message =
        typeof responseObject
          ?.message === "string" &&
        responseObject.message.trim()
          ? responseObject.message
          : "SQL semantic validation failed.";

      const problem =
        mapProblemToEditor(
          {
            message,
            line,
            column,
            endLine: line,
            endColumn:
              column + 1,
            severity: "error",
          },
          target,
        );

      setSqlProblems([
        problem,
      ]);

      applySqlMarkers([
        problem,
      ]);

      setSqlValidationState(
        "invalid",
      );

      return false;
    } catch (err) {
      if (
        err instanceof DOMException &&
        err.name === "AbortError"
      ) {
        return false;
      }

      if (
        requestId !==
        validationRequestRef.current
      ) {
        return false;
      }

      const message =
        err instanceof Error
          ? `SQL validation unavailable: ${err.message}`
          : "SQL validation unavailable.";

      const problem =
        createSqlProblem(
          target.editorValue,
          target.startOffset,
          message,
        );

      setSqlProblems([
        problem,
      ]);

      applySqlMarkers([
        problem,
      ]);

      setSqlValidationState(
        "invalid",
      );

      return false;
    } finally {
      if (
        requestId ===
          validationRequestRef.current &&
        validationAbortRef.current ===
          abortController
      ) {
        setSqlValidationPending(
          false,
        );

        validationAbortRef.current =
          null;
      }
    }
  }

  // ==========================================
  // LIVE VALIDATION
  // ==========================================

  function scheduleSqlValidation(
    value: string,
  ) {
    /*
     * Cancel previous debounce.
     */
    if (
      validationTimerRef.current
    ) {
      clearTimeout(
        validationTimerRef.current,
      );

      validationTimerRef.current =
        null;
    }

    /*
     * Cancel active semantic request.
     */
    validationAbortRef.current?.abort();
    validationAbortRef.current =
      null;

    /*
     * New value = new validation sequence.
     */
    const requestId =
      validationRequestRef.current +
      1;

    validationRequestRef.current =
      requestId;

    /*
     * 1. REAL CLIENT-SIDE PARSER
     *
     * This happens immediately on every keystroke.
     */
    const syntaxProblems =
      validateSqlSyntax(value);

    setSqlProblems(
      syntaxProblems,
    );

    applySqlMarkers(
      syntaxProblems,
    );

    /*
     * Syntax errors are immediately invalid.
     * No backend request is necessary.
     */
    if (
      syntaxProblems.some(
        (problem) =>
          problem.severity ===
          "error",
      )
    ) {
      setSqlValidationPending(
        false,
      );

      setSqlValidationState(
        "invalid",
      );

      return;
    }

    const currentWorkspace =
      workspaceValidationRef.current;

    const currentDatasetId =
      datasetIdValidationRef.current;

    const currentQueryReady =
      queryReadyValidationRef.current;

    /*
     * Syntax is valid even without a dataset.
     * Semantic checking waits for a real dataset.
     */
    if (
      !currentWorkspace ||
      !currentDatasetId ||
      !currentQueryReady ||
      !value.trim()
    ) {
      setSqlValidationPending(
        false,
      );

      setSqlValidationState(
        "idle",
      );

      return;
    }

    /*
     * 2. BACKEND SEMANTIC DRY-RUN
     *
     * Only after 500ms of no typing.
     */
    setSqlValidationPending(
      true,
    );

    setSqlValidationState(
      "checking",
    );

    validationTimerRef.current =
      setTimeout(() => {
        validationTimerRef.current =
          null;

        if (
          requestId !==
          validationRequestRef.current
        ) {
          return;
        }

        void validateSqlWithBackend(
          value,
          requestId,
          {
            editorValue: value,
            startOffset: 0,
          },
        );
      }, 500);
  }

  /*
   * IMPORTANT:
   * Monaco callbacks always use this current function.
   */
  scheduleSqlValidationRef.current =
    scheduleSqlValidation;

  /*
   * When workspace/dataset becomes available after
   * Monaco already mounted, validate the existing editor.
   */
  useEffect(() => {
    if (
      !queryReady ||
      !workspace ||
      !datasetId ||
      !sql.trim()
    ) {
      return;
    }

    scheduleSqlValidationRef.current(
      sql,
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    queryReady,
    workspace?.id,
    datasetId,
  ]);

  // ==========================================
  // SELECTED SQL / EXECUTION
  // ==========================================

  function getEditorExecutionTarget():
    | {
        sql: string;
        target: SqlValidationTarget;
      }
    | null {
    const editorInstance =
      sqlEditorRef.current;

    const model =
      editorInstance?.getModel();

    if (
      !editorInstance ||
      !model
    ) {
      const fallbackSql =
        sql.trim();

      if (!fallbackSql) {
        return null;
      }

      return {
        sql: fallbackSql,
        target: {
          editorValue: sql,
          startOffset: 0,
        },
      };
    }

    const fullEditorValue =
      model.getValue();

    const selection =
      editorInstance.getSelection();

    /*
     * BigQuery-like behavior:
     * if text is selected, only that text runs.
     */
    if (
      selection &&
      !selection.isEmpty()
    ) {
      const rawSelectedSql =
        model.getValueInRange(
          selection,
        );

      const selectedSql =
        rawSelectedSql.trim();

      if (!selectedSql) {
        return null;
      }

      const selectionStartOffset =
        model.getOffsetAt(
          selection.getStartPosition(),
        );

      const leadingTrimOffset =
        rawSelectedSql.search(
          /\S/,
        );

      const startOffset =
        selectionStartOffset +
        Math.max(
          leadingTrimOffset,
          0,
        );

      return {
        sql: selectedSql,
        target: {
          editorValue:
            fullEditorValue,
          startOffset,
        },
      };
    }

    /*
     * Nothing selected:
     * execute the complete editor value.
     */
    const fullSql =
      fullEditorValue.trim();

    if (!fullSql) {
      return null;
    }

    return {
      sql: fullSql,
      target: {
        editorValue:
          fullEditorValue,
        startOffset: 0,
      },
    };
  }

  // ==========================================
  // EDITOR LOGIC
  // ==========================================

  const handleSqlEditorMount: OnMount =
    (
      editorInstance,
      monaco,
    ) => {
      sqlEditorRef.current =
        editorInstance;

      monacoRef.current =
        monaco;

      const isDark =
        theme === "dark";

      monaco.editor.defineTheme(
        "aiDataAnalystTheme",
        {
          base: isDark
            ? "vs-dark"
            : "vs",

          inherit: true,

          rules: [
            {
              token: "keyword",
              foreground: "4f46e5",
            },
            {
              token: "string",
              foreground: isDark
                ? "CE9178"
                : "05503e",
            },
            {
              token: "number",
              foreground: isDark
                ? "B5CEA8"
                : "098658",
            },
          ],

          colors: {
            "editor.background":
              isDark
                ? "#0a0a0a"
                : "#ffffff",

            "editor.foreground":
              isDark
                ? "#ffffff"
                : "#050505",

            "editorLineNumber.foreground":
              isDark
                ? "#52525b"
                : "#94a3b8",

            "editorCursor.foreground":
              isDark
                ? "#ffffff"
                : "#000000",

            "editor.lineHighlightBackground":
              isDark
                ? "#ffffff08"
                : "#00000008",
          },
        },
      );

      monaco.editor.setTheme(
        "aiDataAnalystTheme",
      );

      const completionProvider =
        monaco.languages.registerCompletionItemProvider(
          "sql",
          {
            triggerCharacters: [
              ".",
              " ",
            ],

            provideCompletionItems: (
              model: editor.ITextModel,
              position: Position,
            ) => {
              const word =
                model.getWordUntilPosition(
                  position,
                );

              const range = {
                startLineNumber:
                  position.lineNumber,

                endLineNumber:
                  position.lineNumber,

                startColumn:
                  word.startColumn,

                endColumn:
                  word.endColumn,
              };

              const lineBeforeCursor =
                model
                  .getLineContent(
                    position.lineNumber,
                  )
                  .slice(
                    0,
                    position.column - 1,
                  );

              const dotCompletion =
                /(?:dataset|\w+)\.\w*$/i.test(
                  lineBeforeCursor,
                );

              const columnSuggestions =
                columnNamesRef.current.map(
                  (
                    columnName,
                  ) => ({
                    label:
                      columnName,

                    kind:
                      monaco.languages
                        .CompletionItemKind
                        .Field,

                    insertText:
                      columnName,

                    range,

                    detail:
                      "Dataset column",

                    sortText:
                      `1-${columnName}`,
                  }),
                );

              if (
                dotCompletion
              ) {
                return {
                  suggestions:
                    columnSuggestions,
                };
              }

              const keywordSuggestions =
                SQL_KEYWORDS.map(
                  (keyword) => ({
                    label: keyword,

                    kind:
                      monaco.languages
                        .CompletionItemKind
                        .Keyword,

                    insertText:
                      keyword,

                    range,

                    detail:
                      "SQL keyword",

                    sortText:
                      `2-${keyword}`,
                  }),
                );

              const functionSuggestions =
                SQL_FUNCTIONS.map(
                  (
                    functionName,
                  ) => ({
                    label: `${functionName}()`,

                    kind:
                      monaco.languages
                        .CompletionItemKind
                        .Function,

                    insertText:
                      `${functionName}($0)`,

                    insertTextRules:
                      monaco.languages
                        .CompletionItemInsertTextRule
                        .InsertAsSnippet,

                    range,

                    detail:
                      "SQL function",

                    sortText:
                      `3-${functionName}`,
                  }),
                );

              return {
                suggestions: [
                  ...columnSuggestions,
                  ...keywordSuggestions,
                  ...functionSuggestions,
                ],
              };
            },
          },
        );

      const runEditorQuery =
        () => {
          const execution =
            getEditorExecutionTarget();

          if (!execution) {
            return;
          }

          setSql(
            editorInstance.getValue(),
          );

          if (
            !queryReadyRef.current
          ) {
            return;
          }

          void executeSqlRef.current();
        };

      editorInstance.addCommand(
        monaco.KeyMod.Shift |
          monaco.KeyCode.Enter,
        runEditorQuery,
      );

      editorInstance.addCommand(
        monaco.KeyMod.CtrlCmd |
          monaco.KeyCode.Enter,
        runEditorQuery,
      );

      /*
       * Initial validation uses the CURRENT ref,
       * not the mount-time React closure.
       */
      const initialValue =
        editorInstance.getValue();

      const initialProblems =
        validateSqlSyntax(
          initialValue,
        );

      setSqlProblems(
        initialProblems,
      );

      applySqlMarkers(
        initialProblems,
      );

      if (
        initialProblems.some(
          (problem) =>
            problem.severity ===
            "error",
        )
      ) {
        setSqlValidationPending(
          false,
        );

        setSqlValidationState(
          "invalid",
        );
      } else if (
        queryReadyValidationRef.current &&
        workspaceValidationRef.current &&
        datasetIdValidationRef.current
      ) {
        scheduleSqlValidationRef.current(
          initialValue,
        );
      } else {
        setSqlValidationPending(
          false,
        );

        setSqlValidationState(
          "idle",
        );
      }

      return () => {
        completionProvider.dispose();

        if (
          validationTimerRef.current
        ) {
          clearTimeout(
            validationTimerRef.current,
          );

          validationTimerRef.current =
            null;
        }

        validationAbortRef.current?.abort();
        validationAbortRef.current =
          null;

        validationRequestRef.current +=
          1;

        const model =
          editorInstance.getModel();

        if (model) {
          monaco.editor.setModelMarkers(
            model,
            "ai-data-analyst-sql",
            [],
          );
        }

        if (
          sqlEditorRef.current ===
          editorInstance
        ) {
          sqlEditorRef.current =
            null;
        }

        if (
          monacoRef.current ===
          monaco
        ) {
          monacoRef.current =
            null;
        }
      };
    };

  useEffect(() => {
    return () => {
      if (
        validationTimerRef.current
      ) {
        clearTimeout(
          validationTimerRef.current,
        );
      }

      validationAbortRef.current?.abort();
      validationAbortRef.current =
        null;

      validationRequestRef.current +=
        1;
    };
  }, []);

  // ==========================================
  // ACTION HANDLERS
  // ==========================================

  async function handleGenerateSql() {
    if (
      !workspace ||
      !datasetId
    ) {
      setError(
        "Select a dataset before generating SQL.",
      );

      return;
    }

    if (!question.trim()) {
      setError(
        "Enter a natural-language question first.",
      );

      return;
    }

    try {
      setGeneratingSql(true);
      setError("");
      setInfo("");
      setActiveTab("result");

      const generated =
        await queryApi.generateSql(
          {
            workspaceId:
              workspace.id,

            datasetId,

            conversationId:
              conversationId ||
              null,
          },
          question.trim(),
        );

      setSql(
        generated.sql,
      );

      /*
       * Reuse the same parser -> debounce ->
       * backend semantic validation flow.
       */
      scheduleSqlValidationRef.current(
        generated.sql,
      );

      setInfo(
        "SQL generated. Checking syntax and dataset compatibility...",
      );
    } catch (err) {
      if (
        err instanceof QueryApiError
      ) {
        setError(err.message);
      } else if (
        err instanceof Error
      ) {
        setError(err.message);
      } else {
        setError(
          "SQL generation failed.",
        );
      }
    } finally {
      setGeneratingSql(false);
    }
  }

  async function handleExecuteSql() {
    if (
      !workspace ||
      !datasetId
    ) {
      setError(
        "Select a dataset before executing SQL.",
      );

      return;
    }

    if (!queryReady) {
      setError(
        "Wait for the selected dataset to become ready before running SQL.",
      );

      return;
    }

    const execution =
      getEditorExecutionTarget();

    if (!execution) {
      setError(
        "Select SQL or enter a SQL query first.",
      );

      return;
    }

    const trimmedSql =
      execution.sql.trim();

    /*
     * Validate EXACTLY the text that is about to run.
     *
     * This is independent of the full-editor live state,
     * which means selected-query execution works even when
     * another part of the editor contains an error.
     */
    const syntaxProblems =
      validateSqlSyntax(
        trimmedSql,
      );

    if (
      syntaxProblems.some(
        (problem) =>
          problem.severity ===
          "error",
      )
    ) {
      const mappedProblems =
        syntaxProblems.map(
          (problem) =>
            mapProblemToEditor(
              problem,
              execution.target,
            ),
        );

      setSqlProblems(
        mappedProblems,
      );

      applySqlMarkers(
        mappedProblems,
      );

      setSqlValidationPending(
        false,
      );

      setSqlValidationState(
        "invalid",
      );

      setError(
        "Fix the SQL syntax error shown in the Problems panel before running the selected query.",
      );

      return;
    }

    /*
     * Stop the normal live validator from racing against
     * this explicit execution validation.
     */
    if (
      validationTimerRef.current
    ) {
      clearTimeout(
        validationTimerRef.current,
      );

      validationTimerRef.current =
        null;
    }

    validationAbortRef.current?.abort();
    validationAbortRef.current =
      null;

    const requestId =
      validationRequestRef.current +
      1;

    validationRequestRef.current =
      requestId;

    setSqlValidationPending(
      true,
    );

    setSqlValidationState(
      "checking",
    );

    const semanticallyValid =
      await validateSqlWithBackend(
        trimmedSql,
        requestId,
        execution.target,
      );

    if (!semanticallyValid) {
      setError(
        "Fix the SQL errors shown in the Problems panel before running the selected query.",
      );

      return;
    }

    if (
      requestId !==
      validationRequestRef.current
    ) {
      setError(
        "The SQL changed while validation was running. Run the current query again.",
      );

      return;
    }

    try {
      setExecutingSql(true);
      setError("");
      setInfo("");
      setActiveTab("result");

      const nextResult =
        await queryApi.executeSql(
          {
            workspaceId:
              workspace.id,

            datasetId,

            conversationId:
              conversationId ||
              null,
          },
          trimmedSql,
          question.trim() ||
            null,
        );

      setResult(
        nextResult,
      );

      setInfo(
        `Query completed in ${nextResult.executionTimeMs} ms.`,
      );
    } catch (err) {
      if (
        err instanceof QueryApiError
      ) {
        setError(err.message);
      } else if (
        err instanceof Error
      ) {
        setError(err.message);
      } else {
        setError(
          "Query execution failed.",
        );
      }
    } finally {
      setExecutingSql(false);
    }
  }

  useEffect(() => {
    executeSqlRef.current =
      handleExecuteSql;
  });

  async function handleRunQuestion(
    questionOverride?: string,
  ) {
    if (
      !workspace ||
      !datasetId
    ) {
      setError(
        "Select a dataset before running analysis.",
      );

      return;
    }

    const nextQuestion = (
      questionOverride ??
      question
    ).trim();

    if (!nextQuestion) {
      setError(
        "Enter a natural-language question first.",
      );

      return;
    }

    try {
      setRunningQuestion(
        true,
      );

      setError("");
      setInfo("");
      setActiveTab("result");
      setQuestion(
        nextQuestion,
      );

      const response =
        await queryApi.queryFromQuestion(
          {
            workspaceId:
              workspace.id,

            datasetId,

            conversationId:
              conversationId ||
              null,
          },
          nextQuestion,
        );

      setSql(
        response.sql,
      );

      setResult(
        response.result,
      );

      scheduleSqlValidationRef.current(
        response.sql,
      );

      setInfo(
        `Analysis completed in ${response.result.executionTimeMs} ms. Checking generated SQL...`,
      );
    } catch (err) {
      if (
        err instanceof QueryApiError
      ) {
        setError(err.message);
      } else if (
        err instanceof Error
      ) {
        setError(err.message);
      } else {
        setError(
          "Natural-language analysis failed.",
        );
      }
    } finally {
      setRunningQuestion(
        false,
      );
    }
  }

  // ==========================================
  // FOLLOW-UP HANDLER
  // ==========================================

  function handleFollowUpQuestion(
    nextQuestion: string,
  ) {
    const trimmedQuestion =
      nextQuestion.trim();

    if (!trimmedQuestion) {
      return;
    }

    setQuestion(
      trimmedQuestion,
    );

    setError("");
    setInfo("");

    void handleRunQuestion(
      trimmedQuestion,
    );
  }

  // ==========================================
  // RENDER
  // ==========================================

  if (!mounted) {
    return null;
  }

  return (
    <main
      style={themeStyle}
      className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased transition-colors duration-500"
    >
      <div className="mx-auto w-full max-w-[1400px] px-5 py-6 sm:px-7 lg:px-9">
        <div className="mb-6 flex flex-col gap-4 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
              Analytical Workspace
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text)]">
              Query Editor
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {workspace && (
              <div className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[12px] font-bold text-[var(--muted-strong)] shadow-sm">
                Workspace:{" "}
                <span className="text-[var(--text)]">
                  {workspace.name}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                setTheme((t) =>
                  t === "light"
                    ? "dark"
                    : "light",
                )
              }
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-strong)] transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface)] hover:text-[var(--text)] active:scale-95"
              aria-label="Toggle theme"
            >
              {theme === "light" ? (
                <MoonIcon />
              ) : (
                <SunIcon />
              )}
            </button>
          </div>
        </div>

        <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full items-center gap-4 sm:w-auto">
            <label
              htmlFor="dataset-select"
              className="shrink-0 text-[13px] font-bold text-[var(--muted-strong)]"
            >
              Active dataset:
            </label>

            <select
              id="dataset-select"
              value={datasetId}
              onChange={(event) =>
                handleDatasetChange(
                  event.target.value,
                )
              }
              disabled={
                !workspaceReady ||
                loadingDatasets
              }
              className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 text-[14px] font-bold text-[var(--text)] outline-none transition-colors hover:border-indigo-500/40 focus:border-indigo-500 disabled:cursor-not-allowed sm:w-[300px]"
            >
              <option value="">
                Select a dataset
              </option>

              {datasets.map(
                (item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {loadingDatasets ||
            loadingContext ? (
              <span className="text-[13px] font-medium text-[var(--muted)]">
                Loading dataset context...
              </span>
            ) : dataset ? (
              <>
                <span className="text-[13px] font-bold text-[var(--text)]">
                  {dataset.rowCount.toLocaleString()}{" "}
                  rows
                </span>

                <span className="text-[var(--muted)]">
                  ·
                </span>

                <span className="text-[13px] font-bold text-[var(--text)]">
                  {dataset.columnCount.toLocaleString()}{" "}
                  cols
                </span>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                    dataset.status ===
                    "ready"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-[var(--surface)] text-[var(--muted)]"
                  }`}
                >
                  {dataset.status}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <div className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
                  Natural Language
                </p>

                <p className="mt-1 text-[13px] font-medium text-[var(--muted-strong)]">
                  Ask what you want to know.
                  The AI will generate SQL.
                </p>
              </div>

              <textarea
                value={question}
                onChange={(event) =>
                  setQuestion(
                    event.target.value,
                  )
                }
                rows={3}
                placeholder="Example: Show total sales by city"
                disabled={!datasetReady}
                className="w-full resize-none rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-[14px] font-medium text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed"
              />

              {datasetReady &&
                !result &&
                suggestedQuestions.length >
                  0 && (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center gap-2">
                      <SparkleIcon className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />

                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Suggested questions
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {suggestedQuestions.map(
                        (
                          suggestion,
                        ) => (
                          <button
                            key={
                              suggestion
                            }
                            type="button"
                            onClick={() =>
                              setQuestion(
                                suggestion,
                              )
                            }
                            disabled={
                              generatingSql ||
                              runningQuestion ||
                              executingSql
                            }
                            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-[12px] font-semibold text-[var(--muted-strong)] transition-all hover:border-indigo-500/40 hover:bg-indigo-500/5 hover:text-[var(--text)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {
                              suggestion
                            }
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                )}

              {datasetReady &&
                result &&
                followUpQuestions.length >
                  0 && (
                  <div className="mt-5 border-t border-[var(--border)] pt-4">
                    <div className="mb-3 flex items-start gap-2">
                      <SparkleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500 dark:text-indigo-400" />

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">
                          Follow-up questions
                        </p>

                        <p className="mt-0.5 text-[11px] font-medium text-[var(--muted)]">
                          Continue exploring this analysis.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {followUpQuestions.map(
                        (
                          followUp,
                          index,
                        ) => (
                          <button
                            key={`${followUp}-${index}`}
                            type="button"
                            onClick={() =>
                              handleFollowUpQuestion(
                                followUp,
                              )
                            }
                            disabled={
                              generatingSql ||
                              runningQuestion ||
                              executingSql
                            }
                            className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2 text-left text-[12px] font-semibold text-[var(--muted-strong)] transition-all hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-[var(--text)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {
                              followUp
                            }
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                )}

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    handleRunQuestion()
                  }
                  disabled={
                    !queryReady ||
                    generatingSql ||
                    runningQuestion ||
                    executingSql
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-[13px] font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[var(--border-strong)] disabled:text-[var(--muted)] disabled:hover:translate-y-0"
                >
                  <SparkleIcon />

                  {runningQuestion
                    ? "Analyzing..."
                    : "Ask & Run"}
                </button>

                <button
                  type="button"
                  onClick={
                    handleGenerateSql
                  }
                  disabled={
                    !queryReady ||
                    generatingSql ||
                    runningQuestion ||
                    executingSql
                  }
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-6 text-[13px] font-bold text-[var(--text)] transition-all hover:bg-[var(--border)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generatingSql
                    ? "Generating..."
                    : "Generate SQL"}
                </button>
              </div>
            </div>

            <div className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-inner">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
                Dataset Schema
              </p>

              <div className="custom-scrollbar mt-4 flex max-h-[300px] flex-col gap-2 overflow-y-auto">
                {columnNames.length >
                0 ? (
                  columnNames.map(
                    (
                      columnName,
                    ) => (
                      <div
                        key={
                          columnName
                        }
                        className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[12px] font-bold text-[var(--muted-strong)] shadow-sm"
                      >
                        {
                          columnName
                        }
                      </div>
                    ),
                  )
                ) : (
                  <p className="text-[13px] font-medium text-[var(--muted)]">
                    Schema unavailable.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
                  SQL Editor
                </p>

                <p className="mt-1 text-[13px] font-medium text-[var(--muted-strong)]">
                  Edit SQL directly or use generated SQL.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  handleExecuteSql
                }
                disabled={
                  !queryReady ||
                  generatingSql ||
                  runningQuestion ||
                  executingSql
                }
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--text)] px-6 text-[13px] font-bold text-[var(--bg)] shadow-md transition-all hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <PlayIcon className="h-4 w-4" />

                {executingSql
                  ? "Running..."
                  : "Run SQL"}
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--code-bg)] shadow-inner">
              <Editor
                key={theme}
                height="280px"
                language="sql"
                theme="aiDataAnalystTheme"
                value={sql}
                onChange={(value) => {
                  const nextValue =
                    value ?? "";

                  setSql(
                    nextValue,
                  );

                  /*
                   * This is the LIVE path.
                   *
                   * Parser runs immediately.
                   * Backend semantic check waits 500ms.
                   */
                  scheduleSqlValidationRef.current(
                    nextValue,
                  );
                }}
                onMount={
                  handleSqlEditorMount
                }
                loading={
                  <div className="flex h-full items-center justify-center text-[13px] font-medium text-[var(--muted)]">
                    Loading Editor...
                  </div>
                }
                options={{
                  minimap: {
                    enabled: false,
                  },

                  fontSize: 14,

                  lineHeight: 24,

                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",

                  roundedSelection: true,

                  scrollBeyondLastLine:
                    false,

                  wordWrap: "on",

                  padding: {
                    top: 16,
                    bottom: 16,
                  },

                  cursorBlinking:
                    "smooth",

                  smoothScrolling: true,

                  readOnly:
                    !datasetReady,

                  automaticLayout:
                    true,

                  quickSuggestions:
                    true,

                  suggestOnTriggerCharacters:
                    true,

                  parameterHints: {
                    enabled: true,
                  },

                  folding: true,

                  bracketPairColorization:
                    {
                      enabled: true,
                    },

                  renderValidationDecorations:
                    "on",

                  scrollbar: {
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                  },
                }}
              />
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex flex-col gap-2 border-b border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Problems
                  </p>

                  {sqlValidationPending && (
                    <span className="text-[11px] font-semibold text-[var(--muted)]">
                      Checking SQL...
                    </span>
                  )}

                  {!sqlValidationPending &&
                    sqlProblems.length >
                      0 && (
                      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                        {
                          sqlProblems.length
                        }{" "}
                        {sqlProblems.length ===
                        1
                          ? "problem"
                          : "problems"}
                      </span>
                    )}
                </div>

                {!sqlValidationPending &&
                  sqlValidationState ===
                    "valid" &&
                  sqlProblems.length ===
                    0 && (
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      ✓ Your SQL is valid and ready to run.
                    </span>
                  )}

                {!sqlValidationPending &&
                  sqlValidationState ===
                    "idle" &&
                  sqlProblems.length ===
                    0 && (
                    <span className="text-[11px] font-semibold text-[var(--muted)]">
                      {queryReady
                        ? "Syntax validation is active. Semantic checks run against the selected dataset."
                        : "Syntax validation is active. Select a ready dataset for semantic validation."}
                    </span>
                  )}
              </div>

              {sqlProblems.length >
              0 ? (
                <div className="divide-y divide-[var(--border)]">
                  {sqlProblems.map(
                    (
                      problem,
                      index,
                    ) => (
                      <button
                        key={`${problem.line}-${problem.column}-${problem.message}-${index}`}
                        type="button"
                        onClick={() => {
                          const editorInstance =
                            sqlEditorRef.current;

                          if (
                            !editorInstance
                          ) {
                            return;
                          }

                          editorInstance.setPosition(
                            {
                              lineNumber:
                                problem.line,

                              column:
                                problem.column,
                            },
                          );

                          editorInstance.revealPositionInCenter(
                            {
                              lineNumber:
                                problem.line,

                              column:
                                problem.column,
                            },
                          );

                          editorInstance.focus();
                        }}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--card)]"
                      >
                        <span className="mt-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500/10 text-[10px] font-bold text-red-600 dark:text-red-400">
                          !
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] font-bold text-[var(--text)]">
                            {
                              problem.message
                            }
                          </span>

                          <span className="mt-1 block text-[10px] font-semibold text-[var(--muted)]">
                            Line{" "}
                            {
                              problem.line
                            }
                            , column{" "}
                            {
                              problem.column
                            }
                          </span>
                        </span>
                      </button>
                    ),
                  )}
                </div>
              ) : (
                !sqlValidationPending && (
                  <div className="px-4 py-3 text-[11px] font-medium text-[var(--muted)]">
                    {sqlValidationState ===
                    "valid"
                      ? "No SQL validation problems detected."
                      : queryReady
                        ? "Type SQL to run the live parser and dataset semantic checker."
                        : "Type SQL to run the live syntax parser."}
                  </div>
                )
              )}
            </div>

            <div className="mt-3 flex flex-col gap-2 text-[11px] font-bold text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
              <span>
                Select any SQL text to run only that selection.
              </span>

              <span>
                <kbd className="mx-1 rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5">
                  Shift
                </kbd>{" "}
                +{" "}
                <kbd className="mx-1 rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5">
                  Enter
                </kbd>{" "}
                to run query
              </span>
            </div>
          </div>

          {(error || info) && (
            <div
              className={`rounded-xl border px-5 py-4 text-[14px] font-bold shadow-sm ${
                error
                  ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                  : "border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
              }`}
            >
              {error || info}
            </div>
          )}

          {result && (
            <div className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
              <div className="flex items-center gap-6 border-b border-[var(--border)] bg-[var(--surface)] px-5 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setActiveTab(
                      "result",
                    )
                  }
                  className={`pb-3 text-[13px] font-bold uppercase tracking-wider transition-colors ${
                    activeTab ===
                    "result"
                      ? "border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400"
                      : "text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  Result
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActiveTab(
                      "explanation",
                    )
                  }
                  className={`pb-3 text-[13px] font-bold uppercase tracking-wider transition-colors ${
                    activeTab ===
                    "explanation"
                      ? "border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400"
                      : "text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  Explanation
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActiveTab(
                      "visualization",
                    )
                  }
                  className={`pb-3 text-[13px] font-bold uppercase tracking-wider transition-colors ${
                    activeTab ===
                    "visualization"
                      ? "border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400"
                      : "text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  Visualization
                </button>
              </div>

              <div className="min-h-[400px] p-5">
                {activeTab ===
                  "result" && (
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-inner sm:flex-row sm:items-center">
                      <div>
                        <p className="text-[14px] font-bold text-[var(--text)]">
                          {result.rowCount.toLocaleString()}{" "}
                          rows returned
                          {result.truncated && (
                            <span className="ml-1.5 text-amber-500">
                              (Truncated)
                            </span>
                          )}
                        </p>

                        <p className="mt-1 text-[11px] font-medium text-[var(--muted)]">
                          Execution time:{" "}
                          {
                            result.executionTimeMs
                          }{" "}
                          ms
                        </p>
                      </div>

                      {result.summary
                        ?.numericColumns
                        ?.length >
                        0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0">
                          {result.summary.numericColumns
                            .slice(
                              0,
                              4,
                            )
                            .map(
                              (
                                item,
                              ) => (
                                <div
                                  key={
                                    item.column
                                  }
                                  className="flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--card)] px-3 py-1.5 shadow-sm"
                                >
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                                    {
                                      item.column
                                    }
                                    :
                                  </span>

                                  <span className="text-[13px] font-bold text-[var(--text)]">
                                    {item.sum.toLocaleString()}
                                  </span>
                                </div>
                              ),
                            )}
                        </div>
                      )}
                    </div>

                    <div className="custom-scrollbar overflow-x-auto rounded-xl border border-[var(--border-strong)]">
                      <table className="min-w-full border-collapse text-left">
                        <thead className="bg-[var(--surface)]">
                          <tr>
                            <th className="whitespace-nowrap border-b border-[var(--border-strong)] px-5 py-3 text-[12px] font-bold text-[var(--text)]">
                              #
                            </th>

                            {result.columns.map(
                              (
                                column,
                              ) => (
                                <th
                                  key={
                                    column
                                  }
                                  className="whitespace-nowrap border-b border-[var(--border-strong)] px-5 py-3 text-[12px] font-bold text-[var(--text)]"
                                >
                                  {
                                    column
                                  }
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>

                        <tbody>
                          {result.rows.map(
                            (
                              row,
                              rowIndex,
                            ) => (
                              <tr
                                key={`${rowIndex}-${row.join(
                                  "|",
                                )}`}
                                className="border-b border-[var(--border)] transition-colors last:border-b-0 hover:bg-[var(--surface)]"
                              >
                                <td className="whitespace-nowrap px-5 py-3 text-[12px] font-bold text-[var(--muted)]">
                                  {rowIndex +
                                    1}
                                </td>

                                {row.map(
                                  (
                                    value,
                                    columnIndex,
                                  ) => (
                                    <td
                                      key={`${rowIndex}-${columnIndex}`}
                                      className="max-w-[320px] whitespace-nowrap px-5 py-3 text-[13px] font-medium text-[var(--muted-strong)]"
                                    >
                                      {value ===
                                        null ||
                                      value ===
                                        undefined ? (
                                        <span className="italic text-[var(--muted)]">
                                          NULL
                                        </span>
                                      ) : (
                                        String(
                                          value,
                                        )
                                      )}
                                    </td>
                                  ),
                                )}
                              </tr>
                            ),
                          )}

                          {result.rows
                            .length ===
                            0 && (
                            <tr>
                              <td
                                colSpan={
                                  result
                                    .columns
                                    .length +
                                  1
                                }
                                className="px-5 py-8 text-center text-[13px] font-bold text-[var(--muted)]"
                              >
                                Query returned
                                no rows.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab ===
                  "explanation" && (
                  <div className="flex flex-col gap-4">
                    <SqlExplanation
                      result={result}
                    />
                  </div>
                )}

                {activeTab ===
                  "visualization" && (
                  <div className="flex flex-col gap-4">
                    <ResultVisualization
                      columns={
                        result.columns
                      }
                      rows={result.rows}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {!loadingWorkspace &&
            !workspace && (
              <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
                <p className="text-[15px] font-bold text-red-600 dark:text-red-400">
                  Workspace could not be
                  loaded.
                </p>
              </div>
            )}
        </div>
      </div>
    </main>
  );
}