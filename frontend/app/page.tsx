import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#070708] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight"
          >
            Data Analyst
          </Link>

          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
            >
              Log in
            </Link>

            <Link
              href="/login"
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90"
            >
              Get started
            </Link>
          </nav>
        </header>

        <section className="flex flex-1 items-center py-24">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-medium text-white/45">
              AI DATA ANALYST
            </p>

            <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
              Turn business data into answers.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/50">
              Upload CSV or Excel data, ask questions in natural
              language, and turn your datasets into structured
              analysis.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                Start analyzing
              </Link>

              <Link
                href="/dashboard"
                className="rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-white/70 transition hover:border-white/20 hover:text-white"
              >
                Open workspace
              </Link>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 p-5">
                <p className="text-sm font-medium">Upload</p>
                <p className="mt-2 text-sm leading-6 text-white/40">
                  CSV and Excel datasets.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 p-5">
                <p className="text-sm font-medium">Ask</p>
                <p className="mt-2 text-sm leading-6 text-white/40">
                  Natural-language questions about your data.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 p-5">
                <p className="text-sm font-medium">Analyze</p>
                <p className="mt-2 text-sm leading-6 text-white/40">
                  SQL, KPIs, charts, and structured results.
                </p>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/10 pt-6 text-xs text-white/30">
          AI Data Analyst
        </footer>
      </div>
    </main>
  );
}