import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isMarkedAsLoggedIn } from '../utils/authUtils';

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
  private static readonly BUCKET_NAME = 'c3d-examples';

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
      console.warn('Supabase not configured, returning empty list');
      return [];
    }

    try {
      console.log(`Attempting to list files from bucket: ${this.BUCKET_NAME}`);
      
      // Simple check - if not marked as logged in, don't proceed
      if (!isMarkedAsLoggedIn()) {
        throw new Error('Authentication required. Please sign in as a researcher to access C3D files.');
      }
      
      console.log('User is authenticated, proceeding with file listing...');
      
      // First check if the bucket exists to provide better error messages
      console.log('Checking if bucket exists...');
      try {
        const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
        if (bucketError) {
          throw new Error(`Failed to check buckets: ${bucketError.message}`);
        }
        
        const bucketExists = buckets.some(bucket => bucket.name === this.BUCKET_NAME);
        if (!bucketExists) {
          throw new Error(`Bucket '${this.BUCKET_NAME}' does not exist. Please create it in your Supabase dashboard.`);
        }
        console.log('✅ Bucket exists, proceeding with file listing...');
      } catch (bucketCheckError) {
        console.error('Bucket check failed:', bucketCheckError);
        throw bucketCheckError;
      }
      
      // Add timeout to storage operation to prevent hanging
      const storageOperation = supabase.storage
        .from(this.BUCKET_NAME)
        .list('', {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' }
        });
        
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Storage operation timeout after 20 seconds')), 20000);
      });
      
      const { data: files, error } = await Promise.race([storageOperation, timeoutPromise]);

      if (error) {
        console.error('Error listing files from Supabase:', error);
        
        // If bucket doesn't exist, try creating it or provide better error message
        if (error.message.includes('not found') || error.message.includes('does not exist')) {
          console.warn(`Bucket '${this.BUCKET_NAME}' not found. Please create the bucket in Supabase dashboard.`);
          throw new Error(`Storage bucket '${this.BUCKET_NAME}' not found. Please create it in your Supabase dashboard.`);
        }
        
        throw new Error(`Failed to list files: ${error.message}`);
      }

      if (!files) {
        console.log('No files returned from Supabase storage');
        return [];
      }

      console.log(`Found ${files.length} files in bucket`);

      // Filter only .c3d files and transform the data
      const c3dFiles: C3DFileInfo[] = files
        .filter(file => file.name.toLowerCase().endsWith('.c3d'))
        .map(file => {
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

      console.log(`Filtered to ${c3dFiles.length} C3D files`);
      return c3dFiles;
    } catch (error) {
      console.error('Error in listC3DFiles:', error);
      throw error;
    }
  }

  /**
   * Extract patient ID from file path or filename
   * This can be customized based on your folder structure
   */
  private static extractPatientId(filename: string): string {
    // If files are organized in folders like "P001/filename.c3d"
    const folderMatch = filename.match(/^([^\/]+)\//);
    if (folderMatch) {
      return folderMatch[1];
    }

    // If patient ID is embedded in filename like "Ghostly_P001_..."
    const filenameMatch = filename.match(/[_-]([P]\d{3})[_-]/i);
    if (filenameMatch) {
      return filenameMatch[1].toUpperCase();
    }

    // If patient ID is at the beginning like "P001_Ghostly_..."
    const prefixMatch = filename.match(/^([P]\d{3})[_-]/i);
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

    console.log(`Downloading file from Supabase: ${filename}`);

    const { data, error } = await supabase.storage
      .from(this.BUCKET_NAME)
      .download(filename);

    if (error) {
      console.error('Error downloading file:', error);
      
      // Provide more specific error messages
      if (error.message.includes('not found')) {
        throw new Error(`File '${filename}' not found in storage bucket`);
      }
      
      throw new Error(`Failed to download file: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data received from file download');
    }

    console.log(`Successfully downloaded file: ${filename}, size: ${data.size} bytes`);
    return data;
  }

  /**
   * Check if a file exists in the bucket
   */
  static async fileExists(filename: string): Promise<boolean> {
    if (!supabase) {
      return false;
    }

    try {
      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .list('', {
          search: filename
        });

      if (error) {
        console.error('Error checking file existence:', error);
        return false;
      }

      return data?.some(file => file.name === filename) || false;
    } catch (error) {
      console.error('Error in fileExists:', error);
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

    try {
      const { data: files, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .list('', {
          search: filename
        });

      if (error || !files) {
        console.error('Error getting file info:', error);
        return null;
      }

      const file = files.find(f => f.name === filename);
      if (!file) {
        return null;
      }

      return {
        id: file.id || file.name,
        name: file.name,
        size: file.metadata?.size || 0,
        created_at: file.created_at || new Date().toISOString(),
        updated_at: file.updated_at || file.created_at || new Date().toISOString(),
        patient_id: this.extractPatientId(file.name),
        therapist_id: file.metadata?.therapist_id || this.extractTherapistId(file.name),
        metadata: file.metadata,
        public_url: this.getPublicUrl(file.name)
      };
    } catch (error) {
      console.error('Error in getFileInfo:', error);
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

    // Construct file path based on patient ID
    const filePath = options?.patientId 
      ? `${options.patientId}/${file.name}`
      : file.name;

    const { data, error } = await supabase.storage
      .from(this.BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        metadata: options?.metadata
      });

    if (error) {
      console.error('Error uploading file:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data received from file upload');
    }

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
      console.error('Error deleting file:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Get file metadata
   */
  static async getFileMetadata(filename: string): Promise<any> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase.storage
      .from(this.BUCKET_NAME)
      .list('', {
        search: filename
      });

    if (error) {
      console.error('Error getting file metadata:', error);
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }

    const file = data?.find(f => f.name === filename);
    return file?.metadata || {};
  }
}

export default SupabaseStorageService;