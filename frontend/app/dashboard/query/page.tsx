"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

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

const DEFAULT_SQL = `SELECT *
FROM dataset
LIMIT 100`;

const DEFAULT_QUESTION =
  "Show me a summary of this dataset";

export default function QueryWorkspacePage() {
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

  const [question, setQuestion] =
    useState(DEFAULT_QUESTION);

  const [sql, setSql] =
    useState(DEFAULT_SQL);

  const [result, setResult] =
    useState<QueryResult | null>(null);

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

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search,
    );

    const id =
      params.get("datasetId") ?? "";

    setDatasetId(id);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      const token =
        getAccessToken();

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

        const response =
          await fetch(
            "/backend/workspaces",
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            },
          );

        const data: unknown =
          await response.json();

        if (!response.ok) {
          const message =
            typeof data === "object" &&
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
          setWorkspace(
            firstWorkspace,
          );
        }
      } catch (err) {
        if (!active) return;

        if (
          err instanceof ApiError &&
          (
            err.status === 401 ||
            err.status === 403
          )
        ) {
          setError(
            "Your session is no longer valid. Please log in again.",
          );
        } else if (
          err instanceof Error
        ) {
          setError(
            err.message,
          );
        } else {
          setError(
            "Unable to load workspace.",
          );
        }
      } finally {
        if (active) {
          setLoadingWorkspace(
            false,
          );
        }
      }
    }

    void loadWorkspace();

    return () => {
      active = false;
    };
  }, []);

  /*
   * Load the dataset list independently
   * from the selected dataset.
   */
  useEffect(() => {
    if (!workspace) {
      return;
    }

    const workspaceId =
      workspace.id;

    let active = true;

    async function loadDatasets() {
      const token =
        getAccessToken();

      if (!token) {
        return;
      }

      try {
        setLoadingDatasets(true);
        setError("");
        setInfo("");

        const datasetList =
          await datasetApi.list(
            token,
            workspaceId,
          );

        if (!active) {
          return;
        }

        setDatasets(
          datasetList,
        );

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
              item.status ===
              "ready",
          ) ?? null;

        const fallbackDataset =
          datasetList[0] ??
          null;

        const selectedDataset: Dataset | null =
          requestedDataset ??
          firstReadyDataset ??
          fallbackDataset;

        if (!selectedDataset) {
          setDatasetId("");

          setDataset(null);
          setContext(null);

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
        if (!active) {
          return;
        }

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
            setError(
              err.message,
            );
          }
        } else if (
          err instanceof Error
        ) {
          setError(
            err.message,
          );
        } else {
          setError(
            "Unable to load datasets.",
          );
        }
      } finally {
        if (active) {
          setLoadingDatasets(
            false,
          );
        }
      }
    }

    void loadDatasets();

    return () => {
      active = false;
    };
  }, [workspace]);

  /*
   * Load the selected dataset's analysis
   * context.
   */
  useEffect(() => {
    if (
      !workspace ||
      !datasetId ||
      datasets.length === 0
    ) {
      return;
    }

    const selectedDataset: Dataset | null =
      datasets.find(
        (item) =>
          item.id === datasetId,
      ) ?? null;

    if (!selectedDataset) {
      return;
    }

    const workspaceId =
      workspace.id;

    const currentDatasetId =
      datasetId;

    const selectedDatasetStatus =
      selectedDataset.status;

    let active = true;

    async function loadDatasetContext() {
      const token =
        getAccessToken();

      if (!token) {
        return;
      }

      try {
        setLoadingContext(
          true,
        );

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

        if (!active) {
          return;
        }

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
        if (!active) {
          return;
        }

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
            setError(
              err.message,
            );
          }
        } else if (
          err instanceof Error
        ) {
          setError(
            err.message,
          );
        } else {
          setError(
            "Unable to load dataset context.",
          );
        }
      } finally {
        if (active) {
          setLoadingContext(
            false,
          );
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

  const columnNames =
    useMemo(() => {
      return (
        context?.columns?.map(
          (column) =>
            column.name,
        ) ?? []
      );
    }, [context]);

  function handleDatasetChange(
    nextDatasetId: string,
  ) {
    setDatasetId(
      nextDatasetId,
    );

    setDataset(null);
    setContext(null);
    setResult(null);

    setError("");
    setInfo("");

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
      setGeneratingSql(
        true,
      );

      setError("");
      setInfo("");

      const generated =
        await queryApi.generateSql(
          {
            workspaceId:
              workspace.id,

            datasetId,
          },
          question.trim(),
        );

      setSql(
        generated.sql,
      );

      setInfo(
        `SQL generated by ${generated.provider}${
          generated.model
            ? ` (${generated.model})`
            : ""
        }.`,
      );
    } catch (err) {
      if (
        err instanceof QueryApiError
      ) {
        setError(
          err.message,
        );
      } else if (
        err instanceof Error
      ) {
        setError(
          err.message,
        );
      } else {
        setError(
          "SQL generation failed.",
        );
      }
    } finally {
      setGeneratingSql(
        false,
      );
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

    if (!sql.trim()) {
      setError(
        "Enter a SQL query first.",
      );

      return;
    }

    try {
      setExecutingSql(
        true,
      );

      setError("");
      setInfo("");

      const nextResult =
        await queryApi.executeSql(
          {
            workspaceId:
              workspace.id,

            datasetId,
          },
          sql.trim(),
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
        setError(
          err.message,
        );
      } else if (
        err instanceof Error
      ) {
        setError(
          err.message,
        );
      } else {
        setError(
          "Query execution failed.",
        );
      }
    } finally {
      setExecutingSql(
        false,
      );
    }
  }

  async function handleRunQuestion() {
    if (
      !workspace ||
      !datasetId
    ) {
      setError(
        "Select a dataset before running analysis.",
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
      setRunningQuestion(
        true,
      );

      setError("");
      setInfo("");

      const response =
        await queryApi.queryFromQuestion(
          {
            workspaceId:
              workspace.id,

            datasetId,
          },
          question.trim(),
        );

      setSql(
        response.sql,
      );

      setResult(
        response.result,
      );

      const providerText =
        response.provider
          ? ` using ${response.provider}`
          : "";

      setInfo(
        `Analysis completed${providerText} in ${response.result.executionTimeMs} ms.`,
      );
    } catch (err) {
      if (
        err instanceof QueryApiError
      ) {
        setError(
          err.message,
        );
      } else if (
        err instanceof Error
      ) {
        setError(
          err.message,
        );
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

  const workspaceReady =
    !loadingWorkspace &&
    Boolean(workspace);

  const datasetReady =
    workspaceReady &&
    !loadingDatasets &&
    !loadingContext &&
    Boolean(dataset);

  const queryReady =
    dataset?.status ===
    "ready";

  return (
    <main className="min-h-screen bg-[#070708] text-white">
      <div className="mx-auto w-full max-w-[1600px] px-5 py-6 sm:px-7 lg:px-9">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.18em] text-white/35">
            Analytical Workspace
          </p>

          <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Query Workspace
              </h1>

              <p className="mt-1 max-w-3xl text-sm text-white/45">
                Ask questions in natural
                language, inspect generated
                SQL, or run read-only SQL
                directly against your selected
                dataset.
              </p>
            </div>

            {workspace && (
              <div className="text-sm text-white/40">
                Workspace:{" "}
                <span className="text-white/75">
                  {workspace.name}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/35">
                Dataset
              </p>

              <div className="mt-3">
                <label
                  htmlFor="dataset-select"
                  className="mb-2 block text-sm text-white/60"
                >
                  Active dataset
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
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-50"
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

                {!loadingDatasets &&
                  datasets.length ===
                    0 && (
                    <p className="mt-2 text-xs text-white/30">
                      No datasets are available
                      in this workspace.
                    </p>
                  )}
              </div>
            </div>

            <div className="mt-5 border-t border-white/8 pt-5">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/35">
                Dataset status
              </p>

              <div className="mt-3">
                {loadingDatasets ||
                loadingContext ? (
                  <p className="text-sm text-white/45">
                    Loading dataset...
                  </p>
                ) : dataset ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-white/85">
                      {dataset.name}
                    </div>

                    <div className="text-xs text-white/40">
                      {dataset.rowCount.toLocaleString()}{" "}
                      rows
                      {" · "}
                      {dataset.columnCount.toLocaleString()}{" "}
                      columns
                    </div>

                    <span className="inline-flex rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/55">
                      {dataset.status}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-white/35">
                    No dataset selected.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-white/8 pt-5">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/35">
                Schema
              </p>

              <div className="mt-3 space-y-1.5">
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
                        className="rounded-lg px-2.5 py-2 text-sm text-white/55"
                      >
                        {columnName}
                      </div>
                    ),
                  )
                ) : (
                  <p className="text-sm text-white/35">
                    Schema unavailable.
                  </p>
                )}
              </div>
            </div>
          </aside>

          <section className="min-w-0 space-y-5">
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
              <div className="mb-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/35">
                  Natural language
                </p>

                <p className="mt-1 text-sm text-white/45">
                  Ask what you want to know
                  about the selected dataset.
                </p>
              </div>

              <textarea
                value={question}
                onChange={(event) =>
                  setQuestion(
                    event.target.value,
                  )
                }
                rows={4}
                placeholder="Example: Show total sales by city"
                disabled={
                  !datasetReady
                }
                className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-50"
              />

              <div className="mt-3 flex flex-wrap gap-2">
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
                  className="rounded-xl border border-white/10 bg-white/[0.045] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {generatingSql
                    ? "Generating..."
                    : "Generate SQL"}
                </button>

                <button
                  type="button"
                  onClick={
                    handleRunQuestion
                  }
                  disabled={
                    !queryReady ||
                    generatingSql ||
                    runningQuestion ||
                    executingSql
                  }
                  className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {runningQuestion
                    ? "Analyzing..."
                    : "Ask & Run"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/35">
                    SQL editor
                  </p>

                  <p className="mt-1 text-sm text-white/45">
                    Read-only analytical SQL.
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
                  className="rounded-xl border border-white/10 bg-white/[0.045] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {executingSql
                    ? "Running..."
                    : "Run SQL"}
                </button>
              </div>

              <textarea
                value={sql}
                onChange={(event) =>
                  setSql(
                    event.target.value,
                  )
                }
                rows={12}
                spellCheck={false}
                disabled={
                  !datasetReady
                }
                className="w-full resize-y rounded-xl border border-white/10 bg-black/40 px-4 py-4 font-mono text-sm leading-6 text-white/85 outline-none placeholder:text-white/20 focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {(error || info) && (
              <div
                className={`rounded-2xl border p-4 text-sm ${
                  error
                    ? "border-red-400/15 bg-red-400/[0.04] text-red-200/80"
                    : "border-white/8 bg-white/[0.025] text-white/55"
                }`}
              >
                {error ||
                  info}
              </div>
            )}

            {result && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-white/8 bg-white/[0.025]">
                  <div className="border-b border-white/8 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/35">
                          Results
                        </p>

                        <p className="mt-1 text-sm text-white/45">
                          {result.rowCount.toLocaleString()}{" "}
                          rows
                          {" · "}
                          {result.executionTimeMs}{" "}
                          ms
                          {result.truncated
                            ? " · truncated"
                            : ""}
                        </p>
                      </div>
                    </div>

                    {result.summary?.numericColumns
                      ?.length >
                      0 && (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                                className="rounded-xl border border-white/8 bg-white/[0.02] p-3"
                              >
                                <p className="truncate text-xs text-white/35">
                                  {
                                    item.column
                                  }
                                </p>

                                <p className="mt-1 text-lg font-semibold text-white/85">
                                  {item.sum.toLocaleString()}
                                </p>

                                <p className="mt-1 text-xs text-white/35">
                                  Avg{" "}
                                  {item.average.toLocaleString()}
                                </p>
                              </div>
                            ),
                          )}
                      </div>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-white/8">
                          {result.columns.map(
                            (
                              column,
                            ) => (
                              <th
                                key={
                                  column
                                }
                                className="whitespace-nowrap px-4 py-3 font-medium text-white/50"
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
                              className="border-b border-white/5 last:border-b-0"
                            >
                              {row.map(
                                (
                                  value,
                                  columnIndex,
                                ) => (
                                  <td
                                    key={`${rowIndex}-${columnIndex}`}
                                    className="max-w-[320px] whitespace-nowrap px-4 py-3 text-white/65"
                                  >
                                    {value ===
                                      null ||
                                    value ===
                                      undefined
                                      ? "NULL"
                                      : String(
                                          value,
                                        )}
                                  </td>
                                ),
                              )}
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>

                    {result.rows
                      .length ===
                      0 && (
                      <div className="p-8 text-center text-sm text-white/35">
                        Query returned no
                        rows.
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/8 p-5">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/35">
                      Executed SQL
                    </p>

                    <pre className="mt-3 overflow-x-auto rounded-xl border border-white/8 bg-black/35 p-4 font-mono text-xs leading-6 text-white/55">
                      {result.sql}
                    </pre>
                  </div>
                </div>

                <ResultVisualization
                  columns={
                    result.columns
                  }
                  rows={
                    result.rows
                  }
                />
              </div>
            )}

            {!loadingWorkspace &&
              !workspace && (
                <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-8 text-center">
                  <p className="text-sm text-white/45">
                    Workspace could not
                    be loaded.
                  </p>
                </div>
              )}
          </section>
        </div>
      </div>
    </main>
  );
}