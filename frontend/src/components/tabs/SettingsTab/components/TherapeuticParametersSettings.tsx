import React, { useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import UnifiedSettingsCard from './UnifiedSettingsCard';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { LockedBadge, SourceStatusBadge, TherapistBadge } from "@/components/ui/StatusBadges";
import { ActivityLogIcon, InfoCircledIcon, TargetIcon, GearIcon } from '@radix-ui/react-icons';
import MuscleNameDisplay from '@/components/shared/MuscleNameDisplay';
import { useMvcService } from '@/hooks/useMvcService';
import { useAuth } from '@/contexts/AuthContext';

interface TherapeuticParametersSettingsProps {
  muscleChannels: string[];
  disabled: boolean;
  isDebugMode: boolean;
  analytics?: Record<string, any> | null; // Backend analytics data for threshold validation
}

const TherapeuticParametersSettings: React.FC<TherapeuticParametersSettingsProps> = ({ muscleChannels, disabled, isDebugMode, analytics }) => {
  const { authState } = useAuth();
  const { sessionParams, setSessionParams } = useSessionStore();
  const [isClinicalParametersOpen, setIsClinicalParametersOpen] = useState(false);
  // Editing unlocks only via Debug Mode (production locked)
  const canEdit = isDebugMode && !disabled;
  
  // MVC Service Integration
  const mvcService = useMvcService();
  
  const muscleChannels2 = muscleChannels.filter(ch => !ch.includes(' ')).slice(0, 2);

  const handleExpectedContractionsChange = (value: number | null) => {
    const updatedParams = {
      ...sessionParams,
      session_expected_contractions: value
    };
    
    if (value !== null && value > 0) {
      const halfExpected = value / 2;
      updatedParams.session_expected_contractions_ch1 = Math.ceil(halfExpected);
      updatedParams.session_expected_contractions_ch2 = Math.floor(halfExpected);
    }
    
    setSessionParams(updatedParams);
  };

  // Handler to apply MVC results from current analytics if available
  const handleApplyAnalyticsMVC = () => {
    if (analytics && Object.keys(analytics).length > 0) {
      console.log('🔄 Applying MVC from current analytics to session parameters');
      
      // Create mock EMGAnalysisResult to extract from
      const mockAnalysisResult = {
        analytics: analytics,
        timestamp: new Date().toISOString()
      } as any;
      
      mvcService.extractFromAnalysis(mockAnalysisResult);
      
      // If extraction successful, apply to session
      if (mvcService.estimationResults) {
        mvcService.applyToSession(mvcService.estimationResults);
      }
    }
  };

  return (
    <UnifiedSettingsCard
      title="Therapeutic Parameters"
      description="MVC analysis settings and therapeutic thresholds for score computation"
      isOpen={isClinicalParametersOpen}
      onOpenChange={setIsClinicalParametersOpen}
      icon={<ActivityLogIcon className="h-5 w-5 text-green-600" />}
      accentColor="green-600"
      muted={!canEdit}
      badge={
        <div className="flex items-center gap-2">
          <TherapistBadge />
          {isDebugMode ? (
            <Badge variant="warning" className="text-xs">Debug Unlocked</Badge>
          ) : (
            <LockedBadge />
          )}
        </div>
      }
    >
      <TooltipProvider>
        <div className="space-y-6">
          {/* Session Goals Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TargetIcon className="h-4 w-4 text-green-600" />
                <h5 className="text-sm font-semibold text-gray-800">Session Goals</h5>
              </div>
            <div className="flex items-center gap-2">
              <SourceStatusBadge source="c3d" ok={false} />
            </div>
            </div>
            <Tooltip>
                <TooltipTrigger asChild>
                  <InfoCircledIcon className="h-4 w-4 text-gray-500" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    Define therapeutic targets for this session. These goals are used to calculate completion rates and overall performance metrics.
                  </p>
                <p className="text-xs text-slate-600 mt-1">Sourced from C3D (planned). Currently locked in production.</p>
                </TooltipContent>
              </Tooltip>
            
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Total Target Count</Label>
                  <Input
                    type="number"
                    value={sessionParams.session_expected_contractions ?? ''}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || null;
                      handleExpectedContractionsChange(value);
                    }}
                    placeholder="e.g., 24"
                    min="0" step="1"
                    disabled={true}
                    className="h-9 text-sm"
                  />
                  <p className="text-xs text-gray-600">Total contractions for this session</p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Distribution</Label>
                  <div className="h-9 px-3 py-2 bg-white border rounded-md text-sm text-slate-500">
                    Auto-split between muscles
                  </div>
                  <p className="text-xs text-gray-600">Automatically distributed equally</p>
                </div>
              </div>

              {/* Channel-specific breakdown */}
              {muscleChannels2.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-300">
                  <div className="grid grid-cols-2 gap-4">
                    {muscleChannels2.map((channel, index) => {
                      const expectedValue = index === 0 
                        ? sessionParams.session_expected_contractions_ch1
                        : sessionParams.session_expected_contractions_ch2;
                      
                      return (
                        <div key={channel} className="space-y-2">
                          <Label className="text-sm font-medium text-gray-700">
                            <MuscleNameDisplay channelName={channel} sessionParams={sessionParams} />
                          </Label>
                           <Input
                            type="number"
                            value={expectedValue ?? ''}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || null;
                              const fieldName = index === 0 
                                ? 'session_expected_contractions_ch1'
                                : 'session_expected_contractions_ch2';
                              
                              const updatedParams = {
                                ...sessionParams,
                                [fieldName]: value
                              };
                              
                              const ch1Value = index === 0 ? value : sessionParams.session_expected_contractions_ch1;
                              const ch2Value = index === 1 ? value : sessionParams.session_expected_contractions_ch2;
                              const newTotal = (ch1Value || 0) + (ch2Value || 0);
                              
                              if (ch1Value !== null && ch2Value !== null && newTotal > 0) {
                                updatedParams.session_expected_contractions = newTotal;
                              }
                              
                              setSessionParams(updatedParams);
                            }}
                            placeholder="e.g., 12"
                            min="0" step="1"
                             disabled={true}
                            className="h-9 text-sm"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* MVC Analysis Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <GearIcon className="h-4 w-4 text-green-600" />
              <h5 className="text-sm font-semibold text-gray-800">MVC Analysis Settings</h5>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoCircledIcon className="h-4 w-4 text-gray-500" />
                </TooltipTrigger>
                <TooltipContent className="max-w-md">
                  <div className="text-sm space-y-2">
                    <p>MVC values are computed from initial assessment sessions or imported from mobile app. These values represent the maximum voluntary contraction capacity for each muscle and are used to assess contraction quality.</p>
                    <p><strong>Note:</strong> MVC values are initialized from baseline game sessions and adapt via Dynamic Difficulty Algorithm (DDA) to maintain optimal therapeutic challenge. {isDebugMode && 'Values can be manually adjusted in debug mode for testing purposes.'}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            
            <div className="grid grid-cols-2 gap-4 p-4">
              {muscleChannels2.map((channel) => {
                // Get channel-specific MVC value or fallback to global MVC value
                const mvcValue = sessionParams.session_mvc_values?.[channel] || sessionParams.session_mvc_value || null;
                const thresholdValue = sessionParams.session_mvc_threshold_percentages?.[channel] ?? 
                                      sessionParams.session_mvc_threshold_percentage ?? 75;
                
                // Get backend-calculated actual threshold for validation
                const backendThreshold = analytics?.[channel]?.mvc_threshold_actual_value;
                const estimationMethod = analytics?.[channel]?.mvc_estimation_method;
                
                // Calculate frontend threshold for comparison
                const frontendThreshold = mvcValue !== null && mvcValue !== undefined ? 
                  mvcValue * (thresholdValue / 100) : null;
                
                // Check for consistency
                const isConsistent = backendThreshold !== null && frontendThreshold !== null ? 
                  Math.abs(backendThreshold - frontendThreshold) < 0.000001 : // Small tolerance for floating point
                  backendThreshold === frontendThreshold;
                
                return (
                  <div key={channel} className="space-y-3">
                    <h6 className="text-sm font-semibold text-gray-800">
                      <MuscleNameDisplay channelName={channel} sessionParams={sessionParams} />
                    </h6>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm font-medium text-gray-700">MVC Value</Label>
                        {canEdit ? (
                          <Input
                            type="number"
                            value={mvcValue ?? ''}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || null;
                              setSessionParams({
                                ...sessionParams,
                                session_mvc_values: {
                                  ...(sessionParams.session_mvc_values || {}),
                                  [channel]: value
                                }
                              });
                            }}
                            placeholder="0.0012"
                            step="0.0001"
                            min="0"
                            disabled={!canEdit}
                            className="h-9 text-sm"
                          />
                        ) : (
                          <div className="h-9 px-3 py-2 bg-white border rounded-md text-sm text-slate-500">
                            {mvcValue !== undefined && mvcValue !== null ? `${mvcValue.toExponential(3)} mV` : 'No data loaded'}
                          </div>
                        )}
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Threshold %</Label>
                        <Input
                          type="number"
                          value={thresholdValue}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 75;
                            setSessionParams({
                              ...sessionParams,
                              session_mvc_threshold_percentages: {
                                ...(sessionParams.session_mvc_threshold_percentages || {}),
                                [channel]: value
                              }
                            });
                          }}
                          min="0" max="100" step="0.1"
                          disabled={!canEdit}
                          className="h-9 text-sm"
                          placeholder="75.0"
                        />
                      </div>
                    </div>
                    
                    {/* Backend Validation Display */}
                    {(backendThreshold !== null && backendThreshold !== undefined) && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Backend Threshold:</span>
                          <span className="font-mono text-slate-800">{backendThreshold.toExponential(3)} mV</span>
                        </div>
                        {estimationMethod && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Method:</span>
                            <Badge variant={estimationMethod === 'backend_estimation' ? 'default' : 'outline'} className="text-xs">
                              {estimationMethod === 'backend_estimation' ? '🤖 Auto-estimated' : 
                               estimationMethod === 'user_provided' ? '👤 User-provided' : 
                               estimationMethod === 'global_provided' ? '🌐 Global' : 'Unknown'}
                            </Badge>
                          </div>
                        )}
                        {!isConsistent && frontendThreshold !== null && (
                          <div className="text-amber-600 text-xs">
                            ⚠️ Threshold mismatch: Frontend calculates {frontendThreshold.toExponential(3)} mV
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* MVC Service Integration Demo (Debug Mode Only) */}
          {isDebugMode && analytics && Object.keys(analytics).length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <GearIcon className="h-4 w-4 text-blue-600" />
                <h5 className="text-sm font-semibold text-gray-800">MVC Service Integration</h5>
                <Badge variant="outline" className="bg-blue-100 text-blue-800 text-xs">Debug Mode</Badge>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InfoCircledIcon className="h-4 w-4 text-gray-500" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-md">
                    <div className="text-sm space-y-2">
                      <p>MVC Service Integration allows you to apply backend-calculated MVC values directly to session parameters.</p>
                      <p><strong>This section is only visible in debug mode.</strong> In production, MVC values would be automatically applied from the backend service.</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Apply Backend MVC Values</p>
                      <p className="text-xs text-gray-600">Use MVC values calculated by the backend service</p>
                    </div>
                    <Button 
                      onClick={handleApplyAnalyticsMVC}
                      disabled={disabled || mvcService.isEstimating || !analytics}
                      variant="outline"
                      size="sm"
                      className="text-blue-700 border-blue-300 hover:bg-blue-100"
                    >
                      {mvcService.isEstimating ? '⏳ Processing...' : '🤖 Apply MVC Values'}
                    </Button>
                  </div>
                  
                  {/* Show current MVC service status */}
                  {mvcService.estimationResults && (
                    <div className="mt-3 p-3 bg-white rounded-lg text-xs space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="text-xs">✅ MVC Applied</Badge>
                      </div>
                      {Object.entries(mvcService.estimationResults).map(([channel, result]) => (
                        <div key={channel} className="flex items-center justify-between">
                          <span className="text-gray-600">{channel}:</span>
                          <div className="text-right">
                            <div className="font-mono text-gray-800">{mvcService.formatMVCValue(result.mvc_value)}</div>
                            <div className="text-gray-500">{mvcService.getEstimationMethodName(result.estimation_method)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {mvcService.error && (
                    <div className="mt-3 p-3 bg-red-50 rounded-lg text-xs">
                      <div className="text-red-600">❌ Error: {mvcService.error}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Duration Thresholds Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <GearIcon className="h-4 w-4 text-green-600" />
              <h5 className="text-sm font-semibold text-gray-800">Duration Thresholds</h5>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoCircledIcon className="h-4 w-4 text-gray-500" />
                </TooltipTrigger>
                <TooltipContent className="max-w-md">
                  <div className="text-sm space-y-2">
                    <p>Configure muscle-specific minimum duration thresholds for therapeutic effectiveness. These values determine what constitutes a valid contraction duration for scoring purposes.</p>
                    <p><strong>Clinical Standards:</strong> Duration thresholds are now muscle-specific to optimize therapeutic outcomes. Default duration ≥2s adapts via Dynamic Difficulty Algorithm (3s→10s max). Different muscle groups may require different optimal durations based on fiber type composition and therapeutic goals. These parameters adapt dynamically based on GHOSTLY+ DDA clinical protocol.</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            
            <div className="grid grid-cols-2 gap-4 p-4">
              {muscleChannels2.map((channel) => {
                const durationValue = sessionParams.session_duration_thresholds_per_muscle?.[channel] ?? 2;
                
                return (
                  <div key={channel} className="space-y-3">
                    <h6 className="text-sm font-semibold text-gray-800">
                      <MuscleNameDisplay channelName={channel} sessionParams={sessionParams} />
                    </h6>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">Minimum Duration</Label>
                      <Input
                        type="number"
                        value={Math.round(durationValue * 1000)}
                        onChange={(e) => {
                          const valueMs = parseInt(e.target.value) || 2000;
                          const valueSeconds = valueMs / 1000;
                          setSessionParams({
                            ...sessionParams,
                            session_duration_thresholds_per_muscle: {
                              ...(sessionParams.session_duration_thresholds_per_muscle || {}),
                              [channel]: valueSeconds
                            }
                            // Removed global threshold update to maintain muscle independence
                          });
                        }}
                        min="250" max="10000" step="250"
                        disabled={!canEdit}
                        className="h-9 text-sm"
                      />
                      <p className="text-xs text-gray-600">{Math.round(durationValue * 1000)}ms ({(durationValue).toFixed(2)}s) • Independent per muscle • 250ms increments (default 2000ms)</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {canEdit && (
              <div className="mt-2">
                <Button variant="outline" size="sm" onClick={() => setSessionParams(prev => ({ ...prev }))}>
                  Force Recalculate (Debug)
                </Button>
              </div>
            )}
          </div>
        </div>
      </TooltipProvider>
    </UnifiedSettingsCard>
  );
};

export default TherapeuticParametersSettings; 