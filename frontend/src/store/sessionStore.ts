import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { GameSessionParameters } from '../types/emg';

interface SessionState {
  sessionParams: GameSessionParameters;
  setSessionParams: (params: Partial<GameSessionParameters> | ((params: GameSessionParameters) => Partial<GameSessionParameters>)) => void;
  resetSessionParams: () => void;
}

const defaultSessionParams: GameSessionParameters = {
  session_mvc_value: 0.00015,
  session_mvc_threshold_percentage: 75,
  session_expected_contractions: 12,
  session_expected_contractions_ch1: null,
  session_expected_contractions_ch2: null,
  subjective_fatigue_level: 5,
  channel_muscle_mapping: {
    "CH1": "Left Quadriceps",
    "CH2": "Right Quadriceps"
  },
  muscle_color_mapping: {
    "Left Quadriceps": "#3b82f6", // Blue
    "Right Quadriceps": "#ef4444"  // Red
  },
  session_mvc_values: {},
  session_mvc_threshold_percentages: {}
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      sessionParams: defaultSessionParams,
      setSessionParams: (updater) =>
        set((state) => ({
          sessionParams: {
            ...state.sessionParams,
            ...(typeof updater === 'function' ? updater(state.sessionParams) : updater),
          },
        })),
      resetSessionParams: () => set({ sessionParams: defaultSessionParams }),
    }),
    {
      name: 'emg-session-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
    }
  )
); 