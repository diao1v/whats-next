import type { Extraction, Job, SourceMethod } from "@whats-next/shared";
import { extractReadable, isThin } from "./extract/readability";
import { fetchContent, type FetchDeps } from "./extract/fetcher";
import { contentHash } from "./extract/hash";
import { findPostingByHash, createPosting, linkEntryToPosting, markImportStatus } from "./db";

export interface ImportDeps {
  fetchDeps: FetchDeps;
  extract: (text: string) => Promise<{ extraction: Extraction; model: string }>;
}

export async function runImport(
  db: D1Database, bucket: R2Bucket, userId: string, entry: Job, pastedText: string | null, deps: ImportDeps
): Promise<void> {
  try {
    let text: string;
    let html: string | null;
    let method: SourceMethod;

    if (pastedText && !isThin(pastedText)) {
      text = extractReadable(`<body>${pastedText}</body>`, entry.url).text || pastedText;
      html = pastedText;
      method = "paste";
    } else {
      const result = await fetchContent(entry.url, deps.fetchDeps);
      if (result.method === "needs_paste" || !result.text) {
        await markImportStatus(db, entry.id, "needs_paste");
        return;
      }
      text = result.text;
      html = result.html;
      method = result.method;
    }

    const hash = await contentHash(text);
    let posting = await findPostingByHash(db, hash);
    if (!posting) {
      const { extraction, model } = await deps.extract(text);
      const rawKey = `raw/${hash}.html`;
      if (html) await bucket.put(rawKey, html);
      const sourceSite = (() => {
        try { return new URL(entry.url).hostname.replace(/^www\./, ""); } catch { return null; }
      })();
      const postingId = await createPosting(db, {
        ...extraction, hash, snapshot: text, source_site: sourceSite, method, model, rawKey: html ? rawKey : null,
      });
      posting = { id: postingId };
    }
    await linkEntryToPosting(db, userId, entry.id, posting.id);
  } catch (e) {
    console.error("import failed", entry.id, e instanceof Error ? e.message : e);
    await markImportStatus(db, entry.id, "failed");
  }
}
