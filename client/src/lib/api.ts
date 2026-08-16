const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body?.error?.message ?? `Request failed: ${res.status}`,
      body?.error?.code,
    );
  }

  const json = await res.json();
  return json.data as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export async function apiGetBlob(
  path: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetch(`${SERVER_URL}${path}`, {
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      body?.error?.message ?? `Request failed: ${response.status}`,
      body?.error?.code,
    );
  }

  return response.blob();
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestInit, "body" | "method">,
): Promise<T> {
  return request<T>(path, {
    ...options,
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, {
    method: "DELETE",
  });
}
