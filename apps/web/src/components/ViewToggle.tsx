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
