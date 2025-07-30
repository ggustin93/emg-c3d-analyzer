import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { GameSessionParameters } from '../types/emg';

interface SessionState {
  sessionParams: GameSessionParameters;
  setSessionParams: (params: Partial<GameSessionParameters> | ((params: GameSessionParameters) => Partial<GameSessionParameters>)) => void;
  resetSessionParams: () => void;
  uploadDate: string | null;
  setUploadDate: (date: string | null) => void;
}

const defaultSessionParams: GameSessionParameters = {
  session_mvc_value: 0.00015,
  session_mvc_threshold_percentage: 75,
  session_expected_contractions: 24,
  session_expected_contractions_ch1: 12,
  session_expected_contractions_ch2: 12,
  subjective_fatigue_level: 5,
  contraction_duration_threshold: 2000, // Default to 2 seconds
  channel_muscle_mapping: {
    "CH1": "Left Quadriceps",
    "CH2": "Right Quadriceps"
  },
  muscle_color_mapping: {
    "Left Quadriceps": "#3b82f6", // Blue
    "Right Quadriceps": "#ef4444"  // Red
  },
  session_mvc_values: {},
  session_mvc_threshold_percentages: {},
  post_session_rpe: 6, // Moderate to hard perceived exertion after game session (RPE 1-10 scale)
  bfr_parameters: {
    left: {
      aop_measured: 165,
      applied_pressure: 82,
      percentage_aop: 49.7,
      is_compliant: true,
      therapeutic_range_min: 40,
      therapeutic_range_max: 60,
      application_time_minutes: 15
    },
    right: {
      aop_measured: 195,
      applied_pressure: 98,
      percentage_aop: 50.3,
      is_compliant: true,
      therapeutic_range_min: 40,
      therapeutic_range_max: 60,
      application_time_minutes: 15
    }
  }
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
      uploadDate: null,
      setUploadDate: (date) => {
        console.log('🏪 SessionStore - setUploadDate called:', {
          newDate: date,
          dateType: typeof date,
          timestamp: Date.now()
        });
        set({ uploadDate: date });
      },
    }),
    {
      name: 'emg-session-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
    }
  )
); 