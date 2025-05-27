// Types related to Rehabilitation Sessions and Game Sessions

export interface BFRParameters {
    aop: number; // Arterial Occlusion Pressure measured in mmHg
    targetPercentage: number; // Target percentage of AOP (e.g., 40%)
    cuffPressure: number; // Actual pressure applied in mmHg
    duration: number; // Duration in minutes
    durationPerSet?: number; // Duration per set in seconds
    restBetweenSets?: number; // Rest between sets in seconds
    setNumber?: number; // Current set number in a BFR protocol
    totalSets?: number; // Total sets planned in the BFR protocol
    repetitionsInSet?: number; // Number of repetitions in the current BFR set
  }
  
  export interface GameParameters {
    difficulty: number;
    targetMVC: number; // Target percentage of Maximum Voluntary Contraction
    repetitions: number;
    sets: number;
    restIntervals: number; // Rest intervals in seconds
    ddaEnabled: boolean;
    ddaParameters?: {
      adaptiveContractionDetection: boolean;
      adaptiveLevelProgression: boolean;
      // Add other DDA parameters as needed
    };
  }
  
  import type { EMGAnalysisResult, ChannelAnalyticsData } from './emg'; // Assuming these are in emg.ts

  export interface EMGMetrics {
    longContractionsLeft?: number;
    longContractionsRight?: number;
    shortContractionsLeft?: number;
    shortContractionsRight?: number;
    rms?: number; // Root Mean Square
    mav?: number; // Mean Absolute Value
    fatigueIndex?: number; // e.g., Dimitrov's index
    forceEstimation?: number; // Estimated muscle force in Newtons
  }
  
  // This structure allows for 'time' and other known properties,
  // plus any number of additional string-keyed channels.
  export type EMGDataPoint = {
    time: number;
    leftQuadriceps?: number;
    rightQuadriceps?: number;
  } & {
    [channelName: string]: number | undefined; // Allow other channels, ensure compatibility or make them all optional if necessary
  };
  
  export interface GameSessionStatistics {
    duration: number; // in seconds
    levelsCompleted: number;
    timePerLevel: number[];
    activationPoints: number;
    inactivityPeriods: number;
    engagementScore: number;
    adherenceScore: number;
  }
  
  // Individual game play session (typically generates one C3D file)
  export interface GameSession {
    id: string; // file_id from EMGAnalysisResult
    startTime: string;
    endTime: string;
    gameType: string;
    muscleGroups: string[]; // e.g., ["Left Quadriceps", "Right Quadriceps"]
    parameters?: {
      difficulty?: string;
      targetMVC?: number; // Percentage
      repetitions?: number;
      restIntervals?: number; // in seconds
      ddaEnabled?: boolean;
      ddaParameters?: {
        adaptiveContractionDetection?: boolean;
        adaptiveLevelProgression?: boolean;
      };
    };
    bfrParameters?: {
      aop?: number; // Arterial Occlusion Pressure in mmHg
      targetPercentage?: number; // Percentage of AOP
      cuffPressure?: number; // Applied cuff pressure in mmHg
      duration?: number; // BFR active duration in minutes
      setNumber?: number;
      totalSets?: number;
      repetitionsInSet?: number;
      restBetweenSets?: number; // in seconds
    };
    c3dFileUrl?: string;
    sensorType?: string; // If multiple sensor types are supported
    metadata?: EMGAnalysisResult['metadata']; // Directly use the metadata type from EMGAnalysisResult
    metrics?: EMGMetrics & {
      // This allows for specific channel analytics to be added if needed
      // e.g. leftChannelAnalytics?: ChannelAnalyticsData;
      //      rightChannelAnalytics?: ChannelAnalyticsData;
    };
    statistics?: {
      activationPoints?: number;
      duration?: number; // Total gameplay duration in seconds
      levelsCompleted?: number;
      inactivityPeriods?: number; // Count of inactivity periods
    };
    notes?: string;
  }
  
  // Overall therapy session that may contain multiple game sessions
  export interface RehabilitationSession {
    id: string;
    patientId: string;
    date: string;
    therapistId: string;
    status: 'scheduled' | 'completed' | 'cancelled' | 'in-progress';
    type?: string; // Type of rehabilitation session, e.g., 'Strength Training (BFR)', 'Endurance Training'
    gameSessions: GameSession[];
    notes?: string;
    assessmentPoint?: 'T0' | 'T1' | 'T2'; // If this session includes clinical assessments
    clinicianNotes?: string; // Notes from the clinician for this session
    summaryMetrics?: { // High-level summary metrics for the entire rehabilitation session
      totalDuration?: number; // Total duration of the session in seconds
      averagePeakContraction?: number;
      averageSymmetryScore?: number;
      adherence?: number; // Overall adherence to the prescribed session
      // Add other summary metrics as needed
    };
  }

  // Interface for session items, typically used in lists (from former sessions.ts)
  export interface SessionListItem {
    id: string;
    patientId: string;
    patientName?: string; // Added for displaying in lists
    date: string;
    type: string; // Simplified to generic string, or could be more specific like 'Rehab' | 'Training'
    isBFR?: boolean; // New property for BFR status
    duration: number;  // in minutes
    difficulty?: number; // Kept for now, though not displayed in schedule
    status: 'scheduled' | 'completed' | 'cancelled';
    performance?: string; // percentage completion
    linkState?: { from: string }; // For navigation state tracking
  }

  // If ChannelAnalyticsData from './emg' is needed by components consuming GameSession,
  // it's good it's imported above. No need to re-export unless for specific architectural reasons.