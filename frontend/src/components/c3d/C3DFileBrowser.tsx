import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/Spinner';
import { MagnifyingGlassIcon, ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import SupabaseStorageService from '@/services/supabaseStorage';
import SupabaseSetup from '@/lib/supabaseSetup';
import { useAuth } from '@/contexts/AuthContext';
import { 
  C3DFile,
  resolvePatientId,
  resolveTherapistId,
  resolveSessionDate,
  getSizeCategory
} from '@/services/C3DFileDataResolver';
import C3DFileUpload from '@/components/c3d/C3DFileUpload';
import C3DFilterPanel, { FilterState } from '@/components/c3d/C3DFilterPanel';
import C3DFileList from '@/components/c3d/C3DFileList';
import C3DPagination from '@/components/c3d/C3DPagination';

interface C3DFileBrowserProps {
  onFileSelect: (filename: string, uploadDate?: string) => void;
  isLoading?: boolean;
}

const C3DFileBrowser: React.FC<C3DFileBrowserProps> = ({
  onFileSelect,
  isLoading = false
}) => {
  const { authState } = useAuth();
  
  // Core states
  const [files, setFiles] = useState<C3DFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    patientIdFilter: '',
    therapistIdFilter: '',
    dateFromFilter: '',
    dateToFilter: '',
    sizeFilter: 'all'
  });
  
  // UI states
  const [showFilters, setShowFilters] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [filesPerPage] = useState(10);
  
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

  // Load files from Supabase
  useEffect(() => {
    // Wait for authentication to be fully initialized before attempting to load files
    if (authState.loading) {
      if (import.meta.env.DEV) {
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

        if (import.meta.env.DEV) {
          console.log('Loading files from c3d-examples bucket...');
          console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
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

  // Filtered and sorted files
  const filteredFiles = useMemo(() => {
    return files.filter(file => {
      const matchesSearch = file.name.toLowerCase().includes(filters.searchTerm.toLowerCase());
      const resolvedPatient = resolvePatientId(file);
      const resolvedTherapist = resolveTherapistId(file);
      const matchesPatientId = !filters.patientIdFilter || 
        resolvedPatient.toLowerCase().includes(filters.patientIdFilter.toLowerCase());
      const matchesTherapistId = !filters.therapistIdFilter || 
        resolvedTherapist.toLowerCase().includes(filters.therapistIdFilter.toLowerCase());
      
      // Session date range filtering
      let matchesDateRange = true;
      if (filters.dateFromFilter || filters.dateToFilter) {
        const sessionDate = resolveSessionDate(file);
        
        // If file has no session date, exclude it from date-based filtering
        if (!sessionDate) {
          matchesDateRange = false;
        } else {
          const fileDate = new Date(sessionDate);
          const fromDate = filters.dateFromFilter ? new Date(filters.dateFromFilter) : null;
          const toDate = filters.dateToFilter ? new Date(filters.dateToFilter) : null;
          
          if (fromDate && fileDate < fromDate) matchesDateRange = false;
          if (toDate && fileDate > toDate) matchesDateRange = false;
        }
      }
      
      const matchesSize = filters.sizeFilter === 'all' || 
        getSizeCategory(file.size) === filters.sizeFilter;

      return matchesSearch && matchesPatientId && matchesTherapistId && matchesDateRange && matchesSize;
    });
  }, [files, filters]);

  // Pagination calculations
  const totalFiles = filteredFiles.length;
  const totalPages = Math.ceil(totalFiles / filesPerPage);
  const startIndex = (currentPage - 1) * filesPerPage;
  const endIndex = startIndex + filesPerPage;
  const paginatedFiles = filteredFiles.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Handle filter changes
  const handleFiltersChange = (newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const clearFilters = () => {
    setFilters({
      searchTerm: '',
      patientIdFilter: '',
      therapistIdFilter: '',
      dateFromFilter: '',
      dateToFilter: '',
      sizeFilter: 'all'
    });
  };

  // Get unique values for filter dropdowns
  const uniquePatientIds = useMemo(() => {
    const ids = new Set(files.map(f => resolvePatientId(f)));
    return Array.from(ids).sort();
  }, [files]);

  const uniqueTherapistIds = useMemo(() => {
    const ids = new Set(files.map(f => resolveTherapistId(f)));
    return Array.from(ids).sort();
  }, [files]);

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

  const handleUploadComplete = () => {
    refreshFiles();
  };

  const handleUploadError = (message: string) => {
    setError(message);
  };

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
              <C3DFileUpload
                onUploadComplete={handleUploadComplete}
                onError={handleUploadError}
                disabled={isSettingUp}
              />
            )}
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
          <C3DFilterPanel
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onClearFilters={clearFilters}
            uniquePatientIds={uniquePatientIds}
            uniqueTherapistIds={uniqueTherapistIds}
          />
        )}

        {/* File List */}
        <C3DFileList
          files={paginatedFiles}
          onFileSelect={onFileSelect}
          isLoading={isLoading}
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
  );
};

export default C3DFileBrowser;