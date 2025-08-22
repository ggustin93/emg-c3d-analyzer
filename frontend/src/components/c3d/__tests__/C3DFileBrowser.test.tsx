/**
 * Comprehensive tests for C3DFileBrowser component
 * 
 * CRITICAL: This component had ZERO test coverage despite 720 lines of complex error handling
 * Priority focus: Network errors ("Failed to fetch"), authentication issues, user recovery
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import C3DFileBrowser from '../C3DFileBrowser';

// Mock dependencies
vi.mock('@/services/supabaseStorage');
vi.mock('@/lib/supabaseSetup');
vi.mock('@/contexts/AuthContext');
vi.mock('@/services/therapySessionsService');
vi.mock('@/components/c3d/C3DFileUpload', () => {
  return {
    default: ({ onUploadComplete, onError }: any) => (
      <div data-testid="c3d-file-upload">
        <button onClick={() => onUploadComplete()}>Upload Complete</button>
        <button onClick={() => onError('Upload failed')}>Upload Error</button>
      </div>
    )
  };
});

// Import mocked modules
import SupabaseStorageService from '@/services/supabaseStorage';
import SupabaseSetup from '@/lib/supabaseSetup';
import { useAuth } from '@/contexts/AuthContext';
import { TherapySessionsService } from '@/services/therapySessionsService';

// Mock implementations
const mockSupabaseStorageService = SupabaseStorageService as any;
const mockSupabaseSetup = SupabaseSetup as any;
const mockUseAuth = useAuth as any;
const mockTherapySessionsService = TherapySessionsService as any;

// Mock console to avoid test noise
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

describe('C3DFileBrowser - Critical Error Handling Tests', () => {
  // Mock file select handler
  const mockOnFileSelect = vi.fn();

  // Sample files for testing
  const mockFiles = [
    {
      id: 'file-1',
      name: 'test-file-1.c3d',
      size: 1024000,
      created_at: '2023-08-01T10:00:00Z',
      updated_at: '2023-08-01T10:00:00Z',
      last_accessed_at: '2023-08-01T10:00:00Z',
      metadata: {}
    },
    {
      id: 'file-2', 
      name: 'test-file-2.c3d',
      size: 2048000,
      created_at: '2023-08-02T11:00:00Z',
      updated_at: '2023-08-02T11:00:00Z',
      last_accessed_at: '2023-08-02T11:00:00Z',
      metadata: {}
    }
  ];

  // Mock authenticated user
  const mockAuthenticatedUser = {
    id: 'user-123',
    email: 'test@example.com',
    user_metadata: {}
  };

  // Mock auth state - default to authenticated
  const mockAuthState = {
    user: mockAuthenticatedUser,
    loading: false
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Suppress console output during tests
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();

    // Default mock implementations
    mockUseAuth.mockReturnValue({
      authState: mockAuthState
    });

    mockSupabaseStorageService.isConfigured.mockReturnValue(true);
    mockSupabaseStorageService.listC3DFiles.mockResolvedValue(mockFiles);

    mockTherapySessionsService.getSessionsByFilePaths.mockResolvedValue({});

    mockSupabaseSetup.createBucket.mockResolvedValue({
      success: true,
      message: 'Bucket created successfully'
    });

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
      },
      writable: true
    });

    // Mock window.location.reload
    Object.defineProperty(window, 'location', {
      value: {
        reload: vi.fn()
      },
      writable: true
    });
  });

  afterEach(() => {
    // Restore console
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  describe('🔴 Network Errors - "Failed to fetch" Scenarios', () => {
    it('should handle "Failed to fetch" network error gracefully', async () => {
      // Simulate the exact "Failed to fetch" error user is experiencing
      mockSupabaseStorageService.listC3DFiles.mockRejectedValue(
        new Error('Failed to fetch')
      );

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      // Should show loading initially
      expect(screen.getByText('Loading C3D files...')).toBeInTheDocument();

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Error Loading Files')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Should show user-friendly error message for "Failed to fetch"
      expect(screen.getByText(/Failed to load C3D files: Failed to fetch/)).toBeInTheDocument();
      
      // Should show retry button
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      
      // Should show refresh page button
      expect(screen.getByRole('button', { name: /refresh page/i })).toBeInTheDocument();
    });

    it('should display specific error message for fetch timeout', async () => {
      mockSupabaseStorageService.listC3DFiles.mockRejectedValue(
        new Error('Request timeout')
      );

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Files')).toBeInTheDocument();
      });

      // Should show timeout-specific message
      expect(screen.getByText(/Connection timeout.*check your internet connection/)).toBeInTheDocument();
    });

    it('should display network error message for connection failures', async () => {
      mockSupabaseStorageService.listC3DFiles.mockRejectedValue(
        new Error('network error')
      );

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Files')).toBeInTheDocument();
      });

      // Should show network error handling
      expect(screen.getByText(/Failed to load C3D files: network error/)).toBeInTheDocument();
    });

    it('should implement retry logic with exponential backoff', async () => {
      let callCount = 0;
      mockSupabaseStorageService.listC3DFiles.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('Failed to fetch'));
        }
        return Promise.resolve(mockFiles);
      });

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      // Wait for retries to complete and success
      await waitFor(() => {
        expect(screen.queryByText('Error Loading Files')).not.toBeInTheDocument();
      }, { timeout: 10000 });

      // Should have retried 2 times, then succeeded
      expect(callCount).toBe(3);
      
      // Should eventually show files
      expect(screen.getByText('C3D File Library')).toBeInTheDocument();
    });

    it('should stop retrying after maximum attempts and show final error', async () => {
      // Always fail to test retry limit
      mockSupabaseStorageService.listC3DFiles.mockRejectedValue(
        new Error('Failed to fetch')
      );

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      // Wait for all retries to complete
      await waitFor(() => {
        expect(screen.getByText('Error Loading Files')).toBeInTheDocument();
      }, { timeout: 15000 });

      // Should show retry count in error message
      expect(screen.getByText(/Failed after.*attempts/)).toBeInTheDocument();
    });
  });

  describe('🔐 Authentication Error Scenarios', () => {
    it('should handle JWT expired error during file loading', async () => {
      mockSupabaseStorageService.listC3DFiles.mockRejectedValue(
        new Error('JWT expired')
      );

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Files')).toBeInTheDocument();
      });

      // Should show auth-specific error message
      expect(screen.getByText(/Authentication expired.*sign in again/)).toBeInTheDocument();
    });

    it('should handle invalid JWT error', async () => {
      mockSupabaseStorageService.listC3DFiles.mockRejectedValue(
        new Error('Invalid JWT')
      );

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Files')).toBeInTheDocument();
      });

      expect(screen.getByText(/Authentication expired/)).toBeInTheDocument();
    });

    it('should show sign-in prompt when user is not authenticated', async () => {
      // Mock unauthenticated state
      mockUseAuth.mockReturnValue({
        authState: { user: null, loading: false }
      });

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Files')).toBeInTheDocument();
      });

      // Should show authentication required message
      expect(screen.getByText(/Please sign in to access.*file library/)).toBeInTheDocument();
      
      // Should show warning about needing to sign in
      expect(screen.getByText(/You may need to sign in/)).toBeInTheDocument();
    });

    it('should wait for auth initialization before loading files', () => {
      // Mock auth still loading
      mockUseAuth.mockReturnValue({
        authState: { user: null, loading: true }
      });

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      // Should show loading state but not try to load files yet
      expect(screen.getByText('Loading C3D files...')).toBeInTheDocument();
      
      // Should not have called storage service yet
      expect(mockSupabaseStorageService.listC3DFiles).not.toHaveBeenCalled();
    });

    it('should retry with longer delay for auth errors', async () => {
      let callCount = 0;
      const startTime = Date.now();
      
      mockSupabaseStorageService.listC3DFiles.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Authentication required'));
        }
        return Promise.resolve(mockFiles);
      });

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        expect(screen.queryByText('Error Loading Files')).not.toBeInTheDocument();
      }, { timeout: 8000 });

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Auth errors should have longer delay (5000ms vs 2000ms for network errors)
      expect(duration).toBeGreaterThan(4000); // Allow some margin
      expect(callCount).toBe(2);
    });
  });

  describe('🏪 Supabase Storage Error Scenarios', () => {
    it('should handle bucket not found (404) error', async () => {
      mockSupabaseStorageService.listC3DFiles.mockRejectedValue(
        new Error('Bucket does not exist')
      );

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Files')).toBeInTheDocument();
      });

      // Should show bucket-specific error message
      expect(screen.getByText(/Storage bucket.*not found.*create this bucket/)).toBeInTheDocument();
      
      // Should show Setup Storage button
      expect(screen.getByRole('button', { name: /setup storage/i })).toBeInTheDocument();
    });

    it('should handle permission denied (403) error', async () => {
      mockSupabaseStorageService.listC3DFiles.mockRejectedValue(
        new Error('permission denied')
      );

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Files')).toBeInTheDocument();
      });

      // Should show permission-specific error message
      expect(screen.getByText(/Permission denied.*authentication status.*bucket policies/)).toBeInTheDocument();
    });

    it('should handle empty bucket scenario', async () => {
      mockSupabaseStorageService.listC3DFiles.mockResolvedValue([]);

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Files')).toBeInTheDocument();
      });

      // Should show empty bucket message
      expect(screen.getByText(/Storage bucket.*is empty.*upload C3D files/)).toBeInTheDocument();
      
      // Should still show Setup Storage button
      expect(screen.getByRole('button', { name: /setup storage/i })).toBeInTheDocument();
    });

    it('should handle Supabase not configured scenario', async () => {
      mockSupabaseStorageService.isConfigured.mockReturnValue(false);

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Files')).toBeInTheDocument();
      });

      // Should show configuration error message
      expect(screen.getByText(/Supabase not configured.*environment variables/)).toBeInTheDocument();
      
      // Should not try to load files
      expect(mockSupabaseStorageService.listC3DFiles).not.toHaveBeenCalled();
    });
  });

  describe('🔧 User Recovery Actions', () => {
    beforeEach(async () => {
      // Setup error scenario
      mockSupabaseStorageService.listC3DFiles.mockRejectedValue(
        new Error('Failed to fetch')
      );

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Files')).toBeInTheDocument();
      });
    });

    it('should allow manual retry after network failure', async () => {
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      // Setup successful retry
      mockSupabaseStorageService.listC3DFiles.mockResolvedValueOnce(mockFiles);

      fireEvent.click(retryButton);

      // Should show loading state
      expect(retryButton).toBeDisabled();
      expect(screen.getByText(/retrying/i)).toBeInTheDocument();

      // Should eventually show success
      await waitFor(() => {
        expect(screen.getByText('C3D File Library')).toBeInTheDocument();
      });
    });

    it('should handle retry failures gracefully', async () => {
      const retryButton = screen.getByRole('button', { name: /retry/i });
      
      // Retry should also fail
      mockSupabaseStorageService.listC3DFiles.mockRejectedValueOnce(
        new Error('Still failing')
      );

      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText(/Retry failed/)).toBeInTheDocument();
      });

      // Retry button should be re-enabled
      expect(retryButton).not.toBeDisabled();
    });

    it('should refresh page when refresh button is clicked', async () => {
      const refreshButton = screen.getByRole('button', { name: /refresh page/i });
      expect(refreshButton).toBeInTheDocument();

      fireEvent.click(refreshButton);

      // Should call window.location.reload
      expect(window.location.reload).toHaveBeenCalled();
    });

    it('should setup storage when setup button is clicked', async () => {
      // Create bucket not found scenario first
      mockSupabaseStorageService.listC3DFiles.mockRejectedValue(
        new Error('Bucket does not exist')
      );

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /setup storage/i })).toBeInTheDocument();
      });

      const setupButton = screen.getByRole('button', { name: /setup storage/i });
      
      fireEvent.click(setupButton);

      // Should show setting up state
      expect(screen.getByText(/setting up/i)).toBeInTheDocument();
      
      await waitFor(() => {
        expect(mockSupabaseSetup.createBucket).toHaveBeenCalled();
      });
    });

    it('should handle setup storage failures', async () => {
      mockSupabaseStorageService.listC3DFiles.mockRejectedValue(
        new Error('Bucket does not exist')
      );
      
      mockSupabaseSetup.createBucket.mockResolvedValue({
        success: false,
        message: 'Setup failed'
      });

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /setup storage/i })).toBeInTheDocument();
      });

      const setupButton = screen.getByRole('button', { name: /setup storage/i });
      fireEvent.click(setupButton);

      await waitFor(() => {
        expect(screen.getByText('Setup failed')).toBeInTheDocument();
      });
    });
  });

  describe('📊 Integration Tests', () => {
    it('should refresh file list after successful upload', async () => {
      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        expect(screen.getByText('C3D File Library')).toBeInTheDocument();
      });

      // Trigger upload complete
      const uploadCompleteButton = screen.getByText('Upload Complete');
      fireEvent.click(uploadCompleteButton);

      // Should call listC3DFiles again to refresh
      await waitFor(() => {
        expect(mockSupabaseStorageService.listC3DFiles).toHaveBeenCalledTimes(2);
      });
    });

    it('should display upload errors in browser', async () => {
      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        expect(screen.getByText('C3D File Library')).toBeInTheDocument();
      });

      // Trigger upload error
      const uploadErrorButton = screen.getByText('Upload Error');
      fireEvent.click(uploadErrorButton);

      // Should show upload error in the browser
      await waitFor(() => {
        expect(screen.getByText('Upload failed')).toBeInTheDocument();
      });
    });

    it('should react to auth state changes', async () => {
      const { rerender } = render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        expect(screen.getByText('C3D File Library')).toBeInTheDocument();
      });

      // Mock auth state change to unauthenticated
      mockUseAuth.mockReturnValue({
        authState: { user: null, loading: false }
      });

      rerender(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        expect(screen.getByText(/Please sign in to access.*file library/)).toBeInTheDocument();
      });
    });

    it('should handle session data loading failures gracefully', async () => {
      // Mock session service failure
      mockTherapySessionsService.getSessionsByFilePaths.mockRejectedValue(
        new Error('Session service unavailable')
      );

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      // Should still load files successfully despite session data failure
      await waitFor(() => {
        expect(screen.getByText('C3D File Library')).toBeInTheDocument();
      });

      // Should show files even without session data
      expect(screen.getByText(/Showing.*files/)).toBeInTheDocument();
    });
  });

  describe('⏱️ Performance & Timeout Tests', () => {
    it('should timeout gracefully after 15 seconds', async () => {
      // Mock a request that never resolves
      mockSupabaseStorageService.listC3DFiles.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      // Should show loading initially
      expect(screen.getByText('Loading C3D files...')).toBeInTheDocument();

      // Should timeout and show error after 15 seconds
      await waitFor(() => {
        expect(screen.getByText('Error Loading Files')).toBeInTheDocument();
      }, { timeout: 16000 });

      expect(screen.getByText(/Connection timeout/)).toBeInTheDocument();
    }, 20000);

    it('should not block UI during file loading', async () => {
      // Mock slow loading
      mockSupabaseStorageService.listC3DFiles.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockFiles), 1000))
      );

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      // UI should be responsive during loading
      expect(screen.getByText('Loading C3D files...')).toBeInTheDocument();
      
      // Should eventually load
      await waitFor(() => {
        expect(screen.getByText('C3D File Library')).toBeInTheDocument();
      });
    });

    it('should handle large file sets efficiently', async () => {
      // Create large file set
      const largeFileSet = Array.from({ length: 100 }, (_, i) => ({
        id: `file-${i}`,
        name: `test-file-${i}.c3d`,
        size: 1024000 + i,
        created_at: `2023-08-01T${String(i % 24).padStart(2, '0')}:00:00Z`,
        updated_at: `2023-08-01T${String(i % 24).padStart(2, '0')}:00:00Z`,
        last_accessed_at: `2023-08-01T${String(i % 24).padStart(2, '0')}:00:00Z`,
        metadata: {}
      }));

      mockSupabaseStorageService.listC3DFiles.mockResolvedValue(largeFileSet);

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        expect(screen.getByText('C3D File Library')).toBeInTheDocument();
      });

      // Should show pagination with large file set
      expect(screen.getByText(/Showing.*of 100 files/)).toBeInTheDocument();
      
      // Should handle filtering efficiently
      expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
    });
  });
});