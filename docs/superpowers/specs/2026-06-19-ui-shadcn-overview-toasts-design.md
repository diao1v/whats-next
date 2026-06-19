# UI v2 — shadcn/ui, Overview Strip, Toasts & Error Handling — Design Spec

**Date:** 2026-06-19
**Status:** Approved design, pending spec review

## 1. Purpose

Make the dashboard easier to scan and more robust: adopt **shadcn/ui** as the component
foundation (standardizing the hand-rolled Tailwind components), add an **overview stats
strip**, replace the bare "Importing…" wording with **toasts** (Sonner) for the import
lifecycle and edits, and add **comprehensive error handling** (optimistic mutations with
rollback + friendly error toasts). Frontend-only — no API/schema changes (delete-with-undo
is a client-side deferred delete).

## 2. Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Layout | Overview strip (stats row + refined capture bar above the board). |
| Component system | Adopt shadcn/ui; **full re-skin** of existing components. |
| Theme | Map the warm palette onto shadcn CSS variables — look unchanged. |
| Toasts | Import lifecycle, stage changes, delete (with Undo), subtle field saves. |
| Delete + Undo | **Deferred delete** (client-side timer); API delete fires after the toast window; Undo cancels it. No backend change. |
| In-progress import | Spinner/skeleton card instead of "Importing…" text; status via toast. |
| Error handling | Comprehensive: optimistic mutations + rollback + `onError` toasts; import-failed card + retry; catch-all for network/auth. |

## 3. shadcn/ui Foundation

- **Deps:** `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`,
  `sonner`, and the Radix primitives pulled in by the components used (e.g.
  `@radix-ui/react-select`, `-dialog`, `-toggle-group`, `-slot`). `lucide-react` already
  present.
- **Config:** `components.json`; a `cn()` helper at `apps/web/src/lib/utils.ts`; a `@/`
  path alias mapping to `apps/web/src` in both `vite.config.ts` (resolve.alias) and
  `tsconfig.json` (paths). `tailwindcss-animate` added to `tailwind.config.ts` plugins;
  `darkMode` left off (light only).
- **Theme:** shadcn's CSS-variable block in `index.css`, with values set to the warm
  palette so nothing visually changes:
  - `--background` = cream `#fdf8f3`, `--foreground` = ink `#42342a`
  - `--card`/`--popover` = paper `#fffdfb`
  - `--primary` = amber `#d97706` (primary-foreground near-white)
  - `--secondary`/`--muted` = sand `#f6ead9`, `--muted-foreground` = `#8a7763`
  - `--border`/`--input` = line `#f0e3d4`, `--ring` = amber
  - `--destructive` = red; `--radius` = 0.75rem
  - The existing `theme.extend.colors` tokens (page/paper/ink/…) are kept so non-migrated
    spots still compile; new/migrated components use shadcn tokens.

## 4. Component Re-skin

Each migrates to shadcn primitives, preserving behavior and (re-pointed) tests:

| Current | shadcn |
|---|---|
| `ImportBar` input/button | `Input` + `Button` |
| `ViewToggle` | `ToggleGroup` (single) |
| `StageSelect`, drawer/list selects | `Select` |
| `StageBadge` | `Badge` with warm per-stage variants (keeps `data-stage`) |
| `JobDetailDrawer` panel | `Sheet` (side on desktop, bottom on mobile) |
| Delete confirm | `AlertDialog` |
| Stat cards, (optionally job cards) | `Card` |
| Skeletons | shadcn `Skeleton` |
| — | `Sonner` `<Toaster />` mounted once near the app root |

Behavioral contracts (props, callbacks, `aria-label`s used by tests) are preserved so
the suite stays meaningful; assertions stay behavior-focused (roles/labels/text), not
markup-shape.

## 5. Overview Strip (Layout A)

- New **`StatsBar`** rendered above the capture bar (inside `App`, board *and* list views).
- Stats from a pure helper `computeStats(jobs)`:
  - **Tracked** = total jobs
  - **Active** = jobs whose stage ≠ `Rejected/Closed`
  - **Interviews** = stage ∈ {`Phone screen`, `Interview`}
  - **Due this week** = `next_action_at` within the next 7 days (from a passed-in `now`)
- Rendered as four shadcn `Card`s; responsive (4-up desktop, 2-up mobile).
- `computeStats(jobs, now)` takes `now` as a parameter (no `Date.now()` inside) for
  deterministic tests.

## 6. Toasts (Sonner)

`<Toaster richColors position="bottom-right" />` mounted once. A thin `lib/toast.ts`
wraps sonner so call sites and tests use one surface.

- **Import:** `useImportJob` triggers `toast.loading("Extracting job details…")`; the list
  poll that flips the entry to `ready` resolves it to `toast.success("Added — {title} at
  {company}")`, or `toast.error("Couldn't import that job")` on `failed`. The card shows a
  **spinner/skeleton** while `import_status === "importing"` (no "Importing…" text).
- **Stage change:** `toast.success("Moved to {stage}")` after a successful update.
- **Delete (deferred):** on delete, optimistically remove the entry from the query cache
  and show `toast("Job deleted", { action: Undo })`. A timer (~5s) fires the real
  `deleteEntry` API call; **Undo** cancels the timer and restores the cached entry. If the
  toast is dismissed/expires, the delete commits.
- **Field save:** `toast.success("Saved")` (short) on notes/date change success.

## 7. Error Handling

- **Optimistic mutations:** `useUpdateJob` updates the `["jobs"]` cache immediately;
  `onError` reverts to the snapshot and shows `toast.error("Couldn't save changes")`.
- **Import failure:** error toast + the existing card **failed state with Retry**
  (`useImportJob` with the job URL).
- **Catch-all:** the API client (`lib/api.ts`) throws typed errors; a shared handler maps
  network/5xx/401 to `toast.error("Couldn't reach the server")`. Query `onError` and the
  `QueryClient` default `onError` route through it.
- **needs_paste** stays a normal flow (paste box in the Sheet), not an error.

## 8. Module Boundaries

- `apps/web/src/lib/utils.ts` — `cn()`.
- `apps/web/src/lib/toast.ts` — typed wrappers over sonner (`notify.added`, `.moved`,
  `.deletedWithUndo`, `.saved`, `.error`).
- `apps/web/src/lib/stats.ts` — `computeStats(jobs, now)`.
- `apps/web/src/components/ui/*` — shadcn-generated primitives (button, input, select,
  badge, sheet, alert-dialog, card, toggle-group, skeleton, sonner).
- `apps/web/src/components/StatsBar.tsx` — overview strip.
- Existing components migrate in place; `useDeleteJob`/`useUpdateJob`/`useImportJob` gain
  optimistic + toast behavior; `App` wires deferred-delete + `<Toaster />`.

## 9. Testing (TDD)

- `computeStats` — counts for tracked/active/interviews/due-this-week with a fixed `now`.
- `StatsBar` — renders the four derived numbers.
- Deferred-delete — Undo cancels the API call; expiry commits it (fake timers).
- Optimistic update rollback — mutation `onError` restores prior cache + error toast.
- Toast calls — asserted via a mocked `sonner`/`lib/toast` (added/moved/deleted/saved/error).
- Migrated components — existing behavioral tests re-pointed to shadcn markup (roles,
  labels, text preserved): ImportBar, ViewToggle, StageSelect, StageBadge, JobList,
  JobBoard (desktop + mobile), JobDetailDrawer (delete via AlertDialog, retry), App
  (toggle, board/list, import).
- Mocks: `ResizeObserver`/`matchMedia`/`scrollIntoView` shims as needed for Radix in jsdom.

## 10. Out of Scope

Dark mode; backend/schema changes; soft-delete persistence (Undo is client-side deferred);
real-time/websocket updates; analytics charts beyond the four stat counts.
