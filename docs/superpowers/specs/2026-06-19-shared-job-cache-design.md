# Shared Job Cache & Cross-User Dedup — Design Spec

**Date:** 2026-06-19
**Status:** Approved design, pending spec review

## 1. Purpose

Avoid re-fetching and re-extracting the same job for every user, and let identical
public postings be shared across accounts. Today each import creates a private `jobs`
row and always calls the LLM. This change splits storage into **shared canonical job
data** and **per-user tracking**, and dedups extraction by **content hash** so a job
whose cleaned text already exists is reused without another LLM call.

## 2. Decisions (resolved during brainstorming)

| Topic | Decision |
|---|---|
| Data model | Split: shared `job_postings` + per-user `job_entries`. |
| Dedup key | Content hash, URL-agnostic. Always fetch; dedup the **extraction**. |
| Hash input | SHA-256 of the **cleaned readable text** (the LLM input / `snapshot`). |
| Re-import (same user) | Reuse the existing entry; if content changed, re-point it to the new posting (refresh). |
| Migration | Reset — drop `jobs`/`job_skills`, recreate. Existing test data is re-imported. |
| API contract | Keep the flat `Job` DTO (join entry + posting); frontend changes only for the new description display. |
| Description | LLM-generated `description` summary on the posting, shown by default; full `snapshot` available via expand. |

## 3. Data Model

Replaces the single `jobs` table. `users` and `skills` are unchanged.

### `job_postings` (shared, canonical, immutable-per-hash)
- `id` (uuid, PK)
- `content_hash` (TEXT, **UNIQUE**) — SHA-256 hex of the cleaned readable text
- Extracted fields: `company_name`, `is_agency`, `agency_name`, `job_title`, `role`,
  `level`, `salary_min`, `salary_max`, `salary_currency`, `salary_period`,
  `salary_raw_text`, `location`, `is_remote`, `deadline`, `apply_url`, `source_site`
- `description` — LLM-generated concise summary (2–4 sentences + key responsibilities),
  for display
- `snapshot` (full cleaned text), `raw_content_key` (R2 key), `source_method`
  (`fetch`|`render`|`paste`), `extraction_model`
- `created_at`

### `job_entries` (per-user tracking)
- `id` (uuid, PK)
- `user_id` (REFERENCES users)
- `submitted_url` (the URL the user pasted, verbatim)
- `posting_id` (REFERENCES job_postings, **nullable** while importing / failed / needs_paste)
- `import_status` (`importing`|`needs_paste`|`ready`|`failed`)
- `stage`, `applied_date`, `next_action_at`, `notes`
- `created_at`, `updated_at`
- **`UNIQUE(user_id, posting_id)`** — one entry per user per posting. SQLite permits
  multiple NULL `posting_id` rows, so placeholders during import don't collide.

### `posting_skills` (was `job_skills`)
- `posting_id` (REFERENCES job_postings ON DELETE CASCADE), `skill_id`, `raw_label`
- PK (`posting_id`, `skill_id`)

### `events`
- Now reference `entry_id` (REFERENCES job_entries ON DELETE CASCADE) instead of a job.
  Per-user timeline stays private. `id`, `entry_id`, `user_id`, `type`, `payload`,
  `created_at`.

### Indexes
- `job_entries(user_id)` and `job_entries(user_id, stage)` (board queries)
- `job_postings(content_hash)` is covered by the UNIQUE constraint
- `events(entry_id)`

## 4. Import Flow

`POST /api/jobs/import { url, pastedText? }`:

1. **Fast path (synchronous):** find the caller's existing entry by **exact
   `submitted_url`**. If found, reuse it (set `import_status = importing`); otherwise
   create a placeholder entry (`posting_id = null`, `import_status = importing`).
   Return the entry immediately. No fetch happens at POST.
2. **Background (`ctx.waitUntil`):**
   1. Obtain content: paste path, or `fetch` → Browser Rendering escalation
      (unchanged). If still thin → set `needs_paste` and stop.
   2. Compute `content_hash = sha256(cleanedText)`.
   3. **Look up posting by `content_hash`.**
      - **Hit:** link `entry.posting_id`, mark `ready`. **The LLM is not called.**
      - **Miss:** run the LLM (model-fallback list), then
        `INSERT INTO job_postings ... ON CONFLICT(content_hash) DO NOTHING` and re-select
        (handles two users importing the same new job concurrently), store raw HTML to
        R2, link `posting_skills`.
   4. **Link the entry** to the posting. If `UNIQUE(user_id, posting_id)` conflicts (the
      user already tracks this exact content via a different URL), **collapse**: delete
      the placeholder and keep the existing entry.
   5. **Refresh-on-change:** when an entry was reused by URL (step 1) and the new hash
      differs from its current `posting_id`, re-point it to the new/looked-up posting.
      Extracted data updates; the user's tracking fields are preserved.

Failures in the background mark the entry `failed` (with a `console.error`), as today.

## 5. Sharing & Privacy

Cross-user sharing is leak-safe by construction: an entry attaches to a shared posting
**only when the user's own fetched/pasted content hashes identically**. Personalized or
login-walled content produces a unique hash and is therefore never shared. "Users see
the same info" holds only for genuinely identical public postings; nothing a user pastes
is exposed to another user unless that other user independently produced byte-identical
cleaned text.

## 6. API Contract

The API keeps returning the **flat `Job` DTO**, composed by joining the caller's
`job_entries` row with its `job_postings` row (and skills). The DTO gains one field,
`description`. Consequences:

- `Job.id` is the **entry id** — the handle for stage/date/notes edits and delete.
- While importing (no posting yet), posting-derived fields are empty/null, exactly as the
  current `importing` placeholder behaves.
- Frontend impact is limited to **rendering `description`** in the drawer (summary shown
  by default, full `snapshot` behind the existing collapse). `api.ts`, `queries.ts`, and
  the board are otherwise unchanged; the storage split stays hidden behind the contract.

Endpoint behavior:
- `GET /api/jobs` → caller's entries joined to postings.
- `GET /api/jobs/:id`, `PATCH /api/jobs/:id`, `DELETE /api/jobs/:id`, `:id/events` →
  operate on the entry (`:id` = entry id). PATCH still writes tracking fields + status
  events. DELETE removes the entry (and its events); the shared posting and its R2 raw
  are **not** deleted (other users may reference them).

## 7. Migration

A new migration (`0002_*.sql`) **resets** job data:
- Drop `jobs`, `job_skills` (and any `events` FK to jobs).
- Create `job_postings`, `job_entries`, `posting_skills`, and recreate `events` with
  `entry_id`.
- Applied to both local (`migrate:local`) and remote (`migrate:remote`) D1. Existing
  tracked jobs are discarded; re-import as needed.

## 8. Module Boundaries

- `packages/shared/src/extraction.ts` — add `description: z.string().nullable()` to the
  extraction schema (drives the LLM structured output and the `Job` type).
- `packages/shared/src/job.ts` — add `description: string | null` to the `Job` DTO.
- `src/extract/llm.ts` — system prompt asks for the concise `description` summary.
- `apps/web/src/components/JobDetailDrawer.tsx` — render `description` (default) above the
  collapsible full `snapshot`.
- `src/extract/hash.ts` — `contentHash(text): Promise<string>` (Web Crypto SHA-256).
- `src/db.ts` — split into posting + entry repository functions:
  `findPostingByHash`, `createPosting` (with ON CONFLICT re-select), `linkSkills`
  (now posting-scoped), `createImportingEntry`, `findEntryByUrl`, `linkEntryToPosting`,
  `collapseDuplicateEntry`, `getEntry`/`listEntries` (return the flat `Job` join),
  `updateEntry`, `deleteEntry`, `addEvent`/`listEvents` (entry-scoped).
- `src/import.ts` — orchestration updated to the cache flow (find-or-create posting,
  link/collapse/refresh).
- `src/routes/jobs.ts` — unchanged surface; calls the new repository functions.

## 9. Testing (TDD)

- **Hash:** deterministic and stable for identical input; differs for different input.
- **Dedup miss:** new content → creates a posting and calls the LLM exactly once.
- **Dedup hit:** second user / second import of identical content → reuses the posting,
  **LLM not called**, entry becomes `ready`.
- **Per-user collapse:** same content via two different URLs by one user →
  `UNIQUE(user_id, posting_id)` triggers collapse to a single entry.
- **Refresh-on-change:** re-import same URL with changed content → entry re-points to the
  new posting; `stage`/`notes` preserved.
- **Concurrency:** two postings inserted with the same hash → ON CONFLICT yields one
  shared posting.
- **Migration:** reset migration creates the new tables; old ones gone.
- **Routes:** `GET`/`PATCH`/`DELETE` operate on entry ids and return the flat `Job`
  shape (incl. `description`); delete removes the entry but not the shared posting.
- **Extraction schema:** validates a `description` field; a cache hit reuses the stored
  description (no second LLM call).

## 10. Known Limitation

"Same job, different URL, changed content" can yield a second entry — URL-agnostic
hashing cannot link posting versions across URLs without a stable external job id. Rare;
accepted for this iteration.
