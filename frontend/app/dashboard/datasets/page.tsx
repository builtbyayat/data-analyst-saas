"use client";

import Link from "next/link";

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  ApiError,
  Dataset,
  datasetApi,
} from "../../../lib/api";

import {
  clearAccessToken,
  getAccessToken,
} from "../../../lib/auth";

import { useWorkspace } from "../workspace-context";

function formatFileSize(value: string | number) {
  const bytes = Number(value);

  if (!Number.isFinite(bytes) || bytes < 0) {
    return "—";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(status: Dataset["status"]) {
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

function statusClasses(status: Dataset["status"]) {
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

export default function DatasetsPage() {
  const router = useRouter();

  const {
    activeWorkspace,
    loading: workspaceLoading,
  } = useWorkspace();

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] =
    useState<string | null>(null);
  const [uploadError, setUploadError] =
    useState<string | null>(null);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [datasetName, setDatasetName] =
    useState("");

  const hasProcessingDataset = useMemo(
    () =>
      datasets.some(
        (dataset) =>
          dataset.status === "pending" ||
          dataset.status === "processing",
      ),
    [datasets],
  );

  const loadDatasets = useCallback(
    async (showLoading = true) => {
      if (!activeWorkspace) {
        setDatasets([]);
        setLoading(false);
        return;
      }

      const token = getAccessToken();

      if (!token) {
        clearAccessToken();

        router.replace(
          "/login?next=%2Fdashboard%2Fdatasets",
        );

        return;
      }

      if (showLoading) {
        setLoading(true);
        setError(null);
      }

      try {
        const result = await datasetApi.list(
          token,
          activeWorkspace.id,
        );

        setDatasets(result);

        if (showLoading) {
          setError(null);
        }
      } catch (requestError) {
        if (
          requestError instanceof ApiError &&
          (requestError.status === 401 ||
            requestError.status === 403)
        ) {
          clearAccessToken();

          router.replace(
            "/login?next=%2Fdashboard%2Fdatasets",
          );

          return;
        }

        if (showLoading) {
          if (requestError instanceof ApiError) {
            setError(requestError.message);
          } else {
            setError(
              "Unable to load datasets. Please try again.",
            );
          }
        }
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [activeWorkspace, router],
  );

  useEffect(() => {
    void loadDatasets(true);
  }, [loadDatasets]);

  useEffect(() => {
    if (
      !activeWorkspace ||
      !hasProcessingDataset
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadDatasets(false);
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    activeWorkspace,
    hasProcessingDataset,
    loadDatasets,
  ]);

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0] ?? null;

    setSelectedFile(file);
    setUploadError(null);
  }

  async function handleUpload() {
    if (!activeWorkspace) {
      setUploadError(
        "No workspace is available for this account.",
      );

      return;
    }

    if (!selectedFile) {
      setUploadError(
        "Please choose a CSV or Excel file.",
      );

      return;
    }

    const token = getAccessToken();

    if (!token) {
      clearAccessToken();

      router.replace(
        "/login?next=%2Fdashboard%2Fdatasets",
      );

      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      await datasetApi.upload(
        token,
        activeWorkspace.id,
        selectedFile,
        datasetName,
      );

      setSelectedFile(null);
      setDatasetName("");

      const fileInput =
        document.getElementById(
          "dataset-file",
        ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }

      await loadDatasets(false);
    } catch (requestError) {
      if (
        requestError instanceof ApiError &&
        (requestError.status === 401 ||
          requestError.status === 403)
      ) {
        clearAccessToken();

        router.replace(
          "/login?next=%2Fdashboard%2Fdatasets",
        );

        return;
      }

      if (requestError instanceof ApiError) {
        setUploadError(requestError.message);
      } else {
        setUploadError(
          "Upload failed. Please try again.",
        );
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(dataset: Dataset) {
    const confirmed = window.confirm(
      `Delete "${dataset.name}"? This will remove the dataset from this workspace.`,
    );

    if (!confirmed) {
      return;
    }

    const token = getAccessToken();

    if (!token) {
      clearAccessToken();

      router.replace(
        "/login?next=%2Fdashboard%2Fdatasets",
      );

      return;
    }

    try {
      await datasetApi.delete(
        token,
        dataset.workspaceId,
        dataset.id,
      );

      setDatasets((current) =>
        current.filter(
          (item) => item.id !== dataset.id,
        ),
      );
    } catch (requestError) {
      if (
        requestError instanceof ApiError &&
        (requestError.status === 401 ||
          requestError.status === 403)
      ) {
        clearAccessToken();

        router.replace(
          "/login?next=%2Fdashboard%2Fdatasets",
        );

        return;
      }

      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to delete the dataset.",
      );
    }
  }

  if (workspaceLoading) {
    return (
      <section className="space-y-6">
        <div>
          <p className="text-sm text-white/40">
            Workspace
          </p>

          <h1 className="mt-1 text-2xl font-semibold">
            Datasets
          </h1>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-sm text-white/45">
          Loading workspace...
        </div>
      </section>
    );
  }

  if (!activeWorkspace) {
    return (
      <section className="space-y-6">
        <div>
          <p className="text-sm text-white/40">
            Workspace
          </p>

          <h1 className="mt-1 text-2xl font-semibold">
            Datasets
          </h1>
        </div>

        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-6 text-sm leading-6 text-amber-200">
          No workspace is available for this account.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-white/40">
            {activeWorkspace.name}
          </p>

          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Datasets
          </h1>

          <p className="mt-2 text-sm text-white/45">
            Upload and manage the data sources used for analysis.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="mb-5">
          <h2 className="text-base font-medium">
            Upload dataset
          </h2>

          <p className="mt-1 text-sm text-white/40">
            CSV, XLS, or XLSX files up to the backend upload limit.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
          <div>
            <label
              htmlFor="dataset-file"
              className="mb-2 block text-sm text-white/65"
            >
              File
            </label>

            <input
              id="dataset-file"
              type="file"
              accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileChange}
              disabled={uploading}
              className="block w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/60 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-medium file:text-black"
            />
          </div>

          <div>
            <label
              htmlFor="dataset-name"
              className="mb-2 block text-sm text-white/65"
            >
              Dataset name
            </label>

            <input
              id="dataset-name"
              type="text"
              value={datasetName}
              onChange={(event) =>
                setDatasetName(
                  event.target.value,
                )
              }
              placeholder="Optional"
              disabled={uploading}
              className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/20"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleUpload}
              disabled={
                uploading || !selectedFile
              }
              className="h-12 w-full rounded-xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40 lg:w-auto"
            >
              {uploading
                ? "Uploading..."
                : "Upload"}
            </button>
          </div>
        </div>

        {selectedFile ? (
          <p className="mt-4 text-xs text-white/35">
            Selected: {selectedFile.name} (
            {formatFileSize(
              selectedFile.size,
            )}
            )
          </p>
        ) : null}

        {uploadError ? (
          <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200">
            {uploadError}
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">
            Your datasets
          </h2>

          <span className="text-sm text-white/35">
            {datasets.length}{" "}
            {datasets.length === 1
              ? "dataset"
              : "datasets"}
          </span>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-sm text-white/45">
            Loading datasets...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-6">
            <p className="text-sm text-red-200">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                void loadDatasets(true)
              }
              className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 hover:border-white/20 hover:text-white"
            >
              Retry
            </button>
          </div>
        ) : datasets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
            <h3 className="text-base font-medium">
              No datasets yet
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/40">
              Upload your first CSV or Excel dataset to start
              analyzing business data.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.03] text-white/40">
                  <tr>
                    <th className="px-5 py-4 font-medium">
                      Dataset
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Size
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Rows
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Columns
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Status
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Created
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {datasets.map(
                    (dataset) => (
                      <tr
                        key={dataset.id}
                        className="border-b border-white/5 last:border-b-0"
                      >
                        <td className="px-5 py-4">
                          <div className="min-w-44">
                            <Link
                              href={`/dashboard/datasets/${encodeURIComponent(
                                dataset.id,
                              )}`}
                              className="font-medium text-white/85 transition hover:text-white"
                            >
                              {dataset.name}
                            </Link>

                            <p className="mt-1 text-xs text-white/30">
                              {
                                dataset.originalFilename
                              }
                            </p>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-white/50">
                          {formatFileSize(
                            dataset.fileSize,
                          )}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-white/50">
                          {dataset.rowCount.toLocaleString()}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-white/50">
                          {dataset.columnCount.toLocaleString()}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(
                              dataset.status,
                            )}`}
                          >
                            {statusLabel(
                              dataset.status,
                            )}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-xs text-white/35">
                          {formatDate(
                            dataset.createdAt,
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              void handleDelete(
                                dataset,
                              )
                            }
                            className="text-xs font-medium text-red-300/70 transition hover:text-red-200"
                          >
                            Delete
                          </button>
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
    </section>
  );
}