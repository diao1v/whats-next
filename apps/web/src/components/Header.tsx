import { UserButton } from "@clerk/clerk-react";
import { ViewToggle } from "./ViewToggle";

export function Header() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent font-extrabold text-paper">W</span>
        <h1 className="text-xl font-extrabold text-ink">What&apos;s Next</h1>
      </div>
      <div className="flex items-center gap-3">
        <ViewToggle />
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
}
