import {
  apiFetch,
} from './api';

export interface GeneratedReportSection {
  title: string;
  description: string | null;
  question: string | null;
  datasetCount: number;
  resultSnapshot: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedReport {
  report: {
    id: string;
    workspaceId: string;
    title: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
  };
  generatedAt: string;
  sections: GeneratedReportSection[];
  missingSectionCount: number;
}

export type ReportSharePermission =
  'viewer' | 'exporter';

export interface ReportShare {
  id: string;
  reportId: string;
  permission: ReportSharePermission;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  token?: string;
}

export interface SharedReportResponse {
  permission: ReportSharePermission;
  canExport: boolean;
  expiresAt: string;
  report: GeneratedReport;
}

function reportPath(
  workspaceId: string,
  reportId: string,
  suffix = '',
) {
  return `/workspaces/${encodeURIComponent(
    workspaceId,
  )}/reports/${encodeURIComponent(
    reportId,
  )}${suffix}`;
}

export const reportApi = {
  listReports(
    token: string,
    workspaceId: string,
  ) {
    return apiFetch<
      Array<{
        id: string;
        workspaceId: string;
        userId: string;
        title: string;
        description: string | null;
        savedAnalysisIds: string[];
        createdAt: string;
        updatedAt: string;
      }>
    >(
      `/workspaces/${encodeURIComponent(
        workspaceId,
      )}/reports`,
      { token },
    );
  },

  generateReport(
    token: string,
    workspaceId: string,
    reportId: string,
  ) {
    return apiFetch<GeneratedReport>(
      reportPath(
        workspaceId,
        reportId,
        '/generated',
      ),
      { token },
    );
  },

  listShares(
    token: string,
    workspaceId: string,
    reportId: string,
  ) {
    return apiFetch<ReportShare[]>(
      reportPath(
        workspaceId,
        reportId,
        '/shares',
      ),
      { token },
    );
  },

  createShare(
    token: string,
    workspaceId: string,
    reportId: string,
    input: {
      permission: ReportSharePermission;
      expiresInDays: number;
    },
  ) {
    return apiFetch<ReportShare>(
      reportPath(
        workspaceId,
        reportId,
        '/shares',
      ),
      {
        token,
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
  },

  revokeShare(
    token: string,
    workspaceId: string,
    reportId: string,
    shareId: string,
  ) {
    return apiFetch<void>(
      `${reportPath(
        workspaceId,
        reportId,
        '/shares',
      )}/${encodeURIComponent(
        shareId,
      )}`,
      {
        token,
        method: 'DELETE',
      },
    );
  },

  getSharedReport(
    shareToken: string,
  ) {
    return apiFetch<SharedReportResponse>(
      `/shared/reports/${encodeURIComponent(
        shareToken,
      )}`,
    );
  },

  async downloadReport(
    token: string,
    workspaceId: string,
    reportId: string,
    format: 'json' | 'csv' | 'xlsx',
  ) {
    return downloadBlob(
      reportPath(
        workspaceId,
        reportId,
        `/export?format=${format}`,
      ),
      token,
    );
  },

  async downloadSharedReport(
    shareToken: string,
    format: 'json' | 'csv' | 'xlsx',
  ) {
    return downloadBlob(
      `/shared/reports/${encodeURIComponent(
        shareToken,
      )}/export?format=${format}`,
    );
  },
};

async function downloadBlob(
  path: string,
  token?: string,
) {
  const headers = new Headers();

  if (token) {
    headers.set(
      'Authorization',
      `Bearer ${token}`,
    );
  }

  const response = await fetch(
    `/backend${path}`,
    {
      headers,
    },
  );

  if (!response.ok) {
    const message =
      await response.text();

    throw new Error(
      message ||
        `Download failed with status ${response.status}`,
    );
  }

  const blob =
    await response.blob();

  const disposition =
    response.headers.get(
      'content-disposition',
    );

  const filenameMatch =
    disposition?.match(
      /filename="?([^";]+)"?/i,
    );

  return {
    blob,
    filename:
      filenameMatch?.[1] ??
      'report-download',
  };
}
