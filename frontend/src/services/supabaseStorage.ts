import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logger, LogCategory } from './logger';
import { ENV_CONFIG } from '../config/environment';

export interface C3DFileInfo {
  id: string;
  name: string;
  size: number;
  created_at: string;
  updated_at: string;
  patient_id?: string;
  therapist_id?: string;
  metadata?: {
    [key: string]: any;
  };
  public_url?: string;
}

export class SupabaseStorageService {
  // Get bucket name from centralized configuration
  private static readonly BUCKET_NAME = ENV_CONFIG.STORAGE_BUCKET_NAME;

  /**
   * Check if Supabase is properly configured
   */
  static isConfigured(): boolean {
    return isSupabaseConfigured();
  }

  /**
   * List all C3D files in the storage bucket
   */
  static async listC3DFiles(): Promise<C3DFileInfo[]> {
    if (!isSupabaseConfigured()) {
      logger.warn(LogCategory.API, 'Supabase not configured, returning empty list');
      return [];
    }

    // Check if bucket name is configured
    if (!this.BUCKET_NAME) {
      logger.error(LogCategory.API, 'Storage bucket name not configured (VITE_STORAGE_BUCKET_NAME missing)');
      throw new Error('Storage bucket name not configured. Please set VITE_STORAGE_BUCKET_NAME environment variable.');
    }

    try {
      logger.info(LogCategory.API, `📂 Attempting to list files from bucket: ${this.BUCKET_NAME}`);
      
      // Check if user is authenticated via Supabase
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        logger.error(LogCategory.AUTH, 'No valid Supabase session:', sessionError);
        throw new Error('Please sign in again to access the C3D file library. Your session may have expired.');
      }
      
      logger.debug(LogCategory.AUTH, `✅ User authenticated: ${session.user.email}`);
      
      // Skip bucket existence check - listBuckets() requires special permissions
      // Instead, we'll directly try to list files from the known bucket
      logger.debug(LogCategory.API, `✅ Proceeding directly to list files from known bucket: ${this.BUCKET_NAME}`);
      
      // Generic recursive directory discovery approach
      logger.debug(LogCategory.API, '📂 Starting recursive directory discovery...');
      
      // Step 1: Get root directory contents to discover subdirectories
      const rootOperation = supabase.storage
        .from(this.BUCKET_NAME)
        .list('', {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' }
        });
        
      const storageOperation = SupabaseStorageService.discoverAndListFiles(rootOperation);
        
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Storage operation timeout after 20 seconds')), 20000);
      });
      
      const { allFiles, hasError, errorMessage } = await Promise.race([storageOperation, timeoutPromise]);

      // If root directory failed and we have no files, throw error
      if (hasError && allFiles.length === 0) {
        // Provide better error messages for common storage issues
        if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
          logger.error(LogCategory.API, `Storage access failed for bucket '${this.BUCKET_NAME}': ${errorMessage}`);
          throw new Error(`Storage bucket '${this.BUCKET_NAME}' not accessible. Please check your permissions or contact an administrator.`);
        }
        
        if (errorMessage.includes('JWT') || errorMessage.includes('auth') || errorMessage.includes('permission')) {
          logger.error(LogCategory.API, `Authentication/permission error: ${errorMessage}`);
          throw new Error(`Permission denied accessing storage. Please sign in again or contact an administrator.`);
        }
        
        throw new Error(`Failed to list files: ${errorMessage}`);
      }

      if (allFiles.length === 0) {
        logger.info(LogCategory.API, 'No files returned from Supabase storage');
        return [];
      }

      logger.info(LogCategory.API, `📂 Found ${allFiles.length} total files across all directories`);
      
      // Filter out placeholder files
      const files = allFiles.filter((file: any) => !file.name.includes('.emptyFolderPlaceholder'));

      // Filter only .c3d files and transform the data
      const c3dFiles: C3DFileInfo[] = files
        .filter((file: any) => file.name.toLowerCase().endsWith('.c3d'))
        .map((file: any) => {
          // Extract patient ID from folder structure or filename
          const patientId = this.extractPatientId(file.name);
          
          // Extract therapist ID from metadata if available
          const therapistId = file.metadata?.therapist_id || this.extractTherapistId(file.name);
          
          return {
            id: file.id || file.name,
            name: file.name,
            size: file.metadata?.size || 0,
            created_at: file.created_at || new Date().toISOString(),
            updated_at: file.updated_at || file.created_at || new Date().toISOString(),
            patient_id: patientId,
            therapist_id: therapistId,
            metadata: file.metadata,
            public_url: this.getPublicUrl(file.name)
          };
        });

      logger.info(LogCategory.API, `Filtered to ${c3dFiles.length} C3D files`);
      return c3dFiles;
    } catch (error) {
      logger.error(LogCategory.API, 'Error in listC3DFiles:', error);
      throw error;
    }
  }

  /**
   * Generic method to discover and list files from all directories
   * Automatically discovers Patient ID folders and lists files recursively
   */
  static async discoverAndListFiles(rootOperation: Promise<any>): Promise<{
    allFiles: any[];
    hasError: boolean;
    errorMessage: string;
  }> {
    let allFiles: any[] = [];
    let hasError = false;
    let errorMessage = '';

    try {
      // Step 1: Get root directory files and discover subdirectories
      logger.debug(LogCategory.API, '📂 Listing files from root directory...');
      const rootResult = await rootOperation;
      
      if (rootResult.error) {
        logger.error(LogCategory.API, 'Error listing root files:', rootResult.error);
        hasError = true;
        errorMessage = rootResult.error.message;
      } else if (rootResult.data) {
        logger.debug(LogCategory.API, `📂 Found ${rootResult.data.length} items in root directory`);
        
        // Separate files from directories (directories don't have metadata.size)
        const rootFiles = rootResult.data.filter((item: any) => 
          item.name.toLowerCase().endsWith('.c3d') || item.metadata?.size
        );
        const directories = rootResult.data.filter((item: any) => 
          !item.metadata?.size && !item.name.includes('.') && item.name.match(/^P\d{3}$/)
        );
        
        allFiles.push(...rootFiles);
        logger.debug(LogCategory.API, `📂 Found ${rootFiles.length} files in root, ${directories.length} Patient ID directories`);
        
        // Step 2: Discover and list files from Patient ID subdirectories
        if (directories.length > 0) {
          const subdirectoryOperations = directories.map((dir: any) => 
            SupabaseStorageService.listDirectoryFiles(dir.name)
          );
          
          logger.debug(LogCategory.API, `📂 Listing files from ${directories.length} discovered subdirectories...`);
          const subdirectoryResults = await Promise.allSettled(subdirectoryOperations);
          
          // Process subdirectory results
          subdirectoryResults.forEach((result, index) => {
            const dirName = directories[index].name;
            
            if (result.status === 'fulfilled' && result.value.data) {
              logger.debug(LogCategory.API, `📂 Found ${result.value.data.length} files in ${dirName} directory`);
              // Add folder prefix to file names
              const prefixedFiles = result.value.data.map((file: any) => ({
                ...file,
                name: `${dirName}/${file.name}`
              }));
              allFiles.push(...prefixedFiles);
            } else if (result.status === 'rejected') {
              logger.warn(LogCategory.API, `Error listing ${dirName} files:`, result.reason);
            }
          });
        }
      }
    } catch (error) {
      logger.error(LogCategory.API, 'Error in discoverAndListFiles:', error);
      hasError = true;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
    }

    return { allFiles, hasError, errorMessage };
  }

  /**
   * List files from a specific directory
   */
  static async listDirectoryFiles(directoryName: string) {
    return supabase.storage
      .from(this.BUCKET_NAME)
      .list(directoryName, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      });
  }

  /**
   * Extract patient ID from file path or filename
   * This can be customized based on your folder structure
   */
  private static extractPatientId(filename: string): string {
    // Priority 1: If files are organized in folders like "P005/filename.c3d", "P008/filename.c3d"
    const folderMatch = filename.match(/^(P\d{3})\//);
    if (folderMatch) {
      return folderMatch[1];
    }

    // Priority 2: If patient ID is embedded in filename like "Ghostly_P001_..."
    const filenameMatch = filename.match(/[_-](P\d{3})[_-]/i);
    if (filenameMatch) {
      return filenameMatch[1].toUpperCase();
    }

    // Priority 3: If patient ID is at the beginning like "P001_Ghostly_..."
    const prefixMatch = filename.match(/^(P\d{3})[_-]/i);
    if (prefixMatch) {
      return prefixMatch[1].toUpperCase();
    }

    return 'Unknown';
  }

  /**
   * Extract therapist ID from file path or filename
   * This can be customized based on your naming convention
   */
  private static extractTherapistId(filename: string): string | undefined {
    // If therapist ID is embedded in filename like "Ghostly_P001_T005_..."
    const therapistMatch = filename.match(/[_-]T(\d{3})[_-]/i);
    if (therapistMatch) {
      return `T${therapistMatch[1]}`;
    }

    // If therapist ID is in a specific format like "therapist-005"
    const therapistMatch2 = filename.match(/therapist[_-](\d+)/i);
    if (therapistMatch2) {
      return `T${therapistMatch2[1].padStart(3, '0')}`;
    }

    return undefined;
  }

  /**
   * Get public URL for a file
   */
  static getPublicUrl(filename: string): string | undefined {
    if (!supabase) return undefined;

    const { data } = supabase.storage
      .from(this.BUCKET_NAME)
      .getPublicUrl(filename);

    return data.publicUrl;
  }

  /**
   * Download a file as a blob
   */
  static async downloadFile(filename: string): Promise<Blob> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    logger.info(LogCategory.API, `📥 Downloading file from Supabase: ${filename}`);

    const { data, error } = await supabase.storage
      .from(this.BUCKET_NAME)
      .download(filename);

    if (error) {
      logger.error(LogCategory.API, 'Error downloading file:', error);
      
      // Provide more specific error messages
      if (error.message.includes('not found')) {
        throw new Error(`File '${filename}' not found in storage bucket`);
      }
      
      throw new Error(`Failed to download file: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data received from file download');
    }

    logger.info(LogCategory.API, `✅ Successfully downloaded file: ${filename}, size: ${data.size} bytes`);
    return data;
  }

  /**
   * Check if a file exists in the bucket
   */
  static async fileExists(filename: string): Promise<boolean> {
    if (!supabase) {
      return false;
    }

    logger.debug(LogCategory.API, `🔍 Checking if file exists: ${filename}`);

    try {
      // Handle subfolder paths (e.g., "P005/filename.c3d")
      if (filename.includes('/')) {
        const parts = filename.split('/');
        const directory = parts.slice(0, -1).join('/'); // Get directory path
        const fileBasename = parts[parts.length - 1]; // Get just the filename
        
        logger.debug(LogCategory.API, `📂 Searching in directory: "${directory}" for file: "${fileBasename}"`);
        
        const { data, error } = await supabase.storage
          .from(this.BUCKET_NAME)
          .list(directory, {
            search: fileBasename
          });

        if (error) {
          logger.error(LogCategory.API, 'Error checking file existence in subdirectory:', error);
          return false;
        }

        const exists = data?.some(file => file.name === fileBasename) || false;
        logger.debug(LogCategory.API, `${exists ? '✅' : '❌'} File ${exists ? 'found' : 'not found'} in subdirectory`);
        return exists;
      } else {
        // Handle root directory files
        logger.debug(LogCategory.API, `📂 Searching in root directory for file: "${filename}"`);
        
        const { data, error } = await supabase.storage
          .from(this.BUCKET_NAME)
          .list('', {
            search: filename
          });

        if (error) {
          logger.error(LogCategory.API, 'Error checking file existence in root:', error);
          return false;
        }

        const exists = data?.some(file => file.name === filename) || false;
        logger.debug(LogCategory.API, `${exists ? '✅' : '❌'} File ${exists ? 'found' : 'not found'} in root directory`);
        return exists;
      }
    } catch (error) {
      logger.error(LogCategory.API, 'Error in fileExists:', error);
      return false;
    }
  }

  /**
   * Get file info without downloading the full file
   */
  static async getFileInfo(filename: string): Promise<C3DFileInfo | null> {
    if (!supabase) {
      return null;
    }

    logger.debug(LogCategory.API, `🔍 Getting file info for: ${filename}`);

    try {
      let data, error;

      // Handle subfolder paths (e.g., "P005/filename.c3d")
      if (filename.includes('/')) {
        const parts = filename.split('/');
        const directory = parts.slice(0, -1).join('/'); // Get directory path
        const fileBasename = parts[parts.length - 1]; // Get just the filename
        
        logger.debug(LogCategory.API, `📂 Getting info from directory: "${directory}" for file: "${fileBasename}"`);
        
        const result = await supabase.storage
          .from(this.BUCKET_NAME)
          .list(directory, {
            search: fileBasename
          });
        
        data = result.data;
        error = result.error;
      } else {
        // Handle root directory files
        logger.debug(LogCategory.API, `📂 Getting info from root directory for file: "${filename}"`);
        
        const result = await supabase.storage
          .from(this.BUCKET_NAME)
          .list('', {
            search: filename
          });
        
        data = result.data;
        error = result.error;
      }

      if (error || !data) {
        logger.error(LogCategory.API, 'Error getting file info:', error);
        return null;
      }

      // For subfolder files, we need to find by basename, not full path
      const searchName = filename.includes('/') ? filename.split('/').pop() : filename;
      const file = data.find(f => f.name === searchName);
      
      if (!file) {
        logger.debug(LogCategory.API, `❌ File info not found: ${filename}`);
        return null;
      }

      logger.debug(LogCategory.API, `✅ File info found: ${filename}`);

      return {
        id: file.id || filename, // Use full filename as ID to maintain consistency
        name: filename, // Return full path as name to maintain consistency
        size: file.metadata?.size || 0,
        created_at: file.created_at || new Date().toISOString(),
        updated_at: file.updated_at || file.created_at || new Date().toISOString(),
        patient_id: this.extractPatientId(filename), // Extract from full path
        therapist_id: file.metadata?.therapist_id || this.extractTherapistId(filename),
        metadata: file.metadata,
        public_url: this.getPublicUrl(filename) // Use full path for public URL
      };
    } catch (error) {
      logger.error(LogCategory.API, 'Error in getFileInfo:', error);
      return null;
    }
  }

  /**
   * Upload a file to the storage bucket
   */
  static async uploadFile(file: File, options?: { 
    patientId?: string;
    metadata?: Record<string, any>;
  }): Promise<{ path: string; publicUrl?: string }> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    // Check if user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      logger.error(LogCategory.AUTH, 'Session error:', sessionError);
      throw new Error('Authentication error. Please sign in again.');
    }

    if (!session) {
      logger.warn(LogCategory.AUTH, 'No active session found');
      throw new Error('Please sign in to upload files.');
    }

    logger.info(LogCategory.AUTH, `User authenticated: ${session.user.email}`);

    // Construct file path based on patient ID
    const filePath = options?.patientId 
      ? `${options.patientId}/${file.name}`
      : file.name;

    logger.info(LogCategory.API, `Uploading file to: ${filePath}`);

    const { data, error } = await supabase.storage
      .from(this.BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        metadata: options?.metadata
      });

    if (error) {
      logger.error(LogCategory.API, 'Error uploading file:', error);
      
      // Provide more specific error messages
      if (error.message.includes('row-level security')) {
        throw new Error('Permission denied. Please ensure you have access to upload files for this patient.');
      }
      
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data received from file upload');
    }

    logger.info(LogCategory.API, `✅ File uploaded successfully: ${data.path}`);
    const publicUrl = this.getPublicUrl(data.path);

    return {
      path: data.path,
      publicUrl
    };
  }

  /**
   * Delete a file from the storage bucket
   */
  static async deleteFile(filename: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { error } = await supabase.storage
      .from(this.BUCKET_NAME)
      .remove([filename]);

    if (error) {
      logger.error(LogCategory.API, 'Error deleting file:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Get file metadata
   */
  static async getFileMetadata(filename: string): Promise<C3DFileInfo | null> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    logger.debug(LogCategory.API, `🔍 Getting metadata for file: ${filename}`);

    try {
      let data, error;

      // Handle subfolder paths (e.g., "P005/filename.c3d")
      if (filename.includes('/')) {
        const parts = filename.split('/');
        const directory = parts.slice(0, -1).join('/'); // Get directory path
        const fileBasename = parts[parts.length - 1]; // Get just the filename
        
        logger.debug(LogCategory.API, `📂 Getting metadata from directory: "${directory}" for file: "${fileBasename}"`);
        
        const result = await supabase.storage
          .from(this.BUCKET_NAME)
          .list(directory, {
            search: fileBasename
          });
        
        data = result.data;
        error = result.error;
      } else {
        // Handle root directory files
        logger.debug(LogCategory.API, `📂 Getting metadata from root directory for file: "${filename}"`);
        
        const result = await supabase.storage
          .from(this.BUCKET_NAME)
          .list('', {
            search: filename
          });
        
        data = result.data;
        error = result.error;
      }

      if (error) {
        logger.error(LogCategory.API, 'Error getting file metadata:', error);
        throw new Error(`Failed to get file metadata: ${error.message}`);
      }

      // For subfolder files, we need to find by basename, not full path
      const searchName = filename.includes('/') ? filename.split('/').pop() : filename;
      const file = data?.find(f => f.name === searchName);
      
      if (!file) {
        logger.debug(LogCategory.API, `❌ File metadata not found: ${filename}`);
        return null;
      }
      
      logger.debug(LogCategory.API, `✅ File metadata found: ${filename}`);
      
      return {
        id: file.id || filename, // Use full filename as ID to maintain consistency
        name: filename, // Return full path as name to maintain consistency
        size: file.metadata?.size || 0,
        created_at: file.created_at || new Date().toISOString(),
        updated_at: file.updated_at || file.created_at || new Date().toISOString(),
        patient_id: this.extractPatientId(filename), // Extract from full path
        therapist_id: file.metadata?.therapist_id || this.extractTherapistId(filename),
        metadata: file.metadata
      };
    } catch (error) {
      logger.error(LogCategory.API, 'Error in getFileMetadata:', error);
      throw error;
    }
  }
}

export default SupabaseStorageService;