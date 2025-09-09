import { C3DFileInfo } from '@/services/supabaseStorage';
import { getMockTherapistName } from '@/lib/devUtils';
import { getPatientColors, getTherapistColors } from '@/lib/unifiedColorSystem';
import { logger, LogCategory } from '@/services/logger';

/**
 * 🔧 CONFIGURABLE DATA RETRIEVAL PRIORITIES
 * 
 * Easy modification point for data source priorities:
 * 
 * 🏥 PATIENT ID RESOLUTION:
 * 1. Storage Subfolder (P005/, P008/, P012/) - HIGHEST PRIORITY
 * 2. C3D Metadata (metadata.player_name) - FALLBACK
 * 
 * 📅 SESSION DATE RESOLUTION:
 * 1. Filename Extraction (YYYYMMDD patterns) - HIGHEST PRIORITY  
 * 2. C3D Metadata (metadata.session_date, metadata.time) - FALLBACK
 * 
 * 👨‍⚕️ THERAPIST ID RESOLUTION:
 * 1. C3D Metadata (metadata.therapist_id) - HIGHEST PRIORITY
 * 2. Storage Metadata (therapist_id) - FALLBACK
 */

// Enhanced C3DFile type with resolved fields
export type C3DFile = C3DFileInfo & {
  therapist_id?: string;
  resolved_patient_id?: string;
  resolved_therapist_id?: string;
  game_metadata?: {
    player_name?: string;
    therapist_id?: string;
    [key: string]: any;
  };
};

// Badge styling props type
export interface BadgeProps {
  variant: 'outline' | 'secondary';
  className: string;
}

/**
 * 👤 PATIENT ID RESOLUTION STRATEGY (User-Configured Priority)
 * 
 * Resolves patient ID using configurable priority system:
 * 1. Storage subfolder pattern (P005/, P008/, etc.)
 * 2. C3D metadata player_name
 * 3. Storage metadata patient_id
 * 4. Filename pattern extraction
 * 5. Default to 'Unknown'
 */
export const resolvePatientId = (file: C3DFile): string => {
  // ⭐ PRIORITY 1: Storage Subfolder (HIGHEST PRIORITY - User Request)
  const subfolderMatch = file.name.match(/^(P\d{3})\//);
  if (subfolderMatch) {
    const patientId = subfolderMatch[1];
    return patientId;
  }
  
  // ⭐ PRIORITY 2: C3D Metadata (FALLBACK - User Request)
  if (file.metadata?.player_name) {
    return file.metadata.player_name;
  }
  
  // 🔄 Legacy Support (Lower Priority)
  if (file.patient_id) {
    return file.patient_id;
  }
  
  // 🔄 Filename Pattern Extraction (Last Resort)
  const filenameMatch = file.name.match(/[_-](P\d{3})[_-]/i);
  if (filenameMatch) {
    const patientId = filenameMatch[1].toUpperCase();
    return patientId;
  }
  
  return 'Unknown';
};

/**
 * 👨‍⚕️ THERAPIST ID RESOLUTION STRATEGY
 * 
 * Resolves therapist ID with consistent priority:
 * 1. C3D metadata therapist_id (from C3D analysis)
 * 2. Storage metadata therapist_id
 * 3. Default to 'Unknown'
 */
export const resolveTherapistId = (file: C3DFile): string => {
  // DEV MODE: Assign random therapist for demo purposes
  if (import.meta.env.DEV) {
    const realId = file.metadata?.therapist_id || file.therapist_id;
    if (realId) {
      return realId;
    }
    const mockName = getMockTherapistName(file.id);
    // Use a stable mock name based on file ID
    return mockName;
  }

  // PRODUCTION MODE: Standard resolution
  const prodId = file.metadata?.therapist_id || 
         file.therapist_id || 
         'Unknown';
  return prodId;
};

/**
 * 📅 SESSION DATE RESOLUTION STRATEGY (User-Configured Priority)
 * 
 * Extracts session date using intelligent pattern matching:
 * 1. Filename date patterns (YYYYMMDD, YYYY-MM-DD, DD-MM-YYYY)
 * 2. C3D metadata session_date
 * 3. C3D metadata time field
 * 4. Returns null if no date found
 */
export const extractDateFromFilename = (filename: string): string | null => {
  // Common C3D filename patterns with dates:
  // 1. Ghostly_Emg_20200415_12-31-20-0009.c3d (YYYYMMDD)
  // 2. Ghostly_Emg_20230321_17-50-17-0881.c3d (YYYYMMDD)
  // 3. EMG_2024-03-15_session.c3d (YYYY-MM-DD)
  // 4. session_15-03-2024.c3d (DD-MM-YYYY)
  
  // Pattern 1 & 2: YYYYMMDD format
  const yyyymmdd = filename.match(/(\d{4})(\d{2})(\d{2})/);
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd;
    // Validate date range (reasonable years)
    const yearNum = parseInt(year);
    if (yearNum >= 2020 && yearNum <= 2030) {
      return `${year}-${month}-${day}`;
    }
  }
  
  // Pattern 3: YYYY-MM-DD format
  const isoDate = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) {
    const [, year, month, day] = isoDate;
    const yearNum = parseInt(year);
    if (yearNum >= 2020 && yearNum <= 2030) {
      return `${year}-${month}-${day}`;
    }
  }
  
  // Pattern 4: DD-MM-YYYY format
  const ddmmyyyy = filename.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    const yearNum = parseInt(year);
    if (yearNum >= 2020 && yearNum <= 2030) {
      return `${year}-${month}-${day}`;
    }
  }
  
  return null;
};

/**
 * 🕐 ENHANCED SESSION TIMESTAMP EXTRACTION
 * 
 * Extracts full timestamp including time from filename patterns:
 * Ghostly_Emg_YYYYMMDD_HH-MM-SS-XXXX.c3d -> YYYY-MM-DDTHH:MM:SS
 * Falls back to date-only if time not found
 */
export const extractTimestampFromFilename = (filename: string): string | null => {
  // Pattern for Ghostly files: YYYYMMDD_HH-MM-SS
  const timestampMatch = filename.match(/(\d{4})(\d{2})(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
  if (timestampMatch) {
    const [, year, month, day, hour, minute, second] = timestampMatch;
    // Validate date range
    const yearNum = parseInt(year);
    if (yearNum >= 2020 && yearNum <= 2030) {
      // Return ISO 8601 format for proper sorting
      return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    }
  }
  
  // Fallback to date-only extraction
  const dateOnly = extractDateFromFilename(filename);
  if (dateOnly) {
    // Add midnight time for consistent sorting
    return `${dateOnly}T00:00:00`;
  }
  
  return null;
};

export const resolveSessionDate = (file: C3DFile): string | null => {
  // ⭐ PRIORITY 1: Filename Extraction (HIGHEST PRIORITY - User Request)
  const extractedDate = extractDateFromFilename(file.name);
  if (extractedDate) {
    return extractedDate;
  }
  
  // ⭐ PRIORITY 2: C3D Metadata (FALLBACK - User Request)
  if (file.metadata?.session_date) {
    return file.metadata.session_date;
  }
  
  // 🔄 Alternative C3D Field (Additional Fallback)
  if (file.metadata?.time) {
    return file.metadata.time;
  }
  
  return null;
};

/**
 * 🕐 ENHANCED SESSION DATETIME RESOLUTION
 * 
 * Resolves session date with time for accurate hour-based sorting
 * Uses full timestamp extraction when available
 */
export const resolveSessionDateTime = (file: C3DFile): string | null => {
  // ⭐ PRIORITY 1: Full timestamp from filename (includes time)
  const timestamp = extractTimestampFromFilename(file.name);
  if (timestamp) {
    return timestamp;
  }
  
  // ⭐ PRIORITY 2: C3D Metadata with time
  if (file.metadata?.session_date) {
    // Check if it already includes time
    if (file.metadata.session_date.includes('T')) {
      return file.metadata.session_date;
    }
    // Add midnight time for consistent format
    return `${file.metadata.session_date}T00:00:00`;
  }
  
  // 🔄 Alternative C3D Field
  if (file.metadata?.time) {
    // Check if it's already a full timestamp
    if (file.metadata.time.includes('T')) {
      return file.metadata.time;
    }
    return `${file.metadata.time}T00:00:00`;
  }
  
  return null;
};

/**
 * 🎨 BADGE STYLING FUNCTIONS
 * 
 * Consistent badge styling for Patient and Therapist IDs
 * Differentiates between known IDs (blue) and unknown IDs (grey)
 */
export const getPatientIdBadgeProps = (patientId: string): BadgeProps => {
  const color = getPatientColors(patientId);
  return {
    variant: 'secondary' as const,
    className: `${color.background} ${color.text} ${color.border} text-xs`
  };
};

export const getTherapistIdBadgeProps = (therapistId: string): BadgeProps => {
  const color = getTherapistColors(therapistId);
  return {
    variant: 'outline' as const,
    className: `${color.text} ${color.border} text-xs`
  };
};

/**
 * 📊 UTILITY FUNCTIONS
 * 
 * File size, date formatting, and categorization utilities
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);
  
  // Smart formatting: no decimals for small values, 1 decimal for larger
  if (i === 0) return `${size} ${sizes[i]}`; // Bytes - no decimals
  if (size >= 100) return `${Math.round(size)} ${sizes[i]}`; // 100+ KB/MB - no decimals
  if (size >= 10) return `${size.toFixed(1)} ${sizes[i]}`; // 10-99.9 - 1 decimal
  return `${size.toFixed(1)} ${sizes[i]}`; // < 10 - 1 decimal
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-GB', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit'
  });
};

export const formatFullDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * 📅 FORMAT SESSION DATETIME WITH TIME AWARENESS
 * 
 * Displays date with time when available, date-only otherwise
 * Provides user-friendly format for session timestamps
 */
export const formatSessionDateTime = (dateTimeString: string | null): string => {
  if (!dateTimeString) return 'Unknown';
  
  try {
    const date = new Date(dateTimeString);
    
    // Check if time component exists (not midnight from fallback)
    const hasTime = dateTimeString.includes('T') && 
                   !dateTimeString.endsWith('T00:00:00');
    
    if (hasTime) {
      // Full datetime format with time
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }
    
    // Date-only format
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return 'Invalid date';
  }
};

/**
 * 🕐 GET TIME OF DAY CATEGORY
 * 
 * Categorizes time into morning/afternoon/evening
 * Useful for filtering sessions by time period
 */
export const getTimeOfDay = (dateTimeString: string | null): 'morning' | 'afternoon' | 'evening' | null => {
  if (!dateTimeString || !dateTimeString.includes('T')) return null;
  
  try {
    const date = new Date(dateTimeString);
    const hour = date.getHours();
    
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 || hour < 6) return 'evening';
    
    return null;
  } catch (e) {
    return null;
  }
};

export const isShortSession = (bytes: number): boolean => {
  return bytes < 750000; // Less than 750KB indicates potentially short session
};

export const getSizeCategory = (bytes: number): 'small' | 'medium' | 'large' => {
  if (bytes < 1000000) return 'small'; // < 1MB
  if (bytes < 2000000) return 'medium'; // 1-2MB
  return 'large'; // > 2MB
};