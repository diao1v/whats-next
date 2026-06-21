# Collapsible-Lanes Board — Design Spec

**Date:** 2026-06-21
**Status:** Approved design, pending spec review

## 1. Purpose

Replace the board's horizontal-scroll 6-column kanban (and the separate mobile accordion)
with a single **stacked collapsible-lanes** view that shows the whole pipeline without a
horizontal scrollbar. Frontend-only; no API/schema change.

## 2. Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Layout | Stacked lanes — one full-width row per stage, top to bottom. |
| Cards | Inside an open lane, cards lay out in a `flex-wrap` row (wrap, no horizontal scroll). |
| One view | The lanes layout serves both desktop and mobile; the standalone `MobileBoard` accordion is removed. |
| Collapse | Each lane collapsible. Default open = explicit choice, else "open if the stage has jobs". |
| Controls | Expand all / Collapse all at the board's top-right. |
| Persistence | Per-stage lane state persisted in `useUiStore` (localStorage), alongside `view`. |
| Drag-and-drop | Kept on desktop (cross-lane = stage change); static cards on mobile. |

## 3. Layout

- `JobBoard` renders the 6 `STAGES` as vertical lanes (full width, stacked).
- **Lane header:** a button row with a chevron (rotated when open), the stage name, and a
  count pill. Clicking toggles the lane.
- **Lane body (when open):** cards in `flex flex-wrap gap-2`. Cards keep a sensible
  min/!fixed width on desktop so several sit per row; on narrow screens they wrap to one
  per row. Empty open lanes show a faint "Nothing here yet." line.
- The board is wrapped in a single `DndContext`; each lane body is a droppable keyed by its
  stage.

## 4. Collapse State & Controls

- `useUiStore` gains:
  - `laneState: Record<string, boolean>` — only holds stages the user has explicitly toggled
    (`true` = open).
  - `toggleLane(stage)` — flips that stage's explicit state.
  - `setAllLanes(open: boolean)` — sets an explicit state for all `STAGES`.
- **Effective open** for a lane = `laneState[stage] ?? (count > 0)`. So empty stages start
  collapsed and non-empty start open, until the user toggles; explicit choices win and
  survive count changes.
- Persistence: `persist` `partialize` is widened to `{ view, laneState }` (key
  `whats-next-ui`). `selectedJobId` remains non-persisted.
- **Expand all / Collapse all**: a small control at the board's top-right calling
  `setAllLanes(true)` / `setAllLanes(false)` (lucide chevron icons).

## 5. Drag-and-Drop

- Retained on desktop via the existing split: `JobCard` (wraps `useDraggable`) for desktop,
  `JobCardBody` (static) for mobile, chosen by `useIsMobile`.
- `onDragEnd` reuses the pure `stageFromDrop(currentStage, overId)` helper (unchanged) and
  calls `onStageChange(id, stage)`.
- Each lane body is `useDroppable({ id: stage })`; dropping a card on a different lane
  changes its stage. On mobile, cards are static so dragging is inert (touch scroll
  preserved).

## 6. Removed

- The desktop `overflow-x-auto` 6-column layout.
- The standalone `MobileBoard` accordion (its behavior is now the shared lanes view).
- `JobBoard`'s `loading` skeleton keeps working (skeleton lanes).

## 7. Module Boundaries

- `apps/web/src/store/ui.ts` — add `laneState`, `toggleLane`, `setAllLanes`; widen persist.
- `apps/web/src/components/JobBoard.tsx` — rewritten as the lanes view (lane header +
  wrap body + dnd + expand/collapse-all). Reuses `JobCard`/`JobCardBody`, `stageFromDrop`,
  `useIsMobile`, `SkeletonCard`.
- No changes to `App`, `JobList`, drawer, stats, toasts, or any backend.

## 8. Testing (TDD)

- **ui store:** `toggleLane` flips and persists; `setAllLanes(true/false)` sets all stages;
  `laneState` persisted, `selectedJobId` not.
- **JobBoard:**
  - renders all 6 stage lanes with correct count pills;
  - a non-empty stage's cards are visible by default; an empty stage is collapsed by default;
  - clicking a lane header toggles its cards' visibility;
  - Collapse all hides all cards; Expand all shows them;
  - loading shows skeletons;
  - cards open the drawer (`onSelect`) and inline stage change calls `onStageChange`.
- **stageFromDrop:** unchanged (existing tests stay).
- Existing column/accordion-specific `JobBoard` assertions are rewritten for lanes; the
  drag *gesture* remains covered only by `stageFromDrop` + the inline-stage path (jsdom
  limitation).

## 9. Out of Scope

Within-lane card ordering/sort; per-lane filtering; backend/schema changes; List view and
all other UI (unchanged).
