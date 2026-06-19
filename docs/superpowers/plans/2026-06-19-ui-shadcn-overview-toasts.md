# UI v2 — shadcn/ui, Overview, Toasts & Errors — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt shadcn/ui (warm-themed), add an overview stats strip, replace "Importing…" with Sonner toasts for the import lifecycle and edits, and add comprehensive error handling with optimistic updates + rollback.

**Architecture:** Frontend-only in `apps/web`. shadcn primitives are generated into `src/components/ui/*` via the CLI and themed through CSS variables mapped to the existing warm palette. Existing components migrate to those primitives, preserving behavioral test contracts. Toasts/errors flow through a thin `lib/toast.ts` and optimistic TanStack mutations. Delete-with-Undo is a client-side deferred delete (no backend change).

**Tech Stack:** React 18, Vite, Tailwind 3, shadcn/ui, Radix, `sonner`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`, TanStack Query, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-19-ui-shadcn-overview-toasts-design.md`

---

## File Structure

```
apps/web/
  components.json                    # shadcn config
  vite.config.ts                     # @/ alias
  tsconfig.json                      # @/ paths
  tailwind.config.ts                 # + tailwindcss-animate
  src/
    index.css                        # + shadcn CSS variables (warm)
    test-setup.ts                    # + Radix/jsdom shims
    lib/
      utils.ts                       # cn()
      toast.ts                       # notify.* wrappers over sonner
      stats.ts                       # computeStats(jobs, now)
      queries.ts                     # optimistic mutations + onError
      api.ts                         # typed ApiError
    components/
      ui/*                           # generated shadcn primitives
      StatsBar.tsx                   # overview strip
      (existing components migrated to shadcn primitives)
    App.tsx                          # StatsBar, <Toaster/>, deferred delete, import toasts
    main.tsx                         # <Toaster/> can live here or App
```

---

# Milestone 1 — shadcn foundation

## Task 1: Path alias + deps + cn util

**Files:**
- Modify: `apps/web/vite.config.ts`, `apps/web/tsconfig.json`, `apps/web/package.json`
- Create: `apps/web/src/lib/utils.ts`, `apps/web/src/lib/utils.test.ts`

- [ ] **Step 1: Add deps**

In `apps/web/package.json` `dependencies`, add:
```json
    "class-variance-authority": "0.7.1",
    "clsx": "2.1.1",
    "tailwind-merge": "3.6.0",
    "sonner": "2.0.7",
    "@radix-ui/react-slot": "1.3.0",
    "@radix-ui/react-select": "2.3.1",
    "@radix-ui/react-dialog": "1.1.17",
    "@radix-ui/react-toggle-group": "1.1.13",
```
In `devDependencies` add:
```json
    "tailwindcss-animate": "1.0.7",
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: resolves cleanly.

- [ ] **Step 3: Add the `@/` alias**

`apps/web/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "jsdom", globals: true, setupFiles: ["./src/test-setup.ts"] },
});
```

`apps/web/tsconfig.json` — add `baseUrl` + `paths`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals", "@testing-library/jest-dom"],
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Write the failing test for `cn`**

`apps/web/src/lib/utils.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
  it("merges conflicting tailwind classes (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `pnpm --filter @whats-next/web test utils`
Expected: FAIL — `@/lib/utils` not found (alias + file).

- [ ] **Step 6: Implement `cn`**

`apps/web/src/lib/utils.ts`:
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --filter @whats-next/web test utils`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add apps/web/package.json apps/web/vite.config.ts apps/web/tsconfig.json apps/web/src/lib/utils.ts apps/web/src/lib/utils.test.ts pnpm-lock.yaml
git commit -m "chore(web): shadcn deps, @/ alias, cn util"
```

## Task 2: shadcn config, warm theme, animate plugin, test shims

**Files:**
- Create: `apps/web/components.json`
- Modify: `apps/web/tailwind.config.ts`, `apps/web/src/index.css`, `apps/web/src/test-setup.ts`

- [ ] **Step 1: Create `components.json`**

`apps/web/components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "stone",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui" },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 2: Add `tailwindcss-animate` + shadcn token colors to Tailwind**

Replace `apps/web/tailwind.config.ts` with:
```ts
import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // existing warm tokens (kept)
        page: "#fdf8f3", paper: "#fffdfb", line: "#f0e3d4", ink: "#42342a",
        muted: "#8a7763", accent: "#d97706", "accent-deep": "#b45309",
        // shadcn semantic tokens -> CSS variables
        border: "hsl(var(--border))", input: "hsl(var(--input))", ring: "hsl(var(--ring))",
        background: "hsl(var(--background))", foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        "muted-token": { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        accentui: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      boxShadow: { card: "0 2px 8px rgba(180,120,60,0.08)", sheet: "0 8px 30px rgba(120,80,40,0.18)" },
    },
  },
  plugins: [animate],
} satisfies Config;
```

> Note: `muted` already exists as a warm hex token, so the shadcn muted is exposed as `muted-token` and `accent` (warm hex) coexists with shadcn's `accentui`. Generated shadcn components reference `bg-muted`, `text-muted-foreground`, `bg-accent` — we override those usages during generation by keeping shadcn components on `--muted`/`--accent` via the `*-token`/`accentui` mapping is NOT automatic. To avoid confusion, generated components will be lightly adjusted (Task 3 note) OR we accept shadcn's classes resolve to our CSS vars. SIMPLER: see Step 3 — we define the CSS variables so shadcn's default class names (`bg-background`, `bg-primary`, `bg-card`, `text-muted-foreground`, `border-border`) resolve correctly; the warm hex tokens (`bg-page`, `text-ink`) remain for app components not yet migrated.

- [ ] **Step 3: Add the warm shadcn CSS variables**

Replace `apps/web/src/index.css` with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 30 60% 97%;          /* cream #fdf8f3 */
    --foreground: 25 24% 21%;          /* ink #42342a */
    --card: 36 60% 99%;                /* paper #fffdfb */
    --card-foreground: 25 24% 21%;
    --popover: 36 60% 99%;
    --popover-foreground: 25 24% 21%;
    --primary: 32 95% 44%;             /* amber #d97706 */
    --primary-foreground: 36 60% 99%;
    --secondary: 36 56% 90%;           /* sand #f6ead9 */
    --secondary-foreground: 28 35% 36%;
    --muted: 36 56% 90%;
    --muted-foreground: 27 18% 53%;    /* #8a7763 */
    --accent: 36 56% 90%;
    --accent-foreground: 25 24% 21%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 36 60% 99%;
    --border: 33 47% 88%;              /* line #f0e3d4 */
    --input: 33 47% 88%;
    --ring: 32 95% 44%;
    --radius: 0.75rem;
  }
}

body { background-color: hsl(var(--background)); color: hsl(var(--foreground)); }
```

- [ ] **Step 4: Add Radix/jsdom test shims**

Replace `apps/web/src/test-setup.ts` with:
```ts
import "@testing-library/jest-dom";

// Radix UI relies on browser APIs jsdom lacks.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }) as MediaQueryList;
}
class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
```

- [ ] **Step 5: Verify existing suite still passes (theme + shims are additive)**

Run: `pnpm --filter @whats-next/web test`
Expected: all existing tests still PASS (no behavior changed yet).

- [ ] **Step 6: Commit**

```bash
git add apps/web/components.json apps/web/tailwind.config.ts apps/web/src/index.css apps/web/src/test-setup.ts
git commit -m "chore(web): shadcn config, warm CSS-variable theme, test shims"
```

## Task 3: Generate shadcn primitives

**Files:**
- Create: `apps/web/src/components/ui/*` (generated)

- [ ] **Step 1: Generate the components via the CLI**

Run from `apps/web`:
```bash
pnpm dlx shadcn@latest add button input select badge sheet alert-dialog card toggle-group skeleton sonner --yes
```
Expected: files created under `src/components/ui/` (`button.tsx`, `input.tsx`, `select.tsx`, `badge.tsx`, `sheet.tsx`, `alert-dialog.tsx`, `card.tsx`, `toggle-group.tsx`, `skeleton.tsx`, `sonner.tsx`). If the CLI cannot run non-interactively in this environment, add components individually or copy the corresponding current source from ui.shadcn.com for each; they import from `@/lib/utils`.

- [ ] **Step 2: Typecheck + build**

Run: `pnpm --filter @whats-next/web typecheck && pnpm --filter @whats-next/web build`
Expected: compiles. (The `sonner.tsx` exports a `Toaster`; it may reference `next-themes` — if so, replace its body to drop the theme prop, keeping `export const Toaster = (props) => <Sonner richColors position="bottom-right" {...props} />`.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): generate shadcn ui primitives"
```

---

# Milestone 2 — Re-skin small components

## Task 4: StageBadge → Badge with stage variants

**Files:**
- Modify: `apps/web/src/components/StageBadge.tsx` (test unchanged: `StageBadge.test.tsx`)

- [ ] **Step 1: Confirm the existing test still defines the contract**

The existing `StageBadge.test.tsx` asserts the label text renders and the element has `data-stage`. Keep it.

- [ ] **Step 2: Reimplement on top of Badge**

`apps/web/src/components/StageBadge.tsx`:
```tsx
import type { Stage } from "@whats-next/shared";
import { Badge } from "@/components/ui/badge";
import { STAGE_STYLES } from "../lib/stages";

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <Badge data-stage={stage} variant="secondary" className={`border-transparent ${STAGE_STYLES[stage]}`}>
      {stage}
    </Badge>
  );
}
```

- [ ] **Step 3: Run test**

Run: `pnpm --filter @whats-next/web test StageBadge`
Expected: PASS (label + `data-stage`).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/StageBadge.tsx
git commit -m "feat(web): StageBadge on shadcn Badge"
```

## Task 5: StageSelect → shadcn Select

**Files:**
- Modify: `apps/web/src/components/StageSelect.tsx`, `apps/web/src/components/StageSelect.test.tsx`

- [ ] **Step 1: Update the test to the Select interaction**

Radix Select isn't a native `<select>`, so the test drives it via the trigger + option roles. Replace `StageSelect.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StageSelect } from "./StageSelect";

describe("StageSelect", () => {
  it("fires onChange with the chosen stage", async () => {
    const onChange = vi.fn();
    render(<StageSelect value="Saved" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/change stage/i));   // open
    fireEvent.click(await screen.findByRole("option", { name: "Applied" }));
    expect(onChange).toHaveBeenCalledWith("Applied");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @whats-next/web test StageSelect`
Expected: FAIL — still native select / role mismatch.

- [ ] **Step 3: Reimplement on shadcn Select**

`apps/web/src/components/StageSelect.tsx`:
```tsx
import { STAGES, type Stage } from "@whats-next/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function StageSelect({
  value, onChange, className,
}: {
  value: Stage | string;
  onChange: (stage: Stage) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Stage)}>
      <SelectTrigger aria-label="Change stage" className={`h-8 w-auto gap-1 text-xs ${className ?? ""}`}
        onClick={(e) => e.stopPropagation()}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STAGES.map((s) => <SelectItem key={s} value={s} onClick={(e) => e.stopPropagation()}>{s}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @whats-next/web test StageSelect`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/StageSelect.tsx apps/web/src/components/StageSelect.test.tsx
git commit -m "feat(web): StageSelect on shadcn Select"
```

## Task 6: ViewToggle → ToggleGroup

**Files:**
- Modify: `apps/web/src/components/ViewToggle.tsx` (test unchanged)

- [ ] **Step 1: Reimplement on ToggleGroup (keep button roles/labels the test asserts)**

`apps/web/src/components/ViewToggle.tsx`:
```tsx
import { LayoutGrid, List } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useUiStore } from "../store/ui";

export function ViewToggle() {
  const view = useUiStore((s) => s.view);
  const setView = useUiStore((s) => s.setView);
  return (
    <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as "board" | "list")}>
      <ToggleGroupItem value="board" aria-label="Board view" className="gap-1.5 text-xs"><LayoutGrid size={14} /> Board</ToggleGroupItem>
      <ToggleGroupItem value="list" aria-label="List view" className="gap-1.5 text-xs"><List size={14} /> List</ToggleGroupItem>
    </ToggleGroup>
  );
}
```

- [ ] **Step 2: Run test**

Run: `pnpm --filter @whats-next/web test ViewToggle`
Expected: PASS — clicking the "List"/"Board" buttons updates the store (ToggleGroupItem renders as a button with the aria-label).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ViewToggle.tsx
git commit -m "feat(web): ViewToggle on shadcn ToggleGroup"
```

## Task 7: ImportBar → Input + Button

**Files:**
- Modify: `apps/web/src/components/ImportBar.tsx` (test unchanged)

- [ ] **Step 1: Reimplement (preserve placeholder + Add/Adding labels the test asserts)**

`apps/web/src/components/ImportBar.tsx`:
```tsx
import { useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ImportBar({ onImport, pending }: { onImport: (url: string) => void; pending: boolean }) {
  const [url, setUrl] = useState("");
  return (
    <form className="flex gap-2"
      onSubmit={(e) => { e.preventDefault(); if (url.trim()) { onImport(url.trim()); setUrl(""); } }}>
      <Input placeholder="Paste a job URL…" value={url} onChange={(e) => setUrl(e.target.value)} className="flex-1" />
      <Button type="submit" disabled={pending} className="gap-1.5">
        <Plus size={16} /> {pending ? "Adding…" : "Add"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Run test**

Run: `pnpm --filter @whats-next/web test ImportBar`
Expected: PASS (placeholder + Add/Adding + onImport).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ImportBar.tsx
git commit -m "feat(web): ImportBar on shadcn Input/Button"
```

---

# Milestone 3 — Re-skin containers

## Task 8: JobDetailDrawer → Sheet + AlertDialog

**Files:**
- Modify: `apps/web/src/components/JobDetailDrawer.tsx`, `apps/web/src/components/JobDetailDrawer.test.tsx`

- [ ] **Step 1: Update the test for Sheet/AlertDialog roles**

The drawer becomes a `Sheet` (always open while a job is selected — the parent controls mount) and delete uses `AlertDialog`. Update `JobDetailDrawer.test.tsx` so the delete test opens the dialog then confirms:
```tsx
  it("deletes after confirm", async () => {
    const onDelete = vi.fn();
    render(<JobDetailDrawer job={baseJob} onUpdate={vi.fn()} onClose={vi.fn()} onPaste={vi.fn()} onDelete={onDelete} onRetry={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /confirm delete/i }));
    expect(onDelete).toHaveBeenCalledWith("j1");
  });
```
Keep the other tests (stage change, paste box, description, salary, retry); the stage `<select>` becomes a shadcn Select, so update the stage test to open + pick like Task 5:
```tsx
  it("changing stage calls onUpdate", async () => {
    const onUpdate = vi.fn();
    render(<JobDetailDrawer job={baseJob} onUpdate={onUpdate} onClose={vi.fn()} onPaste={vi.fn()} onDelete={vi.fn()} onRetry={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(/change stage/i));
    fireEvent.click(await screen.findByRole("option", { name: "Applied" }));
    expect(onUpdate).toHaveBeenCalledWith({ stage: "Applied" });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @whats-next/web test JobDetailDrawer`
Expected: FAIL — markup not migrated.

- [ ] **Step 3: Reimplement the drawer**

`apps/web/src/components/JobDetailDrawer.tsx`:
```tsx
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { STAGES, formatSalary, type Job, type JobUpdate } from "@whats-next/shared";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StageBadge } from "./StageBadge";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";

export function JobDetailDrawer({
  job, onUpdate, onClose, onPaste, onDelete, onRetry,
}: {
  job: Job;
  onUpdate: (patch: JobUpdate) => void;
  onClose: () => void;
  onPaste: (text: string) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const [paste, setPaste] = useState("");
  const salary = formatSalary(job);

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{job.job_title || "Untitled"}</SheetTitle>
        </SheetHeader>
        <p className="text-sm text-muted-foreground">{job.company_name}{job.is_agency && job.agency_name ? ` (via ${job.agency_name})` : ""}</p>
        {salary && <p className="mt-1 text-sm font-medium">{salary}</p>}
        <div className="mt-2"><StageBadge stage={job.stage as never} /></div>

        {job.import_status === "failed" && (
          <div className="my-3 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <span className="text-sm font-semibold text-destructive">Import failed</span>
            <Button size="sm" onClick={() => onRetry(job.id)}>Retry</Button>
          </div>
        )}

        {job.import_status === "needs_paste" && (
          <div className="my-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm">This page couldn't be read automatically. Paste the job description:</p>
            <textarea className="mt-2 w-full rounded border border-input p-2 text-sm" placeholder="Paste the job description…"
              value={paste} onChange={(e) => setPaste(e.target.value)} />
            <Button size="sm" className="mt-2" onClick={() => onPaste(paste)}>Extract</Button>
          </div>
        )}

        <label className="mt-4 block text-sm font-medium">
          Stage
          <Select value={job.stage} onValueChange={(v) => onUpdate({ stage: v as JobUpdate["stage"] })}>
            <SelectTrigger aria-label="Change stage" className="mt-1 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </label>

        <label className="mt-3 block text-sm font-medium">
          Applied date
          <input type="date" className="mt-1 block w-full rounded-lg border border-input p-2"
            value={job.applied_date ?? ""} onChange={(e) => onUpdate({ applied_date: e.target.value || null })} />
        </label>

        <label className="mt-3 block text-sm font-medium">
          Next action
          <input type="datetime-local" className="mt-1 block w-full rounded-lg border border-input p-2"
            value={job.next_action_at ?? ""} onChange={(e) => onUpdate({ next_action_at: e.target.value || null })} />
        </label>

        <label className="mt-3 block text-sm font-medium">
          Notes
          <textarea className="mt-1 block w-full rounded-lg border border-input p-2"
            defaultValue={job.notes} onBlur={(e) => onUpdate({ notes: e.target.value })} />
        </label>

        {job.skills.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium">Skills</h3>
            <div className="mt-1 flex flex-wrap gap-1">
              {job.skills.map((s) => <span key={s} className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{s}</span>)}
            </div>
          </div>
        )}

        {job.apply_url && (
          <a className="mt-4 inline-flex items-center gap-1 text-primary underline" href={job.apply_url} target="_blank" rel="noreferrer">Apply <ExternalLink size={14} /></a>
        )}

        {job.description && <p className="mt-4 text-sm">{job.description}</p>}

        {job.snapshot && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">Original snapshot</summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{job.snapshot}</pre>
          </details>
        )}

        <div className="mt-6 border-t border-border pt-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="text-sm font-medium text-destructive">Delete</button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this job?</AlertDialogTitle>
                <AlertDialogDescription>This removes it from your board. You can undo right after.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(job.id)}>Confirm delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @whats-next/web test JobDetailDrawer`
Expected: PASS (all). The "Close" affordance is now Sheet's built-in close (Radix) + `onOpenChange`; the old `aria-label="Close"` test was removed when we rewrote — if any test referenced it, drop that assertion.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/JobDetailDrawer.tsx apps/web/src/components/JobDetailDrawer.test.tsx
git commit -m "feat(web): drawer on shadcn Sheet + AlertDialog"
```

## Task 9: Job cards & list polish on shadcn Card

**Files:**
- Modify: `apps/web/src/components/JobCardBody.tsx`, `apps/web/src/components/JobList.tsx` (tests unchanged — behavior preserved)

- [ ] **Step 1: Use Card + StageBadge in JobCardBody (keep `StageSelect`, retry, importing spinner stays for Task 13)**

`apps/web/src/components/JobCardBody.tsx` — replace the outer wrapper div with shadcn `Card` and swap manual classes for tokens:
```tsx
import type { useDraggable } from "@dnd-kit/core";
import { formatSalary, type Job, type Stage } from "@whats-next/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StageSelect } from "./StageSelect";

type Drag = ReturnType<typeof useDraggable>;

export function JobCardBody({
  job, onSelect, onStageChange, onRetry, drag,
}: {
  job: Job; onSelect: (id: string) => void; onStageChange: (id: string, stage: Stage) => void;
  onRetry: (id: string) => void; drag?: Drag;
}) {
  if (job.import_status === "importing") {
    return <Card className="p-3 text-sm text-muted-foreground">Importing…</Card>;
  }
  const style = drag?.transform ? { transform: `translate(${drag.transform.x}px, ${drag.transform.y}px)` } : undefined;
  return (
    <Card ref={drag?.setNodeRef} style={style} className={`p-3 ${drag?.isDragging ? "opacity-60" : ""}`}>
      <div {...(drag?.attributes)} {...(drag?.listeners)} onClick={() => onSelect(job.id)} className="cursor-pointer">
        <div className="font-semibold">{job.job_title || "Untitled"}</div>
        <div className="text-xs text-muted-foreground">{job.company_name}{job.is_agency && job.agency_name ? ` (via ${job.agency_name})` : ""}</div>
        {formatSalary(job) && <div className="mt-1 text-xs font-medium">{formatSalary(job)}</div>}
      </div>
      {job.import_status === "failed" ? (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-destructive">Import failed</span>
          <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => onRetry(job.id)}>Retry</Button>
        </div>
      ) : (
        <div className="mt-2"><StageSelect value={job.stage} onChange={(s) => onStageChange(job.id, s)} /></div>
      )}
    </Card>
  );
}
```
(`Card` must forward `ref`/`style`/`className`; the generated shadcn Card does. JobList keeps its grid; only ensure its inline `<StageSelect>` works with the new Select — it does.)

- [ ] **Step 2: Run the affected suites**

Run: `pnpm --filter @whats-next/web test JobCard JobList JobBoard`
Expected: PASS. (JobList/JobBoard tests assert text/roles, unaffected by Card wrapper. The mobile-board accordion test still passes because it renders `JobCardBody` without drag.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/JobCardBody.tsx
git commit -m "feat(web): job cards on shadcn Card"
```

---

# Milestone 4 — Overview strip

## Task 10: computeStats helper

**Files:**
- Create: `apps/web/src/lib/stats.ts`, `apps/web/src/lib/stats.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/stats.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeStats } from "./stats";
import type { Job } from "@whats-next/shared";

const j = (over: Partial<Job>): Job => ({
  id: "x", user_id: "u", company_name: "C", is_agency: false, agency_name: null, job_title: "T",
  role: "R", level: null, salary_min: null, salary_max: null, salary_currency: null, salary_period: null,
  salary_raw_text: null, location: null, is_remote: false, deadline: null, url: "u", apply_url: null,
  source_site: null, snapshot: null, description: null, raw_content_key: null, source_method: "fetch",
  extraction_model: null, stage: "Saved", import_status: "ready", applied_date: null, next_action_at: null,
  notes: "", created_at: "", updated_at: "", skills: [], ...over,
});

const NOW = new Date("2026-06-19T00:00:00Z");

describe("computeStats", () => {
  it("counts tracked, active, interviews, and due-this-week", () => {
    const jobs = [
      j({ stage: "Saved" }),
      j({ stage: "Applied", next_action_at: "2026-06-22T10:00" }),     // due within 7d
      j({ stage: "Phone screen" }),
      j({ stage: "Interview", next_action_at: "2026-07-30T10:00" }),   // not within 7d
      j({ stage: "Rejected/Closed" }),
    ];
    const s = computeStats(jobs, NOW);
    expect(s.tracked).toBe(5);
    expect(s.active).toBe(4);          // all but Rejected/Closed
    expect(s.interviews).toBe(2);      // Phone screen + Interview
    expect(s.dueThisWeek).toBe(1);
  });

  it("returns zeros for an empty list", () => {
    expect(computeStats([], NOW)).toEqual({ tracked: 0, active: 0, interviews: 0, dueThisWeek: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @whats-next/web test stats`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`apps/web/src/lib/stats.ts`:
```ts
import type { Job } from "@whats-next/shared";

export interface Stats { tracked: number; active: number; interviews: number; dueThisWeek: number; }

export function computeStats(jobs: Job[], now: Date): Stats {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const horizon = now.getTime() + weekMs;
  let active = 0, interviews = 0, dueThisWeek = 0;
  for (const j of jobs) {
    if (j.stage !== "Rejected/Closed") active++;
    if (j.stage === "Phone screen" || j.stage === "Interview") interviews++;
    if (j.next_action_at) {
      const t = new Date(j.next_action_at).getTime();
      if (!Number.isNaN(t) && t >= now.getTime() && t <= horizon) dueThisWeek++;
    }
  }
  return { tracked: jobs.length, active, interviews, dueThisWeek };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @whats-next/web test stats`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/stats.ts apps/web/src/lib/stats.test.ts
git commit -m "feat(web): computeStats helper"
```

## Task 11: StatsBar component

**Files:**
- Create: `apps/web/src/components/StatsBar.tsx`, `apps/web/src/components/StatsBar.test.tsx`

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/StatsBar.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatsBar } from "./StatsBar";

describe("StatsBar", () => {
  it("renders the four labelled stats", () => {
    render(<StatsBar stats={{ tracked: 12, active: 7, interviews: 2, dueThisWeek: 3 }} />);
    for (const label of ["Tracked", "Active", "Interviews", "Due this week"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @whats-next/web test StatsBar`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`apps/web/src/components/StatsBar.tsx`:
```tsx
import { Card } from "@/components/ui/card";
import type { Stats } from "../lib/stats";

const ITEMS: { key: keyof Stats; label: string; tone?: string }[] = [
  { key: "tracked", label: "Tracked" },
  { key: "active", label: "Active" },
  { key: "interviews", label: "Interviews", tone: "text-lime-700" },
  { key: "dueThisWeek", label: "Due this week", tone: "text-accent-deep" },
];

export function StatsBar({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {ITEMS.map(({ key, label, tone }) => (
        <Card key={key} className="p-3">
          <div className={`text-2xl font-extrabold ${tone ?? ""}`}>{stats[key]}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @whats-next/web test StatsBar`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/StatsBar.tsx apps/web/src/components/StatsBar.test.tsx
git commit -m "feat(web): overview StatsBar"
```

---

# Milestone 5 — Toasts & error handling

## Task 12: Toast wrapper + API error type

**Files:**
- Create: `apps/web/src/lib/toast.ts`, `apps/web/src/lib/toast.test.ts`
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Write the failing test (mock sonner)**

`apps/web/src/lib/toast.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sonner = { success: vi.fn(), error: vi.fn(), loading: vi.fn(), message: vi.fn(), dismiss: vi.fn() };
vi.mock("sonner", () => ({ toast: Object.assign((...a: unknown[]) => sonner.message(...a), sonner) }));

import { notify } from "./toast";

beforeEach(() => Object.values(sonner).forEach((f) => f.mockReset()));

describe("notify", () => {
  it("added shows a success toast with title + company", () => {
    notify.added("Backend Eng", "Acme");
    expect(sonner.success).toHaveBeenCalledWith(expect.stringContaining("Backend Eng"));
  });
  it("moved shows the target stage", () => {
    notify.moved("Applied");
    expect(sonner.success).toHaveBeenCalledWith(expect.stringContaining("Applied"));
  });
  it("error shows an error toast", () => {
    notify.error("nope");
    expect(sonner.error).toHaveBeenCalledWith("nope");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @whats-next/web test toast`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the toast wrapper**

`apps/web/src/lib/toast.ts`:
```ts
import { toast } from "sonner";

export const notify = {
  added: (title: string, company: string) =>
    toast.success(`Added — ${title || "Untitled"}${company ? ` at ${company}` : ""}`),
  importing: () => toast.loading("Extracting job details…", { id: "import" }),
  importFailed: () => toast.error("Couldn't import that job"),
  moved: (stage: string) => toast.success(`Moved to ${stage}`),
  saved: () => toast.success("Saved", { duration: 1200 }),
  error: (message: string) => toast.error(message),
  deletedWithUndo: (onUndo: () => void) =>
    toast("Job deleted", { action: { label: "Undo", onClick: onUndo } }),
  dismiss: (id?: string | number) => toast.dismiss(id),
};
```

- [ ] **Step 4: Add a typed API error**

In `apps/web/src/lib/api.ts`, replace the `if (!res.ok) throw ...` line and export an error class:
```ts
export class ApiError extends Error {
  constructor(public status: number) { super(`API ${status}`); this.name = "ApiError"; }
}
```
and in `call`:
```ts
    if (!res.ok) throw new ApiError(res.status);
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @whats-next/web test toast api`
Expected: PASS (toast 3 tests; existing api tests still pass — they assert `.rejects.toThrow()`, which `ApiError` satisfies).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/toast.ts apps/web/src/lib/toast.test.ts apps/web/src/lib/api.ts
git commit -m "feat(web): toast wrapper and typed ApiError"
```

## Task 13: Optimistic mutations + import spinner + Toaster

**Files:**
- Modify: `apps/web/src/lib/queries.ts`, `apps/web/src/components/JobCardBody.tsx`, `apps/web/src/main.tsx`
- Test: `apps/web/src/lib/queries.test.tsx`

- [ ] **Step 1: Write a failing test for optimistic update + rollback**

`apps/web/src/lib/queries.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Job } from "@whats-next/shared";

const notify = { moved: vi.fn(), error: vi.fn(), added: vi.fn(), saved: vi.fn(), importing: vi.fn(), importFailed: vi.fn(), deletedWithUndo: vi.fn(), dismiss: vi.fn() };
vi.mock("./toast", () => ({ notify }));

const api = {
  listJobs: vi.fn(), updateJob: vi.fn(), importJob: vi.fn(), deleteJob: vi.fn(),
};
vi.mock("./api", () => ({ createApiClient: () => api, ApiError: class extends Error {} }));
vi.mock("@clerk/clerk-react", () => ({ useAuth: () => ({ getToken: async () => "t" }) }));

import { useUpdateJob, useJobs } from "./queries";

const job = (over: Partial<Job>): Job => ({ id: "j1", stage: "Saved", import_status: "ready", company_name: "Acme", job_title: "Eng", skills: [], user_id: "u", url: "u", is_agency: false, agency_name: null, role: "", level: null, salary_min: null, salary_max: null, salary_currency: null, salary_period: null, salary_raw_text: null, location: null, is_remote: false, deadline: null, apply_url: null, source_site: null, snapshot: null, description: null, raw_content_key: null, source_method: "fetch", extraction_model: null, applied_date: null, next_action_at: null, notes: "", created_at: "", updated_at: "", ...over });

function Harness() {
  const { data } = useJobs();
  const update = useUpdateJob();
  return (
    <div>
      <span data-testid="stage">{data?.[0]?.stage}</span>
      <button onClick={() => update.mutate({ id: "j1", patch: { stage: "Applied" } })}>move</button>
    </div>
  );
}

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Harness /></QueryClientProvider>);
}

beforeEach(() => { Object.values(notify).forEach((f) => f.mockReset()); api.listJobs.mockResolvedValue([job({})]); });

describe("useUpdateJob optimistic", () => {
  it("updates the cache immediately and toasts on success", async () => {
    api.updateJob.mockResolvedValue(job({ stage: "Applied" }));
    setup();
    await screen.findByText("Saved");
    fireEvent.click(screen.getByText("move"));
    await waitFor(() => expect(screen.getByTestId("stage").textContent).toBe("Applied"));
    await waitFor(() => expect(notify.moved).toHaveBeenCalledWith("Applied"));
  });

  it("rolls back and shows an error toast on failure", async () => {
    api.updateJob.mockRejectedValue(new Error("boom"));
    setup();
    await screen.findByText("Saved");
    fireEvent.click(screen.getByText("move"));
    await waitFor(() => expect(notify.error).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId("stage").textContent).toBe("Saved"));
  });
});
```
(The `findByText("Saved")` waits for the initial `useJobs` to resolve — the harness shows the job's stage "Saved".)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @whats-next/web test queries`
Expected: FAIL — current `useUpdateJob` isn't optimistic and doesn't call `notify`.

- [ ] **Step 3: Rewrite the mutations with optimistic update + toasts**

Replace `apps/web/src/lib/queries.ts`:
```ts
import { useAuth } from "@clerk/clerk-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { createApiClient } from "./api";
import { notify } from "./toast";
import type { Job, JobUpdate, ImportRequest } from "@whats-next/shared";

function useApi() {
  const { getToken } = useAuth();
  return useMemo(() => createApiClient({
    baseUrl: import.meta.env.VITE_API_URL as string, getToken: () => getToken(),
  }), [getToken]);
}

export function useJobs() {
  const api = useApi();
  return useQuery({
    queryKey: ["jobs"],
    queryFn: () => api.listJobs(),
    refetchInterval: (query) =>
      (query.state.data ?? []).some((j: Job) => j.import_status === "importing") ? 2000 : false,
  });
}

export function useImportJob() {
  const api = useApi(); const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ImportRequest) => api.importJob(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
    onError: () => notify.error("Couldn't reach the server"),
  });
}

export function useUpdateJob() {
  const api = useApi(); const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: JobUpdate }) => api.updateJob(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["jobs"] });
      const prev = qc.getQueryData<Job[]>(["jobs"]);
      qc.setQueryData<Job[]>(["jobs"], (old) => (old ?? []).map((j) => (j.id === id ? { ...j, ...patch } : j)));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["jobs"], ctx.prev);
      notify.error("Couldn't save changes");
    },
    onSuccess: (_data, { patch }) => {
      if (patch.stage) notify.moved(patch.stage);
      else notify.saved();
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useDeleteJob() {
  const api = useApi();
  return useMutation({
    mutationFn: (id: string) => api.deleteJob(id),
    onError: () => notify.error("Couldn't delete the job"),
  });
}
```
(Deferred-delete cache manipulation + Undo lives in `App` — Task 14 — so `useDeleteJob` here is just the raw API call; `App` does the optimistic removal/restore and calls `mutate` after the timer.)

- [ ] **Step 4: Replace the card "Importing…" text with a spinner**

In `apps/web/src/components/JobCardBody.tsx`, change the importing branch:
```tsx
  if (job.import_status === "importing") {
    return (
      <Card className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
        <Loader2 className="animate-spin" size={14} /> Extracting…
      </Card>
    );
  }
```
and add the import: `import { Loader2 } from "lucide-react";`

- [ ] **Step 5: Mount the Toaster**

In `apps/web/src/main.tsx`, add `import { Toaster } from "@/components/ui/sonner";` and render `<Toaster />` inside `<QueryClientProvider>` (e.g., right after `<SignedIn>/<SignedOut>` block, still within the provider).

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @whats-next/web test queries JobCard`
Expected: PASS. The JobCard test for "importing" asserts `/importing/i`; update that assertion to `/extracting/i` to match the new copy.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/queries.ts apps/web/src/components/JobCardBody.tsx apps/web/src/components/JobCard.test.tsx apps/web/src/main.tsx
git commit -m "feat(web): optimistic mutations, toasts, import spinner, Toaster"
```

## Task 14: App — StatsBar, deferred delete + Undo, import lifecycle toasts

**Files:**
- Modify: `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`

- [ ] **Step 1: Update the App test**

Add to `apps/web/src/App.test.tsx` (keep existing render setup; the `useDeleteJob` mock returns `{ mutate }`). Add a stats assertion and extend the queries mock to include `useDeleteJob`:
```tsx
  it("shows the overview stats", () => {
    renderApp();
    expect(screen.getByText("Tracked")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });
```
Ensure the top `vi.mock("./lib/queries", ...)` includes `useDeleteJob: () => ({ mutate: vi.fn() })` (already present) and that `useJobs` returns the one ready job.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @whats-next/web test App`
Expected: FAIL — StatsBar not rendered.

- [ ] **Step 3: Rewrite App with StatsBar, deferred delete, and import toasts**

`apps/web/src/App.tsx`:
```tsx
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useJobs, useImportJob, useUpdateJob, useDeleteJob } from "./lib/queries";
import { useUiStore } from "./store/ui";
import { computeStats } from "./lib/stats";
import { notify } from "./lib/toast";
import type { Job, Stage } from "@whats-next/shared";
import { Header } from "./components/Header";
import { ImportBar } from "./components/ImportBar";
import { StatsBar } from "./components/StatsBar";
import { JobBoard } from "./components/JobBoard";
import { JobList } from "./components/JobList";
import { JobDetailDrawer } from "./components/JobDetailDrawer";

export function App() {
  const { data: jobs = [], isLoading } = useJobs();
  const qc = useQueryClient();
  const importJob = useImportJob();
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const view = useUiStore((s) => s.view);
  const selectedId = useUiStore((s) => s.selectedJobId);
  const selectJob = useUiStore((s) => s.selectJob);
  const selected = jobs.find((j) => j.id === selectedId) ?? null;

  // Import lifecycle toasts: watch entries transition out of "importing".
  const prev = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const prevMap = prev.current;
    for (const j of jobs) {
      const was = prevMap.get(j.id);
      if (was === "importing" && j.import_status === "ready") { notify.dismiss("import"); notify.added(j.job_title, j.company_name); }
      if (was === "importing" && j.import_status === "failed") { notify.dismiss("import"); notify.importFailed(); }
    }
    prev.current = new Map(jobs.map((j) => [j.id, j.import_status]));
  }, [jobs]);

  const startImport = (req: { url: string; pastedText?: string }) => {
    notify.importing();
    importJob.mutate(req);
  };
  const onStageChange = (id: string, stage: Stage) => updateJob.mutate({ id, patch: { stage } });
  const onRetry = (id: string) => {
    const job = jobs.find((j) => j.id === id);
    if (job) startImport({ url: job.url });
  };

  // Deferred delete: optimistically remove, toast Undo, commit after the window.
  const onDelete = (id: string) => {
    const prevJobs = qc.getQueryData<Job[]>(["jobs"]) ?? [];
    qc.setQueryData<Job[]>(["jobs"], prevJobs.filter((j) => j.id !== id));
    selectJob(null);
    let undone = false;
    const timer = setTimeout(() => { if (!undone) deleteJob.mutate(id); }, 5000);
    notify.deletedWithUndo(() => {
      undone = true;
      clearTimeout(timer);
      qc.setQueryData<Job[]>(["jobs"], prevJobs);
    });
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <Header />
      <div className="mt-5"><StatsBar stats={computeStats(jobs, new Date())} /></div>
      <div className="mt-4">
        <ImportBar pending={importJob.isPending} onImport={(url) => startImport({ url })} />
      </div>
      <div className="mt-6">
        {view === "board" ? (
          <JobBoard jobs={jobs} loading={isLoading} onSelect={selectJob} onStageChange={onStageChange} onRetry={onRetry} />
        ) : (
          <JobList jobs={jobs} loading={isLoading} onSelect={selectJob} onStageChange={onStageChange} />
        )}
      </div>
      {selected && (
        <JobDetailDrawer
          job={selected}
          onClose={() => selectJob(null)}
          onUpdate={(patch) => updateJob.mutate({ id: selected.id, patch })}
          onPaste={(text) => startImport({ url: selected.url, pastedText: text })}
          onDelete={onDelete}
          onRetry={onRetry}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @whats-next/web test App`
Expected: PASS (existing toggle/board/list tests + stats). The board/list mocks render with one ready job; `computeStats` over it shows Tracked 1, Active 1.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "feat(web): overview stats, deferred-delete Undo, import lifecycle toasts"
```

---

# Milestone 6 — Verify

## Task 15: Full verification + build + manual

**Files:** none (verification)

- [ ] **Step 1: Full web suite + typecheck**

Run: `pnpm --filter @whats-next/web test && pnpm --filter @whats-next/web typecheck`
Expected: all green. Fix any remaining test that still references pre-shadcn markup by updating to roles/labels/text per the migrated component.

- [ ] **Step 2: Build**

Run: `pnpm --filter @whats-next/web build`
Expected: builds cleanly.

- [ ] **Step 3: Whole-workspace check**

Run: `pnpm -r test && pnpm -r typecheck`
Expected: shared + api + web all green.

- [ ] **Step 4: Manual smoke (local dev)**

Run `pnpm --filter @whats-next/web dev`. Verify: warm look unchanged; stats strip shows counts; adding a URL shows the loading toast → success toast and a spinner card → populated card; changing a stage toasts "Moved to …"; deleting shows "Job deleted · Undo" and Undo restores; a simulated failure shows an error toast and the card's Retry; sign-in page intact; mobile board accordion intact.

- [ ] **Step 5: Commit any fixups**

```bash
git add -A
git commit -m "polish(web): UI v2 fixups"
```
(Skip if nothing changed.)

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** shadcn foundation+theme (Tasks 1–3), full re-skin (Tasks 4–9), overview strip (Tasks 10–11, 14), toasts incl. import lifecycle/stage/deferred-delete/field-save (Tasks 12–14), comprehensive errors: optimistic rollback + onError toasts + ApiError (Tasks 12–13), import spinner replacing "Importing…" (Task 13), `<Toaster/>` mount (Task 13). Backend untouched.
- **Generated vs authored:** shadcn `ui/*` primitives come from the CLI (Task 3); if non-interactive generation isn't possible, copy current source from ui.shadcn.com per component (they import `@/lib/utils`). All app-level code is authored in full here.
- **Type/name consistency:** `notify.*` names match between `lib/toast.ts` (Task 12) and call sites (Tasks 13–14). `computeStats(jobs, now)` and `Stats` shape match StatsBar (Task 11) and App (Task 14). `useUpdateJob`/`useDeleteJob`/`useImportJob` signatures unchanged for existing callers; `onStageChange(id, stage)`/`onRetry(id)`/`onDelete(id)` unchanged.
- **Test churn:** Radix Select/Sheet/AlertDialog change markup — tests updated to drive via roles (`option`, dialog buttons) with the jsdom shims from Task 2. The JobCard "importing" copy changed to "Extracting…" (Task 13 updates that assertion).
- **Deferred delete:** lives in `App` (Task 14), not `useDeleteJob`, so Undo needs no backend. The 5s commit uses the real API; closing the tab within the window cancels the commit (acceptable).
```
