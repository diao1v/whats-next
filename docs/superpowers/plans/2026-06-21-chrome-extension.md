# Chrome Extension (One-Click Capture) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture a job from the current tab in one click via an MV3 extension that posts the URL + visible text to the existing import endpoint, authenticated by a new per-user API token.

**Architecture:** Backend gains an `api_tokens` table and token issue/verify; `requireAuth` accepts a `wn_` token or a Clerk session, while new `/api/tokens` management routes are Clerk-only. The web app gets a settings sheet to generate/revoke tokens. A new `apps/extension` (MV3, Vite-built) reads `location.href` + `document.body.innerText` and calls `/api/jobs/import` with the token. No import/extraction change.

**Tech Stack:** Cloudflare Workers/D1, Hono, Zod, Vitest + `@cloudflare/vitest-pool-workers`; React/Vite/shadcn/TanStack (web); MV3 + Vite + Vitest (extension).

**Spec:** `docs/superpowers/specs/2026-06-21-chrome-extension-design.md`

---

## File Structure

```
apps/api/
  migrations/0003_api_tokens.sql      # NEW
  src/tokens.ts                       # NEW: generate/hash/create/list/revoke/find
  src/auth.ts                         # split: requireClerk + token-aware requireAuth
  src/routes/tokens.ts                # NEW: POST/GET/DELETE /api/tokens
  src/index.ts                        # mount /api/tokens (Clerk-only)
apps/web/
  src/lib/api.ts                      # + token client methods
  src/lib/queries.ts                  # + useTokens/useCreateToken/useRevokeToken
  src/components/SettingsSheet.tsx     # NEW
  src/components/Header.tsx           # + Settings button
apps/extension/                        # NEW package
  package.json, vite.config.ts, manifest.json, tsconfig.json
  src/lib/importClient.ts (+ test)
  popup.html, src/popup.ts
  options.html, src/options.ts
```

---

# Milestone 1 — Token storage & repository

## Task 1: `api_tokens` migration

**Files:**
- Create: `apps/api/migrations/0003_api_tokens.sql`
- Modify: `apps/api/test/migration.test.ts`

- [ ] **Step 1: Extend the migration test**

In `apps/api/test/migration.test.ts`, add `api_tokens` to the expected-tables list:
```ts
    for (const t of ["users", "job_postings", "job_entries", "posting_skills", "skills", "events", "api_tokens"]) {
      expect(names).toContain(t);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @whats-next/api test migration`
Expected: FAIL — `api_tokens` missing.

- [ ] **Step 3: Write the migration**

`apps/api/migrations/0003_api_tokens.sql`:
```sql
CREATE TABLE api_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL DEFAULT '',
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT
);
CREATE INDEX idx_api_tokens_user ON api_tokens(user_id);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @whats-next/api test migration`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/migrations/0003_api_tokens.sql apps/api/test/migration.test.ts
git commit -m "feat(api): api_tokens migration"
```

## Task 2: Token repository

**Files:**
- Create: `apps/api/src/tokens.ts`, `apps/api/test/tokens.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/api/test/tokens.test.ts`:
```ts
import { env, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { generateToken, tokenHash, createToken, listTokens, revokeToken, findUserByToken } from "../src/tokens";
import { ensureUser } from "../src/db";

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM api_tokens").run();
  await env.DB.prepare("DELETE FROM users").run();
  await ensureUser(env.DB, "u1", "a@b.c");
});

describe("tokens", () => {
  it("generateToken produces a wn_ prefixed token", () => {
    expect(generateToken()).toMatch(/^wn_[A-Za-z0-9_-]+$/);
  });

  it("createToken returns the plaintext once and stores only its hash", async () => {
    const t = await createToken(env.DB, "u1", "Chrome");
    expect(t.token).toMatch(/^wn_/);
    expect(t.name).toBe("Chrome");
    const row = await env.DB.prepare("SELECT token_hash FROM api_tokens WHERE id=?").bind(t.id).first<{ token_hash: string }>();
    expect(row?.token_hash).toBe(await tokenHash(t.token));
    expect(row?.token_hash).not.toContain(t.token);
  });

  it("findUserByToken resolves a valid token and stamps last_used_at", async () => {
    const t = await createToken(env.DB, "u1", "x");
    expect(await findUserByToken(env.DB, await tokenHash(t.token))).toBe("u1");
    const row = await env.DB.prepare("SELECT last_used_at FROM api_tokens WHERE id=?").bind(t.id).first<{ last_used_at: string | null }>();
    expect(row?.last_used_at).toBeTruthy();
  });

  it("findUserByToken returns null for an unknown hash", async () => {
    expect(await findUserByToken(env.DB, "deadbeef")).toBeNull();
  });

  it("listTokens is masked (no hash, no plaintext)", async () => {
    await createToken(env.DB, "u1", "x");
    const list = await listTokens(env.DB, "u1");
    expect(list).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain("token_hash");
    expect(list[0]).toMatchObject({ name: "x" });
  });

  it("revokeToken deletes only the caller's token", async () => {
    const t = await createToken(env.DB, "u1", "x");
    expect(await revokeToken(env.DB, "u2", t.id)).toBe(false);
    expect(await revokeToken(env.DB, "u1", t.id)).toBe(true);
    expect(await listTokens(env.DB, "u1")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @whats-next/api test tokens.test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`apps/api/src/tokens.ts`:
```ts
import { contentHash } from "./extract/hash";

export interface TokenSummary { id: string; name: string; created_at: string; last_used_at: string | null; }

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `wn_${b64}`;
}

export function tokenHash(plaintext: string): Promise<string> {
  return contentHash(plaintext);
}

export async function createToken(
  db: D1Database, userId: string, name: string | undefined
): Promise<{ id: string; name: string; token: string; created_at: string }> {
  const token = generateToken();
  const id = crypto.randomUUID();
  const hash = await tokenHash(token);
  await db.prepare("INSERT INTO api_tokens (id, user_id, name, token_hash) VALUES (?, ?, ?, ?)")
    .bind(id, userId, name ?? "", hash).run();
  const row = await db.prepare("SELECT created_at FROM api_tokens WHERE id=?").bind(id).first<{ created_at: string }>();
  return { id, name: name ?? "", token, created_at: row!.created_at };
}

export async function listTokens(db: D1Database, userId: string): Promise<TokenSummary[]> {
  const { results } = await db.prepare(
    "SELECT id, name, created_at, last_used_at FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC"
  ).bind(userId).all<TokenSummary>();
  return results;
}

export async function revokeToken(db: D1Database, userId: string, id: string): Promise<boolean> {
  const res = await db.prepare("DELETE FROM api_tokens WHERE id = ? AND user_id = ?").bind(id, userId).run();
  return (res.meta.changes ?? 0) > 0;
}

export async function findUserByToken(db: D1Database, hash: string): Promise<string | null> {
  const row = await db.prepare("SELECT id, user_id FROM api_tokens WHERE token_hash = ?").bind(hash)
    .first<{ id: string; user_id: string }>();
  if (!row) return null;
  await db.prepare("UPDATE api_tokens SET last_used_at = datetime('now') WHERE id = ?").bind(row.id).run();
  return row.user_id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @whats-next/api test tokens.test`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/tokens.ts apps/api/test/tokens.test.ts
git commit -m "feat(api): API token repository"
```

---

# Milestone 2 — Token-aware auth

## Task 3: Split auth into requireClerk + token-aware requireAuth

**Files:**
- Modify: `apps/api/src/auth.ts`, `apps/api/test/auth.test.ts`

- [ ] **Step 1: Add token-path tests**

Append to `apps/api/test/auth.test.ts`. First extend the mock setup — the file already mocks `@clerk/backend`; add a mock of `../src/tokens` near the top (after the clerk mock):
```ts
const findUserByToken = vi.fn();
vi.mock("../src/tokens", () => ({
  findUserByToken: (...a: unknown[]) => findUserByToken(...a),
  tokenHash: async (t: string) => `hash:${t}`,
}));
```
Add `beforeEach(() => findUserByToken.mockReset())` (or extend the existing one). Then add tests inside `describe("requireAuth", ...)`:
```ts
  it("accepts a valid wn_ API token and sets userId", async () => {
    findUserByToken.mockResolvedValue("user_tok");
    const res = await makeApp().request("/api/me",
      { headers: { Authorization: "Bearer wn_abc" } }, { CLERK_SECRET_KEY: "sk", DB: {} as never });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: "user_tok" });
  });
  it("401s an unknown wn_ token", async () => {
    findUserByToken.mockResolvedValue(null);
    const res = await makeApp().request("/api/me",
      { headers: { Authorization: "Bearer wn_nope" } }, { CLERK_SECRET_KEY: "sk", DB: {} as never });
    expect(res.status).toBe(401);
  });
```
(The existing Clerk-session tests remain and must still pass.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @whats-next/api test auth`
Expected: FAIL — wn_ path not implemented.

- [ ] **Step 3: Rewrite `apps/api/src/auth.ts`**

```ts
import { verifyToken } from "@clerk/backend";
import type { MiddlewareHandler } from "hono";
import type { Context } from "hono";
import type { Env } from "./index";
import { findUserByToken, tokenHash } from "./tokens";

type Vars = { userId: string };
type Ctx = { Bindings: Env; Variables: Vars };

function bearer(c: Context<Ctx>): string | null {
  const h = c.req.header("Authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

async function clerkUserId(token: string, secretKey: string): Promise<string | null> {
  try {
    const result = await verifyToken(token, { secretKey });
    const payload = (result as { data?: { sub?: string } }).data ?? (result as { sub?: string });
    return payload?.sub ?? null;
  } catch {
    return null;
  }
}

/** Clerk session only — for routes you manage from the signed-in web app. */
export const requireClerk: MiddlewareHandler<Ctx> = async (c, next) => {
  const token = bearer(c);
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const sub = await clerkUserId(token, c.env.CLERK_SECRET_KEY);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  c.set("userId", sub);
  await next();
};

/** Accepts a `wn_` API token OR a Clerk session — for data routes. */
export const requireAuth: MiddlewareHandler<Ctx> = async (c, next) => {
  const token = bearer(c);
  if (!token) return c.json({ error: "unauthorized" }, 401);
  if (token.startsWith("wn_")) {
    const userId = await findUserByToken(c.env.DB, await tokenHash(token));
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    c.set("userId", userId);
    await next();
    return;
  }
  const sub = await clerkUserId(token, c.env.CLERK_SECRET_KEY);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  c.set("userId", sub);
  await next();
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @whats-next/api test auth`
Expected: PASS (existing Clerk tests + 2 token tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth.ts apps/api/test/auth.test.ts
git commit -m "feat(api): token-aware requireAuth + requireClerk"
```

---

# Milestone 3 — Token routes

## Task 4: /api/tokens routes (Clerk-only)

**Files:**
- Create: `apps/api/src/routes/tokens.ts`, `apps/api/test/tokens-routes.test.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Write the failing integration test**

`apps/api/test/tokens-routes.test.ts`:
```ts
import { env, SELF, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
vi.mock("@clerk/backend", () => ({ verifyToken: async () => ({ data: { sub: "user_test" } }) }));
const auth = { headers: { Authorization: "Bearer clerk", "content-type": "application/json" } };

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM api_tokens").run();
  await env.DB.prepare("DELETE FROM users").run();
});

describe("/api/tokens", () => {
  it("creates a token (plaintext once), lists masked, deletes", async () => {
    const created = await (await SELF.fetch("https://api/api/tokens", {
      method: "POST", ...auth, body: JSON.stringify({ name: "Chrome" }),
    })).json<{ id: string; token: string }>();
    expect(created.token).toMatch(/^wn_/);

    const list = await (await SELF.fetch("https://api/api/tokens", auth)).json<Array<Record<string, unknown>>>();
    expect(list).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain("token_hash");
    expect(JSON.stringify(list)).not.toContain(created.token);

    const del = await SELF.fetch(`https://api/api/tokens/${created.id}`, { method: "DELETE", ...auth });
    expect(del.status).toBe(204);
    expect(await (await SELF.fetch("https://api/api/tokens", auth)).json<unknown[]>()).toHaveLength(0);
  });

  it("rejects unauthenticated", async () => {
    expect((await SELF.fetch("https://api/api/tokens")).status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @whats-next/api test tokens-routes`
Expected: FAIL — routes not mounted (404/401 mismatch).

- [ ] **Step 3: Implement the routes**

`apps/api/src/routes/tokens.ts`:
```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "../index";
import { ensureUser } from "../db";
import { createToken, listTokens, revokeToken } from "../tokens";

type Vars = { userId: string };
export const tokens = new Hono<{ Bindings: Env; Variables: Vars }>();

tokens.post("/", zValidator("json", z.object({ name: z.string().optional() }).strict()), async (c) => {
  const userId = c.get("userId");
  await ensureUser(c.env.DB, userId, "");
  const t = await createToken(c.env.DB, userId, c.req.valid("json").name);
  return c.json(t, 201);
});

tokens.get("/", async (c) => c.json(await listTokens(c.env.DB, c.get("userId"))));

tokens.delete("/:id", async (c) => {
  const ok = await revokeToken(c.env.DB, c.get("userId"), c.req.param("id"));
  return ok ? c.body(null, 204) : c.json({ error: "not found" }, 404);
});
```

- [ ] **Step 4: Mount them (Clerk-only) in `src/index.ts`**

Replace the import line and add the mounts:
```ts
import { requireAuth, requireClerk } from "./auth";
import { jobs } from "./routes/jobs";
import { tokens } from "./routes/tokens";
```
and after the existing `app.route("/api/jobs", jobs);`:
```ts
app.use("/api/tokens/*", requireClerk);
app.use("/api/tokens", requireClerk);
app.route("/api/tokens", tokens);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @whats-next/api test tokens-routes`
Expected: PASS (2 tests).

- [ ] **Step 6: Verify a token can import**

Add to `apps/api/test/tokens-routes.test.ts`:
```ts
  it("a wn_ token authorizes the import endpoint", async () => {
    const created = await (await SELF.fetch("https://api/api/tokens", {
      method: "POST", ...auth, body: JSON.stringify({ name: "x" }),
    })).json<{ token: string }>();
    const res = await SELF.fetch("https://api/api/jobs/import", {
      method: "POST",
      headers: { Authorization: `Bearer ${created.token}`, "content-type": "application/json" },
      body: JSON.stringify({ url: "https://acme.com/1" }),
    });
    expect(res.status).toBe(201);
  });
```
(`runImport` runs in the background via `waitUntil`; the assertion only checks the synchronous 201, so no network mock is needed.)

Run: `pnpm --filter @whats-next/api test tokens-routes && pnpm --filter @whats-next/api test`
Expected: PASS; full API suite green.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/tokens.ts apps/api/src/index.ts apps/api/test/tokens-routes.test.ts
git commit -m "feat(api): token management routes; token-authorized import"
```

---

# Milestone 4 — Web token settings

## Task 5: API client + token query hooks

**Files:**
- Modify: `apps/web/src/lib/api.ts`, `apps/web/src/lib/queries.ts`

- [ ] **Step 1: Add token methods to the API client**

In `apps/web/src/lib/api.ts`, add to the returned object in `createApiClient`:
```ts
    listTokens: () => call<Array<{ id: string; name: string; created_at: string; last_used_at: string | null }>>("/api/tokens"),
    createToken: (name: string) => call<{ id: string; name: string; token: string; created_at: string }>("/api/tokens", { method: "POST", body: JSON.stringify({ name }) }),
    deleteToken: (id: string) => call<void>(`/api/tokens/${id}`, { method: "DELETE" }),
```

- [ ] **Step 2: Add hooks**

Append to `apps/web/src/lib/queries.ts`:
```ts
export function useTokens() {
  const api = useApi();
  return useQuery({ queryKey: ["tokens"], queryFn: () => api.listTokens() });
}
export function useCreateToken() {
  const api = useApi(); const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.createToken(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tokens"] }),
    onError: () => notify.error("Couldn't create token"),
  });
}
export function useRevokeToken() {
  const api = useApi(); const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteToken(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tokens"] }),
    onError: () => notify.error("Couldn't revoke token"),
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @whats-next/web typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/lib/queries.ts
git commit -m "feat(web): token API client + hooks"
```

## Task 6: SettingsSheet + Header button

**Files:**
- Create: `apps/web/src/components/SettingsSheet.tsx`, `apps/web/src/components/SettingsSheet.test.tsx`
- Modify: `apps/web/src/components/Header.tsx`

- [ ] **Step 1: Write the failing test (hooks mocked)**

`apps/web/src/components/SettingsSheet.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
const revoke = vi.fn();
vi.mock("../lib/queries", () => ({
  useTokens: () => ({ data: [{ id: "t1", name: "Chrome", created_at: "2026-01-01", last_used_at: null }] }),
  useCreateToken: () => ({ mutate: create, data: undefined, isPending: false }),
  useRevokeToken: () => ({ mutate: revoke }),
}));

import { SettingsSheet } from "./SettingsSheet";

beforeEach(() => { create.mockReset(); revoke.mockReset(); });

describe("SettingsSheet", () => {
  it("lists existing tokens and revokes", () => {
    render(<SettingsSheet open onOpenChange={vi.fn()} />);
    expect(screen.getByText("Chrome")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /revoke/i }));
    expect(revoke).toHaveBeenCalledWith("t1");
  });

  it("generates a token", () => {
    render(<SettingsSheet open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /generate token/i }));
    expect(create).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @whats-next/web test SettingsSheet`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the sheet**

`apps/web/src/components/SettingsSheet.tsx`:
```tsx
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTokens, useCreateToken, useRevokeToken } from "../lib/queries";

export function SettingsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: tokens = [] } = useTokens();
  const createToken = useCreateToken();
  const revokeToken = useRevokeToken();
  const [name, setName] = useState("");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader><SheetTitle>API tokens</SheetTitle></SheetHeader>
        <p className="mt-1 text-sm text-muted-foreground">Generate a token to connect the What&apos;s Next browser extension.</p>

        <div className="mt-4 flex gap-2">
          <Input placeholder="Token name (e.g. Chrome)" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={() => { createToken.mutate(name || "Extension"); setName(""); }} disabled={createToken.isPending}>
            Generate token
          </Button>
        </div>

        {createToken.data?.token && (
          <div className="mt-3 rounded-lg border border-line bg-secondary p-3">
            <p className="text-xs text-muted-foreground">Copy this now — you won&apos;t see it again:</p>
            <div className="mt-1 flex gap-2">
              <Input readOnly value={createToken.data.token} className="font-mono text-xs" />
              <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(createToken.data!.token)}>Copy</Button>
            </div>
          </div>
        )}

        <div className="mt-5 space-y-2">
          {tokens.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-line p-2 text-sm">
              <div>
                <div className="font-medium">{t.name || "Untitled"}</div>
                <div className="text-xs text-muted-foreground">added {t.created_at?.slice(0, 10)} · last used {t.last_used_at ? t.last_used_at.slice(0, 10) : "never"}</div>
              </div>
              <Button variant="secondary" className="h-7 px-2 text-xs" onClick={() => revokeToken.mutate(t.id)}>Revoke</Button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @whats-next/web test SettingsSheet`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the Header button**

In `apps/web/src/components/Header.tsx`: add `import { useState } from "react";`, `import { Settings } from "lucide-react";`, `import { SettingsSheet } from "./SettingsSheet";`, a `const [settingsOpen, setSettingsOpen] = useState(false);`, a button before `<UserButton>`:
```tsx
        <button aria-label="Settings" onClick={() => setSettingsOpen(true)} className="text-muted-foreground hover:text-ink">
          <Settings size={18} />
        </button>
        <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
```
(Header must become a stateful component — change `export function Header()` body to include the `useState`; the existing test asserting the app name/toggle/user button still passes.)

- [ ] **Step 6: Run web suite + typecheck**

Run: `pnpm --filter @whats-next/web test Header SettingsSheet && pnpm --filter @whats-next/web typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/SettingsSheet.tsx apps/web/src/components/SettingsSheet.test.tsx apps/web/src/components/Header.tsx
git commit -m "feat(web): API token settings sheet"
```

---

# Milestone 5 — The extension

## Task 7: Extension package scaffold + importClient

**Files:**
- Create: `apps/extension/package.json`, `apps/extension/tsconfig.json`, `apps/extension/vite.config.ts`, `apps/extension/src/lib/importClient.ts`, `apps/extension/src/lib/importClient.test.ts`

- [ ] **Step 1: Scaffold the package**

`apps/extension/package.json`:
```json
{
  "name": "@whats-next/extension",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "vite": "6.0.7",
    "vitest": "4.1.7",
    "typescript": "5.7.3",
    "@types/chrome": "0.2.0"
  }
}
```

`apps/extension/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "lib": ["ES2022", "DOM"], "types": ["chrome", "vitest/globals"] },
  "include": ["src"]
}
```

`apps/extension/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        options: resolve(__dirname, "options.html"),
      },
    },
  },
  test: { environment: "node", globals: true },
});
```

- [ ] **Step 2: Write the failing test**

`apps/extension/src/lib/importClient.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { buildImportRequest, send } from "./importClient";

describe("importClient", () => {
  it("builds a POST with bearer token and pastedText body", () => {
    const { url, init } = buildImportRequest("https://api.example", "wn_tok", { url: "https://job/1", text: "Job text" });
    expect(url).toBe("https://api.example/api/jobs/import");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer wn_tok");
    expect(JSON.parse(init.body as string)).toEqual({ url: "https://job/1", pastedText: "Job text" });
  });

  it("send maps a 201 to ok", async () => {
    const f = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    expect(await send("https://api.example", "wn_t", { url: "u", text: "x" }, f)).toEqual({ ok: true, status: 201 });
  });

  it("send maps a 401 to not-ok", async () => {
    const f = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    expect(await send("https://api.example", "wn_t", { url: "u", text: "x" }, f)).toEqual({ ok: false, status: 401 });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @whats-next/extension test`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

`apps/extension/src/lib/importClient.ts`:
```ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @whats-next/extension test`
Expected: PASS (3 tests).

- [ ] **Step 6: Install workspace deps + commit**

```bash
pnpm install
git add apps/extension/package.json apps/extension/tsconfig.json apps/extension/vite.config.ts apps/extension/src/lib/importClient.ts apps/extension/src/lib/importClient.test.ts pnpm-lock.yaml
git commit -m "feat(extension): scaffold + tested importClient"
```

## Task 8: Manifest, popup, options (chrome glue)

**Files:**
- Create: `apps/extension/manifest.json`, `apps/extension/popup.html`, `apps/extension/src/popup.ts`, `apps/extension/options.html`, `apps/extension/src/options.ts`, `apps/extension/public/` (for manifest copy)

- [ ] **Step 1: manifest.json (place at package root, copied to dist by Step 5 build config)**

`apps/extension/manifest.json`:
```json
{
  "manifest_version": 3,
  "name": "What's Next — Capture",
  "version": "0.1.0",
  "description": "Capture the job on this page into What's Next.",
  "action": { "default_popup": "popup.html" },
  "options_page": "options.html",
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": ["<all_urls>"]
}
```

- [ ] **Step 2: popup.html + popup.ts**

`apps/extension/popup.html`:
```html
<!doctype html><html><head><meta charset="utf-8" />
<style>body{font-family:system-ui;width:260px;padding:12px;background:#fdf8f3;color:#42342a}
button{background:#d97706;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:600;cursor:pointer}
#status{margin-top:8px;font-size:12px;color:#8a7763}a{color:#b45309}</style></head>
<body><button id="capture">Capture this job</button><div id="status"></div>
<script type="module" src="/src/popup.ts"></script></body></html>
```

`apps/extension/src/popup.ts`:
```ts
import { send } from "./lib/importClient";

const statusEl = document.getElementById("status")!;
const btn = document.getElementById("capture") as HTMLButtonElement;

btn.addEventListener("click", async () => {
  const { apiUrl, token } = await chrome.storage.sync.get(["apiUrl", "token"]);
  if (!apiUrl || !token) {
    statusEl.innerHTML = `Set your API URL and token in <a href="#" id="opt">Options</a>.`;
    document.getElementById("opt")?.addEventListener("click", () => chrome.runtime.openOptionsPage());
    return;
  }
  statusEl.textContent = "Capturing…";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) { statusEl.textContent = "No active tab."; return; }
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({ url: location.href, text: document.body.innerText }),
  });
  try {
    const r = await send(apiUrl as string, token as string, result as { url: string; text: string });
    statusEl.textContent = r.ok ? "Saved ✓ — it'll appear on your board." : `Couldn't save (status ${r.status}). Check your token.`;
  } catch {
    statusEl.textContent = "Couldn't reach the server.";
  }
});
```

- [ ] **Step 3: options.html + options.ts**

`apps/extension/options.html`:
```html
<!doctype html><html><head><meta charset="utf-8" />
<style>body{font-family:system-ui;max-width:420px;padding:20px;background:#fdf8f3;color:#42342a}
label{display:block;margin:10px 0 4px;font-size:13px}input{width:100%;padding:8px;border:1px solid #f0e3d4;border-radius:8px}
button{margin-top:12px;background:#d97706;color:#fff;border:0;border-radius:8px;padding:8px 14px;font-weight:600;cursor:pointer}
#msg{margin-top:8px;font-size:12px;color:#8a7763}</style></head>
<body><h3>What's Next — settings</h3>
<label>API URL</label><input id="apiUrl" placeholder="https://whats-next-api.your-subdomain.workers.dev" />
<label>API token</label><input id="token" placeholder="wn_…" />
<button id="save">Save</button><button id="test" style="background:#42342a">Test connection</button>
<div id="msg"></div>
<script type="module" src="/src/options.ts"></script></body></html>
```

`apps/extension/src/options.ts`:
```ts
const apiUrlEl = document.getElementById("apiUrl") as HTMLInputElement;
const tokenEl = document.getElementById("token") as HTMLInputElement;
const msg = document.getElementById("msg")!;

chrome.storage.sync.get(["apiUrl", "token"]).then(({ apiUrl, token }) => {
  if (apiUrl) apiUrlEl.value = apiUrl as string;
  if (token) tokenEl.value = token as string;
});

document.getElementById("save")!.addEventListener("click", async () => {
  await chrome.storage.sync.set({ apiUrl: apiUrlEl.value.trim(), token: tokenEl.value.trim() });
  msg.textContent = "Saved.";
});

document.getElementById("test")!.addEventListener("click", async () => {
  msg.textContent = "Testing…";
  try {
    const res = await fetch(`${apiUrlEl.value.trim().replace(/\/$/, "")}/api/jobs`, {
      headers: { Authorization: `Bearer ${tokenEl.value.trim()}` },
    });
    msg.textContent = res.ok ? "Connection OK ✓" : `Failed (status ${res.status}).`;
  } catch {
    msg.textContent = "Couldn't reach the server.";
  }
});
```

- [ ] **Step 4: Copy manifest into the build output**

Update `apps/extension/vite.config.ts` to copy `manifest.json` to `dist/` after build, using a tiny inline plugin:
```ts
import { defineConfig } from "vite";
import { resolve } from "node:path";
import { copyFileSync } from "node:fs";

export default defineConfig({
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        options: resolve(__dirname, "options.html"),
      },
    },
  },
  plugins: [{
    name: "copy-manifest",
    closeBundle() { copyFileSync(resolve(__dirname, "manifest.json"), resolve(__dirname, "dist/manifest.json")); },
  }],
  test: { environment: "node", globals: true },
});
```

- [ ] **Step 5: Build + typecheck**

Run: `pnpm --filter @whats-next/extension build && pnpm --filter @whats-next/extension typecheck`
Expected: `dist/` contains `popup.html`, `options.html`, bundled JS, and `manifest.json`; typecheck passes.

- [ ] **Step 6: Commit**

```bash
git add apps/extension
git commit -m "feat(extension): MV3 manifest, popup, options"
```

---

# Milestone 6 — Verify & ship

## Task 9: Full verification + migration + manual

**Files:** none (verification / ops)

- [ ] **Step 1: Whole-workspace test + typecheck**

Run: `pnpm -r test && pnpm -r typecheck`
Expected: shared + api + web + extension all green.

- [ ] **Step 2: Apply the migration (local, then remote)**

Run:
```bash
pnpm --filter @whats-next/api run migrate:local
cd apps/api && pnpm exec wrangler d1 migrations apply whats-next-db --remote   # account id exported
```
Expected: `0003_api_tokens.sql` applied (additive — no data loss).

- [ ] **Step 3: Deploy API + web**

```bash
pnpm --filter @whats-next/api run deploy
pnpm --filter @whats-next/web run deploy
```

- [ ] **Step 4: Load the extension + end-to-end check**

`chrome://extensions` → Developer mode → Load unpacked → select `apps/extension/dist`. Open the
extension Options, set the API URL (the deployed `whats-next-api…` URL) and a token generated
from the web app's Settings sheet; click **Test connection** → OK. Visit a real job posting,
click the toolbar action → **Capture this job** → "Saved ✓"; confirm the job appears on your
board (extracted via the paste path).

- [ ] **Step 5: Commit any fixups**

```bash
git add -A
git commit -m "chore(extension): build fixups"
```
(Skip if nothing changed.)

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** `api_tokens` migration (Task 1), token repo with hash-only storage (Task 2), `requireAuth` token-or-Clerk + `requireClerk` (Task 3), management routes Clerk-only + token-authorized import (Task 4), web client/hooks + SettingsSheet + Header button (Tasks 5–6), MV3 extension with tested `importClient` + chrome glue (Tasks 7–8), verify/migrate/deploy/manual (Task 9). No import/extraction change.
- **Auth split:** `/api/jobs` uses `requireAuth` (token or Clerk); `/api/tokens` uses `requireClerk` (session only) so a token can't mint more tokens. `requireAuth`'s `wn_` branch needs `c.env.DB`, which exists.
- **Type/name consistency:** `findUserByToken(db, hash)`/`tokenHash`/`createToken`/`listTokens`/`revokeToken` match between `tokens.ts` (Task 2), `auth.ts` (Task 3), and routes (Task 4). Web `listTokens/createToken/deleteToken` client methods match the hooks (Task 5) and SettingsSheet (Task 6). Extension `buildImportRequest`/`send` signatures match popup usage (Tasks 7–8).
- **Chrome glue untested:** `popup.ts`/`options.ts` use `chrome.*` and are verified manually (Task 9 Step 4); only `importClient` is unit-tested (Task 7).
- **Versions:** `@types/chrome@0.2.0` is a planning-time pin; if unavailable, use the latest `npm view @types/chrome version`. CORS needs no change — MV3 fetches with `host_permissions: <all_urls>` are not subject to page CORS.
- **Migration test:** Task 1 extends the existing table-list assertion; `applyD1Migrations` runs 0001→0003 in tests.
```
