"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Theme = "dark" | "light";

// Helper components (Icons and UI atoms)
function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 3V15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.5 7.5L12 3L16.5 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 15V18C5 19.657 6.343 21 8 21H16C17.657 21 19 19.657 19 18V15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5 12H19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M13 6L19 12L13 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.5 14.7A8.5 8.5 0 0 1 9.3 3.5 8.5 8.5 0 1 0 20.5 14.7Z" />
    </svg>
  );
}

function StatCard({ label, value, description }: { label: string; value: string; description: string; }) {
  return (
    <div className="group rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-7 shadow-sm transition duration-500 hover:-translate-y-1 hover:border-indigo-500/40 hover:shadow-[0_20px_50px_rgba(79,70,229,0.1)] dark:hover:shadow-[0_20px_50px_rgba(79,70,229,0.15)] flex flex-col justify-between h-full min-h-[160px]">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted-strong)] group-hover:text-indigo-500 transition-colors">{label}</p>
        <span className="h-2 w-2 rounded-full bg-[var(--border-strong)] transition-all duration-300 group-hover:bg-indigo-500 group-hover:scale-125" />
      </div>
      <div>
        <p className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text)] transition-colors">{value}</p>
        <p className="mt-2 text-[13px] font-medium leading-relaxed text-[var(--muted-strong)]">{description}</p>
      </div>
    </div>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string; }) {
  return (
    <div className="group relative flex gap-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-all duration-300 hover:border-indigo-500/40 hover:shadow-md">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--card)] text-[11px] font-bold text-[var(--muted-strong)] transition-colors group-hover:text-indigo-500 group-hover:border-indigo-500/40">
        {number}
      </div>
      <div className="flex flex-col justify-center">
        <p className="text-[15px] font-bold tracking-tight text-[var(--text)]">{title}</p>
        <p className="mt-1 text-[13px] font-medium leading-relaxed text-[var(--muted-strong)]">
          {description}
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  // Initialize theme robustly on mount
  useEffect(() => {
    setMounted(true);
    const saved = window.localStorage.getItem("ai-data-analyst-theme") as Theme | null;
    if (saved) {
      setTheme(saved);
    } else {
      setTheme("dark");
    }
  }, []);

  // Update localStorage and document class when theme changes
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
          bg: "#f8fafc", // A slightly off-white for dashboard background
          text: "#050505",
          muted: "#64748b",
          mutedStrong: "#475569",
          border: "rgba(15,23,42,0.08)",
          borderStrong: "rgba(15,23,42,0.15)",
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

  // Prevent hydration mismatch flash
  if (!mounted) return null;

  return (
    <main
      style={themeStyle}
      className={`min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased transition-colors duration-500 ${theme === 'dark' ? 'dark' : ''}`}
    >
      <div className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">

        {/* Header Section */}
        <section className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between border-b border-[var(--border)] pb-8">
          <div>
            <div className="flex items-center gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
                AI Data Analyst
              </p>
              <button
                onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-strong)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-all"
                aria-label="Toggle Theme"
              >
                {theme === 'light' ? <MoonIcon /> : <SunIcon />}
              </button>
            </div>

            <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight text-[var(--text)]">
              Your data workspace
            </h1>

            <p className="mt-3 max-w-2xl text-[16px] font-medium leading-relaxed text-[var(--muted-strong)]">
              Upload business data, ask questions in natural language, and turn raw datasets into structured analysis.
            </p>
          </div>

          <Link
            href="/dashboard/datasets"
            className="group inline-flex h-12 items-center justify-center gap-2.5 rounded-xl bg-[var(--text)] px-6 text-[14px] font-bold text-[var(--bg)] shadow-[0_8px_25px_rgba(15,23,42,0.16)] dark:shadow-[0_8px_25px_rgba(255,255,255,0.1)] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg active:scale-95"
          >
            <UploadIcon />
            Add dataset
          </Link>
        </section>

        {/* Main Workspace Intro */}
        <section className="relative overflow-hidden rounded-[32px] border border-[var(--border)] bg-[var(--card)] shadow-[0_20px_70px_rgba(15,23,42,0.04)] dark:shadow-[0_20px_70px_rgba(0,0,0,0.4)] transition-colors duration-500">
          <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="relative grid gap-12 p-8 sm:p-10 lg:grid-cols-[1.4fr_0.6fr] lg:p-12">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted-strong)] shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Workspace ready
              </div>

              <h2 className="mt-6 text-4xl sm:text-5xl font-bold tracking-tight text-[var(--text)]">
                Start with your data.
                <br />
                <span className="text-[var(--muted)]">Let the analysis follow.</span>
              </h2>

              <p className="mt-5 max-w-2xl text-[16px] font-medium leading-relaxed text-[var(--muted-strong)]">
                Bring in a CSV or Excel dataset, then ask questions the way you naturally think about your business. AI Data Analyst handles the analytical workflow behind the scenes.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {["CSV", "XLS", "XLSX", "Natural language"].map((item) => (
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
                  href="/dashboard/datasets"
                  className="group inline-flex h-12 items-center justify-center gap-2.5 rounded-xl bg-indigo-600 px-6 text-[14px] font-bold text-white shadow-[0_10px_25px_rgba(79,70,229,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-[0_15px_30px_rgba(79,70,229,0.3)] active:scale-95"
                >
                  Upload your first dataset
                  <div className="transition-transform group-hover:translate-x-1"><ArrowIcon /></div>
                </Link>

                <Link
                  href="/dashboard/query"
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-6 text-[14px] font-bold text-[var(--text)] transition-all hover:-translate-y-0.5 hover:bg-[var(--card)] hover:border-indigo-500/40 active:scale-95"
                >
                  Open query workspace
                </Link>
              </div>
            </div>

            {/* Product Preview Card */}
            <div className="relative flex items-center lg:justify-end">
              <div className="w-full max-w-[420px] rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)] hover:-translate-y-1 transition-transform duration-500">
                <div className="rounded-[20px] border border-[var(--border-strong)] bg-[var(--card)] p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Example analysis</p>
                      <p className="mt-1.5 text-[15px] font-bold tracking-tight text-[var(--text)]">Sales performance</p>
                    </div>
                    <span className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Ready</span>
                  </div>

                  <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">Natural language question</p>
                    <p className="mt-2 text-[14px] font-semibold leading-relaxed text-[var(--text)]">Show the top 5 products by revenue</p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-[var(--border)] p-4 transition-colors hover:border-[var(--border-strong)]">
                      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">Revenue</p>
                      <p className="mt-2 text-xl font-bold tracking-tight text-[var(--text)]">$84.2K</p>
                    </div>
                    <div className="rounded-xl border border-[var(--border)] p-4 transition-colors hover:border-[var(--border-strong)]">
                      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">Products</p>
                      <p className="mt-2 text-xl font-bold tracking-tight text-[var(--text)]">5</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    <div className="h-2.5 rounded-full bg-indigo-500" />
                    <div className="h-2.5 w-[82%] rounded-full bg-indigo-400/80" />
                    <div className="h-2.5 w-[68%] rounded-full bg-indigo-300/80 dark:bg-indigo-600/60" />
                    <div className="h-2.5 w-[54%] rounded-full bg-indigo-200/80 dark:bg-indigo-800/60" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Datasets" value="0" description="Datasets available in this workspace." />
          <StatCard label="Queries" value="0" description="Analytical questions you've run." />
          <StatCard label="Rows analyzed" value="0" description="Tracked from actual query executions." />
          <StatCard label="Saved analyses" value="0" description="Reports and analyses saved for later." />
        </section>

        {/* Bottom Section: Datasets + Workflow */}
        <section className="mt-8 grid gap-8 xl:grid-cols-[1.4fr_1fr]">

          {/* Datasets Empty State */}
          <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--card)] shadow-[0_10px_40px_rgba(15,23,42,0.03)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
              <div>
                <p className="text-[16px] font-bold text-[var(--text)]">Your datasets</p>
                <p className="mt-1 text-[13px] font-medium text-[var(--muted-strong)]">Uploaded and processed datasets will appear here.</p>
              </div>
              <span className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-bold text-[var(--muted-strong)] shadow-sm">
                0 datasets
              </span>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--muted-strong)] shadow-sm">
                <UploadIcon />
              </div>
              <h3 className="mt-6 text-[18px] font-bold text-[var(--text)]">No datasets yet</h3>
              <p className="mt-3 max-w-md text-[14px] font-medium leading-relaxed text-[var(--muted-strong)]">
                Upload your first business dataset to start asking questions, generating insights, and exploring your data.
              </p>
              <Link
                href="/dashboard/datasets"
                className="group mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-[var(--text)] px-6 text-[14px] font-bold text-[var(--bg)] shadow-md transition-all hover:-translate-y-0.5 hover:opacity-90 active:scale-95"
              >
                Add dataset
                <div className="transition-transform group-hover:translate-x-1"><ArrowIcon /></div>
              </Link>
            </div>
          </div>

          {/* Workflow Steps */}
          <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--card)] shadow-[0_10px_40px_rgba(15,23,42,0.03)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
            <div className="border-b border-[var(--border)] px-6 py-5">
              <p className="text-[16px] font-bold text-[var(--text)]">How it works</p>
              <p className="mt-1 text-[13px] font-medium text-[var(--muted-strong)]">From raw data to useful answers.</p>
            </div>

            <div className="flex flex-1 flex-col justify-center space-y-4 p-6 sm:p-8">
              <Step number="01" title="Add your dataset" description="Upload CSV or Excel data and let the ingestion pipeline prepare it for analysis." />
              <Step number="02" title="Ask a question" description="Ask naturally about sales, customers, trends, totals, comparisons, and more." />
              <Step number="03" title="Analyze the result" description="Review tables, KPIs, visualizations, SQL, explanations, and exports." />
            </div>
          </div>
        </section>

        {/* Recent Activity Section */}
        <section className="mt-8 overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--card)] shadow-[0_10px_40px_rgba(15,23,42,0.03)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
            <div>
              <p className="text-[16px] font-bold text-[var(--text)]">Recent activity</p>
              <p className="mt-1 text-[13px] font-medium text-[var(--muted-strong)]">Your recent analytical activity will appear here.</p>
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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M12 7V12L15 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>

              <p className="mt-5 text-[18px] font-bold text-[var(--text)]">Nothing here yet</p>
              <p className="mt-2 text-[14px] font-medium text-[var(--muted-strong)]">Upload a dataset and run your first analysis.</p>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}