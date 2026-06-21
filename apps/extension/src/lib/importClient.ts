export interface Capture { url: string; text: string; }

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
