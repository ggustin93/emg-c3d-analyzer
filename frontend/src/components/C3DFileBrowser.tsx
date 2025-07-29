import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  ClockIcon,
  UploadIcon,
  PlayIcon
} from '@radix-ui/react-icons';
import SupabaseStorageService, { C3DFileInfo } from '@/services/supabaseStorage';
import SupabaseSetup from '@/utils/supabaseSetup';
import { useAuth } from '@/hooks/useAuth';

// Using C3DFileInfo from the service
type C3DFile = C3DFileInfo;

interface C3DFileBrowserProps {
  onFileSelect: (filename: string) => void;
  isLoading?: boolean;
}

type SortField = 'name' | 'size' | 'created_at' | 'patient_id';
type SortDirection = 'asc' | 'desc';

const C3DFileBrowser: React.FC<C3DFileBrowserProps> = ({
  onFileSelect,
  isLoading = false
}) => {
  const { authState } = useAuth();
  const [files, setFiles] = useState<C3DFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [patientIdFilter, setPatientIdFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
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
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [filesPerPage] = useState(10);

  // Load files ONLY from Supabase c3d-examples bucket
  useEffect(() => {
    // Wait for authentication to be fully initialized before attempting to load files
    if (authState.loading) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Waiting for authentication to initialize...');
      }
      return;
    }

    const loadFiles = async (retryCount = 0) => {
      setIsLoadingFiles(true);
      setError(null);
      
      // Create timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        console.error('File loading timeout - forcing completion');
        setIsLoadingFiles(false);
        setError('Loading timeout. Please refresh the page or check your connection.');
      }, 20000); // 20 second timeout - more generous for auth restoration
      
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
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getSizeCategory = (bytes: number): 'small' | 'medium' | 'large' => {
    if (bytes < 2000000) return 'small'; // < 2MB
    if (bytes < 3000000) return 'medium'; // < 3MB
    return 'large';
  };

  const getSizeBadgeColor = (category: 'small' | 'medium' | 'large'): string => {
    switch (category) {
      case 'small': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'large': return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  // Filtered and sorted files
  const filteredAndSortedFiles = useMemo(() => {
    let filtered = files.filter(file => {
      const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPatientId = !patientIdFilter || 
        file.patient_id?.toLowerCase().includes(patientIdFilter.toLowerCase());
      const matchesDate = !dateFilter || 
        file.created_at.startsWith(dateFilter);
      const matchesSize = sizeFilter === 'all' || 
        getSizeCategory(file.size) === sizeFilter;

      return matchesSearch && matchesPatientId && matchesDate && matchesSize;
    });

    // Sort files
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle special cases
      if (sortField === 'patient_id') {
        aValue = a.patient_id || 'Unknown';
        bValue = b.patient_id || 'Unknown';
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
      if (sortField === 'created_at') {
        const comparison = new Date(aValue).getTime() - new Date(bValue).getTime();
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      return 0;
    });

    return filtered;
  }, [files, searchTerm, patientIdFilter, dateFilter, sizeFilter, sortField, sortDirection]);

  // Pagination calculations
  const totalFiles = filteredAndSortedFiles.length;
  const totalPages = Math.ceil(totalFiles / filesPerPage);
  const startIndex = (currentPage - 1) * filesPerPage;
  const endIndex = startIndex + filesPerPage;
  const paginatedFiles = filteredAndSortedFiles.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, patientIdFilter, dateFilter, sizeFilter]);

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
    setDateFilter('');
    setSizeFilter('all');
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
    onFileSelect(fileName);
  };

  // Reset loading state when general loading finishes
  useEffect(() => {
    if (!isLoading) {
      setLoadingFileId(null);
    }
  }, [isLoading]);

  // Get unique patient IDs for filter dropdown
  const uniquePatientIds = useMemo(() => {
    const ids = new Set(files.map(f => f.patient_id || 'Unknown'));
    return Array.from(ids).sort();
  }, [files]);

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
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshFiles}
                  disabled={isLoadingFiles}
                  className="flex items-center gap-2"
                >
                  <svg className={`w-4 h-4 ${isLoadingFiles ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </Button>
                
              </>
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
          <div className="bg-slate-50 p-4 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search by name */}
              <div className="space-y-2">
                <Label htmlFor="search" className="text-sm font-medium">Search by name</Label>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="search"
                    placeholder="File name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Filter by Patient ID */}
              <div className="space-y-2">
                <Label htmlFor="patient-id" className="text-sm font-medium">Patient ID</Label>
                <Select value={patientIdFilter || "all"} onValueChange={(value) => setPatientIdFilter(value === "all" ? "" : value)}>
                  <SelectTrigger>
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

              {/* Filter by date */}
              <div className="space-y-2">
                <Label htmlFor="date" className="text-sm font-medium">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </div>

              {/* Filter by size */}
              <div className="space-y-2">
                <Label htmlFor="size" className="text-sm font-medium">File size</Label>
                <Select value={sizeFilter} onValueChange={(value: any) => setSizeFilter(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sizes</SelectItem>
                    <SelectItem value="small">Small (&lt; 2MB)</SelectItem>
                    <SelectItem value="medium">Medium (2-3MB)</SelectItem>
                    <SelectItem value="large">Large (&gt; 3MB)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        )}

        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 text-sm font-medium text-slate-600 border-b pb-2">
          <div className="col-span-4">
            <button 
              onClick={() => handleSort('name')}
              className="flex items-center hover:text-slate-800 transition-colors"
            >
              <FileIcon className="w-4 h-4 mr-2" />
              File Name
              {getSortIcon('name')}
            </button>
          </div>
          <div className="col-span-2">
            <button 
              onClick={() => handleSort('patient_id')}
              className="flex items-center hover:text-slate-800 transition-colors"
            >
              <PersonIcon className="w-4 h-4 mr-2" />
              Patient ID
              {getSortIcon('patient_id')}
            </button>
          </div>
          <div className="col-span-2">
            <button 
              onClick={() => handleSort('size')}
              className="flex items-center hover:text-slate-800 transition-colors"
            >
              <ArchiveIcon className="w-4 h-4 mr-2" />
              Size
              {getSortIcon('size')}
            </button>
          </div>
          <div className="col-span-2">
            <button 
              onClick={() => handleSort('created_at')}
              className="flex items-center hover:text-slate-800 transition-colors"
            >
              <CalendarIcon className="w-4 h-4 mr-2" />
              Upload Date
              {getSortIcon('created_at')}
            </button>
          </div>
          <div className="col-span-2">
            Action
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
              const sizeCategory = getSizeCategory(file.size);
              return (
                <div 
                  key={file.id}
                  className={`grid grid-cols-12 gap-4 items-center py-3 px-4 rounded-lg transition-all duration-200 border ${
                    loadingFileId === file.id 
                      ? 'bg-green-50 border-green-200 shadow-sm' 
                      : 'border-slate-100 hover:bg-slate-50 hover:border-slate-200 hover:shadow-sm'
                  }`}
                >
                  <div className="col-span-4">
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
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Badge 
                      variant="secondary" 
                      className="text-xs bg-slate-100 text-slate-700 border-slate-200"
                    >
                      {file.patient_id || 'Unknown'}
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">
                        {formatFileSize(file.size)}
                      </span>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${getSizeBadgeColor(sizeCategory)}`}
                      >
                        {sizeCategory}
                      </Badge>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center text-sm text-slate-600">
                      <ClockIcon className="w-4 h-4 mr-1" />
                      {formatDate(file.created_at)}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Button
                      size="sm"
                      variant={loadingFileId === file.id ? "default" : "default"}
                      onClick={() => handleFileAnalyze(file.id, file.name)}
                      disabled={isLoading || loadingFileId !== null}
                      className={`w-full h-9 px-4 text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                        loadingFileId === file.id 
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm' 
                          : 'bg-primary hover:bg-primary/90 text-white border-primary hover:shadow-md'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                      aria-label={loadingFileId === file.id ? `Analyzing ${file.name}` : `Analyze ${file.name}`}
                    >
                      {loadingFileId === file.id ? (
                        <>
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
                          <span className="text-white">Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <PlayIcon className="w-4 h-4" />
                          <span>Analyze File</span>
                        </>
                      )}
                    </Button>
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
  );
};

export default C3DFileBrowser;