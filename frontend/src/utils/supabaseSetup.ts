import { supabase } from '@/services/supabaseStorage';

/**
 * Setup utility for Supabase storage bucket
 * This helps create the required bucket and set proper policies
 */
export class SupabaseSetup {
  private static readonly BUCKET_NAME = 'c3d-examples';

  /**
   * Create the storage bucket if it doesn't exist
   */
  static async createBucket(): Promise<{ success: boolean; message: string }> {
    if (!supabase) {
      return { success: false, message: 'Supabase not configured' };
    }

    try {
      // Check if bucket already exists
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        console.error('Error listing buckets:', listError);
        return { success: false, message: `Failed to check existing buckets: ${listError.message}` };
      }

      const bucketExists = buckets?.some(bucket => bucket.name === this.BUCKET_NAME);
      
      if (bucketExists) {
        return { success: true, message: `Bucket '${this.BUCKET_NAME}' already exists` };
      }

      // Create the bucket
      const { data, error } = await supabase.storage.createBucket(this.BUCKET_NAME, {
        public: true,
        allowedMimeTypes: ['application/octet-stream'],
        fileSizeLimit: 10485760 // 10MB
      });

      if (error) {
        console.error('Error creating bucket:', error);
        return { success: false, message: `Failed to create bucket: ${error.message}` };
      }

      console.log('Bucket created successfully:', data);
      return { success: true, message: `Bucket '${this.BUCKET_NAME}' created successfully` };

    } catch (error: any) {
      console.error('Unexpected error in createBucket:', error);
      return { success: false, message: `Unexpected error: ${error.message}` };
    }
  }

  /**
   * Upload actual sample C3D files from the public/samples directory
   */
  static async uploadSampleFiles(): Promise<{ success: boolean; message: string }> {
    if (!supabase) {
      return { success: false, message: 'Supabase not configured' };
    }

    try {
      // Define the actual sample files from public/samples directory
      const sampleFileNames = [
        'Ghostly_Emg_20230321_17-23-09-0409.c3d',
        'Ghostly_Emg_20230321_17-28-14-0160.c3d',
        'Ghostly_Emg_20230321_17-33-14-0785.c3d',
        'Ghostly_Emg_20230321_17-50-17-0881.c3d',
        'Ghostly_Emg_20231004_13-18-43-0464.c3d',
        'Ghostly_Emg_20240304_10-05-56-0883.c3d',
        'Ghostly_Emg_20250310_11-46-23-0823.c3d',
        'Ghostly_Emg_20250310_11-50-16-0578.c3d'
      ];

      let uploadedCount = 0;
      const errors: string[] = [];

      for (const fileName of sampleFileNames) {
        try {
          // Fetch the file from the public/samples directory
          const response = await fetch(`/samples/${fileName}`);
          
          if (!response.ok) {
            errors.push(`Failed to fetch ${fileName}: ${response.statusText}`);
            continue;
          }

          const fileBlob = await response.blob();
          
          // Extract patient ID from filename pattern
          const patientId = this.extractPatientIdFromFilename(fileName);
          
          // Upload to Supabase storage
          const { data, error } = await supabase.storage
            .from(this.BUCKET_NAME)
            .upload(fileName, fileBlob, {
              contentType: 'application/octet-stream',
              upsert: true, // Allow overwriting existing files
              metadata: {
                patient_id: patientId,
                session_type: 'baseline',
                original_source: 'sample_file'
              }
            });

          if (error) {
            errors.push(`Failed to upload ${fileName}: ${error.message}`);
          } else {
            uploadedCount++;
            console.log(`Uploaded: ${fileName} (${fileBlob.size} bytes)`);
          }
        } catch (err: any) {
          errors.push(`Error processing ${fileName}: ${err.message}`);
        }
      }

      if (errors.length > 0) {
        return { 
          success: uploadedCount > 0, 
          message: `Uploaded ${uploadedCount}/${sampleFileNames.length} files. Errors: ${errors.join(', ')}` 
        };
      }

      return { 
        success: true, 
        message: `Successfully uploaded ${uploadedCount} sample C3D files to bucket '${this.BUCKET_NAME}'` 
      };

    } catch (error: any) {
      console.error('Unexpected error in uploadSampleFiles:', error);
      return { success: false, message: `Unexpected error: ${error.message}` };
    }
  }

  /**
   * Extract patient ID from filename pattern
   */
  private static extractPatientIdFromFilename(filename: string): string {
    // Extract date from filename to create a consistent patient ID
    const dateMatch = filename.match(/(\d{8})/);
    if (dateMatch) {
      const date = dateMatch[1];
      // Create patient ID based on date (e.g., 20230321 -> P001)
      const dateNum = parseInt(date);
      const patientNum = ((dateNum % 1000) % 100) + 1;
      return `P${patientNum.toString().padStart(3, '0')}`;
    }
    
    return 'P001'; // Default fallback
  }

  /**
   * Complete setup: create bucket and upload sample files
   */
  static async completeSetup(): Promise<{ success: boolean; message: string }> {
    try {
      // Step 1: Create bucket
      const bucketResult = await this.createBucket();
      if (!bucketResult.success && !bucketResult.message.includes('already exists')) {
        return bucketResult;
      }

      // Step 2: Upload sample files
      const uploadResult = await this.uploadSampleFiles();
      
      return {
        success: bucketResult.success && uploadResult.success,
        message: `${bucketResult.message}. ${uploadResult.message}`
      };

    } catch (error: any) {
      return { success: false, message: `Setup failed: ${error.message}` };
    }
  }
}

export default SupabaseSetup;