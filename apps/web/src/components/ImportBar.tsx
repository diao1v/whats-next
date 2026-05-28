import { useState } from "react";

export function ImportBar({ onImport, pending }: { onImport: (url: string) => void; pending: boolean }) {
  const [url, setUrl] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => { e.preventDefault(); if (url.trim()) { onImport(url.trim()); setUrl(""); } }}
    >
      <input
        className="flex-1 rounded border px-3 py-2"
        placeholder="Paste a job URL…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button className="rounded bg-black px-4 py-2 text-white disabled:opacity-50" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </button>
    </form>
  );
}
