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
