import React, { useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import UnifiedSettingsCard from './UnifiedSettingsCard';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LockedBadge, SourceStatusBadge, TherapistBadge } from "@/components/ui/StatusBadges";
import { ActivityLogIcon, InfoCircledIcon, TargetIcon, GearIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import MuscleNameDisplay from '@/components/shared/MuscleNameDisplay';
import { useMvcService } from '@/hooks/useMvcService';
import { useAuth } from '@/contexts/AuthContext';
import { MVCService } from '@/services/mvcService';
import SupabaseStorageService from '@/services/supabaseStorage';

interface TherapeuticParametersSettingsProps {
  muscleChannels: string[];
  disabled: boolean;
  isTherapistMode: boolean;
  analytics?: Record<string, any> | null; // Backend analytics data for threshold validation
  uploadedFileName?: string | null; // Current uploaded file name for MVC recalculation
}

const TherapeuticParametersSettings: React.FC<TherapeuticParametersSettingsProps> = ({ muscleChannels, disabled, isTherapistMode, analytics, uploadedFileName }) => {
  const { authState } = useAuth();
  const { sessionParams, setSessionParams } = useSessionStore();
  const [isClinicalParametersOpen, setIsClinicalParametersOpen] = useState(false);
  const [isFullRecalculating, setIsFullRecalculating] = useState(false);
  const [fullRecalcError, setFullRecalcError] = useState<string | null>(null);
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [calibrationFile, setCalibrationFile] = useState<File | null>(null);
  const [calibrationSource, setCalibrationSource] = useState<'current' | 'upload'>('current');
  // Editing unlocks only via Therapist Mode (demo access)
  const canEdit = isTherapistMode && !disabled;
  
  // MVC Service Integration
  const mvcService = useMvcService();
  
  const muscleChannels2 = muscleChannels.filter(ch => !ch.includes(' ')).slice(0, 2);

  // MVC Quality Validation Helper
  const getMVCQualityInfo = (channel: string) => {
    if (!analytics || !analytics[channel]) {
      return { hasData: false, quality: 'unknown', message: 'No MVC data available' };
    }

    const channelData = analytics[channel];
    const hasMvcData = channelData.mvc_threshold_actual_value && channelData.mvc_estimation_method;
    
    if (!hasMvcData) {
      return { hasData: false, quality: 'missing', message: 'MVC threshold not available' };
    }

    // Validate MVC estimation using service method
    const mockResult = {
      mvc_value: channelData.mvc_threshold_actual_value / 0.75, // Assume 75% threshold
      threshold_value: channelData.mvc_threshold_actual_value,
      threshold_percentage: 75,
      estimation_method: channelData.mvc_estimation_method,
      confidence_score: 0.8, // Default confidence
      metadata: {
        total_contractions: channelData.contraction_count || 0,
        good_contractions: channelData.good_contraction_count || 0
      },
      timestamp: new Date().toISOString()
    };

    const validation = MVCService.validateEstimation(mockResult);
    const qualityLevel = validation.isValid ? (validation.warnings.length === 0 ? 'excellent' : 'good') : 'poor';
    const message = validation.warnings.length > 0 ? validation.warnings[0] : 'MVC estimation looks good';

    return {
      hasData: true,
      quality: qualityLevel,
      message,
      confidenceScore: mockResult.confidence_score,
      estimationMethod: channelData.mvc_estimation_method,
      formattedValue: MVCService.formatThresholdValue(channelData.mvc_threshold_actual_value)
    };
  };

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
      
      // Debug: Log analytics structure to understand what's available
      console.log('🔍 Analytics data structure:', analytics);
      Object.entries(analytics).forEach(([channel, channelData]) => {
        console.log(`📊 ${channel} analytics:`, {
          mvc_threshold_actual_value: channelData.mvc_threshold_actual_value,
          mvc_estimation_method: channelData.mvc_estimation_method,
          contraction_count: channelData.contraction_count,
          hasAllRequiredFields: !!(channelData.mvc_threshold_actual_value && channelData.mvc_estimation_method)
        });
      });
      
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

  // Handler to show calibration confirmation modal
  const handleShowCalibrationModal = () => {
    console.log('🔍 Debug button state:', {
      uploadedFileName,
      disabled,
      isFullRecalculating,
      hasFile: !!uploadedFileName,
      canProceed: !disabled && !isFullRecalculating
    });
    
    if (!uploadedFileName) {
      setFullRecalcError('No C3D file available for calibration');
      return;
    }
    setShowCalibrationModal(true);
  };

  // Handler for file upload in calibration modal
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.c3d')) {
      setCalibrationFile(file);
      setFullRecalcError(null);
    } else if (file) {
      setFullRecalcError('Please select a valid C3D file');
    }
  };

  // Handler for confirmed full MVC recalculation from C3D file
  const handleConfirmedFullRecalculation = async () => {
    let fileToUse: File | null = null;
    let fileName: string = '';

    // Determine which file to use based on calibration source
    if (calibrationSource === 'upload') {
      if (!calibrationFile) {
        setFullRecalcError('Please select a C3D file for calibration');
        return;
      }
      fileToUse = calibrationFile;
      fileName = calibrationFile.name;
    } else {
      // Use current file
      if (!uploadedFileName) {
        setFullRecalcError('No current C3D file available for calibration');
        return;
      }
      try {
        console.log('📥 Downloading current file from storage:', uploadedFileName);
        const fileBlob = await SupabaseStorageService.downloadFile(uploadedFileName);
        fileToUse = new File([fileBlob], uploadedFileName, { type: 'application/octet-stream' });
        fileName = uploadedFileName;
      } catch (error) {
        setFullRecalcError(`Failed to download current file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return;
      }
    }

    setShowCalibrationModal(false); // Close modal first
    setIsFullRecalculating(true);
    setFullRecalcError(null);

    try {
      console.log('🚀 Starting MVC calibration from C3D file:', fileName);

      // Call the backend /mvc/calibrate endpoint with the selected file
      const response = await MVCService.calibrate(fileToUse, {
        user_id: authState.user?.id,
        session_id: 'current-session',
        threshold_percentage: 75 // Default threshold percentage
      });

      if (response.status === 'success' && response.mvc_estimations) {
        console.log('✅ MVC recalculation successful:', response);

        // Convert the response to session parameters format
        const sessionUpdate = MVCService.convertToSessionParameters(response.mvc_estimations);

        // Apply the new MVC values to session
        setSessionParams({
          ...sessionParams,
          ...sessionUpdate
        });

        // Update MVC service state for display
        const extractedResults = Object.entries(response.mvc_estimations).reduce((acc, [channel, estimation]) => {
          acc[channel] = {
            mvc_value: estimation.mvc_value,
            threshold_value: estimation.threshold_value,
            threshold_percentage: estimation.threshold_percentage,
            estimation_method: estimation.estimation_method,
            confidence_score: estimation.confidence_score,
            metadata: estimation.metadata,
            timestamp: estimation.timestamp
          };
          return acc;
        }, {} as Record<string, any>);

        // Trigger UI update by calling mvcService methods
        mvcService.extractFromAnalysis({ 
          analytics: Object.fromEntries(
            Object.entries(extractedResults).map(([channel, result]) => [
              channel, 
              { 
                mvc_threshold_actual_value: result.threshold_value,
                mvc_estimation_method: result.estimation_method 
              }
            ])
          ),
          timestamp: new Date().toISOString()
        } as any);

        console.log('🎯 Applied new MVC values from full recalculation');
        
      } else {
        throw new Error(response.error || 'Unknown error in MVC estimation');
      }

    } catch (error) {
      console.error('❌ Full MVC recalculation failed:', error);
      setFullRecalcError(error instanceof Error ? error.message : 'Failed to recalculate MVC values');
    } finally {
      setIsFullRecalculating(false);
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
          {!isTherapistMode && <LockedBadge />}
          {isTherapistMode && (
            <Badge variant="warning" className="text-xs">Demo (C3D)</Badge>
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
                    <p><strong>Note:</strong> MVC values are initialized from baseline game sessions and adapt via Dynamic Difficulty Algorithm (DDA) to maintain optimal therapeutic challenge. {isTherapistMode && 'Values can be manually adjusted in therapist mode for demonstration purposes.'}</p>
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

                    {/* MVC Quality Validation */}
                    {(() => {
                      const qualityInfo = getMVCQualityInfo(channel);
                      if (!qualityInfo.hasData) {
                        return (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg border-l-4 border-gray-300">
                            <div className="flex items-center gap-2">
                              <ExclamationTriangleIcon className="h-4 w-4 text-gray-500" />
                              <span className="text-sm text-gray-600">{qualityInfo.message}</span>
                            </div>
                          </div>
                        );
                      }

                      const qualityColors = {
                        excellent: 'border-green-400 bg-green-50',
                        good: 'border-blue-400 bg-blue-50',
                        poor: 'border-red-400 bg-red-50'
                      };

                      const qualityIcons = {
                        excellent: '🟢',
                        good: '🟡',
                        poor: '🔴'
                      };

                      return (
                        <div className={`mt-3 p-3 rounded-lg border-l-4 ${qualityColors[qualityInfo.quality as keyof typeof qualityColors]}`}>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{qualityIcons[qualityInfo.quality as keyof typeof qualityIcons]}</span>
                                <span className="text-sm font-medium">
                                  MVC Quality: {qualityInfo.quality.charAt(0).toUpperCase() + qualityInfo.quality.slice(1)}
                                </span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {MVCService.getConfidenceLevelName(qualityInfo.confidenceScore || 0.8)}
                              </Badge>
                            </div>
                            <div className="text-xs text-gray-600">
                              {qualityInfo.message}
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-500">Method:</span>
                              <span className="font-mono">
                                {MVCService.getEstimationMethodName(qualityInfo.estimationMethod || 'unknown')}
                              </span>
                            </div>
                            {qualityInfo.formattedValue && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-500">Threshold:</span>
                                <span className="font-mono">{qualityInfo.formattedValue}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>

          {/* MVC Recalculation Section - Simplified UX */}
          {/* Show if MVC values are hardcoded OR if analytics exist (regardless of MVC content) */}
          {(sessionParams.session_mvc_values?.['CH1'] === 0.00015 || 
            sessionParams.session_mvc_values?.['CH2'] === 0.00015 ||
            sessionParams.session_mvc_value === 0.00015 ||
            (analytics && Object.keys(analytics).length > 0)) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ActivityLogIcon className="h-4 w-4 text-amber-600" />
                <h5 className="text-sm font-semibold text-gray-800">MVC Calibration</h5>
                {(sessionParams.session_mvc_values?.['CH1'] === 0.00015 || 
                  sessionParams.session_mvc_values?.['CH2'] === 0.00015 ||
                  sessionParams.session_mvc_value === 0.00015) && (
                  <Badge variant="destructive" className="text-xs">Action Required</Badge>
                )}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoCircledIcon className="h-4 w-4 text-gray-500" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    Maximum Voluntary Contraction values need calibration for accurate therapeutic assessment.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            {/* Simplified Status Display */}
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="space-y-3">
                {/* Show simplified status based on what's available */}
                {(() => {
                  const hasHardcodedValues = muscleChannels2.some(channel => 
                    sessionParams.session_mvc_values?.[channel] === 0.00015 || 
                    sessionParams.session_mvc_value === 0.00015
                  );

                  const hasMvcAnalytics = analytics && Object.entries(analytics).some(([_, channelData]) => 
                    channelData.mvc_threshold_actual_value != null && channelData.mvc_estimation_method
                  );

                  const hasAnalyticsButNoMvc = analytics && Object.keys(analytics).length > 0 && !hasMvcAnalytics;

                  if (hasHardcodedValues) {
                    return (
                      <div className="flex items-start gap-2">
                        <ExclamationTriangleIcon className="h-4 w-4 text-amber-600 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-amber-900">Default values detected</p>
                          <p className="text-amber-700 text-xs mt-1">
                            MVC thresholds are using default values. Recalibrate for personalized therapy.
                          </p>
                        </div>
                      </div>
                    );
                  } else if (hasMvcAnalytics) {
                    return (
                      <div className="flex items-start gap-2">
                        <InfoCircledIcon className="h-4 w-4 text-blue-600 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">MVC data available</p>
                          <p className="text-gray-600 text-xs mt-1">
                            Backend has calculated MVC values. Apply them to update session parameters.
                          </p>
                        </div>
                      </div>
                    );
                  } else if (hasAnalyticsButNoMvc) {
                    return (
                      <div className="flex items-start gap-2">
                        <InfoCircledIcon className="h-4 w-4 text-orange-600 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-orange-900">Analytics available, MVC estimation needed</p>
                          <p className="text-orange-700 text-xs mt-1">
                            {uploadedFileName 
                              ? "Backend didn't calculate MVC values. Try full recalculation from your C3D file."
                              : "Backend didn't calculate MVC values. Upload a C3D file to calculate them."
                            }
                          </p>
                        </div>
                      </div>
                    );
                  } else {
                    return null;
                  }
                })()}

                {/* Single action button based on context */}
                <div className="flex justify-end">
                  {(() => {
                    const hasMvcAnalytics = analytics && Object.entries(analytics).some(([_, channelData]) => 
                      channelData.mvc_threshold_actual_value != null && channelData.mvc_estimation_method
                    );

                    const hasAnalyticsButNoMvc = analytics && Object.keys(analytics).length > 0 && !hasMvcAnalytics;

                    if (hasMvcAnalytics) {
                      // Backend has MVC data - show apply button
                      return (
                        <Button 
                          onClick={handleApplyAnalyticsMVC}
                          disabled={disabled || mvcService.isEstimating}
                          variant="default"
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {mvcService.isEstimating ? (
                            <>
                              <span className="animate-spin mr-2">⏳</span>
                              Applying...
                            </>
                          ) : (
                            <>
                              <GearIcon className="w-3 h-3 mr-2" />
                              Apply MVC Data
                            </>
                          )}
                        </Button>
                      );
                    } else if (hasAnalyticsButNoMvc || uploadedFileName) {
                      // Analytics exist but no MVC data, or file is available - show recalculation
                      return (
                        <Button 
                          onClick={handleShowCalibrationModal}
                          disabled={disabled || isFullRecalculating}
                          variant="default"
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          {isFullRecalculating ? (
                            <>
                              <span className="animate-spin mr-2">⏳</span>
                              Calculating...
                            </>
                          ) : (
                            <>
                              <ActivityLogIcon className="w-3 h-3 mr-2" />
                              Calibrate MVC
                            </>
                          )}
                        </Button>
                      );
                    } else {
                      // No file available
                      return (
                        <p className="text-xs text-amber-600">Load a C3D file to calibrate MVC</p>
                      );
                    }
                  })()}
                </div>
              </div>
            </div>
            
            {/* Success message - shows after successful calibration */}
            {mvcService.estimationResults && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-start gap-2">
                  <Badge variant="default" className="text-xs bg-green-100 text-green-800 mt-0.5">✅</Badge>
                  <div className="text-sm">
                    <p className="font-medium text-green-900">MVC Successfully Calibrated</p>
                    <div className="text-xs text-green-700 mt-1">
                      {Object.entries(mvcService.estimationResults).map(([channel, result]) => (
                        <div key={channel} className="flex items-center gap-2">
                          <span><MuscleNameDisplay channelName={channel} sessionParams={sessionParams} />:</span>
                          <span className="font-mono">{mvcService.formatMVCValue(result.mvc_value)}</span>
                          <span className="text-green-600">({Math.round(result.confidence_score * 100)}% confidence)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Error display - simplified */}
            {(mvcService.error || fullRecalcError) && (
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-start gap-2">
                  <ExclamationTriangleIcon className="h-4 w-4 text-red-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-red-900">Calibration Error</p>
                    <p className="text-red-700 text-xs mt-1">
                      {mvcService.error || fullRecalcError}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

          {/* MVC Calibration Confirmation Modal */}
          <Dialog open={showCalibrationModal} onOpenChange={setShowCalibrationModal}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ActivityLogIcon className="w-5 h-5 text-amber-600" />
                  MVC Calibration
                </DialogTitle>
                <DialogDescription className="space-y-3 pt-2">
                  <p className="text-sm text-gray-700">
                    Choose a C3D file to calibrate MVC thresholds for personalized therapeutic assessment.
                  </p>
                  
                  <Tabs value={calibrationSource} onValueChange={(value) => setCalibrationSource(value as 'current' | 'upload')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="current">Current File</TabsTrigger>
                      <TabsTrigger value="upload">Upload File</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="current" className="space-y-3">
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-start gap-2">
                          <InfoCircledIcon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="text-sm">
                            <p className="font-medium text-blue-900">Current Session File</p>
                            <p className="text-blue-700 font-mono text-xs mt-1">
                              {uploadedFileName || 'No file available'}
                            </p>
                            <p className="text-blue-600 text-xs mt-2">
                              This session will be used as baseline to calculate personalized MVC values 
                              using the clinical algorithm (95th percentile method).
                            </p>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="upload" className="space-y-3">
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-start gap-2">
                          <InfoCircledIcon className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div className="text-sm">
                            <p className="font-medium text-green-900">Upload Calibration File</p>
                            <p className="text-green-600 text-xs mt-1">
                              Upload a different C3D file specifically for MVC calibration. 
                              This is useful when you have a dedicated baseline session.
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label htmlFor="calibration-file-upload" className="text-sm font-medium text-gray-700">
                          Select C3D File
                        </label>
                        <input
                          id="calibration-file-upload"
                          type="file"
                          accept=".c3d"
                          onChange={handleFileUpload}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        {calibrationFile && (
                          <p className="text-xs text-green-600">
                            Selected: {calibrationFile.name}
                          </p>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                  
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-start gap-2">
                      <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-900">Important</p>
                        <p className="text-amber-700 text-xs mt-1">
                          This calibration will replace default values (1.5e-4V) 
                          with personalized thresholds based on EMG data from the selected file.
                        </p>
                      </div>
                    </div>
                  </div>
                </DialogDescription>
              </DialogHeader>
              
              <DialogFooter className="gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowCalibrationModal(false)}
                  disabled={isFullRecalculating}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleConfirmedFullRecalculation}
                  disabled={isFullRecalculating || (calibrationSource === 'upload' && !calibrationFile)}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {isFullRecalculating ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Calibrating...
                    </>
                  ) : (
                    <>
                      <ActivityLogIcon className="w-4 h-4 mr-2" />
                      Confirm Calibration
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
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