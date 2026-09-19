"use client";

import {
  useEffect,
  useState,
} from "react";

import type {
  ComponentType,
  ReactNode,
} from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface DashboardShellProps {
  children: ReactNode;
}

interface IconProps {
  size?: number;
  strokeWidth?: number;
}

function IconGrid({
  size = 20,
  strokeWidth = 1.8,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
      <rect
        x="14"
        y="3"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
      <rect
        x="3"
        y="14"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
      <rect
        x="14"
        y="14"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

function IconDatabase({
  size = 20,
  strokeWidth = 1.8,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse
        cx="12"
        cy="5"
        rx="8"
        ry="3"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
      <path
        d="M4 5V12C4 13.657 7.582 15 12 15C16.418 15 20 13.657 20 12V5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
      <path
        d="M4 12V19C4 20.657 7.582 22 12 22C16.418 22 20 20.657 20 19V12"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

function IconSearch({
  size = 20,
  strokeWidth = 1.8,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="11"
        cy="11"
        r="6.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
      <path
        d="M16 16L21 21"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconHistory({
  size = 20,
  strokeWidth = 1.8,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M3 12A9 9 0 1 0 6 5.3"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        d="M3 4V9H8"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 7V12L15.5 14"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSettings({
  size = 20,
  strokeWidth = 1.8,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 15.5A3.5 3.5 0 1 0 12 8.5A3.5 3.5 0 0 0 12 15.5Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
      <path
        d="M19.4 15A1.8 1.8 0 0 0 19.76 16.98L19.83 17.05L17.05 19.83L16.98 19.76A1.8 1.8 0 0 0 15 19.4A1.8 1.8 0 0 0 13.9 21V21.1H10.1V21A1.8 1.8 0 0 0 9 19.4A1.8 1.8 0 0 0 7.02 19.76L6.95 19.83L4.17 17.05L4.24 16.98A1.8 1.8 0 0 0 4.6 15A1.8 1.8 0 0 0 3 13.9H2.9V10.1H3A1.8 1.8 0 0 0 4.6 9A1.8 1.8 0 0 0 4.24 7.02L4.17 6.95L6.95 4.17L7.02 4.24A1.8 1.8 0 0 0 9 4.6A1.8 1.8 0 0 0 10.1 3V2.9H13.9V3A1.8 1.8 0 0 0 15 4.6A1.8 1.8 0 0 0 16.98 4.24L17.05 4.17L19.83 6.95L19.76 7.02A1.8 1.8 0 0 0 19.4 9A1.8 1.8 0 0 0 21 10.1H21.1V13.9H21A1.8 1.8 0 0 0 19.4 15Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSparkles({
  size = 20,
  strokeWidth = 1.8,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <path
        d="M19 16L19.7 18.3L22 19L19.7 19.7L19 22L18.3 19.7L16 19L18.3 18.3L19 16Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMenu({
  size = 22,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M4 7H20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M4 12H20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M4 17H20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconChevron({
  size = 18,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M9 6L15 12L9 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface NavigationItem {
  label: string;
  href: string;
  available: boolean;
  icon: ComponentType<IconProps>;
}

const navigation: NavigationItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    available: true,
    icon: IconGrid,
  },
  {
    label: "Datasets",
    href: "/dashboard/datasets",
    available: true,
    icon: IconDatabase,
  },
  {
    label: "Query workspace",
    href: "/dashboard/query",
    available: false,
    icon: IconSparkles,
  },
  {
    label: "History",
    href: "/dashboard/history",
    available: false,
    icon: IconHistory,
  },
];

export default function DashboardShell({
  children,
}: DashboardShellProps) {
  const pathname = usePathname();

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const [
    sidebarCollapsed,
    setSidebarCollapsed,
  ] = useState(false);

  useEffect(() => {
    if (!sidebarOpen) {
      return;
    }

    const handleEscape = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleEscape,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape,
      );
    };
  }, [sidebarOpen]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const isNavigationActive = (
    item: NavigationItem,
  ) => {
    if (item.href === "/dashboard") {
      return pathname === "/dashboard";
    }

    return (
      pathname === item.href ||
      pathname.startsWith(`${item.href}/`)
    );
  };

  return (
    <div className="min-h-screen bg-[#07090d] text-white">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() =>
            setSidebarOpen(false)
          }
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/[0.07] bg-[#0a0d12]/95 backdrop-blur-2xl transition-all duration-300",
          "lg:translate-x-0",
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0",
          sidebarCollapsed
            ? "w-[84px]"
            : "w-[268px]",
        ].join(" ")}
      >
        <div
          className={[
            "flex h-[76px] items-center border-b border-white/[0.06]",
            sidebarCollapsed
              ? "justify-center px-3"
              : "justify-between px-5",
          ].join(" ")}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] shadow-[0_0_30px_rgba(255,255,255,0.03)]">
              <IconSparkles size={18} />
            </div>

            {!sidebarCollapsed && (
              <div>
                <p className="text-[15px] font-semibold tracking-[-0.02em]">
                  Data Analyst
                </p>

                <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                  Intelligence workspace
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              setSidebarCollapsed(
                (value) => !value,
              )
            }
            aria-label={
              sidebarCollapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            className="hidden rounded-lg p-2 text-white/40 transition hover:bg-white/[0.05] hover:text-white lg:block"
          >
            <IconChevron size={17} />
          </button>
        </div>

        <div className="flex-1 px-3 py-5">
          {!sidebarCollapsed && (
            <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">
              Workspace
            </p>
          )}

          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active =
                isNavigationActive(item);

              if (!item.available) {
                return (
                  <button
                    key={item.label}
                    type="button"
                    disabled
                    title={`${item.label} — coming next`}
                    className={[
                      "group flex w-full cursor-not-allowed items-center rounded-xl px-3 py-3 text-left text-white/25",
                      sidebarCollapsed
                        ? "justify-center"
                        : "gap-3",
                    ].join(" ")}
                  >
                    <Icon size={19} />

                    {!sidebarCollapsed && (
                      <>
                        <span className="flex-1 text-[13px] font-medium">
                          {item.label}
                        </span>

                        <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-white/25">
                          Soon
                        </span>
                      </>
                    )}
                  </button>
                );
              }

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  title={item.label}
                  className={[
                    "group flex w-full items-center rounded-xl px-3 py-3 text-left transition",
                    active
                      ? "bg-white/[0.07] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                      : "text-white/50 hover:bg-white/[0.04] hover:text-white",
                    sidebarCollapsed
                      ? "justify-center"
                      : "gap-3",
                  ].join(" ")}
                >
                  <Icon size={19} />

                  {!sidebarCollapsed && (
                    <span className="flex-1 text-[13px] font-medium">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-white/[0.06] p-3">
          <button
            type="button"
            disabled
            title="Settings will be added later"
            className={[
              "flex w-full cursor-not-allowed items-center rounded-xl px-3 py-3 text-white/25",
              sidebarCollapsed
                ? "justify-center"
                : "gap-3",
            ].join(" ")}
          >
            <IconSettings size={19} />

            {!sidebarCollapsed && (
              <span className="text-[13px] font-medium">
                Settings
              </span>
            )}
          </button>

          {!sidebarCollapsed && (
            <div className="mt-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25">
                Current plan
              </p>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-medium">
                  Free workspace
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/40">
                  V1
                </span>
              </div>
            </div>
          )}
        </div>
      </aside>

      <main
        className={[
          "min-h-screen transition-[padding] duration-300",
          sidebarCollapsed
            ? "lg:pl-[84px]"
            : "lg:pl-[268px]",
        ].join(" ")}
      >
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#07090d]/80 backdrop-blur-2xl">
          <div className="flex h-[76px] items-center gap-4 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
              aria-label="Open navigation"
              className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-2.5 text-white/70 lg:hidden"
            >
              <IconMenu />
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] uppercase tracking-[0.18em] text-white/30">
                My Workspace
              </p>

              <h1 className="truncate text-sm font-semibold text-white/90">
                {pathname.startsWith(
                  "/dashboard/datasets",
                )
                  ? "Datasets"
                  : "Overview"}
              </h1>
            </div>

            <div className="hidden w-full max-w-sm md:block">
              <div className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-white/30">
                <IconSearch size={16} />

                <span className="text-xs">
                  Search workspace
                </span>

                <span className="ml-auto rounded-md border border-white/[0.07] px-1.5 py-0.5 text-[9px] font-medium text-white/25">
                  ⌘K
                </span>
              </div>
            </div>

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-white/15 to-white/[0.03] text-xs font-semibold text-white/75">
              DA
            </div>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}