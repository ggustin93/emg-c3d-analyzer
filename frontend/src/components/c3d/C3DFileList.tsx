import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileIcon,
  PersonIcon,
  ArchiveIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlayIcon,
  DownloadIcon,
  ExclamationTriangleIcon
} from '@radix-ui/react-icons';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import SupabaseStorageService from '@/services/supabaseStorage';
// Clinical Notes integration
import ClinicalNotesBadge from '@/components/shared/ClinicalNotesBadge';
import AddNoteBadge from '@/components/shared/AddNoteBadge';
import { ClinicalNotesModal } from '@/components/shared/ClinicalNotesModal';
import { useAuth } from '@/contexts/AuthContext';
import {
  C3DFile,
  resolvePatientId,
  resolveTherapistId,
  resolveSessionDate,
  formatSessionDateTime,
  getPatientIdBadgeProps,
  getTherapistIdBadgeProps,
  formatFileSize,
  formatDate,
  formatFullDate,
  isShortSession
} from '@/services/C3DFileDataResolver';
import { TherapistCache } from '@/types/therapist';
import { therapistService } from '@/services/therapistService';

// Get bucket name from environment variable or use default (consistent with C3DFileBrowser)
const BUCKET_NAME = import.meta.env.VITE_STORAGE_BUCKET_NAME || 'c3d-examples';

type SortField = 'name' | 'size' | 'created_at' | 'patient_id' | 'therapist_id' | 'session_date';
type SortDirection = 'asc' | 'desc';

export interface ColumnVisibility {
  patient_id: boolean;
  patient_name: boolean;
  therapist_id: boolean;
  size: boolean;
  session_date: boolean;
  upload_date: boolean;
  clinical_notes: boolean;
}

interface C3DFileListProps {
  files: C3DFile[];
  onFileSelect: (filename: string, uploadDate?: string, fileData?: C3DFile) => void;
  isLoading?: boolean;
  className?: string;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  visibleColumns: ColumnVisibility;
  resolveSessionDate?: (file: C3DFile) => string | null;
  therapistCache?: Record<string, any>; // Therapist display cache indexed by file name
  userRole?: 'ADMIN' | 'THERAPIST' | 'RESEARCHER' | null; // New prop for role-based visibility
  // Patient data
  getPatientName?: (file: C3DFile) => string;
  // Clinical Notes props
  notesIndicators?: Record<string, number>;
  notesLoading?: boolean;
}

const C3DFileList: React.FC<C3DFileListProps> = ({
  files,
  onFileSelect,
  isLoading = false,
  className = '',
  sortField,
  sortDirection,
  onSort,
  visibleColumns,
  resolveSessionDate: customResolveSessionDate,
  therapistCache = {}, // Therapist display cache
  userRole: propUserRole, // Accept userRole from props
  // Patient data
  getPatientName,
  // Clinical Notes props
  notesIndicators = {},
  notesLoading = false
}) => {
  // Auth context for role-based rendering (fallback if not provided via props)
  const { userRole: contextUserRole } = useAuth();
  const userRole = propUserRole !== undefined ? propUserRole : contextUserRole;

  // UI states
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  
  // Clinical Notes modal state
  const [selectedFile, setSelectedFile] = useState<C3DFile | null>(null);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  
  // Helper function to get notes count for a file
  // Database stores paths without bucket prefix, so we need to strip it for lookup
  const getNotesCount = useCallback((fileName: string): number => {
    // Files in database are stored as "P001/file.c3d" but components reference "c3d-examples/P001/file.c3d"
    // We need to check both formats for compatibility during transition
    const fullPath = `${BUCKET_NAME}/${fileName}`;
    const dbPath = fileName; // Database format without bucket prefix
    
    // Try database format first (new system), then full path (legacy)
    return notesIndicators[dbPath] || notesIndicators[fullPath] || 0;
  }, [notesIndicators]);
  
  // Enhanced session date resolver
  const getSessionDate = useCallback((file: C3DFile): string | null => {
    return customResolveSessionDate ? customResolveSessionDate(file) : resolveSessionDate(file);
  }, [customResolveSessionDate]);

  // Helper function to resolve patient display based on user role
  const getPatientDisplayName = useCallback((file: C3DFile): string => {
    const patientCode = resolvePatientId(file);
    
    // THERAPIST: Show full patient names (if available)
    // RESEARCHER: Show only patient codes 
    // ADMIN: Show full patient names (if available)
    if (userRole === 'THERAPIST' || userRole === 'ADMIN') {
      // For now, we'll show the patient code until we have a proper patient names lookup
      // In the future, this could lookup full names from a patients table
      // For example: getPatientFullName(patientCode) || patientCode
      return patientCode;
    }
    
    // RESEARCHER or any other role: Only show patient code
    return patientCode;
  }, [userRole]);
  
  // Helper function to get therapist display using centralized service
  const getTherapistDisplay = useCallback((file: C3DFile): string => {
    return therapistService.getDisplayFromFileCache(file.name, therapistCache);
  }, [therapistCache]);
  
  // Column resize states
  const [filenameColumnWidth, setFilenameColumnWidth] = useState(() => {
    const saved = localStorage.getItem('c3d-filename-column-width');
    return saved ? parseInt(saved) : 300; // Default 300px
  });
  const [isResizing, setIsResizing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  // Files are already sorted and paginated by parent component

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUpIcon className="w-4 h-4 inline ml-1" /> : 
      <ChevronDownIcon className="w-4 h-4 inline ml-1" />;
  };

  const handleFileAnalyze = (fileId: string, fileName: string) => {
    setLoadingFileId(fileId);
    
    // Find the file to pass metadata
    const selectedFile = files.find(file => file.id === fileId);
    
    if (selectedFile) {
      // Pass file data for metadata, but no date (session timestamp is in filename)
      onFileSelect(fileName, undefined, selectedFile);
    } else {
      onFileSelect(fileName);
    }
  };

  const handleFileDownload = async (fileName: string) => {
    try {
      const blob = await SupabaseStorageService.downloadFile(fileName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download file:', error);
      alert(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Column resize handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    setStartX(e.clientX);
    setStartWidth(filenameColumnWidth);
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const diff = e.clientX - startX;
    const newWidth = Math.max(200, Math.min(600, startWidth + diff)); // Min 200px, Max 600px
    setFilenameColumnWidth(newWidth);
  }, [isResizing, startX, startWidth]);

  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      localStorage.setItem('c3d-filename-column-width', filenameColumnWidth.toString());
    }
  }, [isResizing, filenameColumnWidth]);

  // Add global mouse events for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Reset loading state when general loading finishes
  useEffect(() => {
    if (!isLoading) {
      setLoadingFileId(null);
    }
  }, [isLoading]);

  if (files.length === 0) {
    return (
      <div className={`text-center py-8 text-slate-500 ${className}`}>
        <FileIcon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
        <p className="font-medium">No files found</p>
        <p className="text-sm">Try adjusting your filters or upload new files</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={className}>

        {/* Table Header */}
        <div className="hidden md:flex gap-4 text-sm font-medium text-slate-600 border-b pb-2 pt-1">
          <div className="relative" style={{ width: `${filenameColumnWidth}px` }}>
            <button 
              onClick={() => onSort('name')}
              className="flex items-center hover:text-slate-800 transition-colors"
            >
              <FileIcon className="w-4 h-4 mr-2" />
              File Name
              {getSortIcon('name')}
            </button>
            {/* Resize handle */}
            <div
              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-300 transition-colors group flex items-center justify-center"
              onMouseDown={handleMouseDown}
            >
              <div className="w-0.5 h-6 bg-gray-300 group-hover:bg-blue-500 transition-colors rounded-sm opacity-60 group-hover:opacity-100" />
            </div>
          </div>
          {visibleColumns.patient_id && (
            <div className="flex-1 min-w-0">
              <button 
                onClick={() => onSort('patient_id')}
                className="flex items-center hover:text-slate-800 transition-colors text-xs"
              >
                <PersonIcon className="w-4 h-4 mr-1" />
                Patient ID
                {getSortIcon('patient_id')}
              </button>
            </div>
          )}
          {(userRole === 'ADMIN' || userRole === 'THERAPIST') && visibleColumns.patient_name && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center text-xs">
                <PersonIcon className="w-4 h-4 mr-1" />
                Patient Name
              </div>
            </div>
          )}
          {visibleColumns.therapist_id && userRole !== 'THERAPIST' && (
            <div className="flex-1 min-w-0">
              <button 
                onClick={() => onSort('therapist_id')}
                className="flex items-center hover:text-slate-800 transition-colors text-xs"
              >
                <PersonIcon className="w-4 h-4 mr-1" />
                Therapist
                {getSortIcon('therapist_id')}
              </button>
            </div>
          )}
          {visibleColumns.size && (
            <div className="flex-1 min-w-0">
              <button 
                onClick={() => onSort('size')}
                className="flex items-center hover:text-slate-800 transition-colors text-xs"
              >
                <ArchiveIcon className="w-4 h-4 mr-1" />
                Size
                {getSortIcon('size')}
              </button>
            </div>
          )}
          {visibleColumns.session_date && (
            <div className="flex-1 min-w-0">
              <button 
                onClick={() => onSort('session_date')}
                className="flex items-center hover:text-slate-800 transition-colors text-xs"
              >
                <CalendarIcon className="w-4 h-4 mr-1" />
                Session Date
                {getSortIcon('session_date')}
              </button>
            </div>
          )}
          {visibleColumns.upload_date && (
            <div className="flex-1 min-w-0">
              <button 
                onClick={() => onSort('created_at')}
                className="flex items-center hover:text-slate-800 transition-colors text-xs"
              >
                <CalendarIcon className="w-4 h-4 mr-1" />
                Upload Date
                {getSortIcon('created_at')}
              </button>
            </div>
          )}
          {visibleColumns.clinical_notes && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center text-xs">
                <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10,9 9,9 8,9"/>
                </svg>
                Clinical Notes
              </div>
            </div>
          )}
          <div className="w-20 text-xs">
            Actions
          </div>
        </div>

        {/* File List */}
        <div className="space-y-2">
          {files.map((file) => {
            const shortSession = isShortSession(file.size);
            return (
              <div key={file.id} 
                  className={`flex flex-col md:flex-row gap-2 md:gap-4 items-start md:items-center py-2 px-4 rounded-lg transition-all duration-200 border ${
                    loadingFileId === file.id 
                      ? 'bg-primary/10 border-primary/30 shadow-sm' 
                      : 'border-slate-100 hover:bg-slate-50 hover:border-slate-200 hover:shadow-sm'
                  }`}
                >
                  {/* Mobile Layout */}
                  <div className="md:hidden space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {loadingFileId === file.id ? (
                          <div className="relative mr-3 flex-shrink-0">
                            <FileIcon className="w-4 h-4 text-primary" />
                            <div className="absolute -top-1 -right-1">
                              <svg 
                                className="animate-spin w-2 h-2 text-primary" 
                                xmlns="http://www.w3.org/2000/svg" 
                                fill="none" 
                                viewBox="0 0 24 24"
                              >
                                <circle 
                                  className="opacity-25" 
                                  cx="12" 
                                  cy="12" 
                                  r="10" 
                                  stroke="currentColor" 
                                  strokeWidth="4"
                                />
                                <path 
                                  className="opacity-75" 
                                  fill="currentColor" 
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                              </svg>
                            </div>
                          </div>
                        ) : (
                          <FileIcon className="w-4 h-4 mr-3 text-blue-500 flex-shrink-0" />
                        )}
                        <span className={`text-sm font-semibold truncate ${
                          loadingFileId === file.id ? 'text-primary' : 'text-slate-900'
                        }`}>
                          {file.name}
                        </span>
                        {shortSession && (
                          <Tooltip>
                            <TooltipTrigger>
                              <ExclamationTriangleIcon className="w-4 h-4 ml-2 text-amber-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Short session: File size suggests therapy session may be incomplete</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600 flex-wrap">
                      {visibleColumns.patient_id && (
                        <div className="flex items-center gap-2">
                          <span>Patient:</span>
                          <Badge {...getPatientIdBadgeProps(resolvePatientId(file))}>
                            {getPatientDisplayName(file)}
                          </Badge>
                        </div>
                      )}
                      {(userRole === 'ADMIN' || userRole === 'THERAPIST') && visibleColumns.patient_name && getPatientName && (
                        <div className="flex items-center gap-2">
                          <span>Patient Name:</span>
                          <span className="text-slate-700 text-xs">
                            {getPatientName(file) || 'Unknown'}
                          </span>
                        </div>
                      )}
                      {visibleColumns.therapist_id && userRole !== 'THERAPIST' && (
                        <div className="flex items-center gap-2">
                          <span>Therapist:</span>
                          <Badge {...getTherapistIdBadgeProps(getTherapistDisplay(file))}>
                            {getTherapistDisplay(file)}
                          </Badge>
                        </div>
                      )}
                      {visibleColumns.size && (
                        <div className="flex items-center">
                          <span>{formatFileSize(file.size)}</span>
                          {shortSession && (
                            <Tooltip>
                              <TooltipTrigger>
                                <ExclamationTriangleIcon className="w-4 h-4 ml-2 text-amber-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Short session: File size suggests therapy session may be incomplete</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      )}
                      {visibleColumns.session_date && getSessionDate(file) && (
                        <div className="flex items-center gap-2">
                          <span>Session:</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-slate-700 text-xs cursor-help hover:text-slate-900 transition-colors">
                                {formatSessionDateTime(getSessionDate(file))}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Full timestamp: {formatFullDate(getSessionDate(file)!)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                      {visibleColumns.upload_date && (
                        <div className="flex items-center gap-2">
                          <span>Upload:</span>
                          <span className="text-slate-600 text-xs">
                            {formatDate(file.created_at)}
                          </span>
                        </div>
                      )}
                      {visibleColumns.clinical_notes && (
                        <div className="flex items-center gap-2">
                          <span>Notes:</span>
                          {/* Show badge if notes exist, otherwise show add button */}
                          {getNotesCount(file.name) > 0 ? (
                            <ClinicalNotesBadge 
                              count={getNotesCount(file.name)}
                              type="file"
                              onClick={() => {
                                setSelectedFile(file);
                                setNotesModalOpen(true);
                              }}
                              loading={notesLoading}
                            />
                          ) : (
                            <AddNoteBadge 
                              type="file"
                              onClick={() => {
                                setSelectedFile(file);
                                setNotesModalOpen(true);
                              }}
                              disabled={notesLoading}
                              className="ml-1"
                            />
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="default"
                            variant={loadingFileId === file.id ? "default" : "default"}
                            onClick={() => handleFileAnalyze(file.id, file.name)}
                            disabled={isLoading || loadingFileId !== null}
                            className={`w-12 h-9 p-0 transition-all duration-200 flex items-center justify-center ${
                              loadingFileId === file.id 
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm' 
                                : 'bg-primary hover:bg-primary/90 text-white border-primary hover:shadow-md'
                            } disabled:opacity-60 disabled:cursor-not-allowed`}
                          >
                            {loadingFileId === file.id ? (
                              <svg 
                                className="animate-spin w-4 h-4 text-white" 
                                xmlns="http://www.w3.org/2000/svg" 
                                fill="none" 
                                viewBox="0 0 24 24"
                              >
                                <circle 
                                  className="opacity-25" 
                                  cx="12" 
                                  cy="12" 
                                  r="10" 
                                  stroke="currentColor" 
                                  strokeWidth="4"
                                />
                                <path 
                                  className="opacity-75" 
                                  fill="currentColor" 
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                              </svg>
                            ) : (
                              <PlayIcon className="w-4 h-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{loadingFileId === file.id ? `Analyzing ${file.name}` : `Analyze ${file.name}`}</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="default"
                            variant="outline"
                            onClick={() => handleFileDownload(file.name)}
                            disabled={isLoading || loadingFileId !== null}
                            className="w-12 h-9 p-0 transition-all duration-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <DownloadIcon className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Download {file.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Desktop Layout */}
                  <div className="hidden md:flex w-full items-center">
                    <div 
                      className="px-3 py-2 flex-shrink-0"
                      style={{ width: `${filenameColumnWidth}px` }}
                    >
                      <div className="flex items-center">
                        {loadingFileId === file.id ? (
                          <div className="relative mr-3 flex-shrink-0">
                            <FileIcon className="w-4 h-4 text-primary" />
                            <div className="absolute -top-1 -right-1">
                              <svg 
                                className="animate-spin w-2 h-2 text-primary" 
                                xmlns="http://www.w3.org/2000/svg" 
                                fill="none" 
                                viewBox="0 0 24 24"
                              >
                                <circle 
                                  className="opacity-25" 
                                  cx="12" 
                                  cy="12" 
                                  r="10" 
                                  stroke="currentColor" 
                                  strokeWidth="4"
                                />
                                <path 
                                  className="opacity-75" 
                                  fill="currentColor" 
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                              </svg>
                            </div>
                          </div>
                        ) : (
                          <FileIcon className="w-4 h-4 mr-3 text-blue-500 flex-shrink-0" />
                        )}
                        <span className={`text-sm font-semibold truncate ${
                          loadingFileId === file.id ? 'text-primary' : 'text-slate-900'
                        }`}>
                          {file.name}
                        </span>
                      </div>
                    </div>
                    {visibleColumns.patient_id && (
                      <div className="px-3 py-2 flex-1 min-w-0">
                        <div className="flex items-center">
                          <Badge {...getPatientIdBadgeProps(resolvePatientId(file))}>
                            {getPatientDisplayName(file)}
                          </Badge>
                        </div>
                      </div>
                    )}
                    {(userRole === 'ADMIN' || userRole === 'THERAPIST') && visibleColumns.patient_name && (
                      <div className="px-3 py-2 flex-1 min-w-0">
                        <div className="flex items-center">
                          <span className="text-sm text-slate-600">
                            {getPatientName ? (getPatientName(file) || 'Unknown') : 'N/A'}
                          </span>
                        </div>
                      </div>
                    )}
                    {visibleColumns.therapist_id && userRole !== 'THERAPIST' && (
                      <div className={`px-3 py-2 min-w-0 ${userRole === 'ADMIN' ? 'flex-1' : 'flex-[2]'}`}>
                        <div className="flex items-center">
                          <Badge {...getTherapistIdBadgeProps(getTherapistDisplay(file))}>
                            {getTherapistDisplay(file)}
                          </Badge>
                        </div>
                      </div>
                    )}
                    {visibleColumns.size && (
                      <div className="px-3 py-2 flex-1 min-w-0">
                        <div className="flex items-center">
                          <span className="text-sm text-slate-600">
                            {formatFileSize(file.size)}
                          </span>
                          {shortSession && (
                            <Tooltip>
                              <TooltipTrigger>
                                <ExclamationTriangleIcon className="w-4 h-4 ml-2 text-amber-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Short session: File size suggests therapy session may be incomplete</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    )}
                    {visibleColumns.session_date && (
                      <div className="px-3 py-2 flex-1 min-w-0">
                        {getSessionDate(file) ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-slate-700 text-xs cursor-help hover:text-slate-900 transition-colors">
                                {formatSessionDateTime(getSessionDate(file))}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Full timestamp: {formatFullDate(getSessionDate(file)!)}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-slate-400 text-xs">
                            N/A
                          </span>
                        )}
                      </div>
                    )}
                    {visibleColumns.upload_date && (
                      <div className="px-3 py-2 flex-1 min-w-0">
                        <span className="text-slate-600 text-xs">
                          {formatDate(file.created_at)}
                        </span>
                      </div>
                    )}
                    {visibleColumns.clinical_notes && (
                      <div className="px-3 py-2 flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          {/* Show badge if notes exist, otherwise show add button */}
                          {getNotesCount(file.name) > 0 ? (
                            <ClinicalNotesBadge 
                              count={getNotesCount(file.name)}
                              type="file"
                              onClick={() => {
                                setSelectedFile(file);
                                setNotesModalOpen(true);
                              }}
                              loading={notesLoading}
                            />
                          ) : (
                            <AddNoteBadge 
                              type="file"
                              onClick={() => {
                                setSelectedFile(file);
                                setNotesModalOpen(true);
                              }}
                              disabled={notesLoading}
                            />
                          )}
                        </div>
                      </div>
                    )}
                    <div className="px-3 py-2 w-20 flex gap-1 justify-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="default"
                            variant={loadingFileId === file.id ? "default" : "default"}
                            onClick={() => handleFileAnalyze(file.id, file.name)}
                            disabled={isLoading || loadingFileId !== null}
                            className={`w-10 h-9 p-0 transition-all duration-200 flex items-center justify-center ${
                              loadingFileId === file.id 
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm' 
                                : 'bg-primary hover:bg-primary/90 text-white border-primary hover:shadow-md'
                            } disabled:opacity-60 disabled:cursor-not-allowed`}
                          >
                            {loadingFileId === file.id ? (
                              <svg 
                                className="animate-spin w-4 h-4 text-white" 
                                xmlns="http://www.w3.org/2000/svg" 
                                fill="none" 
                                viewBox="0 0 24 24"
                              >
                                <circle 
                                  className="opacity-25" 
                                  cx="12" 
                                  cy="12" 
                                  r="10" 
                                  stroke="currentColor" 
                                  strokeWidth="4"
                                />
                                <path 
                                  className="opacity-75" 
                                  fill="currentColor" 
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                              </svg>
                            ) : (
                              <PlayIcon className="w-4 h-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{loadingFileId === file.id ? `Analyzing ${file.name}` : `Analyze ${file.name}`}</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="default"
                            variant="outline"
                            onClick={() => handleFileDownload(file.name)}
                            disabled={isLoading || loadingFileId !== null}
                            className="w-10 h-9 p-0 transition-all duration-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <DownloadIcon className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Download {file.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
            );
          })}
        </div>
        
        {/* Clinical Notes Modal */}
        {selectedFile && (
          <ClinicalNotesModal
            isOpen={notesModalOpen}
            onClose={() => {
              setNotesModalOpen(false);
              setSelectedFile(null);
            }}
            noteType="file"
            targetId={selectedFile.name}
            targetDisplayName={`File: ${selectedFile.name.split('/').pop() || selectedFile.name}`}
            onNotesChanged={() => {
              // Trigger global refresh event
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('clinical-notes-changed', { 
                  detail: { targetId: selectedFile.name } 
                }));
              }
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
};

export default C3DFileList;