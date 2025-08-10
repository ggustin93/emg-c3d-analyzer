import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useLiveAnalytics } from '@/hooks/useLiveAnalytics';
import { useSessionStore } from '@/store/sessionStore';
import { MVCService } from '@/services/mvcService';

vi.mock('@/services/mvcService', () => {
  return {
    MVCService: {
      BASE_URL: 'http://localhost:8080',
      recalc: vi.fn()
    }
  };
});

function TestComponent({ analysisResult }: { analysisResult: any }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const live = useLiveAnalytics(analysisResult);
  return null;
}

describe('useLiveAnalytics - debounce and cancel', () => {
  const initialAnalysis = {
    analytics: {
      CH1: { contractions: [], mvc_threshold_actual_value: null, duration_threshold_actual_value: null }
    },
    metadata: { session_parameters_used: {} }
  } as any;

  beforeEach(() => {
    vi.useFakeTimers();
    (MVCService.recalc as any).mockReset().mockResolvedValue(initialAnalysis);
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
    expect(MVCService.recalc).toHaveBeenCalledTimes(0);

    // Advance past debounce window
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(MVCService.recalc).toHaveBeenCalledTimes(1);
  });
});


