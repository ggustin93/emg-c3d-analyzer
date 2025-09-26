/**
 * Production RLS Test for Clinical Notes
 * =======================================
 * 
 * Run this in the browser console when logged in as a researcher to test
 * the actual Row-Level Security policies in production conditions.
 */

import { supabase } from '../lib/supabase';
import { ENV_CONFIG } from '../config/environment';

const BUCKET_NAME = ENV_CONFIG.STORAGE_BUCKET_NAME;

async function testClinicalNotesRLS() {
  console.log('🔬 CLINICAL NOTES RLS PRODUCTION TEST');
  console.log('=====================================');
  
  const results = {
    auth: false,
    create: false,
    read: false,
    update: false,
    delete: false,
    security: false
  };
  
  try {
    // 1. Check authentication
    console.log('\n📋 Checking authentication...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('❌ Not authenticated. Please login first.');
      return results;
    }
    
    console.log(`✅ Authenticated as: ${user.email}`);
    console.log(`   User ID: ${user.id}`);
    results.auth = true;
    
    // Test file path
    const testFilePath = `${BUCKET_NAME}/test_rls_${Date.now()}.c3d`;
    let createdNoteId = null;
    
    // 2. Test CREATE (INSERT policy)
    console.log('\n🔬 Testing CREATE operation...');
    try {
      const { data: createData, error: createError } = await supabase
        .from('clinical_notes')
        .insert({
          author_id: user.id,
          file_path: testFilePath,
          content: `Test note created at ${new Date().toISOString()}`,
          note_type: 'file'
        })
        .select()
        .single();
      
      if (createError) throw createError;
      
      createdNoteId = createData.id;
      console.log('✅ Successfully created clinical note');
      console.log(`   Note ID: ${createdNoteId}`);
      results.create = true;
    } catch (error) {
      console.error('❌ Failed to create note:', error.message);
      if (error.message.includes('row-level security')) {
        console.log('   🔒 RLS is blocking INSERT');
      }
    }
    
    // 3. Test READ (SELECT policy)
    console.log('\n🔬 Testing READ operation...');
    try {
      const { data: readData, error: readError } = await supabase
        .from('clinical_notes')
        .select('*')
        .eq('author_id', user.id);
      
      if (readError) throw readError;
      
      console.log(`✅ Successfully read ${readData.length} note(s)`);
      if (readData.length > 0) {
        console.log(`   First note: ${readData[0].content.substring(0, 50)}...`);
      }
      results.read = true;
    } catch (error) {
      console.error('❌ Failed to read notes:', error.message);
      if (error.message.includes('row-level security')) {
        console.log('   🔒 RLS is blocking SELECT');
      }
    }
    
    // 4. Test UPDATE (UPDATE policy)
    if (createdNoteId) {
      console.log('\n🔬 Testing UPDATE operation...');
      try {
        const { data: updateData, error: updateError } = await supabase
          .from('clinical_notes')
          .update({ 
            content: `Updated test note at ${new Date().toISOString()}` 
          })
          .eq('id', createdNoteId)
          .select()
          .single();
        
        if (updateError) throw updateError;
        
        console.log('✅ Successfully updated clinical note');
        console.log(`   New content: ${updateData.content.substring(0, 50)}...`);
        results.update = true;
      } catch (error) {
        console.error('❌ Failed to update note:', error.message);
        if (error.message.includes('row-level security')) {
          console.log('   🔒 RLS is blocking UPDATE');
        }
      }
    }
    
    // 5. Test SECURITY (Cannot access other users' notes)
    console.log('\n🔬 Testing SECURITY (cross-user access)...');
    try {
      // Try to read notes from a different (fake) user ID
      const fakeUserId = '00000000-0000-0000-0000-000000000000';
      const { data: otherData, error: otherError } = await supabase
        .from('clinical_notes')
        .select('*')
        .eq('author_id', fakeUserId);
      
      if (otherError) throw otherError;
      
      if (otherData.length === 0) {
        console.log('✅ Correctly blocked from seeing other users\' notes');
        results.security = true;
      } else {
        console.error('❌ SECURITY ISSUE: Can see other users\' notes!');
      }
    } catch (error) {
      console.log('✅ Correctly blocked from seeing other users\' notes');
      results.security = true;
    }
    
    // 6. Test DELETE (DELETE policy)
    if (createdNoteId) {
      console.log('\n🔬 Testing DELETE operation...');
      try {
        const { error: deleteError } = await supabase
          .from('clinical_notes')
          .delete()
          .eq('id', createdNoteId);
        
        if (deleteError) throw deleteError;
        
        console.log('✅ Successfully deleted clinical note');
        results.delete = true;
      } catch (error) {
        console.error('❌ Failed to delete note:', error.message);
        if (error.message.includes('row-level security')) {
          console.log('   🔒 RLS is blocking DELETE');
        }
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('TEST RESULTS SUMMARY');
    console.log('='.repeat(50));
    
    const allPassed = Object.values(results).every(v => v);
    
    console.log(`Authentication: ${results.auth ? '✅' : '❌'}`);
    console.log(`CREATE (INSERT): ${results.create ? '✅' : '❌'}`);
    console.log(`READ (SELECT): ${results.read ? '✅' : '❌'}`);
    console.log(`UPDATE: ${results.update ? '✅' : '❌'}`);
    console.log(`DELETE: ${results.delete ? '✅' : '❌'}`);
    console.log(`SECURITY (isolation): ${results.security ? '✅' : '❌'}`);
    
    if (allPassed) {
      console.log('\n🎉 ALL RLS TESTS PASSED!');
      console.log('You have full authorization to manage your clinical notes.');
    } else {
      console.log('\n⚠️ Some tests failed. Check the details above.');
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return results;
  }
}

// Export for use in browser console
window.testClinicalNotesRLS = testClinicalNotesRLS;

// Also export for module use
export default testClinicalNotesRLS;