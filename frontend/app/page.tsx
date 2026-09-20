"use client";

import { useEffect, useMemo, useState, useRef } from "react";

type Theme = "dark" | "light"  ;

function LogoMark() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--text)] text-[var(--bg)] shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-transform duration-500 hover:scale-110 dark:shadow-[0_4px_12px_rgba(255,255,255,0.1)]">
      <svg
        viewBox="0 0 24 24"
        className="h-[17px] w-[17px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 18V8" />
        <path d="M9 18v-5" />
        <path d="M13 18V6" />
        <path d="M17 18v-8" />
        <path d="M21 18V4" />
      </svg>
    </div>
  );
}

function ArrowUpRightIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </svg>
  );
}

function ArrowRightIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 4 4L19 6" />
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

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3 1.4 5.1L18 10l-4.6 1.9L12 17l-1.4-5.1L6 10l4.6-1.9L12 3Z" />
      <path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="7.5" ry="3" />
      <path d="M4.5 5v7c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V5" />
      <path d="M4.5 12v7c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-7" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V5" />
      <path d="M4 19h17" />
      <path d="m7 15 4-4 3 2 6-7" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m8 8-4 4 4 4" />
      <path d="m16 8 4 4-4 4" />
      <path d="m14 5-4 14" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 20h14" />
    </svg>
  );
}

// Fixed Reveal Component - Properly triggers on scroll
function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentRef = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );

    if (currentRef) observer.observe(currentRef);
    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function ProductWindow({ progress, compact = false }: { progress: number; compact?: boolean }) {
  const chartBars = [42, 58, 48, 74, 62, 87, 69, 96, 76, 88, 81, 100];
  const tilt = Math.max(-1.5, Math.min(1.5, (progress - 0.5) * -3));

  return (
    <div
      className={`relative mx-auto w-full px-4 sm:px-0 ${compact ? "max-w-[920px]" : "max-w-[1120px]"}`}
      style={{
        transform: `perspective(2000px) rotateX(${tilt}deg)`,
        transition: "transform 800ms cubic-bezier(.22,1,.36,1)",
      }}
    >
      <div className="absolute -inset-8 hidden rounded-[40px] bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,.18),transparent_60%)] blur-3xl dark:bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,.15),transparent_60%)] sm:block" />

      <div className="relative overflow-hidden rounded-[20px] sm:rounded-[28px] border border-[var(--border-strong)] bg-[var(--card)] shadow-[0_30px_90px_rgba(15,23,42,0.12)] dark:shadow-[0_40px_120px_rgba(0,0,0,0.8)]">
        {/* Browser Header */}
        <div className="flex h-12 items-center justify-between border-b border-[var(--border)] px-4 sm:px-5 bg-[var(--surface)]">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[#ff5f57] shadow-sm" />
            <div className="h-3 w-3 rounded-full bg-[#febc2e] shadow-sm" />
            <div className="h-3 w-3 rounded-full bg-[#28c840] shadow-sm" />
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-[10px] sm:text-[11px] font-medium text-[var(--muted-strong)] shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Query Workspace
          </div>

          <div className="w-12 sm:w-16" />
        </div>

        <div className="grid min-h-[400px] sm:min-h-[550px] md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr]">
          {/* Sidebar */}
          <aside className="hidden border-r border-[var(--border)] bg-[var(--surface)] p-5 md:block">
            <div className="mb-6 flex items-center gap-3 px-1">
              <LogoMark />
              <div>
                <div className="text-[12px] font-bold text-[var(--text)]">AI Data Analyst</div>
                <div className="text-[10px] font-medium text-[var(--muted)]">Acme Workspace</div>
              </div>
            </div>

            <div className="space-y-1.5">
              {["Overview", "Datasets", "Query", "History"].map((item, index) => (
                <div
                  key={item}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-[11px] font-bold transition-all ${
                    index === 2
                      ? "bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900"
                      : "text-[var(--muted-strong)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${index === 2 ? "bg-current" : "bg-[var(--muted)]"}`} />
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-8 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
              Datasets
            </div>

            <div className="mt-3 space-y-1.5">
              {["orders_2026.csv", "customers.xlsx", "products.csv"].map((name, index) => (
                <div
                  key={name}
                  className={`truncate cursor-pointer rounded-xl px-3 py-2 text-[10px] transition-all ${
                    index === 0
                      ? "bg-[var(--border)] font-bold text-[var(--text)] shadow-sm"
                      : "font-medium text-[var(--muted-strong)] hover:bg-[var(--card)] hover:text-[var(--text)]"
                  }`}
                >
                  {name}
                </div>
              ))}
            </div>
          </aside>

          {/* Main Area */}
          <main className="min-w-0 bg-[var(--bg)]">
            <div className="border-b border-[var(--border)] px-5 py-4 sm:px-7 sm:py-6">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
                Natural language analysis
              </div>
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-[680px] text-[16px] sm:text-[18px] font-bold leading-relaxed text-[var(--text)]">
                  Show the top 5 products by revenue this quarter
                </div>
                <div className="hidden shrink-0 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5 text-[10px] font-bold text-[var(--muted-strong)] shadow-sm sm:block">
                  ⌘ Enter
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-[1fr_260px] lg:p-8">
              {/* Left Column: Code & Chart */}
              <div className="min-w-0 space-y-5">
                {/* Code Block */}
                <div className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm transition-all hover:shadow-md hover:border-[var(--border-strong)]">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Generated SQL</span>
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">Validated</span>
                  </div>
                  <pre className="overflow-x-auto font-mono text-[11px] sm:text-[12px] leading-6 text-[var(--text)]">
                    <code>
                      <span className="text-violet-600 dark:text-violet-400">SELECT</span> product_name, <span className="text-violet-600 dark:text-violet-400">SUM</span>(revenue) <span className="text-violet-600 dark:text-violet-400">AS</span> total_revenue{"\n"}
                      <span className="text-violet-600 dark:text-violet-400">FROM</span> orders{"\n"}
                      <span className="text-violet-600 dark:text-violet-400">WHERE</span> quarter = <span className="text-emerald-600 dark:text-emerald-400">&apos;Q3&apos;</span>{"\n"}
                      <span className="text-violet-600 dark:text-violet-400">GROUP BY</span> product_name{"\n"}
                      <span className="text-violet-600 dark:text-violet-400">ORDER BY</span> total_revenue <span className="text-violet-600 dark:text-violet-400">DESC</span>{"\n"}
                      <span className="text-violet-600 dark:text-violet-400">LIMIT</span> <span className="text-blue-600 dark:text-blue-400">5</span>
                    </code>
                  </pre>
                </div>

                {/* Chart Block */}
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm transition-all hover:shadow-md hover:border-[var(--border-strong)]">
                  <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--text)]">Revenue by product</div>
                      <div className="mt-1 text-[10px] font-medium text-[var(--muted)]">Top 5 products · Q3</div>
                    </div>
                    <div className="self-start sm:self-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[9px] font-bold text-[var(--muted-strong)]">
                      Bar chart
                    </div>
                  </div>

                  <div className="flex h-[130px] sm:h-[160px] items-end gap-2 border-b border-[var(--border-strong)] px-1 pb-1">
                    {chartBars.map((height, index) => (
                      <div key={`${height}-${index}`} className="group/bar flex h-full flex-1 items-end relative">
                        <div
                          className="w-full rounded-t-md bg-gradient-to-t from-indigo-600 via-indigo-500 to-violet-500 opacity-85 transition-all duration-300 group-hover/bar:opacity-100 group-hover/bar:brightness-125"
                          style={{
                            height: `${Math.min(height, 100)}%`,
                            transform: progress > 0.1 ? "scaleY(1)" : "scaleY(0.6)",
                            transformOrigin: "bottom",
                            transition: "transform 900ms cubic-bezier(.22,1,.36,1), filter 300ms",
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex justify-between text-[8px] sm:text-[9px] font-bold text-[var(--muted-strong)]">
                    <span className="truncate">Product A</span>
                    <span className="truncate hidden sm:inline">Product B</span>
                    <span className="truncate hidden sm:inline">Product C</span>
                    <span className="truncate hidden sm:inline">Product D</span>
                    <span className="truncate">Product E</span>
                  </div>
                </div>
              </div>

              {/* Right Column: KPIs */}
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm transition-all hover:shadow-md hover:border-[var(--border-strong)]">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Total revenue</div>
                  <div className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text)]">$842K</div>
                  <div className="mt-2 inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                    +18.4% vs previous quarter
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm transition-all hover:shadow-md hover:border-[var(--border-strong)]">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Rows analyzed</div>
                  <div className="mt-3 text-xl sm:text-2xl font-bold tracking-tight text-[var(--text)]">128,492</div>
                </div>

                <div className="rounded-2xl border border-[var(--border-strong)] bg-gradient-to-br from-indigo-500/[0.08] to-violet-500/[0.03] p-5 shadow-sm transition-all hover:shadow-md dark:from-indigo-500/[0.12] dark:to-violet-500/[0.05]">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
                    <SparkIcon />
                    Analysis
                  </div>
                  <p className="mt-3 text-[12px] font-medium leading-relaxed text-[var(--text)]">
                    Product D generated the highest revenue in the selected period.
                  </p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, eyebrow, title, description }: { icon: React.ReactNode; eyebrow: string; title: string; description: string; }) {
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-7 sm:p-9 shadow-sm transition-all duration-500 hover:-translate-y-2 hover:border-indigo-500/30 hover:shadow-[0_20px_60px_rgba(79,70,229,0.1)] dark:hover:shadow-[0_20px_60px_rgba(79,70,229,0.15)]">
      <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-indigo-500/[0.03] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      <div className="relative z-10 flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--accent)] shadow-sm transition-all duration-500 group-hover:scale-110 group-hover:border-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-white">
        {icon}
      </div>

      <div className="relative z-10 mt-8 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--muted-strong)] transition-colors group-hover:text-indigo-500">
        {eyebrow}
      </div>

      <h3 className="relative z-10 mt-3 text-xl sm:text-2xl font-bold tracking-tight text-[var(--text)] transition-colors">
        {title}
      </h3>

      <p className="relative z-10 mt-4 text-[15px] font-medium leading-relaxed text-[var(--muted-strong)]">
        {description}
      </p>
    </div>
  );
}

function WorkflowCard({ number, title, description }: { number: string; title: string; description: string; }) {
  return (
    <div className="group relative overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-7 sm:p-9 shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:border-indigo-500/40 hover:shadow-[0_20px_50px_rgba(79,70,229,0.1)]">
      <div className="flex items-start justify-between relative z-10">
        <span className="font-mono text-[13px] font-bold tracking-[0.2em] text-[var(--muted-strong)] transition-colors group-hover:text-indigo-500">
          {number}
        </span>
        <div className="rounded-full bg-[var(--surface)] p-2 text-[var(--muted)] transition-all duration-500 group-hover:bg-indigo-500 group-hover:text-white group-hover:scale-110">
          <ArrowUpRightIcon size={18} />
        </div>
      </div>

      <div className="mt-16 sm:mt-24 relative z-10">
        <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text)] transition-colors">
          {title}
        </h3>
        <p className="mt-3 text-[15px] font-medium leading-relaxed text-[var(--muted-strong)]">
          {description}
        </p>
      </div>

      <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-indigo-500/10 blur-[50px] transition-all duration-700 group-hover:scale-150 group-hover:bg-indigo-500/20" />
    </div>
  );
}

function PricingCard({ name, price, description, features, featured = false }: { name: string; price: string; description: string; features: string[]; featured?: boolean; }) {
  return (
    <div className={`group relative rounded-[32px] border p-8 sm:p-10 transition-all duration-500 hover:-translate-y-2 ${
      featured
        ? "border-indigo-500/50 bg-[linear-gradient(145deg,rgba(79,70,229,.04),rgba(124,58,237,.01))] shadow-[0_30px_80px_rgba(79,70,229,.12)] dark:bg-[linear-gradient(145deg,rgba(79,70,229,.12),rgba(124,58,237,.04))] dark:shadow-[0_30px_80px_rgba(79,70,229,.2)]"
        : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-strong)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
    }`}>
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 backdrop-blur-md shadow-sm">
          Most flexible
        </div>
      )}

      <div className="text-xl font-bold text-[var(--text)]">{name}</div>
      <p className="mt-3 max-w-[260px] text-[15px] font-medium leading-relaxed text-[var(--muted-strong)]">{description}</p>

      <div className="mt-8 flex items-end gap-1.5">
        <span className="text-5xl sm:text-6xl font-bold tracking-tight text-[var(--text)]">{price}</span>
        {price !== "Custom" && <span className="pb-1.5 text-[15px] font-bold text-[var(--muted)]">/ month</span>}
      </div>

      <a href="/login" className={`mt-8 flex h-14 items-center justify-center rounded-2xl text-[15px] font-bold shadow-sm transition-all duration-300 hover:shadow-md active:scale-[0.98] ${
        featured
          ? "bg-indigo-600 text-white hover:bg-indigo-700"
          : "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--border)]"
      }`}>
        {name === "Enterprise" ? "Talk to us" : "Get started free"}
      </a>

      <div className="mt-10 space-y-4 border-t border-[var(--border)] pt-8">
        {features.map((feature) => (
          <div key={feature} className="flex items-start gap-3.5 text-[14px] font-medium text-[var(--muted-strong)]">
            <div className="mt-0.5 text-indigo-500"><CheckIcon /></div>
            <span>{feature}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Robust Theme Initialization
  useEffect(() => {
    setMounted(true);
    const saved = window.localStorage.getItem("ai-data-analyst-theme") as Theme | null;
    if (saved) {
      setTheme(saved);
    } else {
      setTheme("dark");
    }
  }, []);

  // Theme Persistence
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

  // Scroll Progress logic for 3D Window
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(max > 0 ? window.scrollY / max : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const colors = useMemo(() =>
    theme === "dark"
      ? {
          bg: "#050505", // Premium deep OLED Black
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
          text: "#050505", // Premium deep Slate
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

  // Prevent flashing before hydration
  if (!mounted) return null;

  return (
    <main
      style={themeStyle}
      className="min-h-screen overflow-x-hidden bg-[var(--bg)] text-[var(--text)] antialiased transition-colors duration-500"
    >
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }
        body { margin: 0; background: var(--bg); }
        ::selection { background-color: var(--text); color: var(--bg); }
        @keyframes landingPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.95); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }
        .landing-pulse { animation: landingPulse 6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          .landing-pulse { animation: none !important; }
        }
      `}</style>

      {/* Background Gradients */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute left-[5%] top-[-10%] h-[400px] sm:h-[600px] w-[400px] sm:w-[600px] rounded-full bg-blue-500/[0.04] blur-[120px] dark:bg-blue-500/[0.06]" />
        <div className="absolute right-[-5%] top-[5%] h-[400px] sm:h-[600px] w-[400px] sm:w-[600px] rounded-full bg-violet-500/[0.04] blur-[120px] dark:bg-violet-500/[0.06]" />
        <div className="landing-pulse absolute left-[45%] top-[25%] h-[250px] sm:h-[300px] w-[250px] sm:w-[300px] rounded-full bg-indigo-500/[0.03] blur-[100px]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-[72px] sm:h-[80px] max-w-[1240px] items-center justify-between px-5 md:px-8">
          <a href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <LogoMark />
            <span className="text-[16px] font-bold tracking-tight">Data Analyst</span>
          </a>

          <nav className="hidden items-center gap-8 text-[14px] font-bold text-[var(--muted-strong)] lg:flex">
            <a className="transition-colors hover:text-[var(--text)]" href="#platform">Platform</a>
            <a className="transition-colors hover:text-[var(--text)]" href="#features">Features</a>
            <a className="transition-colors hover:text-[var(--text)]" href="#developers">Developers</a>
            <a className="transition-colors hover:text-[var(--text)]" href="#pricing">Pricing</a>
          </nav>

          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => setTheme((c) => (c === "light" ? "dark" : "light"))}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-strong)] shadow-sm transition-all hover:border-[var(--border-strong)] hover:text-[var(--text)] hover:bg-[var(--surface)] hover:scale-105 active:scale-95"
            >
              {theme === "light" ? <MoonIcon /> : <SunIcon />}
            </button>
            <a href="/login" className="hidden h-11 items-center rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 text-[14px] font-bold shadow-sm transition-all hover:bg-[var(--surface)] hover:border-[var(--border-strong)] sm:flex">
              Sign in
            </a>
            <a href="/login" className="hidden h-11 items-center rounded-xl bg-[var(--text)] px-6 text-[14px] font-bold text-[var(--bg)] shadow-md transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95 sm:flex">
              Get started
            </a>
            <button
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--text)] shadow-sm transition-all hover:bg-[var(--surface)] active:scale-95 lg:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <div className={`transition-transform duration-300 ${isMobileMenuOpen ? "rotate-90 scale-0 absolute" : "rotate-0 scale-100"}`}><MenuIcon /></div>
              <div className={`transition-transform duration-300 ${isMobileMenuOpen ? "rotate-0 scale-100" : "-rotate-90 scale-0 absolute"}`}><CloseIcon /></div>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        <div className={`absolute left-0 top-[72px] sm:top-[80px] w-full origin-top transform border-b border-[var(--border)] bg-[var(--bg)]/95 p-6 backdrop-blur-2xl shadow-xl transition-all duration-300 ease-in-out lg:hidden ${isMobileMenuOpen ? "translate-y-0 opacity-100 visible" : "-translate-y-4 opacity-0 invisible"}`}>
          <nav className="flex flex-col gap-6 text-[16px] font-bold text-[var(--muted-strong)]">
            <a href="#platform" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[var(--text)] transition-colors">Platform</a>
            <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[var(--text)] transition-colors">Features</a>
            <a href="#developers" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[var(--text)] transition-colors">Developers</a>
            <a href="#pricing" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[var(--text)] transition-colors">Pricing</a>
            <div className="h-px w-full bg-[var(--border)]" />
            <div className="flex flex-col gap-3">
              <a href="/login" className="flex h-12 w-full items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--card)] shadow-sm text-[var(--text)]">Sign in</a>
              <a href="/login" className="flex h-12 w-full items-center justify-center rounded-xl bg-[var(--text)] text-[var(--bg)] shadow-md">Get started free</a>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 px-5 pb-16 pt-16 sm:pb-24 sm:pt-24 md:px-8 md:pb-32 md:pt-25">
        <div className="mx-auto max-w-[1240px]">
          <div className="mx-auto max-w-[900px] text-center">

            {/* Fixed Pill Badge */}
            <Reveal>
              <div className="mx-auto flex w-fit items-center gap-3 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text)] shadow-sm backdrop-blur-md">
                <div className="relative flex h-2 w-2 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500"></span>
                </div>
                AI Data Analyst
              </div>
            </Reveal>

            <Reveal delay={100}>
              <h1 className="mt-8 sm:mt-10 text-[clamp(2.75rem,8vw,7.5rem)] font-bold leading-[1.05] sm:leading-[0.95] tracking-tight sm:tracking-[-0.04em]">
                Turn your data
                <br />
                <span className="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent dark:from-indigo-400 dark:to-violet-400 drop-shadow-sm">
                  into answers.
                </span>
              </h1>
            </Reveal>

            <Reveal delay={200}>
              <div className="mx-auto mt-6 sm:mt-8 max-w-[640px]">
                <p className="text-[17px] font-bold leading-8 text-[var(--text)] md:text-xl md:leading-9">
                  Ask questions. Get analysis. Make decisions.
                </p>
                <p className="mt-3 sm:mt-4 text-[15px] font-medium leading-relaxed text-[var(--muted-strong)]">
                  Upload CSV or Excel data, ask questions in natural language,
                  and turn your datasets into structured, production-ready analysis.
                </p>
              </div>
            </Reveal>

            <Reveal delay={300}>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="/login"
                  className="group flex h-14 w-full sm:w-auto items-center justify-center gap-2.5 rounded-xl bg-[var(--text)] px-8 text-[15px] font-bold text-[var(--bg)] transition-all duration-300 hover:-translate-y-1 active:scale-[0.98]"
                >
                  Get started free
                  <div className="transition-transform duration-300 group-hover:translate-x-1">
                    <ArrowRightIcon size={16} />
                  </div>
                </a>
              </div>
            </Reveal>
          </div>

          <Reveal delay={400}>
            <div className="mt-20 sm:mt-28">
              <ProductWindow progress={scrollProgress} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Platform Section */}
      <section id="platform" className="relative z-10 border-y border-[var(--border)] px-5 py-24 sm:py-32 md:px-8 md:py-40 bg-[var(--card)]">
        <div className="mx-auto max-w-[1120px]">
          <Reveal>
            <div className="grid gap-8 sm:gap-12 md:grid-cols-[.9fr_1.1fr] md:items-end">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">From question to insight</div>
                <h2 className="mt-5 sm:mt-6 text-4xl sm:text-5xl font-bold tracking-tight md:text-6xl md:tracking-[-0.04em]">
                  Your data,<br />without the busywork.
                </h2>
              </div>
              <p className="max-w-[540px] text-[16px] font-medium leading-relaxed text-[var(--muted-strong)] md:justify-self-end md:text-lg">
                One workspace for the entire analytical loop. Your question becomes a validated query, your query becomes evidence, and the result becomes something you can actually use.
              </p>
            </div>
          </Reveal>

          <div className="mt-20 sm:mt-24 grid gap-5 sm:grid-cols-2 md:grid-cols-4">
            {[
              ["01", "Your question", "Ask in the language your team already uses."],
              ["02", "Your data", "Work directly with the datasets that matter."],
              ["03", "Your analysis", "Generate SQL, metrics, tables and charts."],
              ["04", "Your answer", "See the result and the reasoning behind it."],
            ].map(([number, title, description], i) => (
              <Reveal key={number} delay={i * 100}>
                <div className="group relative overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--bg)] p-7 sm:p-9 shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:border-indigo-500/40 hover:shadow-[0_20px_50px_rgba(79,70,229,0.1)]">
                  <div className="flex items-start justify-between relative z-10">
                    <span className="font-mono text-[13px] font-bold tracking-[0.2em] text-[var(--muted-strong)] transition-colors group-hover:text-indigo-500">{number}</span>
                    <div className="rounded-full bg-[var(--surface)] p-2 text-[var(--muted)] transition-all duration-500 group-hover:bg-indigo-500 group-hover:text-white group-hover:scale-110"><ArrowUpRightIcon size={18} /></div>
                  </div>
                  <div className="mt-1 sm:mt-4 relative z-10">
                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text)] transition-colors">{title}</h3>
                    <p className="mt-3 text-[15px] font-medium leading-relaxed text-[var(--muted-strong)]">{description}</p>
                  </div>
                  <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-indigo-500/10 blur-[50px] transition-all duration-700 group-hover:scale-150 group-hover:bg-indigo-500/20" />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 px-5 py-24 sm:py-32 md:px-8 md:py-40">
        <div className="mx-auto max-w-[1120px]">
          <Reveal>
            <div className="max-w-[720px]">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Platform</div>
              <h2 className="mt-5 sm:mt-6 text-4xl sm:text-5xl font-bold tracking-tight md:text-6xl md:tracking-[-0.04em]">
                Built for people<br />who work with data.
              </h2>
              <p className="mt-5 sm:mt-6 text-[16px] font-medium leading-relaxed text-[var(--muted-strong)] md:text-xl">
                The interface stays simple. The analytical machinery underneath it does not.
              </p>
            </div>
          </Reveal>

          {/* Grid me height full stretch karne ke liye Reveal me className="h-full" add kiya hai */}
          <div className="mt-16 sm:mt-20 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <Reveal className="h-full" delay={0}><FeatureCard icon={<SparkIcon />} eyebrow="Natural language" title="Ask, don't wrestle with syntax." description="Start with the business question. The analytical workflow translates intent into structured, inspectable SQL." /></Reveal>
            <Reveal className="h-full" delay={100}><FeatureCard icon={<CodeIcon />} eyebrow="SQL workspace" title="Stay close to the data." description="Generated SQL remains visible and editable, giving technical users the control they expect from a serious analytical environment." /></Reveal>
            <Reveal className="h-full" delay={200}><FeatureCard icon={<ChartIcon />} eyebrow="Results" title="Make the answer visual." description="Turn returned data into KPIs, tables and charts without leaving the analytical workflow." /></Reveal>
            <Reveal className="h-full" delay={0}><FeatureCard icon={<DatabaseIcon />} eyebrow="Datasets" title="Understand the shape first." description="Schema and profiling information give the analytical engine context before a question reaches execution." /></Reveal>
            <Reveal className="h-full" delay={100}><FeatureCard icon={<UploadIcon />} eyebrow="Ingestion" title="Bring your existing data." description="Work with CSV and spreadsheet data through a managed ingestion and analytical query pipeline." /></Reveal>
            <Reveal className="h-full" delay={200}><FeatureCard icon={<CheckIcon />} eyebrow="Safety" title="Analysis with guardrails." description="Queries are validated and executed through a read-only analytical path rather than exposing your application database directly." /></Reveal>
          </div>
        </div>
      </section>


      {/* developers Section */}
      <section
        id="developers"
        className="relative z-10 overflow-hidden border-y border-[var(--border)] px-5 py-24 md:px-8 md:py-32"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_40%,rgba(79,70,229,.10),transparent_35%)]" />

        <div className="relative mx-auto max-w-[1120px]">
          <Reveal>
            <div className="grid gap-14 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                  For technical teams
                </div>

                <h2 className="mt-5 text-4xl font-semibold tracking-[-0.055em] md:text-6xl">
                  Simple on the surface.
                  <br />
                  Serious underneath.
                </h2>

                <p className="mt-6 max-w-[560px] text-base leading-7 text-[var(--muted-strong)]">
                  Keep the approachable natural-language workflow while giving
                  analysts and developers visibility into the SQL, schema,
                  results and analytical pipeline.
                </p>

                <a
                  href="/login"
                  className="group mt-8 inline-flex items-center gap-2 text-sm font-medium text-[13px] text-[var(--text)] transition-all duration-500 hover:text-indigo-600 hover:scale-110"
                >
                  Explore the workspace
                  <div className="group rounded-full bg-(--surface) p-2 transition-all duration-500 group-hover:scale-110"><ArrowUpRightIcon size={15} /></div>
                </a>

              </div>

              <div className="rounded-[26px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[0_30px_100px_var(--shadow-color-strong)]">
                <div className="overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--surface)]">
                  <div className="flex h-10 items-center border-b border-[var(--border)] px-4">
                    <span className="font-mono text-[9px] text-[var(--muted)]">
                      query.sql
                    </span>
                  </div>

                  <div className="grid min-h-[340px] grid-cols-1 sm:grid-cols-[1fr_170px]">
                    <div className="p-5 font-mono text-[10px] leading-6 text-[var(--muted-strong)]">
                      <div>
                        <span className="mr-4 text-[var(--muted)]">1</span>
                        <span className="text-[var(--code-keyword)]">
                          SELECT
                        </span>{" "}
                        customer_segment,
                      </div>
                      <div>
                        <span className="mr-4 text-[var(--muted)]">2</span>
                        <span className="ml-7 text-[var(--code-keyword)]">
                          SUM
                        </span>
                        (revenue){" "}
                        <span className="text-[var(--code-keyword)]">
                          AS
                        </span>{" "}
                        revenue
                      </div>
                      <div>
                        <span className="mr-4 text-[var(--muted)]">3</span>
                        <span className="text-[var(--code-keyword)]">
                          FROM
                        </span>{" "}
                        orders
                      </div>
                      <div>
                        <span className="mr-4 text-[var(--muted)]">4</span>
                        <span className="text-[var(--code-keyword)]">
                          GROUP BY
                        </span>{" "}
                        customer_segment
                      </div>
                      <div>
                        <span className="mr-4 text-[var(--muted)]">5</span>
                        <span className="text-[var(--code-keyword)]">
                          ORDER BY
                        </span>{" "}
                        revenue{" "}
                        <span className="text-[var(--code-keyword)]">
                          DESC
                        </span>
                      </div>
                      <div>
                        <span className="mr-4 text-[var(--muted)]">6</span>
                        <span className="text-[var(--code-keyword)]">
                          LIMIT
                        </span>{" "}
                        <span className="text-[var(--code-number)]">10</span>
                      </div>

                      <div className="mt-8 h-px bg-[var(--border)]" />

                      <div className="mt-5 flex items-center gap-2 font-sans text-[9px] text-[var(--positive)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        Query validated · read-only
                      </div>
                    </div>

                    <div className="border-t border-[var(--border)] bg-[var(--card)] p-4 sm:border-l sm:border-t-0">
                      <div className="text-[8px] uppercase tracking-[0.14em] text-[var(--muted)]">
                        Schema
                      </div>

                      <div className="mt-4 space-y-2 font-mono text-[8px] text-[var(--muted-strong)]">
                        <div>customer_id</div>
                        <div>customer_segment</div>
                        <div>order_date</div>
                        <div>revenue</div>
                        <div>quantity</div>
                        <div>region</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative z-10 px-5 py-24 md:px-8 md:py-32">
        <div className="mx-auto max-w-[1120px]">
          <Reveal>
            <div className="grid gap-12 md:grid-cols-[1fr_.8fr] md:items-end">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                  Workflows
                </div>
                <h2 className="mt-5 text-4xl font-semibold tracking-[-0.055em] md:text-6xl">
                  One analytical surface.
                  <br />
                  Many questions.
                </h2>
              </div>

              <p className="text-base leading-7 text-[var(--muted-strong)]">
                Revenue, operations, customers, products or finance — the
                workflow stays consistent while the questions change.
              </p>
            </div>
          </Reveal>


            <div className="mt-16 grid gap-4 md:grid-cols-2">
            {[
              ["Business performance", "Understand revenue, orders, margins and the metrics your team reviews every week."],
              ["Customer analysis", "Explore customer segments, retention patterns and purchasing behavior."],
              ["Operations", "Find bottlenecks, volume patterns and the operational signals hidden in raw tables."],
              ["Ad-hoc analysis", "Ask the question that just came up in the meeting and inspect the evidence immediately."],
            ].map(([title, description], i) => (
              <Reveal key={title} delay={i * 100}>
                <div className="group relative overflow-hidden rounded-[28px] h-40 border border-[var(--border)] bg-[var(--bg)] p-7 sm:p-9 shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:border-indigo-500/40 hover:shadow-[0_20px_50px_rgba(79,70,229,0.1)]">
                  <div className="flex items-start justify-between relative z-10">
                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text)] transition-colors">{title}</h3>
                    <div className="rounded-full bg-[var(--surface)] p-2 transition-all duration-500 group-hover:bg-indigo-500 group-hover:text-white group-hover:scale-110"><ArrowUpRightIcon size={18} /></div>
                  </div>
                  <div className="mt-1 sm:mt-4 relative z-10">
                    <p className="mt-2 max-w-[520px] text-sm leading-6 text-[var(--muted-strong)]">{description}</p>
                  </div>
                  <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-indigo-500/10 blur-[50px] transition-all duration-700 group-hover:scale-150 group-hover:bg-indigo-500/20" />
                </div>
              </Reveal>
            ))}
          </div>


        </div>
      </section>


      {/* Pricing Section */}
      <section id="pricing" className="relative z-10 border-y border-[var(--border)] px-5 py-24 sm:py-32 md:px-8 md:py-40 bg-[var(--surface)]">
        <div className="mx-auto max-w-[1120px]">
          <Reveal>
            <div className="text-center">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Pricing</div>
              <h2 className="mt-5 sm:mt-6 text-4xl sm:text-5xl font-bold tracking-tight md:text-6xl md:tracking-[-0.04em]">Start simple.<br />Grow with the workflow.</h2>
              <p className="mx-auto mt-5 sm:mt-6 max-w-[560px] text-[16px] font-medium leading-relaxed text-[var(--muted-strong)] md:text-lg">
                Flexible plans for individual analysis, growing teams and organizations that need a deeper analytical workflow.
              </p>
            </div>
          </Reveal>

          <div className="mt-16 sm:mt-20 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Reveal delay={0}><PricingCard name="Free" price="$0" description="Explore the workflow and start analyzing your data." features={["CSV and spreadsheet analysis", "Natural-language questions", "SQL visibility", "Result tables and charts"]} /></Reveal>
            <Reveal delay={100}><PricingCard featured name="Pro" price="$49" description="For analysts and teams doing recurring data work." features={["Everything in Free", "Higher usage limits", "More datasets", "Advanced analytical workflows", "Priority access"]} /></Reveal>
            <Reveal delay={200}><PricingCard name="Enterprise" price="Custom" description="For organizations with larger analytical requirements." features={["Workspace controls", "Higher-scale usage", "Custom requirements", "Business support", "Future API capabilities"]} /></Reveal>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="relative z-10 overflow-hidden px-5 py-28 sm:py-36 md:px-8 md:py-48 bg-[var(--card)]">
        <div className="absolute left-1/2 top-1/2 h-[350px] sm:h-[500px] w-[350px] sm:w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/[0.04] blur-[100px] sm:blur-[130px] dark:bg-violet-500/[0.06]" />
        <Reveal>
          <div className="relative mx-auto max-w-[850px] text-center">
            <div className="mx-auto flex h-12 sm:h-14 w-12 sm:w-14 items-center justify-center rounded-[14px] border border-[var(--border-strong)] bg-[var(--text)] shadow-md text-[var(--bg)]">
              <SparkIcon />
            </div>
            <h2 className="mt-8 sm:mt-10 text-5xl sm:text-6xl font-bold tracking-tight md:text-7xl md:tracking-[-0.04em]">
              Your next question<br />starts here.
            </h2>
            <p className="mx-auto mt-6 sm:mt-8 max-w-[570px] text-[16px] sm:text-lg font-medium leading-relaxed text-[var(--muted-strong)]">
              Bring a dataset, ask something useful, and let the analytical workflow take it from there.
            </p>
            <a href="/login" className="group mt-10 sm:mt-12 inline-flex h-14 items-center gap-2.5 rounded-xl bg-[var(--text)] px-8 text-[15px] font-bold text-[var(--bg)] shadow-lg transition-all hover:-translate-y-1 active:scale-[0.98]">
              Get started free
              <div className="transition-transform duration-300 group-hover:translate-x-1"><ArrowRightIcon size={16} /></div>
            </a>
          </div>
        </Reveal>
      </section>

      <footer className="relative z-10 border-t border-[var(--border)] px-5 py-12 sm:py-16 md:px-8 bg-[var(--surface)]">
        <div className="mx-auto max-w-[1120px]">
          <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
            <div>
              <a href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
                <LogoMark />
                <span className="text-[16px] font-bold tracking-tight text-[var(--text)]">Data Analyst</span>
              </a>
              <p className="mt-5 max-w-[300px] text-[14px] font-medium leading-relaxed text-[var(--muted-strong)]">
                A serious analytical workspace for turning business data into clear answers.
              </p>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Product</div>
              <div className="mt-5 space-y-4 text-[14px] font-medium text-[var(--muted-strong)]">
                <a className="block hover:text-[var(--text)] transition-colors" href="#platform">Platform</a>
                <a className="block hover:text-[var(--text)] transition-colors" href="#features">Features</a>
                <a className="block hover:text-[var(--text)] transition-colors" href="#pricing">Pricing</a>
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Developers</div>
              <div className="mt-5 space-y-4 text-[14px] font-medium text-[var(--muted-strong)]">
                <a className="block hover:text-[var(--text)] transition-colors" href="#developers">SQL workspace</a>
                <a className="block hover:text-[var(--text)] transition-colors" href="#developers">Data layer</a>
                <a className="block hover:text-[var(--text)] transition-colors" href="/login">Sign in</a>
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Company</div>
              <div className="mt-5 space-y-4 text-[14px] font-medium text-[var(--muted-strong)]">
                <a className="block hover:text-[var(--text)] transition-colors" href="/">About</a>
                <a className="block hover:text-[var(--text)] transition-colors" href="/">Privacy</a>
                <a className="block hover:text-[var(--text)] transition-colors" href="/">Terms</a>
              </div>
            </div>
          </div>
          <div className="mt-12 sm:mt-16 flex flex-col gap-4 border-t border-[var(--border)] pt-8 text-[12px] font-medium text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
            <span>© 2026 AI Data Analyst. All rights reserved.</span>
            <span>Built for analytical work.</span>
          </div>
        </div>
      </footer>
    </main>
  );
}