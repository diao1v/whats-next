import { useState } from "react";
import { Plus } from "lucide-react";

export function ImportBar({ onImport, pending }: { onImport: (url: string) => void; pending: boolean }) {
  const [url, setUrl] = useState("");
  return (
    <form className="flex gap-2"
      onSubmit={(e) => { e.preventDefault(); if (url.trim()) { onImport(url.trim()); setUrl(""); } }}>
      <input
        className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
        placeholder="Paste a job URL…" value={url} onChange={(e) => setUrl(e.target.value)} />
      <button
        className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 font-semibold text-paper shadow-card disabled:opacity-50"
        disabled={pending}>
        <Plus size={16} /> {pending ? "Adding…" : "Add"}
      </button>
    </form>
  );
}
