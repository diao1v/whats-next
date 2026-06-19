import { LayoutGrid, List } from "lucide-react";
import { useUiStore } from "../store/ui";

export function ViewToggle() {
  const view = useUiStore((s) => s.view);
  const setView = useUiStore((s) => s.setView);
  const cls = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
      active ? "bg-accent text-paper" : "text-muted hover:text-ink"
    }`;
  return (
    <div className="inline-flex rounded-full border border-line bg-[#f6ead9] p-0.5">
      <button type="button" aria-label="Board view" className={cls(view === "board")} onClick={() => setView("board")}>
        <LayoutGrid size={14} /> Board
      </button>
      <button type="button" aria-label="List view" className={cls(view === "list")} onClick={() => setView("list")}>
        <List size={14} /> List
      </button>
    </div>
  );
}
