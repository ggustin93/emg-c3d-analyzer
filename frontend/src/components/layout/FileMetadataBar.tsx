import React, { useCallback } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  FileIcon, 
  PersonIcon, 
  CalendarIcon, 
  ClockIcon, 
  ActivityLogIcon,
  ChevronRightIcon,
  ArchiveIcon
} from '@radix-ui/react-icons';
import { EMGAnalysisResult } from '../../types/emg';
import { 
  resolvePatientId, 
  resolveTherapistId,
  resolveSessionDate, 
  getPatientIdBadgeProps,
  getTherapistIdBadgeProps,
  C3DFile
} from '../../services/C3DFileDataResolver';

/**
 * 🔧 CONFIGURABLE DATA RETRIEVAL PRIORITIES
 * 
 * Consistent with C3DFileBrowser - Same priority system:
 * 
 * 🏥 PATIENT ID RESOLUTION:
 * 1. Storage Subfolder (P005/, P008/, P012/) - HIGHEST PRIORITY
 * 2. C3D Metadata (metadata.player_name) - FALLBACK
 * 
 * 📅 SESSION DATE RESOLUTION:
 * 1. Filename Extraction (YYYYMMDD patterns) - HIGHEST PRIORITY  
 * 2. C3D Metadata (metadata.session_date, metadata.time) - FALLBACK
 * 
 * To modify priorities, see resolvePatientId() and resolveSessionDate() functions.
 */

interface FileMetadataBarProps {
  analysisResult: EMGAnalysisResult;
  onReset?: () => void;
  uploadDate?: string | null; // Optional upload date from file browser
  // Additional props from C3DFileBrowser row data
  patientName?: string; // Patient first name + last initial from getPatientName
  fileSize?: number; // File size in bytes
  therapistDisplay?: string; // Therapist name from therapistCache
  clinicalNotesCount?: number; // Number of clinical notes
}

/**
 * Dedicated component for displaying C3D file metadata and navigation
 * Provides clinical context including patient info, therapist, and session details
 */
const FileMetadataBar: React.FC<FileMetadataBarProps> = ({ 
  analysisResult, 
  onReset, 
  uploadDate,
  patientName,
  fileSize,
  therapistDisplay,
  clinicalNotesCount 
}) => {
  const { source_filename, metadata, patient_id, file_id } = analysisResult;
  
  // Create a mock C3DFile object to pass to the resolvers
  // This ensures that we can reuse the centralized logic
  const mockFile: C3DFile = {
    id: file_id || source_filename, // Use a stable ID
    name: source_filename,
    metadata: metadata,
    patient_id: patient_id ?? undefined,
    therapist_id: metadata?.therapist_id ?? undefined,
    size: 0, // Mock value, not used in resolvers here
    created_at: new Date().toISOString(), // Mock value
    updated_at: new Date().toISOString(), // Mock value
  };

  // Apply consistent data resolution from the centralized resolver
  const resolvedPatientId = resolvePatientId(mockFile);
  const resolvedSessionDate = resolveSessionDate(mockFile);
  // ✅ CONSISTENT WITH C3DFileBrowser: Use the same resolver for therapist ID
  // This ensures DEV mode fake names work consistently across both components
  const resolvedTherapistId = resolveTherapistId(mockFile);

  
  const patientBadgeProps = getPatientIdBadgeProps(resolvedPatientId);
  const therapistBadgeProps = getTherapistIdBadgeProps(resolvedTherapistId || 'Unknown');
  
  // Debug info removed for test compatibility

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const formatDuration = (duration: number | null | undefined) => {
    if (!duration) return 'N/A';
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatUploadDate = (dateString: string | undefined): string => {
    if (!dateString) {
      return 'N/A';
    }
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'N/A';
      }
      
      return date.toLocaleDateString('en-GB', {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  // Helper function to format file size
  const formatFileSize = (sizeBytes?: number): string => {
    if (!sizeBytes) return 'N/A';
    
    if (sizeBytes < 1024) return `${sizeBytes} B`;
    if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
    if (sizeBytes < 1024 * 1024 * 1024) return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return (
    <div className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 shadow-sm mb-6">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Breadcrumb Navigation with clickable Sessions */}
          <nav className="flex items-center space-x-1 text-sm" aria-label="Breadcrumb">
            <div className="flex items-center">
              <ArchiveIcon className="h-4 w-4 text-slate-500 mr-2" />
              {onReset ? (
                <button 
                  onClick={onReset}
                  className="text-blue-600 hover:text-blue-800 font-medium transition-colors underline-offset-4 hover:underline"
                >
                  Sessions
                </button>
              ) : (
                <span className="text-slate-600 font-medium">Sessions</span>
              )}
            </div>
            
            <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
            
            <div className="flex items-center">
              <FileIcon className="h-4 w-4 text-primary mr-2" />
              <span className="text-foreground font-semibold truncate max-w-md" data-testid="filename">
                {source_filename}
              </span>
            </div>
          </nav>
        </div>

        {/* File Details Row - Enhanced with secondary colors and C3DFileList patterns */}
        <div className="flex items-center flex-wrap gap-4 text-xs text-muted-foreground mt-3 pt-3 border-t border-muted">
          {/* Patient ID */}
          {resolvedPatientId !== 'Unknown' && (
            <div className="flex items-center gap-1.5">
              <ActivityLogIcon className="h-3.5 w-3.5 text-muted-foreground/70" />
              <Badge {...patientBadgeProps} className="h-5 text-xs">
                {resolvedPatientId}
              </Badge>
            </div>
          )}

          {/* Patient Name - Use prop from C3DFileBrowser */}
          {patientName && (
            <div className="flex items-center gap-1.5">
              <PersonIcon className="h-3.5 w-3.5 text-muted-foreground/70" />
              <span className="text-secondary-foreground font-medium">{patientName}</span>
            </div>
          )}

          {/* Therapist - Use prop from C3DFileBrowser */}
          {(therapistDisplay || (resolvedTherapistId && resolvedTherapistId !== 'Unknown')) && (
            <div className="flex items-center gap-1.5" data-testid="therapist-section">
              <PersonIcon className="h-3.5 w-3.5 text-muted-foreground/70" />
              <Badge {...therapistBadgeProps} className="h-5 text-xs">
                {therapistDisplay || resolvedTherapistId}
              </Badge>
            </div>
          )}

          {/* Session Date with tooltip like C3DFileList */}
          <div className="flex items-center gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground/70" />
            {resolvedSessionDate ? (
              <span className="text-secondary-foreground cursor-help hover:text-foreground transition-colors"
                    title={`Full timestamp: ${new Date(resolvedSessionDate).toLocaleString()}`}>
                {formatDate(resolvedSessionDate)}
              </span>
            ) : (
              <span className="text-muted-foreground">N/A</span>
            )}
          </div>

          {/* File Size with session quality indicator like C3DFileList */}
          <div className="flex items-center gap-1.5">
            <ArchiveIcon className="h-3.5 w-3.5 text-muted-foreground/70" />
            <span className="text-secondary-foreground">{formatFileSize(fileSize)}</span>
            {/* Short session indicator based on C3DFileList logic */}
            {fileSize && fileSize < 50000 && (
              <span className="text-amber-600 text-xs" title="Short session: File size suggests therapy session may be incomplete">
                ⚠️ Short
              </span>
            )}
          </div>

          {/* Duration */}
          {metadata?.session_duration && (
            <div className="flex items-center gap-1.5">
              <ClockIcon className="h-3.5 w-3.5 text-muted-foreground/70" />
              <span className="text-secondary-foreground">{formatDuration(metadata.session_duration)}</span>
            </div>
          )}

          {/* Clinical Notes Count with enhanced display like C3DFileList */}
          {clinicalNotesCount !== undefined && (
            <div className="flex items-center gap-1.5">
              <FileIcon className="h-3.5 w-3.5 text-muted-foreground/70" />
              {clinicalNotesCount > 0 ? (
                <span className="text-secondary-foreground font-medium">
                  {clinicalNotesCount} note{clinicalNotesCount !== 1 ? 's' : ''}
                </span>
              ) : (
                <span className="text-muted-foreground">No notes</span>
              )}
            </div>
          )}

          {/* Session Quality Indicators */}
          {metadata?.session_notes && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs bg-muted px-2 py-1 rounded text-secondary-foreground">
                📝 Has Notes
              </span>
            </div>
          )}

          {/* Upload Date */}
          <div className="flex items-center gap-1.5 text-muted-foreground/80">
            <span>Uploaded {uploadDate ? formatUploadDate(uploadDate) : 'N/A'}</span>
          </div>
        </div>

        {/* Session Notes (if present) */}
        {metadata?.session_notes && (
          <div className="mt-3 pt-3 border-t border-muted">
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground text-xs mt-0.5">Session Notes:</span>
              <span className="text-secondary-foreground text-xs italic leading-relaxed">
                {metadata.session_notes}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileMetadataBar;