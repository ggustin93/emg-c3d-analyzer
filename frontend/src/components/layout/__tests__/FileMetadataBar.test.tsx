import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FileMetadataBar from '../FileMetadataBar';
import { EMGAnalysisResult } from '../../../types/emg';

// Mock the entire resolver module to isolate the component
vi.mock('../../../services/C3DFileDataResolver', () => ({
  resolvePatientId: vi.fn(),
  resolveSessionDate: vi.fn(),
  resolveTherapistId: vi.fn(),
  getPatientIdBadgeProps: vi.fn(() => ({ variant: 'secondary', className: 'test-patient-class' })),
  getTherapistIdBadgeProps: vi.fn(() => ({ variant: 'outline', className: 'test-therapist-class' })),
}));

// Helper to create a minimalist mock analysis result
const createMockAnalysisResult = (overrides: Partial<EMGAnalysisResult> = {}): EMGAnalysisResult => ({
  file_id: 'test-file-id',
  source_filename: 'P008_TestFile_20230321.c3d',
  timestamp: new Date().toISOString(),
  metadata: {
    therapist_id: 'Dr. Test',
    player_name: 'P008',
    session_date: '2023-03-21T12:00:00.000Z',
    game_title: '',
    game_type: '',
    game_version: '',
    session_duration: 0,
    session_notes: null
  },
  analytics: {},
  available_channels: [],
  emg_signals: {},
  ...overrides,
});

describe('FileMetadataBar', () => {
  // To use the mocked module, we need to import it after the mock setup
  let resolvePatientId: any;
  let resolveSessionDate: any;
  let resolveTherapistId: any;

  beforeEach(async () => {
    const resolvers = await import('../../../services/C3DFileDataResolver');
    resolvePatientId = resolvers.resolvePatientId;
    resolveSessionDate = resolvers.resolveSessionDate;
    resolveTherapistId = resolvers.resolveTherapistId;
    vi.clearAllMocks();
  });

  it('should display the therapist ID when provided by the resolver', () => {
    const mockAnalysisResult = createMockAnalysisResult();
    resolveTherapistId.mockReturnValue('Dr. Alice');
    resolvePatientId.mockReturnValue('P008');
    resolveSessionDate.mockReturnValue('2023-03-21');

    render(<FileMetadataBar analysisResult={mockAnalysisResult} />);

    expect(screen.getByText('Therapist:')).toBeInTheDocument();
    expect(screen.getByText('Dr. Alice')).toBeInTheDocument();
  });

  it('should not display the therapist section when the ID is "Unknown"', () => {
    const mockAnalysisResult = createMockAnalysisResult();
    resolveTherapistId.mockReturnValue('Unknown');
    resolvePatientId.mockReturnValue('P008');
    resolveSessionDate.mockReturnValue('2023-03-21');

    render(<FileMetadataBar analysisResult={mockAnalysisResult} />);

    // The component logic hides the therapist section if the ID is "Unknown"
    expect(screen.queryByText('Therapist:')).not.toBeInTheDocument();
  });

  it('should render patient, session, and filename correctly', () => {
    const mockAnalysisResult = createMockAnalysisResult();
    resolveTherapistId.mockReturnValue('Dr. Alice');
    resolvePatientId.mockReturnValue('P008');
    resolveSessionDate.mockReturnValue('2023-03-21'); // YYYY-MM-DD

    render(<FileMetadataBar analysisResult={mockAnalysisResult} />);

    // Check for filename
    expect(screen.getByText('P008_TestFile_20230321.c3d')).toBeInTheDocument();

    // Check for patient
    expect(screen.getByText('Patient:')).toBeInTheDocument();
    expect(screen.getByText('P008')).toBeInTheDocument();

    // Check for session date (component formats it to DD/MM/YY)
    expect(screen.getByText('Session:')).toBeInTheDocument();
    expect(screen.getByText('21/03/23')).toBeInTheDocument();
  });
});
