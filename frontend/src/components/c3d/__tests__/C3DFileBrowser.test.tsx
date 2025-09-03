/**
 * Simplified C3DFileBrowser tests - focusing on core functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import C3DFileBrowser from '../C3DFileBrowser';

// Mock dependencies
vi.mock('@/services/supabaseStorage');
vi.mock('@/lib/supabaseSetup');
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    authState: { user: null, loading: false, error: null },
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    refreshSession: vi.fn(),
    resetPassword: vi.fn(),
    isAuthenticated: false,
    isLoading: false
  }))
}));
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
const mockUseAuth = vi.mocked(useAuth);
const mockTherapySessionsService = TherapySessionsService as any;

// Default mock auth state
const mockAuthState = {
  user: null,
  session: null,
  profile: null,
  loading: false,
  error: null
};

const mockAuthContext = {
  authState: mockAuthState,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  refreshSession: vi.fn(),
  resetPassword: vi.fn(),
  isAuthenticated: false,
  isLoading: false,
  userRole: 'RESEARCHER' as const,
  canViewFeature: vi.fn().mockReturnValue(true)
};

describe('C3DFileBrowser - Core Functionality Tests', () => {
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
    }
  ];

  const mockAuthenticatedUser = {
    id: 'user-123',
    email: 'test@example.com',
    user_metadata: {},
    app_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString()
  } as any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Suppress console output during tests
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();

    // Default mock implementations  
    mockUseAuth.mockReturnValue({
      ...mockAuthContext,
      authState: { 
        ...mockAuthState, 
        user: mockAuthenticatedUser, 
        loading: false 
      }
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
      value: { reload: vi.fn() },
      writable: true
    });
  });

  describe('✅ Success Cases', () => {
    it('should render successfully and display file library', async () => {
      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        const libraryElements = screen.getAllByText('C3D File Library');
        expect(libraryElements.length).toBeGreaterThan(0);
      });

      // Check for "Showing" text and "files" text separately since they're in different elements
      const showingElements = screen.getAllByText(/Showing/);
      expect(showingElements.length).toBeGreaterThan(0);
      
      const filesElements = screen.getAllByText(/files/);
      expect(filesElements.length).toBeGreaterThan(0);
    });

    it('should handle file upload completion', async () => {
      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        const libraryElements = screen.getAllByText('C3D File Library');
        expect(libraryElements.length).toBeGreaterThan(0);
      });

      const uploadCompleteButtons = screen.getAllByText('Upload Complete');
      fireEvent.click(uploadCompleteButtons[0]);

      // Should refresh the file list
      await waitFor(() => {
        expect(mockSupabaseStorageService.listC3DFiles).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('❌ Error Handling', () => {
    it('should show error message when file loading fails', async () => {
      mockSupabaseStorageService.listC3DFiles.mockRejectedValue(
        new Error('Failed to fetch')
      );

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        const errorElements = screen.getAllByText('Error Loading Files');
        expect(errorElements.length).toBeGreaterThan(0);
      });

      expect(screen.getByText(/Failed to load C3D files/)).toBeInTheDocument();
    });

    it('should show retry and refresh options when errors occur', async () => {
      mockSupabaseStorageService.listC3DFiles.mockRejectedValue(
        new Error('Network error')
      );

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        const errorElements = screen.getAllByText('Error Loading Files');
        expect(errorElements.length).toBeGreaterThan(0);
      });

      // Should provide recovery options (handle React.StrictMode multiple renders)
      const retryButtons = screen.getAllByRole('button', { name: /retry/i });
      const refreshButtons = screen.getAllByRole('button', { name: /refresh page/i });
      
      expect(retryButtons.length).toBeGreaterThan(0);
      expect(refreshButtons.length).toBeGreaterThan(0);
    });

    it('should handle empty bucket gracefully', async () => {
      mockSupabaseStorageService.listC3DFiles.mockResolvedValue([]);

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        const libraryHeaders = screen.getAllByText('C3D File Library');
        expect(libraryHeaders.length).toBeGreaterThan(0);
      });

      // Success state with no files - should show library with file count
      // Check for "Showing" text and "files" text separately since they're in different elements
      const showingElements = screen.getAllByText(/Showing/i);
      expect(showingElements.length).toBeGreaterThan(0);
      
      const filesElements = screen.getAllByText(/files/i);
      expect(filesElements.length).toBeGreaterThan(0);
    });

    it('should handle unauthenticated state', async () => {
      mockUseAuth.mockReturnValue({
        authState: { user: null, loading: false, session: null, profile: null, error: null },
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        refreshSession: vi.fn(),
        resetPassword: vi.fn(),
        isAuthenticated: false,
        isLoading: false,
        userRole: null,
        canViewFeature: vi.fn().mockReturnValue(false)
      });

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        const errorElements = screen.getAllByText('Error Loading Files');
        expect(errorElements.length).toBeGreaterThan(0);
      });

      expect(screen.getByText(/Please sign in to access.*file library/)).toBeInTheDocument();
    });
  });

  describe('🔧 Recovery Actions', () => {
    beforeEach(async () => {
      mockSupabaseStorageService.listC3DFiles.mockRejectedValue(
        new Error('Test error')
      );

      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        const errorElements = screen.getAllByText('Error Loading Files');
        expect(errorElements.length).toBeGreaterThan(0);
      });
    });

    it('should allow manual retry', async () => {
      const retryButtons = screen.getAllByRole('button', { name: /retry/i });
      const retryButton = retryButtons[0];

      // Setup successful retry
      mockSupabaseStorageService.listC3DFiles.mockResolvedValueOnce(mockFiles);

      fireEvent.click(retryButton);

      await waitFor(() => {
        const libraryElements = screen.getAllByText('C3D File Library');
        expect(libraryElements.length).toBeGreaterThan(0);
      });
    });

    it('should refresh page when refresh button clicked', () => {
      const refreshButtons = screen.getAllByRole('button', { name: /refresh page/i });
      const refreshButton = refreshButtons[0];

      fireEvent.click(refreshButton);

      expect(window.location.reload).toHaveBeenCalled();
    });
  });

  describe('🎯 Component Behavior', () => {
    it('should show loading state initially', () => {
      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      // Should show loading initially
      const loadingElements = screen.getAllByText('Loading C3D files...');
      expect(loadingElements.length).toBeGreaterThan(0);
    });

    it('should not crash when Supabase is not configured', async () => {
      mockSupabaseStorageService.isConfigured.mockReturnValue(false);

      const { container } = render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      expect(container).toBeInTheDocument();
      
      await waitFor(() => {
        const errorElements = screen.getAllByText('Error Loading Files');
        expect(errorElements.length).toBeGreaterThan(0);
      });
    });

    it('should handle upload errors gracefully', async () => {
      render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

      await waitFor(() => {
        const libraryElements = screen.getAllByText('C3D File Library');
        expect(libraryElements.length).toBeGreaterThan(0);
      });

      const uploadErrorButtons = screen.getAllByText('Upload Error');
      fireEvent.click(uploadErrorButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Upload failed')).toBeInTheDocument();
      });
    });
  });
});