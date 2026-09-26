"use client";

import {
  useEffect,
  useState,
} from 'react';

import {
  useParams,
} from 'next/navigation';

import {
  GeneratedReport,
  reportApi,
  ReportSharePermission,
} from '../../../../lib/report-api';

function formatDate(
  value: string,
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat(
    'en-IN',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(date);
}

function normalizeSnapshot(
  snapshot: Record<string, unknown>,
) {
  const columns =
    Array.isArray(snapshot.columns)
      ? snapshot.columns.filter(
          (value): value is string =>
            typeof value === 'string',
        )
      : [];

  const rows =
    Array.isArray(snapshot.rows)
      ? snapshot.rows.filter(
          (value): value is unknown[] =>
            Array.isArray(value),
        )
      : [];

  return {
    columns,
    rows,
    rowCount:
      typeof snapshot.rowCount === 'number'
        ? snapshot.rowCount
        : rows.length,
  };
}

function displayValue(value: unknown) {
  if (
    value === null ||
    value === undefined
  ) {
    return '—';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

export default function SharedReportPage() {
  const params =
    useParams<{
      token: string;
    }>();

  const token =
    params.token;

  const [report, setReport] =
    useState<GeneratedReport | null>(null);
  const [permission, setPermission] =
    useState<ReportSharePermission | null>(null);
  const [canExport, setCanExport] =
    useState(false);
  const [expiresAt, setExpiresAt] =
    useState<string | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState<string | null>(null);
  const [exporting, setExporting] =
    useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const result =
          await reportApi.getSharedReport(
            token,
          );

        if (cancelled) {
          return;
        }

        setReport(result.report);
        setPermission(result.permission);
        setCanExport(result.canExport);
        setExpiresAt(result.expiresAt);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'This report is unavailable.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function download(
    format: 'json' | 'csv' | 'xlsx',
  ) {
    if (!token || !canExport) {
      return;
    }

    setExporting(format);
    setError(null);

    try {
      const result =
        await reportApi.downloadSharedReport(
          token,
          format,
        );

      const url =
        URL.createObjectURL(
          result.blob,
        );
      const anchor =
        document.createElement(
          'a',
        );
      anchor.href = url;
      anchor.download =
        result.filename;
      document.body.appendChild(
        anchor,
      );
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not export this report.',
      );
    } finally {
      setExporting(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1100px]">
        <section className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.025] shadow-[0_30px_100px_rgba(0,0,0,0.28)]">
          {loading ? (
            <div className="p-6 animate-pulse sm:p-8">
              <div className="h-3 w-28 rounded bg-white/[0.07]" />
              <div className="mt-3 h-8 w-[55%] rounded bg-white/[0.07]" />
              <div className="mt-3 h-4 w-[70%] rounded bg-white/[0.05]" />
            </div>
          ) : error ? (
            <div className="p-6 sm:p-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-200/55">
                Shared report
              </p>
              <h1 className="mt-3 text-2xl font-semibold text-white">
                Report unavailable
              </h1>
              <p className="mt-2 text-sm leading-6 text-red-100/70">
                {error}
              </p>
            </div>
          ) : report ? (
            <>
              <div className="border-b border-white/[0.07] p-6 sm:p-8">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">
                      Shared report
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">
                      {report.report.title}
                    </h1>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">
                      {report.report.description ||
                        'A generated report shared from SKYNT.'}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/30">
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5">
                        {permission === 'exporter'
                          ? 'View + export'
                          : 'View only'}
                      </span>
                      {expiresAt && (
                        <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5">
                          Link expires {formatDate(expiresAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {canExport && (
                    <div className="flex flex-wrap gap-2">
                      {(['xlsx', 'csv', 'json'] as const).map((format) => (
                        <button
                          key={format}
                          type="button"
                          disabled={exporting !== null}
                          onClick={() =>
                            void download(format)
                          }
                          className="rounded-xl border border-white/[0.09] bg-white/[0.04] px-3.5 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-white/70 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-40"
                        >
                          {exporting === format
                            ? 'Exporting…'
                            : format}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-5 p-5 sm:p-8">
                {report.sections.map((section, index) => {
                  const snapshot =
                    normalizeSnapshot(
                      section.resultSnapshot,
                    );
                  const visibleRows =
                    snapshot.rows.slice(0, 12);

                  return (
                    <article
                      key={`${section.title}-${index}`}
                      className="overflow-hidden rounded-2xl border border-white/[0.07] bg-black/[0.08]"
                    >
                      <div className="border-b border-white/[0.06] p-5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">
                          Analysis {index + 1}
                        </p>
                        <h2 className="mt-2 text-lg font-semibold text-white">
                          {section.title}
                        </h2>
                        {section.description && (
                          <p className="mt-2 text-sm leading-6 text-white/40">
                            {section.description}
                          </p>
                        )}
                        {section.question && (
                          <p className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm leading-6 text-white/55">
                            {section.question}
                          </p>
                        )}
                      </div>

                      <div className="overflow-x-auto">
                        {snapshot.columns.length ? (
                          <table className="min-w-full text-left text-xs">
                            <thead className="bg-white/[0.025] text-white/40">
                              <tr>
                                {snapshot.columns.map((column, columnIndex) => (
                                  <th
                                    key={`${column}-${columnIndex}`}
                                    className="whitespace-nowrap border-b border-white/[0.06] px-4 py-3 font-semibold"
                                  >
                                    {column}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {visibleRows.map((row, rowIndex) => (
                                <tr
                                  key={rowIndex}
                                  className="border-b border-white/[0.05] last:border-0"
                                >
                                  {snapshot.columns.map((_, columnIndex) => (
                                    <td
                                      key={columnIndex}
                                      className="max-w-72 truncate px-4 py-3 text-white/45"
                                      title={displayValue(row[columnIndex])}
                                    >
                                      {displayValue(row[columnIndex])}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="p-5 text-sm text-white/35">
                            No tabular result snapshot is available for this section.
                          </p>
                        )}
                      </div>

                      <div className="border-t border-white/[0.06] px-5 py-3 text-xs text-white/25">
                        {snapshot.rowCount} result row{snapshot.rowCount === 1 ? '' : 's'} · {section.datasetCount} dataset{section.datasetCount === 1 ? '' : 's'}
                      </div>
                    </article>
                  );
                })}

                {report.missingSectionCount > 0 && (
                  <p className="rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-4 py-3 text-xs leading-5 text-amber-100/70">
                    {report.missingSectionCount} linked analysis{report.missingSectionCount === 1 ? '' : 'es'} could not be loaded because the underlying saved analysis is no longer available.
                  </p>
                )}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
