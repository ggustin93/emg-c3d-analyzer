/**
 * Clinical Notes TypeScript Interfaces
 * 
 * Type definitions for clinical notes feature with hybrid patient identification.
 * Matches backend models and provides comprehensive type safety.
 */

// Core domain types
export interface ClinicalNote {
  id: string;
  author_id: string;
  file_path?: string;
  patient_id?: string;
  title: string;
  content: string;
  note_type: 'file' | 'patient';
  created_at: string;
  updated_at: string;
}

export interface ClinicalNoteWithPatientCode extends ClinicalNote {
  patient_code?: string; // Resolved from patient_id for display
  author_email?: string; // Resolved from author_id for display
}

export interface NotesIndicators {
  file_notes: Record<string, number>;    // file_path -> note count
  patient_notes: Record<string, number>; // patient_code -> note count
}

// API request/response types
export interface CreateNoteRequest {
  title: string;
  content: string;
  note_type: 'file' | 'patient';
}

export interface UpdateNoteRequest {
  title?: string;
  content: string;
}

export interface NotesIndicatorsRequest {
  file_paths?: string[];
  patient_codes?: string[];
}

export interface NotesListResponse {
  notes: ClinicalNoteWithPatientCode[];
  total_count: number;
}

export interface ClinicalNotesError {
  error: string;
  message: string;
  details?: Record<string, any>;
}

// Component prop interfaces
export interface NoteBadgeProps {
  count: number;
  type: 'file' | 'patient';
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}

export interface NoteIndicatorProps {
  type: 'file' | 'patient';
  onClick: () => void;
  className?: string;
  title?: string;
  disabled?: boolean;
}

export interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteType: 'file' | 'patient';
  targetId: string; // file_path or patient_code
  targetDisplayName?: string; // for UI display
  existingNotes?: ClinicalNoteWithPatientCode[];
  onNotesChanged?: () => void; // callback for parent refresh
  initialMode?: 'list' | 'create' | 'edit'; // initial view mode
  initialNoteToEdit?: ClinicalNoteWithPatientCode; // note to edit directly
}

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
  showPreview?: boolean;
}

export interface NotesListProps {
  notes: ClinicalNoteWithPatientCode[];
  onSelectNote: (note: ClinicalNoteWithPatientCode) => void;
  onDeleteNote: (noteId: string) => void;
  selectedNoteId?: string;
  className?: string;
  loading?: boolean;
}

export interface NotesColumnProps {
  file: C3DFile; // Existing C3D file type from the project
  className?: string;
}

// Hook return types
export interface UseNotesReturn {
  // State
  notes: ClinicalNoteWithPatientCode[];
  indicators: NotesIndicators | null;
  loading: boolean;
  error: ClinicalNotesError | null;
  
  // File note operations
  createFileNote: (filePath: string, title: string, content: string) => Promise<ClinicalNote>;
  getFileNotes: (filePath: string) => Promise<ClinicalNoteWithPatientCode[]>;
  
  // Patient note operations (using patient_code for user convenience)
  createPatientNote: (patientCode: string, title: string, content: string) => Promise<ClinicalNote>;
  getPatientNotes: (patientCode: string) => Promise<ClinicalNoteWithPatientCode[]>;
  getPatientRelatedNotes: (patientCode: string) => Promise<ClinicalNoteWithPatientCode[]>;
  
  // General operations
  updateNote: (noteId: string, title: string, content: string) => Promise<ClinicalNote>;
  deleteNote: (noteId: string) => Promise<boolean>;
  loadIndicators: (filePaths: string[], patientCodes: string[]) => Promise<void>;
  
  // Utility functions
  clearError: () => void;
  refresh: () => Promise<void>;
  getNotesCount: (type: 'file' | 'patient', target: string, useCache?: boolean) => Promise<number>;
  getNotesCountSync: (type: 'file' | 'patient', target: string) => number;
  hasNotes: (type: 'file' | 'patient', target: string) => boolean;
  getTargetDisplayName: (type: 'file' | 'patient', targetId: string) => string;
  extractPatientCode: (filePath: string) => string | null;
  validateContent: (content: string) => { valid: boolean; error?: string };
  formatContent: (content: string) => string;
}

// Configuration types
export interface NotesConfig {
  maxContentLength: number;
  batchLoadThreshold: number;
  modalMaxHeight: string;
  markdownPreviewEnabled: boolean;
  cacheExpirationMs: number;
}

// Cache types for performance optimization
export interface NotesCacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface NotesCache {
  indicators: Map<string, NotesCacheEntry<NotesIndicators>>;
  notes: Map<string, NotesCacheEntry<ClinicalNoteWithPatientCode[]>>;
}

// Integration types with existing C3D system
export interface C3DFile {
  path: string;
  patient_code?: string; // Resolved from file path or metadata
  session_date?: string;
  file_size?: number;
  // ... other existing C3D file properties
}

// Patient type (subset of existing patient model)
export interface Patient {
  id: string;
  patient_code: string; // P001, P002, etc.
  therapist_id: string;
  age_group?: string;
  active: boolean;
  // ... other patient properties
}

// Event types for component communication
export interface NoteCreatedEvent {
  note: ClinicalNote;
  type: 'file' | 'patient';
  targetId: string;
}

export interface NoteUpdatedEvent {
  noteId: string;
  content: string;
  updatedAt: string;
}

export interface NoteDeletedEvent {
  noteId: string;
  type: 'file' | 'patient';
  targetId: string;
}

// Analytics/monitoring types
export interface NotesAnalytics {
  modalOpenTime: number;
  batchLoadTime: number;
  noteCreationTime: number;
  errorRate: number;
  usagePatterns: {
    fileNotes: number;
    patientNotes: number;
    markdownUsage: number;
  };
}

// Feature flag types
export interface ClinicalNotesFeatureFlags {
  enabled: boolean;
  markdownEditor: boolean;
  patientNotes: boolean;
  batchLoading: boolean;
  analytics: boolean;
}

// Constants
export const CLINICAL_NOTES_CONSTANTS = {
  MAX_CONTENT_LENGTH: 10000,
  MIN_CONTENT_LENGTH: 1,
  BATCH_LOAD_THRESHOLD: 10,
  CACHE_EXPIRATION_MS: 5 * 60 * 1000, // 5 minutes
  MODAL_PERFORMANCE_TARGET_MS: 200,
  BATCH_PERFORMANCE_TARGET_MS: 500,
  
  NOTE_TYPES: {
    FILE: 'file' as const,
    PATIENT: 'patient' as const,
  },
  
  ERRORS: {
    PATIENT_NOT_FOUND: 'PATIENT_NOT_FOUND',
    NOTE_NOT_FOUND: 'NOTE_NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
  } as const,
} as const;

// Type guards
export const isFileNote = (note: ClinicalNote): note is ClinicalNote & { file_path: string } => {
  return note.note_type === 'file' && !!note.file_path;
};

export const isPatientNote = (note: ClinicalNote): note is ClinicalNote & { patient_id: string } => {
  return note.note_type === 'patient' && !!note.patient_id;
};

export const hasPatientCode = (note: ClinicalNote): note is ClinicalNoteWithPatientCode => {
  return 'patient_code' in note;
};