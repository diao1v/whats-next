# Collapsible-Lanes Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the horizontal-scroll column board (and the separate mobile accordion) with one stacked collapsible-lanes view that shows the whole pipeline without horizontal scrolling.

**Architecture:** `useUiStore` gains a persisted per-stage `laneState` plus `toggleLane`/`setAllLanes`. `JobBoard` is rewritten to render the 6 stages as stacked lanes (header + count + chevron; open body lays cards out with `flex-wrap`), reusing the existing `JobCard`/`JobCardBody` split, `stageFromDrop`, `useIsMobile`, and `DndContext`. Effective open = explicit choice, else "open if the stage has jobs". Frontend-only.

**Tech Stack:** React 18, Zustand (+persist), @dnd-kit/core, lucide-react, Tailwind, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-21-board-lanes-design.md`

---

## File Structure

```
apps/web/src/
  store/ui.ts            # + laneState, toggleLane, setAllLanes (persisted)
  store/ui.test.ts       # + lane state tests
  components/JobBoard.tsx       # rewritten as stacked collapsible lanes
  components/JobBoard.test.tsx  # rewritten for the lanes structure
```

---

## Task 1: UI store — persisted lane state

**Files:**
- Modify: `apps/web/src/store/ui.ts`
- Test: `apps/web/src/store/ui.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `apps/web/src/store/ui.test.ts` inside the `describe("useUiStore", ...)` block:
```ts
  it("toggleLane records the opposite of the passed state and persists", () => {
    useUiStore.setState({ laneState: {} });
    useUiStore.getState().toggleLane("Saved", true);
    expect(useUiStore.getState().laneState["Saved"]).toBe(false);
    useUiStore.getState().toggleLane("Saved", false);
    expect(useUiStore.getState().laneState["Saved"]).toBe(true);
    expect(localStorage.getItem("whats-next-ui")).toContain("laneState");
  });

  it("setAllLanes sets every stage to the same state", () => {
    useUiStore.getState().setAllLanes(false);
    const ls = useUiStore.getState().laneState;
    expect(Object.keys(ls)).toContain("Offer");
    expect(Object.values(ls).every((v) => v === false)).toBe(true);
  });
```
Also reset `laneState` in the existing `beforeEach` so tests don't bleed: change the `useUiStore.setState(...)` line in `beforeEach` to:
```ts
    useUiStore.setState({ view: "board", selectedJobId: null, laneState: {} });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @whats-next/web test ui.test`
Expected: FAIL — `toggleLane`/`setAllLanes`/`laneState` don't exist.

- [ ] **Step 3: Implement**

Replace `apps/web/src/store/ui.ts` with:
```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STAGES } from "@whats-next/shared";

interface UiState {
  view: "list" | "board";
  selectedJobId: string | null;
  laneState: Record<string, boolean>;
  setView: (v: "list" | "board") => void;
  selectJob: (id: string | null) => void;
  toggleLane: (stage: string, currentlyOpen: boolean) => void;
  setAllLanes: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      view: "board",
      selectedJobId: null,
      laneState: {},
      setView: (view) => set({ view }),
      selectJob: (selectedJobId) => set({ selectedJobId }),
      toggleLane: (stage, currentlyOpen) =>
        set((s) => ({ laneState: { ...s.laneState, [stage]: !currentlyOpen } })),
      setAllLanes: (open) =>
        set(() => ({ laneState: Object.fromEntries(STAGES.map((s) => [s, open])) })),
    }),
    { name: "whats-next-ui", partialize: (s) => ({ view: s.view, laneState: s.laneState }) }
  )
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @whats-next/web test ui.test`
Expected: PASS (all ui store tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/store/ui.ts apps/web/src/store/ui.test.ts
git commit -m "feat(web): persisted lane state in UI store"
```

---

## Task 2: Rewrite JobBoard as collapsible lanes

**Files:**
- Modify: `apps/web/src/components/JobBoard.tsx`, `apps/web/src/components/JobBoard.test.tsx`

- [ ] **Step 1: Rewrite the board test**

Replace `apps/web/src/components/JobBoard.test.tsx` with:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { JobBoard } from "./JobBoard";
import { useUiStore } from "../store/ui";
import type { Job } from "@whats-next/shared";

const j = (over: Partial<Job>): Job => ({
  id: "j1", user_id: "u", company_name: "Acme", is_agency: false, agency_name: null,
  job_title: "Backend Eng", role: "R", level: null, salary_min: null, salary_max: null, salary_currency: null,
  salary_period: null, salary_raw_text: null, location: null, is_remote: false, deadline: null, url: "u",
  apply_url: null, source_site: null, snapshot: null, description: null, raw_content_key: null,
  source_method: "fetch", extraction_model: null, stage: "Saved", import_status: "ready",
  applied_date: null, next_action_at: null, notes: "", created_at: "", updated_at: "", skills: [], ...over,
});

const props = (jobs: Job[], loading = false) => ({
  jobs, loading, onSelect: vi.fn(), onStageChange: vi.fn(), onRetry: vi.fn(),
});

beforeEach(() => { localStorage.clear(); useUiStore.setState({ laneState: {} }); });

describe("JobBoard lanes", () => {
  it("renders a lane header for every stage", () => {
    render(<JobBoard {...props([j({})])} />);
    for (const stage of ["Saved", "Applied", "Phone screen", "Interview", "Offer", "Rejected/Closed"]) {
      expect(screen.getByRole("button", { name: new RegExp(stage.replace("/", "\\/")) })).toBeInTheDocument();
    }
  });

  it("opens non-empty lanes and collapses empty ones by default", () => {
    render(<JobBoard {...props([j({ id: "a", stage: "Saved" })])} />);
    expect(screen.getByText("Backend Eng")).toBeInTheDocument();       // Saved open
    expect(screen.queryByText(/nothing here yet/i)).not.toBeInTheDocument(); // empty lanes collapsed
  });

  it("toggling a lane header hides its cards", () => {
    render(<JobBoard {...props([j({ stage: "Saved" })])} />);
    fireEvent.click(screen.getByRole("button", { name: /Saved/ }));
    expect(screen.queryByText("Backend Eng")).not.toBeInTheDocument();
  });

  it("Collapse all hides cards; Expand all shows them", () => {
    render(<JobBoard {...props([j({ stage: "Saved" })])} />);
    fireEvent.click(screen.getByRole("button", { name: /collapse all/i }));
    expect(screen.queryByText("Backend Eng")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /expand all/i }));
    expect(screen.getByText("Backend Eng")).toBeInTheDocument();
  });

  it("clicking a card calls onSelect", () => {
    const p = props([j({ id: "z", stage: "Saved" })]);
    render(<JobBoard {...p} />);
    fireEvent.click(screen.getByText("Backend Eng"));
    expect(p.onSelect).toHaveBeenCalledWith("z");
  });

  it("renders skeletons while loading", () => {
    const { container } = render(<JobBoard {...props([], true)} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @whats-next/web test JobBoard`
Expected: FAIL — current board has columns/accordion and no Expand/Collapse-all controls.

- [ ] **Step 3: Rewrite `apps/web/src/components/JobBoard.tsx`**

```tsx
import { DndContext, PointerSensor, useSensor, useSensors, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { ChevronDown, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { STAGES, type Job, type Stage } from "@whats-next/shared";
import { JobCard } from "./JobCard";
import { JobCardBody } from "./JobCardBody";
import { SkeletonCard } from "./Skeleton";
import { stageFromDrop } from "../lib/board";
import { useIsMobile } from "../lib/useIsMobile";
import { useUiStore } from "../store/ui";

interface BoardProps {
  jobs: Job[];
  loading: boolean;
  onSelect: (id: string) => void;
  onStageChange: (id: string, stage: Stage) => void;
  onRetry: (id: string) => void;
}

function CountPill({ n }: { n: number }) {
  return <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-semibold text-muted-foreground">{n}</span>;
}

function Lane({
  stage, jobs, open, isMobile, onToggle, onSelect, onStageChange, onRetry,
}: {
  stage: Stage; jobs: Job[]; open: boolean; isMobile: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onStageChange: (id: string, stage: Stage) => void;
  onRetry: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section ref={setNodeRef}
      className={`overflow-hidden rounded-2xl border border-line bg-[#faf1e6] ${isOver ? "ring-2 ring-primary/40" : ""}`}>
      <button type="button" onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left">
        <span className="flex items-center gap-2 text-sm font-bold text-ink">
          <ChevronDown size={16} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
          {stage}
        </span>
        <CountPill n={jobs.length} />
      </button>
      {open && (
        <div className="flex flex-wrap gap-2 p-2 pt-0">
          {jobs.length === 0
            ? <p className="px-1 pb-2 text-xs text-muted-foreground">Nothing here yet.</p>
            : jobs.map((job) => (
                <div key={job.id} className={isMobile ? "w-full" : "w-60"}>
                  {isMobile
                    ? <JobCardBody job={job} onSelect={onSelect} onStageChange={onStageChange} onRetry={onRetry} />
                    : <JobCard job={job} onSelect={onSelect} onStageChange={onStageChange} onRetry={onRetry} />}
                </div>
              ))}
        </div>
      )}
    </section>
  );
}

export function JobBoard({ jobs, loading, onSelect, onStageChange, onRetry }: BoardProps) {
  const isMobile = useIsMobile();
  const laneState = useUiStore((s) => s.laneState);
  const toggleLane = useUiStore((s) => s.toggleLane);
  const setAllLanes = useUiStore((s) => s.setAllLanes);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  if (loading) {
    return (
      <div className="space-y-2">
        {STAGES.slice(0, 3).map((s) => (
          <section key={s} className="rounded-2xl border border-line bg-[#faf1e6] p-2">
            <h2 className="mb-2 px-1 text-sm font-bold text-ink">{s}</h2>
            <SkeletonCard />
          </section>
        ))}
      </div>
    );
  }

  function onDragEnd(e: DragEndEvent) {
    const job = jobs.find((x) => x.id === e.active.id);
    if (!job) return;
    const next = stageFromDrop(job.stage, e.over ? String(e.over.id) : null);
    if (next) onStageChange(job.id, next);
  }

  const isOpen = (stage: Stage, count: number) => laneState[stage] ?? count > 0;

  return (
    <div>
      <div className="mb-2 flex justify-end gap-3 text-xs text-muted-foreground">
        <button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={() => setAllLanes(true)}>
          <ChevronsUpDown size={14} /> Expand all
        </button>
        <button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={() => setAllLanes(false)}>
          <ChevronsDownUp size={14} /> Collapse all
        </button>
      </div>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="space-y-2">
          {STAGES.map((stage) => {
            const items = jobs.filter((jb) => jb.stage === stage);
            const open = isOpen(stage, items.length);
            return (
              <Lane key={stage} stage={stage} jobs={items} open={open} isMobile={isMobile}
                onToggle={() => toggleLane(stage, open)}
                onSelect={onSelect} onStageChange={onStageChange} onRetry={onRetry} />
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @whats-next/web test JobBoard`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/JobBoard.tsx apps/web/src/components/JobBoard.test.tsx
git commit -m "feat(web): collapsible-lanes board (no horizontal scroll)"
```

---

## Task 3: Verify

**Files:** none (verification)

- [ ] **Step 1: Full web suite + typecheck + build**

Run: `pnpm --filter @whats-next/web test && pnpm --filter @whats-next/web typecheck && pnpm --filter @whats-next/web build`
Expected: all green. The App test renders the board and asserts a `/Saved/` heading-or-button — update it if needed: the lane header is now a `button` (name `/Saved/`) rather than a heading. If `App.test.tsx` used `getByRole("heading", { name: /Saved/ })`, change it to `getByRole("button", { name: /Saved/ })`.

- [ ] **Step 2: Whole-workspace check**

Run: `pnpm -r test && pnpm -r typecheck`
Expected: shared + api + web all green.

- [ ] **Step 3: Manual smoke (local dev)**

Run `pnpm --filter @whats-next/web dev`. Verify: no horizontal scrollbar at any width; all 6 stage lanes stacked; empty stages collapsed, non-empty open; clicking a header toggles; Expand all / Collapse all work and the choice survives a reload; on desktop dragging a card to another lane changes its stage; on a phone width cards are full-width and the layout is unchanged in shape.

- [ ] **Step 4: Commit any fixups**

```bash
git add -A
git commit -m "fix(web): board lanes fixups"
```
(Skip if nothing changed.)

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** stacked lanes + flex-wrap (Task 2), one view for desktop+mobile with `MobileBoard` removed (Task 2 rewrite), collapse with `laneState[stage] ?? count>0` (Tasks 1–2), Expand/Collapse-all (Task 2), persistence widened to `{view, laneState}` (Task 1), drag-and-drop via `stageFromDrop` + `JobCard`/`JobCardBody`/`useIsMobile` (Task 2), skeleton loading (Task 2), no API change.
- **Type/name consistency:** `toggleLane(stage, currentlyOpen)` and `setAllLanes(open)` match between store (Task 1) and board (Task 2). `isOpen(stage, count)` mirrors the spec's effective-open rule. `onSelect/onStageChange/onRetry` props unchanged from the current `JobBoard`, so `App` needs no change except the possible test-only heading→button tweak (Task 3 Step 1).
- **App test:** the board no longer renders an `<h2>` heading per stage; lane headers are buttons. Task 3 Step 1 covers updating `App.test.tsx` if it queried a heading.
- **Drag gesture:** still only unit-tested via `stageFromDrop`; the lane droppable + onDragEnd wiring is exercised manually (Task 3 Step 3).
- **lucide icons:** `ChevronsUpDown`/`ChevronsDownUp` exist in lucide-react; if a name mismatches at build, substitute `ChevronDown`/`ChevronUp`.
```
