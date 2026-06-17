# What's Next — Job-Seeking Tracker

Capture job postings from a pasted URL, extract structured data with an LLM, and track
application progress through a fixed pipeline.

- **Spec:** `docs/superpowers/specs/2026-05-26-job-seeking-tracker-design.md`
- **Plan:** `docs/superpowers/plans/2026-05-26-job-seeking-tracker.md`

## Architecture

pnpm monorepo, two Cloudflare Workers:

- `apps/api` — Hono API on Workers (D1 + R2 + Browser Rendering + AI Gateway bindings).
- `apps/web` — Vite + React SPA (shadcn-style UI, Tailwind, TanStack Query, Zustand),
  served by a static-assets worker.
- `packages/shared` — Zod schemas + types, the single source of truth.

Auth is Clerk: the SPA sends the Clerk session token as an `Authorization: Bearer`
header; the API verifies it with `@clerk/backend`.

## Prerequisites

- Node 20+ and `pnpm` (`packageManager` pins the version).
- A Cloudflare account (`pnpm exec wrangler login`).
- A Clerk application (publishable + secret keys).
- An OpenRouter API key and a Cloudflare AI Gateway configured for OpenRouter.

## Install

```bash
pnpm install
```

## Test (TDD)

The whole suite is TDD-built. Run everything:

```bash
pnpm -r test          # all workspaces
pnpm -r typecheck
```

Per package:

```bash
pnpm --filter @whats-next/api test
pnpm --filter @whats-next/web test
```

API tests run in the Cloudflare Workers pool (`@cloudflare/vitest-pool-workers`) against
a local D1; the import pipeline is tested with HTML fixtures and a mocked LLM (no network).

## Local development

### API (`apps/api`)

1. Apply migrations to the local D1:
   ```bash
   pnpm --filter @whats-next/api migrate:local
   ```
2. Provide local secrets in `apps/api/.dev.vars` (git-ignored):
   ```
   CLERK_SECRET_KEY=sk_test_...
   OPENROUTER_API_KEY=sk-or-...
   AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/<account>/<gateway>/openrouter
   ```
   `AI_GATEWAY_URL` is treated as a secret because its path contains the account id, so
   it is **not** committed to `wrangler.toml`.
3. Run it:
   ```bash
   pnpm --filter @whats-next/api dev    # http://localhost:8787
   ```

### Web (`apps/web`)

Set `apps/web/.env.local`:

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=http://localhost:8787
```

```bash
pnpm --filter @whats-next/web dev       # http://localhost:5173
```

## Deploy

> These steps require `wrangler login` and create real Cloudflare resources.

The account id is kept out of this public repo. Export it for every wrangler command
that needs it (it is not stored in `wrangler.toml`):

```bash
export CLOUDFLARE_ACCOUNT_ID="<your-account-id>"   # see `wrangler whoami`
```

1. Create the D1 database and R2 bucket, then paste the printed `database_id` into
   `apps/api/wrangler.toml` (replacing `PLACEHOLDER_SET_AFTER_d1_create`):
   ```bash
   cd apps/api
   pnpm exec wrangler d1 create whats-next-db
   pnpm exec wrangler r2 bucket create whats-next-raw
   pnpm exec wrangler d1 migrations apply whats-next-db --remote
   ```
2. Set API secrets (`AI_GATEWAY_URL` is a secret because its path embeds the account id):
   ```bash
   pnpm exec wrangler secret put CLERK_SECRET_KEY
   pnpm exec wrangler secret put OPENROUTER_API_KEY
   pnpm exec wrangler secret put AI_GATEWAY_URL
   ```
3. Deploy the API, then point the web app at it and deploy the web worker:
   ```bash
   pnpm --filter @whats-next/api deploy
   # set apps/web/.env.local VITE_API_URL to the deployed API URL, then:
   pnpm --filter @whats-next/web deploy
   ```
4. Set `apps/api` `[vars] ALLOWED_ORIGIN` to the deployed web origin and redeploy the API.
5. In the Clerk dashboard, add the deployed web origin to the allowed origins.

## Manual end-to-end check

Sign in → paste a Greenhouse/Lever URL → the card shows "Importing…", then populates
(company, title, skills) and lands in **Saved**. Paste a LinkedIn URL → it lands in
**Needs paste**; paste the description and confirm it extracts. Move a card to
**Applied**, set an applied date, reload, confirm persistence.

## Roadmap (designed-for, not yet built)

- **Phase 2** — allocated forwarding email that writes `email_ingest` events.
- **Phase 3** — Chrome extension that posts page HTML to the import endpoint.
