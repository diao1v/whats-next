import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTokens, useCreateToken, useRevokeToken } from "../lib/queries";

export function SettingsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: tokens = [] } = useTokens();
  const createToken = useCreateToken();
  const revokeToken = useRevokeToken();
  const [name, setName] = useState("");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader><SheetTitle>API tokens</SheetTitle></SheetHeader>
        <p className="mt-1 text-sm text-muted-foreground">Generate a token to connect the What&apos;s Next browser extension.</p>

        <div className="mt-4 flex gap-2">
          <Input placeholder="Token name (e.g. Chrome)" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={() => { createToken.mutate(name || "Extension"); setName(""); }} disabled={createToken.isPending}>
            Generate token
          </Button>
        </div>

        {createToken.data?.token && (
          <div className="mt-3 rounded-lg border border-line bg-secondary p-3">
            <p className="text-xs text-muted-foreground">Copy this now — you won&apos;t see it again:</p>
            <div className="mt-1 flex gap-2">
              <Input readOnly value={createToken.data.token} className="font-mono text-xs" />
              <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(createToken.data!.token)}>Copy</Button>
            </div>
          </div>
        )}

        <div className="mt-5 space-y-2">
          {tokens.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-line p-2 text-sm">
              <div>
                <div className="font-medium">{t.name || "Untitled"}</div>
                <div className="text-xs text-muted-foreground">added {t.created_at?.slice(0, 10)} · last used {t.last_used_at ? t.last_used_at.slice(0, 10) : "never"}</div>
              </div>
              <Button variant="secondary" className="h-7 px-2 text-xs" onClick={() => revokeToken.mutate(t.id)}>Revoke</Button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
