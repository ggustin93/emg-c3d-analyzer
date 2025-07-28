const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase configuration
const supabaseUrl = 'https://egihfsmxphqcsjotmhmm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnaWhmc214cGhxY3Nqb3RtaG1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxMzM0MDksImV4cCI6MjA2MjcwOTQwOX0.T-SPGmTmS0gR2fHvuYgcrcrJRjROk691T9zdMvEH78E';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Sample C3D files to upload (from frontend/public/samples)
const sampleFiles = [
  'frontend/public/samples/Ghostly_Emg_20230321_17-23-09-0409.c3d',
  'frontend/public/samples/Ghostly_Emg_20230321_17-28-14-0160.c3d',
  'frontend/public/samples/Ghostly_Emg_20230321_17-33-14-0785.c3d',
  'frontend/public/samples/Ghostly_Emg_20230321_17-50-17-0881.c3d',
  'frontend/public/samples/Ghostly_Emg_20231004_13-18-43-0464.c3d',
  'frontend/public/samples/Ghostly_Emg_20240304_10-05-56-0883.c3d',
  'frontend/public/samples/Ghostly_Emg_20250310_11-46-23-0823.c3d',
  'frontend/public/samples/Ghostly_Emg_20250310_11-50-16-0578.c3d'
];

async function testConnection() {
  console.log('🔍 Testing Supabase connection...');
  
  try {
    // Test if we can list buckets
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('❌ Error connecting to Supabase:', error.message);
      return false;
    }
    
    console.log('✅ Connected to Supabase successfully');
    console.log(`📦 Available buckets: ${buckets.map(b => b.name).join(', ')}`);
    
    // Check if c3d-examples bucket exists
    const c3dBucket = buckets.find(b => b.name === 'c3d-examples');
    if (!c3dBucket) {
      console.log('❌ c3d-examples bucket not found');
      return false;
    }
    
    console.log('✅ c3d-examples bucket found');
    return true;
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    return false;
  }
}

async function testPermissions() {
  console.log('\n🔐 Testing bucket permissions...');
  
  try {
    // Test read permission
    const { data: files, error: listError } = await supabase.storage
      .from('c3d-examples')
      .list('', { limit: 1 });
    
    if (listError) {
      console.error('❌ Cannot list files:', listError.message);
      return false;
    }
    
    console.log('✅ Read permission working');
    
    // Test upload permission with a small test file
    const testContent = 'test file for upload permission check';
    const testBlob = new Blob([testContent], { type: 'text/plain' });
    const testFile = new File([testBlob], 'permission-test.txt');
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('c3d-examples')
      .upload('permission-test.txt', testFile);
    
    if (uploadError) {
      console.error('❌ Cannot upload files:', uploadError.message);
      return false;
    }
    
    console.log('✅ Upload permission working');
    
    // Clean up test file
    await supabase.storage
      .from('c3d-examples')
      .remove(['permission-test.txt']);
    
    console.log('✅ Delete permission working');
    return true;
    
  } catch (error) {
    console.error('❌ Permission test failed:', error.message);
    return false;
  }
}

async function uploadSampleFile(filePath) {
  const fileName = path.basename(filePath);
  
  try {
    // Check if file exists locally
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return false;
    }
    
    // Read file data
    const fileBuffer = fs.readFileSync(filePath);
    const fileBlob = new Blob([fileBuffer], { type: 'application/octet-stream' });
    const file = new File([fileBlob], fileName);
    
    console.log(`📤 Uploading ${fileName} (${(file.size / 1024).toFixed(1)} KB)...`);
    
    // Upload to Supabase
    const { data, error } = await supabase.storage
      .from('c3d-examples')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true // Allow overwriting existing files
      });
    
    if (error) {
      console.error(`❌ Failed to upload ${fileName}:`, error.message);
      return false;
    }
    
    console.log(`✅ Successfully uploaded ${fileName}`);
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('c3d-examples')
      .getPublicUrl(fileName);
    
    console.log(`🔗 Public URL: ${urlData.publicUrl}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error uploading ${fileName}:`, error.message);
    return false;
  }
}

async function uploadAllSamples() {
  console.log('\n📤 Uploading sample C3D files...');
  console.log('=====================================');
  
  let successCount = 0;
  let totalCount = sampleFiles.length;
  
  for (const filePath of sampleFiles) {
    const success = await uploadSampleFile(filePath);
    if (success) {
      successCount++;
    }
    console.log(''); // Add spacing between uploads
  }
  
  console.log(`📊 Upload Summary: ${successCount}/${totalCount} files uploaded successfully`);
  
  if (successCount > 0) {
    console.log('\n🎉 Sample files are now available in the c3d-examples bucket!');
    console.log('🌐 You can access them through the frontend application.');
  }
  
  return successCount;
}

async function listUploadedFiles() {
  console.log('\n📋 Listing uploaded files...');
  
  try {
    const { data: files, error } = await supabase.storage
      .from('c3d-examples')
      .list('', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' }
      });
    
    if (error) {
      console.error('❌ Error listing files:', error.message);
      return;
    }
    
    if (!files || files.length === 0) {
      console.log('📁 No files found in bucket');
      return;
    }
    
    console.log(`📂 Found ${files.length} files:`);
    files.forEach(file => {
      const sizeKB = file.metadata?.size ? (file.metadata.size / 1024).toFixed(1) : 'unknown';
      console.log(`  📄 ${file.name} (${sizeKB} KB)`);
    });
    
  } catch (error) {
    console.error('❌ Error listing files:', error.message);
  }
}

async function main() {
  console.log('🚀 Supabase C3D Sample File Uploader');
  console.log('=====================================\n');
  
  // Test connection
  const connected = await testConnection();
  if (!connected) {
    console.log('\n❌ Connection failed. Please run the SQL setup script first.');
    console.log('   node supabase-rls-fix.js');
    return;
  }
  
  // Test permissions
  const hasPermissions = await testPermissions();
  if (!hasPermissions) {
    console.log('\n❌ Insufficient permissions. Please run the SQL setup script first.');
    console.log('   node supabase-rls-fix.js');
    return;
  }
  
  // Upload sample files
  const uploadedCount = await uploadAllSamples();
  
  if (uploadedCount > 0) {
    // List all files in bucket
    await listUploadedFiles();
    
    console.log('\n✅ Setup complete! The frontend should now be able to:');
    console.log('   - List C3D files from Supabase Storage');
    console.log('   - Download and analyze the files');
    console.log('   - Upload new C3D files');
  }
}

// Run the script
main().catch(console.error);