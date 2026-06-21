import { useState } from "react";
import { UserButton } from "@clerk/clerk-react";
import { Settings } from "lucide-react";
import { ViewToggle } from "./ViewToggle";
import { SettingsSheet } from "./SettingsSheet";

export function Header() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-extrabold text-paper">W</span>
        <h1 className="text-xl font-extrabold text-ink">What&apos;s Next</h1>
      </div>
      <div className="flex items-center gap-3">
        <ViewToggle />
        <button aria-label="Settings" onClick={() => setSettingsOpen(true)} className="text-muted-foreground hover:text-ink">
          <Settings size={18} />
        </button>
        <UserButton afterSignOutUrl="/" />
        <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      </div>
    </header>
  );
}
