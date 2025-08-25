/**
 * Contraction Filtering Debug Component
 * Visual testing component for isolating and validating contraction filtering logic
 * This component provides a controlled environment to test all toggle combinations
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getContractionAreaColors, QUALITY_COLORS } from '@/lib/qualityColors';
import { logger, LogCategory } from '@/services/logger';

interface TestContraction {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  isGood: boolean;
  meetsMvc: boolean;
  meetsDuration: boolean;
  channel: string;
  maxAmplitude: number;
  peakTime: number;
  expectedColor: 'green' | 'yellow' | 'red';
}

const ContractionFilteringDebug: React.FC = () => {
  // Toggle states
  const [showGoodContractions, setShowGoodContractions] = useState(true);
  const [showPoorContractions, setShowPoorContractions] = useState(true);
  const [showContractionAreas, setShowContractionAreas] = useState(true);
  const [enableLogging, setEnableLogging] = useState(false);

  // Test data - comprehensive scenarios
  const testContractions: TestContraction[] = useMemo(() => [
    // Perfect contraction (green)
    {
      id: 'perfect',
      name: 'Perfect Contraction',
      startTime: 1.0,
      endTime: 2.5,
      isGood: true,
      meetsMvc: true,
      meetsDuration: true,
      channel: 'CH1',
      maxAmplitude: 0.8,
      peakTime: 1.75,
      expectedColor: 'green'
    },
    // Strong but short (yellow - MVC only)
    {
      id: 'mvc-only',
      name: 'Strong but Short',
      startTime: 3.0,
      endTime: 3.8,
      isGood: false,
      meetsMvc: true,
      meetsDuration: false,
      channel: 'CH2',
      maxAmplitude: 0.9,
      peakTime: 3.4,
      expectedColor: 'yellow'
    },
    // Weak but sustained (yellow - Duration only)
    {
      id: 'duration-only',
      name: 'Weak but Sustained',
      startTime: 5.0,
      endTime: 7.2,
      isGood: false,
      meetsMvc: false,
      meetsDuration: true,
      channel: 'CH3',
      maxAmplitude: 0.3,
      peakTime: 6.1,
      expectedColor: 'yellow'
    },
    // Insufficient contraction (red)
    {
      id: 'insufficient',
      name: 'Insufficient Contraction',
      startTime: 8.0,
      endTime: 8.5,
      isGood: false,
      meetsMvc: false,
      meetsDuration: false,
      channel: 'CH1',
      maxAmplitude: 0.2,
      peakTime: 8.25,
      expectedColor: 'red'
    },
    // Edge case: Backend says good but criteria not met
    {
      id: 'backend-override',
      name: 'Backend Override (Edge Case)',
      startTime: 10.0,
      endTime: 11.0,
      isGood: true, // Backend override
      meetsMvc: false,
      meetsDuration: false,
      channel: 'CH2',
      maxAmplitude: 0.15,
      peakTime: 10.5,
      expectedColor: 'green'
    }
  ], []);

  // Apply filtering logic (identical to EMGChart)
  const filteredContractions = useMemo(() => {
    const filtered = testContractions.filter(area => {
      if (enableLogging) {
        logger.debug(LogCategory.CHART_RENDER, `🎯 Filtering ${area.name}`, {
          isGood: area.isGood,
          meetsMvc: area.meetsMvc,
          meetsDuration: area.meetsDuration,
          showGood: showGoodContractions,
          showPoor: showPoorContractions
        });
      }

      // Three quality categories: Good (green), Adequate (yellow), Poor (red)
      if (area.isGood) {
        const show = showGoodContractions;
        if (enableLogging) {
          logger.debug(LogCategory.CHART_RENDER, `✅ Good contraction: ${show ? 'SHOW' : 'HIDE'}`);
        }
        return show;
      }
      
      // For non-good contractions, check if they're adequate (yellow) or poor (red)
      const isAdequate = (area.meetsMvc && !area.meetsDuration) || (!area.meetsMvc && area.meetsDuration);
      const isPoor = !area.meetsMvc && !area.meetsDuration;
      
      if (isAdequate) {
        // Show adequate contractions when either good OR poor contractions are enabled
        const show = showGoodContractions || showPoorContractions;
        if (enableLogging) {
          logger.debug(LogCategory.CHART_RENDER, `🟡 Adequate contraction: ${show ? 'SHOW' : 'HIDE'}`, {
            reason: area.meetsMvc && !area.meetsDuration ? 'mvc-only' : 'duration-only',
            showGood: showGoodContractions,
            showPoor: showPoorContractions
          });
        }
        return show;
      }
      
      if (isPoor) {
        // Only show poor contractions when explicitly enabled
        const show = showPoorContractions;
        if (enableLogging) {
          logger.debug(LogCategory.CHART_RENDER, `🔴 Poor contraction: ${show ? 'SHOW' : 'HIDE'}`);
        }
        return show;
      }
      
      if (enableLogging) {
        logger.warn(LogCategory.CHART_RENDER, `⚠️ Unknown contraction category: ${area.name}`);
      }
      return false;
    });

    if (enableLogging) {
      logger.info(LogCategory.CHART_RENDER, `Filtering result: ${filtered.length}/${testContractions.length} contractions visible`);
    }

    return filtered;
  }, [testContractions, showGoodContractions, showPoorContractions, enableLogging]);

  // Test scenarios
  const testScenarios = [
    { good: true, poor: true, name: 'Show All', expected: 5 },
    { good: true, poor: false, name: 'Good + Adequate Only', expected: 4 }, // This was failing before fix
    { good: false, poor: true, name: 'Adequate + Poor Only', expected: 3 },
    { good: false, poor: false, name: 'Hide All', expected: 0 }
  ];

  const runTestScenario = (scenario: typeof testScenarios[0]) => {
    setShowGoodContractions(scenario.good);
    setShowPoorContractions(scenario.poor);
  };

  const getQualityCategory = (contraction: TestContraction): string => {
    if (contraction.isGood) return 'Good (Green)';
    
    const isAdequate = (contraction.meetsMvc && !contraction.meetsDuration) || 
                       (!contraction.meetsMvc && contraction.meetsDuration);
    
    if (isAdequate) {
      return contraction.meetsMvc && !contraction.meetsDuration ? 
        'Adequate MVC-Only (Yellow)' : 'Adequate Duration-Only (Yellow)';
    }
    
    return 'Poor (Red)';
  };

  const getExpectedVisibility = (contraction: TestContraction): boolean => {
    if (contraction.isGood) return showGoodContractions;
    
    const isAdequate = (contraction.meetsMvc && !contraction.meetsDuration) || 
                       (!contraction.meetsMvc && contraction.meetsDuration);
    
    if (isAdequate) return showGoodContractions || showPoorContractions;
    
    return showPoorContractions;
  };

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🧪 Contraction Filtering Debug Component
            <Badge variant="outline">UI Testing Tool</Badge>
          </CardTitle>
          <p className="text-sm text-gray-600">
            Isolated testing environment for validating the contraction filtering logic fix.
            This component helps verify that yellow (adequate) contractions are properly shown.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Controls */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Toggle Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-good">Show Good Contractions</Label>
                  <Switch
                    id="show-good"
                    checked={showGoodContractions}
                    onCheckedChange={setShowGoodContractions}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-poor">Show Poor Contractions</Label>
                  <Switch
                    id="show-poor"
                    checked={showPoorContractions}
                    onCheckedChange={setShowPoorContractions}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="enable-logging">Enable Debug Logging</Label>
                  <Switch
                    id="enable-logging"
                    checked={enableLogging}
                    onCheckedChange={setEnableLogging}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test Scenarios</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {testScenarios.map((scenario, idx) => {
                  const isActive = showGoodContractions === scenario.good && 
                                 showPoorContractions === scenario.poor;
                  return (
                    <Button
                      key={idx}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      className="w-full justify-between text-xs"
                      onClick={() => runTestScenario(scenario)}
                    >
                      <span>{scenario.name}</span>
                      <Badge variant={isActive ? "secondary" : "outline"}>
                        Expect {scenario.expected}
                      </Badge>
                    </Button>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <Card className="border-l-4 border-l-green-500">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Filtering Results</span>
                <Badge variant={filteredContractions.length > 0 ? "default" : "secondary"}>
                  {filteredContractions.length}/{testContractions.length} visible
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {testContractions.map((contraction) => {
                  const isVisible = getExpectedVisibility(contraction);
                  const actuallyVisible = filteredContractions.includes(contraction);
                  const colors = getContractionAreaColors({
                    isGood: contraction.isGood,
                    meetsMvc: contraction.meetsMvc,
                    meetsDuration: contraction.meetsDuration
                  });

                  return (
                    <div
                      key={contraction.id}
                      className={`
                        flex items-center justify-between p-3 rounded-lg border-2 transition-all
                        ${actuallyVisible 
                          ? 'border-green-300 bg-green-50' 
                          : 'border-gray-200 bg-gray-50 opacity-60'}
                        ${isVisible !== actuallyVisible ? 'border-red-500 bg-red-50' : ''}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-6 h-6 rounded border-2 flex-shrink-0"
                          style={{ 
                            backgroundColor: colors.fill, 
                            borderColor: colors.stroke 
                          }}
                        />
                        <div>
                          <div className="font-medium">{contraction.name}</div>
                          <div className="text-xs text-gray-600">
                            {getQualityCategory(contraction)}
                          </div>
                          <div className="text-xs font-mono text-gray-500">
                            MVC: {contraction.meetsMvc ? '✓' : '✗'}, 
                            Duration: {contraction.meetsDuration ? '✓' : '✗'}, 
                            isGood: {contraction.isGood ? '✓' : '✗'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={actuallyVisible ? "default" : "secondary"}
                          className="mb-1"
                        >
                          {actuallyVisible ? 'VISIBLE' : 'HIDDEN'}
                        </Badge>
                        {isVisible !== actuallyVisible && (
                          <div className="text-xs text-red-600 font-medium">
                            ⚠️ Logic Error!
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Color Reference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Color Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div 
                    className="w-12 h-8 mx-auto rounded border-2 mb-2"
                    style={{ 
                      backgroundColor: QUALITY_COLORS.good.fill,
                      borderColor: QUALITY_COLORS.good.stroke
                    }}
                  />
                  <div className="text-sm font-medium">Good (Green)</div>
                  <div className="text-xs text-gray-600">Both criteria met</div>
                </div>
                <div className="text-center">
                  <div 
                    className="w-12 h-8 mx-auto rounded border-2 mb-2"
                    style={{ 
                      backgroundColor: QUALITY_COLORS.adequate.fill,
                      borderColor: QUALITY_COLORS.adequate.stroke
                    }}
                  />
                  <div className="text-sm font-medium">Adequate (Yellow)</div>
                  <div className="text-xs text-gray-600">One criterion met</div>
                </div>
                <div className="text-center">
                  <div 
                    className="w-12 h-8 mx-auto rounded border-2 mb-2"
                    style={{ 
                      backgroundColor: QUALITY_COLORS.poor.fill,
                      borderColor: QUALITY_COLORS.poor.stroke
                    }}
                  />
                  <div className="text-sm font-medium">Poor (Red)</div>
                  <div className="text-xs text-gray-600">Neither criterion met</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                📋 Testing Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-700 space-y-2">
              <p><strong>Critical Test:</strong> Click "Good + Adequate Only" - you should see 4 contractions (green + 2 yellow).</p>
              <p><strong>Regression Test:</strong> Before the fix, yellow contractions were hidden when "Show Poor" was OFF.</p>
              <p><strong>Expected Behavior:</strong> Yellow contractions should be visible when either toggle is ON.</p>
              <p><strong>Debug Mode:</strong> Enable logging to see detailed filtering decisions in browser console.</p>
            </CardContent>
          </Card>

        </CardContent>
      </Card>
    </div>
  );
};

export default ContractionFilteringDebug;