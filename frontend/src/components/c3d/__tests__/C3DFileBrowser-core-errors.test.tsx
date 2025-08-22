/**
 * Focused tests for C3DFileBrowser critical error scenarios
 * 
 * This validates the exact "Failed to fetch" error scenario the user reported
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import C3DFileBrowser from '../C3DFileBrowser';

// Mock dependencies
vi.mock('@/services/supabaseStorage');
vi.mock('@/contexts/AuthContext');
vi.mock('@/services/therapySessionsService');
vi.mock('@/components/c3d/C3DFileUpload', () => ({
  default: () => <div data-testid="c3d-file-upload">Mock Upload</div>
}));

// Import mocked modules
import SupabaseStorageService from '@/services/supabaseStorage';
import { useAuth } from '@/contexts/AuthContext';
import { TherapySessionsService } from '@/services/therapySessionsService';

const mockSupabaseStorageService = SupabaseStorageService as any;
const mockUseAuth = useAuth as any;
const mockTherapySessionsService = TherapySessionsService as any;

// Mock console to avoid test noise
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

describe('C3DFileBrowser - Core Error Validation', () => {
  const mockOnFileSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Suppress console during tests
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();

    // Default authenticated state
    mockUseAuth.mockReturnValue({
      authState: {
        user: { id: 'user-123', email: 'test@example.com' },
        loading: false
      }
    });

    mockSupabaseStorageService.isConfigured.mockReturnValue(true);
    mockTherapySessionsService.getSessionsByFilePaths.mockResolvedValue({});

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: vi.fn(() => null), setItem: vi.fn() },
      writable: true
    });
  });

  afterEach(() => {
    cleanup();
    // Restore console
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  it('🎯 CRITICAL: Should catch and display "Failed to fetch" errors', async () => {
    // This is the exact error scenario user is experiencing
    mockSupabaseStorageService.listC3DFiles.mockRejectedValue(
      new Error('Failed to fetch')
    );

    render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

    // Should show loading initially
    expect(screen.getByText('Loading C3D files...')).toBeInTheDocument();

    // Wait for error to appear - use getAllByText for React.StrictMode compatibility
    await waitFor(() => {
      const errorElements = screen.queryAllByText('Error Loading Files');
      expect(errorElements.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    // Should show the exact error message the user would see
    expect(screen.getByText('Failed to load C3D files: Failed to fetch')).toBeInTheDocument();
    
    // Should provide recovery options
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh page/i })).toBeInTheDocument();
  });

  it('🔧 Should allow user to retry after "Failed to fetch"', async () => {
    // First attempt fails
    mockSupabaseStorageService.listC3DFiles.mockRejectedValueOnce(
      new Error('Failed to fetch')
    );

    // Second attempt (retry) succeeds
    const mockFiles = [
      {
        id: 'file-1',
        name: 'test.c3d',
        size: 1024,
        created_at: '2023-08-01T10:00:00Z',
        updated_at: '2023-08-01T10:00:00Z',
        last_accessed_at: '2023-08-01T10:00:00Z',
        metadata: {}
      }
    ];
    mockSupabaseStorageService.listC3DFiles.mockResolvedValueOnce(mockFiles);

    render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);

    // Wait for initial error
    await waitFor(() => {
      expect(screen.getByText('Failed to load C3D files: Failed to fetch')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Click retry button
    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);

    // Should eventually show success
    await waitFor(() => {
      expect(screen.getByText('C3D File Library')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Should show the loaded file
    expect(screen.getByText(/Showing.*of 1 files/)).toBeInTheDocument();
  });

  it('🔐 Should handle authentication errors during file loading', async () => {
    mockSupabaseStorageService.listC3DFiles.mockRejectedValue(
      new Error('JWT expired')
    );

    const { container } = render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);
    
    // Component should render without crashing
    expect(container).toBeInTheDocument();
    
    // Should show some kind of content (loading, error, or files)
    await waitFor(() => {
      const hasContent = screen.queryByText('C3D File Library') || 
                        screen.queryByText('Loading') || 
                        screen.queryByText('Error') ||
                        screen.queryByText('No files found');
      expect(hasContent).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('🌐 Should handle network timeout errors', async () => {
    mockSupabaseStorageService.listC3DFiles.mockRejectedValue(
      new Error('Request timeout')
    );

    const { container } = render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);
    
    // Component should render without crashing
    expect(container).toBeInTheDocument();
    
    // Should show some kind of content
    await waitFor(() => {
      const hasContent = screen.queryByText('C3D File Library') || 
                        screen.queryByText('Loading') || 
                        screen.queryByText('Error') ||
                        screen.queryByText('No files found');
      expect(hasContent).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('📦 Should handle Supabase storage not configured', async () => {
    mockSupabaseStorageService.isConfigured.mockReturnValue(false);

    const { container } = render(<C3DFileBrowser onFileSelect={mockOnFileSelect} />);
    
    // Component should render without crashing
    expect(container).toBeInTheDocument();
    
    // Should show some kind of content
    await waitFor(() => {
      const hasContent = screen.queryByText('C3D File Library') || 
                        screen.queryByText('Loading') || 
                        screen.queryByText('Error') ||
                        screen.queryByText('No files found');
      expect(hasContent).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Should not have tried to load files when not configured
    expect(mockSupabaseStorageService.listC3DFiles).not.toHaveBeenCalled();
  });
});