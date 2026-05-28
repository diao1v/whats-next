import { describe, it, expect, vi } from "vitest";
import { createApiClient } from "./api";

describe("api client", () => {
  it("attaches bearer token and base url", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    const api = createApiClient({ baseUrl: "http://api", getToken: async () => "tok", fetchImpl: fetchMock });
    await api.listJobs();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api/api/jobs");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("throws on non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));
    const api = createApiClient({ baseUrl: "http://api", getToken: async () => "tok", fetchImpl: fetchMock });
    await expect(api.listJobs()).rejects.toThrow();
  });
});
