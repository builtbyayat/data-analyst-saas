import type { ReactNode } from "react";

import AuthGuard from "./auth-guard";
import { WorkspaceProvider } from "./workspace-context";
import DashboardShell from "./dashboard-shell";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthGuard>
      <WorkspaceProvider>
        <DashboardShell>
          {children}
        </DashboardShell>
      </WorkspaceProvider>
    </AuthGuard>
  );
}