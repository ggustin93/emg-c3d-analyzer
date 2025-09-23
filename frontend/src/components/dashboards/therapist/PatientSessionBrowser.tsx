import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { navigateToAnalysis } from '@/utils/navigationUtils';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Spinner from '@/components/ui/Spinner';
import C3DFileList, { ColumnVisibility } from '@/components/c3d/C3DFileList';
import C3DPagination from '@/components/c3d/C3DPagination';

// Icons
import { 
  FileIcon,
  ExclamationTriangleIcon,
  ReloadIcon,
  ViewGridIcon,
  CheckCircledIcon
} from '@radix-ui/react-icons';

// Services & Hooks
import { useAuth } from '@/contexts/AuthContext';
import SupabaseStorageService from '@/services/supabaseStorage';
import { TherapySessionsService, TherapySession } from '@/services/therapySessionsService';
import { logger, LogCategory } from '@/services/logger';
import { 
  C3DFile,
  resolvePatientId,
  resolveSessionDateTime
} from '@/services/C3DFileDataResolver';
import useSimpleNotesCount from '@/hooks/useSimpleNotesCount';

// Get bucket name from environment variable or use default
const BUCKET_NAME = import.meta.env.VITE_STORAGE_BUCKET_NAME || 'c3d-examples';

type SortField = 'name' | 'size' | 'created_at' | 'patient_id' | 'therapist_id' | 'session_date';
type SortDirection = 'asc' | 'desc';

interface PatientSessionBrowserProps {
  patientCode: string;
  onFileSelect?: (filename: string, uploadDate?: string) => void;
}

const PatientSessionBrowser: React.FC<PatientSessionBrowserProps> = ({
  patientCode,
  onFileSelect
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Core states
  const [files, setFiles] = useState<C3DFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Session data state
  const [sessionData, setSessionData] = useState<Record<string, TherapySession>>({});
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [filesPerPage] = useState(5); // Smaller page size for patient view
  
  // Sort states
  const [sortField, setSortField] = useState<SortField>('session_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Column visibility - simplified for patient view
  const [visibleColumns] = useState<ColumnVisibility>({
    patient_id: false, // Hide patient ID since we're filtering by it
    patient_name: false, // Hide patient name since we're filtering by it
    therapist_id: false, // Hide therapist ID in patient view
    size: true,
    session_date: true,
    upload_date: false,
    clinical_notes: true
  });
  
  // Simple notes count hook
  const simpleNotes = useSimpleNotesCount(true);
  
  // Listen for notes changes and refresh indicators
  useEffect(() => {
    const handleNotesRefresh = () => {
      simpleNotes.refreshNotes();
    };

    window.addEventListener('clinical-notes-changed', handleNotesRefresh as EventListener);
    
    return () => {
      window.removeEventListener('clinical-notes-changed', handleNotesRefresh as EventListener);
    };
  }, [simpleNotes.refreshNotes]);

  // Load session data for files
  const loadSessionData = useCallback(async (fileList: C3DFile[]) => {
    if (!fileList.length) return;

    try {
      const filePaths = fileList.map(file => `${BUCKET_NAME}/${file.name}`);
      const sessions = await TherapySessionsService.getSessionsByFilePaths(filePaths);
      setSessionData(sessions);
    } catch (error) {
      logger.warn(LogCategory.API, 'Failed to load session data:', error);
    }
  }, []);

  // Enhanced session date resolver
  const resolveEnhancedSessionDate = useCallback((file: C3DFile): string | null => {
    const filePath = `${BUCKET_NAME}/${file.name}`;
    const session = sessionData[filePath];
    
    if (session?.session_date) {
      return session.session_date;
    }
    
    if (session?.game_metadata?.time) {
      return session.game_metadata.time;
    }
    
    return resolveSessionDateTime(file);
  }, [sessionData]);

  // Load C3D files for this patient
  useEffect(() => {
    const loadPatientFiles = async () => {
      if (!user) {
        setError('Please sign in to view session history');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      
      try {
        // Get all C3D files
        const fileList = await SupabaseStorageService.listC3DFiles();
        
        // Filter files for this patient
        const patientFiles = fileList.filter(file => {
          const patientId = resolvePatientId(file);
          return patientId === patientCode;
        });

        setFiles(patientFiles);
        
        // Load session data for these files
        await loadSessionData(patientFiles);
        
      } catch (err: any) {
        logger.error(LogCategory.DATA_PROCESSING, 'Failed to load patient files:', err);
        setError('Failed to load session files. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadPatientFiles();
  }, [user, patientCode, loadSessionData]);

  // Sorted files
  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortField === 'session_date') {
        aValue = resolveEnhancedSessionDate(a);
        bValue = resolveEnhancedSessionDate(b);
        // Handle null values
        if (!aValue && !bValue) return 0;
        if (!aValue) return sortDirection === 'asc' ? 1 : -1;
        if (!bValue) return sortDirection === 'asc' ? -1 : 1;
      } else {
        aValue = a[sortField as keyof C3DFile];
        bValue = b[sortField as keyof C3DFile];
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        const comparison = aValue - bValue;
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      // For dates
      if (sortField === 'created_at' || sortField === 'session_date') {
        const comparison = new Date(aValue).getTime() - new Date(bValue).getTime();
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      return 0;
    });
  }, [files, sortField, sortDirection, resolveEnhancedSessionDate]);

  // Pagination calculations
  const totalFiles = sortedFiles.length;
  const totalPages = Math.ceil(totalFiles / filesPerPage);
  const startIndex = (currentPage - 1) * filesPerPage;
  const endIndex = startIndex + filesPerPage;
  const paginatedFiles = sortedFiles.slice(startIndex, endIndex);

  // Reset to first page when sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sortField, sortDirection]);

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Custom file select handler with analysis trigger
  const handleFileSelect = async (filename: string, uploadDate?: string) => {
    if (onFileSelect) {
      onFileSelect(filename, uploadDate);
    } else {
      // Navigate to analysis page - session timestamp is in filename (SSoT principle)
      logger.info(LogCategory.DATA_PROCESSING, `🚀 Navigating to analysis for file: ${filename}`);
      
      // Use centralized navigation utility
      navigateToAnalysis(navigate, filename);
    }
  };

  // Retry loading
  const retryLoadFiles = () => {
    window.location.reload();
  };

  // Get session stats
  const sessionStats = useMemo(() => {
    const processedSessions = files.filter(file => {
      const filePath = `${BUCKET_NAME}/${file.name}`;
      return sessionData[filePath]?.processing_status === 'completed';
    });

    return {
      total: files.length,
      processed: processedSessions.length
    };
  }, [files, sessionData]);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Spinner />
            <p className="text-sm text-slate-500 mt-2">Loading session history...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="py-12">
          <div className="text-center text-red-600">
            <ExclamationTriangleIcon className="h-12 w-12 mx-auto mb-4" />
            <p className="font-medium">Error Loading Sessions</p>
            <p className="text-sm mt-1 max-w-md mx-auto">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={retryLoadFiles}
              className="mt-4"
            >
              <ReloadIcon className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sortedFiles.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="py-12">
          <div className="text-center">
            <FileIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Sessions Found</h4>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              No C3D files have been uploaded for patient {patientCode} yet.
              Sessions will appear here once therapy data is uploaded.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Badge variant="outline">0 Sessions</Badge>
              <Badge variant="outline">No Data</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-4">
      <Card className="w-full">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2 text-slate-900">
                <ViewGridIcon className="w-5 h-5 text-blue-600" />
                Session History
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                {totalFiles} session{totalFiles !== 1 ? 's' : ''} recorded for patient {patientCode}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Session Statistics */}
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1">
                  <CheckCircledIcon className="h-4 w-4 text-green-600" />
                  <span className="font-medium">{sessionStats.processed}</span>
                  <span className="text-muted-foreground">processed</span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Reuse the C3DFileList component */}
          <C3DFileList
            files={paginatedFiles}
            onFileSelect={handleFileSelect}
            isLoading={false}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            visibleColumns={visibleColumns}
            resolveSessionDate={resolveEnhancedSessionDate}
            notesIndicators={simpleNotes.notesCount}
            notesLoading={simpleNotes.loading}
          />

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t">
              <C3DPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalFiles}
                itemsPerPage={filesPerPage}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PatientSessionBrowser;