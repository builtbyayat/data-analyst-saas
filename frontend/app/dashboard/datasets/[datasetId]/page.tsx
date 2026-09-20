"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ApiError,
  type Dataset,
  type DatasetContext,
  type DatasetPreview,
  datasetApi,
} from "../../../../lib/api";

import {
  clearAccessToken,
  getAccessToken,
} from "../../../../lib/auth";

import { useWorkspace } from "../../workspace-context";

type Theme = "dark" | "light";

// ============================================================
// ICONS
// ============================================================

function ArrowLeftIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </svg>
  );
}

function ArrowRightIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function FileIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v5h5" />
      <path d="M8.5 12h7" />
      <path d="M8.5 16h7" />
    </svg>
  );
}

function DatabaseIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="7" ry="3" />
      <path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
      <path d="M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" />
    </svg>
  );
}

function RefreshIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 11a8.1 8.1 0 0 0-14.9-4" />
      <path d="M4 4v5h5" />
      <path d="M4 13a8.1 8.1 0 0 0 14.9 4" />
      <path d="M20 20v-5h-5" />
    </svg>
  );
}

function SparkleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3-1.2 5.1L6 9.5l4.8 1.4L12 16l1.2-5.1L18 9.5l-4.8-1.4L12 3Z" />
      <path d="m19 15-.6 2.4L16 18l2.4.6L19 21l.6-2.4L22 18l-2.4-.6L19 15Z" />
    </svg>
  );
}

function TableIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M9 4v16" />
      <path d="M15 4v16" />
    </svg>
  );
}

function ColumnsIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="M15 3v18" />
    </svg>
  );
}

function HardDriveIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 15h.01" />
      <path d="M11 15h.01" />
      <path d="M15 15h.01" />
      <path d="M3 10h18" />
    </svg>
  );
}

function SunIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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

function MoonIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.5 14.7A8.5 8.5 0 0 1 9.3 3.5 8.5 8.5 0 1 0 20.5 14.7Z" />
    </svg>
  );
}

// ============================================================
// FORMATTERS
// ============================================================

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
    processing: "bg-blue-500 animate-pulse",
    pending: "bg-amber-500",
    failed: "bg-red-500",
  };

  return <span className={`h-2 w-2 rounded-full ${classes[status]}`} aria-hidden="true" />;
}

function formatCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function DatasetDetailPage() {
  const router = useRouter();
  const params = useParams<{ datasetId: string }>();

  const datasetId = typeof params.datasetId === "string" ? params.datasetId : "";

  const { activeWorkspace, loading: workspaceLoading } = useWorkspace();

  // DEFAULT DARK MODE SET HERE
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [context, setContext] = useState<DatasetContext | null>(null);
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // ==========================================================
  // THEME INITIALIZATION & PERSISTENCE
  // ==========================================================

  useEffect(() => {
    setMounted(true);
    const saved = window.localStorage.getItem("ai-data-analyst-theme") as Theme | null;

    if (saved) {
      setTheme(saved);
    } else {
      // Always fallback to dark mode for new users
      setTheme("dark");
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    window.localStorage.setItem("ai-data-analyst-theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme, mounted]);

  const colors = useMemo(() =>
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
          muted: "#666666",
          mutedStrong: "#404040",
          border: "rgba(0,0,0,0.08)",
          borderStrong: "rgba(0,0,0,0.15)",
          card: "#ffffff",
          surface: "#f1f5f9",
          accent: "#4f46e5",
        },
    [theme]
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
  } as React.CSSProperties;

  // ==========================================================
  // API LOAD LOGIC
  // ==========================================================

  const loadDataset = useCallback(async (showLoading = true) => {
    if (!activeWorkspace || !datasetId) return;

    const token = getAccessToken();
    if (!token) {
      clearAccessToken();
      router.replace(`/login?next=${encodeURIComponent(`/dashboard/datasets/${datasetId}`)}`);
      return;
    }

    if (showLoading) {
      setLoading(true);
      setError(null);
    }

    try {
      const datasets = await datasetApi.list(token, activeWorkspace.id);
      const currentDataset = datasets.find((item) => item.id === datasetId);

      if (!currentDataset) {
        throw new Error("Dataset was not found in this workspace.");
      }

      setDataset(currentDataset);

      if (currentDataset.status !== "ready") {
        setContext(null);
        setPreview(null);
        setPreviewError(null);
      }

      setError(null);
    } catch (requestError) {
      if (requestError instanceof ApiError && (requestError.status === 401 || requestError.status === 403)) {
        clearAccessToken();
        router.replace(`/login?next=${encodeURIComponent(`/dashboard/datasets/${datasetId}`)}`);
        return;
      }

      if (showLoading) {
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : requestError instanceof Error
              ? requestError.message
              : "Unable to load dataset."
        );
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [activeWorkspace, datasetId, router]);

  const loadContext = useCallback(async (showLoading = true) => {
    if (!activeWorkspace || !datasetId || !dataset || dataset.status !== "ready") return;

    const token = getAccessToken();
    if (!token) {
      clearAccessToken();
      router.replace(`/login?next=${encodeURIComponent(`/dashboard/datasets/${datasetId}`)}`);
      return;
    }

    if (showLoading) {
      setLoading(true);
      setError(null);
    }

    try {
      const result = await datasetApi.context(token, activeWorkspace.id, datasetId);
      setContext(result);
      setError(null);
    } catch (requestError) {
      if (requestError instanceof ApiError && (requestError.status === 401 || requestError.status === 403)) {
        clearAccessToken();
        router.replace(`/login?next=${encodeURIComponent(`/dashboard/datasets/${datasetId}`)}`);
        return;
      }

      if (showLoading) {
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : requestError instanceof Error
              ? requestError.message
              : "Unable to load dataset analysis context."
        );
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [activeWorkspace, dataset, datasetId, router]);

  const loadPreview = useCallback(async (showLoading = true) => {
    if (!activeWorkspace || !datasetId || !dataset || dataset.status !== "ready") return;

    const token = getAccessToken();
    if (!token) {
      clearAccessToken();
      router.replace(`/login?next=${encodeURIComponent(`/dashboard/datasets/${datasetId}`)}`);
      return;
    }

    if (showLoading) {
      setPreviewLoading(true);
      setPreviewError(null);
    }

    try {
      const result = await datasetApi.preview(token, activeWorkspace.id, datasetId, 100);
      setPreview(result);

      if (showLoading) setPreviewError(null);
    } catch (requestError) {
      if (requestError instanceof ApiError && (requestError.status === 401 || requestError.status === 403)) {
        clearAccessToken();
        router.replace(`/login?next=${encodeURIComponent(`/dashboard/datasets/${datasetId}`)}`);
        return;
      }

      if (showLoading) {
        setPreviewError(
          requestError instanceof ApiError
            ? requestError.message
            : requestError instanceof Error
              ? requestError.message
              : "Unable to load dataset preview."
        );
      }
    } finally {
      if (showLoading) setPreviewLoading(false);
    }
  }, [activeWorkspace, dataset, datasetId, router]);

  // ==========================================================
  // EFFECTS
  // ==========================================================

  useEffect(() => {
    void loadDataset(true);
  }, [loadDataset]);

  useEffect(() => {
    if (!dataset || !(dataset.status === "pending" || dataset.status === "processing")) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadDataset(false);
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [dataset, loadDataset]);

  useEffect(() => {
    if (!dataset || dataset.status !== "ready") return;
    void loadContext(true);
  }, [dataset, loadContext]);

  useEffect(() => {
    if (!context || context.dataset.status !== "ready") return;
    void loadPreview(true);
  }, [context, loadPreview]);

  const columns = context?.columns ?? [];
  const queryHref = dataset ? `/dashboard/query?datasetId=${encodeURIComponent(dataset.id)}` : "#";

  // ==========================================================
  // WAIT FOR CLIENT
  // ==========================================================

  if (!mounted) return null;

  // ==========================================================
  // LOADING STATE
  // ==========================================================

  if (workspaceLoading || loading) {
    return (
      <main style={themeStyle} className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased transition-colors duration-500">
        <div className="mx-auto w-full max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="animate-pulse">
            <div className="h-3 w-28 rounded-full bg-[var(--border-strong)]" />
            <div className="mt-5 h-10 w-72 max-w-full rounded-xl bg-[var(--border-strong)]" />
            <div className="mt-3 h-5 w-96 max-w-full rounded-full bg-[var(--border)]" />
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-32 rounded-[28px] border border-[var(--border)] bg-[var(--card)] shadow-sm animate-pulse" />
            ))}
          </div>

          <div className="mt-6 h-[360px] rounded-[28px] border border-[var(--border)] bg-[var(--card)] shadow-sm animate-pulse" />
          <div className="mt-6 h-[420px] rounded-[28px] border border-[var(--border)] bg-[var(--card)] shadow-sm animate-pulse" />
        </div>
      </main>
    );
  }

  // ==========================================================
  // ERROR STATE
  // ==========================================================

  if (error && !dataset) {
    return (
      <main style={themeStyle} className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased transition-colors duration-500">
        <div className="mx-auto w-full max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <Link
            href="/dashboard/datasets"
            className="inline-flex items-center gap-2 text-[13px] font-bold text-[var(--muted-strong)] transition-colors hover:text-indigo-500"
          >
            <ArrowLeftIcon />
            Back to datasets
          </Link>

          <div className="mt-8 rounded-[28px] border border-red-500/30 bg-red-500/10 p-8 shadow-sm">
            <p className="text-[16px] font-bold text-red-600 dark:text-red-400">Unable to load dataset</p>
            <p className="mt-2 max-w-2xl text-[14px] font-medium leading-relaxed text-red-500 dark:text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => void loadDataset(true)}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl border border-red-500/30 bg-[var(--card)] px-5 text-[13px] font-bold text-red-600 shadow-sm transition hover:bg-red-500/10 dark:text-red-400 active:scale-95"
            >
              <RefreshIcon />
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================================
  // NOT FOUND STATE
  // ==========================================================

  if (!dataset) {
    return (
      <main style={themeStyle} className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased transition-colors duration-500">
        <div className="mx-auto w-full max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <Link
            href="/dashboard/datasets"
            className="inline-flex items-center gap-2 text-[13px] font-bold text-[var(--muted-strong)] transition-colors hover:text-indigo-500"
          >
            <ArrowLeftIcon />
            Back to datasets
          </Link>

          <div className="mt-8 rounded-[28px] border border-red-500/30 bg-red-500/10 p-8 shadow-sm">
            <p className="text-[16px] font-bold text-red-600 dark:text-red-400">Dataset could not be found.</p>
            <p className="mt-2 text-[14px] font-medium text-red-500 dark:text-red-300">
              The dataset may have been deleted or is no longer available in this workspace.
            </p>
            <button
              type="button"
              onClick={() => void loadDataset(true)}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl border border-red-500/30 bg-[var(--card)] px-5 text-[13px] font-bold text-red-600 shadow-sm transition hover:bg-red-500/10 dark:text-red-400 active:scale-95"
            >
              <RefreshIcon />
              Refresh
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================================
  // MAIN PAGE RENDER
  // ==========================================================

  return (
    <main style={themeStyle} className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased transition-colors duration-500">
      <style jsx global>{`
        ::selection { background-color: var(--text); color: var(--bg); }
        html { scroll-behavior: smooth; scroll-padding-top: 100px; }
      `}</style>

      <div className="mx-auto w-full max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">

        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <section className="border-b border-[var(--border)] pb-8">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard/datasets"
              className="inline-flex items-center gap-2 text-[13px] font-bold text-[var(--muted-strong)] transition-colors hover:text-indigo-500 dark:hover:text-indigo-400"
            >
              <ArrowLeftIcon />
              Back to datasets
            </Link>

            <button
              onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-strong)] transition-all hover:bg-[var(--surface)] hover:text-[var(--text)] hover:border-[var(--border-strong)] active:scale-95"
              aria-label="Toggle theme"
            >
              {theme === "light" ? <MoonIcon className="h-[18px] w-[18px]" /> : <SunIcon className="h-[18px] w-[18px]" />}
            </button>
          </div>

          <div className="mt-7 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                <p className="truncate text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--muted-strong)]">
                  {activeWorkspace?.name ?? "Workspace"}
                </p>
              </div>

              <div className="mt-4 flex items-start gap-4">
                <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--card)] text-[var(--muted-strong)] shadow-sm sm:flex">
                  <FileIcon className="h-7 w-7" />
                </div>

                <div className="min-w-0">
                  <h1 className="truncate text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl lg:text-5xl">
                    {dataset.name}
                  </h1>
                  <p className="mt-2 truncate text-[14px] font-medium text-[var(--muted)] sm:text-[15px]">
                    {dataset.originalFilename}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <span className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.06em] shadow-sm ${statusClasses(dataset.status)}`}>
                <StatusDot status={dataset.status} />
                {statusLabel(dataset.status)}
              </span>

              {dataset.status === "ready" && (
                <Link
                  href={queryHref}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-[13px] font-bold text-white shadow-[0_10px_30px_rgba(79,70,229,0.2)] transition-all hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-[0_14px_35px_rgba(79,70,229,0.28)] active:scale-95"
                >
                  <SparkleIcon />
                  Analyze dataset
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              )}

              {(dataset.status === "pending" || dataset.status === "processing") && (
                <button
                  type="button"
                  onClick={() => void loadDataset(true)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 text-[13px] font-bold text-[var(--muted-strong)] shadow-sm transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface)] hover:text-[var(--text)] active:scale-95"
                >
                  <RefreshIcon />
                  Refresh
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ================================================== */}
        {/* ERROR / FAILED */}
        {/* ================================================== */}

        {(error || dataset.status === "failed") && (
          <section className="mt-8 rounded-[28px] border border-red-500/30 bg-red-500/10 p-6 shadow-sm">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[15px] font-bold text-red-600 dark:text-red-400">Dataset processing failed</p>
                <p className="mt-2 max-w-3xl text-[13px] font-medium leading-relaxed text-red-500 dark:text-red-300">
                  {error ?? "Dataset ingestion failed."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadDataset(true)}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-[var(--card)] px-5 text-[13px] font-bold text-red-600 shadow-sm transition hover:bg-red-500/10 dark:text-red-400 active:scale-95"
              >
                <RefreshIcon />
                Refresh status
              </button>
            </div>
          </section>
        )}

        {/* ================================================== */}
        {/* PROCESSING STATE */}
        {/* ================================================== */}

        {(dataset.status === "pending" || dataset.status === "processing") && (
          <section className="relative mt-8 overflow-hidden rounded-[28px] border border-blue-500/20 bg-blue-500/[0.04] shadow-sm">
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-500/[0.07] blur-[90px]" />

            <div className="relative p-7 sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                    Processing
                  </div>

                  <h2 className="mt-5 text-xl font-bold tracking-tight text-[var(--text)]">
                    {dataset.status === "pending" ? "Dataset queued for processing" : "Dataset is being processed"}
                  </h2>

                  <p className="mt-2 max-w-2xl text-[14px] font-medium leading-relaxed text-[var(--muted-strong)]">
                    The ingestion worker is processing the uploaded file, detecting columns, profiling the data, and preparing the analytical dataset.
                  </p>
                </div>

                <div className="shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">Status updates</p>
                  <p className="mt-2 text-[13px] font-semibold text-[var(--text)]">Refreshing automatically</p>
                  <div className="mt-4 h-1.5 w-44 overflow-hidden rounded-full bg-[var(--surface)]">
                    <div className="h-full w-1/2 animate-pulse rounded-full bg-indigo-500" />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <span className={`rounded-full border px-4 py-2 text-[11px] font-bold ${dataset.status === "pending" ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-sm" : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"}`}>
                  Pending
                </span>
                <span className="text-[var(--muted)]">→</span>
                <span className={`rounded-full border px-4 py-2 text-[11px] font-bold ${dataset.status === "processing" ? "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm" : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"}`}>
                  Processing
                </span>
                <span className="text-[var(--muted)]">→</span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[11px] font-bold text-[var(--muted)]">
                  Ready
                </span>
              </div>
            </div>
          </section>
        )}

        {/* ================================================== */}
        {/* OVERVIEW */}
        {/* ================================================== */}

        <section className="mt-12">
          <div className="mb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Dataset overview</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text)]">Data at a glance</h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="group rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-7 shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:shadow-md hover:border-indigo-500/30">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">Rows</p>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-strong)] group-hover:text-indigo-500 transition-colors">
                  <TableIcon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-6 text-3xl font-bold tracking-tight text-[var(--text)]">{dataset.rowCount.toLocaleString()}</p>
              <p className="mt-2 text-[13px] font-medium text-[var(--muted)]">Records in dataset</p>
            </div>

            <div className="group rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-7 shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:shadow-md hover:border-indigo-500/30">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">Columns</p>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-strong)] group-hover:text-indigo-500 transition-colors">
                  <ColumnsIcon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-6 text-3xl font-bold tracking-tight text-[var(--text)]">{dataset.columnCount.toLocaleString()}</p>
              <p className="mt-2 text-[13px] font-medium text-[var(--muted)]">Detected fields</p>
            </div>

            <div className="group rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-7 shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:shadow-md hover:border-indigo-500/30">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">File size</p>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-strong)] group-hover:text-indigo-500 transition-colors">
                  <HardDriveIcon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-6 text-3xl font-bold tracking-tight text-[var(--text)]">{formatFileSize(dataset.fileSize)}</p>
              <p className="mt-2 text-[13px] font-medium text-[var(--muted)]">Uploaded file size</p>
            </div>

            <div className="group rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-7 shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:shadow-md hover:border-indigo-500/30">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">File type</p>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-strong)] group-hover:text-indigo-500 transition-colors">
                  <FileIcon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-6 truncate text-[22px] font-bold tracking-tight text-[var(--text)]">{dataset.fileType}</p>
              <p className="mt-3 truncate text-[12px] font-medium text-[var(--muted)]">{formatDate(dataset.createdAt)}</p>
            </div>
          </div>
        </section>

        {/* ================================================== */}
        {/* SCHEMA */}
        {/* ================================================== */}

        <section className="mt-14">
          <div className="mb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Structure</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text)]">Schema & profiling</h2>
            <p className="mt-2 max-w-2xl text-[15px] font-medium leading-relaxed text-[var(--muted-strong)]">
              Detected structure and basic profiling information for this dataset.
            </p>
          </div>

          {dataset.status !== "ready" ? (
            <div className="rounded-[32px] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-12 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--card)] text-[var(--muted-strong)] shadow-sm">
                <ColumnsIcon className="h-7 w-7" />
              </div>
              <h3 className="mt-6 text-[18px] font-bold text-[var(--text)]">Schema will appear after processing</h3>
              <p className="mx-auto mt-3 max-w-lg text-[15px] font-medium leading-relaxed text-[var(--muted-strong)]">
                The dataset is currently in the <span className="font-bold text-[var(--text)]">{dataset.status}</span> state. The page will refresh automatically.
              </p>
            </div>
          ) : columns.length === 0 ? (
            <div className="rounded-[32px] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-12 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--card)] text-[var(--muted-strong)] shadow-sm">
                <DatabaseIcon className="h-7 w-7" />
              </div>
              <h3 className="mt-6 text-[18px] font-bold text-[var(--text)]">No column information available</h3>
              <p className="mx-auto mt-3 max-w-lg text-[15px] font-medium leading-relaxed text-[var(--muted-strong)]">
                The backend did not return any column metadata for this dataset.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Schema Table */}
              <div className="hidden overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--card)] shadow-[0_10px_30px_rgba(0,0,0,0.02)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.3)] md:block">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left">
                    <thead className="border-b border-[var(--border)] bg-[var(--surface)]">
                      <tr className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">
                        <th className="px-6 py-5">#</th>
                        <th className="px-6 py-5">Column</th>
                        <th className="px-6 py-5">Data type</th>
                        <th className="px-6 py-5">Nullable</th>
                        <th className="px-6 py-5">Null count</th>
                        <th className="px-6 py-5">Distinct</th>
                      </tr>
                    </thead>
                    <tbody>
                      {columns
                        .slice()
                        .sort((a, b) => a.ordinalPosition - b.ordinalPosition)
                        .map((column) => (
                          <tr
                            key={`${column.ordinalPosition}-${column.name}`}
                            className="group border-b border-[var(--border)] transition-colors last:border-b-0 hover:bg-[var(--surface)]"
                          >
                            <td className="px-6 py-5 text-[14px] font-medium text-[var(--muted)]">
                              {column.ordinalPosition}
                            </td>
                            <td className="px-6 py-5">
                              <span className="font-bold text-[15px] text-[var(--text)] transition-colors group-hover:text-indigo-500">
                                {column.name}
                              </span>
                            </td>
                            <td className="px-6 py-5">
                              <span className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-[12px] font-semibold text-[var(--muted-strong)] shadow-sm">
                                {column.dataType}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-[14px] font-semibold text-[var(--muted-strong)]">
                              {column.nullable ? "Yes" : "No"}
                            </td>
                            <td className="px-6 py-5 text-[14px] font-semibold text-[var(--muted-strong)]">
                              {column.nullCount.toLocaleString()}
                            </td>
                            <td className="px-6 py-5 text-[14px] font-semibold text-[var(--muted-strong)]">
                              {column.distinctCount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Schema Cards */}
              <div className="space-y-4 md:hidden">
                {columns
                  .slice()
                  .sort((a, b) => a.ordinalPosition - b.ordinalPosition)
                  .map((column) => (
                    <div
                      key={`${column.ordinalPosition}-${column.name}`}
                      className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-[16px] font-bold text-[var(--text)]">
                            {column.name}
                          </p>
                          <span className="mt-3 inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--muted-strong)]">
                            {column.dataType}
                          </span>
                        </div>
                        <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-bold text-[var(--muted)]">
                          #{column.ordinalPosition}
                        </span>
                      </div>

                      <div className="mt-6 grid grid-cols-3 gap-3 border-t border-[var(--border)] pt-5">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">Nullable</p>
                          <p className="mt-2 text-[14px] font-bold text-[var(--text)]">{column.nullable ? "Yes" : "No"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">Nulls</p>
                          <p className="mt-2 text-[14px] font-bold text-[var(--text)]">{column.nullCount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">Distinct</p>
                          <p className="mt-2 text-[14px] font-bold text-[var(--text)]">{column.distinctCount.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </section>

        {/* ================================================== */}
        {/* DATA PREVIEW */}
        {/* ================================================== */}

        <section className="mt-14">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Sample data</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text)]">Data preview</h2>
              <p className="mt-2 max-w-2xl text-[15px] font-medium leading-relaxed text-[var(--muted-strong)]">
                Showing the first 100 rows from the processed dataset.
              </p>
            </div>

            {preview && (
              <span className="inline-flex w-fit rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[12px] font-bold text-[var(--text)] shadow-sm">
                {preview.rowCount.toLocaleString()} preview rows
                {preview.truncated ? " · truncated" : ""}
              </span>
            )}
          </div>

          {dataset.status !== "ready" ? (
            <div className="rounded-[32px] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-12 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--card)] text-[var(--muted-strong)] shadow-sm">
                <TableIcon className="h-7 w-7" />
              </div>
              <h3 className="mt-6 text-[18px] font-bold text-[var(--text)]">Preview will be available when processing completes</h3>
              <p className="mx-auto mt-3 max-w-lg text-[15px] font-medium leading-relaxed text-[var(--muted-strong)]">
                The dataset is currently in the <span className="font-bold text-[var(--text)]">{dataset.status}</span> state.
              </p>
            </div>
          ) : previewLoading ? (
            <div className="overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--card)] shadow-sm">
              <div className="animate-pulse p-8">
                <div className="h-12 rounded-xl bg-[var(--surface)]" />
                <div className="mt-4 space-y-4">
                  {[1, 2, 3, 4, 5].map((item) => (
                    <div key={item} className="h-12 rounded-xl bg-[var(--surface)]" />
                  ))}
                </div>
              </div>
            </div>
          ) : previewError ? (
            <div className="rounded-[28px] border border-red-500/30 bg-red-500/10 p-8 shadow-sm">
              <p className="text-[16px] font-bold text-red-600 dark:text-red-400">Unable to load preview</p>
              <p className="mt-2 text-[14px] font-medium leading-relaxed text-red-500 dark:text-red-300">{previewError}</p>
              <button
                type="button"
                onClick={() => void loadPreview(true)}
                className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl border border-red-500/30 bg-[var(--card)] px-6 text-[14px] font-bold text-red-600 shadow-sm transition hover:bg-red-500/10 dark:text-red-400 active:scale-95"
              >
                <RefreshIcon />
                Retry preview
              </button>
            </div>
          ) : !preview || preview.columns.length === 0 ? (
            <div className="rounded-[32px] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-12 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--card)] text-[var(--muted-strong)] shadow-sm">
                <DatabaseIcon className="h-7 w-7" />
              </div>
              <h3 className="mt-6 text-[18px] font-bold text-[var(--text)]">No preview data</h3>
              <p className="mx-auto mt-3 max-w-lg text-[15px] font-medium leading-relaxed text-[var(--muted-strong)]">
                The processed dataset did not return preview rows.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--card)] shadow-[0_10px_30px_rgba(0,0,0,0.02)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
              <div className="max-h-[600px] overflow-auto custom-scrollbar">
                <table className="min-w-full text-left">
                  <thead className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]">
                    <tr className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">
                      <th className="sticky left-0 bg-[var(--surface)] px-6 py-5 border-r border-[var(--border)] z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                        #
                      </th>
                      {preview.columns.map((column) => (
                        <th key={column} className="whitespace-nowrap px-6 py-5">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-[var(--border)] transition-colors last:border-b-0 hover:bg-[var(--surface)]">
                        <td className="sticky left-0 bg-[var(--card)] px-6 py-4 text-[13px] font-bold text-[var(--muted)] border-r border-[var(--border)] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)] transition-colors">
                          {rowIndex + 1}
                        </td>
                        {preview.columns.map((column, columnIndex) => (
                          <td key={`${rowIndex}-${column}`} className="whitespace-nowrap px-6 py-4 text-[14px] font-medium text-[var(--muted-strong)]">
                            {formatCellValue(row[columnIndex])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* ================================================== */}
        {/* ANALYZE CTA */}
        {/* ================================================== */}

        {dataset.status === "ready" && (
          <section className="relative mt-14 overflow-hidden rounded-[36px] border border-indigo-500/20 bg-indigo-500/[0.04] shadow-sm">
            <div className="pointer-events-none absolute -right-24 -top-32 h-[400px] w-[400px] rounded-full bg-indigo-500/[0.07] blur-[120px]" />

            <div className="relative flex flex-col gap-8 p-10 sm:p-12 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">
                  <SparkleIcon className="h-4 w-4" />
                  Ready for analysis
                </div>

                <h2 className="mt-6 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
                  Ask questions about your data.
                </h2>

                <p className="mt-4 text-[16px] font-medium leading-relaxed text-[var(--muted-strong)]">
                  Use natural language to explore trends, compare metrics, find patterns, and generate decision-ready insights.
                </p>
              </div>

              <Link
                href={queryHref}
                className="group inline-flex h-14 shrink-0 items-center justify-center gap-3 rounded-2xl bg-indigo-600 px-8 text-[15px] font-bold text-white shadow-[0_12px_35px_rgba(79,70,229,0.25)] transition-all duration-300 hover:-translate-y-1 hover:bg-indigo-700 hover:shadow-[0_20px_45px_rgba(79,70,229,0.35)] active:scale-[0.98]"
              >
                <SparkleIcon />
                Start analyzing
                <div className="transition-transform group-hover:translate-x-1">
                  <ArrowRightIcon />
                </div>
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}