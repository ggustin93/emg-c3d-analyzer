import React from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { File, User, Calendar, Clock, Activity } from 'lucide-react';
import { EMGAnalysisResult } from '../../types/emg';

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
    <div className="bg-slate-50 border border-slate-200 rounded-lg shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3">
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

            {/* Patient ID Resolution - See /docs/patient-id-resolution.md
                Priority: 1) metadata.player_name (from C3D analysis) 
                         2) Future: folder structure in Supabase bucket
                         3) patient_id (from storage metadata) */}
            {(metadata?.player_name || patient_id) && (
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-slate-400" />
                <span className="text-slate-600 text-xs">Patient:</span>
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                  {metadata?.player_name || patient_id}
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

            {/* Session Date */}
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span className="text-slate-600 text-xs">Session:</span>
              <Badge variant="outline" className="text-slate-700 border-slate-300 text-xs">
                {formatDate(metadata?.session_date || metadata?.time)}
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