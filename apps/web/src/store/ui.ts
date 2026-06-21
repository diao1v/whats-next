import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STAGES } from "@whats-next/shared";

interface UiState {
  view: "list" | "board";
  selectedJobId: string | null;
  laneState: Record<string, boolean>;
  setView: (v: "list" | "board") => void;
  selectJob: (id: string | null) => void;
  toggleLane: (stage: string, currentlyOpen: boolean) => void;
  setAllLanes: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      view: "board",
      selectedJobId: null,
      laneState: {},
      setView: (view) => set({ view }),
      selectJob: (selectedJobId) => set({ selectedJobId }),
      toggleLane: (stage, currentlyOpen) =>
        set((s) => ({ laneState: { ...s.laneState, [stage]: !currentlyOpen } })),
      setAllLanes: (open) =>
        set(() => ({ laneState: Object.fromEntries(STAGES.map((s) => [s, open])) })),
    }),
    { name: "whats-next-ui", partialize: (s) => ({ view: s.view, laneState: s.laneState }) }
  )
);
