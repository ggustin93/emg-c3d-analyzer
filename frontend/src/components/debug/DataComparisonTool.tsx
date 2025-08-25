/**
 * Data Comparison Tool
 * Compares working synthetic data vs real backend data
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChannelAnalyticsData, GameSessionParameters } from '@/types/emg';

interface DataComparisonToolProps {
  backendAnalytics?: Record<string, ChannelAnalyticsData> | null;
  backendSessionParams?: GameSessionParameters | null;
}

const DataComparisonTool: React.FC<DataComparisonToolProps> = ({
  backendAnalytics,
  backendSessionParams
}) => {
  // Synthetic data (WORKING) - same as debug component
  const syntheticData = {
    analytics: {
      'CH1': {
        contractions: [
          { start_time_ms: 1000, end_time_ms: 2500, duration_ms: 1500, is_good: true, meets_mvc: true, meets_duration: true },
          { start_time_ms: 3000, end_time_ms: 3800, duration_ms: 800, is_good: false, meets_mvc: true, meets_duration: false },
          { start_time_ms: 5000, end_time_ms: 7200, duration_ms: 2200, is_good: false, meets_mvc: false, meets_duration: true },
          { start_time_ms: 8000, end_time_ms: 8500, duration_ms: 500, is_good: false, meets_mvc: false, meets_duration: false }
        ]
      }
    },
    sessionParams: {
      contraction_duration_threshold: 2000,
      session_mvc_threshold_percentages: { 'CH1': 50 }
    }
  };

  const getExpectedColor = (contraction: any): string => {
    if (contraction.is_good) return 'GREEN';
    if ((contraction.meets_mvc && !contraction.meets_duration) || 
        (!contraction.meets_mvc && contraction.meets_duration)) return 'YELLOW';
    return 'RED';
  };

  const getCorrectColor = (contraction: any, durationThreshold: number = 2000): string => {
    const actualMeetsDuration = contraction.duration_ms >= durationThreshold;
    const actualIsGood = contraction.meets_mvc && actualMeetsDuration;
    
    if (actualIsGood) return 'GREEN';
    if ((contraction.meets_mvc && !actualMeetsDuration) || 
        (!contraction.meets_mvc && actualMeetsDuration)) return 'YELLOW';
    return 'RED';
  };

  return (
    <div className="space-y-6">
      <Card className="border-l-4 border-l-purple-500">
        <CardHeader>
          <CardTitle>📊 Working vs Broken Data Comparison</CardTitle>
          <p className="text-sm text-gray-600">
            Compare synthetic data (working perfectly) vs your backend data (showing wrong colors)
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Synthetic Data - WORKING */}
          <div>
            <h4 className="font-medium text-green-700 mb-3">✅ Synthetic Data (Working Correctly)</h4>
            <div className="grid gap-2">
              {syntheticData.analytics.CH1.contractions.map((contraction, idx) => {
                const expectedColor = getExpectedColor(contraction);
                const correctColor = getCorrectColor(contraction, 2000);
                const isCorrect = expectedColor === correctColor;
                
                return (
                  <div key={idx} className={`p-3 rounded border-l-4 ${isCorrect ? 'border-l-green-500 bg-green-50' : 'border-l-red-500 bg-red-50'}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        <strong>Duration:</strong> {contraction.duration_ms}ms | 
                        <strong> MVC:</strong> {String(contraction.meets_mvc)} | 
                        <strong> Duration:</strong> {String(contraction.meets_duration)} | 
                        <strong> Good:</strong> {String(contraction.is_good)}
                      </span>
                      <div className="flex gap-2">
                        <Badge className={
                          expectedColor === 'GREEN' ? 'bg-green-100 text-green-800' :
                          expectedColor === 'YELLOW' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }>
                          Shows: {expectedColor}
                        </Badge>
                        {isCorrect ? 
                          <Badge className="bg-green-100 text-green-800">✅ CORRECT</Badge> : 
                          <Badge className="bg-red-100 text-red-800">❌ WRONG</Badge>
                        }
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Backend Data - BROKEN */}
          <div>
            <h4 className="font-medium text-red-700 mb-3">❌ Your Backend Data {!backendAnalytics ? '(Not loaded yet)' : ''}</h4>
            {!backendAnalytics ? (
              <div className="p-4 bg-gray-50 rounded text-sm text-gray-600">
                Upload and process a C3D file to see your backend data here...
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(backendAnalytics).map(([channelName, channelData]) => (
                  <div key={channelName}>
                    <h5 className="font-medium text-sm mb-2">Channel: {channelName}</h5>
                    <div className="grid gap-2">
                      {channelData.contractions?.map((contraction, idx) => {
                        const expectedColor = getExpectedColor(contraction);
                        const correctColor = getCorrectColor(contraction, 
                          backendSessionParams?.contraction_duration_threshold || 2000);
                        const isCorrect = expectedColor === correctColor;
                        
                        return (
                          <div key={idx} className={`p-3 rounded border-l-4 ${isCorrect ? 'border-l-green-500 bg-green-50' : 'border-l-red-500 bg-red-50'}`}>
                            <div className="flex items-center justify-between text-sm">
                              <span>
                                <strong>Duration:</strong> {contraction.duration_ms}ms | 
                                <strong> MVC:</strong> {String(contraction.meets_mvc)} | 
                                <strong> Duration:</strong> {String(contraction.meets_duration)} | 
                                <strong> Good:</strong> {String(contraction.is_good)}
                              </span>
                              <div className="flex gap-2">
                                <Badge className={
                                  expectedColor === 'GREEN' ? 'bg-green-100 text-green-800' :
                                  expectedColor === 'YELLOW' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }>
                                  Shows: {expectedColor}
                                </Badge>
                                <Badge className={
                                  correctColor === 'GREEN' ? 'bg-green-100 text-green-800' :
                                  correctColor === 'YELLOW' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }>
                                  Should be: {correctColor}
                                </Badge>
                                {isCorrect ? 
                                  <Badge className="bg-green-100 text-green-800">✅ CORRECT</Badge> : 
                                  <Badge className="bg-red-100 text-red-800">❌ BACKEND BUG!</Badge>
                                }
                              </div>
                            </div>
                            {!isCorrect && (
                              <div className="mt-2 text-xs text-red-600">
                                🐛 Backend set is_good={String(contraction.is_good)} but duration {contraction.duration_ms}ms should make is_good={correctColor === 'GREEN' ? 'true' : 'false'}
                              </div>
                            )}
                          </div>
                        );
                      }) || <div className="text-sm text-gray-500">No contractions found</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-orange-500">
        <CardHeader>
          <CardTitle>🔧 Quick Fixes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div>
            <h4 className="font-medium mb-1">Option 1: Fix Backend (Recommended)</h4>
            <p className="text-gray-700">Fix the backend logic that calculates `is_good`, `meets_mvc`, `meets_duration` flags.</p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Option 2: Override Frontend (Temporary)</h4>
            <p className="text-gray-700">Force frontend to ignore backend `is_good` and calculate it correctly based on duration/MVC thresholds.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataComparisonTool;