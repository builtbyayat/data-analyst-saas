"use client";

import Link from "next/link";
import {
  ChangeEvent,
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  ApiError,
  Dataset,
  datasetApi,
} from "../../lib/api";

import {
  clearAccessToken,
  getAccessToken,
} from "../../lib/auth";

import { useWorkspace } from "./workspace-context";

type Theme = "dark" | "light";

// ==========================================
// ICONS
// ==========================================
function UploadIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 3V15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M7.5 7.5L12 3L16.5 7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 15V18C5 19.657 6.343 21 8 21H16C17.657 21 19 19.657 19 18V15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M5 12H19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M13 6L19 12L13 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v5h5" />
      <path d="M8.5 12h7" />
      <path d="M8.5 16h7" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <ellipse cx="12" cy="5" rx="7" ry="3" />
      <path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
      <path d="M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3 1.4 4.3L17 9l-3.6 1.7L12 15l-1.4-4.3L7 9l3.6-1.7L12 3Z" />
      <path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z" />
      <path d="m5 14 .6 1.8L7.5 17l-1.9.6L5 19.5l-.6-1.9L2.5 17l1.9-.6L5 14Z" />
    </svg>
  );
}

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

// ==========================================
// UI ATOMS
// ==========================================
function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="group flex min-h-[160px] h-full flex-col justify-between rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-7 shadow-sm transition duration-500 hover:-translate-y-1 hover:border-indigo-500/40 hover:shadow-[0_20px_50px_rgba(79,70,229,0.1)] dark:hover:shadow-[0_20px_50px_rgba(79,70,229,0.15)]">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted-strong)] transition-colors group-hover:text-indigo-500">
          {label}
        </p>

        <span className="h-2 w-2 rounded-full bg-[var(--border-strong)] transition-all duration-300 group-hover:scale-125 group-hover:bg-indigo-500" />
      </div>

      <div>
        <p className="mt-4 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
          {value}
        </p>

        <p className="mt-2 text-[13px] font-medium leading-relaxed text-[var(--muted-strong)]">
          {description}
        </p>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="group relative flex gap-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-all duration-300 hover:border-indigo-500/40 hover:shadow-md">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--card)] text-[11px] font-bold text-[var(--muted-strong)] transition-colors group-hover:border-indigo-500/40 group-hover:text-indigo-500">
        {number}
      </div>

      <div className="flex flex-col justify-center">
        <p className="text-[15px] font-bold tracking-tight text-[var(--text)]">
          {title}
        </p>

        <p className="mt-1 text-[13px] font-medium leading-relaxed text-[var(--muted-strong)]">
          {description}
        </p>
      </div>
    </div>
  );
}

function statusLabel(status: Dataset["status"]) {
  switch (status) {
    case "pending":
      return "Pending";
    case "processing":
      return "Processing";
    case "ready":
      return "Ready";
    case "failed":
      return "Failed";
  }
}

function statusClasses(status: Dataset["status"]) {
  switch (status) {
    case "ready":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "processing":
      return "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400";
    case "pending":
      return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "failed":
      return "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400";
  }
}

function StatusDot({ status }: { status: Dataset["status"] }) {
  const classes = {
    ready: "bg-emerald-500",
    processing: "animate-pulse bg-blue-500",
    pending: "bg-amber-500",
    failed: "bg-red-500",
  };

  return (
    <span
      className={`h-2 w-2 rounded-full ${classes[status]}`}
      aria-hidden="true"
    />
  );
}

function formatFileSize(value: string | number) {
  const bytes = Number(value);

  if (!Number.isFinite(bytes) || bytes < 0) {
    return "—";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

// ==========================================
// DASHBOARD
// ==========================================
export default function DashboardPage() {
  const router = useRouter();

  const {
    activeWorkspace,
    loading: workspaceLoading,
  } = useWorkspace();

  const [theme, setTheme] =
    useState<Theme>("dark");

  const [mounted, setMounted] =
    useState(false);

  const [datasets, setDatasets] =
    useState<Dataset[]>([]);

  const [datasetsLoading, setDatasetsLoading] =
    useState(true);

  const [datasetsError, setDatasetsError] =
    useState<string | null>(null);

  const [selectedDatasetIds, setSelectedDatasetIds] =
    useState<string[]>([]);

  // ==========================================
  // THEME
  // ==========================================
  useEffect(() => {
    setMounted(true);

    const saved =
      window.localStorage.getItem(
        "ai-data-analyst-theme",
      ) as Theme | null;

    if (saved === "light" || saved === "dark") {
      setTheme(saved);
    } else {
      setTheme("dark");
    }
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    window.localStorage.setItem(
      "ai-data-analyst-theme",
      theme,
    );

    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
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
            border: "rgba(255,255,255,0.08)",
            borderStrong: "rgba(255,255,255,0.15)",
            card: "#0a0a0a",
            surface: "#121212",
            accent: "#818cf8",
          }
        : {
            bg: "#f8fafc",
            text: "#050505",
            muted: "#64748b",
            mutedStrong: "#475569",
            border: "rgba(15,23,42,0.08)",
            borderStrong: "rgba(15,23,42,0.15)",
            card: "#ffffff",
            surface: "#f1f5f9",
            accent: "#4f46e5",
          },
    [theme],
  );

  const themeStyle = {
    "--bg": colors.bg,
    "--text": colors.text,
    "--muted": colors.muted,
    "--muted-strong": colors.mutedStrong,
    "--border": colors.border,
    "--border-strong": colors.borderStrong,
    "--card": colors.card,
    "--surface": colors.surface,
    "--accent": colors.accent,
  } as CSSProperties;

  // ==========================================
  // DATASET LOADING
  // ==========================================
  const loadDatasets = useCallback(
    async (showLoading = true) => {
      if (!activeWorkspace) {
        setDatasets([]);
        setDatasetsLoading(false);
        return;
      }

      const token = getAccessToken();

      if (!token) {
        clearAccessToken();
        router.replace(
          "/login?next=%2Fdashboard",
        );
        return;
      }

      if (showLoading) {
        setDatasetsLoading(true);
        setDatasetsError(null);
      }

      try {
        const result =
          await datasetApi.list(
            token,
            activeWorkspace.id,
          );

        setDatasets(result);

        setSelectedDatasetIds(
          (current) =>
            current.filter((datasetId) =>
              result.some(
                (dataset) =>
                  dataset.id === datasetId &&
                  dataset.status === "ready",
              ),
            ),
        );

        if (showLoading) {
          setDatasetsError(null);
        }
      } catch (requestError) {
        if (
          requestError instanceof ApiError &&
          (requestError.status === 401 ||
            requestError.status === 403)
        ) {
          clearAccessToken();
          router.replace(
            "/login?next=%2Fdashboard",
          );
          return;
        }

        if (showLoading) {
          setDatasetsError(
            requestError instanceof ApiError
              ? requestError.message
              : "Unable to load your datasets.",
          );
        }
      } finally {
        if (showLoading) {
          setDatasetsLoading(false);
        }
      }
    },
    [activeWorkspace, router],
  );

  useEffect(() => {
    void loadDatasets(true);
  }, [loadDatasets]);

  const hasProcessingDataset = useMemo(
    () =>
      datasets.some(
        (dataset) =>
          dataset.status === "pending" ||
          dataset.status === "processing",
      ),
    [datasets],
  );

  useEffect(() => {
    if (
      !activeWorkspace ||
      !hasProcessingDataset
    ) {
      return;
    }

    const interval =
      window.setInterval(() => {
        void loadDatasets(false);
      }, 3000);

    return () =>
      window.clearInterval(interval);
  }, [
    activeWorkspace,
    hasProcessingDataset,
    loadDatasets,
  ]);

  // ==========================================
  // DATASET DERIVED STATE
  // ==========================================
  const readyDatasets = useMemo(
    () =>
      datasets.filter(
        (dataset) =>
          dataset.status === "ready",
      ),
    [datasets],
  );

  const selectedDatasets = useMemo(
    () =>
      datasets.filter((dataset) =>
        selectedDatasetIds.includes(
          dataset.id,
        ),
      ),
    [datasets, selectedDatasetIds],
  );

  const totalRows = useMemo(
    () =>
      readyDatasets.reduce(
        (total, dataset) =>
          total +
          (Number.isFinite(
            Number(dataset.rowCount),
          )
            ? Number(dataset.rowCount)
            : 0),
        0,
      ),
    [readyDatasets],
  );

  const toggleDatasetSelection = (
    dataset: Dataset,
  ) => {
    if (dataset.status !== "ready") {
      return;
    }

    setSelectedDatasetIds((current) => {
      if (current.includes(dataset.id)) {
        return current.filter(
          (id) => id !== dataset.id,
        );
      }

      return [
        ...current,
        dataset.id,
      ];
    });
  };

  const clearDatasetSelection = () => {
    setSelectedDatasetIds([]);
  };

  const combinedAnalysisReady =
    selectedDatasetIds.length >= 2;

  const handleCombinedAnalysis = () => {
    if (!combinedAnalysisReady) {
      return;
    }

    /*
     * The dashboard now keeps the user's multi-dataset
     * selection as the source context for the upcoming
     * cross-file query workflow.
     *
     * The actual cross-file SQL execution layer is wired
     * separately in Milestone 3.4.
     */
    window.sessionStorage.setItem(
      "ai-data-analyst-selected-datasets",
      JSON.stringify(
        selectedDatasetIds,
      ),
    );

    router.push(
      "/dashboard/query?mode=multi",
    );
  };

  // ==========================================
  // HYDRATION
  // ==========================================
  if (!mounted) {
    return null;
  }

  // ==========================================
  // WORKSPACE LOADING
  // ==========================================
  if (workspaceLoading) {
    return (
      <main
        style={themeStyle}
        className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased transition-colors duration-500"
      >
        <div className="mx-auto w-full max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="animate-pulse">
            <div className="h-3 w-24 rounded-full bg-[var(--border-strong)]" />
            <div className="mt-4 h-10 w-48 rounded-xl bg-[var(--border-strong)]" />
            <div className="mt-3 h-5 w-80 max-w-full rounded-full bg-[var(--border)]" />
          </div>

          <div className="mt-10 h-[390px] rounded-[32px] border border-[var(--border)] bg-[var(--card)] shadow-sm" />
        </div>
      </main>
    );
  }

  // ==========================================
  // NO WORKSPACE
  // ==========================================
  if (!activeWorkspace) {
    return (
      <main
        style={themeStyle}
        className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased transition-colors duration-500"
      >
        <div className="mx-auto w-full max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="border-b border-[var(--border)] pb-8">
            <div className="flex items-center gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
                AI Data Analyst
              </p>

              <button
                type="button"
                onClick={() =>
                  setTheme((current) =>
                    current === "light"
                      ? "dark"
                      : "light",
                  )
                }
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-strong)] transition-all hover:bg-[var(--surface)] hover:text-[var(--text)]"
                aria-label="Toggle theme"
              >
                {theme === "light" ? (
                  <MoonIcon />
                ) : (
                  <SunIcon />
                )}
              </button>
            </div>

            <h1 className="mt-3 text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl">
              Your data workspace
            </h1>

            <p className="mt-3 max-w-2xl text-[16px] font-medium leading-relaxed text-[var(--muted-strong)]">
              Upload business data, ask questions in natural language, and turn raw datasets into structured analysis.
            </p>
          </div>

          <div className="mt-8 rounded-[24px] border border-amber-500/20 bg-amber-500/10 p-6 text-[15px] font-bold leading-6 text-amber-600 dark:text-amber-400">
            No workspace is available for this account.
          </div>
        </div>
      </main>
    );
  }

  // ==========================================
  // MAIN DASHBOARD
  // ==========================================
  return (
    <main
      style={themeStyle}
      className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased transition-colors duration-500"
    >
      <style jsx global>{`
        ::selection {
          background-color: var(--text);
          color: var(--bg);
        }

        html {
          scroll-behavior: smooth;
          scroll-padding-top: 100px;
        }
      `}</style>

      <div className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        {/* ==========================================
            HEADER
        ========================================== */}
        <section className="mb-8 flex flex-col gap-6 border-b border-[var(--border)] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />

              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--muted-strong)]">
                {activeWorkspace.name}
              </p>

              <button
                type="button"
                onClick={() =>
                  setTheme((current) =>
                    current === "light"
                      ? "dark"
                      : "light",
                  )
                }
                className="ml-2 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-strong)] transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface)] hover:text-[var(--text)] active:scale-95"
                aria-label="Toggle theme"
              >
                {theme === "light" ? (
                  <MoonIcon />
                ) : (
                  <SunIcon />
                )}
              </button>
            </div>

            <h1 className="mt-4 text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl">
              Your data workspace
            </h1>

            <p className="mt-3 max-w-2xl text-[16px] font-medium leading-relaxed text-[var(--muted-strong)]">
              Manage datasets, open a single analysis, or prepare multiple datasets for combined analysis.
            </p>
          </div>

          <Link
            href="/dashboard/datasets#upload-dataset"
            className="group inline-flex h-12 items-center justify-center gap-2.5 rounded-xl bg-[var(--text)] px-6 text-[14px] font-bold text-[var(--bg)] shadow-[0_8px_25px_rgba(15,23,42,0.16)] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg active:scale-95 dark:shadow-[0_8px_25px_rgba(255,255,255,0.1)]"
          >
            <UploadIcon />
            Add dataset
          </Link>
        </section>

        {/* ==========================================
            HERO
        ========================================== */}
        <section className="relative overflow-hidden rounded-[32px] border border-[var(--border)] bg-[var(--card)] shadow-[0_20px_70px_rgba(15,23,42,0.04)] transition-colors duration-500 dark:shadow-[0_20px_70px_rgba(0,0,0,0.4)]">
          <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="relative grid gap-12 p-8 sm:p-10 lg:grid-cols-[1.4fr_0.6fr] lg:p-12">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted-strong)] shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {readyDatasets.length > 0
                  ? `${readyDatasets.length} ready ${
                      readyDatasets.length === 1
                        ? "dataset"
                        : "datasets"
                    }`
                  : "Workspace ready"}
              </div>

              <h2 className="mt-6 text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl">
                Start with your data.
                <br />
                <span className="text-[var(--muted)]">
                  Let the analysis follow.
                </span>
              </h2>

              <p className="mt-5 max-w-2xl text-[16px] font-medium leading-relaxed text-[var(--muted-strong)]">
                Open any dataset for SQL or AI analysis, or select multiple ready datasets when you need a broader analytical context.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {[
                  "CSV",
                  "XLS",
                  "XLSX",
                  "Natural language",
                  "Multi-dataset ready",
                ].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 text-[12px] font-bold text-[var(--text)] shadow-sm"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/dashboard/datasets#upload-dataset"
                  className="group inline-flex h-12 items-center justify-center gap-2.5 rounded-xl bg-indigo-600 px-6 text-[14px] font-bold text-white shadow-[0_10px_25px_rgba(79,70,229,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-[0_15px_30px_rgba(79,70,229,0.3)] active:scale-95"
                >
                  Upload dataset
                  <span className="transition-transform group-hover:translate-x-1">
                    <ArrowIcon />
                  </span>
                </Link>

                <Link
                  href="/dashboard/datasets"
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-6 text-[14px] font-bold text-[var(--text)] transition-all hover:-translate-y-0.5 hover:border-indigo-500/40 hover:bg-[var(--card)] active:scale-95"
                >
                  Browse datasets
                </Link>
              </div>
            </div>

            {/* Product Preview */}
            <div className="relative flex items-center lg:justify-end">
              <div className="w-full max-w-[420px] rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] transition-transform duration-500 hover:-translate-y-1 dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                <div className="rounded-[20px] border border-[var(--border-strong)] bg-[var(--card)] p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                        Analysis context
                      </p>

                      <p className="mt-1.5 text-[15px] font-bold tracking-tight text-[var(--text)]">
                        Multiple data sources
                      </p>
                    </div>

                    <span className="rounded-lg bg-indigo-500/10 px-3 py-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                      Ready
                    </span>
                  </div>

                  <div className="mt-6 space-y-3">
                    <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-strong)] bg-[var(--card)] text-[var(--muted-strong)]">
                        <FileIcon />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-bold text-[var(--text)]">
                          customers.csv
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-[var(--muted)]">
                          Customer-level data
                        </p>
                      </div>

                      <span className="ml-auto h-2 w-2 rounded-full bg-emerald-500" />
                    </div>

                    <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-strong)] bg-[var(--card)] text-[var(--muted-strong)]">
                        <DatabaseIcon />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-bold text-[var(--text)]">
                          orders.xlsx
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-[var(--muted)]">
                          Transaction-level data
                        </p>
                      </div>

                      <span className="ml-auto h-2 w-2 rounded-full bg-emerald-500" />
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-indigo-500">
                        <SparklesIcon />
                      </div>

                      <div>
                        <p className="text-[12px] font-bold text-[var(--text)]">
                          Combined analysis
                        </p>

                        <p className="mt-1 text-[11px] font-medium leading-relaxed text-[var(--muted-strong)]">
                          Select the datasets you want to analyze together.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==========================================
            REAL DATA STATS
        ========================================== */}
        <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Datasets"
            value={datasets.length.toLocaleString()}
            description="Datasets available in this workspace."
          />

          <StatCard
            label="Ready"
            value={readyDatasets.length.toLocaleString()}
            description="Datasets currently available for analysis."
          />

          <StatCard
            label="Rows available"
            value={totalRows.toLocaleString()}
            description="Rows across ready datasets in this workspace."
          />

          <StatCard
            label="Selected"
            value={selectedDatasetIds.length.toLocaleString()}
            description="Datasets currently selected for combined analysis."
          />
        </section>

        {/* ==========================================
            DATASETS
        ========================================== */}
        <section className="mt-8 overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--card)] shadow-[0_10px_40px_rgba(15,23,42,0.03)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
          <div className="border-b border-[var(--border)] px-6 py-5 sm:px-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Workspace data
                </p>

                <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
                  Your datasets
                </h2>

                <p className="mt-2 text-[14px] font-medium leading-relaxed text-[var(--muted-strong)]">
                  Open a dataset for individual analysis or select multiple ready datasets for a combined workflow.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {hasProcessingDataset && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-blue-600 dark:text-blue-400">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                    Processing updates automatically
                  </span>
                )}

                <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[12px] font-bold text-[var(--text)]">
                  {datasets.length}{" "}
                  {datasets.length === 1
                    ? "dataset"
                    : "datasets"}
                </span>
              </div>
            </div>
          </div>

          {datasetsLoading ? (
            <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map(
                (item) => (
                  <div
                    key={item}
                    className="animate-pulse rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-11 w-11 rounded-xl bg-[var(--border)]" />
                      <div className="flex-1">
                        <div className="h-4 w-32 rounded bg-[var(--border)]" />
                        <div className="mt-2 h-3 w-24 rounded bg-[var(--border)]" />
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-3">
                      <div className="h-14 rounded-xl bg-[var(--border)]" />
                      <div className="h-14 rounded-xl bg-[var(--border)]" />
                      <div className="h-14 rounded-xl bg-[var(--border)]" />
                    </div>

                    <div className="mt-5 h-10 rounded-xl bg-[var(--border)]" />
                  </div>
                ),
              )}
            </div>
          ) : datasetsError ? (
            <div className="p-6 sm:p-8">
              <div className="rounded-[24px] border border-red-500/30 bg-red-500/10 p-6">
                <p className="text-[16px] font-bold text-red-600 dark:text-red-400">
                  Unable to load your datasets
                </p>

                <p className="mt-2 text-[14px] font-medium leading-relaxed text-red-500 dark:text-red-300">
                  {datasetsError}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    void loadDatasets(true)
                  }
                  className="mt-5 inline-flex h-11 items-center justify-center rounded-xl border border-red-500/30 bg-[var(--card)] px-5 text-[13px] font-bold text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : datasets.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--muted-strong)] shadow-sm">
                <DatabaseIcon />
              </div>

              <h3 className="mt-6 text-xl font-bold text-[var(--text)]">
                No datasets yet
              </h3>

              <p className="mt-3 max-w-md text-[14px] font-medium leading-relaxed text-[var(--muted-strong)]">
                Upload your first CSV or Excel dataset. Once it is ready, it will appear here for analysis.
              </p>

              <Link
                href="/dashboard/datasets#upload-dataset"
                className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--text)] px-6 text-[14px] font-bold text-[var(--bg)] shadow-md transition-all hover:-translate-y-0.5 active:scale-95"
              >
                Add dataset
                <ArrowIcon />
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
                {datasets.map((dataset) => {
                  const isSelected =
                    selectedDatasetIds.includes(
                      dataset.id,
                    );

                  const selectable =
                    dataset.status ===
                    "ready";

                  return (
                    <div
                      key={dataset.id}
                      className={`group rounded-[24px] border bg-[var(--surface)] p-5 transition-all duration-300 ${
                        isSelected
                          ? "border-indigo-500/50 bg-indigo-500/5 shadow-[0_15px_40px_rgba(79,70,229,0.08)]"
                          : "border-[var(--border)] hover:border-indigo-500/30 hover:shadow-md"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <Link
                          href={`/dashboard/datasets/${encodeURIComponent(
                            dataset.id,
                          )}`}
                          className="flex min-w-0 items-center gap-4"
                        >
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                              isSelected
                                ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-500"
                                : "border-[var(--border-strong)] bg-[var(--card)] text-[var(--muted-strong)] group-hover:border-indigo-500/30 group-hover:text-indigo-500"
                            }`}
                          >
                            <FileIcon />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-bold text-[var(--text)] transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">
                              {dataset.name}
                            </p>

                            <p className="mt-1 truncate text-[11px] font-medium text-[var(--muted)]">
                              {dataset.originalFilename}
                            </p>
                          </div>
                        </Link>

                        <span
                          className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.05em] ${statusClasses(
                            dataset.status,
                          )}`}
                        >
                          <StatusDot
                            status={
                              dataset.status
                            }
                          />
                          {statusLabel(
                            dataset.status,
                          )}
                        </span>
                      </div>

                      <div className="mt-5 grid grid-cols-3 gap-2.5">
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                          <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-[var(--muted)]">
                            Rows
                          </p>

                          <p className="mt-1.5 text-[13px] font-bold text-[var(--text)]">
                            {dataset.rowCount.toLocaleString()}
                          </p>
                        </div>

                        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                          <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-[var(--muted)]">
                            Columns
                          </p>

                          <p className="mt-1.5 text-[13px] font-bold text-[var(--text)]">
                            {dataset.columnCount.toLocaleString()}
                          </p>
                        </div>

                        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                          <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-[var(--muted)]">
                            Size
                          </p>

                          <p className="mt-1.5 truncate text-[13px] font-bold text-[var(--text)]">
                            {formatFileSize(
                              dataset.fileSize,
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-between gap-3">
                        <p className="truncate text-[11px] font-medium text-[var(--muted)]">
                          {formatDate(
                            dataset.createdAt,
                          )}
                        </p>

                        <div className="flex items-center gap-2">
                          {selectable && (
                            <button
                              type="button"
                              onClick={() =>
                                toggleDatasetSelection(
                                  dataset,
                                )
                              }
                              aria-pressed={
                                isSelected
                              }
                              className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3.5 text-[12px] font-bold transition-all active:scale-95 ${
                                isSelected
                                  ? "border-indigo-500/30 bg-indigo-600 text-white"
                                  : "border-[var(--border-strong)] bg-[var(--card)] text-[var(--text)] hover:border-indigo-500/40 hover:text-indigo-600 dark:hover:text-indigo-400"
                              }`}
                            >
                              {isSelected ? (
                                <>
                                  <CheckIcon />
                                  Selected
                                </>
                              ) : (
                                "Select"
                              )}
                            </button>
                          )}

                          <Link
                            href={`/dashboard/datasets/${encodeURIComponent(
                              dataset.id,
                            )}`}
                            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[var(--text)] px-3.5 text-[12px] font-bold text-[var(--bg)] transition-all hover:-translate-y-0.5 active:scale-95"
                          >
                            Open
                            <ArrowIcon />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-[var(--border)] bg-[var(--surface)] px-6 py-5 sm:px-7">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-500">
                        <SparklesIcon />
                      </div>

                      <div>
                        <p className="text-[14px] font-bold text-[var(--text)]">
                          Combined analysis
                        </p>

                        <p className="mt-1 text-[12px] font-medium text-[var(--muted-strong)]">
                          {selectedDatasetIds.length === 0
                            ? "Select at least two ready datasets to prepare a combined analysis."
                            : selectedDatasetIds.length === 1
                              ? "Select one more ready dataset to enable combined analysis."
                              : `${selectedDatasetIds.length} ready datasets selected.`}
                        </p>
                      </div>
                    </div>

                    {selectedDatasets.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedDatasets.map(
                          (dataset) => (
                            <span
                              key={dataset.id}
                              className="inline-flex max-w-full items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-3 py-1.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300"
                            >
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                              <span className="max-w-[220px] truncate">
                                {dataset.name}
                              </span>
                            </span>
                          ),
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-3">
                    {selectedDatasetIds.length >
                      0 && (
                      <button
                        type="button"
                        onClick={
                          clearDatasetSelection
                        }
                        className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--card)] px-4 text-[13px] font-bold text-[var(--muted-strong)] transition-all hover:bg-[var(--surface)] hover:text-[var(--text)] active:scale-95"
                      >
                        Clear selection
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={
                        handleCombinedAnalysis
                      }
                      disabled={
                        !combinedAnalysisReady
                      }
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(79,70,229,0.18)] transition-all hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-[var(--border-strong)] disabled:text-[var(--muted-strong)] disabled:shadow-none active:scale-95"
                    >
                      <SparklesIcon />
                      Analyze together
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* ==========================================
            WORKFLOW + QUICK ACTIONS
        ========================================== */}
        <section className="mt-8 grid gap-8 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--card)] shadow-[0_10px_40px_rgba(15,23,42,0.03)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
            <div className="border-b border-[var(--border)] px-6 py-5">
              <p className="text-[16px] font-bold text-[var(--text)]">
                How it works
              </p>

              <p className="mt-1 text-[13px] font-medium text-[var(--muted-strong)]">
                From uploaded data to individual or combined analysis.
              </p>
            </div>

            <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
              <Step
                number="01"
                title="Add your data"
                description="Upload CSV or Excel files and let the ingestion pipeline prepare them."
              />

              <Step
                number="02"
                title="Open or select"
                description="Open one dataset for focused analysis or select several ready datasets."
              />

              <Step
                number="03"
                title="Ask and analyze"
                description="Use SQL or natural language to turn the selected data context into useful results."
              />
            </div>
          </div>

          <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--card)] shadow-[0_10px_40px_rgba(15,23,42,0.03)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
            <div className="border-b border-[var(--border)] px-6 py-5">
              <p className="text-[16px] font-bold text-[var(--text)]">
                Quick actions
              </p>

              <p className="mt-1 text-[13px] font-medium text-[var(--muted-strong)]">
                Jump directly into your workspace.
              </p>
            </div>

            <div className="space-y-3 p-6">
              <Link
                href="/dashboard/datasets"
                className="group flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-all hover:border-indigo-500/30 hover:bg-indigo-500/5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--card)] text-[var(--muted-strong)] transition-colors group-hover:text-indigo-500">
                    <DatabaseIcon />
                  </div>

                  <div>
                    <p className="text-[13px] font-bold text-[var(--text)]">
                      Manage datasets
                    </p>

                    <p className="mt-1 text-[11px] font-medium text-[var(--muted)]">
                      Upload, inspect, and manage data.
                    </p>
                  </div>
                </div>

                <ArrowIcon />
              </Link>

              <Link
                href="/dashboard/query"
                className="group flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-all hover:border-indigo-500/30 hover:bg-indigo-500/5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--card)] text-[var(--muted-strong)] transition-colors group-hover:text-indigo-500">
                    <SparklesIcon />
                  </div>

                  <div>
                    <p className="text-[13px] font-bold text-[var(--text)]">
                      Open query workspace
                    </p>

                    <p className="mt-1 text-[11px] font-medium text-[var(--muted)]">
                      Write SQL or ask a question.
                    </p>
                  </div>
                </div>

                <ArrowIcon />
              </Link>
            </div>
          </div>
        </section>

        {/* ==========================================
            RECENT ACTIVITY
        ========================================== */}
        <section className="mt-8 overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--card)] shadow-[0_10px_40px_rgba(15,23,42,0.03)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
            <div>
              <p className="text-[16px] font-bold text-[var(--text)]">
                Recent activity
              </p>

              <p className="mt-1 text-[13px] font-medium text-[var(--muted-strong)]">
                Your recent analytical activity will appear here.
              </p>
            </div>

            <Link
              href="/dashboard/history"
              className="hidden text-[13px] font-bold text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 sm:block"
            >
              View history
            </Link>
          </div>

          <div className="flex min-h-[220px] items-center justify-center px-6 text-center">
            <div>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--muted-strong)] shadow-sm">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M12 7V12L15 14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="8.5"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </div>

              <p className="mt-5 text-[18px] font-bold text-[var(--text)]">
                Nothing here yet
              </p>

              <p className="mt-2 text-[14px] font-medium text-[var(--muted-strong)]">
                Run an analysis and your activity will appear here.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}