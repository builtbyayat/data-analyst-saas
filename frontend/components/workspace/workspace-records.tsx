"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  CSSProperties,
  FormEvent,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import {
  ApiError,
  Dataset,
  QueryHistoryItem,
  Report,
  SavedAnalysis,
  SavedQuery,
  datasetApi,
  workspaceExperienceApi,
} from "../../lib/api";

import {
  clearAccessToken,
  getAccessToken,
} from "../../lib/auth";

import { useWorkspace } from "../../app/dashboard/workspace-context";

export type WorkspaceSection =
  | "saved-queries"
  | "saved-analyses"
  | "reports"
  | "history";

interface SectionMeta {
  eyebrow: string;
  title: string;
  description: string;
}

const sectionMeta: Record<
  WorkspaceSection,
  SectionMeta
> = {
  "saved-queries": {
    eyebrow: "Library",
    title: "Saved queries",
    description:
      "Reusable SQL queries saved inside this workspace.",
  },

  "saved-analyses": {
    eyebrow: "Library",
    title: "Saved analyses",
    description:
      "Saved result snapshots together with the SQL and datasets behind them.",
  },

  reports: {
    eyebrow: "Workspace",
    title: "Reports",
    description:
      "Organize saved analyses into reusable report collections.",
  },

  history: {
    eyebrow: "Activity",
    title: "Query history",
    description:
      "Review recent query executions, outcomes, timing, and SQL.",
  },
};

const sectionOrder: WorkspaceSection[] = [
  "saved-queries",
  "saved-analyses",
  "reports",
  "history",
];

type EditTarget =
  | {
      kind: "query";
      item: SavedQuery;
    }
  | {
      kind: "analysis";
      item: SavedAnalysis;
    }
  | {
      kind: "report";
      item: Report;
    };

type HistoryFilter =
  | "all"
  | "success"
  | "failed";

function formatDate(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}

function formatShortDate(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

function formatNumber(
  value:
    | number
    | null
    | undefined,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-IN",
  ).format(value);
}

function formatDuration(
  value:
    | number
    | null
    | undefined,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  if (value < 1000) {
    return `${value} ms`;
  }

  return `${(
    value / 1000
  ).toFixed(2)} s`;
}

function truncate(
  value: string,
  maxLength: number,
): string {
  if (
    value.length <= maxLength
  ) {
    return value;
  }

  return `${value.slice(
    0,
    maxLength - 1,
  )}…`;
}

function formatCellValue(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    return JSON.stringify(value);
  }

  return String(value);
}

function normalizeSnapshot(
  snapshot: Record<string, unknown>,
) {
  const columns = Array.isArray(
    snapshot.columns,
  )
    ? snapshot.columns.filter(
        (
          value,
        ): value is string =>
          typeof value ===
          "string",
      )
    : [];

  const rows = Array.isArray(
    snapshot.rows,
  )
    ? snapshot.rows.filter(
        (
          value,
        ): value is unknown[] =>
          Array.isArray(value),
      )
    : [];

  const rowCount =
    typeof snapshot.rowCount ===
    "number"
      ? snapshot.rowCount
      : rows.length;

  return {
    columns,
    rows,
    rowCount,
  };
}

function openQueryEditor(
  router: ReturnType<
    typeof useRouter
  >,
  datasetId: string | null,
  sql: string,
  question?: string | null,
  datasetIds?: string[],
) {
  const params =
    new URLSearchParams();

  if (sql.trim()) {
    params.set("sql", sql);
  }

  if (question?.trim()) {
    params.set(
      "question",
      question.trim(),
    );
  }

  if (
    datasetIds &&
    datasetIds.length > 1
  ) {
    window.sessionStorage.setItem(
      "ai-data-analyst-selected-datasets",
      JSON.stringify(
        datasetIds,
      ),
    );

    params.set(
      "mode",
      "multi",
    );
  } else if (datasetId) {
    params.set(
      "datasetId",
      datasetId,
    );
  }

  const query =
    params.toString();

  router.push(
    query
      ? `/dashboard/query?${query}`
      : "/dashboard/query",
  );
}

async function copyToClipboard(
  value: string,
) {
  if (
    !navigator.clipboard
  ) {
    throw new Error(
      "Clipboard access is not available in this browser.",
    );
  }

  await navigator.clipboard.writeText(
    value,
  );
}

export default function WorkspaceRecords({
  section,
}: {
  section: WorkspaceSection;
}) {
  const router = useRouter();

  const {
    activeWorkspace,
    loading:
      workspaceLoading,
  } = useWorkspace();

  const [
    queries,
    setQueries,
  ] = useState<SavedQuery[]>(
    [],
  );

  const [
    analyses,
    setAnalyses,
  ] = useState<
    SavedAnalysis[]
  >([]);

  const [
    reports,
    setReports,
  ] = useState<Report[]>(
    [],
  );

  const [
    history,
    setHistory,
  ] = useState<
    QueryHistoryItem[]
  >([]);

  const [
    datasets,
    setDatasets,
  ] = useState<Dataset[]>(
    [],
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    notice,
    setNotice,
  ] = useState<
    string | null
  >(null);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    historyFilter,
    setHistoryFilter,
  ] =
    useState<HistoryFilter>(
      "all",
    );

  const [
    expandedId,
    setExpandedId,
  ] = useState<
    string | null
  >(null);

  const [
    busyId,
    setBusyId,
  ] = useState<
    string | null
  >(null);

  const [
    editing,
    setEditing,
  ] = useState<
    EditTarget | null
  >(null);

  const [
    editTitle,
    setEditTitle,
  ] = useState("");

  const [
    editDescription,
    setEditDescription,
  ] = useState("");

  const [
    editAnalysisIds,
    setEditAnalysisIds,
  ] = useState<string[]>(
    [],
  );

  const [
    reportTitle,
    setReportTitle,
  ] = useState("");

  const [
    reportDescription,
    setReportDescription,
  ] = useState("");

  const [
    reportAnalysisIds,
    setReportAnalysisIds,
  ] = useState<
    string[]
  >([]);

  const meta =
    sectionMeta[section];

  const loadWorkspaceRecords =
    useCallback(
      async () => {
        if (
          !activeWorkspace
        ) {
          setLoading(false);
          return;
        }

        const token =
          getAccessToken();

        if (!token) {
          clearAccessToken();

          router.replace(
            `/login?next=${encodeURIComponent(
              `/dashboard/${section}`,
            )}`,
          );

          return;
        }

        setLoading(true);
        setError(null);

        try {
          const [
            nextQueries,
            nextAnalyses,
            nextReports,
            nextHistory,
            nextDatasets,
          ] =
            await Promise.all([
              workspaceExperienceApi.listSavedQueries(
                token,
                activeWorkspace.id,
              ),

              workspaceExperienceApi.listSavedAnalyses(
                token,
                activeWorkspace.id,
              ),

              workspaceExperienceApi.listReports(
                token,
                activeWorkspace.id,
              ),

              workspaceExperienceApi.listHistory(
                token,
                activeWorkspace.id,
              ),

              datasetApi.list(
                token,
                activeWorkspace.id,
              ),
            ]);

          setQueries(
            nextQueries,
          );

          setAnalyses(
            nextAnalyses,
          );

          setReports(
            nextReports,
          );

          setHistory(
            nextHistory,
          );

          setDatasets(
            nextDatasets,
          );
        } catch (
          cause
        ) {
          if (
            cause instanceof
              ApiError &&
            (cause.status ===
              401 ||
              cause.status ===
                403)
          ) {
            clearAccessToken();

            router.replace(
              `/login?next=${encodeURIComponent(
                `/dashboard/${section}`,
              )}`,
            );

            return;
          }

          setError(
            cause instanceof
              Error
              ? cause.message
              : "Could not load workspace records.",
          );
        } finally {
          setLoading(false);
        }
      },
      [
        activeWorkspace,
        router,
        section,
      ],
    );

  useEffect(
    () => {
      const timer =
        window.setTimeout(
          () => {
            void loadWorkspaceRecords();
          },
          0,
        );

      return () =>
        window.clearTimeout(
          timer,
        );
    },
    [
      loadWorkspaceRecords,
    ],
  );

  const datasetNames =
    useMemo(
      () =>
        new Map(
          datasets.map(
            (
              dataset,
            ) => [
              dataset.id,
              dataset.name,
            ],
          ),
        ),
      [datasets],
    );

  const normalizedSearch =
    search
      .trim()
      .toLowerCase();

  const filteredQueries =
    useMemo(
      () => {
        if (
          !normalizedSearch
        ) {
          return queries;
        }

        return queries.filter(
          (item) =>
            [
              item.title,
              item.description ??
                "",
              item.question ??
                "",
              item.sql,
              item.datasetId
                ? datasetNames.get(
                    item.datasetId,
                  ) ?? ""
                : "",
            ].some(
              (value) =>
                value
                  .toLowerCase()
                  .includes(
                    normalizedSearch,
                  ),
            ),
        );
      },
      [
        datasetNames,
        normalizedSearch,
        queries,
      ],
    );

  const filteredAnalyses =
    useMemo(
      () => {
        if (
          !normalizedSearch
        ) {
          return analyses;
        }

        return analyses.filter(
          (item) =>
            [
              item.title,
              item.description ??
                "",
              item.question ??
                "",
              item.sql,
              ...item.datasetIds.map(
                (
                  datasetId,
                ) =>
                  datasetNames.get(
                    datasetId,
                  ) ??
                  datasetId,
              ),
            ].some(
              (value) =>
                value
                  .toLowerCase()
                  .includes(
                    normalizedSearch,
                  ),
            ),
        );
      },
      [
        analyses,
        datasetNames,
        normalizedSearch,
      ],
    );

  const filteredReports =
    useMemo(
      () => {
        if (
          !normalizedSearch
        ) {
          return reports;
        }

        return reports.filter(
          (item) => {
            const analysisTitles =
              item.savedAnalysisIds
                .map(
                  (
                    analysisId,
                  ) =>
                    analyses.find(
                      (
                        analysis,
                      ) =>
                        analysis.id ===
                        analysisId,
                    )?.title ??
                    "",
                )
                .join(" ");

            return [
              item.title,
              item.description ??
                "",
              analysisTitles,
            ].some(
              (value) =>
                value
                  .toLowerCase()
                  .includes(
                    normalizedSearch,
                  ),
            );
          },
        );
      },
      [
        analyses,
        normalizedSearch,
        reports,
      ],
    );

  const filteredHistory =
    useMemo(
      () =>
        history.filter(
          (item) => {
            if (
              historyFilter !==
                "all" &&
              item.status !==
                historyFilter
            ) {
              return false;
            }

            if (
              !normalizedSearch
            ) {
              return true;
            }

            return [
              item.question ??
                "",
              item.sql,
              datasetNames.get(
                item.datasetId,
              ) ??
                item.datasetId,
              item.failureType ??
                "",
              item.errorMessage ??
                "",
            ].some(
              (value) =>
                value
                  .toLowerCase()
                  .includes(
                    normalizedSearch,
                  ),
            );
          },
        ),
      [
        datasetNames,
        history,
        historyFilter,
        normalizedSearch,
      ],
    );

  const visibleCount =
    section ===
    "saved-queries"
      ? filteredQueries.length
      : section ===
          "saved-analyses"
        ? filteredAnalyses.length
        : section ===
            "reports"
          ? filteredReports.length
          : filteredHistory.length;

  const totalCount =
    section ===
    "saved-queries"
      ? queries.length
      : section ===
          "saved-analyses"
        ? analyses.length
        : section ===
            "reports"
          ? reports.length
          : history.length;

  function clearFeedback() {
    setError(null);
    setNotice(null);
  }

  function startEditing(
    target: EditTarget,
  ) {
    setEditing(target);
    setEditTitle(
      target.item.title,
    );
    setEditDescription(
      target.item.description ??
        "",
    );

    if (
      target.kind ===
      "report"
    ) {
      setEditAnalysisIds(
        [
          ...target.item
            .savedAnalysisIds,
        ],
      );
    } else {
      setEditAnalysisIds(
        [],
      );
    }

    clearFeedback();
  }

  function closeEditing() {
    setEditing(null);
    setEditTitle("");
    setEditDescription("");
    setEditAnalysisIds(
      [],
    );
  }

  async function saveEditing(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !activeWorkspace ||
      !editing ||
      busyId
    ) {
      return;
    }

    const title =
      editTitle.trim();

    if (!title) {
      setError(
        "A title is required.",
      );

      return;
    }

    if (
      editing.kind ===
        "report" &&
      editAnalysisIds.length ===
        0
    ) {
      setError(
        "A report must contain at least one saved analysis.",
      );

      return;
    }

    const token =
      getAccessToken();

    if (!token) {
      clearAccessToken();

      router.replace(
        `/login?next=${encodeURIComponent(
          `/dashboard/${section}`,
        )}`,
      );

      return;
    }

    setBusyId(
      editing.item.id,
    );

    clearFeedback();

    try {
      if (
        editing.kind ===
        "query"
      ) {
        await workspaceExperienceApi.updateSavedQuery(
          token,
          activeWorkspace.id,
          editing.item.id,
          {
            title,
            description:
              editDescription.trim() ||
              null,
          },
        );
      }

      if (
        editing.kind ===
        "analysis"
      ) {
        await workspaceExperienceApi.updateSavedAnalysis(
          token,
          activeWorkspace.id,
          editing.item.id,
          {
            title,
            description:
              editDescription.trim() ||
              null,
          },
        );
      }

      if (
        editing.kind ===
        "report"
      ) {
        await workspaceExperienceApi.updateReport(
          token,
          activeWorkspace.id,
          editing.item.id,
          {
            title,
            description:
              editDescription.trim() ||
              null,
            savedAnalysisIds:
              editAnalysisIds,
          },
        );
      }

      closeEditing();

      setNotice(
        "Changes saved successfully.",
      );

      await loadWorkspaceRecords();
    } catch (
      cause
    ) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save these changes.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function deleteRecord(
    kind:
      | "query"
      | "analysis"
      | "report",
    id: string,
    title: string,
  ) {
    if (
      !activeWorkspace
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${title}"? This action cannot be undone.`,
      );

    if (!confirmed) {
      return;
    }

    const token =
      getAccessToken();

    if (!token) {
      clearAccessToken();

      router.replace(
        `/login?next=${encodeURIComponent(
          `/dashboard/${section}`,
        )}`,
      );

      return;
    }

    setBusyId(id);
    clearFeedback();

    try {
      if (
        kind === "query"
      ) {
        await workspaceExperienceApi.deleteSavedQuery(
          token,
          activeWorkspace.id,
          id,
        );
      }

      if (
        kind === "analysis"
      ) {
        await workspaceExperienceApi.deleteSavedAnalysis(
          token,
          activeWorkspace.id,
          id,
        );
      }

      if (
        kind === "report"
      ) {
        await workspaceExperienceApi.deleteReport(
          token,
          activeWorkspace.id,
          id,
        );
      }

      if (
        expandedId === id
      ) {
        setExpandedId(null);
      }

      setNotice(
        "Deleted successfully.",
      );

      await loadWorkspaceRecords();
    } catch (
      cause
    ) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not delete this item.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleCopy(
    value: string,
    label: string,
  ) {
    try {
      await copyToClipboard(
        value,
      );

      setError(null);
      setNotice(
        `${label} copied to clipboard.`,
      );
    } catch (
      cause
    ) {
      setNotice(null);

      setError(
        cause instanceof Error
          ? cause.message
          : `Could not copy ${label.toLowerCase()}.`,
      );
    }
  }

  async function createReport(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !activeWorkspace ||
      busyId
    ) {
      return;
    }

    const title =
      reportTitle.trim();

    if (!title) {
      setError(
        "A report title is required.",
      );

      return;
    }

    if (
      reportAnalysisIds.length ===
      0
    ) {
      setError(
        "Select at least one saved analysis.",
      );

      return;
    }

    const token =
      getAccessToken();

    if (!token) {
      clearAccessToken();

      router.replace(
        `/login?next=%2Fdashboard%2Freports`,
      );

      return;
    }

    setBusyId(
      "create-report",
    );

    clearFeedback();

    try {
      await workspaceExperienceApi.createReport(
        token,
        activeWorkspace.id,
        {
          title,
          description:
            reportDescription.trim() ||
            null,
          savedAnalysisIds:
            reportAnalysisIds,
        },
      );

      setReportTitle("");
      setReportDescription("");
      setReportAnalysisIds(
        [],
      );

      setNotice(
        "Report created successfully.",
      );

      await loadWorkspaceRecords();
    } catch (
      cause
    ) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not create the report.",
      );
    } finally {
      setBusyId(null);
    }
  }

  const pageStyle: CSSProperties =
    {
      background:
        "var(--background)",
      color:
        "var(--foreground)",
    };

  return (
    <main
      style={pageStyle}
      className="min-h-screen px-4 pb-12 pt-7 transition-colors duration-300 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-[1240px]">
        <header className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.025] shadow-[0_30px_100px_rgba(0,0,0,0.2)]">
          <div className="p-5 sm:p-7">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
                  <span>
                    {meta.eyebrow}
                  </span>

                  <span className="text-white/15">
                    /
                  </span>

                  <span>
                    {activeWorkspace?.name ??
                      "Workspace"}
                  </span>
                </div>

                <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
                  {meta.title}
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">
                  {meta.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/dashboard/query"
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
                >
                  New query
                </Link>

                <button
                  type="button"
                  disabled={
                    loading
                  }
                  onClick={() => {
                    clearFeedback();
                    void loadWorkspaceRecords();
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-sm font-semibold text-white/80 transition hover:bg-white/[0.055] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading
                    ? "Refreshing…"
                    : "Refresh"}
                </button>
              </div>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <WorkspaceMetric
                label="Saved queries"
                value={
                  queries.length
                }
                active={
                  section ===
                  "saved-queries"
                }
              />

              <WorkspaceMetric
                label="Saved analyses"
                value={
                  analyses.length
                }
                active={
                  section ===
                  "saved-analyses"
                }
              />

              <WorkspaceMetric
                label="Reports"
                value={
                  reports.length
                }
                active={
                  section ===
                  "reports"
                }
              />

              <WorkspaceMetric
                label="History"
                value={
                  history.length
                }
                active={
                  section ===
                  "history"
                }
              />
            </div>
          </div>
        </header>

        <nav className="mt-5 overflow-x-auto">
          <div className="flex min-w-max gap-2">
            {sectionOrder.map(
              (item) => {
                const active =
                  section ===
                  item;

                return (
                  <Link
                    key={item}
                    href={`/dashboard/${item}`}
                    className={[
                      "rounded-xl border px-4 py-2.5 text-xs font-semibold transition",
                      active
                        ? "border-indigo-400/25 bg-indigo-400/10 text-indigo-200"
                        : "border-white/[0.08] bg-white/[0.02] text-white/45 hover:border-white/[0.12] hover:text-white/80",
                    ].join(" ")}
                  >
                    {
                      sectionMeta[
                        item
                      ].title
                    }
                  </Link>
                );
              },
            )}

            <Link
              href="/dashboard/datasets"
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-xs font-semibold text-white/45 transition hover:border-white/[0.12] hover:text-white/80"
            >
              Datasets
            </Link>
          </div>
        </nav>

        {(error ||
          notice) && (
          <div
            role={
              error
                ? "alert"
                : "status"
            }
            className={[
              "mt-5 rounded-2xl border px-4 py-3.5 text-sm",
              error
                ? "border-red-400/20 bg-red-400/[0.06] text-red-200"
                : "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200",
            ].join(" ")}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-bold">
                {error
                  ? "!"
                  : "✓"}
              </span>

              <p className="flex-1 leading-6">
                {error ??
                  notice}
              </p>

              <button
                type="button"
                onClick={
                  clearFeedback
                }
                className="shrink-0 text-xs text-white/35 transition hover:text-white/70"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {section ===
          "reports" && (
          <ReportBuilder
            analyses={
              analyses
            }
            title={
              reportTitle
            }
            description={
              reportDescription
            }
            selectedIds={
              reportAnalysisIds
            }
            busy={
              busyId ===
              "create-report"
            }
            onTitleChange={
              setReportTitle
            }
            onDescriptionChange={
              setReportDescription
            }
            onSelectedIdsChange={
              setReportAnalysisIds
            }
            onSubmit={
              createReport
            }
          />
        )}

        <section className="mt-5 overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.025] shadow-[0_25px_90px_rgba(0,0,0,0.16)]">
          <div className="border-b border-white/[0.07] p-5 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">
                  Workspace records
                </p>

                <p className="mt-1 text-sm text-white/40">
                  {loading ||
                  workspaceLoading
                    ? "Loading current workspace data…"
                    : `${formatNumber(
                        visibleCount,
                      )} visible · ${formatNumber(
                        totalCount,
                      )} total`}
                </p>
              </div>

              <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
                <label className="relative min-w-0 sm:w-[320px]">
                  <span className="sr-only">
                    Search workspace records
                  </span>

                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25">
                    <SearchIcon />
                  </span>

                  <input
                    value={search}
                    onChange={(
                      event,
                    ) =>
                      setSearch(
                        event.target
                          .value,
                      )
                    }
                    placeholder={`Search ${meta.title.toLowerCase()}…`}
                    className="h-11 w-full rounded-xl border border-white/[0.09] bg-black/10 pl-10 pr-9 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-indigo-400/35 focus:bg-black/15"
                  />

                  {search && (
                    <button
                      type="button"
                      onClick={() =>
                        setSearch(
                          "",
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/25 transition hover:text-white/70"
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </label>

                {section ===
                  "history" && (
                  <div className="flex rounded-xl border border-white/[0.09] bg-black/10 p-1">
                    {(
                      [
                        [
                          "all",
                          "All",
                        ],
                        [
                          "success",
                          "Success",
                        ],
                        [
                          "failed",
                          "Failed",
                        ],
                      ] as const
                    ).map(
                      ([
                        value,
                        label,
                      ]) => (
                        <button
                          key={
                            value
                          }
                          type="button"
                          onClick={() =>
                            setHistoryFilter(
                              value,
                            )
                          }
                          className={[
                            "rounded-lg px-3 py-2 text-xs font-semibold transition",
                            historyFilter ===
                            value
                              ? "bg-white/[0.07] text-white"
                              : "text-white/35 hover:text-white/70",
                          ].join(
                            " ",
                          )}
                        >
                          {
                            label
                          }
                        </button>
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {loading ||
          workspaceLoading ? (
            <WorkspaceSkeleton />
          ) : section ===
            "saved-queries" ? (
            <SavedQueriesList
              queries={
                filteredQueries
              }
              datasetNames={
                datasetNames
              }
              expandedId={
                expandedId
              }
              busyId={
                busyId
              }
              onToggle={(
                id,
              ) =>
                setExpandedId(
                  (
                    current,
                  ) =>
                    current ===
                    id
                      ? null
                      : id,
                )
              }
              onOpen={(
                item,
              ) =>
                openQueryEditor(
                  router,
                  item.datasetId,
                  item.sql,
                  item.question,
                )
              }
              onCopy={(
                item,
              ) =>
                void handleCopy(
                  item.sql,
                  "SQL",
                )
              }
              onEdit={(
                item,
              ) =>
                startEditing(
                  {
                    kind: "query",
                    item,
                  },
                )
              }
              onDelete={(
                item,
              ) =>
                void deleteRecord(
                  "query",
                  item.id,
                  item.title,
                )
              }
            />
          ) : section ===
            "saved-analyses" ? (
            <SavedAnalysesList
              analyses={
                filteredAnalyses
              }
              datasetNames={
                datasetNames
              }
              expandedId={
                expandedId
              }
              busyId={
                busyId
              }
              onToggle={(
                id,
              ) =>
                setExpandedId(
                  (
                    current,
                  ) =>
                    current ===
                    id
                      ? null
                      : id,
                )
              }
              onOpen={(
                item,
              ) =>
                openQueryEditor(
                  router,
                  item.datasetIds
                    .length ===
                    1
                    ? item
                        .datasetIds[0]
                    : null,
                  item.sql,
                  item.question,
                  item.datasetIds,
                )
              }
              onCopy={(
                item,
              ) =>
                void handleCopy(
                  item.sql,
                  "SQL",
                )
              }
              onEdit={(
                item,
              ) =>
                startEditing(
                  {
                    kind: "analysis",
                    item,
                  },
                )
              }
              onDelete={(
                item,
              ) =>
                void deleteRecord(
                  "analysis",
                  item.id,
                  item.title,
                )
              }
            />
          ) : section ===
            "reports" ? (
            <ReportsList
              reports={
                filteredReports
              }
              analyses={
                analyses
              }
              expandedId={
                expandedId
              }
              busyId={
                busyId
              }
              onToggle={(
                id,
              ) =>
                setExpandedId(
                  (
                    current,
                  ) =>
                    current ===
                    id
                      ? null
                      : id,
                )
              }
              onEdit={(
                item,
              ) =>
                startEditing(
                  {
                    kind: "report",
                    item,
                  },
                )
              }
              onDelete={(
                item,
              ) =>
                void deleteRecord(
                  "report",
                  item.id,
                  item.title,
                )
              }
              onOpenAnalysis={(
                item,
              ) =>
                openQueryEditor(
                  router,
                  item.datasetIds
                    .length ===
                    1
                    ? item
                        .datasetIds[0]
                    : null,
                  item.sql,
                  item.question,
                  item.datasetIds,
                )
              }
            />
          ) : (
            <HistoryList
              history={
                filteredHistory
              }
              datasetNames={
                datasetNames
              }
              onOpen={(
                item,
              ) =>
                openQueryEditor(
                  router,
                  item.datasetId,
                  item.sql,
                  item.question,
                )
              }
            />
          )}
        </section>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-xs text-white/25">
            Workspace data is scoped to the active workspace.
          </p>

          <Link
            href="/dashboard/datasets"
            className="text-xs font-semibold text-white/40 transition hover:text-white/75"
          >
            Manage datasets →
          </Link>
        </div>
      </div>

      {editing && (
        <EditWorkspaceModal
          target={
            editing
          }
          title={
            editTitle
          }
          description={
            editDescription
          }
          selectedAnalysisIds={
            editAnalysisIds
          }
          analyses={
            analyses
          }
          busy={
            busyId ===
            editing.item.id
          }
          onTitleChange={
            setEditTitle
          }
          onDescriptionChange={
            setEditDescription
          }
          onSelectedAnalysisIdsChange={
            setEditAnalysisIds
          }
          onClose={
            closeEditing
          }
          onSubmit={
            saveEditing
          }
        />
      )}
    </main>
  );
}

function WorkspaceMetric({
  label,
  value,
  active,
}: {
  label: string;
  value: number;
  active: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border p-4 transition",
        active
          ? "border-indigo-400/20 bg-indigo-400/[0.06]"
          : "border-white/[0.07] bg-black/[0.08]",
      ].join(" ")}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/25">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
        {formatNumber(
          value,
        )}
      </p>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="divide-y divide-white/[0.06]">
      {Array.from({
        length: 4,
      }).map(
        (
          _,
          index,
        ) => (
          <div
            key={
              index
            }
            className="animate-pulse p-5 sm:p-6"
          >
            <div className="h-4 w-[35%] rounded bg-white/[0.07]" />

            <div className="mt-3 h-3 w-[60%] rounded bg-white/[0.05]" />

            <div className="mt-5 h-16 rounded-2xl bg-white/[0.04]" />
          </div>
        ),
      )}
    </div>
  );
}

function SavedQueriesList({
  queries,
  datasetNames,
  expandedId,
  busyId,
  onToggle,
  onOpen,
  onCopy,
  onEdit,
  onDelete,
}: {
  queries: SavedQuery[];
  datasetNames: Map<
    string,
    string
  >;
  expandedId:
    | string
    | null;
  busyId:
    | string
    | null;
  onToggle: (
    id: string,
  ) => void;
  onOpen: (
    item: SavedQuery,
  ) => void;
  onCopy: (
    item: SavedQuery,
  ) => void;
  onEdit: (
    item: SavedQuery,
  ) => void;
  onDelete: (
    item: SavedQuery,
  ) => void;
}) {
  if (
    !queries.length
  ) {
    return (
      <EmptyState
        icon="⌘"
        title="No saved queries found"
        description="Save a query from the results workspace and it will appear here."
        action={
          <Link
            href="/dashboard/query"
            className="inline-flex rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-white/90"
          >
            Open query workspace
          </Link>
        }
      />
    );
  }

  return (
    <div className="divide-y divide-white/[0.06]">
      {queries.map(
        (
          item,
        ) => {
          const expanded =
            expandedId ===
            item.id;

          const datasetName =
            item.datasetId
              ? datasetNames.get(
                  item.datasetId,
                )
              : null;

          return (
            <article
              key={
                item.id
              }
              className="p-5 transition-colors hover:bg-white/[0.015] sm:p-6"
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <button
                  type="button"
                  onClick={() =>
                    onToggle(
                      item.id,
                    )
                  }
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-semibold text-white">
                      {
                        item.title
                      }
                    </h2>

                    {datasetName && (
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/35">
                        {
                          datasetName
                        }
                      </span>
                    )}
                  </div>

                  <p className="mt-2 max-w-3xl line-clamp-2 text-sm leading-6 text-white/45">
                    {item.question ||
                      item.description ||
                      "Saved SQL query."}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/25">
                    <span>
                      Updated{" "}
                      {formatShortDate(
                        item.updatedAt,
                      )}
                    </span>

                    <span>
                      SQL{" "}
                      {item.sql.length.toLocaleString(
                        "en-IN",
                      )}{" "}
                      chars
                    </span>

                    <span>
                      {expanded
                        ? "Hide SQL"
                        : "View SQL"}
                    </span>
                  </div>
                </button>

                <div className="flex flex-wrap gap-2">
                  <SmallAction
                    label="Open"
                    onClick={() =>
                      onOpen(
                        item,
                      )
                    }
                  />

                  <SmallAction
                    label="Copy SQL"
                    onClick={() =>
                      onCopy(
                        item,
                      )
                    }
                  />

                  <SmallAction
                    label="Edit"
                    onClick={() =>
                      onEdit(
                        item,
                      )
                    }
                  />

                  <SmallAction
                    label="Delete"
                    danger
                    disabled={
                      busyId ===
                      item.id
                    }
                    onClick={() =>
                      onDelete(
                        item,
                      )
                    }
                  />
                </div>
              </div>

              {expanded && (
                <SqlViewer
                  sql={
                    item.sql
                  }
                  onCopy={() =>
                    onCopy(
                      item,
                    )
                  }
                />
              )}
            </article>
          );
        },
      )}
    </div>
  );
}

function SavedAnalysesList({
  analyses,
  datasetNames,
  expandedId,
  busyId,
  onToggle,
  onOpen,
  onCopy,
  onEdit,
  onDelete,
}: {
  analyses: SavedAnalysis[];
  datasetNames: Map<
    string,
    string
  >;
  expandedId:
    | string
    | null;
  busyId:
    | string
    | null;
  onToggle: (
    id: string,
  ) => void;
  onOpen: (
    item: SavedAnalysis,
  ) => void;
  onCopy: (
    item: SavedAnalysis,
  ) => void;
  onEdit: (
    item: SavedAnalysis,
  ) => void;
  onDelete: (
    item: SavedAnalysis,
  ) => void;
}) {
  if (
    !analyses.length
  ) {
    return (
      <EmptyState
        icon="✦"
        title="No saved analyses found"
        description="Save a completed analysis from the query workspace to keep the result snapshot and SQL together."
        action={
          <Link
            href="/dashboard/query"
            className="inline-flex rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-white/90"
          >
            Open query workspace
          </Link>
        }
      />
    );
  }

  return (
    <div className="divide-y divide-white/[0.06]">
      {analyses.map(
        (
          item,
        ) => {
          const expanded =
            expandedId ===
            item.id;

          const snapshot =
            normalizeSnapshot(
              item.resultSnapshot,
            );

          return (
            <article
              key={
                item.id
              }
              className="p-5 transition-colors hover:bg-white/[0.015] sm:p-6"
            >
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() =>
                        onToggle(
                          item.id,
                        )
                      }
                      className="w-full text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-semibold text-white">
                          {
                            item.title
                          }
                        </h2>

                        <span className="rounded-full border border-indigo-400/20 bg-indigo-400/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-indigo-200">
                          {
                            formatNumber(
                              snapshot.rowCount,
                            )
                          }{" "}
                          rows
                        </span>
                      </div>

                      <p className="mt-2 max-w-3xl line-clamp-2 text-sm leading-6 text-white/45">
                        {item.question ||
                          item.description ||
                          "Saved result analysis."}
                      </p>
                    </button>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {item.datasetIds.map(
                        (
                          datasetId,
                        ) => (
                          <span
                            key={
                              datasetId
                            }
                            className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-white/35"
                          >
                            {
                              datasetNames.get(
                                datasetId,
                              ) ??
                              truncate(
                                datasetId,
                                12,
                              )
                            }
                          </span>
                        ),
                      )}
                    </div>

                    <p className="mt-3 text-xs text-white/25">
                      Updated{" "}
                      {formatDate(
                        item.updatedAt,
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <SmallAction
                      label="Open"
                      onClick={() =>
                        onOpen(
                          item,
                        )
                      }
                    />

                    <SmallAction
                      label="Copy SQL"
                      onClick={() =>
                        onCopy(
                          item,
                        )
                      }
                    />

                    <SmallAction
                      label={
                        expanded
                          ? "Hide result"
                          : "View result"
                      }
                      onClick={() =>
                        onToggle(
                          item.id,
                        )
                      }
                    />

                    <SmallAction
                      label="Edit"
                      onClick={() =>
                        onEdit(
                          item,
                        )
                      }
                    />

                    <SmallAction
                      label="Delete"
                      danger
                      disabled={
                        busyId ===
                        item.id
                      }
                      onClick={() =>
                        onDelete(
                          item,
                        )
                      }
                    />
                  </div>
                </div>

                {expanded && (
                  <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <SavedResultTable
                      snapshot={
                        snapshot
                      }
                    />

                    <SqlViewer
                      sql={
                        item.sql
                      }
                      onCopy={() =>
                        onCopy(
                          item,
                        )
                      }
                    />
                  </div>
                )}
              </div>
            </article>
          );
        },
      )}
    </div>
  );
}

function ReportsList({
  reports,
  analyses,
  expandedId,
  busyId,
  onToggle,
  onEdit,
  onDelete,
  onOpenAnalysis,
}: {
  reports: Report[];
  analyses: SavedAnalysis[];
  expandedId:
    | string
    | null;
  busyId:
    | string
    | null;
  onToggle: (
    id: string,
  ) => void;
  onEdit: (
    item: Report,
  ) => void;
  onDelete: (
    item: Report,
  ) => void;
  onOpenAnalysis: (
    item: SavedAnalysis,
  ) => void;
}) {
  if (
    !reports.length
  ) {
    return (
      <EmptyState
        icon="▤"
        title="No reports found"
        description="Create a report by grouping one or more saved analyses."
      />
    );
  }

  return (
    <div className="divide-y divide-white/[0.06]">
      {reports.map(
        (
          item,
        ) => {
          const expanded =
            expandedId ===
            item.id;

          const includedAnalyses =
            item.savedAnalysisIds
              .map(
                (
                  analysisId,
                ) =>
                  analyses.find(
                    (
                      analysis,
                    ) =>
                      analysis.id ===
                      analysisId,
                  ),
              )
              .filter(
                (
                  analysis,
                ): analysis is SavedAnalysis =>
                  Boolean(
                    analysis,
                  ),
              );

          return (
            <article
              key={
                item.id
              }
              className="p-5 transition-colors hover:bg-white/[0.015] sm:p-6"
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <button
                  type="button"
                  onClick={() =>
                    onToggle(
                      item.id,
                    )
                  }
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-white">
                      {
                        item.title
                      }
                    </h2>

                    <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/35">
                      {
                        item.savedAnalysisIds
                          .length
                      }{" "}
                      {item.savedAnalysisIds
                        .length ===
                      1
                        ? "analysis"
                        : "analyses"}
                    </span>
                  </div>

                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">
                    {item.description ||
                      "Workspace report collection."}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/25">
                    <span>
                      Updated{" "}
                      {formatShortDate(
                        item.updatedAt,
                      )}
                    </span>

                    <span>
                      Created{" "}
                      {formatShortDate(
                        item.createdAt,
                      )}
                    </span>

                    <span>
                      {expanded
                        ? "Hide report"
                        : "View report"}
                    </span>
                  </div>
                </button>

                <div className="flex flex-wrap gap-2">
                  <SmallAction
                    label={
                      expanded
                        ? "Collapse"
                        : "View"
                    }
                    onClick={() =>
                      onToggle(
                        item.id,
                      )
                    }
                  />

                  <SmallAction
                    label="Edit"
                    onClick={() =>
                      onEdit(
                        item,
                      )
                    }
                  />

                  <SmallAction
                    label="Delete"
                    danger
                    disabled={
                      busyId ===
                      item.id
                    }
                    onClick={() =>
                      onDelete(
                        item,
                      )
                    }
                  />
                </div>
              </div>

              {expanded && (
                <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/[0.08] p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/25">
                        Included analyses
                      </p>

                      <p className="mt-1 text-sm text-white/40">
                        Analyses currently linked to this report.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onEdit(
                          item,
                        )
                      }
                      className="text-xs font-semibold text-indigo-200 transition hover:text-indigo-100"
                    >
                      Manage
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {includedAnalyses.map(
                      (
                        analysis,
                      ) => (
                        <div
                          key={
                            analysis.id
                          }
                          className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">
                                {
                                  analysis.title
                                }
                              </p>

                              <p className="mt-1 text-xs text-white/30">
                                {
                                  analysis.datasetIds
                                    .length
                                }{" "}
                                {analysis.datasetIds
                                  .length ===
                                1
                                  ? "dataset"
                                  : "datasets"}{" "}
                                ·{" "}
                                {formatShortDate(
                                  analysis.updatedAt,
                                )}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                onOpenAnalysis(
                                  analysis,
                                )
                              }
                              className="shrink-0 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/[0.04] hover:text-white"
                            >
                              Open
                            </button>
                          </div>
                        </div>
                      ),
                    )}

                    {!includedAnalyses.length && (
                      <p className="rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-4 text-sm text-amber-200/70">
                        The saved analyses linked to this report are no longer available in the current workspace response.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        },
      )}
    </div>
  );
}

function HistoryList({
  history,
  datasetNames,
  onOpen,
}: {
  history: QueryHistoryItem[];
  datasetNames: Map<
    string,
    string
  >;
  onOpen: (
    item: QueryHistoryItem,
  ) => void;
}) {
  if (
    !history.length
  ) {
    return (
      <EmptyState
        icon="◷"
        title="No query history found"
        description="Run a query and its execution record will appear here."
        action={
          <Link
            href="/dashboard/query"
            className="inline-flex rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-white/90"
          >
            Run a query
          </Link>
        }
      />
    );
  }

  return (
    <div className="divide-y divide-white/[0.06]">
      {history.map(
        (
          item,
        ) => {
          const success =
            item.status ===
            "success";

          const datasetName =
            datasetNames.get(
              item.datasetId,
            ) ??
            truncate(
              item.datasetId,
              16,
            );

          return (
            <article
              key={
                item.id
              }
              className="p-5 transition-colors hover:bg-white/[0.015] sm:p-6"
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="max-w-3xl truncate text-base font-semibold text-white">
                      {item.question ||
                        "SQL query"}
                    </h2>

                    <span
                      className={[
                        "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]",
                        success
                          ? "border-emerald-400/15 bg-emerald-400/[0.05] text-emerald-200"
                          : "border-red-400/15 bg-red-400/[0.05] text-red-200",
                      ].join(" ")}
                    >
                      {
                        item.status
                      }
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-white/35">
                      {
                        datasetName
                      }
                    </span>

                    <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-white/35">
                      {
                        formatNumber(
                          item.rowCount,
                        )
                      }{" "}
                      rows
                    </span>

                    <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-white/35">
                      {
                        formatDuration(
                          item.executionTimeMs,
                        )
                      }
                    </span>

                    <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-white/35">
                      {
                        formatDate(
                          item.createdAt,
                        )
                      }
                    </span>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/[0.16] px-4 py-3">
                    <code className="block overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-white/40">
                      {
                        truncate(
                          item.sql,
                          520,
                        )
                      }
                    </code>
                  </div>

                  {item.failureType && (
                    <p className="mt-3 text-xs text-white/30">
                      Failure type:{" "}
                      <span className="text-white/50">
                        {
                          item.failureType
                        }
                      </span>
                    </p>
                  )}

                  {item.errorMessage && (
                    <div className="mt-3 rounded-xl border border-red-400/15 bg-red-400/[0.05] px-4 py-3 text-xs leading-5 text-red-200/75">
                      {
                        item.errorMessage
                      }
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  <SmallAction
                    label="Open in editor"
                    onClick={() =>
                      onOpen(
                        item,
                      )
                    }
                  />
                </div>
              </div>
            </article>
          );
        },
      )}
    </div>
  );
}

function SqlViewer({
  sql,
  onCopy,
}: {
  sql: string;
  onCopy: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#090c11]">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/25">
          SQL
        </p>

        <button
          type="button"
          onClick={
            onCopy
          }
          className="text-xs font-semibold text-indigo-200 transition hover:text-indigo-100"
        >
          Copy
        </button>
      </div>

      <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[11px] leading-6 text-white/55">
        {
          sql
        }
      </pre>
    </div>
  );
}

function SavedResultTable({
  snapshot,
}: {
  snapshot: ReturnType<
    typeof normalizeSnapshot
  >;
}) {
  if (
    !snapshot.columns.length
  ) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-black/[0.08] p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/25">
          Saved result
        </p>

        <p className="mt-3 text-sm leading-6 text-white/40">
          This analysis does not contain a tabular result snapshot.
        </p>
      </div>
    );
  }

  const visibleRows =
    snapshot.rows.slice(
      0,
      8,
    );

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-black/[0.08]">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/25">
            Saved result
          </p>

          <p className="mt-1 text-xs text-white/30">
            Showing{" "}
            {Math.min(
              visibleRows.length,
              8,
            )}{" "}
            preview rows
          </p>
        </div>

        <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[10px] font-semibold text-white/35">
          {
            formatNumber(
              snapshot.rowCount,
            )
          }{" "}
          total
        </span>
      </div>

      <div className="max-h-[360px] overflow-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-[#11151b] text-white/40">
            <tr>
              {snapshot.columns.map(
                (
                  column,
                  index,
                ) => (
                  <th
                    key={`${column}-${index}`}
                    className="whitespace-nowrap border-b border-white/[0.06] px-3 py-3 font-semibold"
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
            {visibleRows.map(
              (
                row,
                rowIndex,
              ) => (
                <tr
                  key={
                    rowIndex
                  }
                  className="border-b border-white/[0.05] last:border-0"
                >
                  {snapshot.columns.map(
                    (
                      _,
                      columnIndex,
                    ) => (
                      <td
                        key={
                          columnIndex
                        }
                        className="max-w-56 truncate px-3 py-3 text-white/45"
                        title={formatCellValue(
                          row[
                            columnIndex
                          ],
                        )}
                      >
                        {formatCellValue(
                          row[
                            columnIndex
                          ],
                        )}
                      </td>
                    ),
                  )}
                </tr>
              ),
            )}

            {!visibleRows.length && (
              <tr>
                <td
                  colSpan={
                    snapshot
                      .columns
                      .length
                  }
                  className="px-4 py-8 text-center text-white/30"
                >
                  No rows were captured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportBuilder({
  analyses,
  title,
  description,
  selectedIds,
  busy,
  onTitleChange,
  onDescriptionChange,
  onSelectedIdsChange,
  onSubmit,
}: {
  analyses: SavedAnalysis[];
  title: string;
  description: string;
  selectedIds: string[];
  busy: boolean;
  onTitleChange: (
    value: string,
  ) => void;
  onDescriptionChange: (
    value: string,
  ) => void;
  onSelectedIdsChange: (
    value: string[],
  ) => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void;
}) {
  return (
    <section className="mt-5 rounded-[28px] border border-white/[0.08] bg-white/[0.025] p-5 shadow-[0_25px_90px_rgba(0,0,0,0.14)] sm:p-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">
          Report builder
        </p>

        <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">
          Create a report from saved analyses
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">
          Give the report a clear identity, then select the saved analyses that should belong to it.
        </p>
      </div>

      <form
        onSubmit={
          onSubmit
        }
        className="mt-5 grid gap-5 xl:grid-cols-[0.85fr_1.15fr]"
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/25">
              Report title
            </span>

            <input
              value={
                title
              }
              onChange={(
                event,
              ) =>
                onTitleChange(
                  event
                    .target
                    .value,
                )
              }
              maxLength={
                200
              }
              required
              placeholder="e.g. Q4 Sales Review"
              className="h-11 w-full rounded-xl border border-white/[0.09] bg-black/10 px-3.5 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-indigo-400/35"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/25">
              Description
            </span>

            <textarea
              value={
                description
              }
              onChange={(
                event,
              ) =>
                onDescriptionChange(
                  event
                    .target
                    .value,
                )
              }
              maxLength={
                2000
              }
              rows={
                4
              }
              placeholder="Optional report context"
              className="w-full resize-none rounded-xl border border-white/[0.09] bg-black/10 px-3.5 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/20 focus:border-indigo-400/35"
            />
          </label>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-black/[0.08] px-4 py-3">
            <p className="text-xs text-white/40">
              {
                selectedIds.length
              }{" "}
              {selectedIds.length ===
              1
                ? "analysis"
                : "analyses"}{" "}
              selected
            </p>

            <button
              type="button"
              onClick={() =>
                onSelectedIdsChange(
                  [],
                )
              }
              className="text-xs font-semibold text-white/30 transition hover:text-white/70"
            >
              Clear
            </button>
          </div>

          <button
            type="submit"
            disabled={
              busy ||
              !selectedIds.length
            }
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {busy
              ? "Creating…"
              : "Create report"}
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-black/[0.08]">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/25">
              Saved analyses
            </p>
          </div>

          {analyses.length ? (
            <div className="max-h-[360px] overflow-auto p-2">
              {analyses.map(
                (
                  analysis,
                ) => {
                  const selected =
                    selectedIds.includes(
                      analysis.id,
                    );

                  return (
                    <label
                      key={
                        analysis.id
                      }
                      className="flex cursor-pointer gap-3 rounded-xl p-3 transition hover:bg-white/[0.03]"
                    >
                      <input
                        type="checkbox"
                        checked={
                          selected
                        }
                        onChange={(
                          event,
                        ) =>
                          onSelectedIdsChange(
                            event
                              .target
                              .checked
                              ? Array.from(
                                  new Set(
                                    [
                                      ...selectedIds,
                                      analysis.id,
                                    ],
                                  ),
                                )
                              : selectedIds.filter(
                                  (
                                    id,
                                  ) =>
                                    id !==
                                    analysis.id,
                                ),
                          )
                        }
                        className="mt-1 h-4 w-4 accent-indigo-500"
                      />

                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-white/80">
                          {
                            analysis.title
                          }
                        </span>

                        <span className="mt-1 block text-xs leading-5 text-white/30">
                          {analysis.question ||
                            analysis.description ||
                            "Saved analysis"}
                        </span>
                      </span>
                    </label>
                  );
                },
              )}
            </div>
          ) : (
            <div className="p-7 text-center">
              <p className="text-sm font-semibold text-white/70">
                No saved analyses yet
              </p>

              <p className="mt-1 text-xs leading-5 text-white/30">
                Save an analysis from the query workspace before creating a report.
              </p>
            </div>
          )}
        </div>
      </form>
    </section>
  );
}

function EditWorkspaceModal({
  target,
  title,
  description,
  selectedAnalysisIds,
  analyses,
  busy,
  onTitleChange,
  onDescriptionChange,
  onSelectedAnalysisIdsChange,
  onClose,
  onSubmit,
}: {
  target: EditTarget;
  title: string;
  description: string;
  selectedAnalysisIds: string[];
  analyses: SavedAnalysis[];
  busy: boolean;
  onTitleChange: (
    value: string,
  ) => void;
  onDescriptionChange: (
    value: string,
  ) => void;
  onSelectedAnalysisIdsChange: (
    value: string[],
  ) => void;
  onClose: () => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void;
}) {
  useEffect(
    () => {
      const handleKeyDown =
        (
          event: KeyboardEvent,
        ) => {
          if (
            event.key ===
            "Escape"
          ) {
            onClose();
          }
        };

      window.addEventListener(
        "keydown",
        handleKeyDown,
      );

      return () =>
        window.removeEventListener(
          "keydown",
          handleKeyDown,
        );
    },
    [onClose],
  );

  const isReport =
    target.kind ===
    "report";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(
        event,
      ) => {
        if (
          event.currentTarget ===
          event.target
        ) {
          onClose();
        }
      }}
      role="presentation"
    >
      <form
        onSubmit={
          onSubmit
        }
        className="max-h-[92vh] w-full overflow-auto rounded-t-[28px] border border-white/[0.1] bg-[#0d1117] p-5 shadow-2xl sm:max-w-2xl sm:rounded-[28px] sm:p-6"
        aria-label={`Edit ${target.kind}`}
      >
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/25">
              Edit{" "}
              {target.kind}
            </p>

            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">
              Update workspace record
            </h2>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] text-lg text-white/35 transition hover:bg-white/[0.04] hover:text-white/80"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/25">
              Title
            </span>

            <input
              value={
                title
              }
              onChange={(
                event,
              ) =>
                onTitleChange(
                  event
                    .target
                    .value,
                )
              }
              maxLength={
                200
              }
              required
              autoFocus
              className="h-11 w-full rounded-xl border border-white/[0.09] bg-black/10 px-3.5 text-sm text-white outline-none transition focus:border-indigo-400/35"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/25">
              Description
            </span>

            <textarea
              value={
                description
              }
              onChange={(
                event,
              ) =>
                onDescriptionChange(
                  event
                    .target
                    .value,
                )
              }
              maxLength={
                2000
              }
              rows={
                4
              }
              placeholder="Optional description"
              className="w-full resize-none rounded-xl border border-white/[0.09] bg-black/10 px-3.5 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/20 focus:border-indigo-400/35"
            />
          </label>

          {isReport && (
            <div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/25">
                    Included analyses
                  </p>

                  <p className="mt-1 text-xs text-white/30">
                    Select the analyses that belong to this report.
                  </p>
                </div>

                <span className="text-xs font-semibold text-white/40">
                  {
                    selectedAnalysisIds.length
                  }{" "}
                  selected
                </span>
              </div>

              <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-white/[0.07] bg-black/[0.08] p-2">
                {analyses.map(
                  (
                    analysis,
                  ) => {
                    const selected =
                      selectedAnalysisIds.includes(
                        analysis.id,
                      );

                    return (
                      <label
                        key={
                          analysis.id
                        }
                        className="flex cursor-pointer gap-3 rounded-xl p-3 transition hover:bg-white/[0.03]"
                      >
                        <input
                          type="checkbox"
                          checked={
                            selected
                          }
                          onChange={(
                            event,
                          ) =>
                            onSelectedAnalysisIdsChange(
                              event
                                .target
                                .checked
                                ? Array.from(
                                    new Set(
                                      [
                                        ...selectedAnalysisIds,
                                        analysis.id,
                                      ],
                                    ),
                                  )
                                : selectedAnalysisIds.filter(
                                    (
                                      id,
                                    ) =>
                                      id !==
                                      analysis.id,
                                  ),
                            )
                          }
                          className="mt-1 h-4 w-4 accent-indigo-500"
                        />

                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-white/80">
                            {
                              analysis.title
                            }
                          </span>

                          <span className="mt-1 block text-xs leading-5 text-white/30">
                            {analysis.question ||
                              "Saved analysis"}
                          </span>
                        </span>
                      </label>
                    );
                  },
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={
              onClose
            }
            className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-sm font-semibold text-white/75 transition hover:bg-white/[0.05]"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={
              busy
            }
            className="h-11 rounded-xl bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {busy
              ? "Saving…"
              : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function SmallAction({
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      disabled={
        disabled
      }
      className={[
        "rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-35",
        danger
          ? "border-red-400/15 bg-red-400/[0.04] text-red-200/75 hover:bg-red-400/[0.08]"
          : "border-white/[0.08] bg-white/[0.02] text-white/65 hover:bg-white/[0.05] hover:text-white",
      ].join(" ")}
    >
      {
        label
      }
    </button>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-6 py-16 text-center sm:px-10">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.025] text-lg text-indigo-200">
        {
          icon
        }
      </div>

      <h2 className="mt-4 text-base font-semibold text-white">
        {
          title
        }
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/35">
        {
          description
        }
      </p>

      {action && (
        <div className="mt-5">
          {
            action
          }
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle
        cx="11"
        cy="11"
        r="6.5"
      />

      <path
        d="M16 16L21 21"
        strokeLinecap="round"
      />
    </svg>
  );
}