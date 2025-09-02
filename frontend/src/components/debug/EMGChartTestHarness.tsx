/**
 * EMG Chart Test Harness
 * Integration testing component for validating EMGChart with real contraction data
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EMGChart, { CombinedChartDataPoint } from '@/components/tabs/SignalPlotsTab/EMGChart';
import { GameSessionParameters, ChannelAnalyticsData, Contraction } from '@/types/emg';

const EMGChartTestHarness: React.FC = () => {
  // Test controls
  const [showGoodContractions, setShowGoodContractions] = useState(true);
  const [showPoorContractions, setShowPoorContractions] = useState(true);
  const [showContractionAreas, setShowContractionAreas] = useState(true);
  const [showContractionDots, setShowContractionDots] = useState(true);

  // Generate synthetic EMG data with known contraction patterns
  const chartData: CombinedChartDataPoint[] = useMemo(() => {
    const data: CombinedChartDataPoint[] = [];
    const samplingRate = 100; // 100 Hz
    const duration = 12; // 12 seconds
    
    for (let i = 0; i < duration * samplingRate; i++) {
      const time = i / samplingRate;
      
      // Base signal with noise
      let amplitude = 0.1 + Math.random() * 0.05;
      
      // Add contractions at specific time intervals
      // Perfect contraction: 1.0-2.5s (high amplitude, long duration)
      if (time >= 1.0 && time <= 2.5) {
        amplitude += 0.7 * Math.sin((time - 1.0) * Math.PI / 1.5);
      }
      
      // MVC-only contraction: 3.0-3.8s (high amplitude, short duration)  
      if (time >= 3.0 && time <= 3.8) {
        amplitude += 0.8 * Math.sin((time - 3.0) * Math.PI / 0.8);
      }
      
      // Duration-only contraction: 5.0-7.2s (low amplitude, long duration)
      if (time >= 5.0 && time <= 7.2) {
        amplitude += 0.25 * Math.sin((time - 5.0) * Math.PI / 2.2);
      }
      
      // Poor contraction: 8.0-8.5s (low amplitude, short duration)
      if (time >= 8.0 && time <= 8.5) {
        amplitude += 0.15 * Math.sin((time - 8.0) * Math.PI / 0.5);
      }
      
      data.push({
        time: Number(time.toFixed(3)),
        'CH1 Processed': Number(amplitude.toFixed(6))
      });
    }
    
    return data;
  }, []);

  // Create mock analytics data with specific contraction classifications
  const analytics: Record<string, ChannelAnalyticsData> = useMemo(() => ({
    'CH1': {
      contraction_count: 4,
      avg_duration_ms: 1250,
      min_duration_ms: 500,
      max_duration_ms: 2200,
      total_time_under_tension_ms: 5000,
      avg_amplitude: 0.48,
      max_amplitude: 0.85,
      rms: 0.45,
      mav: 0.38,
      mpf: 85.2,
      mdf: 78.4,
      fatigue_index_fi_nsm5: 0.12,
      mvc75_threshold: 0.5, // MVC threshold
      duration_threshold_actual_value: 2000, // Duration threshold in ms
      contractions: [
        // Perfect contraction (green)
        {
          start_time_ms: 1000,
          end_time_ms: 2500,
          duration_ms: 1500,
          mean_amplitude: 0.65,
          max_amplitude: 0.78,
          meets_mvc: true,
          meets_duration: true,
          is_good: true
        } as Contraction,
        // MVC-only contraction (yellow)
        {
          start_time_ms: 3000,
          end_time_ms: 3800,
          duration_ms: 800,
          mean_amplitude: 0.72,
          max_amplitude: 0.85,
          meets_mvc: true,
          meets_duration: false,
          is_good: false
        } as Contraction,
        // Duration-only contraction (yellow)
        {
          start_time_ms: 5000,
          end_time_ms: 7200,
          duration_ms: 2200,
          mean_amplitude: 0.28,
          max_amplitude: 0.35,
          meets_mvc: false,
          meets_duration: true,
          is_good: false
        } as Contraction,
        // Poor contraction (red)
        {
          start_time_ms: 8000,
          end_time_ms: 8500,
          duration_ms: 500,
          mean_amplitude: 0.18,
          max_amplitude: 0.25,
          meets_mvc: false,
          meets_duration: false,
          is_good: false
        } as Contraction
      ]
    }
  }), []);

  const sessionParams: GameSessionParameters = useMemo(() => ({
    channel_muscle_mapping: { 'CH1': 'Biceps' },
    muscle_color_mapping: { 'Biceps': '#3b82f6' },
    session_mvc_values: { 'CH1': 1.0 },
    session_mvc_threshold_percentages: { 'CH1': 50 },
    contraction_duration_threshold: 2000,
    session_duration_thresholds_per_muscle: { 'CH1': 2.0 }
  }), []);

  const testScenarios = [
    { 
      good: true, 
      poor: true, 
      name: 'Show All', 
      description: 'All 4 contractions visible (1 green, 2 yellow, 1 red)',
      expectedCount: 4
    },
    { 
      good: true, 
      poor: false, 
      name: 'Good + Adequate', 
      description: 'Should show green + yellow contractions (3 total) - This was the bug!',
      expectedCount: 3
    },
    { 
      good: false, 
      poor: true, 
      name: 'Adequate + Poor', 
      description: 'Should show yellow + red contractions (3 total)',
      expectedCount: 3
    },
    { 
      good: false, 
      poor: false, 
      name: 'Hide All', 
      description: 'No contractions visible',
      expectedCount: 0
    }
  ];

  const runTestScenario = (scenario: typeof testScenarios[0]) => {
    setShowGoodContractions(scenario.good);
    setShowPoorContractions(scenario.poor);
  };

  // Count expected visible contractions based on current toggle state
  const getExpectedVisibleCount = (): number => {
    const contractions = analytics.CH1.contractions;
    if (!contractions) return 0;
    
    let count = 0;
    
    contractions.forEach(contraction => {
      if (contraction.is_good && showGoodContractions) {
        count++;
      } else if (!contraction.is_good) {
        const isAdequate = (contraction.meets_mvc && !contraction.meets_duration) || 
                          (!contraction.meets_mvc && contraction.meets_duration);
        
        if (isAdequate && (showGoodContractions || showPoorContractions)) {
          count++;
        } else if (!isAdequate && showPoorContractions) {
          count++;
        }
      }
    });
    
    return count;
  };

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      <Card className="border-l-4 border-l-purple-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔬 EMG Chart Integration Test Harness
            <Badge variant="outline">Full Integration Test</Badge>
          </CardTitle>
          <p className="text-sm text-gray-600">
            Tests the actual EMGChart component with synthetic data containing all contraction types.
            Validates that the filtering fix works in the real component environment.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Test Controls */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Chart Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-good-chart">Show Good Contractions</Label>
                  <Switch
                    id="show-good-chart"
                    checked={showGoodContractions}
                    onCheckedChange={setShowGoodContractions}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-poor-chart">Show Poor Contractions</Label>
                  <Switch
                    id="show-poor-chart"
                    checked={showPoorContractions}
                    onCheckedChange={setShowPoorContractions}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-areas">Show Areas</Label>
                  <Switch
                    id="show-areas"
                    checked={showContractionAreas}
                    onCheckedChange={setShowContractionAreas}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-dots">Show Dots</Label>
                  <Switch
                    id="show-dots"
                    checked={showContractionDots}
                    onCheckedChange={setShowContractionDots}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  Test Scenarios
                  <Badge variant="default">
                    Expected: {getExpectedVisibleCount()}/4
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {testScenarios.map((scenario, idx) => {
                  const isActive = showGoodContractions === scenario.good && 
                                 showPoorContractions === scenario.poor;
                  return (
                    <div key={idx} className="space-y-1">
                      <Button
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        className="w-full justify-start text-xs"
                        onClick={() => runTestScenario(scenario)}
                      >
                        <span className="flex-1 text-left">{scenario.name}</span>
                        <Badge variant={isActive ? "secondary" : "outline"}>
                          {scenario.expectedCount}/4
                        </Badge>
                      </Button>
                      <p className="text-xs text-gray-500 px-2">
                        {scenario.description}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Chart Display */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">EMG Chart with Test Data</CardTitle>
              <p className="text-sm text-gray-600">
                Synthetic EMG signal with 4 contractions: Perfect (1.0-2.5s), Strong-Short (3.0-3.8s), 
                Weak-Long (5.0-7.2s), Poor (8.0-8.5s)
              </p>
            </CardHeader>
            <CardContent>
              <div className="bg-white p-4 rounded border">
                <EMGChart
                  chartData={chartData}
                  availableChannels={['CH1 Processed']}
                  selectedChannel="CH1 Processed"
                  viewMode="single"
                  mvcThresholdForPlot={0.5}
                  channel_muscle_mapping={{ 'CH1': 'Biceps' }}
                  muscle_color_mapping={{ 'Biceps': '#3b82f6' }}
                  sessionParams={sessionParams}
                  isLoading={false}
                  externalPlotMode="processed"
                  showSignalSwitch={false}
                  analytics={analytics}
                  showGoodContractions={showGoodContractions}
                  showPoorContractions={showPoorContractions}
                  showContractionAreas={showContractionAreas}
                  showContractionDots={showContractionDots}
                />
              </div>
            </CardContent>
          </Card>

          {/* Contraction Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Test Contraction Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {analytics.CH1.contractions?.map((contraction, idx) => {
                  const contractionNames = ['Perfect', 'Strong-Short', 'Weak-Long', 'Poor'];
                  const expectedColors = ['green', 'yellow', 'yellow', 'red'];
                  const categories = ['Good', 'Adequate (MVC)', 'Adequate (Duration)', 'Poor'];
                  
                  return (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div>
                        <div className="font-medium">{contractionNames[idx]} Contraction</div>
                        <div className="text-sm text-gray-600">{categories[idx]}</div>
                        <div className="text-xs font-mono text-gray-500">
                          {contraction.start_time_ms/1000}s-{contraction.end_time_ms/1000}s | 
                          Amp: {contraction.max_amplitude.toFixed(2)} | 
                          Dur: {contraction.duration_ms}ms
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant="outline" 
                          className={`mb-1 ${
                            expectedColors[idx] === 'green' ? 'border-green-500 text-green-700' :
                            expectedColors[idx] === 'yellow' ? 'border-yellow-500 text-yellow-700' :
                            'border-red-500 text-red-700'
                          }`}
                        >
                          {expectedColors[idx].toUpperCase()}
                        </Badge>
                        <div className="text-xs text-gray-500">
                          MVC: {contraction.meets_mvc ? '✓' : '✗'} | 
                          Dur: {contraction.meets_duration ? '✓' : '✗'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Testing Checklist */}
          <Card className="border-l-4 border-l-green-500">
            <CardHeader>
              <CardTitle className="text-lg">🧪 Testing Checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="space-y-1">
                <p><strong>✅ Visual Test:</strong> Run "Good + Adequate" scenario - should see 3 highlighted areas</p>
                <p><strong>✅ Color Test:</strong> Verify green (1-2.5s), yellow (3-3.8s & 5-7.2s), red (8-8.5s)</p>
                <p><strong>✅ Toggle Test:</strong> Toggle "Show Poor" off - yellow areas should remain visible</p>
                <p><strong>✅ Regression Test:</strong> Before fix, yellow areas disappeared with poor=false</p>
                <p><strong>✅ Console Test:</strong> Check console for structured logging output</p>
              </div>
            </CardContent>
          </Card>

        </CardContent>
      </Card>
    </div>
  );
};

export default EMGChartTestHarness;