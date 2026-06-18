# UI Polish — Design Spec

**Date:** 2026-06-19
**Status:** Approved design, pending spec review

## 1. Purpose

Make What's Next pleasant to use every day: a cohesive warm visual identity, a real
signed-out landing, two complementary views (kanban overview + scannable list), and the
interaction polish that makes it feel finished — drag-and-drop, inline stage changes,
loading/empty/failed states, delete, sort/filter, and a responsive mobile layout. The
backend is untouched; this is a frontend-only pass in `apps/web`.

## 2. Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Visual direction | Warm & Friendly — cream surfaces, soft shadows, amber accent. |
| Views | Board (kanban, progress overview) + List (compact table); header toggle. |
| Toggle persistence | `useUiStore.view`, persisted to localStorage (zustand `persist`). |
| Signed-out screen | Split landing: value prop + "Continue with Google" (Clerk). |
| Drag-and-drop | Board cards draggable between stage columns (`@dnd-kit/core`). |
| Inline stage change | `StageSelect` dropdown on board cards and list rows. |
| Loading / empty | Skeletons while loading; friendly empty states (global + per-column). |
| Delete | Delete action in the drawer with confirm (existing `useDeleteJob`). |
| Failed import | "Import failed" badge + Retry (re-POST import for the entry's URL). |
| List sort/filter | Client-side: sort by next-action/updated/created; filter by stage. |
| Responsive | Board horizontally scrolls on narrow screens; drawer becomes a full-width sheet; header/list adapt. |
| Icons | `lucide-react`. |

## 3. Visual System

Extend `tailwind.config.ts` `theme.extend` with semantic tokens so the palette is reused,
not sprinkled as arbitrary values:

- **Surfaces:** `page` `#fdf8f3`, `paper` `#fffdfb`, `line` (border) `#f0e3d4`.
- **Text:** `ink` `#42342a`, `muted` `#8a7763`.
- **Accent:** `accent` `#d97706`, `accent-deep` `#b45309`.
- **Shadow:** a soft amber-tinted `boxShadow.card` token.
- **Radius:** cards 12–14px, controls 10px, pills 999px.

**Stage colors** live in one map keyed by the `STAGES` enum (`@whats-next/shared`), consumed
by `StageBadge` everywhere:

| Stage | Treatment |
|---|---|
| Saved | sand (`#f6ead9` bg / `#7c5e3b` text) |
| Applied | amber (`#fef3c7` / `#b45309`) |
| Phone screen | blue (`#dbeafe` / `#1d4ed8`) |
| Interview | lime (`#ecfccb` / `#3f6212`) |
| Offer | green (`#dcfce7` / `#15803d`) |
| Rejected/Closed | muted (`#f1f5f9` / `#64748b`) |

## 4. Components

New and restyled, each with one responsibility:

- **`SignInLanding`** — split landing (value prop left, sign-in right). Replaces the bare
  `SignInButton` in `main.tsx`'s `<SignedOut>`.
- **`AppShell` / `Header`** — logo + title, `ViewToggle`, Clerk `<UserButton>`.
- **`ViewToggle`** — segmented Board | List control (lucide icons); reads/writes
  `useUiStore.view`.
- **`StageBadge`** — stage → colored pill (from the §3 map).
- **`StageSelect`** — inline dropdown to change a job's stage; calls `onChange(stage)`.
- **`JobBoard`** (restyle) — warm columns; draggable cards (`@dnd-kit/core`); per-column
  empty states; skeleton cards; card shows title, company/agency, salary (`formatSalary`),
  `StageBadge`, next-action; click opens drawer, drag moves stage.
- **`JobCard`** — extracted board card (draggable, with `StageSelect`).
- **`JobList`** (new) — compact table (Role/Company · Salary · Stage · Next action ·
  Updated); `StageSelect` inline; row click opens drawer; skeleton rows; empty state; sort
  + stage-filter controls.
- **`JobDetailDrawer`** (restyle) — warm sheet; `StageBadge`/`StageSelect`; salary; delete
  button + confirm; failed-state Retry; lucide icons. Full-width sheet on mobile.
- **`ImportBar`** (restyle) — warm input + button, lucide icon, loading affordance.
- **`EmptyState`** and **skeleton** primitives — shared.

## 5. Interactions

- **Drag-and-drop (board):** `@dnd-kit/core` `DndContext`; columns are droppables, cards are
  draggables. On drop over a different stage, call `useUpdateJob` with `{ stage }`
  (optimistic — card moves immediately). A pure helper `stageFromDrop(active, over)` maps a
  drop event to the target stage (unit-tested independently of the gesture). Cards use a
  small activation delay/handle so click-to-open-drawer still works.
- **Inline stage change:** `StageSelect` on card and row calls the same `useUpdateJob`
  mutation. Single tested mutation path shared with drag-drop.
- **Delete:** drawer delete button → inline confirm ("Delete this job?") → `useDeleteJob`,
  close drawer, optimistic list removal.
- **Failed import + retry:** when `import_status === "failed"`, the card/row/drawer show an
  "Import failed" badge and a **Retry** button calling `useImportJob` with the job's `url`
  (the API's re-import fast path re-runs extraction on the existing entry).
- **Loading:** while `useJobs` is loading, render skeletons (board columns of skeleton
  cards; list of skeleton rows).
- **Empty:** no jobs → friendly `EmptyState` ("No jobs yet — paste a URL above to start").
  Board shows light per-column placeholders.

## 6. Views, Sort & Filter

- **Toggle** persisted via zustand `persist` (localStorage key `whats-next-ui`).
- **List sort:** by next-action (soonest first), last-updated, or date-added; default
  last-updated. **List filter:** by stage (all / specific). Both **client-side** over the
  list already fetched by `useJobs` — no API change. A small `useJobView` selector or
  in-component `useMemo` derives the sorted/filtered array.
- **Board** is unaffected by sort/filter (it groups by stage by definition).

## 7. Data Flow

No API or schema changes. All actions reuse existing hooks (`useJobs`, `useImportJob`,
`useUpdateJob`, `useDeleteJob`) and the flat `Job` DTO. Retry and drag/inline-stage are
just existing mutations triggered from new UI. Sort/filter is pure client-side derivation.

## 8. Responsive

- **Header:** title + toggle wrap; `UserButton` stays right.
- **Board:** columns become a horizontal-scroll row on narrow screens (fixed-width columns,
  `overflow-x-auto`); no squishing.
- **List:** the compact table collapses secondary columns on small widths (keep Role/Company
  + Stage; salary/next-action/updated hide under a breakpoint) so rows stay readable.
- **Drawer:** full-width bottom/right sheet on mobile instead of a fixed 28rem panel.

## 9. Tech Additions

Exact-pinned (supply-chain rule), versions confirmed at install time:

- `@dnd-kit/core` — accessible drag-and-drop.
- `lucide-react` — icons.
- zustand `persist` middleware (already in `zustand`, no new dep).

## 10. Testing (TDD)

Component/unit tests (Vitest + Testing Library), no backend changes:

- `StageBadge` — correct label/treatment per stage.
- `StageSelect` — renders stages, fires `onChange` with the chosen stage.
- `stageFromDrop()` — pure helper maps drop events to target stage (covers the drag path
  without simulating the gesture, which is impractical in jsdom).
- `ViewToggle` — switches `useUiStore.view`; persistence smoke test.
- `JobList` — renders rows from jobs; inline stage change calls update; row click opens
  drawer; sort/filter derive the expected order/subset; empty + skeleton states.
- `JobBoard` — groups jobs by stage; renders skeletons when loading; per-column empties;
  inline `StageSelect` triggers update.
- `JobDetailDrawer` — delete confirm → `useDeleteJob`; failed state shows Retry → import;
  salary + description render (existing tests retained).
- `SignInLanding` — renders value prop + sign-in trigger.
- `App` — toggling view swaps Board/List; existing composition test updated.

## 11. Out of Scope

Dark mode; toast notifications; per-column drag *ordering* within a stage (only cross-stage
moves change data); any backend/schema change.
