import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  view: "list" | "board";
  selectedJobId: string | null;
  setView: (v: "list" | "board") => void;
  selectJob: (id: string | null) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      view: "board",
      selectedJobId: null,
      setView: (view) => set({ view }),
      selectJob: (selectedJobId) => set({ selectedJobId }),
    }),
    { name: "whats-next-ui", partialize: (s) => ({ view: s.view }) }
  )
);
