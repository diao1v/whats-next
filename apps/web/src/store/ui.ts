import { create } from "zustand";

interface UiState {
  view: "list" | "board";
  selectedJobId: string | null;
  setView: (v: "list" | "board") => void;
  selectJob: (id: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  view: "board",
  selectedJobId: null,
  setView: (view) => set({ view }),
  selectJob: (selectedJobId) => set({ selectedJobId }),
}));
