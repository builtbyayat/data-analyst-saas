"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Report,
} from '../../lib/api';

import {
  clearAccessToken,
  getAccessToken,
} from '../../lib/auth';

import {
  reportApi,
  ReportShare,
  ReportSharePermission,
} from '../../lib/report-api';

import {
  useWorkspace,
} from '../../app/dashboard/workspace-context';

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

function formatPermission(
  permission: ReportSharePermission,
) {
  return permission === 'exporter'
    ? 'View + export'
    : 'View only';
}

export default function ReportPublishingPanel() {
  const {
    activeWorkspace,
    loading: workspaceLoading,
  } = useWorkspace();

  const [reports, setReports] =
    useState<Report[]>([]);
  const [selectedReportId, setSelectedReportId] =
    useState('');
  const [shares, setShares] =
    useState<ReportShare[]>([]);
  const [permission, setPermission] =
    useState<ReportSharePermission>('viewer');
  const [expiresInDays, setExpiresInDays] =
    useState(7);
  const [loading, setLoading] =
    useState(false);
  const [busy, setBusy] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);
  const [notice, setNotice] =
    useState<string | null>(null);
  const [newShareUrl, setNewShareUrl] =
    useState<string | null>(null);

  const selectedReport = useMemo(
    () =>
      reports.find(
        (report) =>
          report.id === selectedReportId,
      ) ?? null,
    [reports, selectedReportId],
  );

  const load = useCallback(
    async () => {
      if (!activeWorkspace) {
        return;
      }

      const token =
        getAccessToken();

      if (!token) {
        clearAccessToken();
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const nextReports =
          await reportApi.listReports(
            token,
            activeWorkspace.id,
          );

        setReports(nextReports);

        setSelectedReportId((current) =>
          nextReports.some(
            (report) =>
              report.id === current,
          )
            ? current
            : nextReports[0]?.id ?? '',
        );
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not load reports.',
        );
      } finally {
        setLoading(false);
      }
    },
    [activeWorkspace],
  );

  const loadShares = useCallback(
    async () => {
      if (
        !activeWorkspace ||
        !selectedReportId
      ) {
        setShares([]);
        return;
      }

      const token =
        getAccessToken();

      if (!token) {
        return;
      }

      try {
        const nextShares =
          await reportApi.listShares(
            token,
            activeWorkspace.id,
            selectedReportId,
          );

        setShares(nextShares);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not load share links.',
        );
      }
    },
    [activeWorkspace, selectedReportId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadShares();
    setNewShareUrl(null);
  }, [loadShares]);

  async function createShare() {
    if (
      !activeWorkspace ||
      !selectedReportId ||
      busy
    ) {
      return;
    }

    const token =
      getAccessToken();

    if (!token) {
      clearAccessToken();
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    setNewShareUrl(null);

    try {
      const created =
        await reportApi.createShare(
          token,
          activeWorkspace.id,
          selectedReportId,
          {
            permission,
            expiresInDays,
          },
        );

      if (!created.token) {
        throw new Error(
          'The share link was created but no token was returned.',
        );
      }

      const url =
        `${window.location.origin}/shared/reports/${created.token}`;

      setNewShareUrl(url);
      setNotice(
        'Share link created. Copy it now; the token is not shown again.',
      );
      await loadShares();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not create the share link.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function revokeShare(
    shareId: string,
  ) {
    if (
      !activeWorkspace ||
      !selectedReportId ||
      busy
    ) {
      return;
    }

    const token =
      getAccessToken();

    if (!token) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await reportApi.revokeShare(
        token,
        activeWorkspace.id,
        selectedReportId,
        shareId,
      );

      setNotice(
        'Share link revoked.',
      );
      await loadShares();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not revoke the share link.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyNewShare() {
    if (!newShareUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        newShareUrl,
      );
      setNotice(
        'Share link copied.',
      );
    } catch {
      setError(
        'Could not copy the share link. Copy it manually.',
      );
    }
  }

  return (
    <section className="mb-5 rounded-[28px] border border-white/[0.08] bg-white/[0.025] p-5 shadow-[0_25px_90px_rgba(0,0,0,0.14)] sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">
            Publishing
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">
            Generate, export and share reports
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">
            Generate a report snapshot from the saved analyses, export it, or create a time-limited share link with controlled access.
          </p>
        </div>

        {selectedReport && (
          <a
            href={`/dashboard/reports/${selectedReport.id}`}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-xs font-semibold text-slate-950 transition hover:bg-white/90"
          >
            Open generated report
          </a>
        )}
      </div>

      {workspaceLoading || loading ? (
        <div className="mt-5 h-12 animate-pulse rounded-xl bg-white/[0.04]" />
      ) : (
        <>
          <div className="mt-5 grid gap-4 xl:grid-cols-[1.4fr_0.8fr_0.55fr_auto]">
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/25">
                Report
              </span>
              <select
                value={selectedReportId}
                onChange={(event) =>
                  setSelectedReportId(
                    event.target.value,
                  )
                }
                className="h-11 w-full rounded-xl border border-white/[0.09] bg-black/10 px-3.5 text-sm text-white outline-none transition focus:border-indigo-400/35"
              >
                {!reports.length && (
                  <option value="">
                    No reports available
                  </option>
                )}
                {reports.map((report) => (
                  <option
                    key={report.id}
                    value={report.id}
                    className="bg-slate-950"
                  >
                    {report.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/25">
                Permission
              </span>
              <select
                value={permission}
                onChange={(event) =>
                  setPermission(
                    event.target.value as ReportSharePermission,
                  )
                }
                className="h-11 w-full rounded-xl border border-white/[0.09] bg-black/10 px-3.5 text-sm text-white outline-none transition focus:border-indigo-400/35"
              >
                <option value="viewer" className="bg-slate-950">
                  View only
                </option>
                <option value="exporter" className="bg-slate-950">
                  View + export
                </option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/25">
                Expires
              </span>
              <select
                value={expiresInDays}
                onChange={(event) =>
                  setExpiresInDays(
                    Number(event.target.value),
                  )
                }
                className="h-11 w-full rounded-xl border border-white/[0.09] bg-black/10 px-3.5 text-sm text-white outline-none transition focus:border-indigo-400/35"
              >
                {[1, 7, 14, 30].map((days) => (
                  <option key={days} value={days} className="bg-slate-950">
                    {days} day{days === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              disabled={!selectedReportId || busy}
              onClick={createShare}
              className="h-11 self-end rounded-xl border border-white/[0.09] bg-white/[0.05] px-4 text-xs font-semibold text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Working…' : 'Create share link'}
            </button>
          </div>

          {newShareUrl && (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-indigo-400/20 bg-indigo-400/[0.06] p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-200/55">
                  New share link
                </p>
                <p className="mt-1 truncate text-xs text-white/65">
                  {newShareUrl}
                </p>
              </div>
              <button
                type="button"
                onClick={copyNewShare}
                className="shrink-0 rounded-lg border border-white/[0.09] px-3 py-2 text-xs font-semibold text-white/75 transition hover:bg-white/[0.05] hover:text-white"
              >
                Copy link
              </button>
            </div>
          )}

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/25">
                  Active and historical links
                </p>
                <p className="mt-1 text-xs text-white/30">
                  Revoked links remain listed for audit visibility.
                </p>
              </div>
              {selectedReport && (
                <span className="text-xs text-white/30">
                  Updated {formatDate(selectedReport.updatedAt)}
                </span>
              )}
            </div>

            {!shares.length ? (
              <div className="mt-3 rounded-2xl border border-dashed border-white/[0.08] px-4 py-6 text-center text-xs text-white/30">
                No share links have been created for this report.
              </div>
            ) : (
              <div className="mt-3 divide-y divide-white/[0.06] rounded-2xl border border-white/[0.07] bg-black/[0.08]">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-white/40">
                          {formatPermission(share.permission)}
                        </span>
                        <span className="text-xs text-white/35">
                          Created {formatDate(share.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-white/35">
                        {share.revokedAt
                          ? `Revoked ${formatDate(share.revokedAt)}`
                          : `Expires ${formatDate(share.expiresAt)}`}
                      </p>
                    </div>

                    {!share.revokedAt && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void revokeShare(share.id)
                        }
                        className="self-start rounded-lg border border-red-400/15 px-3 py-2 text-xs font-semibold text-red-200/75 transition hover:bg-red-400/[0.06] hover:text-red-100 disabled:opacity-40 lg:self-auto"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {(notice || error) && (
        <div className="mt-4 text-xs">
          {notice && (
            <p className="text-emerald-200/75">
              {notice}
            </p>
          )}
          {error && (
            <p className="mt-1 text-red-200/75">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
