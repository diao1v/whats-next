export const DEFAULT_API_URL = "https://whats-next-api.tuicaodanad.workers.dev";

export interface Capture { url: string; text: string; }

/** Reduce any entered API URL to its origin (drops a stray trailing path like /api/jobs and slashes). */
export function normalizeApiUrl(input: string): string {
  const raw = input.trim();
  try {
    return new URL(raw).origin;
  } catch {
    try {
      return new URL(`https://${raw}`).origin;
    } catch {
      return raw;
    }
  }
}

export function buildImportRequest(apiUrl: string, token: string, cap: Capture): { url: string; init: RequestInit } {
  return {
    url: `${apiUrl.replace(/\/$/, "")}/api/jobs/import`,
    init: {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url: cap.url, pastedText: cap.text }),
    },
  };
}

export async function send(
  apiUrl: string, token: string, cap: Capture, fetchImpl: typeof fetch = fetch
): Promise<{ ok: boolean; status: number }> {
  const { url, init } = buildImportRequest(apiUrl, token, cap);
  const res = await fetchImpl(url, init);
  return { ok: res.status === 201, status: res.status };
}

export interface TestResult { ok: boolean; message: string; }

/** Decide if a /api/jobs probe actually reached the API (vs. a web-app HTML 200). */
export function interpretTestResponse(status: number, contentType: string | null): TestResult {
  const isJson = (contentType ?? "").includes("application/json");
  if (status === 200 && isJson) return { ok: true, message: "Connection OK ✓" };
  if (status === 200) return { ok: false, message: "That doesn't look like the API (got a web page). Check the API URL." };
  if (status === 401) return { ok: false, message: "Reached the API, but the token is invalid." };
  return { ok: false, message: `Failed (status ${status}).` };
}

export async function testConnection(apiUrl: string, token: string, fetchImpl: typeof fetch = fetch): Promise<TestResult> {
  try {
    const res = await fetchImpl(`${normalizeApiUrl(apiUrl)}/api/jobs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return interpretTestResponse(res.status, res.headers.get("content-type"));
  } catch {
    return { ok: false, message: "Couldn't reach the server." };
  }
}
