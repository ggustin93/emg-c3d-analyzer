#!/usr/bin/env node

/**
 * Script to upload C3D sample files to Supabase storage bucket
 * Run with: node scripts/upload-samples.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase configuration
const SUPABASE_URL = 'https://egihfsmxphqcsjotmhmm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnaWhmc214cGhxY3Nqb3RtaG1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxMzM0MDksImV4cCI6MjA2MjcwOTQwOX0.T-SPGmTmS0gR2fHvuYgcrcrJRjROk691T9zdMvEH78E';
const BUCKET_NAME = 'c3d-examples';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Extract patient ID from filename pattern
 */
function extractPatientId(filename) {
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
 * Check if bucket exists by trying to list files
 */
async function ensureBucket() {
  console.log('Checking if bucket exists...');
  
  try {
    // Try to list files to check if bucket exists and is accessible
    const { data: files, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', { limit: 1 });
    
    if (error) {
      console.error('Error accessing bucket:', error.message);
      
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        console.log('❌ Bucket does not exist. Please create it manually in the Supabase dashboard.');
        console.log('   1. Go to your Supabase project dashboard');
        console.log('   2. Navigate to Storage');
        console.log(`   3. Create a new bucket named '${BUCKET_NAME}'`);
        console.log('   4. Make it public and allow the following MIME types: application/octet-stream');
        return false;
      }
      
      return false;
    }

    console.log(`✅ Bucket '${BUCKET_NAME}' exists and is accessible`);
    return true;
  } catch (error) {
    console.error('Unexpected error in ensureBucket:', error);
    return false;
  }
}

/**
 * Upload sample files from the samples directories
 */
async function uploadSampleFiles() {
  console.log('Starting sample file upload...');
  
  // Paths to sample directories
  const sampleDirs = [
    resolve(__dirname, '../frontend/public/samples'),
    resolve(__dirname, '../backend/tests/samples')
  ];
  
  const filesToUpload = [];
  
  // Collect all C3D files from sample directories
  for (const sampleDir of sampleDirs) {
    try {
      const files = readdirSync(sampleDir);
      for (const file of files) {
        if (file.toLowerCase().endsWith('.c3d')) {
          const fullPath = join(sampleDir, file);
          const stats = statSync(fullPath);
          filesToUpload.push({
            name: file,
            path: fullPath,
            size: stats.size
          });
        }
      }
    } catch (error) {
      console.warn(`Could not read directory ${sampleDir}:`, error.message);
    }
  }
  
  if (filesToUpload.length === 0) {
    console.log('❌ No C3D files found in sample directories');
    return { success: false, uploaded: 0, errors: ['No C3D files found'] };
  }
  
  console.log(`Found ${filesToUpload.length} C3D files to upload:`);
  filesToUpload.forEach(file => {
    console.log(`  - ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
  });
  
  let uploadedCount = 0;
  const errors = [];
  
  // Upload each file
  for (const file of filesToUpload) {
    try {
      console.log(`\nUploading ${file.name}...`);
      
      // Read file content
      const fileContent = readFileSync(file.path);
      const patientId = extractPatientId(file.name);
      
      // Upload to Supabase
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(file.name, fileContent, {
          contentType: 'application/octet-stream',
          upsert: true, // Allow overwriting existing files
          metadata: {
            patient_id: patientId,
            session_type: 'sample',
            original_source: 'upload_script',
            file_size: file.size
          }
        });

      if (error) {
        console.error(`❌ Failed to upload ${file.name}:`, error.message);
        errors.push(`${file.name}: ${error.message}`);
      } else {
        uploadedCount++;
        console.log(`✅ Uploaded ${file.name} successfully (Patient: ${patientId})`);
        
        // Get public URL for confirmation
        const { data: urlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(file.name);
        
        console.log(`   Public URL: ${urlData.publicUrl}`);
      }
    } catch (err) {
      console.error(`❌ Error uploading ${file.name}:`, err.message);
      errors.push(`${file.name}: ${err.message}`);
    }
  }
  
  return {
    success: uploadedCount > 0,
    uploaded: uploadedCount,
    total: filesToUpload.length,
    errors
  };
}

/**
 * List files in the bucket to verify upload
 */
async function listBucketFiles() {
  console.log('\nVerifying uploaded files...');
  
  try {
    const { data: files, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', {
        limit: 100,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (error) {
      console.error('Error listing bucket files:', error);
      return;
    }

    if (!files || files.length === 0) {
      console.log('❌ No files found in bucket');
      return;
    }

    console.log(`\n📁 Bucket '${BUCKET_NAME}' contains ${files.length} files:`);
    files.forEach(file => {
      const size = file.metadata?.size ? `(${(file.metadata.size / 1024).toFixed(1)} KB)` : '';
      console.log(`  - ${file.name} ${size}`);
    });
  } catch (error) {
    console.error('Error in listBucketFiles:', error);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting C3D sample file upload to Supabase...');
  console.log(`Target bucket: ${BUCKET_NAME}`);
  console.log(`Supabase URL: ${SUPABASE_URL}\n`);
  
  try {
    // Step 1: Ensure bucket exists
    const bucketReady = await ensureBucket();
    if (!bucketReady) {
      console.error('❌ Failed to create or access bucket');
      process.exit(1);
    }
    
    // Step 2: Upload sample files
    const result = await uploadSampleFiles();
    
    // Step 3: Show results
    console.log('\n📊 Upload Results:');
    console.log(`✅ Successfully uploaded: ${result.uploaded}/${result.total} files`);
    
    if (result.errors.length > 0) {
      console.log('❌ Errors encountered:');
      result.errors.forEach(error => console.log(`   ${error}`));
    }
    
    // Step 4: Verify uploads
    await listBucketFiles();
    
    if (result.success) {
      console.log('\n🎉 Sample file upload completed successfully!');
      console.log('\nThe C3D File Browser in the frontend should now display the uploaded files.');
    } else {
      console.error('\n❌ Upload failed or completed with errors');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the script
main();