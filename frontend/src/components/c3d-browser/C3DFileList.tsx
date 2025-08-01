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
  ExclamationTriangleIcon,
  EyeOpenIcon,
  GearIcon
} from '@radix-ui/react-icons';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import SupabaseStorageService from '@/services/supabaseStorage';
import {
  C3DFile,
  resolvePatientId,
  resolveTherapistId,
  resolveSessionDate,
  getPatientIdBadgeProps,
  getTherapistIdBadgeProps,
  formatFileSize,
  formatDate,
  formatFullDate,
  isShortSession
} from '@/services/C3DFileDataResolver';

type SortField = 'name' | 'size' | 'created_at' | 'patient_id' | 'therapist_id' | 'session_date';
type SortDirection = 'asc' | 'desc';

interface ColumnVisibility {
  patient_id: boolean;
  therapist_id: boolean;
  size: boolean;
  session_date: boolean;
  upload_date: boolean;
}

interface C3DFileListProps {
  files: C3DFile[];
  onFileSelect: (filename: string, uploadDate?: string) => void;
  isLoading?: boolean;
  className?: string;
}

const C3DFileList: React.FC<C3DFileListProps> = ({
  files,
  onFileSelect,
  isLoading = false,
  className = ''
}) => {
  // Sort states
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // UI states
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  
  // Column visibility states
  const [visibleColumns, setVisibleColumns] = useState<ColumnVisibility>(() => {
    const saved = localStorage.getItem('c3d-visible-columns');
    return saved ? JSON.parse(saved) : {
      patient_id: true,
      therapist_id: true,
      size: true,
      session_date: true,
      upload_date: true
    };
  });
  
  // Column resize states
  const [filenameColumnWidth, setFilenameColumnWidth] = useState(() => {
    const saved = localStorage.getItem('c3d-filename-column-width');
    return saved ? parseInt(saved) : 300; // Default 300px
  });
  const [isResizing, setIsResizing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  // Sort files
  const sortedFiles = React.useMemo(() => {
    const sorted = [...files].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // Handle special cases - use resolved values for sorting
      if (sortField === 'patient_id') {
        aValue = resolvePatientId(a);
        bValue = resolvePatientId(b);
      } else if (sortField === 'therapist_id') {
        aValue = resolveTherapistId(a);
        bValue = resolveTherapistId(b);
      } else if (sortField === 'session_date') {
        aValue = resolveSessionDate(a);
        bValue = resolveSessionDate(b);
        // Handle null values - put them at the end
        if (!aValue && !bValue) return 0;
        if (!aValue) return sortDirection === 'asc' ? 1 : -1;
        if (!bValue) return sortDirection === 'asc' ? -1 : 1;
      } else {
        // For other fields, use direct property access
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

    return sorted;
  }, [files, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleColumnVisibility = (column: keyof ColumnVisibility) => {
    const newVisibility = {
      ...visibleColumns,
      [column]: !visibleColumns[column]
    };
    setVisibleColumns(newVisibility);
    localStorage.setItem('c3d-visible-columns', JSON.stringify(newVisibility));
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUpIcon className="w-4 h-4 inline ml-1" /> : 
      <ChevronDownIcon className="w-4 h-4 inline ml-1" />;
  };

  const handleFileAnalyze = (fileId: string, fileName: string) => {
    setLoadingFileId(fileId);
    
    // Find the file to get its upload date
    const selectedFile = files.find(file => file.id === fileId);
    console.log('🔍 C3DFileList - handleFileAnalyze:', {
      fileId,
      fileName,
      selectedFile: selectedFile ? {
        id: selectedFile.id,
        name: selectedFile.name,
        created_at: selectedFile.created_at,
        created_at_type: typeof selectedFile.created_at
      } : null,
      willSetUploadDate: !!selectedFile?.created_at
    });
    
    if (selectedFile) {
      console.log('✅ C3DFileList - Upload date found:', selectedFile.created_at);
      // Pass upload date directly to avoid race condition
      onFileSelect(fileName, selectedFile.created_at);
    } else {
      console.log('❌ C3DFileList - No file found for ID:', fileId);
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

  if (sortedFiles.length === 0) {
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
        {/* Column Visibility Controls */}
        <div className="flex justify-end mb-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <GearIcon className="w-4 h-4" />
                Columns
                <ChevronDownIcon className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Toggle Columns</h4>
                <div className="space-y-2">
                  {[
                    { key: 'patient_id', label: 'Patient ID', icon: PersonIcon },
                    { key: 'therapist_id', label: 'Therapist ID', icon: PersonIcon },
                    { key: 'size', label: 'File Size', icon: ArchiveIcon },
                    { key: 'session_date', label: 'Session Date', icon: CalendarIcon },
                    { key: 'upload_date', label: 'Upload Date', icon: CalendarIcon }
                  ].map(({ key, label, icon: Icon }) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={key}
                        checked={visibleColumns[key as keyof ColumnVisibility]}
                        onCheckedChange={() => toggleColumnVisibility(key as keyof ColumnVisibility)}
                      />
                      <label
                        htmlFor={key}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2 cursor-pointer"
                      >
                        <Icon className="w-3 h-3" />
                        {label}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <EyeOpenIcon className="w-3 h-3" />
                    {Object.values(visibleColumns).filter(Boolean).length} of 5 columns visible
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Table Header */}
        <div className="hidden md:flex gap-4 text-sm font-medium text-slate-600 border-b pb-2">
          <div className="relative" style={{ width: `${filenameColumnWidth}px` }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={() => handleSort('name')}
                  className="flex items-center hover:text-slate-800 transition-colors"
                >
                  <FileIcon className="w-4 h-4 mr-2" />
                  File Name
                  {getSortIcon('name')}
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-medium">C3D File Names</p>
                <p className="text-xs text-slate-500 mt-1">
                  Often contain date patterns (YYYYMMDD) used for session date extraction. Column is resizable.
                </p>
              </TooltipContent>
            </Tooltip>
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={() => handleSort('patient_id')}
                    className="flex items-center hover:text-slate-800 transition-colors text-xs"
                  >
                    <PersonIcon className="w-4 h-4 mr-1" />
                    Patient
                    {getSortIcon('patient_id')}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium">Intelligent Patient ID Resolution</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Priority: 1) Folder structure (P005, P008, etc.) → 2) C3D analysis → 3) Storage metadata
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
          {visibleColumns.therapist_id && (
            <div className="flex-1 min-w-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={() => handleSort('therapist_id')}
                    className="flex items-center hover:text-slate-800 transition-colors text-xs"
                  >
                    <PersonIcon className="w-4 h-4 mr-1" />
                    Therapist
                    {getSortIcon('therapist_id')}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium">Therapist ID Resolution</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Resolved from C3D metadata when available, otherwise from storage metadata
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
          {visibleColumns.size && (
            <div className="flex-1 min-w-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={() => handleSort('size')}
                    className="flex items-center hover:text-slate-800 transition-colors text-xs"
                  >
                    <ArchiveIcon className="w-4 h-4 mr-1" />
                    Size
                    {getSortIcon('size')}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>File size - smaller files may indicate incomplete sessions</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
          {visibleColumns.session_date && (
            <div className="flex-1 min-w-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={() => handleSort('session_date')}
                    className="flex items-center hover:text-slate-800 transition-colors text-xs"
                  >
                    <CalendarIcon className="w-4 h-4 mr-1" />
                    Session Date
                    {getSortIcon('session_date')}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium">Actual Therapy Session Date</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Extracted from C3D metadata or filename patterns. Shows "N/A" until analyzed.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
          {visibleColumns.upload_date && (
            <div className="flex-1 min-w-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={() => handleSort('created_at')}
                    className="flex items-center hover:text-slate-800 transition-colors text-xs"
                  >
                    <CalendarIcon className="w-4 h-4 mr-1" />
                    Upload Date
                    {getSortIcon('created_at')}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>When the file was uploaded to the research platform</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
          <div className="w-20 text-xs">
            Actions
          </div>
        </div>

        {/* File List */}
        <div className="space-y-2">
          {sortedFiles.map((file) => {
            const shortSession = isShortSession(file.size);
            return (
              <div key={file.id} 
                  className={`flex flex-col md:flex-row gap-2 md:gap-4 items-start md:items-center py-2 px-4 rounded-lg transition-all duration-200 border ${
                    loadingFileId === file.id 
                      ? 'bg-green-50 border-green-200 shadow-sm' 
                      : 'border-slate-100 hover:bg-slate-50 hover:border-slate-200 hover:shadow-sm'
                  }`}
                >
                  {/* Mobile Layout */}
                  <div className="md:hidden space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {loadingFileId === file.id ? (
                          <div className="relative mr-3 flex-shrink-0">
                            <FileIcon className="w-4 h-4 text-blue-500" />
                            <div className="absolute -top-1 -right-1">
                              <svg 
                                className="animate-spin w-2 h-2 text-green-600" 
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
                          loadingFileId === file.id ? 'text-green-700' : 'text-slate-900'
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
                            {resolvePatientId(file)}
                          </Badge>
                        </div>
                      )}
                      {visibleColumns.therapist_id && (
                        <div className="flex items-center gap-2">
                          <span>Therapist:</span>
                          <Badge {...getTherapistIdBadgeProps(resolveTherapistId(file))}>
                            {resolveTherapistId(file)}
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
                      {visibleColumns.session_date && resolveSessionDate(file) && (
                        <div className="flex items-center gap-2">
                          <span>Session:</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-slate-700 border-slate-300 text-xs cursor-help">
                                {formatDate(resolveSessionDate(file)!)}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Session date: {formatFullDate(resolveSessionDate(file)!)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                      {visibleColumns.upload_date && (
                        <div className="flex items-center gap-2">
                          <span>Upload:</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-slate-600 border-slate-300 text-xs cursor-help">
                                {formatDate(file.created_at)}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>File upload date: {formatFullDate(file.created_at)}</p>
                            </TooltipContent>
                          </Tooltip>
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center cursor-help">
                            {loadingFileId === file.id ? (
                              <div className="relative mr-3 flex-shrink-0">
                                <FileIcon className="w-4 h-4 text-blue-500" />
                                <div className="absolute -top-1 -right-1">
                                  <svg 
                                    className="animate-spin w-2 h-2 text-green-600" 
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
                              loadingFileId === file.id ? 'text-green-700' : 'text-slate-900'
                            }`}>
                              {file.name}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{file.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    {visibleColumns.patient_id && (
                      <div className="px-3 py-2 flex-1 min-w-0">
                        <div className="flex items-center">
                          <Badge {...getPatientIdBadgeProps(resolvePatientId(file))}>
                            {resolvePatientId(file)}
                          </Badge>
                        </div>
                      </div>
                    )}
                    {visibleColumns.therapist_id && (
                      <div className="px-3 py-2 flex-1 min-w-0">
                        <div className="flex items-center">
                          <Badge {...getTherapistIdBadgeProps(resolveTherapistId(file))}>
                            {resolveTherapistId(file)}
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
                        {resolveSessionDate(file) ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-slate-700 border-slate-300 text-xs cursor-help">
                                {formatDate(resolveSessionDate(file)!)}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Session date: {formatFullDate(resolveSessionDate(file)!)}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Badge variant="outline" className="text-slate-400 border-slate-300 text-xs">
                            N/A
                          </Badge>
                        )}
                      </div>
                    )}
                    {visibleColumns.upload_date && (
                      <div className="px-3 py-2 flex-1 min-w-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-slate-600 border-slate-300 text-xs cursor-help">
                              {formatDate(file.created_at)}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Upload date: {formatFullDate(file.created_at)}</p>
                          </TooltipContent>
                        </Tooltip>
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
      </div>
    </TooltipProvider>
  );
};

export default C3DFileList;