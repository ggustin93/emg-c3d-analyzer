import React, { useCallback } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { File, User, Calendar, Clock, Activity } from 'lucide-react';
import { EMGAnalysisResult } from '../../types/emg';

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
  const { source_filename, metadata, patient_id } = analysisResult;
  
  // 🔧 CONFIGURABLE DATA RETRIEVAL SYSTEM
  // Consistent with C3DFileBrowser implementation
  
  // 👥 PATIENT ID RESOLUTION STRATEGY (User-Configured Priority)
  const resolvePatientId = useCallback((filename: string, metadata: any, fallbackPatientId?: string | null): string => {
    console.log('🔍 FileMetadataBar - Resolving Patient ID for:', filename);
    
    // ⭐ PRIORITY 1: Storage Subfolder (HIGHEST PRIORITY - User Request)
    const subfolderMatch = filename.match(/^(P\d{3})\//); 
    if (subfolderMatch) {
      const patientId = subfolderMatch[1];
      console.log('✅ Patient ID from subfolder:', patientId);
      return patientId;
    }
    
    // ⭐ PRIORITY 2: C3D Metadata (FALLBACK - User Request)
    if (metadata?.player_name) {
      console.log('✅ Patient ID from C3D metadata:', metadata.player_name);
      return metadata.player_name;
    }
    
    // 🔄 Legacy Support (Lower Priority)
    if (fallbackPatientId) {
      console.log('✅ Patient ID from fallback:', fallbackPatientId);
      return fallbackPatientId;
    }
    
    console.log('❌ No Patient ID found');
    return 'Unknown';
  }, []);
  
  // 📅 SESSION DATE RESOLUTION STRATEGY (User-Configured Priority)
  const resolveSessionDate = useCallback((filename: string, metadata: any): string | null => {
    console.log('🔍 FileMetadataBar - Resolving Session Date for:', filename);
    
    // Helper function for filename extraction (consistent with C3DFileBrowser)
    const extractDateFromFilename = (filename: string): string | null => {
      // Pattern 1 & 2: YYYYMMDD format
      const yyyymmdd = filename.match(/(\d{4})(\d{2})(\d{2})/);
      if (yyyymmdd) {
        const [, year, month, day] = yyyymmdd;
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
      
      return null;
    };
    
    // ⭐ PRIORITY 1: Filename Extraction (HIGHEST PRIORITY - User Request)
    const extractedDate = extractDateFromFilename(filename);
    if (extractedDate) {
      console.log('✅ Session Date from filename:', extractedDate);
      return extractedDate;
    }
    
    // ⭐ PRIORITY 2: C3D Metadata (FALLBACK - User Request)
    if (metadata?.session_date) {
      console.log('✅ Session Date from C3D metadata:', metadata.session_date);
      return metadata.session_date;
    }
    
    // 🔄 Alternative C3D Field (Additional Fallback)
    if (metadata?.time) {
      console.log('✅ Session Date from C3D time field:', metadata.time);
      return metadata.time;
    }
    
    console.log('❌ No Session Date found');
    return null;
  }, []);
  
  // Apply consistent data resolution
  const resolvedPatientId = resolvePatientId(source_filename, metadata, patient_id);
  const resolvedSessionDate = resolveSessionDate(source_filename, metadata);

  // 🔍 DEBUG: Upload Date Troubleshooting
  console.group('🔍 FileMetadataBar Debug - Upload Date');
  console.log('🎯 FILEMETADATABAR - Props received:', {
    hasAnalysisResult: !!analysisResult,
    uploadDate,
    uploadDateType: typeof uploadDate,
    uploadDateValue: uploadDate,
    analysisResultTimestamp: analysisResult?.timestamp,
    metadataTime: metadata?.time,
    metadataSessionDate: metadata?.session_date
  });
  console.groupEnd();

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
    console.log('🕒 formatUploadDate called with:', {
      input: dateString,
      inputType: typeof dateString,
      inputLength: dateString?.length,
      isEmpty: !dateString,
      isNull: dateString === null,
      isUndefined: dateString === undefined
    });

    if (!dateString) {
      console.log('❌ Upload date is falsy, returning N/A');
      return 'N/A';
    }
    
    try {
      const date = new Date(dateString);
      console.log('📅 Date parsing:', {
        originalString: dateString,
        parsedDate: date,
        isValid: !isNaN(date.getTime()),
        timestamp: date.getTime()
      });
      
      if (isNaN(date.getTime())) {
        console.log('❌ Date is invalid, returning N/A');
        return 'N/A';
      }
      
      const formatted = date.toLocaleDateString('en-GB', {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit'
      });
      
      console.log('✅ Upload date formatted successfully:', formatted);
      return formatted;
    } catch (error) {
      console.log('❌ Error formatting upload date:', error);
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
              <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded">
                {source_filename}
              </span>
            </div>

            {/* Patient ID Resolution - Consistent with C3DFileBrowser priorities */}
            {resolvedPatientId !== 'Unknown' && (
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-slate-400" />
                <span className="text-slate-600 text-xs">Patient:</span>
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                  {resolvedPatientId}
                </Badge>
              </div>
            )}

            {/* Therapist ID */}
            {metadata?.therapist_id && (
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-slate-400" />
                <span className="text-slate-600 text-xs">Therapist:</span>
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                  {metadata.therapist_id}
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