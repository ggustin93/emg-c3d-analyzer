import React, { useCallback } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { File, User, Calendar, Clock, Activity } from 'lucide-react';
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
}

/**
 * Dedicated component for displaying C3D file metadata and navigation
 * Provides clinical context including patient info, therapist, and session details
 */
const FileMetadataBar: React.FC<FileMetadataBarProps> = ({ analysisResult, onReset, uploadDate }) => {
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
    console.log('🔍 HEEEEEEEEEEERe',resolveTherapistId);

  
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

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg shadow-sm mb-6 mt-[-30px]">
      <div className="max-w-6xl mx-auto px-4 py-3 ">
        <div className="flex items-center justify-between">
          {/* Clinical metadata section */}
          <div className="flex items-center flex-wrap gap-4 text-sm">
            {/* Filename */}
            <div className="flex items-center space-x-2">
              <File className="h-4 w-4 text-slate-400" />
              <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded" data-testid="filename">
                {source_filename}
              </span>
            </div>

            {/* Patient ID Resolution - Consistent with C3DFileBrowser priorities */}
            {resolvedPatientId !== 'Unknown' && (
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-slate-400" />
                <span className="text-slate-600 text-xs">Patient:</span>
                <Badge {...patientBadgeProps}>
                  {resolvedPatientId}
                </Badge>
              </div>
            )}

            {/* Therapist ID - Now using centralized resolver */}
            {resolvedTherapistId && resolvedTherapistId !== 'Unknown' && (
              <div className="flex items-center space-x-2" data-testid="therapist-section">
                <User className="h-4 w-4 text-slate-400" />
                <span className="text-slate-600 text-xs" data-testid="therapist-label">Therapist:</span>
                <Badge {...therapistBadgeProps}>
                  {resolvedTherapistId}
                </Badge>
              </div>
            )}

            {/* Session Date - Consistent with C3DFileBrowser priorities */}
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span className="text-slate-600 text-xs">Session:</span>
              <Badge variant="outline" className="text-slate-700 border-slate-300 text-xs">
                {formatDate(resolvedSessionDate)}
              </Badge>
            </div>

            {/* Upload Date */}
            <div className="flex items-center space-x-2">
              <span className="text-slate-600 text-xs">Upload:</span>
              <Badge variant="outline" className="text-slate-600 border-slate-300 text-xs">
                {uploadDate ? formatUploadDate(uploadDate) : 'N/A'}
              </Badge>
            </div>

            {/* Duration */}
            {metadata?.session_duration && (
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-slate-400" />
                <span className="text-slate-600 text-xs">Duration:</span>
                <Badge variant="outline" className="text-slate-700 border-slate-300 text-xs">
                  {formatDuration(metadata.session_duration)}
                </Badge>
              </div>
            )}
          </div>

          {/* Action button */}
          {onReset && (
            <div className="flex-shrink-0 ml-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onReset}
                className="text-xs"
              >
                Load Another File
              </Button>
            </div>
          )}
        </div>

        {/* Additional notes on second line if present */}
        {metadata?.session_notes && (
          <div className="flex items-center space-x-2 mt-2 pt-2 border-t border-slate-200">
            <span className="text-slate-600 text-xs">Notes:</span>
            <span className="text-slate-700 italic text-xs">
              {metadata.session_notes}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileMetadataBar;