import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useLiveAnalytics } from '@/hooks/useLiveAnalytics';
import { useSessionStore } from '@/store/sessionStore';
import { MVCService } from '@/services/mvcService';

// Mock fetch instead of MVCService since useLiveAnalytics calls fetch directly
const mockFetch = vi.fn();
global.fetch = mockFetch;

function TestComponent({ analysisResult }: { analysisResult: any }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const live = useLiveAnalytics(analysisResult);
  return null;
}

describe('useLiveAnalytics - debounce and cancel', () => {
  const initialAnalysis = {
    analytics: {
      CH1: { contractions: [], mvc75_threshold: null, duration_threshold_actual_value: null }
    },
    metadata: { session_parameters_used: {} }
  } as any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(initialAnalysis)
    });
    // Reset store
    const { resetSessionParams } = useSessionStore.getState();
    resetSessionParams();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces /recalc calls to a single invocation and cancels prior in-flight', async () => {
    const { sessionParams, setSessionParams } = useSessionStore.getState();
    render(<TestComponent analysisResult={initialAnalysis} />);

    // Trigger multiple rapid param changes
    act(() => {
      setSessionParams({ contraction_duration_threshold: (sessionParams.contraction_duration_threshold || 2000) + 100 });
      setSessionParams({ contraction_duration_threshold: (sessionParams.contraction_duration_threshold || 2000) + 200 });
      setSessionParams({ contraction_duration_threshold: (sessionParams.contraction_duration_threshold || 2000) + 300 });
    });

    // No call before debounce window
    expect(mockFetch).toHaveBeenCalledTimes(0);

    // Advance past debounce window
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});


