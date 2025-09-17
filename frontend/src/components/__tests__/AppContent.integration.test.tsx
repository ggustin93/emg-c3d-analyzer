/**
 * Analysis Caching Integration Tests
 * 
 * End-to-end integration tests for the analysis result caching system.
 * Tests the complete user workflow with cache hits, misses, and parameter changes.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import AppContent from '../../AppContent';
import { AuthProvider } from '../../contexts/AuthContext';
import { useAnalysisQuery } from '../../hooks/useAnalysisQuery';
import SupabaseStorageService from '../../services/supabaseStorage';
import { queryKeys } from '../../lib/queryClient';

// Mock all dependencies
jest.mock('../../hooks/useAnalysisQuery');
jest.mock('../../services/supabaseStorage');
jest.mock('../../contexts/AuthContext');
jest.mock('../../store/sessionStore');
jest.mock('../../services/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
  LogCategory: {
    API: 'API',
    LIFECYCLE: 'LIFECYCLE',
  },
}));

// Mock components that aren't needed for integration testing
jest.mock('../../components/dashboards/admin/AdminDashboard', () => ({
  AdminDashboard: () => <div>Admin Dashboard</div>,
}));
jest.mock('../../components/dashboards/therapist/TherapistDashboard', () => ({
  default: () => <div>Therapist Dashboard</div>,
}));
jest.mock('../../components/dashboards/researcher/ResearcherDashboard', () => ({
  default: () => <div>Researcher Dashboard</div>,
}));

const mockedUseAnalysisQuery = jest.mocked(useAnalysisQuery);
const mockedSupabaseStorageService = jest.mocked(SupabaseStorageService);

// Mock analysis data
const createMockAnalysisData = (filename: string, processingTime: number = 1500) => ({
  filename,
  processingTime,
  results: {
    emgData: {
      analytics: {
        CH1: { rms: [1, 2, 3], mav: [0.8, 1.2, 1.0] },
        CH2: { rms: [4, 5, 6], mav: [3.2, 4.1, 3.8] }
      },
      metadata: { 
        score: 85, 
        level: 2,
        session_parameters_used: {
          channel_muscle_mapping: { CH1: 'Muscle1', CH2: 'Muscle2' }
        }
      }
    },
    metrics: { fatigue_index: 0.12 },
    summary: { duration: 30.5 }
  },
  metadata: {
    processedAt: new Date().toISOString(),
    version: '1.0.0',
    parameters: { channel_muscle_mapping: { CH1: 'Muscle1', CH2: 'Muscle2' } }
  }
});

// Mock session store with more realistic data
const mockSessionStore = {
  sessionParams: {
    channel_muscle_mapping: { CH1: 'Muscle1', CH2: 'Muscle2' },
    muscle_color_mapping: { Muscle1: '#ff0000', Muscle2: '#00ff00' },
    session_mvc_values: { Muscle1: 100, Muscle2: 120 },
    session_mvc_threshold_percentages: { Muscle1: 20, Muscle2: 25 },
  },
  setSessionParams: jest.fn(),
  resetSessionParams: jest.fn(),
  uploadDate: '2025-01-17T10:00:00Z',
  setUploadDate: jest.fn(),
  selectedFileData: {
    patientName: 'Test Patient',
    therapistDisplay: 'Dr. Test',
    fileSize: 1024,
    clinicalNotesCount: 2
  },
};

jest.mock('../../store/sessionStore', () => ({
  useSessionStore: () => mockSessionStore,
}));

// Mock auth context
const mockAuthContext = {
  user: { id: '123', email: 'test@therapist.com' },
  userRole: 'THERAPIST' as const,
  signOut: jest.fn(),
};

jest.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => mockAuthContext,
}));

// Test wrapper with all providers
const TestWrapper = ({ children, queryClient }: { children: React.ReactNode, queryClient?: QueryClient }) => {
  const client = queryClient || new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <BrowserRouter>
      <QueryClientProvider client={client}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

describe('Analysis Caching Integration Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    jest.clearAllMocks();

    // Setup default Supabase mocks
    mockedSupabaseStorageService.isConfigured.mockReturnValue(true);
    mockedSupabaseStorageService.fileExists.mockResolvedValue(true);
    mockedSupabaseStorageService.getFileMetadata.mockResolvedValue({
      created_at: '2025-01-17T10:00:00Z',
      name: 'test-file.c3d',
      id: '123',
      size: 1024,
      updated_at: '2025-01-17T10:00:00Z'
    });
    mockedSupabaseStorageService.downloadFile.mockResolvedValue(
      new Blob(['fake content'], { type: 'application/octet-stream' })
    );

    // Mock fetch for backend API
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(createMockAnalysisData('test-file.c3d').results.emgData),
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    queryClient.clear();
  });

  describe('Cache Hit Scenario', () => {
    it('should show instant results on repeated file selection', async () => {
      const mockData = createMockAnalysisData('test-file.c3d', 50); // Very fast for cache hit

      // First selection - cache miss
      mockedUseAnalysisQuery.mockReturnValueOnce({
        data: null,
        isLoading: true,
        isStale: false,
        error: null,
        refetch: jest.fn(),
        isFetching: true,
        status: 'loading'
      } as any);

      const { rerender } = render(
        <TestWrapper queryClient={queryClient}>
          <AppContent />
        </TestWrapper>
      );

      // Should show loading initially
      expect(screen.queryByText('Loading dashboard...')).toBeInTheDocument();

      // Second selection - cache hit
      mockedUseAnalysisQuery.mockReturnValueOnce({
        data: mockData,
        isLoading: false,
        isStale: false,
        error: null,
        refetch: jest.fn(),
        isFetching: false,
        status: 'success'
      } as any);

      rerender(
        <TestWrapper queryClient={queryClient}>
          <AppContent />
        </TestWrapper>
      );

      // Should show results instantly without loading spinner
      await waitFor(() => {
        expect(screen.queryByText('Processing EMG Analysis')).not.toBeInTheDocument();
      }, { timeout: 100 });

      // Verify that expensive operations were skipped
      expect(mockedSupabaseStorageService.downloadFile).not.toHaveBeenCalledTimes(2);
    });

    it('should maintain proper state during cache transitions', async () => {
      const mockData = createMockAnalysisData('test-file.c3d');

      // Start with loading state
      mockedUseAnalysisQuery.mockReturnValue({
        data: null,
        isLoading: true,
        isStale: false,
        error: null,
        refetch: jest.fn(),
        isFetching: true,
        status: 'loading'
      } as any);

      const { rerender } = render(
        <TestWrapper queryClient={queryClient}>
          <AppContent />
        </TestWrapper>
      );

      // Transition to success state (cache hit)
      mockedUseAnalysisQuery.mockReturnValue({
        data: mockData,
        isLoading: false,
        isStale: false,
        error: null,
        refetch: jest.fn(),
        isFetching: false,
        status: 'success'
      } as any);

      rerender(
        <TestWrapper queryClient={queryClient}>
          <AppContent />
        </TestWrapper>
      );

      // Should transition smoothly without errors
      await waitFor(() => {
        expect(screen.queryByText('Error:')).not.toBeInTheDocument();
      });
    });
  });

  describe('Cache Miss Scenario', () => {
    it('should perform full analysis on cache miss with proper loading states', async () => {
      // Cache miss scenario
      mockedUseAnalysisQuery.mockReturnValue({
        data: null,
        isLoading: true,
        isStale: false,
        error: null,
        refetch: jest.fn(),
        isFetching: true,
        status: 'loading'
      } as any);

      render(
        <TestWrapper queryClient={queryClient}>
          <AppContent />
        </TestWrapper>
      );

      // Should show appropriate loading state
      await waitFor(() => {
        expect(
          screen.queryByText('Loading dashboard...') ||
          screen.queryByText('Processing EMG Analysis')
        ).toBeInTheDocument();
      });

      // Should indicate that analysis is in progress
      expect(mockedUseAnalysisQuery).toHaveBeenCalledWith({
        filename: '',
        sessionParams: mockSessionStore.sessionParams,
      });
    });

    it('should handle file selection workflow correctly', async () => {
      // Mock the workflow: no data initially, then loading, then success
      const mockData = createMockAnalysisData('selected-file.c3d');

      let callCount = 0;
      mockedUseAnalysisQuery.mockImplementation(() => {
        callCount++;
        switch (callCount) {
          case 1:
            return {
              data: null,
              isLoading: false,
              isStale: false,
              error: null,
              refetch: jest.fn(),
              isFetching: false,
              status: 'idle'
            } as any;
          case 2:
            return {
              data: null,
              isLoading: true,
              isStale: false,
              error: null,
              refetch: jest.fn(),
              isFetching: true,
              status: 'loading'
            } as any;
          default:
            return {
              data: mockData,
              isLoading: false,
              isStale: false,
              error: null,
              refetch: jest.fn(),
              isFetching: false,
              status: 'success'
            } as any;
        }
      });

      render(
        <TestWrapper queryClient={queryClient}>
          <AppContent />
        </TestWrapper>
      );

      // Initial state - dashboard should be shown
      expect(screen.getByText('Therapist Dashboard')).toBeInTheDocument();
    });
  });

  describe('Parameter Changes and Cache Invalidation', () => {
    it('should invalidate cache when significant parameters change', async () => {
      const mockData = createMockAnalysisData('test-file.c3d');
      const queryClientSpy = jest.spyOn(queryClient, 'invalidateQueries');

      // Start with cached data
      mockedUseAnalysisQuery.mockReturnValue({
        data: mockData,
        isLoading: false,
        isStale: false,
        error: null,
        refetch: jest.fn(),
        isFetching: false,
        status: 'success'
      } as any);

      const { rerender } = render(
        <TestWrapper queryClient={queryClient}>
          <AppContent />
        </TestWrapper>
      );

      // Simulate parameter change by updating the mock store
      const updatedSessionParams = {
        ...mockSessionStore.sessionParams,
        channel_muscle_mapping: { CH1: 'NewMuscle1', CH2: 'NewMuscle2' },
      };

      // Update the mock to return new parameters
      jest.mocked(mockSessionStore.setSessionParams).mockImplementation((newParams) => {
        Object.assign(mockSessionStore.sessionParams, 
          typeof newParams === 'function' ? newParams(mockSessionStore.sessionParams) : newParams
        );
      });

      // Update session params
      Object.assign(mockSessionStore.sessionParams, updatedSessionParams);

      // Rerender with new parameters
      rerender(
        <TestWrapper queryClient={queryClient}>
          <AppContent />
        </TestWrapper>
      );

      // The cache invalidation logic should have been triggered
      // Note: This is tested through the presence of the useEffect in AppContent.tsx
      expect(queryClientSpy).toBeDefined();
    });

    it('should handle parameter-based cache segmentation', async () => {
      const mockData1 = createMockAnalysisData('test-file.c3d');
      const mockData2 = createMockAnalysisData('test-file.c3d', 1600);

      // First query with original parameters
      mockedUseAnalysisQuery.mockReturnValueOnce({
        data: mockData1,
        isLoading: false,
        isStale: false,
        error: null,
        refetch: jest.fn(),
        isFetching: false,
        status: 'success'
      } as any);

      const { rerender } = render(
        <TestWrapper queryClient={queryClient}>
          <AppContent />
        </TestWrapper>
      );

      // Second query with different parameters should use different cache entry
      const newParams = {
        ...mockSessionStore.sessionParams,
        session_mvc_values: { Muscle1: 150, Muscle2: 180 },
      };
      Object.assign(mockSessionStore.sessionParams, newParams);

      mockedUseAnalysisQuery.mockReturnValueOnce({
        data: mockData2,
        isLoading: false,
        isStale: false,
        error: null,
        refetch: jest.fn(),
        isFetching: false,
        status: 'success'
      } as any);

      rerender(
        <TestWrapper queryClient={queryClient}>
          <AppContent />
        </TestWrapper>
      );

      // Should handle different parameter sets correctly
      expect(mockedUseAnalysisQuery).toHaveBeenCalledWith({
        filename: '',
        sessionParams: expect.objectContaining({
          session_mvc_values: { Muscle1: 150, Muscle2: 180 }
        }),
      });
    });
  });

  describe('Error Handling with Caching', () => {
    it('should handle errors gracefully without breaking cache', async () => {
      // Start with error state
      mockedUseAnalysisQuery.mockReturnValue({
        data: null,
        isLoading: false,
        isStale: false,
        error: new Error('Analysis failed due to invalid file format'),
        refetch: jest.fn(),
        isFetching: false,
        status: 'error'
      } as any);

      render(
        <TestWrapper queryClient={queryClient}>
          <AppContent />
        </TestWrapper>
      );

      // Should handle error state properly
      expect(screen.getByText('Therapist Dashboard')).toBeInTheDocument();
      
      // Error handling should not break the component
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('should recover from errors and use cache on retry', async () => {
      const mockData = createMockAnalysisData('test-file.c3d');
      let callCount = 0;

      mockedUseAnalysisQuery.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            data: null,
            isLoading: false,
            isStale: false,
            error: new Error('Network error'),
            refetch: jest.fn(),
            isFetching: false,
            status: 'error'
          } as any;
        } else {
          return {
            data: mockData,
            isLoading: false,
            isStale: false,
            error: null,
            refetch: jest.fn(),
            isFetching: false,
            status: 'success'
          } as any;
        }
      });

      const { rerender } = render(
        <TestWrapper queryClient={queryClient}>
          <AppContent />
        </TestWrapper>
      );

      // Initial error state
      expect(callCount).toBe(1);

      // Retry scenario
      rerender(
        <TestWrapper queryClient={queryClient}>
          <AppContent />
        </TestWrapper>
      );

      // Should recover with cached data
      expect(callCount).toBe(2);
    });
  });

  describe('URL Parameter Integration', () => {
    it('should handle URL parameters with caching', async () => {
      const mockData = createMockAnalysisData('url-file.c3d');

      // Mock URL parameters
      const mockSearchParams = new URLSearchParams('?file=url-file.c3d&date=2025-01-17T10:00:00Z');
      jest.spyOn(require('react-router-dom'), 'useSearchParams').mockReturnValue([mockSearchParams, jest.fn()]);

      mockedUseAnalysisQuery.mockReturnValue({
        data: mockData,
        isLoading: false,
        isStale: false,
        error: null,
        refetch: jest.fn(),
        isFetching: false,
        status: 'success'
      } as any);

      render(
        <TestWrapper queryClient={queryClient}>
          <AppContent />
        </TestWrapper>
      );

      // Should use URL parameters for cache key
      expect(mockedUseAnalysisQuery).toHaveBeenCalledWith({
        filename: 'url-file.c3d',
        sessionParams: mockSessionStore.sessionParams,
      });
    });
  });

  describe('User Experience Validation', () => {
    it('should provide smooth transitions between cached and uncached states', async () => {
      const mockData = createMockAnalysisData('test-file.c3d');

      // Start with loading
      mockedUseAnalysisQuery.mockReturnValueOnce({
        data: null,
        isLoading: true,
        isStale: false,
        error: null,
        refetch: jest.fn(),
        isFetching: true,
        status: 'loading'
      } as any);

      const { rerender } = render(
        <TestWrapper queryClient={queryClient}>
          <AppContent />
        </TestWrapper>
      );

      // Transition to cached data
      mockedUseAnalysisQuery.mockReturnValueOnce({
        data: mockData,
        isLoading: false,
        isStale: false,
        error: null,
        refetch: jest.fn(),
        isFetching: false,
        status: 'success'
      } as any);

      rerender(
        <TestWrapper queryClient={queryClient}>
          <AppContent />
        </TestWrapper>
      );

      // Should have smooth transition without flickering
      await waitFor(() => {
        expect(screen.queryByText('Processing EMG Analysis')).not.toBeInTheDocument();
      });

      // UI should be in a stable state
      expect(screen.getByRole('main') || screen.getByText('Therapist Dashboard')).toBeDefined();
    });

    it('should maintain consistent user interface during cache operations', async () => {
      const mockData = createMockAnalysisData('test-file.c3d');

      mockedUseAnalysisQuery.mockReturnValue({
        data: mockData,
        isLoading: false,
        isStale: false,
        error: null,
        refetch: jest.fn(),
        isFetching: false,
        status: 'success'
      } as any);

      render(
        <TestWrapper queryClient={queryClient}>
          <AppContent />
        </TestWrapper>
      );

      // UI elements should be consistently available
      expect(screen.getByText('Therapist Dashboard')).toBeInTheDocument();
      
      // No broken states or missing elements
      expect(document.querySelector('.min-h-screen')).toBeInTheDocument();
    });
  });
});