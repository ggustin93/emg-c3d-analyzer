/**
 * Contraction Color Debug Panel
 * Comprehensive debugging tool for contraction color issues
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ContractionDataInspector from './ContractionDataInspector';
import LoggingConsole from './LoggingConsole';
import ContractionFilteringDebug from './ContractionFilteringDebug';
import EMGChartTestHarness from './EMGChartTestHarness';
import DataComparisonTool from './DataComparisonTool';
import { ChannelAnalyticsData, GameSessionParameters } from '@/types/emg';

interface ContractionColorDebugPanelProps {
  analytics?: Record<string, ChannelAnalyticsData> | null;
  sessionParams?: GameSessionParameters | null;
}

const ContractionColorDebugPanel: React.FC<ContractionColorDebugPanelProps> = ({
  analytics = null,
  sessionParams = null
}) => {
  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      <Card className="border-l-4 border-l-red-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🐛 Contraction Color Debug Panel
            <span className="text-sm font-normal text-gray-600">
              Comprehensive debugging for yellow contraction color issues
            </span>
          </CardTitle>
          <div className="text-sm text-gray-700 bg-yellow-50 p-3 rounded">
            <strong>Problem:</strong> Contractions with short duration (&lt;2000ms) are showing as GREEN instead of YELLOW.<br/>
            <strong>Investigation:</strong> Check if backend is sending incorrect `is_good`, `meets_mvc`, `meets_duration` flags or if there's a unit conversion issue.
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="data-comparison" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="data-comparison">Data Comparison</TabsTrigger>
          <TabsTrigger value="data-inspector">Data Inspector</TabsTrigger>
          <TabsTrigger value="live-logging">Live Logging</TabsTrigger>
          <TabsTrigger value="filter-test">Filter Test</TabsTrigger>
          <TabsTrigger value="integration-test">Integration Test</TabsTrigger>
        </TabsList>

        <TabsContent value="data-comparison" className="space-y-4">
          <div className="bg-purple-50 p-4 rounded">
            <h3 className="font-medium mb-2">📊 Working vs Broken Data</h3>
            <p className="text-sm text-purple-800">
              Compare working synthetic data vs your actual backend data to identify exactly what the backend is doing wrong.
            </p>
          </div>
          <DataComparisonTool 
            backendAnalytics={analytics}
            backendSessionParams={sessionParams}
          />
        </TabsContent>

        <TabsContent value="data-inspector" className="space-y-4">
          <div className="bg-blue-50 p-4 rounded">
            <h3 className="font-medium mb-2">🔍 Real Backend Data Analysis</h3>
            <p className="text-sm text-blue-800">
              This shows the actual data received from your backend API, comparing backend flags vs frontend calculations.
              Look for mismatches where backend says `is_good: true` but duration &lt; 2000ms.
            </p>
          </div>
          <ContractionDataInspector 
            analytics={analytics} 
            sessionParams={sessionParams} 
          />
        </TabsContent>

        <TabsContent value="live-logging" className="space-y-4">
          <div className="bg-purple-50 p-4 rounded">
            <h3 className="font-medium mb-2">📝 Live EMG Chart Logging</h3>
            <p className="text-sm text-purple-800">
              Captures real-time logging from the EMG chart as you interact with it. 
              Start capture, then toggle chart settings to see detailed filtering decisions.
            </p>
          </div>
          <LoggingConsole />
        </TabsContent>

        <TabsContent value="filter-test" className="space-y-4">
          <div className="bg-green-50 p-4 rounded">
            <h3 className="font-medium mb-2">🧪 Isolated Filter Testing</h3>
            <p className="text-sm text-green-800">
              Tests the filtering logic in isolation with known test data.
              This helps verify that the filtering itself works correctly.
            </p>
          </div>
          <ContractionFilteringDebug />
        </TabsContent>

        <TabsContent value="integration-test" className="space-y-4">
          <div className="bg-orange-50 p-4 rounded">
            <h3 className="font-medium mb-2">🔬 Full Integration Test</h3>
            <p className="text-sm text-orange-800">
              Tests the complete EMGChart component with synthetic data.
              Shows how colors should appear vs how they actually appear.
            </p>
          </div>
          <EMGChartTestHarness />
          
          {/* Comparison Mode Bug Investigation */}
          {analytics && Object.keys(analytics).length > 1 && (
            <div className="mt-6 p-4 bg-red-100 border border-red-300 rounded">
              <h4 className="font-semibold text-red-800 mb-2">🚨 COMPARISON MODE BUG DETECTED</h4>
              <p className="text-sm text-red-700 mb-3">
                You have multiple channels ({Object.keys(analytics).join(', ')}). 
                The bug happens specifically in comparison mode with multiple channels.
              </p>
              <div className="text-xs space-y-1">
                <p><strong>Bug Behavior:</strong> All contractions show as GREEN despite is_good=false</p>
                <p><strong>Expected:</strong> Should show YELLOW for adequate contractions</p>
                <p><strong>Investigation:</strong> Check useContractionAnalysis hook data flow in comparison mode</p>
                <p><strong>Evidence:</strong> Debug components work perfectly, suggesting data processing issue in EMGChart</p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Card className="border-l-4 border-l-green-500">
        <CardHeader>
          <CardTitle>🔧 Next Steps for Debugging</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">1. Check Backend Data (Data Inspector)</h4>
              <ul className="space-y-1 text-gray-700">
                <li>• Look for contractions with duration &lt; 2000ms but `is_good: true`</li>
                <li>• Compare backend vs frontend threshold calculations</li>
                <li>• Check if duration units are consistent (ms vs seconds)</li>
                <li>• Verify MVC threshold values match expectations</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">2. Monitor Real-time Activity (Live Logging)</h4>
              <ul className="space-y-1 text-gray-700">
                <li>• Start logging capture</li>
                <li>• Upload a C3D file with known short contractions</li>
                <li>• Look for "Backend/Frontend mismatch" warnings</li>
                <li>• Check color assignment decisions (🎯🟡🔴 emojis)</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 p-3 bg-red-50 rounded">
            <strong className="text-red-800">Expected Finding:</strong> Backend is probably sending `is_good: true` for contractions that should be yellow (adequate), overriding the frontend color calculation.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContractionColorDebugPanel;