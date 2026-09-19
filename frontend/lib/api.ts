export interface ApiErrorResponse {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

export class ApiError extends Error {
  status: number;
  data: ApiErrorResponse | null;

  constructor(
    message: string,
    status: number,
    data: ApiErrorResponse | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function parseResponse(response: Response) {
  const contentType =
    response.headers.get("content-type") ?? "";

  if (
    contentType.includes(
      "application/json",
    )
  ) {
    return response.json();
  }

  return response.text();
}

function getErrorMessage(
  data:
    | ApiErrorResponse
    | string
    | null,
  status: number,
) {
  if (!data) {
    return `Request failed with status ${status}`;
  }

  if (typeof data === "string") {
    return (
      data ||
      `Request failed with status ${status}`
    );
  }

  if (Array.isArray(data.message)) {
    return data.message.join(", ");
  }

  if (
    typeof data.message === "string"
  ) {
    return data.message;
  }

  if (
    typeof data.error === "string"
  ) {
    return data.error;
  }

  return `Request failed with status ${status}`;
}

interface ApiFetchOptions
  extends RequestInit {
  token?: string | null;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const {
    token,
    headers,
    ...requestInit
  } = options;

  const requestHeaders =
    new Headers(headers);

  if (
    requestInit.body &&
    !(
      requestInit.body instanceof
      FormData
    ) &&
    !requestHeaders.has(
      "Content-Type",
    )
  ) {
    requestHeaders.set(
      "Content-Type",
      "application/json",
    );
  }

  if (token) {
    requestHeaders.set(
      "Authorization",
      `Bearer ${token}`,
    );
  }

  const response = await fetch(
    `/backend${path}`,
    {
      ...requestInit,
      headers: requestHeaders,
    },
  );

  const data =
    await parseResponse(response);

  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(
        data,
        response.status,
      ),
      response.status,
      typeof data ===
        "object" &&
      data !== null
        ? data
        : null,
    );
  }

  return data as T;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface MeResponse {
  id: string;
  email: string;
  name: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface WorkspaceMembershipResponse {
  role: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface Dataset {
  id: string;
  workspaceId: string;
  name: string;
  originalFilename: string;
  objectKey: string;
  queryObjectKey: string | null;
  fileType: string;
  fileSize:
    | string
    | number;
  rowCount: number;
  columnCount: number;
  status:
    | "pending"
    | "processing"
    | "ready"
    | "failed";
  createdAt: string;
  updatedAt: string;
}

export interface DatasetColumn {
  name: string;
  dataType: string;
  ordinalPosition: number;
  nullable: boolean;
  nullCount: number;
  distinctCount: number;
}

export interface DatasetContext {
  dataset: {
    id: string;
    name: string;
    originalFilename: string;
    fileType: string;
    fileSize:
      | string
      | number;
    rowCount: number;
    columnCount: number;
    status:
      | "pending"
      | "processing"
      | "ready"
      | "failed";
  };

  columns: DatasetColumn[];
}

export interface DatasetPreview {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
  executionTimeMs: number;
}

export const authApi = {
  async login(
    email: string,
    password: string,
  ) {
    return apiFetch<LoginResponse>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
        }),
      },
    );
  },

  async me(token: string) {
    return apiFetch<MeResponse>(
      "/auth/me",
      {
        method: "GET",
        token,
      },
    );
  },
};

export const workspaceApi = {
  async list(token: string) {
    const memberships =
      await apiFetch<
        WorkspaceMembershipResponse[]
      >(
        "/workspaces",
        {
          method: "GET",
          token,
        },
      );

    return memberships.map(
      (
        membership,
      ): Workspace => ({
        id: membership.workspace.id,
        name:
          membership.workspace.name,
        slug:
          membership.workspace.slug,
        role: membership.role,
      }),
    );
  },
};

export const datasetApi = {
  async list(
    token: string,
    workspaceId: string,
  ) {
    return apiFetch<Dataset[]>(
      `/workspaces/${encodeURIComponent(
        workspaceId,
      )}/datasets`,
      {
        method: "GET",
        token,
      },
    );
  },

  async upload(
    token: string,
    workspaceId: string,
    file: File,
    name?: string,
  ) {
    const formData =
      new FormData();

    formData.append(
      "file",
      file,
    );

    if (name?.trim()) {
      formData.append(
        "name",
        name.trim(),
      );
    }

    return apiFetch<Dataset>(
      `/workspaces/${encodeURIComponent(
        workspaceId,
      )}/datasets/upload`,
      {
        method: "POST",
        token,
        body: formData,
      },
    );
  },

  async delete(
    token: string,
    workspaceId: string,
    datasetId: string,
  ) {
    return apiFetch<Dataset>(
      `/workspaces/${encodeURIComponent(
        workspaceId,
      )}/datasets/${encodeURIComponent(
        datasetId,
      )}`,
      {
        method: "DELETE",
        token,
      },
    );
  },

  async context(
    token: string,
    workspaceId: string,
    datasetId: string,
  ) {
    return apiFetch<DatasetContext>(
      `/workspaces/${encodeURIComponent(
        workspaceId,
      )}/datasets/${encodeURIComponent(
        datasetId,
      )}/context`,
      {
        method: "GET",
        token,
      },
    );
  },

  async preview(
    token: string,
    workspaceId: string,
    datasetId: string,
    limit = 100,
  ) {
    return apiFetch<DatasetPreview>(
      `/workspaces/${encodeURIComponent(
        workspaceId,
      )}/datasets/${encodeURIComponent(
        datasetId,
      )}/preview?limit=${encodeURIComponent(
        String(limit),
      )}`,
      {
        method: "GET",
        token,
      },
    );
  },
};