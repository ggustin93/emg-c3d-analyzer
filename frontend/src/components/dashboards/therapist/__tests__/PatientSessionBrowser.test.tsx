import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
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

// Import mocked modules
import SupabaseStorageService from '@/services/supabaseStorage';
import { TherapySessionsService } from '@/services/therapySessionsService';

describe('PatientSessionBrowser', () => {
  const mockPatientCode = 'PAT001';
  const mockOnFileSelect = vi.fn();

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
    
    // Setup default mock implementations
    (SupabaseStorageService.listC3DFiles as any).mockResolvedValue(mockFiles);
    (TherapySessionsService.getSessionsByFilePaths as any).mockResolvedValue(mockSessionData);
  });

  it('should render and filter files by patient code', async () => {
    render(
      <BrowserRouter>
        <PatientSessionBrowser 
          patientCode={mockPatientCode}
          onFileSelect={mockOnFileSelect}
        />
      </BrowserRouter>
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading session history...')).not.toBeInTheDocument();
    });

    // Check that session history header is displayed
    expect(screen.getByText('Session History')).toBeInTheDocument();

    // Verify that only files for PAT001 are shown (2 sessions)
    expect(screen.getByText(/2 sessions recorded for patient PAT001/)).toBeInTheDocument();
  });

  it('should display session statistics', async () => {
    render(
      <BrowserRouter>
        <PatientSessionBrowser 
          patientCode={mockPatientCode}
          onFileSelect={mockOnFileSelect}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading session history...')).not.toBeInTheDocument();
    });

    // Check for processed sessions count
    expect(screen.getByText('2')).toBeInTheDocument(); // 2 processed sessions
    expect(screen.getByText('processed')).toBeInTheDocument();

    // Check for average performance score
    expect(screen.getByText('88%')).toBeInTheDocument(); // Average of 85% and 90%
    expect(screen.getByText('avg score')).toBeInTheDocument();
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

    await waitFor(() => {
      expect(screen.getByText('Error Loading Sessions')).toBeInTheDocument();
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

    render(
      <BrowserRouter>
        <PatientSessionBrowser 
          patientCode={mockPatientCode}
          onFileSelect={mockOnFileSelect}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading session history...')).not.toBeInTheDocument();
    }, { timeout: 3000 });

    expect(screen.getByText('No Sessions Found')).toBeInTheDocument();
    expect(screen.getByText(/No C3D files have been uploaded for patient PAT001/)).toBeInTheDocument();
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

    await waitFor(() => {
      expect(screen.getByText('Error Loading Sessions')).toBeInTheDocument();
    });

    expect(screen.getByText('Please sign in to view session history')).toBeInTheDocument();
  });

  it('should correctly filter multiple patients', async () => {
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

    (SupabaseStorageService.listC3DFiles as any).mockResolvedValue(mixedFiles);

    render(
      <BrowserRouter>
        <PatientSessionBrowser 
          patientCode={mockPatientCode}
          onFileSelect={mockOnFileSelect}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading session history...')).not.toBeInTheDocument();
    });

    // Should show 3 sessions for PAT001 (session1, session2, session3)
    expect(screen.getByText(/3 sessions recorded for patient PAT001/)).toBeInTheDocument();
  });
});