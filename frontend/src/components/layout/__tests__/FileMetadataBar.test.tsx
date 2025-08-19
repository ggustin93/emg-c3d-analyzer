import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    // Clear all mocks first
    vi.clearAllMocks();
    
    // Import the mocked module
    const resolvers = await import('../../../services/C3DFileDataResolver');
    resolvePatientId = resolvers.resolvePatientId;
    resolveSessionDate = resolvers.resolveSessionDate;
    resolveTherapistId = resolvers.resolveTherapistId;
  });

  it('should not display the therapist section when the ID is "Unknown"', () => {
    const mockAnalysisResult = createMockAnalysisResult();
    
    // Ensure all mocks are reset and set properly
    vi.clearAllMocks();
    resolveTherapistId.mockReturnValue('Unknown');
    resolvePatientId.mockReturnValue('P008');
    resolveSessionDate.mockReturnValue('2023-03-21');

    render(<FileMetadataBar analysisResult={mockAnalysisResult} />);

    // The component logic hides the therapist section if the ID is "Unknown"
    // Use queryByTestId to avoid React.StrictMode multiple render issue
    expect(screen.queryByTestId('therapist-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('therapist-label')).not.toBeInTheDocument();
  });

  it('should display the therapist ID when provided by the resolver', () => {
    const mockAnalysisResult = createMockAnalysisResult();
    
    // Clear mocks and set up fresh ones
    vi.clearAllMocks();
    resolveTherapistId.mockReturnValue('Dr. Alice');
    resolvePatientId.mockReturnValue('P008');
    resolveSessionDate.mockReturnValue('2023-03-21');

    render(<FileMetadataBar analysisResult={mockAnalysisResult} />);

    expect(screen.getByText('Therapist:')).toBeInTheDocument();
    expect(screen.getByText('Dr. Alice')).toBeInTheDocument();
  });

  it('should render patient, session, and filename correctly', () => {
    const mockAnalysisResult = createMockAnalysisResult();
    
    // Clear mocks and set up fresh ones
    vi.clearAllMocks();
    resolveTherapistId.mockReturnValue('Dr. Alice');
    resolvePatientId.mockReturnValue('P008');
    resolveSessionDate.mockReturnValue('2023-03-21'); // YYYY-MM-DD

    render(<FileMetadataBar analysisResult={mockAnalysisResult} />);

    // Check for filename using testId (handle multiple renders with getAllBy)
    const filenameElements = screen.getAllByTestId('filename');
    expect(filenameElements.length).toBeGreaterThanOrEqual(1);
    expect(filenameElements[0]).toHaveTextContent('P008_TestFile_20230321.c3d');

    // Check for patient (use getAllBy since React.StrictMode renders multiple times)
    const patientLabels = screen.getAllByText('Patient:');
    expect(patientLabels.length).toBeGreaterThanOrEqual(1);
    expect(patientLabels[0]).toBeInTheDocument();

    const p008Elements = screen.getAllByText('P008');
    expect(p008Elements.length).toBeGreaterThanOrEqual(1);
    expect(p008Elements[0]).toBeInTheDocument();

    // Check for session date (component formats it to DD/MM/YY)
    const sessionLabels = screen.getAllByText('Session:');
    expect(sessionLabels.length).toBeGreaterThanOrEqual(1);
    expect(sessionLabels[0]).toBeInTheDocument();

    const dateElements = screen.getAllByText('21/03/23');
    expect(dateElements.length).toBeGreaterThanOrEqual(1);
    expect(dateElements[0]).toBeInTheDocument();
  });
});
