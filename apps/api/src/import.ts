import type { Extraction, Job, SourceMethod } from "@whats-next/shared";
import { extractReadable, isThin } from "./extract/readability";
import { fetchContent, type FetchDeps } from "./extract/fetcher";
import { applyExtraction, markImportStatus, setSnapshot } from "./db";

export interface ImportDeps {
  fetchDeps: FetchDeps;
  extract: (text: string) => Promise<Extraction>;
  model: string;
}

export async function runImport(
  db: D1Database, bucket: R2Bucket, userId: string, job: Job, pastedText: string | null, deps: ImportDeps
): Promise<void> {
  try {
    let text: string;
    let html: string | null;
    let method: SourceMethod;

    if (pastedText && !isThin(pastedText)) {
      text = extractReadable(`<body>${pastedText}</body>`, job.url).text || pastedText;
      html = pastedText;
      method = "paste";
    } else {
      const result = await fetchContent(job.url, deps.fetchDeps);
      if (result.method === "needs_paste" || !result.text) {
        await markImportStatus(db, job.id, "needs_paste");
        return;
      }
      text = result.text;
      html = result.html;
      method = result.method;
    }

    const rawKey = `raw/${job.id}.html`;
    if (html) await bucket.put(rawKey, html);

    const extraction = await deps.extract(text);
    await applyExtraction(db, userId, job.id, extraction, method, deps.model, html ? rawKey : null);
    await setSnapshot(db, job.id, text);
  } catch (e) {
    console.error("import failed", job.id, e instanceof Error ? e.message : e);
    await markImportStatus(db, job.id, "failed");
  }
}
