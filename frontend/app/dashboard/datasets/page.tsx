"use client";

import Link from "next/link";
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef
} from "react";
import { useRouter } from "next/navigation";

import {
  ApiError,
  Dataset,
  datasetApi,
} from "../../../lib/api";

import {
  clearAccessToken,
  getAccessToken,
} from "../../../lib/auth";

import { useWorkspace } from "../workspace-context";

type Theme = "dark" | "light";

// ==========================================
// ICONS
// ==========================================
function UploadIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
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

function TrashIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}

function ArrowIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
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

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.5 14.7A8.5 8.5 0 0 1 9.3 3.5 8.5 8.5 0 1 0 20.5 14.7Z" />
    </svg>
  );
}

// ==========================================
// FORMATTERS
// ==========================================
function formatFileSize(value: string | number) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusLabel(status: Dataset["status"]) {
  switch (status) {
    case "pending": return "Pending";
    case "processing": return "Processing";
    case "ready": return "Ready";
    case "failed": return "Failed";
  }
}

function statusClasses(status: Dataset["status"]) {
  switch (status) {
    case "ready": return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "processing": return "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400";
    case "pending": return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "failed": return "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400";
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

// ==========================================
// DROPZONE COMPONENT
// ==========================================
function UploadDropzone({
  selectedFile,
  uploading,
  onFileChange,
}: {
  selectedFile: File | null;
  uploading: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label
      htmlFor="dataset-file"
      className={`group relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed px-6 py-8 text-center transition-all duration-300 ${
        uploading
          ? "cursor-not-allowed border-[var(--border)] bg-[var(--surface)] opacity-60"
          : selectedFile
            ? "border-indigo-500/50 bg-indigo-500/5"
            : "border-[var(--border-strong)] bg-[var(--surface)] hover:border-indigo-500/40 hover:bg-indigo-500/5"
      }`}
    >
      <input
        id="dataset-file"
        type="file"
        accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={onFileChange}
        disabled={uploading}
        className="sr-only"
      />

      <div
        className={`flex h-16 w-16 items-center justify-center rounded-2xl border transition-all duration-300 shadow-sm ${
          selectedFile
            ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-500"
            : "border-[var(--border-strong)] bg-[var(--card)] text-[var(--muted-strong)] group-hover:scale-110 group-hover:border-indigo-500/30 group-hover:text-indigo-500 group-hover:bg-[var(--card)]"
        }`}
      >
        {selectedFile ? (
          <FileIcon className="h-7 w-7" />
        ) : (
          <UploadIcon className="h-7 w-7" />
        )}
      </div>

      {selectedFile ? (
        <>
          <p className="mt-5 max-w-full truncate text-[15px] font-bold text-[var(--text)]">
            {selectedFile.name}
          </p>
          <p className="mt-1.5 text-xs font-medium text-[var(--muted-strong)]">
            {formatFileSize(selectedFile.size)}
          </p>
          <p className="mt-5 text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-500 transition-colors">
            Click to choose a different file
          </p>
        </>
      ) : (
        <>
          <p className="mt-6 text-[15px] font-bold text-[var(--text)]">
            Choose a dataset to upload
          </p>
          <p className="mt-2 max-w-sm text-[13px] font-medium leading-relaxed text-[var(--muted-strong)]">
            Select a CSV or Excel file from your computer.
          </p>
          <span className="mt-5 inline-flex items-center rounded-full border border-[var(--border-strong)] bg-[var(--card)] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--muted)] shadow-sm">
            CSV · XLS · XLSX
          </span>
        </>
      )}
    </label>
  );
}

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================
export default function DatasetsPage() {
  const router = useRouter();

  // --- THEME STATE & LOGIC ---
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
  setMounted(true);
  const saved = window.localStorage.getItem("ai-data-analyst-theme") as Theme | null;
  if (saved) {
    setTheme(saved);
  } else {
    setTheme("dark");
  }
  }, []);

  useEffect(() => {
    if (mounted) {
      window.localStorage.setItem("ai-data-analyst-theme", theme);
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
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
          bg: "#ffffff",
          text: "#050505",
          muted: "#666666",
          mutedStrong: "#404040",
          border: "rgba(0,0,0,0.08)",
          borderStrong: "rgba(0,0,0,0.15)",
          card: "#fafafa",
          surface: "#f4f4f5",
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


  // --- DATASET LOGIC ---
  const { activeWorkspace, loading: workspaceLoading } = useWorkspace();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState("");

  const hasProcessingDataset = useMemo(
    () => datasets.some((dataset) => dataset.status === "pending" || dataset.status === "processing"),
    [datasets],
  );

  const loadDatasets = useCallback(
    async (showLoading = true) => {
      if (!activeWorkspace) {
        setDatasets([]);
        setLoading(false);
        return;
      }
      const token = getAccessToken();
      if (!token) {
        clearAccessToken();
        router.replace("/login?next=%2Fdashboard%2Fdatasets");
        return;
      }

      if (showLoading) {
        setLoading(true);
        setError(null);
      }

      try {
        const result = await datasetApi.list(token, activeWorkspace.id);
        setDatasets(result);
        if (showLoading) {
          setError(null);
        }
      } catch (requestError) {
        if (requestError instanceof ApiError && (requestError.status === 401 || requestError.status === 403)) {
          clearAccessToken();
          router.replace("/login?next=%2Fdashboard%2Fdatasets");
          return;
        }
        if (showLoading) {
          if (requestError instanceof ApiError) {
            setError(requestError.message);
          } else {
            setError("Unable to load datasets. Please try again.");
          }
        }
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [activeWorkspace, router],
  );

  useEffect(() => {
    void loadDatasets(true);
  }, [loadDatasets]);

  useEffect(() => {
    if (!activeWorkspace || !hasProcessingDataset) {
      return;
    }
    const interval = window.setInterval(() => {
      void loadDatasets(false);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [activeWorkspace, hasProcessingDataset, loadDatasets]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setUploadError(null);
  }

  async function handleUpload() {
    if (!activeWorkspace) {
      setUploadError("No workspace is available for this account.");
      return;
    }
    if (!selectedFile) {
      setUploadError("Please choose a CSV or Excel file.");
      return;
    }
    const token = getAccessToken();
    if (!token) {
      clearAccessToken();
      router.replace("/login?next=%2Fdashboard%2Fdatasets");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      await datasetApi.upload(token, activeWorkspace.id, selectedFile, datasetName);
      setSelectedFile(null);
      setDatasetName("");
      const fileInput = document.getElementById("dataset-file") as HTMLInputElement | null;
      if (fileInput) {
        fileInput.value = "";
      }
      await loadDatasets(false);
    } catch (requestError) {
      if (requestError instanceof ApiError && (requestError.status === 401 || requestError.status === 403)) {
        clearAccessToken();
        router.replace("/login?next=%2Fdashboard%2Fdatasets");
        return;
      }
      if (requestError instanceof ApiError) {
        setUploadError(requestError.message);
      } else {
        setUploadError("Upload failed. Please try again.");
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(dataset: Dataset) {
    const confirmed = window.confirm(`Delete "${dataset.name}"? This will remove the dataset from this workspace.`);
    if (!confirmed) return;

    const token = getAccessToken();
    if (!token) {
      clearAccessToken();
      router.replace("/login?next=%2Fdashboard%2Fdatasets");
      return;
    }

    try {
      await datasetApi.delete(token, dataset.workspaceId, dataset.id);
      setDatasets((current) => current.filter((item) => item.id !== dataset.id));
    } catch (requestError) {
      if (requestError instanceof ApiError && (requestError.status === 401 || requestError.status === 403)) {
        clearAccessToken();
        router.replace("/login?next=%2Fdashboard%2Fdatasets");
        return;
      }
      setError(requestError instanceof ApiError ? requestError.message : "Unable to delete the dataset.");
    }
  }

  if (!mounted) return null;

  // --- RENDER: LOADING STATE ---
  if (workspaceLoading) {
    return (
      <main style={themeStyle} className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased transition-colors duration-500">
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

  // --- RENDER: NO WORKSPACE STATE ---
  if (!activeWorkspace) {
    return (
      <main style={themeStyle} className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased transition-colors duration-500">
        <div className="mx-auto w-full max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="border-b border-[var(--border)] pb-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
              AI Data Analyst
            </p>
            <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight text-[var(--text)]">
              Datasets
            </h1>
            <p className="mt-3 max-w-2xl text-[16px] font-medium leading-relaxed text-[var(--muted-strong)]">
              Manage the data sources that power your analysis.
            </p>
          </div>
          <div className="mt-8 rounded-[24px] border border-amber-500/20 bg-amber-500/10 p-6 text-[15px] font-bold leading-6 text-amber-600 dark:text-amber-400">
            No workspace is available for this account.
          </div>
        </div>
      </main>
    );
  }

  // --- RENDER: MAIN PAGE ---
  return (
    <main style={themeStyle} className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased transition-colors duration-500">
      <style jsx global>{`
        ::selection { background-color: var(--text); color: var(--bg); }
        html { scroll-behavior: smooth; scroll-padding-top: 100px; }
      `}</style>

      <div className="mx-auto w-full max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">

        {/* Page Header */}
        <section className="flex flex-col gap-6 border-b border-[var(--border)] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--muted-strong)]">
                {activeWorkspace.name}
              </p>

              {/* Theme Toggle Button */}
              <button
                onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
                className="ml-2 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-strong)] transition-all hover:bg-[var(--surface)] hover:text-[var(--text)] hover:border-[var(--border-strong)] active:scale-95"
                aria-label="Toggle theme"
              >
                {theme === "light" ? <MoonIcon /> : <SunIcon />}
              </button>
            </div>

            <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight text-[var(--text)]">
              Datasets
            </h1>

            <p className="mt-3 max-w-2xl text-[16px] font-medium leading-relaxed text-[var(--muted-strong)]">
              Manage the data sources that power your analysis and natural-language queries.
            </p>
          </div>

          <a
            href="#upload-dataset"
            className="inline-flex h-12 items-center justify-center gap-2.5 rounded-xl bg-[var(--text)] px-6 text-[14px] font-bold text-[var(--bg)] shadow-[0_8px_25px_rgba(15,23,42,0.12)] dark:shadow-[0_8px_25px_rgba(255,255,255,0.1)] transition-all hover:-translate-y-1 hover:shadow-lg active:scale-95"
          >
            <UploadIcon className="h-4 w-4" />
            Upload dataset
          </a>
        </section>

        {/* Upload Section */}
        <section
          id="upload-dataset"
          className="relative mt-10 overflow-hidden rounded-[32px] border border-[var(--border)] bg-[var(--card)] shadow-[0_20px_70px_rgba(15,23,42,0.04)] dark:shadow-[0_20px_70px_rgba(0,0,0,0.3)] transition-colors duration-500"
        >
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/[0.07] blur-[100px]" />

          <div className="relative grid gap-10 p-8 sm:p-10 lg:grid-cols-[1.05fr_0.95fr] lg:p-12">
            <div>
              <div className="inline-flex items-center gap-2.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-400 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                Add data
              </div>

              <h2 className="mt-6 text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text)]">
                Bring your data into the workspace.
              </h2>

              <p className="mt-4 max-w-xl text-[16px] font-medium leading-relaxed text-[var(--muted-strong)]">
                Upload a business dataset and we'll prepare it for natural-language analysis.
              </p>

              <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-4 sm:max-w-md">
                {[
                  ["CSV", "Comma-separated data"],
                  ["XLS", "Excel workbook"],
                  ["XLSX", "Modern Excel"],
                ].map(([format, description]) => (
                  <div key={format} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm transition-all hover:border-[var(--border-strong)]">
                    <p className="text-[13px] font-bold text-[var(--text)]">{format}</p>
                    <p className="mt-2 text-[11px] font-medium leading-snug text-[var(--muted)]">{description}</p>
                  </div>
                ))}
              </div>

              <div className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--card)] text-[var(--muted-strong)] shadow-sm">
                    <DatabaseIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-[var(--text)]">What happens next?</p>
                    <p className="mt-2 text-[13px] font-medium leading-relaxed text-[var(--muted-strong)]">
                      Your file is ingested, processed, and made available for analysis once it is ready.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <UploadDropzone selectedFile={selectedFile} uploading={uploading} onFileChange={handleFileChange} />

              <div className="mt-6">
                <label htmlFor="dataset-name" className="mb-2 block text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">
                  Dataset name <span className="ml-1 font-medium normal-case tracking-normal text-[var(--muted-strong)]">(optional)</span>
                </label>
                <input
                  id="dataset-name"
                  type="text"
                  value={datasetName}
                  onChange={(event) => setDatasetName(event.target.value)}
                  placeholder="e.g. Q4 sales data"
                  disabled={uploading}
                  className="h-14 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-5 text-[15px] font-medium text-[var(--text)] shadow-sm outline-none transition-all placeholder:text-[var(--muted)] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-[var(--surface)]"
                />
              </div>

              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
                className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-indigo-600 px-6 text-[15px] font-bold text-white shadow-[0_10px_30px_rgba(79,70,229,0.2)] transition-all hover:-translate-y-1 hover:bg-indigo-700 hover:shadow-[0_15px_40px_rgba(79,70,229,0.3)] active:scale-[0.98] disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-[var(--border-strong)] disabled:text-[var(--muted-strong)] disabled:shadow-none"
              >
                {uploading ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Uploading...
                  </>
                ) : (
                  <>
                    Upload dataset
                    <ArrowIcon />
                  </>
                )}
              </button>

              {uploadError && (
                <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-[14px] font-bold leading-relaxed text-red-600 dark:text-red-400">
                  {uploadError}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Dataset List */}
        <section className="mt-12">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
                Workspace data
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text)]">
                Your datasets
              </h2>
              <p className="mt-2 text-[15px] font-medium text-[var(--muted-strong)]">
                Uploaded and processed data sources available for analysis.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {hasProcessingDataset && (
                <span className="inline-flex items-center gap-2.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-blue-600 dark:text-blue-400 shadow-sm">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                  Processing updates automatically
                </span>
              )}

              <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-[12px] font-bold text-[var(--text)] shadow-sm">
                {datasets.length} {datasets.length === 1 ? "dataset" : "datasets"}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--card)] shadow-sm">
              <div className="space-y-0">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="flex animate-pulse items-center gap-6 border-b border-[var(--border)] p-6 last:border-b-0">
                    <div className="h-12 w-12 rounded-2xl bg-[var(--border)]" />
                    <div className="flex-1">
                      <div className="h-5 w-48 rounded-md bg-[var(--border)]" />
                      <div className="mt-3 h-3 w-32 rounded-sm bg-[var(--border)]" />
                    </div>
                    <div className="hidden h-4 w-20 rounded bg-[var(--border)] sm:block" />
                    <div className="hidden h-4 w-24 rounded bg-[var(--border)] md:block" />
                    <div className="h-8 w-20 rounded-full bg-[var(--border)]" />
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="rounded-[28px] border border-red-500/30 bg-red-500/10 p-8 shadow-sm">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[16px] font-bold text-red-600 dark:text-red-400">
                    Unable to load your datasets
                  </p>
                  <p className="mt-2 text-[14px] font-medium leading-relaxed text-red-500 dark:text-red-300">
                    {error}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void loadDatasets(true)}
                  className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-[var(--card)] px-5 text-[14px] font-bold text-red-600 shadow-sm transition hover:bg-red-500/10 dark:text-red-400 active:scale-95"
                >
                  <RefreshIcon />
                  Retry
                </button>
              </div>
            </div>
          ) : datasets.length === 0 ? (
            <div className="rounded-[32px] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-20 text-center shadow-sm transition-colors">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--card)] text-[var(--muted-strong)] shadow-sm">
                <DatabaseIcon className="h-7 w-7" />
              </div>

              <h3 className="mt-6 text-xl font-bold text-[var(--text)]">
                No datasets yet
              </h3>

              <p className="mx-auto mt-3 max-w-md text-[15px] font-medium leading-relaxed text-[var(--muted-strong)]">
                Upload your first CSV or Excel dataset above to start asking questions and generating insights.
              </p>

              <a
                href="#upload-dataset"
                className="mt-8 inline-flex h-12 items-center justify-center gap-2.5 rounded-xl bg-[var(--text)] px-6 text-[14px] font-bold text-[var(--bg)] shadow-md transition-all hover:-translate-y-1 active:scale-95"
              >
                <UploadIcon className="h-4 w-4" />
                Add your first dataset
              </a>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--card)] shadow-[0_10px_30px_rgba(0,0,0,0.02)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.3)] md:block">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left">
                    <thead className="border-b border-[var(--border)] bg-[var(--surface)]">
                      <tr className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">
                        <th className="px-6 py-5">Dataset</th>
                        <th className="px-6 py-5">Size</th>
                        <th className="px-6 py-5">Rows</th>
                        <th className="px-6 py-5">Columns</th>
                        <th className="px-6 py-5">Status</th>
                        <th className="px-6 py-5">Created</th>
                        <th className="px-6 py-5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datasets.map((dataset) => (
                        <tr
                          key={dataset.id}
                          className="group border-b border-[var(--border)] transition-colors last:border-b-0 hover:bg-[var(--surface)]"
                        >
                          <td className="px-6 py-5">
                            <div className="flex min-w-[280px] items-center gap-4">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--card)] text-[var(--muted-strong)] shadow-sm transition-colors group-hover:border-indigo-500/30 group-hover:text-indigo-500 group-hover:bg-indigo-500/5">
                                <FileIcon className="h-6 w-6" />
                              </div>

                              <div className="min-w-0">
                                <Link
                                  href={`/dashboard/datasets/${encodeURIComponent(dataset.id)}`}
                                  className="block truncate text-[15px] font-bold text-[var(--text)] transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
                                >
                                  {dataset.name}
                                </Link>

                                <p className="mt-1.5 max-w-[240px] truncate text-[12px] font-medium text-[var(--muted)]">
                                  {dataset.originalFilename}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-6 py-5 text-[14px] font-semibold text-[var(--muted-strong)]">
                            {formatFileSize(dataset.fileSize)}
                          </td>

                          <td className="whitespace-nowrap px-6 py-5 text-[14px] font-bold text-[var(--text)]">
                            {dataset.rowCount.toLocaleString()}
                          </td>

                          <td className="whitespace-nowrap px-6 py-5 text-[14px] font-bold text-[var(--text)]">
                            {dataset.columnCount.toLocaleString()}
                          </td>

                          <td className="px-6 py-5">
                            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.05em] shadow-sm ${statusClasses(dataset.status)}`}>
                              <StatusDot status={dataset.status} />
                              {statusLabel(dataset.status)}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-6 py-5 text-[13px] font-medium text-[var(--muted)]">
                            {formatDate(dataset.createdAt)}
                          </td>

                          <td className="px-6 py-5 text-right">
                            <button
                              type="button"
                              onClick={() => void handleDelete(dataset)}
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-bold text-[var(--muted-strong)] transition-all hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 active:scale-95"
                            >
                              <TrashIcon />
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Cards */}
              <div className="space-y-4 md:hidden">
                {datasets.map((dataset) => (
                  <div
                    key={dataset.id}
                    className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <Link
                        href={`/dashboard/datasets/${encodeURIComponent(dataset.id)}`}
                        className="flex min-w-0 items-center gap-4 group"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--muted-strong)] transition-colors group-hover:border-indigo-500/30 group-hover:text-indigo-500 group-hover:bg-indigo-500/5">
                          <FileIcon className="h-6 w-6" />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-bold text-[var(--text)] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {dataset.name}
                          </p>

                          <p className="mt-1 truncate text-[12px] font-medium text-[var(--muted)]">
                            {dataset.originalFilename}
                          </p>
                        </div>
                      </Link>

                      <span className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.05em] shadow-sm ${statusClasses(dataset.status)}`}>
                        <StatusDot status={dataset.status} />
                        {statusLabel(dataset.status)}
                      </span>
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-3 border-y border-[var(--border)] py-5">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">Size</p>
                        <p className="mt-2 text-[14px] font-bold text-[var(--text)]">{formatFileSize(dataset.fileSize)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">Rows</p>
                        <p className="mt-2 text-[14px] font-bold text-[var(--text)]">{dataset.rowCount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">Columns</p>
                        <p className="mt-2 text-[14px] font-bold text-[var(--text)]">{dataset.columnCount.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-2">
                      <p className="text-[12px] font-medium text-[var(--muted)]">
                        {formatDate(dataset.createdAt)}
                      </p>

                      <button
                        type="button"
                        onClick={() => void handleDelete(dataset)}
                        className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-bold text-[var(--muted-strong)] transition-all hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 active:scale-95"
                      >
                        <TrashIcon />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}