"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { ApiError, authApi } from "../../lib/api";
import {
  clearAccessToken,
  getAccessToken,
} from "../../lib/auth";

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({
  children,
}: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;

    async function verifySession() {
      const token = getAccessToken();

      if (!token) {
        router.replace(
          `/login?next=${encodeURIComponent(pathname)}`,
        );
        return;
      }

      try {
        await authApi.me(token);

        if (!active) {
          return;
        }

        setAuthenticated(true);
        setChecking(false);
      } catch (error) {
        if (!active) {
          return;
        }

        if (
          error instanceof ApiError &&
          error.status !== 401 &&
          error.status !== 403
        ) {
          console.error("Session verification failed:", error);
        }

        clearAccessToken();

        router.replace(
          `/login?next=${encodeURIComponent(pathname)}`,
        );
      }
    }

    void verifySession();

    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (checking || !authenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070708] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-white" />

          <p className="text-sm text-white/45">
            Checking your session...
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}