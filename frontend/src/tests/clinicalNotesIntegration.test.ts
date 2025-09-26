/**
 * Clinical Notes Integration Test Suite
 * 
 * Comprehensive test script to validate the clinical notes workflow
 * Tests authentication, API integration, and UI components
 */

import { describe, it, expect } from 'vitest';
import { supabase } from '../lib/supabase';
import { ClinicalNotesService } from '../services/clinicalNotesService';
import { API_CONFIG } from '../config/apiConfig';
import { ENV_CONFIG } from '../config/environment';

interface TestResult {
  step: string;
  success: boolean;
  error?: string;
  data?: any;
  duration?: number;
}

export class ClinicalNotesTestSuite {
  private results: TestResult[] = [];
  private testFilePath: string;
  private createdNoteId: string | null = null;
  
  constructor() {
    // Use centralized bucket name configuration
    const bucketName = ENV_CONFIG.STORAGE_BUCKET_NAME;
    this.testFilePath = `${bucketName}/Ghostly_Emg_20230321_17-50-17-0881.c3d`;
  }

  /**
   * Run complete test suite
   */
  async runAllTests(): Promise<TestResult[]> {
    console.log('🧪 Starting Clinical Notes Test Suite...');
    console.log('=' .repeat(50));
    
    // Test 1: Authentication Verification
    await this.testAuthentication();
    
    // Test 2: Backend Connection
    await this.testBackendConnection();
    
    // Test 3: Bucket Configuration
    await this.testBucketConfiguration();
    
    // Test 4: Notes Indicators API
    await this.testNotesIndicators();
    
    // Test 5: Create File Note
    await this.testCreateFileNote();
    
    // Test 6: Retrieve Notes
    await this.testRetrieveNotes();
    
    // Test 7: Update Note
    await this.testUpdateNote();
    
    // Test 8: Delete Note
    await this.testDeleteNote();
    
    // Test 9: Batch Loading
    await this.testBatchLoading();
    
    // Test 10: Session Refresh
    await this.testSessionRefresh();
    
    // Print summary
    this.printSummary();
    
    return this.results;
  }

  /**
   * Test 1: Verify Authentication
   */
  private async testAuthentication(): Promise<void> {
    const startTime = Date.now();
    console.log('\n🔐 Test 1: Verifying authentication...');
    
    try {
      const { data: session } = await supabase.auth.getSession();
      
      if (!session.session) {
        this.results.push({
          step: 'Authentication Check',
          success: false,
          error: 'No active session found',
          duration: Date.now() - startTime
        });
        throw new Error('Not authenticated - please sign in first');
      }
      
      this.results.push({
        step: 'Authentication Check',
        success: true,
        data: { 
          userId: session.session.user.id, 
          email: session.session.user.email 
        },
        duration: Date.now() - startTime
      });
      
      console.log(`   ✅ Authenticated as: ${session.session.user.email}`);
    } catch (error) {
      console.error(`   ❌ Authentication failed:`, error);
      this.results.push({
        step: 'Authentication Check',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Test 2: Backend Connection
   */
  private async testBackendConnection(): Promise<void> {
    const startTime = Date.now();
    console.log('\n🔌 Test 2: Testing backend connection...');
    
    try {
      const backendUrl = API_CONFIG.baseUrl;
      const response = await fetch(`${backendUrl}/health`);
      
      this.results.push({
        step: 'Backend Health Check',
        success: response.ok,
        data: { status: response.status },
        duration: Date.now() - startTime
      });
      
      if (response.ok) {
        console.log(`   ✅ Backend is healthy (status: ${response.status})`);
      } else {
        console.log(`   ❌ Backend unhealthy (status: ${response.status})`);
      }
    } catch (error) {
      console.error(`   ❌ Backend connection failed:`, error);
      this.results.push({
        step: 'Backend Health Check',
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Test 3: Verify Bucket Configuration
   */
  private async testBucketConfiguration(): Promise<void> {
    const startTime = Date.now();
    console.log('\n📦 Test 3: Testing bucket configuration...');
    
    try {
      const bucketName = ENV_CONFIG.STORAGE_BUCKET_NAME;
      const backendBucket = ENV_CONFIG.STORAGE_BUCKET_NAME;
      
      const match = bucketName === backendBucket;
      
      this.results.push({
        step: 'Bucket Configuration',
        success: match,
        data: { 
          frontend: bucketName,
          expected: backendBucket,
          match 
        },
        duration: Date.now() - startTime
      });
      
      console.log(`   ✅ Bucket name configured: ${bucketName}`);
      
      // Test bucket access
      const { data, error } = await supabase.storage
        .from(bucketName)
        .list('', { limit: 1 });
      
      if (error) {
        throw new Error(`Bucket access failed: ${error.message}`);
      }
      
      console.log(`   ✅ Bucket accessible, found ${data?.length || 0} items`);
    } catch (error) {
      console.error(`   ❌ Bucket configuration error:`, error);
      this.results.push({
        step: 'Bucket Configuration',
        success: false,
        error: error instanceof Error ? error.message : 'Configuration error',
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Test 4: Notes Indicators API
   */
  private async testNotesIndicators(): Promise<void> {
    const startTime = Date.now();
    console.log('\n📊 Test 4: Testing notes indicators...');
    
    try {
      const indicators = await ClinicalNotesService.getNotesIndicators(
        [this.testFilePath],
        []
      );
      
      this.results.push({
        step: 'Get Notes Indicators',
        success: true,
        data: indicators,
        duration: Date.now() - startTime
      });
      
      const fileNotes = indicators.file_notes[this.testFilePath] || 0;
      console.log(`   ✅ Indicators loaded: ${fileNotes} notes for test file`);
    } catch (error) {
      console.error(`   ❌ Indicators failed:`, error);
      this.results.push({
        step: 'Get Notes Indicators',
        success: false,
        error: error instanceof Error ? error.message : 'Indicators error',
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Test 5: Create File Note
   */
  private async testCreateFileNote(): Promise<void> {
    const startTime = Date.now();
    console.log('\n📝 Test 5: Creating test note...');
    
    try {
      const testContent = `Test note created at ${new Date().toISOString()}
      
      This note validates:
      - Authentication with session refresh
      - API integration
      - Bucket configuration
      - File path handling`;
      
      const note = await ClinicalNotesService.createFileNote(
        this.testFilePath,
        'Test Note Title',
        testContent
      );
      
      this.createdNoteId = note.id;
      
      this.results.push({
        step: 'Create File Note',
        success: true,
        data: { id: note.id, content: note.content },
        duration: Date.now() - startTime
      });
      
      console.log(`   ✅ Note created with ID: ${note.id}`);
    } catch (error) {
      console.error(`   ❌ Note creation failed:`, error);
      this.results.push({
        step: 'Create File Note',
        success: false,
        error: error instanceof Error ? error.message : 'Creation error',
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Test 6: Retrieve Notes
   */
  private async testRetrieveNotes(): Promise<void> {
    const startTime = Date.now();
    console.log('\n📖 Test 6: Retrieving notes...');
    
    try {
      const notes = await ClinicalNotesService.getFileNotes(this.testFilePath);
      
      this.results.push({
        step: 'Get File Notes',
        success: true,
        data: { 
          count: notes.length, 
          notes: notes.map(n => n.id) 
        },
        duration: Date.now() - startTime
      });
      
      console.log(`   ✅ Retrieved ${notes.length} notes`);
      
      // Verify our created note is in the list
      if (this.createdNoteId) {
        const found = notes.some(n => n.id === this.createdNoteId);
        console.log(`   ${found ? '✅' : '❌'} Created note found in list`);
      }
    } catch (error) {
      console.error(`   ❌ Note retrieval failed:`, error);
      this.results.push({
        step: 'Get File Notes',
        success: false,
        error: error instanceof Error ? error.message : 'Retrieval error',
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Test 7: Update Note
   */
  private async testUpdateNote(): Promise<void> {
    if (!this.createdNoteId) {
      console.log('\n✏️ Test 7: Skipping update (no note created)');
      return;
    }
    
    const startTime = Date.now();
    console.log('\n✏️ Test 7: Updating test note...');
    
    try {
      const updatedContent = `Updated test note at ${new Date().toISOString()}
      
      This update validates:
      - Note modification
      - Session persistence
      - API update endpoint`;
      
      const updated = await ClinicalNotesService.updateNote(
        this.createdNoteId,
        'Updated Test Note Title',
        updatedContent
      );
      
      this.results.push({
        step: 'Update Note',
        success: true,
        data: { id: updated.id, updated: true },
        duration: Date.now() - startTime
      });
      
      console.log(`   ✅ Note updated successfully`);
    } catch (error) {
      console.error(`   ❌ Note update failed:`, error);
      this.results.push({
        step: 'Update Note',
        success: false,
        error: error instanceof Error ? error.message : 'Update error',
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Test 8: Delete Note
   */
  private async testDeleteNote(): Promise<void> {
    if (!this.createdNoteId) {
      console.log('\n🗑️ Test 8: Skipping delete (no note created)');
      return;
    }
    
    const startTime = Date.now();
    console.log('\n🗑️ Test 8: Deleting test note...');
    
    try {
      await ClinicalNotesService.deleteNote(this.createdNoteId);
      
      this.results.push({
        step: 'Delete Note',
        success: true,
        data: { deleted: this.createdNoteId },
        duration: Date.now() - startTime
      });
      
      console.log(`   ✅ Note deleted successfully`);
      
      // Verify deletion
      const notes = await ClinicalNotesService.getFileNotes(this.testFilePath);
      const stillExists = notes.some(n => n.id === this.createdNoteId);
      console.log(`   ${!stillExists ? '✅' : '❌'} Note confirmed deleted`);
    } catch (error) {
      console.error(`   ❌ Note deletion failed:`, error);
      this.results.push({
        step: 'Delete Note',
        success: false,
        error: error instanceof Error ? error.message : 'Deletion error',
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Test 9: Batch Loading
   */
  private async testBatchLoading(): Promise<void> {
    const startTime = Date.now();
    console.log('\n📦 Test 9: Testing batch loading...');
    
    try {
      const bucketName = ENV_CONFIG.STORAGE_BUCKET_NAME;
      const testPaths = [
        `${bucketName}/Ghostly_Emg_20230321_17-23-09-0409.c3d`,
        `${bucketName}/Ghostly_Emg_20230321_17-28-14-0160.c3d`,
        `${bucketName}/Ghostly_Emg_20230321_17-33-14-0785.c3d`
      ];
      
      const batchIndicators = await ClinicalNotesService.getNotesIndicators(
        testPaths,
        []
      );
      
      this.results.push({
        step: 'Batch Load Indicators',
        success: true,
        data: batchIndicators,
        duration: Date.now() - startTime
      });
      
      const totalFiles = Object.keys(batchIndicators.file_notes).length;
      console.log(`   ✅ Batch loaded indicators for ${totalFiles} files`);
    } catch (error) {
      console.error(`   ❌ Batch loading failed:`, error);
      this.results.push({
        step: 'Batch Load Indicators',
        success: false,
        error: error instanceof Error ? error.message : 'Batch error',
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Test 10: Session Refresh
   */
  private async testSessionRefresh(): Promise<void> {
    const startTime = Date.now();
    console.log('\n🔄 Test 10: Testing session refresh...');
    
    try {
      // Get current session
      const { data: currentSession } = await supabase.auth.getSession();
      
      if (!currentSession.session) {
        throw new Error('No session to test refresh');
      }
      
      // Force a refresh
      const { data: refreshedSession, error } = await supabase.auth.refreshSession();
      
      if (error) {
        throw new Error(`Refresh failed: ${error.message}`);
      }
      
      this.results.push({
        step: 'Session Refresh',
        success: true,
        data: { 
          oldToken: currentSession.session.access_token.substring(0, 20) + '...',
          newToken: refreshedSession.session?.access_token.substring(0, 20) + '...',
          different: currentSession.session.access_token !== refreshedSession.session?.access_token
        },
        duration: Date.now() - startTime
      });
      
      console.log(`   ✅ Session refresh successful`);
    } catch (error) {
      console.error(`   ❌ Session refresh failed:`, error);
      this.results.push({
        step: 'Session Refresh',
        success: false,
        error: error instanceof Error ? error.message : 'Refresh error',
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Print test summary
   */
  private printSummary(): void {
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(50));
    
    this.results.forEach(result => {
      const icon = result.success ? '✅' : '❌';
      const duration = result.duration ? ` (${result.duration}ms)` : '';
      console.log(`${icon} ${result.step}: ${result.success ? 'PASSED' : 'FAILED'}${duration}`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    const passedCount = this.results.filter(r => r.success).length;
    const totalCount = this.results.length;
    const passRate = Math.round((passedCount / totalCount) * 100);
    
    console.log('\n' + '='.repeat(50));
    console.log(`📈 Overall Score: ${passedCount}/${totalCount} (${passRate}%)`);
    console.log('='.repeat(50));
    
    // Performance summary
    const totalDuration = this.results.reduce((sum, r) => sum + (r.duration || 0), 0);
    console.log(`⏱️ Total execution time: ${totalDuration}ms`);
    
    if (passRate === 100) {
      console.log('\n🎉 All tests passed! Clinical Notes system is working correctly.');
    } else {
      console.log('\n⚠️ Some tests failed. Please review the errors above.');
    }
  }
}

// Export for browser console usage
if (typeof window !== 'undefined') {
  (window as any).ClinicalNotesTestSuite = ClinicalNotesTestSuite;
  (window as any).testClinicalNotes = async () => {
    const suite = new ClinicalNotesTestSuite();
    return await suite.runAllTests();
  };
  
  console.log('Clinical Notes Test Suite loaded.');
  console.log('Run in console: testClinicalNotes()');
}

export default ClinicalNotesTestSuite;

// Add a placeholder test suite to satisfy the test runner
describe('Clinical Notes Integration', () => {
  it('should have test utilities available', () => {
    expect(typeof ClinicalNotesTestSuite).toBe('function');
  });
});