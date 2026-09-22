import type {
  AIInsight,
  AIInsightsResult,
} from "../../lib/query-api";

interface AIInsightsProps {
  result: AIInsightsResult | null | undefined;
}

function formatEvidenceValue(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number"
  ) {
    return Number.isFinite(value)
      ? value.toLocaleString()
      : String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function importanceClasses(
  importance: AIInsight["importance"],
): string {
  switch (importance) {
    case "high":
      return "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400";

    case "low":
      return "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400";

    case "medium":
    default:
      return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }
}

function insightTypeLabel(
  type: AIInsight["type"],
): string {
  switch (type) {
    case "summary":
      return "Summary";
    case "trend":
      return "Trend";
    case "anomaly":
      return "Anomaly";
    case "comparison":
      return "Comparison";
    case "distribution":
      return "Distribution";
    case "relationship":
      return "Relationship";
    case "finding":
    default:
      return "Finding";
  }
}

function InsightCard({
  insight,
}: {
  insight: AIInsight;
}) {
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              {insightTypeLabel(
                insight.type,
              )}
            </span>

            <span
              className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${importanceClasses(
                insight.importance,
              )}`}
            >
              {insight.importance}
            </span>
          </div>

          <h3 className="text-[14px] font-bold text-[var(--text)]">
            {insight.title}
          </h3>
        </div>
      </div>

      <p className="mt-3 text-[13px] leading-6 text-[var(--muted-strong)]">
        {insight.description}
      </p>

      {insight.evidence.length >
        0 && (
        <div className="mt-4 border-t border-[var(--border)] pt-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
            Evidence
          </p>

          <div className="flex flex-col gap-2">
            {insight.evidence
              .slice(0, 5)
              .map(
                (
                  evidence,
                  index,
                ) => (
                  <div
                    key={`${evidence.column ?? "evidence"}-${index}`}
                    className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2"
                  >
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                      {evidence.datasetName && (
                        <span>
                          <span className="font-bold text-[var(--muted)]">
                            Dataset:
                          </span>{" "}
                          <span className="text-[var(--text)]">
                            {
                              evidence.datasetName
                            }
                          </span>
                        </span>
                      )}

                      {evidence.operation && (
                        <span>
                          <span className="font-bold text-[var(--muted)]">
                            Operation:
                          </span>{" "}
                          <span className="text-[var(--text)]">
                            {
                              evidence.operation
                            }
                          </span>
                        </span>
                      )}

                      {evidence.column && (
                        <span>
                          <span className="font-bold text-[var(--muted)]">
                            Column:
                          </span>{" "}
                          <span className="text-[var(--text)]">
                            {
                              evidence.column
                            }
                          </span>
                        </span>
                      )}

                      {evidence.source && (
                        <span>
                          <span className="font-bold text-[var(--muted)]">
                            Source:
                          </span>{" "}
                          <span className="text-[var(--text)]">
                            {
                              evidence.source
                            }
                          </span>
                        </span>
                      )}
                    </div>

                    {evidence.value !==
                      undefined && (
                      <div className="mt-2 text-[11px] text-[var(--muted-strong)]">
                        <span className="font-bold text-[var(--muted)]">
                          Value:
                        </span>{" "}
                        {formatEvidenceValue(
                          evidence.value,
                        )}
                      </div>
                    )}

                    {evidence.baseline !==
                      undefined && (
                      <div className="mt-1 text-[11px] text-[var(--muted-strong)]">
                        <span className="font-bold text-[var(--muted)]">
                          Baseline:
                        </span>{" "}
                        {formatEvidenceValue(
                          evidence.baseline,
                        )}
                      </div>
                    )}

                    {evidence.change !==
                      undefined && (
                      <div className="mt-1 text-[11px] text-[var(--muted-strong)]">
                        <span className="font-bold text-[var(--muted)]">
                          Change:
                        </span>{" "}
                        {formatEvidenceValue(
                          evidence.change,
                        )}
                      </div>
                    )}
                  </div>
                ),
              )}
          </div>
        </div>
      )}
    </article>
  );
}

export default function AIInsights({
  result,
}: AIInsightsProps) {
  if (!result) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
        <p className="text-[14px] font-bold text-[var(--text)]">
          AI Insights
        </p>

        <p className="mt-2 text-[12px] text-[var(--muted)]">
          No AI insights are available
          for this result.
        </p>
      </div>
    );
  }

  if (
    result.status === "empty"
  ) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-[14px] font-bold text-[var(--text)]">
          AI Insights
        </p>

        <p className="mt-2 text-[13px] leading-6 text-[var(--muted-strong)]">
          {result.summary ||
            "There is not enough data to generate insights."}
        </p>
      </div>
    );
  }

  const insights = [
    ...result.insights,
    ...result.anomalies,
  ];

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            ✦
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              AI Insights
            </p>

            <p className="mt-2 text-[14px] font-semibold leading-6 text-[var(--text)]">
              {result.summary ||
                "Analysis completed."}
            </p>
          </div>
        </div>
      </section>

      {insights.length > 0 ? (
        <section className="flex flex-col gap-3">
          {insights.map(
            (
              insight,
              index,
            ) => (
              <InsightCard
                key={`${insight.type}-${insight.title}-${index}`}
                insight={insight}
              />
            ),
          )}
        </section>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <p className="text-[13px] font-bold text-[var(--text)]">
            No specific insights found.
          </p>

          <p className="mt-1 text-[12px] text-[var(--muted)]">
            The available evidence did
            not support any additional
            findings.
          </p>
        </div>
      )}

      {result.warnings.length >
        0 && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
            Warnings
          </p>

          <ul className="mt-2 flex flex-col gap-1">
            {result.warnings.map(
              (
                warning,
                index,
              ) => (
                <li
                  key={`${warning}-${index}`}
                  className="text-[12px] leading-5 text-[var(--muted-strong)]"
                >
                  • {warning}
                </li>
              ),
            )}
          </ul>
        </section>
      )}
    </div>
  );
}