"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  ApiError,
  apiFetch,
} from "../../../lib/api";

import {
  getAccessToken,
} from "../../../lib/auth";

import {
  useWorkspace,
} from "../workspace-context";

interface WorkspacePlanResponse {
  workspaceId: string;

  plan: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    aiQueriesPerDay: number;
    sqlExecutionsPerDay: number;
    datasetLimit: number;
    storageLimitBytes: number;
    maxFileSizeBytes: number;
  };
}

interface CreateSubscriptionResponse {
  subscriptionId:
    | string
    | null;

  status: string;

  shortUrl:
    | string
    | null;

  reused: boolean;
}

function formatBytes(
  bytes: number,
): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb =
    bytes / 1024;

  if (kb < 1024) {
    return `${Math.round(
      kb,
    )} KB`;
  }

  const mb =
    kb / 1024;

  if (mb < 1024) {
    return `${Math.round(
      mb,
    )} MB`;
  }

  const gb =
    mb / 1024;

  return `${gb.toFixed(
    gb >= 10 ? 0 : 1,
  )} GB`;
}

function PlanMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
        {label}
      </p>

      <p className="mt-2 text-lg font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

export default function BillingPage() {
  const {
    activeWorkspace,
    loading:
      workspaceLoading,
  } = useWorkspace();

  const [
    planData,
    setPlanData,
  ] =
    useState<WorkspacePlanResponse | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    upgrading,
    setUpgrading,
  ] = useState(false);

  const [
    upgradeError,
    setUpgradeError,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(() => {
    async function loadPlan() {
      if (
        !activeWorkspace?.id
      ) {
        return;
      }

      const token =
        getAccessToken();

      if (!token) {
        setError(
          "Your session has expired. Please log in again.",
        );

        setLoading(false);

        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await apiFetch<WorkspacePlanResponse>(
            `/workspaces/${encodeURIComponent(
              activeWorkspace.id,
            )}/plan`,
            {
              method: "GET",
              token,
            },
          );

        setPlanData(
          result,
        );
      } catch (
        requestError
      ) {
        if (
          requestError instanceof
          ApiError
        ) {
          setError(
            requestError.message,
          );
        } else {
          setError(
            "Unable to load your current plan.",
          );
        }
      } finally {
        setLoading(false);
      }
    }

    void loadPlan();
  }, [
    activeWorkspace?.id,
  ]);

  async function handleUpgrade() {
    if (
      !activeWorkspace?.id ||
      upgrading
    ) {
      return;
    }

    const token =
      getAccessToken();

    if (!token) {
      setUpgradeError(
        "Your session has expired. Please log in again.",
      );

      return;
    }

    setUpgrading(true);
    setUpgradeError(null);

    try {
      const result =
        await apiFetch<CreateSubscriptionResponse>(
          `/workspaces/${encodeURIComponent(
            activeWorkspace.id,
          )}/billing/razorpay/subscription`,
          {
            method: "POST",
            token,
          },
        );

      if (
        !result.shortUrl
      ) {
        throw new Error(
          "Razorpay did not return a checkout URL.",
        );
      }

      window.location.href =
        result.shortUrl;
    } catch (
      requestError
    ) {
      if (
        requestError instanceof
        ApiError
      ) {
        setUpgradeError(
          requestError.message,
        );
      } else if (
        requestError instanceof
        Error
      ) {
        setUpgradeError(
          requestError.message,
        );
      } else {
        setUpgradeError(
          "Unable to start the Pro subscription.",
        );
      }

      setUpgrading(false);
    }
  }

  if (workspaceLoading) {
    return (
      <section className="min-h-[calc(100vh-76px)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-8">
            <p className="text-sm text-white/40">
              Loading workspace...
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (
    !activeWorkspace
  ) {
    return (
      <section className="min-h-[calc(100vh-76px)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-8">
            <p className="text-sm text-white/50">
              No active workspace found.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const isPro =
    planData?.plan.code ===
    "pro";

  return (
    <section className="min-h-[calc(100vh-76px)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
            Workspace billing
          </p>

          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
            Plan & billing
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
            Manage your current workspace
            plan and usage limits.
          </p>
        </div>

        {loading && (
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-8">
            <p className="text-sm text-white/40">
              Loading your current plan...
            </p>
          </div>
        )}

        {!loading &&
          error && (
            <div className="rounded-3xl border border-red-400/20 bg-red-400/[0.05] p-6">
              <p className="text-sm font-medium text-red-200">
                Unable to load plan
              </p>

              <p className="mt-2 text-sm leading-6 text-red-200/60">
                {error}
              </p>
            </div>
          )}

        {!loading &&
          !error &&
          planData && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.22)] sm:p-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
                      Current plan
                    </p>

                    <div className="mt-3 flex items-center gap-3">
                      <h3 className="text-2xl font-semibold tracking-[-0.03em] text-white">
                        {
                          planData.plan
                            .name
                        }
                      </h3>

                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/45">
                        {
                          planData.plan
                            .code
                        }
                      </span>
                    </div>

                    <p className="mt-3 max-w-xl text-sm leading-6 text-white/45">
                      {
                        planData.plan
                          .description ??
                        "Your current workspace subscription plan."
                      }
                    </p>
                  </div>

                  <div className="shrink-0 rounded-2xl border border-white/[0.07] bg-black/20 px-4 py-3">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/25">
                      Workspace
                    </p>

                    <p className="mt-1 max-w-[220px] truncate text-sm font-medium text-white/80">
                      {
                        activeWorkspace.name
                      }
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
                  Plan limits
                </p>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <PlanMetric
                    label="AI queries / day"
                    value={String(
                      planData.plan
                        .aiQueriesPerDay,
                    )}
                  />

                  <PlanMetric
                    label="SQL executions / day"
                    value={String(
                      planData.plan
                        .sqlExecutionsPerDay,
                    )}
                  />

                  <PlanMetric
                    label="Datasets"
                    value={String(
                      planData.plan
                        .datasetLimit,
                    )}
                  />

                  <PlanMetric
                    label="Storage"
                    value={formatBytes(
                      planData.plan
                        .storageLimitBytes,
                    )}
                  />

                  <PlanMetric
                    label="Max file size"
                    value={formatBytes(
                      planData.plan
                        .maxFileSizeBytes,
                    )}
                  />
                </div>
              </div>

              {!isPro && (
                <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-8">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
                        Upgrade
                      </p>

                      <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">
                        SKYNT Pro
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-white/45">
                        Unlock higher limits and
                        advanced analytics features.
                      </p>

                      <p className="mt-3 text-lg font-semibold text-white">
                        ₹999
                        <span className="ml-1 text-sm font-normal text-white/35">
                          / month
                        </span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={
                        handleUpgrade
                      }
                      disabled={
                        upgrading
                      }
                      className="rounded-xl border border-white/10 bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {upgrading
                        ? "Opening Razorpay..."
                        : "Upgrade to Pro"}
                    </button>
                  </div>

                  {upgradeError && (
                    <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4">
                      <p className="text-sm text-red-200">
                        {
                          upgradeError
                        }
                      </p>
                    </div>
                  )}
                </div>
              )}

              {isPro && (
                <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.05] p-6">
                  <p className="text-sm font-semibold text-emerald-100">
                    Pro plan active
                  </p>

                  <p className="mt-2 text-sm leading-6 text-emerald-100/60">
                    This workspace currently has
                    access to the Pro plan limits.
                  </p>
                </div>
              )}
            </div>
          )}
      </div>
    </section>
  );
}