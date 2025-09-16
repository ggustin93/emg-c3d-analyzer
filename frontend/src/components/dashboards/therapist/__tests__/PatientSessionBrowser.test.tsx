import React from 'react';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import PatientSessionBrowser from '../PatientSessionBrowser';

// Mock dependencies
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    session: { access_token: 'test-token' },
    userProfile: null,
    loading: false,
    userRole: 'THERAPIST'
  }))
}));

vi.mock('@/services/supabaseStorage', () => ({
  default: {
    listC3DFiles: vi.fn()
  }
}));

vi.mock('@/services/therapySessionsService', () => ({
  TherapySessionsService: {
    getSessionsByFilePaths: vi.fn()
  }
}));

vi.mock('@/services/C3DFileDataResolver', () => ({
  resolvePatientId: vi.fn((file) => {
    // Extract patient code from filename (e.g., "PAT001_session1.c3d" -> "PAT001")
    const match = file.name.match(/^([A-Z]{3}\d{3})/);
    return match ? match[1] : null;
  }),
  resolveSessionDateTime: vi.fn((file) => file.created_at),
  formatSessionDateTime: vi.fn((date) => new Date(date).toLocaleDateString()),
  isShortSession: vi.fn((bytes) => bytes < 50000),
  formatFileSize: vi.fn((bytes) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }),
  resolveTherapistId: vi.fn((file) => 'THR001'),
  resolveSessionDate: vi.fn((file) => file.created_at),
  formatFullDate: vi.fn((date) => {
    if (!date) return 'Unknown';
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  }),
  C3DFile: {} // Type export mock
}));

vi.mock('@/hooks/useSimpleNotesCount', () => ({
  default: vi.fn(() => ({
    notesCount: {},
    loading: false,
    refreshNotes: vi.fn()
  }))
}));

// Mock the logger to prevent issues
vi.mock('@/services/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  },
  LogCategory: {}
}));

// Import mocked modules
import SupabaseStorageService from '@/services/supabaseStorage';
import { TherapySessionsService } from '@/services/therapySessionsService';

describe('PatientSessionBrowser', () => {
  const mockPatientCode = 'PAT001';
  const mockOnFileSelect = vi.fn();
  
  // Setup console mocks to reduce noise
  const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

  const mockFiles = [
    {
      id: 'file-1',
      name: 'PAT001_session1.c3d',
      size: 1024000,
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:00:00Z',
      last_accessed_at: '2024-01-01T10:00:00Z',
      metadata: {}
    },
    {
      id: 'file-2',
      name: 'PAT001_session2.c3d',
      size: 2048000,
      created_at: '2024-01-02T10:00:00Z',
      updated_at: '2024-01-02T10:00:00Z',
      last_accessed_at: '2024-01-02T10:00:00Z',
      metadata: {}
    },
    {
      id: 'file-3',
      name: 'PAT002_session1.c3d', // Different patient
      size: 1536000,
      created_at: '2024-01-03T10:00:00Z',
      updated_at: '2024-01-03T10:00:00Z',
      last_accessed_at: '2024-01-03T10:00:00Z',
      metadata: {}
    }
  ];

  const mockSessionData = {
    'c3d-examples/PAT001_session1.c3d': {
      id: 'session-1',
      file_path: 'c3d-examples/PAT001_session1.c3d',
      processing_status: 'completed',
      overall_performance_score: 85,
      session_date: '2024-01-01T10:00:00Z',
      game_metadata: {}
    },
    'c3d-examples/PAT001_session2.c3d': {
      id: 'session-2',
      file_path: 'c3d-examples/PAT001_session2.c3d',
      processing_status: 'completed',
      overall_performance_score: 90,
      session_date: '2024-01-02T10:00:00Z',
      game_metadata: {}
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleError.mockClear();
    mockConsoleWarn.mockClear();
    mockConsoleLog.mockClear();
    
    // Setup default mock implementations
    (SupabaseStorageService.listC3DFiles as any).mockResolvedValue(mockFiles);
    (TherapySessionsService.getSessionsByFilePaths as any).mockResolvedValue(mockSessionData);
    
    // Reset any window reload mock
    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn() },
      writable: true
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('should render and filter files by patient code', async () => {
    const { container } = render(
      <BrowserRouter>
        <PatientSessionBrowser 
          patientCode={mockPatientCode}
          onFileSelect={mockOnFileSelect}
        />
      </BrowserRouter>
    );

    // Wait for loading to complete with proper act wrapper
    await act(async () => {
      await waitFor(() => {
        expect(screen.queryByText('Loading session history...')).not.toBeInTheDocument();
      }, { timeout: 5000 });
    });

    // Check that session history header is displayed
    expect(screen.getByText('Session History')).toBeInTheDocument();

    // Verify that only files for PAT001 are shown (2 sessions)
    expect(screen.getByText(/2 sessions recorded for patient PAT001/)).toBeInTheDocument();
  });

  it('should display session statistics', async () => {
    const { container } = render(
      <BrowserRouter>
        <PatientSessionBrowser 
          patientCode={mockPatientCode}
          onFileSelect={mockOnFileSelect}
        />
      </BrowserRouter>
    );

    await act(async () => {
      await waitFor(() => {
        expect(screen.queryByText('Loading session history...')).not.toBeInTheDocument();
      }, { timeout: 5000 });
    });

    // Check for processed sessions count - use container query to be more specific
    const statisticsSection = container.querySelector('.flex.items-center.gap-3.text-sm');
    expect(statisticsSection).toBeTruthy();
    expect(statisticsSection?.textContent).toContain('2processed');
  });

  it('should show loading state initially', () => {
    render(
      <BrowserRouter>
        <PatientSessionBrowser 
          patientCode={mockPatientCode}
          onFileSelect={mockOnFileSelect}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Loading session history...')).toBeInTheDocument();
  });

  it('should handle error state gracefully', async () => {
    (SupabaseStorageService.listC3DFiles as any).mockRejectedValue(
      new Error('Failed to load files')
    );

    render(
      <BrowserRouter>
        <PatientSessionBrowser 
          patientCode={mockPatientCode}
          onFileSelect={mockOnFileSelect}
        />
      </BrowserRouter>
    );

    // Wait for error state with proper act wrapper
    await act(async () => {
      await waitFor(() => {
        expect(screen.getByText('Error Loading Sessions')).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    expect(screen.getByText(/Failed to load session files/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('should handle empty state when no sessions found', async () => {
    (SupabaseStorageService.listC3DFiles as any).mockResolvedValue([
      {
        id: 'file-1',
        name: 'PAT002_session1.c3d', // Different patient
        size: 1536000,
        created_at: '2024-01-03T10:00:00Z',
        updated_at: '2024-01-03T10:00:00Z',
        last_accessed_at: '2024-01-03T10:00:00Z',
        metadata: {}
      }
    ]);

    (TherapySessionsService.getSessionsByFilePaths as any).mockResolvedValue({});

    render(
      <BrowserRouter>
        <PatientSessionBrowser 
          patientCode={mockPatientCode}
          onFileSelect={mockOnFileSelect}
        />
      </BrowserRouter>
    );

    await act(async () => {
      await waitFor(() => {
        expect(screen.queryByText('Loading session history...')).not.toBeInTheDocument();
      }, { timeout: 5000 });
    });

    // Check for the main heading specifically
    expect(screen.getByRole('heading', { name: 'No Sessions Found' })).toBeInTheDocument();
    expect(screen.getByText(/No C3D files have been uploaded for patient PAT001/)).toBeInTheDocument();
    
    // Check for badges in the empty state
    expect(screen.getByText('0 Sessions')).toBeInTheDocument();
    expect(screen.getByText('No Data')).toBeInTheDocument();
  });

  it('should not display unauthenticated user error', async () => {
    const { useAuth } = await import('@/contexts/AuthContext');
    (useAuth as any).mockReturnValue({
      user: null,
      session: null,
      userProfile: null,
      loading: false,
      userRole: null
    });

    render(
      <BrowserRouter>
        <PatientSessionBrowser 
          patientCode={mockPatientCode}
          onFileSelect={mockOnFileSelect}
        />
      </BrowserRouter>
    );

    await act(async () => {
      await waitFor(() => {
        expect(screen.getByText('Error Loading Sessions')).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    expect(screen.getByText('Please sign in to view session history')).toBeInTheDocument();
  });

  it('should correctly filter multiple patients', async () => {
    // Ensure auth context is properly set for this test
    const { useAuth } = await import('@/contexts/AuthContext');
    (useAuth as any).mockReturnValue({
      user: { id: 'test-user-id', email: 'test@example.com' },
      session: { access_token: 'test-token' },
      userProfile: null,
      loading: false,
      userRole: 'THERAPIST'
    });

    const mixedFiles = [
      ...mockFiles,
      {
        id: 'file-4',
        name: 'PAT001_session3.c3d',
        size: 1024000,
        created_at: '2024-01-04T10:00:00Z',
        updated_at: '2024-01-04T10:00:00Z',
        last_accessed_at: '2024-01-04T10:00:00Z',
        metadata: {}
      },
      {
        id: 'file-5',
        name: 'PAT003_session1.c3d',
        size: 2048000,
        created_at: '2024-01-05T10:00:00Z',
        updated_at: '2024-01-05T10:00:00Z',
        last_accessed_at: '2024-01-05T10:00:00Z',
        metadata: {}
      }
    ];

    // Mock session data for the new PAT001 session
    const extendedSessionData = {
      ...mockSessionData,
      'c3d-examples/PAT001_session3.c3d': {
        id: 'session-3',
        file_path: 'c3d-examples/PAT001_session3.c3d',
        processing_status: 'completed',
        overall_performance_score: 95,
        session_date: '2024-01-04T10:00:00Z',
        game_metadata: {}
      }
    };

    (SupabaseStorageService.listC3DFiles as any).mockResolvedValue(mixedFiles);
    (TherapySessionsService.getSessionsByFilePaths as any).mockResolvedValue(extendedSessionData);

    render(
      <BrowserRouter>
        <PatientSessionBrowser 
          patientCode={mockPatientCode}
          onFileSelect={mockOnFileSelect}
        />
      </BrowserRouter>
    );

    await act(async () => {
      await waitFor(() => {
        expect(screen.queryByText('Loading session history...')).not.toBeInTheDocument();
      }, { timeout: 5000 });
    });

    // Should show 3 sessions for PAT001 (session1, session2, session3)
    expect(screen.getByText(/3 sessions recorded for patient PAT001/)).toBeInTheDocument();
  });
});