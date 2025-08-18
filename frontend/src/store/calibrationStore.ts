import { create } from 'zustand';

interface CalibrationState {
  calibrationPending: boolean;
  lastCalibrationTs: number | null;
  setCalibrationPending: (pending: boolean) => void;
  markCalibrationComplete: () => void;
}

export const useCalibrationStore = create<CalibrationState>((set) => ({
  calibrationPending: false,
  lastCalibrationTs: null,
  setCalibrationPending: (pending: boolean) => set({ calibrationPending: pending }),
  markCalibrationComplete: () => set({ calibrationPending: false, lastCalibrationTs: Date.now() }),
}));

// Backward compatibility alias - deprecated
export const useRecalcStore = useCalibrationStore;