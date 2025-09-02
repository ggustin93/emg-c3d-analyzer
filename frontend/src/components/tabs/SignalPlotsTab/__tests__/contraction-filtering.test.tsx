import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { useContractionAnalysis } from '@/hooks/useContractionAnalysis';

function HookHarness({
  analytics,
  sessionParams,
  finalDisplayDataKeys
}: any) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const result = useContractionAnalysis({
    analytics,
    sessionParams,
    finalDisplayDataKeys,
    chartData: [],
    showGoodContractions: true,
    showPoorContractions: true
  });
  return <div data-testid="dur-used">{result.qualitySummary.durationThresholdUsed}</div>;
}

describe('useContractionAnalysis - duration threshold priority', () => {
  const fakeAnalytics = {
    CH1: {
      contractions: [
        { duration_ms: 1800, max_amplitude: 0.001 },
        { duration_ms: 2200, max_amplitude: 0.001 }
      ],
      mvc75_threshold: 0.0005,
      duration_threshold_actual_value: 2500
    }
  };

  it('prefers backend actual over per-muscle and global', () => {
    const { getByTestId } = render(
      <HookHarness
        analytics={fakeAnalytics}
        sessionParams={{ contraction_duration_threshold: 2000, session_duration_thresholds_per_muscle: { CH1: 3 } }}
        finalDisplayDataKeys={["CH1"]}
      />
    );
    expect(getByTestId('dur-used').textContent).toBe('2500');
  });
});


