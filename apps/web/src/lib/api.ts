import type { Job, JobUpdate, ImportRequest } from "@whats-next/shared";

export interface ApiOptions {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}

export function createApiClient(opts: ApiOptions) {
  const f = opts.fetchImpl ?? fetch;
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await opts.getToken();
    const res = await f(`${opts.baseUrl}${path}`, {
      ...init,
      headers: { "content-type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }
  return {
    listJobs: () => call<Job[]>("/api/jobs"),
    getJob: (id: string) => call<Job>(`/api/jobs/${id}`),
    importJob: (body: ImportRequest) => call<Job>("/api/jobs/import", { method: "POST", body: JSON.stringify(body) }),
    updateJob: (id: string, patch: JobUpdate) => call<Job>(`/api/jobs/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    deleteJob: (id: string) => call<void>(`/api/jobs/${id}`, { method: "DELETE" }),
  };
}
export type ApiClient = ReturnType<typeof createApiClient>;
