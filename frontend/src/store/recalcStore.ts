import { create } from 'zustand';

interface RecalcState {
  recalcPending: boolean;
  lastRecalcTs: number | null;
  setRecalcPending: (pending: boolean) => void;
  markRecalcComplete: () => void;
}

export const useRecalcStore = create<RecalcState>((set) => ({
  recalcPending: false,
  lastRecalcTs: null,
  setRecalcPending: (pending: boolean) => set({ recalcPending: pending }),
  markRecalcComplete: () => set({ recalcPending: false, lastRecalcTs: Date.now() }),
}));


