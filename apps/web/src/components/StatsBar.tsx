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
