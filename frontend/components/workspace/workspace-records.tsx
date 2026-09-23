"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  QueryHistoryItem,
  Report,
  SavedAnalysis,
  SavedQuery,
  workspaceExperienceApi,
} from "../../lib/api";
import { clearAccessToken, getAccessToken } from "../../lib/auth";
import { useWorkspace } from "../../app/dashboard/workspace-context";

export type WorkspaceSection = "saved-queries" | "saved-analyses" | "reports" | "history";

const sectionCopy: Record<WorkspaceSection, { title: string; description: string }> = {
  "saved-queries": { title: "Saved queries", description: "Reusable SQL saved in this workspace." },
  "saved-analyses": { title: "Saved analyses", description: "Query results and the SQL behind each analysis." },
  reports: { title: "Reports", description: "Curated collections of saved analyses." },
  history: { title: "Query history", description: "Recent query runs and their outcomes." },
};

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function openQuery(router: ReturnType<typeof useRouter>, datasetId: string | null, sql: string, question?: string | null, datasetIds?: string[]) {
  const params = new URLSearchParams({ sql });
  if (datasetIds && datasetIds.length > 1) {
    window.sessionStorage.setItem("ai-data-analyst-selected-datasets", JSON.stringify(datasetIds));
    params.set("mode", "multi");
  } else if (datasetId) {
    params.set("datasetId", datasetId);
  }
  if (question) params.set("question", question);
  router.push(`/dashboard/query?${params.toString()}`);
}

export default function WorkspaceRecords({ section }: { section: WorkspaceSection }) {
  const router = useRouter();
  const { activeWorkspace, loading: workspaceLoading } = useWorkspace();
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reportTitle, setReportTitle] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [selectedAnalysisIds, setSelectedAnalysisIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!activeWorkspace) { setLoading(false); return; }
    const token = getAccessToken();
    if (!token) { clearAccessToken(); router.replace("/login?next=%2Fdashboard"); return; }
    setLoading(true); setError(null);
    try {
      const [nextQueries, nextAnalyses, nextReports, nextHistory] = await Promise.all([
        workspaceExperienceApi.listSavedQueries(token, activeWorkspace.id),
        workspaceExperienceApi.listSavedAnalyses(token, activeWorkspace.id),
        workspaceExperienceApi.listReports(token, activeWorkspace.id),
        workspaceExperienceApi.listHistory(token, activeWorkspace.id),
      ]);
      setQueries(nextQueries); setAnalyses(nextAnalyses); setReports(nextReports); setHistory(nextHistory);
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
        clearAccessToken(); router.replace("/login?next=%2Fdashboard"); return;
      }
      setError(cause instanceof Error ? cause.message : "Could not load workspace records.");
    } finally { setLoading(false); }
  }, [activeWorkspace, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function removeRecord(kind: "query" | "analysis" | "report", id: string, title: string) {
    if (!activeWorkspace || !window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
    const token = getAccessToken(); if (!token) return;
    setBusyId(id); setError(null);
    try {
      if (kind === "query") await workspaceExperienceApi.deleteSavedQuery(token, activeWorkspace.id, id);
      if (kind === "analysis") await workspaceExperienceApi.deleteSavedAnalysis(token, activeWorkspace.id, id);
      if (kind === "report") await workspaceExperienceApi.deleteReport(token, activeWorkspace.id, id);
      setNotice("Deleted successfully."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete this item."); }
    finally { setBusyId(null); }
  }

  async function renameRecord(kind: "query" | "analysis" | "report", id: string, currentTitle: string) {
    if (!activeWorkspace) return;
    const title = window.prompt("Update title", currentTitle)?.trim();
    if (!title || title === currentTitle) return;
    const token = getAccessToken(); if (!token) return;
    setBusyId(id); setError(null); setNotice(null);
    try {
      if (kind === "query") await workspaceExperienceApi.updateSavedQuery(token, activeWorkspace.id, id, { title });
      if (kind === "analysis") await workspaceExperienceApi.updateSavedAnalysis(token, activeWorkspace.id, id, { title });
      if (kind === "report") await workspaceExperienceApi.updateReport(token, activeWorkspace.id, id, { title });
      setNotice("Title updated."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update this item."); }
    finally { setBusyId(null); }
  }

  async function createReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeWorkspace || !selectedAnalysisIds.length) return;
    const token = getAccessToken(); if (!token) return;
    setBusyId("create-report"); setError(null); setNotice(null);
    try {
      await workspaceExperienceApi.createReport(token, activeWorkspace.id, {
        title: reportTitle.trim(), description: reportDescription.trim() || null, savedAnalysisIds: selectedAnalysisIds,
      });
      setReportTitle(""); setReportDescription(""); setSelectedAnalysisIds([]);
      setNotice("Report created."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create report."); }
    finally { setBusyId(null); }
  }

  const copy = sectionCopy[section];
  return (
    <main className="min-h-screen bg-[#07090d] px-4 py-7 text-white sm:px-7 lg:px-9">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">{activeWorkspace?.name ?? "Workspace"}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{copy.title}</h1><p className="mt-2 text-sm text-white/55">{copy.description}</p></div>
          <div className="flex gap-2"><Link href="/dashboard/query" className="rounded-xl bg-indigo-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-indigo-300">New query</Link><button onClick={() => void load()} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/75 hover:bg-white/5">Refresh</button></div>
        </div>
        <div className="mb-5 flex flex-wrap gap-2">
          {(["saved-queries", "saved-analyses", "reports", "history"] as WorkspaceSection[]).map((item) => <Link key={item} href={`/dashboard/${item}`} className={`rounded-full border px-3.5 py-2 text-xs font-medium ${section === item ? "border-indigo-300/30 bg-indigo-300/10 text-indigo-200" : "border-white/10 text-white/55 hover:text-white"}`}>{sectionCopy[item].title}</Link>)}
          <Link href="/dashboard/datasets" className="rounded-full border border-white/10 px-3.5 py-2 text-xs font-medium text-white/55 hover:text-white">Datasets</Link>
        </div>
        {(error || notice) && <div role={error ? "alert" : "status"} className={`mb-4 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-400/20 bg-red-400/10 text-red-200" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"}`}>{error ?? notice}</div>}
        {section === "reports" && (
          <form onSubmit={createReport} className="mb-5 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <h2 className="text-sm font-semibold">Create a report</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2"><input required maxLength={200} value={reportTitle} onChange={(event) => setReportTitle(event.target.value)} placeholder="Report title" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-indigo-300/40"/><input maxLength={2000} value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} placeholder="Description (optional)" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-indigo-300/40"/></div>
            <div className="mt-3 flex flex-wrap gap-2">{analyses.map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70"><input type="checkbox" checked={selectedAnalysisIds.includes(item.id)} onChange={(event) => setSelectedAnalysisIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))}/>{item.title}</label>)}{!analyses.length && <p className="text-xs text-white/45">Save an analysis before creating a report.</p>}</div>
            <button disabled={busyId === "create-report" || !selectedAnalysisIds.length} className="mt-4 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-40">{busyId === "create-report" ? "Creating…" : "Create report"}</button>
          </form>
        )}
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
          {loading || workspaceLoading ? <div className="p-8 text-sm text-white/50">Loading workspace records…</div> : section === "saved-queries" ? (
            queries.length ? <div className="divide-y divide-white/[0.07]">{queries.map((item) => <article key={item.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h2 className="truncate font-medium">{item.title}</h2><p className="mt-1 line-clamp-2 text-sm text-white/50">{item.question || item.description || "Saved SQL query"}</p><code className="mt-2 block truncate text-xs text-indigo-200/75">{item.sql}</code><p className="mt-2 text-xs text-white/35">Updated {dateLabel(item.updatedAt)}</p></div><div className="flex shrink-0 gap-2"><button onClick={() => openQuery(router, item.datasetId, item.sql, item.question)} className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5">Open in editor</button><button disabled={busyId === item.id} onClick={() => void renameRecord("query", item.id, item.title)} className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5">Rename</button><button disabled={busyId === item.id} onClick={() => void removeRecord("query", item.id, item.title)} className="rounded-lg border border-red-300/15 px-3 py-2 text-xs text-red-200/80 hover:bg-red-400/10">Delete</button></div></article>)}</div> : <Empty title="No saved queries yet" description="Run a query and save it from the results panel." />
          ) : section === "saved-analyses" ? (
            analyses.length ? <div className="divide-y divide-white/[0.07]">{analyses.map((item) => <article key={item.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h2 className="truncate font-medium">{item.title}</h2><p className="mt-1 line-clamp-2 text-sm text-white/50">{item.question || item.description || "Saved result snapshot"}</p><p className="mt-2 text-xs text-white/35">{item.datasetIds.length} dataset{item.datasetIds.length === 1 ? "" : "s"} · {dateLabel(item.updatedAt)}</p><SavedSnapshot snapshot={item.resultSnapshot} /></div><div className="flex shrink-0 gap-2"><button onClick={() => openQuery(router, item.datasetIds.length === 1 ? item.datasetIds[0] : null, item.sql, item.question, item.datasetIds)} className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5">Open in editor</button><button disabled={busyId === item.id} onClick={() => void renameRecord("analysis", item.id, item.title)} className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5">Rename</button><button disabled={busyId === item.id} onClick={() => void removeRecord("analysis", item.id, item.title)} className="rounded-lg border border-red-300/15 px-3 py-2 text-xs text-red-200/80 hover:bg-red-400/10">Delete</button></div></article>)}</div> : <Empty title="No saved analyses yet" description="Run a query and save its results as an analysis." />
          ) : section === "reports" ? (
            reports.length ? <div className="divide-y divide-white/[0.07]">{reports.map((item) => <article key={item.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-medium">{item.title}</h2><p className="mt-1 text-sm text-white/50">{item.description || "Workspace report"}</p><p className="mt-2 text-xs text-white/35">{item.savedAnalysisIds.length} saved analys{item.savedAnalysisIds.length === 1 ? "is" : "es"} · {dateLabel(item.updatedAt)}</p><div className="mt-3 flex flex-wrap gap-2">{item.savedAnalysisIds.map((id) => { const analysis = analyses.find((entry) => entry.id === id); return <span key={id} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/55">{analysis?.title ?? "Analysis"}</span>; })}</div></div><div className="flex gap-2 self-start"><button disabled={busyId === item.id} onClick={() => void renameRecord("report", item.id, item.title)} className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5">Rename</button><button disabled={busyId === item.id} onClick={() => void removeRecord("report", item.id, item.title)} className="rounded-lg border border-red-300/15 px-3 py-2 text-xs text-red-200/80 hover:bg-red-400/10">Delete</button></div></article>)}</div> : <Empty title="No reports yet" description="Create a report by selecting one or more saved analyses above." />
          ) : history.length ? <div className="divide-y divide-white/[0.07]">{history.map((item) => <HistoryRow key={item.id} item={item} onOpen={() => openQuery(router, item.datasetId, item.sql, item.question)} />)}</div> : <Empty title="No query activity yet" description="Run a query to see its status and details here." />}
        </section>
      </div>
    </main>
  );
}

function HistoryRow({ item, onOpen }: { item: QueryHistoryItem; onOpen: () => void }) {
  return <article className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-medium">{item.question || "SQL query"}</h2><span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${item.status === "success" ? "bg-emerald-300/10 text-emerald-200" : "bg-red-300/10 text-red-200"}`}>{item.status}</span></div><code className="mt-2 block truncate text-xs text-indigo-200/75">{item.sql}</code><p className="mt-2 text-xs text-white/35">{dateLabel(item.createdAt)} · {item.rowCount ?? 0} rows{item.executionTimeMs !== null ? ` · ${item.executionTimeMs} ms` : ""}{item.failureType ? ` · ${item.failureType} error` : ""}</p>{item.errorMessage && <p className="mt-1 text-xs text-red-200/70">{item.errorMessage}</p>}</div><button onClick={onOpen} className="self-start rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5">Open in editor</button></article>;
}

function SavedSnapshot({ snapshot }: { snapshot: Record<string, unknown> }) {
  const columns = Array.isArray(snapshot.columns) ? snapshot.columns.filter((value): value is string => typeof value === "string") : [];
  const rows = Array.isArray(snapshot.rows) ? snapshot.rows.filter(Array.isArray).slice(0, 5) as unknown[][] : [];
  return <details className="mt-3 text-xs text-white/60"><summary className="cursor-pointer select-none">View saved result{typeof snapshot.rowCount === "number" ? ` · ${snapshot.rowCount} rows` : ""}</summary>{columns.length ? <div className="mt-2 max-w-full overflow-x-auto rounded-lg border border-white/10"><table className="min-w-full text-left"><thead className="bg-white/[0.04]"><tr>{columns.map((column, index) => <th key={`${column}-${index}`} className="whitespace-nowrap px-3 py-2 font-medium">{column}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t border-white/[0.07]">{columns.map((_, columnIndex) => <td key={columnIndex} className="max-w-48 truncate px-3 py-2">{row[columnIndex] === null || row[columnIndex] === undefined ? "—" : String(row[columnIndex])}</td>)}</tr>)}</tbody></table></div> : <p className="mt-2">No tabular result was captured.</p>}</details>;
}

function Empty({ title, description }: { title: string; description: string }) {
  return <div className="px-6 py-14 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-lg text-indigo-200">✦</div><h2 className="mt-4 text-base font-semibold">{title}</h2><p className="mt-2 text-sm text-white/45">{description}</p><Link href="/dashboard/query" className="mt-5 inline-flex rounded-lg border border-white/10 px-3 py-2 text-xs text-white/75 hover:bg-white/5">Go to query workspace</Link></div>;
}
