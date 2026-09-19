"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  ApiError,
  Workspace,
  workspaceApi,
} from "../../lib/api";
import {
  clearAccessToken,
  getAccessToken,
} from "../../lib/auth";

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  loading: boolean;
  error: string | null;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext =
  createContext<WorkspaceContextValue | null>(null);

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({
  children,
}: WorkspaceProviderProps) {
  const router = useRouter();

  const [workspaces, setWorkspaces] = useState<Workspace[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadWorkspaces() {
    const token = getAccessToken();

    if (!token) {
      clearAccessToken();

      router.replace("/login?next=%2Fdashboard");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await workspaceApi.list(token);

      setWorkspaces(result);
    } catch (requestError) {
      if (
        requestError instanceof ApiError &&
        (requestError.status === 401 ||
          requestError.status === 403)
      ) {
        clearAccessToken();

        router.replace("/login?next=%2Fdashboard");
        return;
      }

      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError(
          "Unable to load your workspaces. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspaces();
  }, []);

  const activeWorkspace = workspaces[0] ?? null;

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      activeWorkspace,
      loading,
      error,
      refreshWorkspaces: loadWorkspaces,
    }),
    [
      workspaces,
      activeWorkspace,
      loading,
      error,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error(
      "useWorkspace must be used inside WorkspaceProvider",
    );
  }

  return context;
}