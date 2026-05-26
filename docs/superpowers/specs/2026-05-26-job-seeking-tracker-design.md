# Job-Seeking Tracker — Design Spec

**Date:** 2026-05-26
**Status:** Approved design, pending spec review

## 1. Purpose

A private web app to capture job postings from any platform and track application
progress. Core loop: **paste a job URL → an LLM extracts structured data → the job
enters a trackable pipeline** you manage by hand. Later phases add an allocated
forwarding email (auto-update status from received emails) and a Chrome extension
(one-click capture from the ad page).

## 2. Scope

### In scope (this spec — Phase 1)
- Capture a job by URL (with content-fetch fallbacks).
- LLM extraction into a validated JSON schema.
- Job list + kanban board with manual status tracking, applied date, next-action
  date, and free-text notes.
- A per-job event timeline (the seam the later email feature writes into).
- Single user now, multi-user-ready data model.

### Out of scope (later phases, designed as seams only — do NOT build now)
- **Phase 2 — Allocated forwarding email** (`happy-little-bird@domain` style): user
  forwards application emails; a worker extracts status / next-progress time and
  writes `email_ingest` events. The `events` table and machine-token auth are the
  seams.
- **Phase 3 — Chrome extension**: one-click capture sends page HTML to the same API.
  The `pastedText` import path and machine-token auth are the seams.

## 3. Decisions (resolved during brainstorming)

| Topic | Decision |
|---|---|
| Audience | Single user now; multi-user-ready data model (`user_id` on all rows). |
| Content fetch | Plain `fetch` + readability → escalate to Cloudflare Browser Rendering → manual paste fallback. |
| Status model | Fixed pipeline stages + free-text notes. |
| Frontend/deploy | **Two workers**: `apps/web` (static SPA) + `apps/api` (Hono API), deployed independently. |
| Cross-origin | SPA→API CORS; auth via Clerk **`Authorization: Bearer` token** (no cross-site cookies). |
| Methodology | **TDD** (red-green-refactor) for all implementation. |
| Auth | **Clerk** (React SDK on SPA, `@clerk/backend` verify on API). |
| UI | shadcn/ui + Tailwind. |
| State | TanStack Query (server state) + Zustand (UI state). |
| DB | Cloudflare D1 (SQLite) for structured data; **R2** for raw fetched content. |
| LLM | OpenRouter via Cloudflare AI Gateway, Zod-driven structured output. |
| Package manager | pnpm workspaces, **exact-pinned** dependency versions. |
| Company/agency | Flat fields now; normalize later. |
| Skills | Normalized `skills` + `job_skills` join now. |
| Raw content | Keep both cleaned snapshot (D1) and raw HTML (R2). |
| Contacts | Skipped in MVP (use `notes`). |

## 4. Architecture & Repo

pnpm monorepo deployed as **two independent Cloudflare Workers** — a static SPA worker
and a Hono API worker. Independent deploys; the API is a clean shared surface for the
future email-worker and extension.

```
seeking/
├── apps/
│   ├── web/          # Vite + React SPA, served by a static-assets worker (app.<domain>)
│   └── api/          # Hono API worker (api.<domain>); holds all data bindings
├── packages/
│   └── shared/       # Zod schemas, stage enum, shared TS types (source of truth)
├── pnpm-workspace.yaml
└── (later) apps/extension, apps/email-worker
```

- `apps/web`: a static-assets worker serving the built SPA, with SPA fallback to
  `index.html`. No data bindings.
- `apps/api`: Hono routes under `/api/*`. Bindings: **D1** (database), **R2** (raw
  content bucket), **AI Gateway** (LLM), Clerk secrets, OpenRouter key.
- **CORS:** the API allows the SPA origin. Auth travels as a Clerk
  `Authorization: Bearer` token (not cross-site cookies), which also matches how the
  future machine clients authenticate.
- `packages/shared` is the **single source of truth**: the Zod extraction schema and
  the stage enum are consumed by the LLM (JSON Schema for structured output), the API
  (request/row validation), and the SPA (inferred TS types).

### Supply-chain note
All dependencies pinned to **exact** versions (no `^`/`~`). Notably
`@tanstack/react-query@5.100.14`. Verify npm provenance at install time. Exact pins
prevent a malicious patch/minor release entering via a range.

## 5. Data Model

Structured data in **Cloudflare D1** (SQLite); raw fetched HTML in **R2**. All dates
stored as ISO-8601 TEXT.

### `users`
Mirrors Clerk so we can join locally without round-tripping.
- `id` (Clerk user ID, PK)
- `email` (cached)
- `created_at`

### `jobs`
Scoped by `user_id`. Combines LLM-extracted fields with user-managed tracking fields.

**Extracted (LLM-populated):**
- `company_name` (flat string; normalize into a `companies` table in a later phase)
- `is_agency` (bool), `agency_name` (nullable — set when `is_agency`)
- `job_title`, `role`, `level`
- `salary_min`, `salary_max`, `salary_currency`, `salary_period`, `salary_raw_text`
- `location`, `is_remote` (bool)
- `deadline` (date, nullable)
- `url`, `apply_url`
- `source_site` (URL domain, e.g. `linkedin.com` — for filtering by board)
- `snapshot` (cleaned extracted text — the original wording, for display)
- `raw_content_key` (R2 object key for the raw fetched HTML; enables re-extraction
  without re-fetching)
- `source_method` (`fetch` | `render` | `paste`)
- `extraction_model` (model id used)

(Skills are **not** a column — see `skills` / `job_skills` below.)

**Tracking (user-managed):**
- `stage` (enum, see §7)
- `import_status` (`importing` | `needs_paste` | `ready` | `failed`)
- `applied_date` (nullable)
- `next_action_at` (nullable)
- `notes` (free text — also the MVP home for recruiter/contact info)

**Meta:** `id`, `user_id`, `created_at`, `updated_at`. Hard delete supported;
Rejected/Closed stage covers "done without deleting".

### `skills`
Normalized skill vocabulary (shared across jobs).
- `id`, `slug` (lowercased/trimmed, unique — converges "ReactJS"/"React"), `name`
  (display form)

### `job_skills`
Join table linking jobs to skills.
- `job_id`, `skill_id`
- `raw_label` (the LLM's original wording before normalization, preserved)
- PK (`job_id`, `skill_id`)

During import, each extracted skill is matched to an existing `skills` row by `slug`
(created if absent), then linked via `job_skills` with its `raw_label`.

### `events`
Per-job timeline. **This is the seam for the Phase-2 email feature.**
- `id`, `job_id`, `user_id`
- `type` (`status_change` | `note` | later `email_ingest`)
- `payload` (JSON — e.g. `{from, to}` for status change, text for note)
- `created_at`

## 6. Import Pipeline

`POST /api/jobs/import { url, pastedText? }`:

1. Create the job row immediately with `import_status=importing` and return it (UI
   shows it instantly).
2. **Fetch:** plain `fetch` with browser-like headers → store raw HTML to **R2**
   (`raw_content_key`) → extract readable main text.
3. **Escalate:** if blocked or the text is thin, retry via **Cloudflare Browser
   Rendering** (headless), store its raw HTML to R2, and re-extract.
4. **Fallback:** if still thin (login wall, e.g. LinkedIn/Indeed), set
   `import_status=needs_paste`; the UI prompts the user to paste the job text (also
   stored to R2), which re-enters at step 5 with `source_method=paste`.
5. **Extract:** send text to the LLM → structured JSON (validated against the shared
   Zod schema) → populate the row, link skills via `skills`/`job_skills`, set
   `import_status=ready`, `stage=Saved`.

Steps 2–5 run in the background (`ctx.waitUntil`; upgrade to a Cloudflare **Queue** if
latency warrants). The SPA uses TanStack Query `refetchInterval` to poll the row until
`import_status` leaves `importing`. Failures set `import_status=failed` with an error
message surfaced in the UI.

## 7. Status Pipeline

Fixed ordered stages: **Saved → Applied → Phone screen → Interview → Offer →
Rejected/Closed**. Stored as an enum in `packages/shared`. Every stage change appends a
`status_change` event. Free-text `notes` and `next_action_at` cover the messy reality
that stages don't.

## 8. LLM Extraction

- **Provider:** OpenRouter, accessed **through Cloudflare AI Gateway** (caching,
  retries, request logging, model fallback — swappable without code changes).
- **Structured output:** the shared Zod schema → JSON Schema constrains the model to
  return validated JSON, not free text. The API re-validates with Zod before writing.
- **Model:** config-driven; start with a free/cheap capable model on OpenRouter.

## 9. Auth (Clerk)

- SPA: Clerk React SDK guards the dashboard (sign-in UI, session). It attaches the
  Clerk session token as an `Authorization: Bearer` header on every API call
  (cross-origin friendly; no cross-site cookies).
- API: each `/api/*` request verifies the bearer token via `@clerk/backend`, with CORS
  restricted to the SPA origin.
- `user_id` on every row **is** the Clerk user ID — the multi-user seam is real, not
  faked.
- Machine clients (Phase 2 email-worker, Phase 3 extension) authenticate with a
  separate **API-token** check, not a Clerk session.

## 10. Frontend

- Vite + React SPA, shadcn/ui (Radix-based) components, Tailwind styling.
- **TanStack Query** (`5.100.14`, exact pin) owns server state: job list/detail
  fetching, caching, mutations with optimistic updates, and import-status polling.
- **Zustand** owns UI-only state: active view (list vs kanban), board filters, open
  modals/drawers, selection. No server data duplicated into Zustand.
- Core views: an **import bar** (paste URL), a **job list/kanban board**, a **job
  detail drawer** (edit stage/dates/notes, view snapshot + event timeline).

## 11. Testing & Methodology

**TDD throughout** — every feature and bugfix follows red-green-refactor: write a
failing test that pins the behavior, make it pass with the simplest change, then
refactor. No implementation code is written before a failing test exists.

- Vitest with `@cloudflare/vitest-pool-workers` for the API worker.
- Import pipeline tested against **saved HTML fixtures** with a **mocked LLM** (no live
  network or model calls in tests).
- Extraction schema validated by direct unit tests on the shared Zod schema.
- Skill normalization (slug convergence, `job_skills` linking) unit-tested.
- Component tests on the SPA's critical interactions (import, stage change).

## 12. Open Items / Future Seams

- AI Gateway model selection and cost ceilings (tune after first real usage).
- Phase 2 email ingestion writes `email_ingest` events into the existing `events`
  table via machine-token auth.
- Phase 3 Chrome extension posts page HTML to the existing import endpoint
  (`pastedText` path) via machine-token auth.
