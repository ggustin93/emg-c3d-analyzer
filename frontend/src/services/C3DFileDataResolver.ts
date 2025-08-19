import { C3DFileInfo } from '@/services/supabaseStorage';

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
  console.log('🔍 Resolving Patient ID for:', file.name);
  
  // ⭐ PRIORITY 1: Storage Subfolder (HIGHEST PRIORITY - User Request)
  const subfolderMatch = file.name.match(/^(P\d{3})\//);
  if (subfolderMatch) {
    const patientId = subfolderMatch[1];
    console.log('✅ Patient ID from subfolder:', patientId);
    return patientId;
  }
  
  // ⭐ PRIORITY 2: C3D Metadata (FALLBACK - User Request)
  if (file.metadata?.player_name) {
    console.log('✅ Patient ID from C3D metadata:', file.metadata.player_name);
    return file.metadata.player_name;
  }
  
  // 🔄 Legacy Support (Lower Priority)
  if (file.patient_id) {
    console.log('✅ Patient ID from storage metadata:', file.patient_id);
    return file.patient_id;
  }
  
  // 🔄 Filename Pattern Extraction (Last Resort)
  const filenameMatch = file.name.match(/[_-](P\d{3})[_-]/i);
  if (filenameMatch) {
    const patientId = filenameMatch[1].toUpperCase();
    console.log('✅ Patient ID from filename pattern:', patientId);
    return patientId;
  }
  
  console.log('❌ No Patient ID found');
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
  // Consistent with FileMetadataBar: metadata?.therapist_id
  // Priority: 1) metadata.therapist_id (from C3D analysis)
  //          2) therapist_id (from storage metadata)
  //          3) 'Unknown'  
  return file.metadata?.therapist_id || 
         file.therapist_id || 
         'Unknown';
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

export const resolveSessionDate = (file: C3DFile): string | null => {
  console.log('🔍 Resolving Session Date for:', file.name);
  
  // ⭐ PRIORITY 1: Filename Extraction (HIGHEST PRIORITY - User Request)
  const extractedDate = extractDateFromFilename(file.name);
  if (extractedDate) {
    console.log('✅ Session Date from filename:', extractedDate);
    return extractedDate;
  }
  
  // ⭐ PRIORITY 2: C3D Metadata (FALLBACK - User Request)
  if (file.metadata?.session_date) {
    console.log('✅ Session Date from C3D metadata:', file.metadata.session_date);
    return file.metadata.session_date;
  }
  
  // 🔄 Alternative C3D Field (Additional Fallback)
  if (file.metadata?.time) {
    console.log('✅ Session Date from C3D time field:', file.metadata.time);
    return file.metadata.time;
  }
  
  console.log('❌ No Session Date found');
  return null;
};

/**
 * 🎨 BADGE STYLING FUNCTIONS
 * 
 * Consistent badge styling for Patient and Therapist IDs
 * Differentiates between known IDs (blue) and unknown IDs (grey)
 */
export const getPatientIdBadgeProps = (patientId: string): BadgeProps => {
  if (patientId === 'Unknown') {
    return {
      variant: 'outline' as const,
      className: 'text-slate-600 border-slate-300 text-xs'
    };
  }
  
  // Use consistent blue styling like FileMetadataBar
  return {
    variant: 'secondary' as const,
    className: 'bg-blue-50 text-blue-700 border-blue-200 text-xs'
  };
};

export const getTherapistIdBadgeProps = (therapistId: string): BadgeProps => {
  if (therapistId === 'Unknown') {
    return {
      variant: 'outline' as const,
      className: 'text-slate-600 border-slate-300 text-xs'
    };
  }
  
  // Use consistent blue styling for known therapists
  return {
    variant: 'secondary' as const,
    className: 'bg-blue-50 text-blue-700 border-blue-200 text-xs'
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

export const isShortSession = (bytes: number): boolean => {
  return bytes < 750000; // Less than 750KB indicates potentially short session
};

export const getSizeCategory = (bytes: number): 'small' | 'medium' | 'large' => {
  if (bytes < 1000000) return 'small'; // < 1MB
  if (bytes < 2000000) return 'medium'; // 1-2MB
  return 'large'; // > 2MB
};