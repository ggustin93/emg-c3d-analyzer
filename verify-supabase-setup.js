const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://egihfsmxphqcsjotmhmm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnaWhmc214cGhxY3Nqb3RtaG1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxMzM0MDksImV4cCI6MjA2MjcwOTQwOX0.T-SPGmTmS0gR2fHvuYgcrcrJRjROk691T9zdMvEH78E';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyConnection() {
  console.log('🔗 Verifying Supabase connection...');
  
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.log('❌ Connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Connected to Supabase successfully');
    return true;
    
  } catch (error) {
    console.log('❌ Connection error:', error.message);
    return false;
  }
}

async function verifyBucket() {
  console.log('📦 Verifying c3d-examples bucket...');
  
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.log('❌ Error listing buckets:', error.message);
      return false;
    }
    
    const c3dBucket = buckets.find(b => b.name === 'c3d-examples');
    if (!c3dBucket) {
      console.log('❌ c3d-examples bucket not found');
      console.log('Available buckets:', buckets.map(b => b.name).join(', '));
      return false;
    }
    
    console.log('✅ c3d-examples bucket exists');
    console.log(`   Public: ${c3dBucket.public}`);
    console.log(`   Created: ${c3dBucket.created_at}`);
    return true;
    
  } catch (error) {
    console.log('❌ Bucket verification error:', error.message);
    return false;
  }
}

async function verifyReadPermissions() {
  console.log('👀 Verifying READ permissions...');
  
  try {
    const { data: files, error } = await supabase.storage
      .from('c3d-examples')
      .list('', { limit: 5 });
    
    if (error) {
      console.log('❌ Read permission denied:', error.message);
      return false;
    }
    
    console.log('✅ Read permissions working');
    console.log(`   Found ${files ? files.length : 0} files`);
    return true;
    
  } catch (error) {
    console.log('❌ Read permission error:', error.message);
    return false;
  }
}

async function verifyUploadPermissions() {
  console.log('📤 Verifying UPLOAD permissions...');
  
  try {
    // Create a small test file
    const testContent = `Test file created at ${new Date().toISOString()}`;
    const testBlob = new Blob([testContent], { type: 'text/plain' });
    const testFile = new File([testBlob], 'test-upload-permissions.txt');
    
    const { data, error } = await supabase.storage
      .from('c3d-examples')
      .upload('test-upload-permissions.txt', testFile);
    
    if (error) {
      console.log('❌ Upload permission denied:', error.message);
      return false;
    }
    
    console.log('✅ Upload permissions working');
    console.log(`   Test file uploaded: ${data.path}`);
    
    // Clean up test file
    await supabase.storage
      .from('c3d-examples')
      .remove(['test-upload-permissions.txt']);
    
    console.log('   Test file cleaned up');
    return true;
    
  } catch (error) {
    console.log('❌ Upload permission error:', error.message);
    return false;
  }
}

async function verifyDownloadPermissions() {
  console.log('📥 Verifying DOWNLOAD permissions...');
  
  try {
    // First upload a test file
    const testContent = 'Download test content';
    const testBlob = new Blob([testContent], { type: 'text/plain' });
    const testFile = new File([testBlob], 'test-download.txt');
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('c3d-examples')
      .upload('test-download.txt', testFile);
    
    if (uploadError) {
      console.log('❌ Could not upload test file for download test:', uploadError.message);
      return false;
    }
    
    // Try to download it
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from('c3d-examples')
      .download('test-download.txt');
    
    if (downloadError) {
      console.log('❌ Download permission denied:', downloadError.message);
      // Clean up
      await supabase.storage.from('c3d-examples').remove(['test-download.txt']);
      return false;
    }
    
    console.log('✅ Download permissions working');
    console.log(`   Downloaded ${downloadData.size} bytes`);
    
    // Clean up test file
    await supabase.storage
      .from('c3d-examples')
      .remove(['test-download.txt']);
    
    console.log('   Test file cleaned up');
    return true;
    
  } catch (error) {
    console.log('❌ Download permission error:', error.message);
    return false;
  }
}

async function verifyPublicUrls() {
  console.log('🌐 Verifying PUBLIC URL access...');
  
  try {
    // Upload a test file
    const testContent = 'Public URL test content';
    const testBlob = new Blob([testContent], { type: 'text/plain' });
    const testFile = new File([testBlob], 'test-public-url.txt');
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('c3d-examples')
      .upload('test-public-url.txt', testFile);
    
    if (uploadError) {
      console.log('❌ Could not upload test file for public URL test:', uploadError.message);
      return false;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('c3d-examples')
      .getPublicUrl('test-public-url.txt');
    
    console.log('✅ Public URL generated');
    console.log(`   URL: ${urlData.publicUrl}`);
    
    // Test if the URL is accessible (basic check)
    try {
      const response = await fetch(urlData.publicUrl);
      if (response.ok) {
        console.log('✅ Public URL is accessible');
        const content = await response.text();
        console.log(`   Content preview: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`);
      } else {
        console.log(`⚠️  Public URL returned status: ${response.status}`);
      }
    } catch (fetchError) {
      console.log('⚠️  Could not fetch public URL (may be normal):', fetchError.message);
    }
    
    // Clean up test file
    await supabase.storage
      .from('c3d-examples')
      .remove(['test-public-url.txt']);
    
    console.log('   Test file cleaned up');
    return true;
    
  } catch (error) {
    console.log('❌ Public URL error:', error.message);
    return false;
  }
}

async function generateSetupReport() {
  console.log('\n📊 SUPABASE SETUP VERIFICATION REPORT');
  console.log('=====================================');
  
  const results = {
    connection: await verifyConnection(),
    bucket: false,
    readPermissions: false,
    uploadPermissions: false,
    downloadPermissions: false,
    publicUrls: false
  };
  
  if (results.connection) {
    results.bucket = await verifyBucket();
    
    if (results.bucket) {
      results.readPermissions = await verifyReadPermissions();
      results.uploadPermissions = await verifyUploadPermissions();
      results.downloadPermissions = await verifyDownloadPermissions();
      results.publicUrls = await verifyPublicUrls();
    }
  }
  
  console.log('\n📈 RESULTS SUMMARY:');
  console.log('==================');
  console.log(`🔗 Connection:       ${results.connection ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`📦 Bucket exists:    ${results.bucket ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`👀 Read access:      ${results.readPermissions ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`📤 Upload access:    ${results.uploadPermissions ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`📥 Download access:  ${results.downloadPermissions ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🌐 Public URLs:      ${results.publicUrls ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(result => result === true);
  
  if (allPassed) {
    console.log('\n🎉 ALL TESTS PASSED! Supabase setup is complete.');
    console.log('');
    console.log('✅ Your frontend application should now be able to:');
    console.log('   - List C3D files from the Supabase bucket');
    console.log('   - Upload new C3D files');
    console.log('   - Download and analyze existing files');
    console.log('   - Generate public URLs for file sharing');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('   1. Run: node upload-sample-files.js');
    console.log('   2. Test the frontend application');
    console.log('   3. Verify file browser functionality');
    
    return true;
  } else {
    console.log('\n❌ SOME TESTS FAILED. Please fix the issues above.');
    console.log('');
    console.log('💡 If tests are failing, try:');
    console.log('   1. Re-run the SQL setup script in Supabase dashboard');
    console.log('   2. Check that all RLS policies were created correctly');
    console.log('   3. Verify the bucket is set to public');
    console.log('   4. Run this verification script again');
    
    return false;
  }
}

// Run the verification
generateSetupReport().catch(console.error);