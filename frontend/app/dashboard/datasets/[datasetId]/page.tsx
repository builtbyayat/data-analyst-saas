"use client";

import Link from "next/link";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ApiError,
  type Dataset,
  type DatasetContext,
  type DatasetPreview,
  datasetApi,
} from "../../../../lib/api";

import {
  clearAccessToken,
  getAccessToken,
} from "../../../../lib/auth";

import { useWorkspace } from "../../workspace-context";

function formatFileSize(
  value: string | number,
) {
  const bytes = Number(value);

  if (
    !Number.isFinite(bytes) ||
    bytes < 0
  ) {
    return "—";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function statusLabel(
  status: Dataset["status"],
) {
  switch (status) {
    case "pending":
      return "Pending";

    case "processing":
      return "Processing";

    case "ready":
      return "Ready";

    case "failed":
      return "Failed";
  }
}

function statusClasses(
  status: Dataset["status"],
) {
  switch (status) {
    case "ready":
      return "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300";

    case "processing":
      return "border-blue-400/20 bg-blue-400/[0.08] text-blue-300";

    case "pending":
      return "border-amber-400/20 bg-amber-400/[0.08] text-amber-300";

    case "failed":
      return "border-red-400/20 bg-red-400/[0.08] text-red-300";
  }
}

function formatCellValue(
  value: unknown,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "NULL";
  }

  if (
    typeof value === "object"
  ) {
    try {
      return JSON.stringify(
        value,
      );
    } catch {
      return String(value);
    }
  }

  return String(value);
}

export default function DatasetDetailPage() {
  const router = useRouter();

  const params =
    useParams<{
      datasetId: string;
    }>();

  const datasetId =
    typeof params.datasetId ===
    "string"
      ? params.datasetId
      : "";

  const {
    activeWorkspace,
    loading: workspaceLoading,
  } = useWorkspace();

  const [dataset, setDataset] =
    useState<Dataset | null>(
      null,
    );

  const [context, setContext] =
    useState<
      DatasetContext | null
    >(null);

  const [preview, setPreview] =
    useState<
      DatasetPreview | null
    >(null);

  const [loading, setLoading] =
    useState(true);

  const [
    previewLoading,
    setPreviewLoading,
  ] = useState(false);

  const [error, setError] =
    useState<string | null>(
      null,
    );

  const [
    previewError,
    setPreviewError,
  ] = useState<
    string | null
  >(null);

  /*
   * ============================================================
   * LOAD DATASET METADATA
   * ============================================================
   *
   * This endpoint is safe to call while the dataset is:
   *
   * pending
   * processing
   * ready
   * failed
   *
   * We use it as the source of truth for lifecycle status.
   */
  const loadDataset =
    useCallback(
      async (
        showLoading = true,
      ) => {
        if (
          !activeWorkspace ||
          !datasetId
        ) {
          return;
        }

        const token =
          getAccessToken();

        if (!token) {
          clearAccessToken();

          router.replace(
            `/login?next=${encodeURIComponent(
              `/dashboard/datasets/${datasetId}`,
            )}`,
          );

          return;
        }

        if (showLoading) {
          setLoading(true);
          setError(null);
        }

        try {
          const datasets =
            await datasetApi.list(
              token,
              activeWorkspace.id,
            );

          const currentDataset =
            datasets.find(
              (item) =>
                item.id ===
                datasetId,
            );

          if (!currentDataset) {
            throw new Error(
              "Dataset was not found in this workspace.",
            );
          }

          setDataset(
            currentDataset,
          );

          /*
           * Context and preview are only valid
           * once ingestion is complete.
           */
          if (
            currentDataset.status !==
            "ready"
          ) {
            setContext(null);
            setPreview(null);
            setPreviewError(null);
          }

          setError(null);
        } catch (
          requestError
        ) {
          if (
            requestError instanceof
              ApiError &&
            (
              requestError.status ===
                401 ||
              requestError.status ===
                403
            )
          ) {
            clearAccessToken();

            router.replace(
              `/login?next=${encodeURIComponent(
                `/dashboard/datasets/${datasetId}`,
              )}`,
            );

            return;
          }

          if (showLoading) {
            setError(
              requestError instanceof
                ApiError
                ? requestError.message
                : requestError instanceof
                    Error
                  ? requestError.message
                  : "Unable to load dataset.",
            );
          }
        } finally {
          if (showLoading) {
            setLoading(false);
          }
        }
      },
      [
        activeWorkspace,
        datasetId,
        router,
      ],
    );

  /*
   * ============================================================
   * LOAD DATASET ANALYSIS CONTEXT
   * ============================================================
   *
   * This is intentionally called ONLY when the dataset
   * reaches ready state.
   */
  const loadContext =
    useCallback(
      async (
        showLoading = true,
      ) => {
        if (
          !activeWorkspace ||
          !datasetId ||
          !dataset ||
          dataset.status !==
            "ready"
        ) {
          return;
        }

        const token =
          getAccessToken();

        if (!token) {
          clearAccessToken();

          router.replace(
            `/login?next=${encodeURIComponent(
              `/dashboard/datasets/${datasetId}`,
            )}`,
          );

          return;
        }

        if (showLoading) {
          setLoading(true);
          setError(null);
        }

        try {
          const result =
            await datasetApi.context(
              token,
              activeWorkspace.id,
              datasetId,
            );

          setContext(
            result,
          );

          setError(null);
        } catch (
          requestError
        ) {
          if (
            requestError instanceof
              ApiError &&
            (
              requestError.status ===
                401 ||
              requestError.status ===
                403
            )
          ) {
            clearAccessToken();

            router.replace(
              `/login?next=${encodeURIComponent(
                `/dashboard/datasets/${datasetId}`,
              )}`,
            );

            return;
          }

          if (showLoading) {
            setError(
              requestError instanceof
                ApiError
                ? requestError.message
                : requestError instanceof
                    Error
                  ? requestError.message
                  : "Unable to load dataset analysis context.",
            );
          }
        } finally {
          if (showLoading) {
            setLoading(false);
          }
        }
      },
      [
        activeWorkspace,
        dataset,
        datasetId,
        router,
      ],
    );

  /*
   * ============================================================
   * LOAD PREVIEW
   * ============================================================
   */
  const loadPreview =
    useCallback(
      async (
        showLoading = true,
      ) => {
        if (
          !activeWorkspace ||
          !datasetId ||
          !dataset ||
          dataset.status !==
            "ready"
        ) {
          return;
        }

        const token =
          getAccessToken();

        if (!token) {
          clearAccessToken();

          router.replace(
            `/login?next=${encodeURIComponent(
              `/dashboard/datasets/${datasetId}`,
            )}`,
          );

          return;
        }

        if (showLoading) {
          setPreviewLoading(
            true,
          );
          setPreviewError(
            null,
          );
        }

        try {
          const result =
            await datasetApi.preview(
              token,
              activeWorkspace.id,
              datasetId,
              100,
            );

          setPreview(
            result,
          );

          if (showLoading) {
            setPreviewError(
              null,
            );
          }
        } catch (
          requestError
        ) {
          if (
            requestError instanceof
              ApiError &&
            (
              requestError.status ===
                401 ||
              requestError.status ===
                403
            )
          ) {
            clearAccessToken();

            router.replace(
              `/login?next=${encodeURIComponent(
                `/dashboard/datasets/${datasetId}`,
              )}`,
            );

            return;
          }

          if (showLoading) {
            setPreviewError(
              requestError instanceof
                ApiError
                ? requestError.message
                : requestError instanceof
                    Error
                  ? requestError.message
                  : "Unable to load dataset preview.",
            );
          }
        } finally {
          if (showLoading) {
            setPreviewLoading(
              false,
            );
          }
        }
      },
      [
        activeWorkspace,
        dataset,
        datasetId,
        router,
      ],
    );

  /*
   * ============================================================
   * INITIAL DATASET LOAD
   * ============================================================
   */
  useEffect(() => {
    void loadDataset(true);
  }, [
    loadDataset,
  ]);

  /*
   * ============================================================
   * AUTOMATIC INGESTION POLLING
   * ============================================================
   *
   * pending / processing
   *        ↓
   * refresh every 3 seconds
   *        ↓
   * ready
   *        ↓
   * context + preview
   */
  useEffect(() => {
    if (
      !dataset ||
      !(
        dataset.status ===
          "pending" ||
        dataset.status ===
          "processing"
      )
    ) {
      return;
    }

    const interval =
      window.setInterval(() => {
        void loadDataset(false);
      }, 3000);

    return () => {
      window.clearInterval(
        interval,
      );
    };
  }, [
    dataset,
    loadDataset,
  ]);

  /*
   * ============================================================
   * READY → LOAD CONTEXT
   * ============================================================
   */
  useEffect(() => {
    if (
      !dataset ||
      dataset.status !==
        "ready"
    ) {
      return;
    }

    void loadContext(true);
  }, [
    dataset,
    loadContext,
  ]);

  /*
   * ============================================================
   * CONTEXT → LOAD PREVIEW
   * ============================================================
   */
  useEffect(() => {
    if (
      !context ||
      context.dataset.status !==
        "ready"
    ) {
      return;
    }

    void loadPreview(true);
  }, [
    context,
    loadPreview,
  ]);

  /*
   * ============================================================
   * COLUMNS
   * ============================================================
   */
  const columns =
    context?.columns ??
    [];

  /*
   * ============================================================
   * LOADING STATE
   * ============================================================
   */
  if (
    workspaceLoading ||
    loading
  ) {
    return (
      <section className="space-y-6">
        <Link
          href="/dashboard/datasets"
          className="text-sm text-white/40 transition hover:text-white/70"
        >
          ← Back to datasets
        </Link>

        <div>
          <p className="text-sm text-white/40">
            Dataset
          </p>

          <h1 className="mt-1 text-2xl font-semibold">
            Loading dataset...
          </h1>

          <p className="mt-2 text-sm text-white/45">
            Preparing dataset information and analysis metadata.
          </p>
        </div>
      </section>
    );
  }

  /*
   * ============================================================
   * ERROR STATE
   * ============================================================
   */
  if (
    error &&
    !dataset
  ) {
    return (
      <section className="space-y-6">
        <Link
          href="/dashboard/datasets"
          className="text-sm text-white/40 transition hover:text-white/70"
        >
          ← Back to datasets
        </Link>

        <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-6">
          <p className="text-sm text-red-200">
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              void loadDataset(
                true,
              )
            }
            className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  /*
   * ============================================================
   * DATASET NOT FOUND
   * ============================================================
   */
  if (!dataset) {
    return (
      <section className="space-y-6">
        <Link
          href="/dashboard/datasets"
          className="text-sm text-white/40 transition hover:text-white/70"
        >
          ← Back to datasets
        </Link>

        <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-6">
          <p className="text-sm text-red-200">
            Dataset could not be found.
          </p>

          <button
            type="button"
            onClick={() =>
              void loadDataset(
                true,
              )
            }
            className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
          >
            Refresh
          </button>
        </div>
      </section>
    );
  }

  const queryHref =
    `/dashboard/query?datasetId=${encodeURIComponent(
      dataset.id,
    )}`;

  return (
    <section className="space-y-8">
      <div>
        <Link
          href="/dashboard/datasets"
          className="text-sm text-white/40 transition hover:text-white/70"
        >
          ← Back to datasets
        </Link>

        <div className="mt-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-sm text-white/40">
                {activeWorkspace?.name ??
                  "Workspace"}
              </p>

              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                {dataset.name}
              </h1>

              <p className="mt-2 text-sm text-white/40">
                {dataset.originalFilename}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-xs font-medium ${statusClasses(
                  dataset.status,
                )}`}
              >
                {statusLabel(
                  dataset.status,
                )}
              </span>

              {dataset.status ===
                "ready" && (
                <Link
                  href={queryHref}
                  className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90"
                >
                  Analyze dataset
                </Link>
              )}

              {(dataset.status ===
                "pending" ||
                dataset.status ===
                  "processing") && (
                <span className="text-xs text-white/35">
                  Updating automatically
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {(error ||
        dataset.status ===
          "failed") && (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-5">
          <p className="text-sm text-red-200">
            {error ??
              "Dataset ingestion failed."}
          </p>

          {dataset.status ===
            "failed" && (
            <button
              type="button"
              onClick={() =>
                void loadDataset(
                  true,
                )
              }
              className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
            >
              Refresh status
            </button>
          )}
        </div>
      )}

      {(dataset.status ===
        "pending" ||
        dataset.status ===
          "processing") && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-white/85">
                {dataset.status ===
                "pending"
                  ? "Dataset queued for processing"
                  : "Dataset is being processed"}
              </p>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">
                The ingestion worker is processing the uploaded file,
                detecting columns, profiling the data, and preparing
                the analytical dataset.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadDataset(
                  true,
                )
              }
              className="shrink-0 rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
            >
              Refresh now
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`rounded-full border px-3 py-1.5 ${
                dataset.status ===
                "pending"
                  ? "border-amber-400/20 bg-amber-400/[0.08] text-amber-300"
                  : "border-white/10 bg-white/[0.03] text-white/40"
              }`}
            >
              Pending
            </span>

            <span className="text-white/20">
              →
            </span>

            <span
              className={`rounded-full border px-3 py-1.5 ${
                dataset.status ===
                "processing"
                  ? "border-blue-400/20 bg-blue-400/[0.08] text-blue-300"
                  : "border-white/10 bg-white/[0.03] text-white/40"
              }`}
            >
              Processing
            </span>

            <span className="text-white/20">
              →
            </span>

            <span
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-white/40"
            >
              Ready
            </span>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs text-white/35">
            Rows
          </p>

          <p className="mt-2 text-2xl font-semibold">
            {dataset.rowCount.toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs text-white/35">
            Columns
          </p>

          <p className="mt-2 text-2xl font-semibold">
            {dataset.columnCount.toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs text-white/35">
            File size
          </p>

          <p className="mt-2 text-2xl font-semibold">
            {formatFileSize(
              dataset.fileSize,
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs text-white/35">
            File type
          </p>

          <p className="mt-2 truncate text-sm font-medium text-white/80">
            {dataset.fileType}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-base font-medium">
            Schema & profiling
          </h2>

          <p className="mt-1 text-sm text-white/40">
            Detected structure and basic profiling information for this dataset.
          </p>
        </div>

        {dataset.status !==
          "ready" ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8">
            <h3 className="text-sm font-medium">
              Schema will appear after processing
            </h3>

            <p className="mt-2 text-sm leading-6 text-white/40">
              The dataset is currently in the{" "}
              <span className="text-white/65">
                {dataset.status}
              </span>{" "}
              state. The page will refresh automatically.
            </p>
          </div>
        ) : columns.length ===
          0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8">
            <h3 className="text-sm font-medium">
              No column information
              available
            </h3>

            <p className="mt-2 text-sm leading-6 text-white/40">
              The backend did not return any column metadata for this dataset.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.03] text-white/40">
                  <tr>
                    <th className="px-5 py-4 font-medium">
                      #
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Column
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Data type
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Nullable
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Null count
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Distinct
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {columns
                    .slice()
                    .sort(
                      (a, b) =>
                        a.ordinalPosition -
                        b.ordinalPosition,
                    )
                    .map(
                      (
                        column,
                      ) => (
                        <tr
                          key={`${column.ordinalPosition}-${column.name}`}
                          className="border-b border-white/5 last:border-b-0"
                        >
                          <td className="px-5 py-4 text-white/30">
                            {
                              column.ordinalPosition
                            }
                          </td>

                          <td className="px-5 py-4 font-medium text-white/80">
                            {column.name}
                          </td>

                          <td className="px-5 py-4 text-white/50">
                            {
                              column.dataType
                            }
                          </td>

                          <td className="px-5 py-4 text-white/50">
                            {column.nullable
                              ? "Yes"
                              : "No"}
                          </td>

                          <td className="px-5 py-4 text-white/50">
                            {column.nullCount.toLocaleString()}
                          </td>

                          <td className="px-5 py-4 text-white/50">
                            {column.distinctCount.toLocaleString()}
                          </td>
                        </tr>
                      ),
                    )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-base font-medium">
              Data preview
            </h2>

            <p className="mt-1 text-sm text-white/40">
              Showing the first 100 rows from the processed dataset.
            </p>
          </div>

          {preview ? (
            <span className="text-xs text-white/30">
              {preview.rowCount.toLocaleString()} preview rows
              {preview.truncated
                ? " · truncated"
                : ""}
            </span>
          ) : null}
        </div>

        {dataset.status !==
        "ready" ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8">
            <h3 className="text-sm font-medium">
              Preview will be available when processing completes
            </h3>

            <p className="mt-2 text-sm leading-6 text-white/40">
              The dataset is currently in the{" "}
              {dataset.status} state.
            </p>
          </div>
        ) : previewLoading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-sm text-white/45">
            Loading data preview...
          </div>
        ) : previewError ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-6">
            <p className="text-sm text-red-200">
              {previewError}
            </p>

            <button
              type="button"
              onClick={() =>
                void loadPreview(
                  true,
                )
              }
              className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
            >
              Retry preview
            </button>
          </div>
        ) : !preview ||
          preview.columns.length ===
            0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8">
            <h3 className="text-sm font-medium">
              No preview data
            </h3>

            <p className="mt-2 text-sm leading-6 text-white/40">
              The processed dataset did not return preview rows.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="max-h-[520px] overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 border-b border-white/10 bg-[#0d1015] text-white/45">
                  <tr>
                    <th className="px-5 py-4 font-medium">
                      #
                    </th>

                    {preview.columns.map(
                      (
                        column,
                      ) => (
                        <th
                          key={column}
                          className="whitespace-nowrap px-5 py-4 font-medium"
                        >
                          {column}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>

                <tbody>
                  {preview.rows.map(
                    (
                      row,
                      rowIndex,
                    ) => (
                      <tr
                        key={rowIndex}
                        className="border-b border-white/5 last:border-b-0"
                      >
                        <td className="px-5 py-4 text-white/30">
                          {rowIndex +
                            1}
                        </td>

                        {preview.columns.map(
                          (
                            column,
                            columnIndex,
                          ) => (
                            <td
                              key={`${rowIndex}-${column}`}
                              className="whitespace-nowrap px-5 py-4 text-white/60"
                            >
                              {formatCellValue(
                                row[
                                  columnIndex
                                ],
                              )}
                            </td>
                          ),
                        )}
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}