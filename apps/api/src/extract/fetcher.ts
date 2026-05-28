import { extractReadable, isThin } from "./readability";

export type FetchMethod = "fetch" | "render" | "needs_paste";

export interface FetchResult { method: FetchMethod; html: string | null; text: string | null; }

export interface FetchDeps {
  doFetch: (url: string) => Promise<Response>;
  renderHtml: (url: string) => Promise<string>;
}

const UA = "Mozilla/5.0 (compatible; SeekingBot/1.0)";

export async function fetchContent(url: string, deps: FetchDeps): Promise<FetchResult> {
  let html: string | null = null;
  const res = await deps.doFetch(url);
  if (res.ok) {
    html = await res.text();
    const { text } = extractReadable(html, url);
    if (!isThin(text)) return { method: "fetch", html, text };
  }
  // escalate to headless render
  const rendered = await deps.renderHtml(url);
  const { text } = extractReadable(rendered, url);
  if (!isThin(text)) return { method: "render", html: rendered, text };
  return { method: "needs_paste", html: rendered ?? html, text: null };
}

/** Real dependencies, built from the worker env. */
export function realFetchDeps(env: { BROWSER: Fetcher }): FetchDeps {
  return {
    doFetch: (url) => fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } }),
    renderHtml: async (url) => {
      const puppeteer = await import("@cloudflare/puppeteer");
      const browser = await puppeteer.launch(env.BROWSER);
      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "networkidle0", timeout: 20000 });
        return await page.content();
      } finally {
        await browser.close();
      }
    },
  };
}
