/**
 * Contraction Data Inspector
 * Real-time debugging tool to inspect actual backend contraction data
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChannelAnalyticsData, GameSessionParameters } from '@/types/emg';
import { EMG_CHART_CONFIG } from '@/config/emgChartConfig';

interface ContractionDataInspectorProps {
  analytics: Record<string, ChannelAnalyticsData> | null;
  sessionParams: GameSessionParameters | null;
}

const ContractionDataInspector: React.FC<ContractionDataInspectorProps> = ({
  analytics,
  sessionParams
}) => {
  const [showRawData, setShowRawData] = React.useState(false);

  if (!analytics || !sessionParams) {
    return (
      <Card className="border-l-4 border-l-orange-500">
        <CardHeader>
          <CardTitle>⚠️ No Data Available</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Upload and process a C3D file to inspect contraction data.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get default duration threshold
  const defaultDurationThreshold = sessionParams.contraction_duration_threshold ?? EMG_CHART_CONFIG.DEFAULT_DURATION_THRESHOLD_MS;

  return (
    <div className="space-y-4">
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            🔍 Contraction Data Inspector
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRawData(!showRawData)}
            >
              {showRawData ? 'Hide Raw Data' : 'Show Raw Data'}
            </Button>
          </CardTitle>
          <p className="text-sm text-gray-600">
            Inspect actual backend contraction data to debug color issues
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Session Thresholds */}
          <div>
            <h4 className="font-medium text-sm mb-3">Session Thresholds</h4>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-gray-50 p-2 rounded">
                <strong>Duration Threshold (Default):</strong> {defaultDurationThreshold}ms
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <strong>Per-Muscle Duration:</strong> {JSON.stringify(sessionParams.session_duration_thresholds_per_muscle || {})}
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <strong>MVC Values:</strong> {JSON.stringify(sessionParams.session_mvc_values || {})}
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <strong>MVC Thresholds:</strong> {JSON.stringify(sessionParams.session_mvc_threshold_percentages || {})}
              </div>
            </div>
          </div>

          {/* Channel Analysis */}
          {Object.entries(analytics).map(([channelName, channelData]) => (
            <Card key={channelName} className="border">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  Channel: {channelName}
                  <Badge variant="outline">
                    {channelData.contractions?.length || 0} contractions
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Channel Thresholds */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-blue-50 p-2 rounded">
                    <strong>MVC Threshold:</strong> {channelData.mvc_threshold_actual_value ?? 'N/A'}
                  </div>
                  <div className="bg-blue-50 p-2 rounded">
                    <strong>Duration Threshold:</strong> {channelData.duration_threshold_actual_value ?? 'N/A'}ms
                  </div>
                </div>

                {/* Contractions */}
                {channelData.contractions?.map((contraction, idx) => {
                  // Calculate frontend values for comparison
                  const mvcThreshold = channelData.mvc_threshold_actual_value;
                  const durationThreshold = channelData.duration_threshold_actual_value ?? defaultDurationThreshold;
                  
                  const frontendMeetsMvc = mvcThreshold !== null && mvcThreshold !== undefined && contraction.max_amplitude >= mvcThreshold;
                  const frontendMeetsDuration = contraction.duration_ms >= durationThreshold;
                  const frontendIsGood = frontendMeetsMvc && frontendMeetsDuration;
                  
                  // Determine expected color
                  const backendColor = contraction.is_good ? 'green' : 
                    (contraction.meets_mvc && !contraction.meets_duration) || (!contraction.meets_mvc && contraction.meets_duration) ? 'yellow' : 'red';
                  const frontendColor = frontendIsGood ? 'green' : 
                    (frontendMeetsMvc && !frontendMeetsDuration) || (!frontendMeetsMvc && frontendMeetsDuration) ? 'yellow' : 'red';
                  
                  const mismatch = backendColor !== frontendColor;
                  
                  return (
                    <div 
                      key={idx} 
                      className={`p-3 rounded border-l-4 ${
                        mismatch ? 'border-l-red-500 bg-red-50' : 'border-l-green-500 bg-green-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">Contraction #{idx + 1}</span>
                        <div className="flex gap-2">
                          <Badge variant={backendColor === 'green' ? 'default' : 'outline'} className={
                            backendColor === 'green' ? 'bg-green-100 text-green-800' :
                            backendColor === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }>
                            Backend: {backendColor.toUpperCase()}
                          </Badge>
                          <Badge variant={frontendColor === 'green' ? 'default' : 'outline'} className={
                            frontendColor === 'green' ? 'bg-green-100 text-green-800' :
                            frontendColor === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }>
                            Frontend: {frontendColor.toUpperCase()}
                          </Badge>
                          {mismatch && <Badge variant="destructive">MISMATCH!</Badge>}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <div><strong>Duration:</strong> {contraction.duration_ms}ms</div>
                          <div><strong>Max Amplitude:</strong> {contraction.max_amplitude.toFixed(4)}</div>
                          <div><strong>Time:</strong> {contraction.start_time_ms}ms - {contraction.end_time_ms}ms</div>
                        </div>
                        <div>
                          <div><strong>Backend is_good:</strong> {String(contraction.is_good)}</div>
                          <div><strong>Backend meets_mvc:</strong> {String(contraction.meets_mvc)}</div>
                          <div><strong>Backend meets_duration:</strong> {String(contraction.meets_duration)}</div>
                        </div>
                      </div>
                      
                      <div className="mt-2 pt-2 border-t border-gray-200 grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <div><strong>Frontend MVC Check:</strong> {contraction.max_amplitude.toFixed(4)} {'>='} {mvcThreshold} = {String(frontendMeetsMvc)}</div>
                          <div><strong>Frontend Duration Check:</strong> {contraction.duration_ms} {'>='} {durationThreshold} = {String(frontendMeetsDuration)}</div>
                        </div>
                        <div>
                          <div><strong>Frontend is_good:</strong> {String(frontendIsGood)}</div>
                          {mismatch && (
                            <div className="text-red-600 font-medium">
                              ⚠️ Backend and frontend disagree!
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}

          {/* Raw Data (if requested) */}
          {showRawData && (
            <Card>
              <CardHeader>
                <CardTitle>Raw JSON Data</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-h-96">
                  {JSON.stringify({ analytics, sessionParams }, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ContractionDataInspector;