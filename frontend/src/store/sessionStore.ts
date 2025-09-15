import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { GameSessionParameters } from '../types/emg';

interface SelectedFileData {
  patientName?: string;
  therapistDisplay?: string;
  fileSize?: number;
  clinicalNotesCount?: number;
}

interface SessionState {
  sessionParams: GameSessionParameters;
  setSessionParams: (params: Partial<GameSessionParameters> | ((params: GameSessionParameters) => Partial<GameSessionParameters>)) => void;
  resetSessionParams: () => void;
  uploadDate: string | null;
  setUploadDate: (date: string | null) => void;
  selectedFileData: SelectedFileData | null;
  setSelectedFileData: (data: SelectedFileData | null) => void;
}

const defaultSessionParams: GameSessionParameters = {
  // UI state only - no therapeutic defaults
  channel_muscle_mapping: {
    "CH1": "Left Quadriceps",
    "CH2": "Right Quadriceps"
  },
  muscle_color_mapping: {
    "Left Quadriceps": "#3b82f6", // Blue
    "Right Quadriceps": "#ef4444"  // Red
  },
  // All therapeutic parameters will come from backend
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
      uploadDate: null,
      setUploadDate: (date) => {
        console.log('🏪 SessionStore - setUploadDate called:', {
          newDate: date,
          dateType: typeof date,
          timestamp: Date.now()
        });
        set({ uploadDate: date });
      },
      selectedFileData: null,
      setSelectedFileData: (data) => set({ selectedFileData: data }),
    }),
    {
      name: 'emg-session-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
    }
  )
); 