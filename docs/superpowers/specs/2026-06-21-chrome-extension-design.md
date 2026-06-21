# Chrome Extension (One-Click Capture) — Design Spec

**Date:** 2026-06-21
**Status:** Approved design, pending spec review

## 1. Purpose

Capture a job from the page you're viewing in one click: a Manifest V3 browser extension
reads the current tab's URL and visible text and sends them to the existing import
endpoint, so the job lands on your board without copy-pasting — and without the server
hitting bot/login walls (the page is read in your authenticated browser). This needs a
non-Clerk way for the extension to call the API, which is the "machine-token" seam the
original Phase 1 spec earmarked (and which Phase 2 email will reuse).

## 2. Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Extension auth | Per-user **API token** (`wn_…`), generated in the web app, pasted into the extension. |
| Token storage | Only the SHA-256 **hash** is stored server-side; plaintext shown once. |
| Auth integration | `requireAuth` accepts a `wn_` token *or* a Clerk session — existing routes unchanged. |
| Capture | URL + `document.body.innerText` → existing `POST /api/jobs/import { url, pastedText }`. No import/LLM change. |
| Extension build | New `apps/extension`, MV3, Vite-built; pure logic unit-tested, chrome glue manual. |
| Token management | `POST /api/tokens`, `GET /api/tokens` (masked), `DELETE /api/tokens/:id`, all Clerk-authed. |

## 3. API-Token Auth (backend)

### `api_tokens` table (migration `0003_api_tokens.sql`, additive)
- `id` (uuid, PK)
- `user_id` (REFERENCES users)
- `name` (TEXT — user label, e.g. "Chrome")
- `token_hash` (TEXT, UNIQUE — SHA-256 hex of the plaintext token)
- `created_at` (TEXT), `last_used_at` (TEXT, nullable)
- Index on `user_id`.

### Token format & hashing
- Plaintext: `wn_` + 32 random bytes, base64url. Generated with `crypto.getRandomValues`.
- Stored: `await contentHash(plaintext)` (reuse the existing SHA-256 helper) → `token_hash`.
- The plaintext is returned **once** from the create endpoint and never persisted.

### `requireAuth` (extended)
On each `/api/*` request:
1. Read `Authorization: Bearer <t>`; 401 if absent.
2. **If `t` starts with `wn_`:** hash it, `SELECT user_id FROM api_tokens WHERE token_hash = ?`.
   If found, set `userId`, best-effort `UPDATE … SET last_used_at = datetime('now')`, continue.
   If not found, 401.
3. **Else:** verify as a Clerk session token (existing path); set `userId` or 401.

### Token-management routes (Clerk-authed, mounted under `/api/tokens`)
- `POST /api/tokens { name }` → create; returns `{ id, name, token, created_at }` (`token` = plaintext, once).
- `GET /api/tokens` → `[{ id, name, created_at, last_used_at }]` (no hash, no plaintext).
- `DELETE /api/tokens/:id` → revoke (scoped to the caller's `user_id`); 204 / 404.
- These accept Clerk sessions only — you manage tokens from the signed-in web app. (Token
  auth is for the *data* routes; managing tokens requires the interactive session.)

## 4. Web Token Settings

- A **Settings** entry point in the `Header` (a gear/`Settings` icon button) opens a shadcn
  `Sheet` (or `Dialog`) titled "API tokens".
- **Generate:** an input for an optional name + "Generate token" → calls `POST /api/tokens`,
  then shows the returned plaintext once in a read-only field with a **Copy** button and the
  hint "Paste this into the What's Next extension. You won't see it again."
- **List:** existing tokens (name · created · last used), each with a **Revoke** button
  (`DELETE`), confirmed inline.
- New `useTokens`/`useCreateToken`/`useRevokeToken` query hooks alongside the existing job
  hooks; errors flow through the existing `notify` toasts.

## 5. The Extension (`apps/extension`, MV3)

### Structure
```
apps/extension/
  package.json            # vite build, vitest
  vite.config.ts          # multi-entry build -> dist/
  manifest.json           # MV3
  src/
    lib/importClient.ts   # pure: buildRequest + send + map result  (unit-tested)
    popup.html / popup.ts # Capture button + status
    options.html / options.ts # API URL + token, chrome.storage
  dist/                   # built, load-unpacked
```

### manifest.json (MV3)
- `manifest_version: 3`, name "What's Next — Capture", action → `popup.html`,
  `options_page: options.html`, `permissions: ["activeTab", "scripting", "storage"]`,
  `host_permissions: ["<all_urls>"]` (to read the current tab on any job site).

### Popup flow
1. Read `{ apiUrl, token }` from `chrome.storage.sync`. If missing → status "Set your token
   in Options" + a link to open options.
2. On "Capture this job": `chrome.tabs.query({active, currentWindow})` → tab; then
   `chrome.scripting.executeScript({ target: { tabId }, func: () => ({ url: location.href, text: document.body.innerText }) })`.
3. `importClient.send(apiUrl, token, { url, text })` → `POST {apiUrl}/api/jobs/import` with
   `Authorization: Bearer <token>`, body `{ url, pastedText: text }`.
4. Status: "Saved ✓ — open the board" on 201; "Couldn't save (check token/URL)" on error.

### Options page
- Inputs: API base URL (default the deployed `whats-next-api…` URL) + API token; "Save" →
  `chrome.storage.sync.set`. A "Test connection" button hitting `GET /api/jobs` (token) to
  confirm auth, showing ok/fail.

### `importClient.ts` (pure, testable)
- `buildImportRequest(apiUrl, token, { url, text })` → `{ url, init }` for `fetch`
  (method POST, bearer header, JSON body `{ url, pastedText }`).
- `send(...)` calls an injected `fetch` and returns `{ ok: boolean; status: number }`.
- No `chrome.*` references here, so it unit-tests under vitest.

## 6. Data Flow

Extension popup → `POST /api/jobs/import { url, pastedText }` with a `wn_` token →
`requireAuth` resolves the user via `api_tokens` → existing import pipeline runs the **paste
path** (hash → dedup → LLM extract → link entry) → the job appears on the user's board on
next poll/load. No change to the import or extraction code.

## 7. Module Boundaries

- `apps/api/migrations/0003_api_tokens.sql` — new table.
- `apps/api/src/tokens.ts` — `createToken`, `listTokens`, `revokeToken`, `findUserByToken`,
  `tokenHash` (wrapping the shared SHA-256 helper).
- `apps/api/src/auth.ts` — extended to try `wn_` token before Clerk.
- `apps/api/src/routes/tokens.ts` — the three management routes; mounted in `src/index.ts`
  under Clerk-only auth.
- `apps/web/src/lib/queries.ts` — token hooks; `apps/web/src/components/SettingsSheet.tsx`
  + a Header button.
- `apps/extension/*` — new package (manifest, popup, options, `importClient`).

## 8. Testing (TDD)

- **Migration:** `api_tokens` table created (extends the existing migration test).
- **tokens repo:** `createToken` returns plaintext once and stores only the hash;
  `findUserByToken` resolves a valid hash and returns null for unknown; `revokeToken`
  scoped to the user.
- **auth:** `requireAuth` accepts a valid `wn_` token (sets `userId`), 401s an unknown
  token, still accepts a Clerk session (existing tests stay green).
- **token routes:** create → 201 with plaintext; list → masked (no `token`/`token_hash`);
  delete → 204 and gone; all reject unauthenticated.
- **import via token:** `POST /api/jobs/import` with a `wn_` token creates an importing entry.
- **web:** SettingsSheet renders; generate shows token + copy; revoke calls delete (hooks
  mocked).
- **extension:** `importClient.buildImportRequest` produces the bearer header + `pastedText`
  body; `send` maps a 201 to `{ ok: true }` and a 401 to `{ ok: false, status: 401 }`. Chrome
  glue (popup/options wiring) is verified manually by loading the unpacked extension.

## 9. Out of Scope

Firefox/Safari builds; Chrome Web Store publishing (load-unpacked only); client-side field
extraction (the backend LLM still extracts); token scopes/expiry (revoke is the only
lifecycle); capturing full HTML (visible text only).
