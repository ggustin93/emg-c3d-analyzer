import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Spinner from '@/components/ui/Spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MagnifyingGlassIcon,
  CalendarIcon,
  FileIcon,
  PersonIcon,
  ArchiveIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  UploadIcon,
  PlayIcon,
  DownloadIcon,
  ExclamationTriangleIcon,
  TrashIcon,
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
import { Badge } from '@/components/ui/badge';
import SupabaseStorageService, { C3DFileInfo } from '@/services/supabaseStorage';
import SupabaseSetup from '@/utils/supabaseSetup';
import { useAuth } from '@/contexts/AuthContext';

// Using C3DFileInfo from the service
type C3DFile = C3DFileInfo & {
  therapist_id?: string;
  // Enhanced fields for resolved patient/therapist info
  resolved_patient_id?: string;
  resolved_therapist_id?: string;
  game_metadata?: {
    player_name?: string;
    therapist_id?: string;
    [key: string]: any;
  };
};

interface C3DFileBrowserProps {
  onFileSelect: (filename: string, uploadDate?: string) => void;
  isLoading?: boolean;
}

type SortField = 'name' | 'size' | 'created_at' | 'patient_id' | 'therapist_id' | 'session_date';
type SortDirection = 'asc' | 'desc';

const C3DFileBrowser: React.FC<C3DFileBrowserProps> = ({
  onFileSelect,
  isLoading = false
}) => {
  const { authState } = useAuth();
  // Zustand store no longer needed here - upload date passed via function parameter
  const [files, setFiles] = useState<C3DFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 🔍 DEBUG: Log files when they change
  console.log('🗂️ C3DFileBrowser - Files loaded:', {
    filesCount: files.length,
    sampleFiles: files.slice(0, 2).map(f => ({
      id: f.id,
      name: f.name,
      created_at: f.created_at,
      created_at_type: typeof f.created_at,
      hasCreatedAt: !!f.created_at
    }))
  });
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [patientIdFilter, setPatientIdFilter] = useState('');
  const [therapistIdFilter, setTherapistIdFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState<'all' | 'small' | 'medium' | 'large'>('all');
  
  // Sort states
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // UI states
  const [showFilters, setShowFilters] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);
  
  // Column visibility states
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('c3d-visible-columns');
    return saved ? JSON.parse(saved) : {
      patient_id: true,
      therapist_id: true,
      size: true,
      session_date: true,
      upload_date: true
    };
  });
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [filesPerPage] = useState(10);
  
  // Column resize states
  const [filenameColumnWidth, setFilenameColumnWidth] = useState(() => {
    const saved = localStorage.getItem('c3d-filename-column-width');
    return saved ? parseInt(saved) : 300; // Default 300px
  });
  const [isResizing, setIsResizing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  // Helper functions to resolve Patient and Therapist IDs (same logic as FileMetadataBar)
  const resolvePatientId = useCallback((file: C3DFile): string => {
    // Debug: Log the full file path to understand structure
    console.log('🔍 C3DFileBrowser - Resolving Patient ID for file:', {
      fullPath: file.name,
      metadata: file
    });
    
    // Priority 1: Folder structure extraction (P005, P008, etc.) - HIGHEST PRIORITY
    const folderMatch = file.name.match(/^(P\d{3})\//);
    if (folderMatch) {
      const folderPatientId = folderMatch[1];
      console.log('✅ Found Patient ID in folder structure:', folderPatientId);
      return folderPatientId;
    }
    
    // Priority 2: game_metadata.player_name (from C3D analysis)
    if (file.game_metadata?.player_name) {
      console.log('✅ Found Patient ID in game metadata:', file.game_metadata.player_name);
      return file.game_metadata.player_name;
    }
    
    // Priority 3: resolved_patient_id (enhanced resolution)
    if (file.resolved_patient_id) {
      console.log('✅ Found Patient ID in resolved field:', file.resolved_patient_id);
      return file.resolved_patient_id;
    }
    
    // Priority 4: patient_id (from storage metadata or service extraction)
    if (file.patient_id) {
      console.log('✅ Found Patient ID in patient_id field:', file.patient_id);
      return file.patient_id;
    }
    
    // Priority 5: Extract from filename patterns
    const filenameMatch = file.name.match(/[_-](P\d{3})[_-]/i);
    if (filenameMatch) {
      const filenamePatientId = filenameMatch[1].toUpperCase();
      console.log('✅ Found Patient ID in filename pattern:', filenamePatientId);
      return filenamePatientId;
    }
    
    console.log('❌ No Patient ID found, defaulting to Unknown');
    return 'Unknown';
  }, []);

  const resolveTherapistId = useCallback((file: C3DFile): string => {
    // Priority: 1) game_metadata.therapist_id (from C3D analysis)
    //          2) resolved_therapist_id (enhanced resolution)
    //          3) therapist_id (from storage metadata)
    //          4) 'Unknown'  
    return file.game_metadata?.therapist_id || 
           file.resolved_therapist_id || 
           file.therapist_id || 
           'Unknown';
  }, []);

  const getPatientIdBadgeProps = useCallback((patientId: string) => {
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
  }, []);

  const extractDateFromFilename = (filename: string): string | null => {
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

  const resolveSessionDate = useCallback((file: C3DFile): string | null => {
    // Priority: 1) game_metadata.session_date (from C3D analysis - most accurate)
    //          2) game_metadata.time (alternative field from C3D)
    //          3) extracted from filename (smart fallback)
    //          4) null (no session date available)
    return file.game_metadata?.session_date || 
           file.game_metadata?.time || 
           extractDateFromFilename(file.name) ||
           null;
  }, []);

  // Load files ONLY from Supabase c3d-examples bucket
  useEffect(() => {
    // Wait for authentication to be fully initialized before attempting to load files
    if (authState.loading) {
      if (process.env.NODE_ENV === 'development') {
        console.log('C3D Browser: Waiting for auth to initialize...');
      }
      return;
    }

    const loadFiles = async (retryCount = 0) => {
      setIsLoadingFiles(true);
      setError(null);
      
      // Shorter timeout with better error handling
      const timeoutId = setTimeout(() => {
        console.error('C3D Browser: File loading timeout');
        setIsLoadingFiles(false);
        setError('Connection timeout. Please check your internet connection and try refreshing the page.');
      }, 10000); // Reduced to 10 seconds
      
      try {
        if (!SupabaseStorageService.isConfigured()) {
          clearTimeout(timeoutId);
          setFiles([]);
          setError('Supabase not configured. Please check your environment variables.');
          return;
        }

        // Check if user is authenticated before proceeding
        if (!authState.user) {
          clearTimeout(timeoutId);
          setFiles([]);
          setError('Please sign in to access the C3D file library.');
          setIsLoadingFiles(false);
          return;
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('Loading files from c3d-examples bucket...');
          console.log('Supabase URL:', process.env.REACT_APP_SUPABASE_URL);
          console.log('Auth state:', { user: authState.user?.email, loading: authState.loading });
        }

        // Add timeout promise to race against the actual request - more generous timeout
        const loadPromise = SupabaseStorageService.listC3DFiles();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 15000); // Increased to 15 seconds
        });

        const supabaseFiles = await Promise.race([loadPromise, timeoutPromise]);
        
        clearTimeout(timeoutId);
        console.log('Files loaded from Supabase c3d-examples bucket:', supabaseFiles);
        
        if (supabaseFiles.length === 0) {
          // Bucket exists but is empty
          setFiles([]);
          setError('Storage bucket c3d-examples is empty. Please upload C3D files to the bucket.');
        } else {
          setFiles(supabaseFiles);
          setError(null);
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        
        console.error('Full error details:', err);
        
        // More intelligent retry logic
        const isAuthError = err.message?.includes('Authentication') || err.message?.includes('JWT');
        const isNetworkError = err.message?.includes('timeout') || 
                              err.message?.includes('network') ||
                              err.message?.includes('connection');
        
        // Don't retry auth errors immediately - they need time to resolve
        if ((isNetworkError || isAuthError) && retryCount < 2) {
          const retryDelay = isAuthError ? 5000 : 2000; // Longer delay for auth errors
          console.log(`Retrying file load (attempt ${retryCount + 1}/2) in ${retryDelay}ms...`);
          setTimeout(() => {
            loadFiles(retryCount + 1);
          }, retryDelay);
          return;
        }
        
        let errorMessage = 'Failed to load C3D files from storage.';
        
        if (err.message?.includes('timeout') || err.message?.includes('Request timeout')) {
          errorMessage = 'Connection timeout. Please check your internet connection and try refreshing the page.';
        } else if (err.message?.includes('JWT expired') || err.message?.includes('Invalid JWT')) {
          errorMessage = 'Authentication expired. Please sign in again to access files.';
        } else if (err.message?.includes('not found') || err.message?.includes('does not exist')) {
          errorMessage = `Storage bucket 'c3d-examples' not found. Please create this bucket in your Supabase dashboard.`;
        } else if (err.message?.includes('permission') || err.message?.includes('policy')) {
          errorMessage = 'Permission denied. Please check your authentication status and bucket policies.';
        } else if (err.message?.includes('Authentication required')) {
          errorMessage = 'Please sign in to access the C3D file library.';
        } else if (err.message?.includes('Authentication check failed')) {
          errorMessage = 'Authentication system is still initializing. Please wait a moment and try again.';
        } else {
          errorMessage = `Failed to load C3D files: ${err.message}`;
        }
        
        if (retryCount >= 2) {
          errorMessage += ` (Failed after ${retryCount + 1} attempts)`;
        }
        
        setError(errorMessage);
        setFiles([]);
        setIsLoadingFiles(false);
      } finally {
        if (retryCount === 0) {
          // Only clear timeout and loading on initial attempt, not retries
          clearTimeout(timeoutId);
          setIsLoadingFiles(false);
        }
      }
    };

    loadFiles();
  }, [authState.loading, authState.user]); // Depend on auth state changes

  // Manual retry function
  const retryLoadFiles = useCallback(() => {
    const loadFiles = async () => {
      setIsLoadingFiles(true);
      setError(null);
      
      // Create timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        console.error('File loading timeout - forcing completion');
        setIsLoadingFiles(false);
        setError('Loading timeout. Please refresh the page or check your connection.');
      }, 15000); // 15 second timeout
      
      try {
        if (!SupabaseStorageService.isConfigured()) {
          clearTimeout(timeoutId);
          setFiles([]);
          setError('Supabase not configured. Please check your environment variables.');
          return;
        }

        console.log('Retrying to load files from c3d-examples bucket...');

        // Add timeout promise to race against the actual request
        const loadPromise = SupabaseStorageService.listC3DFiles();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 12000);
        });

        const supabaseFiles = await Promise.race([loadPromise, timeoutPromise]);
        
        clearTimeout(timeoutId);
        console.log('Files loaded successfully on retry:', supabaseFiles);
        
        if (supabaseFiles.length === 0) {
          setFiles([]);
          setError('Storage bucket c3d-examples is empty. Please upload C3D files to the bucket.');
        } else {
          setFiles(supabaseFiles);
          setError(null);
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        console.error('Retry failed:', err);
        setError(`Retry failed: ${err.message}`);
        setFiles([]);
        setIsLoadingFiles(false);
      } finally {
        clearTimeout(timeoutId);
        setIsLoadingFiles(false);
      }
    };

    loadFiles();
  }, []);

  // Utility functions
  const formatFileSize = (bytes: number): string => {
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

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const formatFullDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const isShortSession = (bytes: number): boolean => {
    return bytes < 750000; // Less than 750KB indicates potentially short session
  };

  const getSizeCategory = (bytes: number): 'small' | 'medium' | 'large' => {
    if (bytes < 2000000) return 'small'; // < 2MB
    if (bytes < 3000000) return 'medium'; // < 3MB
    return 'large';
  };


  // Filtered and sorted files
  const filteredAndSortedFiles = useMemo(() => {
    let filtered = files.filter(file => {
      const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase());
      const resolvedPatient = resolvePatientId(file);
      const resolvedTherapist = resolveTherapistId(file);
      const matchesPatientId = !patientIdFilter || 
        resolvedPatient.toLowerCase().includes(patientIdFilter.toLowerCase());
      const matchesTherapistId = !therapistIdFilter || 
        resolvedTherapist.toLowerCase().includes(therapistIdFilter.toLowerCase());
      
      // Date range filtering
      let matchesDateRange = true;
      if (dateFromFilter || dateToFilter) {
        const fileDate = new Date(file.created_at.split('T')[0]); // Get date part only
        const fromDate = dateFromFilter ? new Date(dateFromFilter) : null;
        const toDate = dateToFilter ? new Date(dateToFilter) : null;
        
        if (fromDate && fileDate < fromDate) matchesDateRange = false;
        if (toDate && fileDate > toDate) matchesDateRange = false;
      }
      
      const matchesSize = sizeFilter === 'all' || 
        getSizeCategory(file.size) === sizeFilter;

      return matchesSearch && matchesPatientId && matchesTherapistId && matchesDateRange && matchesSize;
    });

    // Sort files
    filtered.sort((a, b) => {
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

    return filtered;
  }, [files, searchTerm, patientIdFilter, therapistIdFilter, dateFromFilter, dateToFilter, sizeFilter, sortField, sortDirection, resolvePatientId, resolveTherapistId, resolveSessionDate]);

  // Pagination calculations
  const totalFiles = filteredAndSortedFiles.length;
  const totalPages = Math.ceil(totalFiles / filesPerPage);
  const startIndex = (currentPage - 1) * filesPerPage;
  const endIndex = startIndex + filesPerPage;
  const paginatedFiles = filteredAndSortedFiles.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, patientIdFilter, therapistIdFilter, dateFromFilter, dateToFilter, sizeFilter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setPatientIdFilter('');
    setTherapistIdFilter('');
    setDateFromFilter('');
    setDateToFilter('');
    setSizeFilter('all');
  };

  const toggleColumnVisibility = (column: string) => {
    const newVisibility = {
      ...visibleColumns,
      [column]: !visibleColumns[column]
    };
    setVisibleColumns(newVisibility);
    localStorage.setItem('c3d-visible-columns', JSON.stringify(newVisibility));
  };

  const refreshFiles = async () => {
    setIsLoadingFiles(true);
    try {
      if (SupabaseStorageService.isConfigured()) {
        const supabaseFiles = await SupabaseStorageService.listC3DFiles();
        setFiles(supabaseFiles);
        setError(null);
      }
    } catch (err) {
      setError('Failed to refresh file list. Please try again.');
      console.error('Error refreshing files:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const setupStorage = async () => {
    if (!SupabaseStorageService.isConfigured()) {
      setError('Supabase not configured. Please check your environment variables.');
      return;
    }

    setIsSettingUp(true);
    setError(null);

    try {
      // Only create the bucket, don't upload fake files
      const result = await SupabaseSetup.createBucket();
      if (result.success) {
        setError('Bucket created successfully. Upload your C3D files using the button above.');
        await refreshFiles();
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(`Setup failed: ${err.message}`);
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Show confirmation dialog first
    setPendingFiles(files);
    setShowUploadDialog(true);
  };

  const confirmUpload = async () => {
    if (!pendingFiles) return;

    setShowUploadDialog(false);
    setIsSettingUp(true);
    setError(null);

    try {
      let uploadedCount = 0;
      const errors: string[] = [];

      for (const file of Array.from(pendingFiles)) {
        if (!file.name.toLowerCase().endsWith('.c3d')) {
          errors.push(`${file.name}: Only C3D files are allowed`);
          continue;
        }

        try {
          await SupabaseStorageService.uploadFile(file, {
            metadata: {
              uploaded_at: new Date().toISOString(),
              file_size: file.size
            }
          });
          uploadedCount++;
        } catch (err: any) {
          errors.push(`${file.name}: ${err.message}`);
        }
      }

      if (uploadedCount > 0) {
        await refreshFiles();
        setError(errors.length > 0 
          ? `Uploaded ${uploadedCount} files. Some failed: ${errors.join(', ')}`
          : `Successfully uploaded ${uploadedCount} C3D files.`
        );
      } else {
        setError(`Failed to upload files: ${errors.join(', ')}`);
      }

    } catch (err: any) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setIsSettingUp(false);
      setPendingFiles(null);
      // Reset the file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  };

  const cancelUpload = () => {
    setShowUploadDialog(false);
    setPendingFiles(null);
    // Reset the file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
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
    console.log('🔍 C3DFileBrowser - handleFileAnalyze:', {
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
      console.log('✅ C3DFileBrowser - Upload date found:', selectedFile.created_at);
      // Pass upload date directly to avoid race condition
      onFileSelect(fileName, selectedFile.created_at);
    } else {
      console.log('❌ C3DFileBrowser - No file found for ID:', fileId);
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

  // Get unique patient IDs for filter dropdown (using resolved values)
  const uniquePatientIds = useMemo(() => {
    const ids = new Set(files.map(f => resolvePatientId(f)));
    return Array.from(ids).sort();
  }, [files, resolvePatientId]);

  // Get unique therapist IDs for filter dropdown (using resolved values)
  const uniqueTherapistIds = useMemo(() => {
    const ids = new Set(files.map(f => resolveTherapistId(f)));
    return Array.from(ids).sort();
  }, [files, resolveTherapistId]);

  if (isLoadingFiles) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Spinner />
            <p className="text-sm text-slate-500 mt-2">Loading C3D files...</p>
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
            {!authState.user && (
              <p className="text-xs mt-2 text-orange-600">
                ⚠️ You may need to sign in to access the file library
              </p>
            )}
            {authState.user && (
              <p className="text-xs mt-2 text-slate-500">
                Signed in as: {authState.user.email}
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
              {SupabaseStorageService.isConfigured() && (error.includes('not found') || error.includes('empty')) && (
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={setupStorage}
                  disabled={isSettingUp}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSettingUp ? (
                    <div className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Setting up...
                    </div>
                  ) : (
                    'Setup Storage'
                  )}
                </Button>
              )}
            </div>
            {SupabaseStorageService.isConfigured() && (error.includes('not found') || error.includes('empty')) && (
              <p className="text-xs text-slate-500 mt-3">
                Click "Setup Storage" to {error.includes('not found') ? 'create the bucket and ' : ''}upload sample files
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="w-full">
        <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">C3D File Library</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Showing {startIndex + 1}-{Math.min(endIndex, totalFiles)} of {totalFiles} files
              {totalFiles !== files.length && ` (${files.length} total)`}
              {!SupabaseStorageService.isConfigured() && (
                <span className="ml-2 text-yellow-600">(Mock Data)</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {SupabaseStorageService.isConfigured() && (
              <>
                {/* Upload Files Button */}
                <div className="relative">
                  <input
                    type="file"
                    multiple
                    accept=".c3d"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isSettingUp}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSettingUp}
                    className="flex items-center gap-2"
                  >
                    {isSettingUp ? (
                      <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <UploadIcon className="w-4 h-4" />
                    )}
                    {isSettingUp ? 'Uploading...' : 'Upload Files'}
                  </Button>
                </div>
                
              </>
            )}
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
                          checked={visibleColumns[key]}
                          onCheckedChange={() => toggleColumnVisibility(key)}
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <MagnifyingGlassIcon className="w-4 h-4" />
              Filters
              {showFilters ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters Section */}
        {showFilters && (
          <div className="bg-slate-50 p-4 rounded-lg space-y-4">
            {/* Two-row grid layout for desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search by name */}
              <div className="space-y-2">
                <Label htmlFor="search" className="text-sm font-medium flex items-center">
                  Search by name
                  {searchTerm && <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full"></span>}
                </Label>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="search"
                    placeholder="File name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`pl-10 ${searchTerm ? 'ring-2 ring-blue-200 border-blue-300' : ''}`}
                  />
                </div>
              </div>

              {/* Filter by Patient */}
              <div className="space-y-2">
                <Label htmlFor="patient-id" className="text-sm font-medium flex items-center">
                  Patient
                  {patientIdFilter && <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full"></span>}
                </Label>
                <Select value={patientIdFilter || "all"} onValueChange={(value) => setPatientIdFilter(value === "all" ? "" : value)}>
                  <SelectTrigger className={patientIdFilter ? 'ring-2 ring-blue-200 border-blue-300' : ''}>
                    <SelectValue placeholder="All patients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All patients</SelectItem>
                    {uniquePatientIds.map(id => (
                      <SelectItem key={id} value={id}>{id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filter by Therapist */}
              <div className="space-y-2">
                <Label htmlFor="therapist-id" className="text-sm font-medium flex items-center">
                  Therapist
                  {therapistIdFilter && <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full"></span>}
                </Label>
                <Select value={therapistIdFilter || "all"} onValueChange={(value) => setTherapistIdFilter(value === "all" ? "" : value)}>
                  <SelectTrigger className={therapistIdFilter ? 'ring-2 ring-blue-200 border-blue-300' : ''}>
                    <SelectValue placeholder="All therapists" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All therapists</SelectItem>
                    {uniqueTherapistIds.map(id => (
                      <SelectItem key={id} value={id}>{id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Row 1 - Active filters summary */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-600">
                  Active filters
                </Label>
                <div className="text-xs text-slate-600 bg-blue-50 px-2 py-2 rounded border text-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full inline-block mr-1"></span>
                  {(() => {
                    const activeFilters = [
                      searchTerm && 'Search',
                      patientIdFilter && 'Patient',
                      therapistIdFilter && 'Therapist', 
                      (dateFromFilter || dateToFilter) && 'Date',
                      sizeFilter !== 'all' && 'Size'
                    ].filter(Boolean);
                    return `${activeFilters.length} active`;
                  })()}
                </div>
              </div>

              {/* Row 2 - Filter by size */}
              <div className="space-y-2">
                <Label htmlFor="size" className="text-sm font-medium flex items-center">
                  File size
                  {sizeFilter !== 'all' && <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full"></span>}
                </Label>
                <Select value={sizeFilter} onValueChange={(value: any) => setSizeFilter(value)}>
                  <SelectTrigger className={sizeFilter !== 'all' ? 'ring-2 ring-blue-200 border-blue-300' : ''}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sizes</SelectItem>
                    <SelectItem value="small">Small (&lt; 2MB)</SelectItem>
                    <SelectItem value="medium">Medium (2-10MB)</SelectItem>
                    <SelectItem value="large">Large (&gt; 10MB)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Row 2 - Filter by upload date range (spans 2 columns) */}
              <div className="space-y-2 lg:col-span-2">
                <Label className="text-sm font-medium flex items-center">
                  Upload Date Range
                  {(dateFromFilter || dateToFilter) && <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full"></span>}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={dateFromFilter}
                    onChange={(e) => setDateFromFilter(e.target.value)}
                    className={`text-sm flex-1 ${dateFromFilter ? 'ring-2 ring-blue-200 border-blue-300' : ''}`}
                    placeholder="From"
                  />
                  <span className="text-sm text-slate-500 px-1">to</span>
                  <Input
                    type="date"
                    value={dateToFilter}
                    onChange={(e) => setDateToFilter(e.target.value)}
                    className={`text-sm flex-1 ${dateToFilter ? 'ring-2 ring-blue-200 border-blue-300' : ''}`}
                    placeholder="To"
                  />
                </div>
              </div>

              {/* Row 2 - Clear filters button */}
              <div className="space-y-2">
                <Label className="text-sm font-medium invisible">Actions</Label>
                <Button 
                  onClick={clearFilters}
                  disabled={!searchTerm && !patientIdFilter && !therapistIdFilter && !dateFromFilter && !dateToFilter && sizeFilter === 'all'}
                  variant="destructive"
                  size="sm"
                  className="w-full disabled:opacity-50 bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700"
                >
                  <TrashIcon className="w-4 h-4 mr-2" />
                  Clear all filters
                </Button>
              </div>
            </div>
          </div>
        )}

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
          {paginatedFiles.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <FileIcon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="font-medium">No files found</p>
              <p className="text-sm">Try adjusting your filters or upload new files</p>
            </div>
          ) : (
            paginatedFiles.map((file) => {
              const shortSession = isShortSession(file.size);
              return (
                <div key={file.id} 
                    className={`flex flex-col md:flex-row gap-2 md:gap-4 items-start md:items-center py-3 px-4 rounded-lg transition-all duration-200 border ${
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
                          <span>Therapist: <span className="font-medium text-slate-700">{resolveTherapistId(file)}</span></span>
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
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="cursor-help">Session: {formatDate(resolveSessionDate(file)!)}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Session date: {formatFullDate(resolveSessionDate(file)!)}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {visibleColumns.upload_date && (
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="cursor-help">Upload: {formatDate(file.created_at)}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>File upload date: {formatFullDate(file.created_at)}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant={loadingFileId === file.id ? "default" : "default"}
                              onClick={() => handleFileAnalyze(file.id, file.name)}
                              disabled={isLoading || loadingFileId !== null}
                              className={`w-10 h-8 p-0 transition-all duration-200 flex items-center justify-center ${
                                loadingFileId === file.id 
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm' 
                                  : 'bg-primary hover:bg-primary/90 text-white border-primary hover:shadow-md'
                              } disabled:opacity-60 disabled:cursor-not-allowed`}
                            >
                              {loadingFileId === file.id ? (
                                <svg 
                                  className="animate-spin w-3 h-3 text-white" 
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
                                <PlayIcon className="w-3 h-3" />
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
                              size="sm"
                              variant="outline"
                              onClick={() => handleFileDownload(file.name)}
                              disabled={isLoading || loadingFileId !== null}
                              className="w-10 h-8 p-0 transition-all duration-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <DownloadIcon className="w-3 h-3" />
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
                          <span className="text-sm text-slate-600 truncate block">
                            <span className="font-medium text-slate-700">{resolveTherapistId(file)}</span>
                          </span>
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
                              <TooltipTrigger>
                                <span className="text-sm text-slate-600 cursor-help">
                                  {formatDate(resolveSessionDate(file)!)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Session date: {formatFullDate(resolveSessionDate(file)!)}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-sm text-slate-400">N/A</span>
                          )}
                        </div>
                      )}
                      {visibleColumns.upload_date && (
                        <div className="px-3 py-2 flex-1 min-w-0">
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="text-sm text-slate-600 cursor-help">
                                {formatDate(file.created_at)}
                              </span>
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
                              size="sm"
                              variant={loadingFileId === file.id ? "default" : "default"}
                              onClick={() => handleFileAnalyze(file.id, file.name)}
                              disabled={isLoading || loadingFileId !== null}
                              className={`w-8 h-8 p-0 transition-all duration-200 flex items-center justify-center ${
                                loadingFileId === file.id 
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm' 
                                  : 'bg-primary hover:bg-primary/90 text-white border-primary hover:shadow-md'
                              } disabled:opacity-60 disabled:cursor-not-allowed`}
                            >
                              {loadingFileId === file.id ? (
                                <svg 
                                  className="animate-spin w-3 h-3 text-white" 
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
                                <PlayIcon className="w-3 h-3" />
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
                              size="sm"
                              variant="outline"
                              onClick={() => handleFileDownload(file.name)}
                              disabled={isLoading || loadingFileId !== null}
                              className="w-8 h-8 p-0 transition-all duration-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <DownloadIcon className="w-3 h-3" />
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
            })
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-slate-500">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="text-xs"
              >
                Previous
              </Button>
              
              {/* Page numbers */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-8 h-8 p-0 text-xs"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Upload Confirmation Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UploadIcon className="w-5 h-5 text-blue-600" />
              Upload to C3D Library
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <div className="text-sm text-slate-600">
                You are about to upload <strong className="text-slate-800">
                  {pendingFiles?.length || 0} file{(pendingFiles?.length || 0) !== 1 ? 's' : ''}
                </strong> to the C3D Library.
              </div>
              <div className="bg-blue-50 p-3 rounded-md border-l-4 border-blue-400">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-xs text-blue-800">
                    <p className="font-medium mb-1">Files will be accessible to all researchers</p>
                    <p>Uploaded files are stored in the shared C3D bucket and can be viewed, analyzed, and downloaded by all authenticated platform users.</p>
                  </div>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={cancelUpload}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmUpload}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              Upload Files
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </Card>
    </TooltipProvider>
  );
};

export default C3DFileBrowser;