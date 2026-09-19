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
    <div className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition duration-300 hover:border-white/[0.12] hover:bg-white/[0.035]">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-white/45">
          {label}
        </p>

        <span className="h-2 w-2 rounded-full bg-white/15" />
      </div>

      <p className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-white">
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-white/30">
        {description}
      </p>
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
    <div className="relative flex gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-xs font-semibold text-white/60">
        {number}
      </div>

      <div>
        <p className="text-sm font-medium text-white/85">
          {title}
        </p>

        <p className="mt-1 max-w-sm text-xs leading-5 text-white/35">
          {description}
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.025] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.2)] sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/[0.035] blur-3xl" />

        <div className="relative max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
            AI Data Analyst
          </p>

          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
            Your data workspace
            <span className="text-white/30">
              {" "}
              starts here.
            </span>
          </h2>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/45 sm:text-[15px]">
            Upload business data, ask questions in natural
            language, and turn raw datasets into structured
            analysis.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <div className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-[11px] font-medium text-white/45">
              CSV
            </div>

            <div className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-[11px] font-medium text-white/45">
              XLS
            </div>

            <div className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-[11px] font-medium text-white/45">
              XLSX
            </div>

            <div className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-[11px] font-medium text-white/45">
              Natural language
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Datasets"
          value="0"
          description="No datasets have been added to this workspace yet."
        />

        <StatCard
          label="Queries"
          value="0"
          description="Your analytical query history will appear here."
        />

        <StatCard
          label="Rows analyzed"
          value="0"
          description="Tracked from actual query executions."
        />

        <StatCard
          label="Saved analyses"
          value="0"
          description="Saved reports and analyses will appear here."
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.8fr]">
        <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.02]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 sm:px-6">
            <div>
              <p className="text-sm font-semibold text-white/85">
                Your datasets
              </p>

              <p className="mt-1 text-xs text-white/30">
                Uploads and processed datasets will appear here.
              </p>
            </div>

            <span className="rounded-full border border-white/[0.07] px-2.5 py-1 text-[10px] font-medium text-white/30">
              0 datasets
            </span>
          </div>

          <div className="flex min-h-[290px] flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035] text-white/35">
              <svg
                width="24"
                height="24"
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
            </div>

            <h3 className="mt-5 text-base font-semibold text-white/80">
              No datasets yet
            </h3>

            <p className="mt-2 max-w-md text-xs leading-6 text-white/30">
              The dataset management interface will connect to
              the existing backend ingestion pipeline next.
            </p>

            <div className="mt-5 rounded-xl border border-dashed border-white/[0.09] bg-white/[0.015] px-4 py-3 text-xs text-white/25">
              Dataset upload — next UI step
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.02]">
          <div className="border-b border-white/[0.06] px-5 py-4 sm:px-6">
            <p className="text-sm font-semibold text-white/85">
              How the workspace works
            </p>

            <p className="mt-1 text-xs text-white/30">
              The core product flow.
            </p>
          </div>

          <div className="space-y-7 p-5 sm:p-6">
            <Step
              number="01"
              title="Add your dataset"
              description="Upload CSV or Excel data and let the ingestion pipeline prepare a queryable analytical representation."
            />

            <Step
              number="02"
              title="Ask a question"
              description="Use natural language to ask about sales, customers, trends, totals, comparisons, and more."
            />

            <Step
              number="03"
              title="Analyze the result"
              description="Inspect the table, KPI summary, visualization, generated SQL, explanation, and export."
            />
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-[24px] border border-white/[0.07] bg-white/[0.02]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 sm:px-6">
          <div>
            <p className="text-sm font-semibold text-white/85">
              Recent activity
            </p>

            <p className="mt-1 text-xs text-white/30">
              Query activity will appear here as you work.
            </p>
          </div>
        </div>

        <div className="flex min-h-[160px] items-center justify-center px-6 text-center">
          <div>
            <p className="text-sm font-medium text-white/50">
              Nothing here yet
            </p>

            <p className="mt-1 text-xs text-white/25">
              Upload a dataset and run your first analysis.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}