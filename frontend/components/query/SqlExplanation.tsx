"use client";

interface ResultExplanationInput {
  sql: string;
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
  summary?: unknown;
  visualization?: unknown;
  explanation?: string | null;
}

interface SqlExplanationProps {
  result: ResultExplanationInput;
}

export default function SqlExplanation({
  result,
}: SqlExplanationProps) {
  const explanation =
    result.explanation?.trim() ||
    null;

  if (!result.sql.trim()) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/35">
          Result explanation
        </p>

        <p className="mt-1 text-sm text-white/45">
          A plain-language summary of what the returned data shows.
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-white/6 bg-black/20 p-4">
        {explanation ? (
          <p className="whitespace-pre-line text-sm leading-7 text-white/70">
            {explanation}
          </p>
        ) : (
          <p className="text-sm leading-6 text-white/40">
            A result explanation could not be generated for this query.
          </p>
        )}
      </div>
    </section>
  );
}
