/**
 * C3D File Browser - Central Data Access and Selection Hub
 * 
 * Author: Guillaume Gustin with assistance from Claude Code (Sonnet 3.5, Sonnet 4)
 * GitHub: @ggustin93
 * Project: GHOSTLY+ EMG C3D Analyzer
 * Updated: September 2025
 * 
 * PURPOSE: Main interface for browsing, filtering, and selecting C3D files for analysis
 * Current Implementation: 641 lines of complex state orchestration
 * 
 * Architecture Notes:
 * - Central hub for file selection and metadata display
 * - Integrates TanStack Query for intelligent caching and data synchronization
 * - Orchestrates patient/therapist/session relationship resolution
 * - Implements advanced filtering, sorting, and pagination
 * - Manages clinical notes integration and real-time updates
 * 
 * Key Features:
 * - Multi-criteria filtering (patient, therapist, date, size, notes)
 * - Role-based access control for uploads and patient visibility
 * - Column visibility preferences with localStorage persistence
 * - Real-time session data resolution from therapy_sessions table
 * - Performance optimized with React.memo and useMemo hooks
 * 
 * Production Considerations:
 * - Critical for daily therapist workflows
 * - Handles large file libraries (100+ files) efficiently
 * - Graceful error handling with retry mechanisms
 * - Supports both online (Supabase) and offline (mock) modes
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/Spinner';
import { 
  ChevronDownIcon, 
  EyeOpenIcon, 
  PersonIcon, 
  ArchiveIcon, 
  CalendarIcon,
  ViewGridIcon,
  FileIcon
} from '@radix-ui/react-icons';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import SupabaseStorageService from '@/services/supabaseStorage';
import { useAuth } from '@/contexts/AuthContext';
import { TherapySessionsService, TherapySession } from '@/services/therapySessionsService';
import { logger, LogCategory } from '@/services/logger';
import { 
  C3DFile,
  resolvePatientId,
  resolveTherapistId,
  resolveTherapistName,
  resolveSessionDate,
  resolveSessionDateTime,
  formatSessionDateTime,
  getSizeCategory
} from '@/services/C3DFileDataResolver';
import therapistService, { TherapistCache } from '@/services/therapistService';
import PatientService, { PatientInfo } from '@/services/patientService';
import { useSessionStore } from '@/store/sessionStore';
import { supabase } from '@/lib/supabase';

type SortField = 'name' | 'size' | 'created_at' | 'patient_id' | 'therapist_id' | 'session_date';
type SortDirection = 'asc' | 'desc';

interface ColumnVisibility {
  patient_id: boolean;
  patient_name: boolean;
  therapist_id: boolean;
  size: boolean;
  session_date: boolean;
  upload_date: boolean;
  clinical_notes: boolean;
}
import C3DFilterPanel, { FilterState } from '@/components/c3d/C3DFilterPanel';
import C3DFileList from '@/components/c3d/C3DFileList';
import C3DPagination from '@/components/c3d/C3DPagination';
// Clinical Notes integration
import useSimpleNotesCount from '@/hooks/useSimpleNotesCount';
// TanStack Query integration
import { useC3DFileBrowserQuery } from '@/hooks/useC3DFileBrowserQuery';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';

// SimpleCache replaced by TanStack Query intelligent caching

// Get bucket name from centralized configuration
import { ENV_CONFIG } from '@/config/environment';
const BUCKET_NAME = ENV_CONFIG.STORAGE_BUCKET_NAME;

interface C3DFileBrowserProps {
  onFileSelect: (filename: string, uploadDate?: string) => void;
  isLoading?: boolean;
}

const C3DFileBrowser: React.FC<C3DFileBrowserProps> = ({
  onFileSelect,
  isLoading = false
}) => {
  const { user, loading, userRole } = useAuth();
  const { setSelectedFileData } = useSessionStore();
  const queryClient = useQueryClient();
  
  // Replace manual state management with TanStack Query
  const { 
    files, 
    sessionData, 
    therapistCache, 
    patientCache, 
    loading: loadingStates, 
    error,
    isLoading: isLoadingFiles
  } = useC3DFileBrowserQuery();
  
  // Filter states
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    patientIdFilter: 'all',
    patientNameFilter: 'all',
    therapistIdFilter: 'all',
    dateFromFilter: '',
    dateToFilter: '',
    timeFromFilter: '',
    timeToFilter: '',
    sizeFilter: 'all',
    clinicalNotesFilter: 'all'
  });
  
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [filesPerPage] = useState(10);
  
  // Sort states
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Column visibility states  
  const [visibleColumns, setVisibleColumns] = useState<ColumnVisibility>(() => {
    const saved = localStorage.getItem('c3d-visible-columns');
    return saved ? JSON.parse(saved) : {
      patient_id: true,
      patient_name: userRole === 'ADMIN' || userRole === 'THERAPIST', // Role-based patient name visibility
      therapist_id: true,
      size: true,
      session_date: true,
      upload_date: false,  // Default to false as requested
      clinical_notes: true   // Enable clinical notes by default
    };
  });

  // Simple notes count hook - replaces complex batch system
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

  // Data loading is now handled by TanStack Query in useC3DFileBrowserQuery hook
  
  // Debug logging for data flow
  useEffect(() => {
    logger.debug(LogCategory.API, 'C3DFileBrowser Data Flow Debug:', {
      filesCount: files.length,
      therapistCacheKeys: Object.keys(therapistCache),
      loadingStates: loadingStates,
      hasError: !!error,
      sampleFile: files[0]?.name
    })
  }, [files, therapistCache, loadingStates, error])

  // Enhanced session date resolver that uses processed session data with time support
  const resolveEnhancedSessionDate = useCallback((file: C3DFile): string | null => {
    const filePath = `${BUCKET_NAME}/${file.name}`;
    const session = sessionData[filePath];
    
    // Priority 1: Processed session timestamp from therapy_sessions table
    if (session?.session_date) {
      return session.session_date;
    }
    
    // Priority 2: C3D metadata time from therapy_sessions table
    if (session?.game_metadata?.time) {
      return session.game_metadata.time;
    }
    
    // Priority 3: Use enhanced datetime resolver for filename timestamps
    return resolveSessionDateTime(file);
  }, [sessionData]);

  // Data loading is now handled automatically by TanStack Query hook

  // Helper function to get therapist display using centralized service
  const getTherapistDisplay = useCallback((file: C3DFile): string => {
    if (loadingStates.therapists) {
      return 'Loading...';
    }
    
    const cacheEntry = therapistCache[file.name];
    if (cacheEntry) {
      if (cacheEntry.display_name) {
        return cacheEntry.display_name;
      }
      if (cacheEntry.first_name && cacheEntry.last_name) {
        return `${cacheEntry.first_name} ${cacheEntry.last_name}`;
      }
      if (cacheEntry.user_code) {
        return cacheEntry.user_code;
      }
    }
    
    const patientCode = resolvePatientId(file);
    if (patientCode && patientCode !== 'Unknown') {
      for (const [fileName, therapistData] of Object.entries(therapistCache)) {
        if (fileName.includes(patientCode)) {
          if (therapistData.display_name) return therapistData.display_name;
          if (therapistData.first_name && therapistData.last_name) {
            return `${therapistData.first_name} ${therapistData.last_name}`;
          }
          if (therapistData.user_code) return therapistData.user_code;
        }
      }
    }
    
    return 'Unknown Therapist';
  }, [therapistCache, loadingStates.therapists]);

  // Helper function to get patient name
  const getPatientName = useCallback((file: C3DFile): string => {
    // If patient data is still loading, return a loading indicator
    if (loadingStates.patients) {
      return 'Loading...';
    }
    
    const patientCode = resolvePatientId(file);
    const patientInfo = patientCache[patientCode];
    
    if (patientInfo?.first_name && patientInfo?.last_name) {
      return `${patientInfo.first_name.charAt(0)}. ${patientInfo.last_name}`;
    }
    
    return '';
  }, [patientCache, loadingStates.patients]);

  // Wrapper function to handle file selection with metadata
  const handleFileSelectWithMetadata = useCallback((filename: string, uploadDate?: string, fileData?: C3DFile) => {
    // Extract metadata if file data is available
    if (fileData) {
      const patientName = getPatientName(fileData);
      const therapistDisplay = getTherapistDisplay(fileData);

      // Set the file metadata in session store
      setSelectedFileData({
        patientName: patientName || undefined,
        therapistDisplay: therapistDisplay || undefined,
        fileSize: fileData.size,
        clinicalNotesCount: simpleNotes.notesCount[fileData.name] || 0
      });
    } else {
      // Clear metadata if no file data
      setSelectedFileData(null);
    }

    // Call the original onFileSelect with the filename and uploadDate
    // Note: uploadDate might be undefined from C3DFileList, but that's expected
    onFileSelect(filename, uploadDate);
  }, [getPatientName, getTherapistDisplay, setSelectedFileData, onFileSelect, simpleNotes.notesCount]);

  // Filtered files
  const filteredFiles = useMemo(() => {
    return files.filter(file => {
      const patientName = getPatientName(file);
      const matchesSearch = filters.searchTerm === '' || 
        file.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        patientName.toLowerCase().includes(filters.searchTerm.toLowerCase());
      const resolvedPatient = resolvePatientId(file);
      const resolvedTherapistName = getTherapistDisplay(file);
      const matchesPatientId = filters.patientIdFilter === 'all' || 
        resolvedPatient.toLowerCase().includes(filters.patientIdFilter.toLowerCase());
      const matchesPatientName = filters.patientNameFilter === 'all' || 
        patientName.toLowerCase().includes(filters.patientNameFilter.toLowerCase());
      const matchesTherapistId = filters.therapistIdFilter === 'all' || 
        resolvedTherapistName.toLowerCase().includes(filters.therapistIdFilter.toLowerCase());
      
      // Session date range filtering using enhanced resolver
      let matchesDateRange = true;
      const sessionDateTime = resolveEnhancedSessionDate(file);
      
      if (filters.dateFromFilter || filters.dateToFilter) {
        // If file has no session date, exclude it from date-based filtering
        if (!sessionDateTime) {
          matchesDateRange = false;
        } else {
          const fileDate = new Date(sessionDateTime);
          const fromDate = filters.dateFromFilter ? new Date(filters.dateFromFilter) : null;
          const toDate = filters.dateToFilter ? new Date(filters.dateToFilter) : null;
          
          if (fromDate && fileDate < fromDate) matchesDateRange = false;
          if (toDate && fileDate > toDate) matchesDateRange = false;
        }
      }
      
      // Time range filtering
      let matchesTimeRange = true;
      if ((filters.timeFromFilter || filters.timeToFilter) && sessionDateTime) {
        const sessionDate = new Date(sessionDateTime);
        const sessionTime = sessionDate.toTimeString().slice(0, 5); // Format: "HH:MM"
        if (filters.timeFromFilter) {
          matchesTimeRange = matchesTimeRange && sessionTime >= filters.timeFromFilter;
        }
        if (filters.timeToFilter) {
          matchesTimeRange = matchesTimeRange && sessionTime <= filters.timeToFilter;
        }
      }
      
      const matchesSize = filters.sizeFilter === 'all' || 
        getSizeCategory(file.size) === filters.sizeFilter;

      // Check clinical notes filter - use user-specific notes count
      let matchesClinicalNotes = true;
      if (filters.clinicalNotesFilter !== 'all') {
        // Check if the current user (author) has any clinical notes for this file
        // Apply same dual-path logic as C3DFileList.getNotesCount() for compatibility
        const fullPath = `${BUCKET_NAME}/${file.name}`;  // Legacy format: "c3d-examples/file.c3d"
        const dbPath = file.name;                         // Database format: "file.c3d"
        const userNotesCount = simpleNotes.notesCount[dbPath] || simpleNotes.notesCount[fullPath] || 0;
        const hasUserNotes = userNotesCount > 0;
        
        if (filters.clinicalNotesFilter === 'with_notes') {
          matchesClinicalNotes = hasUserNotes;
        } else if (filters.clinicalNotesFilter === 'without_notes') {
          matchesClinicalNotes = !hasUserNotes;
        }
      }

      return matchesSearch && matchesPatientId && matchesPatientName && matchesTherapistId && matchesDateRange && matchesTimeRange && matchesSize && matchesClinicalNotes;
    });
  }, [files, filters, resolveEnhancedSessionDate, getTherapistDisplay, getPatientName, simpleNotes.notesCount]);

  // Sorted files (apply sorting to ALL filtered results)
  const sortedFiles = useMemo(() => {
    const sorted = [...filteredFiles].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // Handle special cases - use resolved values for sorting
      if (sortField === 'patient_id') {
        aValue = resolvePatientId(a);
        bValue = resolvePatientId(b);
      } else if (sortField === 'therapist_id') {
        aValue = getTherapistDisplay(a);
        bValue = getTherapistDisplay(b);
      } else if (sortField === 'session_date') {
        aValue = resolveEnhancedSessionDate(a);
        bValue = resolveEnhancedSessionDate(b);
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
  }, [filteredFiles, sortField, sortDirection, resolveEnhancedSessionDate, getTherapistDisplay]);

  // Pagination calculations (now applied to sorted data)
  const totalFiles = sortedFiles.length;
  const totalPages = Math.ceil(totalFiles / filesPerPage);
  const startIndex = (currentPage - 1) * filesPerPage;
  const endIndex = startIndex + filesPerPage;
  const paginatedFiles = sortedFiles.slice(startIndex, endIndex);

  // Reset to first page when filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, sortField, sortDirection]);

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle column visibility
  const toggleColumnVisibility = (column: keyof ColumnVisibility) => {
    const newVisibility = {
      ...visibleColumns,
      [column]: !visibleColumns[column]
    };
    setVisibleColumns(newVisibility);
    localStorage.setItem('c3d-visible-columns', JSON.stringify(newVisibility));
  };

  // Handle filter changes
  const handleFiltersChange = (newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const clearFilters = () => {
    setFilters({
      searchTerm: '',
      patientIdFilter: 'all',
      patientNameFilter: 'all',
      therapistIdFilter: 'all',
      dateFromFilter: '',
      dateToFilter: '',
      timeFromFilter: '',
      timeToFilter: '',
      sizeFilter: 'all',
      clinicalNotesFilter: 'all'
    });
  };


  // Get unique therapist names for filter dropdown (using useMemo for performance)
  const uniqueTherapistNames = useMemo(() => {
    const names = new Set(
      files
        .map(f => getTherapistDisplay(f))
        .filter(name => name && !name.startsWith('Therapist ')) // Filter out fallback names
    );
    return Array.from(names).sort();
  }, [files, getTherapistDisplay]);

  // Get unique values for filter dropdowns
  const uniquePatientIds = useMemo(() => {
    const ids = new Set(files.map(f => resolvePatientId(f)));
    return Array.from(ids).sort();
  }, [files]);

  // Get unique patient names for filter dropdown (using useMemo for performance)
  const uniquePatientNames = useMemo(() => {
    const names = new Set(
      files
        .map(f => getPatientName(f))
        .filter(name => name && name !== '') // Filter out empty names
    );
    return Array.from(names).sort();
  }, [files, getPatientName]);

  // TanStack Query refresh functions
  const refreshFiles = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.c3dBrowser.all });
  }, [queryClient]);

  const retryLoadFiles = useCallback(() => {
    queryClient.refetchQueries({ queryKey: queryKeys.c3dBrowser.files() });
  }, [queryClient]);

  // Clear all cache and force refresh (for debugging)
  const clearAllCache = useCallback(() => {
    queryClient.clear();
    queryClient.invalidateQueries();
    window.location.reload();
  }, [queryClient]);

  // Force refresh therapist data specifically
  const refreshTherapistData = useCallback(() => {
    console.log('🔍 Force refreshing therapist data...');
    queryClient.invalidateQueries({ queryKey: queryKeys.c3dBrowser.therapists([]) });
  }, [queryClient]);


  // Fallback therapist display that tries multiple approaches
  const getTherapistDisplayFallback = useCallback((file: C3DFile): string => {
    // If therapist data is still loading, return a loading indicator
    if (loadingStates.therapists) {
      return 'Loading...';
    }
    
    // Try direct cache lookup first
    const cacheEntry = therapistCache[file.name];
    if (cacheEntry) {
      if (cacheEntry.display_name) return cacheEntry.display_name;
      if (cacheEntry.first_name && cacheEntry.last_name) {
        return `${cacheEntry.first_name} ${cacheEntry.last_name}`;
      }
      if (cacheEntry.user_code) return cacheEntry.user_code;
    }
    
    // Try to extract patient code and look up therapist directly
    const patientCode = resolvePatientId(file);
    if (patientCode && patientCode !== 'Unknown') {
      // Look for therapist in the cache by patient code
      for (const [fileName, therapistData] of Object.entries(therapistCache)) {
        if (fileName.includes(patientCode)) {
          if (therapistData.display_name) return therapistData.display_name;
          if (therapistData.first_name && therapistData.last_name) {
            return `${therapistData.first_name} ${therapistData.last_name}`;
          }
          if (therapistData.user_code) return therapistData.user_code;
        }
      }
    }
    
    return 'Unknown Therapist';
  }, [therapistCache, loadingStates.therapists]);

  const setupStorage = async () => {
    if (!SupabaseStorageService.isConfigured()) {
      // This error will be handled by the query hook
      return;
    }

    // Trigger a fresh fetch
    refreshFiles();
  };


  // Show loading until all critical data is ready
  if (isLoadingFiles || loadingStates.therapists || loadingStates.patients || loadingStates.sessions) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <Spinner />
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-700">Loading C3D files...</p>
              <div className="text-xs text-slate-500 space-y-0.5">
                {loadingStates.files && <div className="flex items-center justify-center gap-1">
                  <span className="animate-pulse">▸</span> Loading file list
                </div>}
                {loadingStates.sessions && <div className="flex items-center justify-center gap-1">
                  <span className="animate-pulse">▸</span> Loading session data
                </div>}
                {loadingStates.therapists && <div className="flex items-center justify-center gap-1">
                  <span className="animate-pulse">▸</span> Loading therapist data
                </div>}
                {loadingStates.patients && <div className="flex items-center justify-center gap-1">
                  <span className="animate-pulse">▸</span> Loading patient names
                </div>}
              </div>
            </div>
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
            <p className="font-medium">Error Loading Files</p>
            <p className="text-sm mt-1 max-w-md mx-auto">{error}</p>
            {!user && (
              <p className="text-xs mt-2 text-orange-600">
                ⚠️ You may need to sign in to access the file library
              </p>
            )}
            {user && (
              <p className="text-xs mt-2 text-slate-500">
                Signed in as: {user.email}
              </p>
            )}
            <div className="flex justify-center gap-2 mt-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={retryLoadFiles}
                disabled={isLoadingFiles}
              >
                {isLoadingFiles ? 'Retrying...' : 'Retry'}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={clearAllCache}
                className="bg-red-600 hover:bg-red-700"
              >
                Clear Cache & Reload
              </Button>
              <Button 
                variant="default" 
                size="sm"
                onClick={refreshTherapistData}
                className="bg-green-600 hover:bg-green-700"
              >
                Refresh Therapists
              </Button>
              {SupabaseStorageService.isConfigured() && (error.includes('not found') || error.includes('empty')) && (
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={setupStorage}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Test Access
                </Button>
              )}
            </div>
            {SupabaseStorageService.isConfigured() && (error.includes('not found') || error.includes('empty')) && (
              <p className="text-xs text-slate-500 mt-3">
                Click "Test Access" to verify your storage permissions
              </p>
            )}
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
            <CardTitle className="text-xl font-semibold flex items-center gap-2 text-slate-900">
              <ArchiveIcon className="w-5 h-5 text-blue-500" />
              Game Session History
            </CardTitle>
            <p className="text-sm text-slate-600 mt-1">
              Showing <span className="font-medium">{startIndex + 1}-{Math.min(endIndex, totalFiles)}</span> of <span className="font-medium text-slate-900">{totalFiles} files</span>
              {totalFiles !== files.length && (
                <span className="ml-2 text-slate-500">({files.length} total)</span>
              )}
              {!SupabaseStorageService.isConfigured() && (
                <span className="ml-2 text-yellow-600 text-sm">(Mock Data)</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 hover:bg-slate-50 hover:border-slate-300 transition-colors duration-200"
                >
                  <ViewGridIcon className="w-4 h-4 text-slate-600" />
                  Columns
                  <ChevronDownIcon className="w-4 h-4 text-slate-400" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56" align="end">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Toggle Columns</h4>
                  <div className="space-y-2">
                    {[
                      { key: 'patient_id', label: 'Patient ID', icon: PersonIcon },
                      { key: 'patient_name', label: 'Patient Name', icon: PersonIcon },
                      { key: 'therapist_id', label: 'Therapist ID', icon: PersonIcon },
                      { key: 'size', label: 'File Size', icon: ArchiveIcon },
                      { key: 'session_date', label: 'Session Date', icon: CalendarIcon },
                      { key: 'upload_date', label: 'Upload Date', icon: CalendarIcon },
                      { key: 'clinical_notes', label: 'Clinical Notes', icon: FileIcon }
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
                      {Object.values(visibleColumns).filter(Boolean).length} of 7 columns visible
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 mt-4 mb-4">
        <C3DFilterPanel
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onClearFilters={clearFilters}
          uniquePatientIds={uniquePatientIds}
          uniquePatientNames={uniquePatientNames}
          uniqueTherapistNames={uniqueTherapistNames}
          userRole={userRole}
        />

        {/* File List */}
        <C3DFileList
          files={paginatedFiles}
          onFileSelect={handleFileSelectWithMetadata}
          isLoading={isLoading}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          visibleColumns={visibleColumns}
          resolveSessionDate={resolveEnhancedSessionDate}
          therapistCache={therapistCache}
          userRole={userRole}
          getPatientName={getPatientName}
          notesIndicators={simpleNotes.notesCount}
          notesLoading={simpleNotes.loading}
        />

        {/* Pagination Controls */}
        <C3DPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalFiles}
          itemsPerPage={filesPerPage}
          onPageChange={setCurrentPage}
        />
      </CardContent>
      </Card>
    </div>
  );
};

export default C3DFileBrowser;