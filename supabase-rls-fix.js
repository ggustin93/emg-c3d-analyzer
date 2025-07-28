const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://egihfsmxphqcsjotmhmm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnaWhmc214cGhxY3Nqb3RtaG1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxMzM0MDksImV4cCI6MjA2MjcwOTQwOX0.T-SPGmTmS0gR2fHvuYgcrcrJRjROk691T9zdMvEH78E';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkBucketPolicies() {
  console.log('Checking c3d-examples bucket policies...');
  
  try {
    // First, let's try to list files to see what error we get
    const { data: files, error: listError } = await supabase.storage
      .from('c3d-examples')
      .list('', { limit: 1 });
    
    if (listError) {
      console.error('Error listing files:', listError);
      console.log('This suggests RLS policies are blocking access');
    } else {
      console.log('✅ Can list files - read access works');
      console.log(`Found ${files ? files.length : 0} files`);
    }
    
    // Try to upload a test file to check insert permissions
    const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('c3d-examples')
      .upload('test-upload.txt', testFile);
    
    if (uploadError) {
      console.error('Error uploading test file:', uploadError);
      console.log('This suggests upload permissions are blocked by RLS');
    } else {
      console.log('✅ Can upload files - insert access works');
      // Clean up test file
      await supabase.storage
        .from('c3d-examples')
        .remove(['test-upload.txt']);
    }
    
  } catch (error) {
    console.error('General error:', error);
  }
}

async function checkBucketExists() {
  console.log('Checking if c3d-examples bucket exists...');
  
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Error listing buckets:', error);
      return false;
    }
    
    console.log('Available buckets:', buckets.map(b => b.name));
    const bucketExists = buckets.some(bucket => bucket.name === 'c3d-examples');
    
    if (bucketExists) {
      console.log('✅ c3d-examples bucket exists');
      return true;
    } else {
      console.log('❌ c3d-examples bucket does not exist');
      return false;
    }
    
  } catch (error) {
    console.error('Error checking bucket existence:', error);
    return false;
  }
}

async function createBucket() {
  console.log('Creating c3d-examples bucket...');
  
  try {
    const { data, error } = await supabase.storage.createBucket('c3d-examples', {
      public: true, // Make bucket public
      allowedMimeTypes: ['application/octet-stream', 'application/x-c3d'], // Allow C3D files
      fileSizeLimit: 50 * 1024 * 1024 // 50MB limit
    });
    
    if (error) {
      console.error('Error creating bucket:', error);
      return false;
    }
    
    console.log('✅ Successfully created c3d-examples bucket');
    return true;
    
  } catch (error) {
    console.error('Error creating bucket:', error);
    return false;
  }
}

async function main() {
  console.log('🔧 Supabase RLS Policy Fixer for c3d-examples bucket\n');
  
  // Check if bucket exists
  const bucketExists = await checkBucketExists();
  
  if (bucketExists) {
    console.log('\n🔍 Testing current permissions...');
    await checkBucketPolicies();
  }
  
  console.log('\n📋 REQUIRED SETUP STEPS:');
  console.log('=========================================');
  console.log('');
  console.log('🌐 Open your Supabase dashboard:');
  console.log('   https://supabase.com/dashboard/project/egihfsmxphqcsjotmhmm');
  console.log('');
  console.log('⚡ QUICK FIX - Copy and paste this SQL in the SQL Editor:');
  console.log('   (Dashboard > SQL Editor > New Query)');
  console.log('');
  console.log('🔗 Or open the setup-supabase-storage.sql file that was created');
  console.log('');
  console.log('✅ After running the SQL, test again with:');
  console.log('   node supabase-rls-fix.js');
  console.log('');
  console.log('🚨 The issue: Bucket does not exist and RLS policies block creation');
  console.log('💡 The solution: Run the SQL script as an admin user');
}

// Run the script
main().catch(console.error);