import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { InfoCircledIcon, GearIcon, ExclamationTriangleIcon, TargetIcon, HeartIcon, PersonIcon, MixIcon } from '@radix-ui/react-icons';
import { ScoringWeights, GameScoreNormalization } from '@/types/emg';
import { useSessionStore } from '@/store/sessionStore';
import { 
  DEFAULT_SCORING_WEIGHTS, 
  QUALITY_FOCUSED_WEIGHTS, 
  EXPERIMENTAL_WITH_GAME_WEIGHTS 
} from '@/hooks/useEnhancedPerformanceMetrics';
import UnifiedSettingsCard from './UnifiedSettingsCard';
import MuscleNameDisplay from '../MuscleNameDisplay';
import PerformanceEquation from '../sessions/performance/PerformanceEquation';

const SCORING_PRESETS = {
  default: DEFAULT_SCORING_WEIGHTS,
  quality_focused: QUALITY_FOCUSED_WEIGHTS,
  experimental_with_game: EXPERIMENTAL_WITH_GAME_WEIGHTS
};

const formatWeightName = (key: string): string => {
  const names: { [key: string]: string } = {
    compliance: 'Therapeutic Compliance',
    symmetry: 'Muscle Symmetry',
    effort: 'Subjective Effort',
    gameScore: 'Game Performance'
  };
  return names[key] || key;
};

interface ScoringWeightsSettingsProps {
  muscleChannels?: string[];
  disabled?: boolean;
  isDebugMode?: boolean;
}

const ScoringWeightsSettings: React.FC<ScoringWeightsSettingsProps> = ({ 
  muscleChannels = [], 
  disabled = false,
  isDebugMode = false 
}) => {
  const { sessionParams, setSessionParams } = useSessionStore();
  const [isPerformanceOpen, setIsPerformanceOpen] = useState(true);
  const [isClinicalParamsOpen, setIsClinicalParamsOpen] = useState(false);
  const [isExperimentalOpen, setIsExperimentalOpen] = useState(false);
  
  const isExperimentalEnabled = sessionParams.experimental_features?.enabled || false;
  const weights = sessionParams.enhanced_scoring?.weights || DEFAULT_SCORING_WEIGHTS;
  const gameNormalization = sessionParams.enhanced_scoring?.game_score_normalization || {
    algorithm: 'linear' as const,
    min_score: 0,
    max_score: 1000
  };
  
  // Compliance Score sub-component weights (default: equal weighting)
  const complianceWeights = (sessionParams.enhanced_scoring as any)?.compliance_weights || {
    completion: 1/3,    // Completion Rate
    intensity: 1/3,     // Intensity Rate (≥75% MVC)
    duration: 1/3       // Duration Rate (≥2s)
  };

  const updateWeights = (newWeights: ScoringWeights) => {
    // Normaliser pour que le total fasse 100%
    const total = Object.values(newWeights).reduce((sum, w) => sum + w, 0);
    const normalizedWeights = { ...newWeights };
    
    if (total > 0) {
      Object.keys(normalizedWeights).forEach(key => {
        normalizedWeights[key as keyof ScoringWeights] = 
          normalizedWeights[key as keyof ScoringWeights] / total;
      });
    }

    setSessionParams({
      ...sessionParams,
      enhanced_scoring: {
        enabled: true, // Always enabled now
        weights: normalizedWeights,
        game_score_normalization: gameNormalization,
        ...(complianceWeights && { compliance_weights: complianceWeights })
      } as any
    });
  };

  const handleWeightChange = (key: keyof ScoringWeights, value: number) => {
    const newWeights = { ...weights, [key]: value / 100 };
    updateWeights(newWeights);
  };

  const applyPreset = (presetName: keyof typeof SCORING_PRESETS) => {
    const preset = SCORING_PRESETS[presetName];
    updateWeights(preset);
  };

  const updateGameNormalization = (key: keyof GameScoreNormalization, value: any) => {
    const newNormalization = { ...gameNormalization, [key]: value };
    setSessionParams({
      ...sessionParams,
      enhanced_scoring: {
        enabled: true, // Always enabled now
        weights,
        game_score_normalization: newNormalization,
        ...(complianceWeights && { compliance_weights: complianceWeights })
      } as any
    });
  };

  const updateComplianceWeights = (newComplianceWeights: any) => {
    // Normalize to ensure they sum to 1
    const total = Object.values(newComplianceWeights).reduce((sum: number, w: any) => sum + w, 0);
    const normalizedWeights = { ...newComplianceWeights };
    
    if (total > 0) {
      Object.keys(normalizedWeights).forEach(key => {
        normalizedWeights[key] = normalizedWeights[key] / total;
      });
    }

    setSessionParams({
      ...sessionParams,
      enhanced_scoring: {
        enabled: true,
        weights,
        game_score_normalization: gameNormalization,
        ...(normalizedWeights && { compliance_weights: normalizedWeights })
      } as any
    });
  };

  const handleComplianceWeightChange = (key: string, value: number) => {
    const newWeights = { ...complianceWeights, [key]: value / 100 };
    updateComplianceWeights(newWeights);
  };

  const resetToDefaults = () => {
    updateWeights(DEFAULT_SCORING_WEIGHTS);
  };

  const muscleChannels2 = muscleChannels.filter(ch => !ch.includes(' ')).slice(0, 2);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* 🎯 Performance Scoring System - Always visible but collapsible */}
        <UnifiedSettingsCard
          title="🎯 Performance Scoring System"
          description="Mathematical model, component weights, and clinical parameters for performance assessment"
          isOpen={isPerformanceOpen}
          onOpenChange={setIsPerformanceOpen}
          icon={<TargetIcon className="h-5 w-5 text-blue-600" />}
          accentColor="blue-600"
          badge={isDebugMode ? <Badge variant="outline" className="bg-blue-100 text-blue-800">Debug Mode</Badge> : undefined}
        >
          <div className="space-y-6">
            {/* Mathematical Model Display */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <GearIcon className="h-4 w-4 text-blue-600" />
                <h4 className="text-sm font-semibold text-blue-900">Mathematical Model</h4>
              </div>
              <PerformanceEquation weights={weights} compact={false} />
            </div>

            {/* Component Weights Configuration */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-semibold text-gray-800">Component Weights</h4>
                <Select onValueChange={(value) => {
                  if (value !== 'custom') {
                    applyPreset(value as keyof typeof SCORING_PRESETS);
                  }
                }}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Preset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Research Default</SelectItem>
                    <SelectItem value="quality_focused">Compliance Focused</SelectItem>
                    <SelectItem value="experimental_with_game">Game Emphasized</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {Object.entries(weights)
                .filter(([key]) => ['compliance', 'symmetry', 'effort', 'gameScore'].includes(key)) // Only show the 4 main components
                .map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="flex items-center gap-2">
                      {formatWeightName(key)}
                      {key === 'gameScore' && (
                        <Badge variant="outline" className="text-xs">
                          Experimental
                        </Badge>
                      )}
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      {(value * 100).toFixed(0)}%
                    </span>
                  </div>
                  
                  {key === 'gameScore' && value > 0 && (
                    <Alert className="text-xs mb-2">
                      <ExclamationTriangleIcon className="h-3 w-3" />
                      <AlertDescription>
                        Game score normalization algorithm is under development. 
                        Use with caution in clinical settings.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="space-y-1">
                    <Slider
                      value={[value * 100]}
                      onValueChange={([v]) => handleWeightChange(key as keyof ScoringWeights, v)}
                      min={0}
                      max={key === 'gameScore' ? 50 : 100}
                      step={1}
                      disabled={key === 'gameScore' && !isExperimentalEnabled}
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>0%</span>
                      <span className="font-medium text-gray-700">{(value * 100).toFixed(0)}%</span>
                      <span>{key === 'gameScore' ? '50%' : '100%'}</span>
                    </div>
                  </div>
                  
                  {key === 'gameScore' && !isExperimentalEnabled && (
                    <p className="text-xs text-muted-foreground">
                      Enable experimental features to adjust game score weight
                    </p>
                  )}
                </div>
              ))}
              
              {/* Therapeutic Compliance Sub-Components - Always visible in debug */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h4 className="text-base font-semibold text-gray-800">Therapeutic Compliance Sub-Components</h4>
                    <InfoCircledIcon className="h-3 w-3 text-gray-500" />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const equalWeights = {
                        completion: 1/3,
                        intensity: 1/3,
                        duration: 1/3
                      };
                      updateComplianceWeights(equalWeights);
                    }}
                    className="text-xs h-7 px-2"
                  >
                    Reset to 1/3 each
                  </Button>
                </div>
                
                <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-sm text-gray-700 mb-3">
                    Configure the internal weighting of the Therapeutic Compliance score components. Default is equal weighting (33.3% each).
                  </div>
                  
                  {Object.entries(complianceWeights).map(([key, value]) => {
                    const numericValue = Number(value);
                    const componentNames = {
                      completion: 'Completion Rate',
                      intensity: 'Intensity Rate (≥75% MVC)',
                      duration: 'Duration Rate (≥2s)'
                    };
                    
                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label className="flex items-center gap-2 text-sm font-medium">
                            {componentNames[key as keyof typeof componentNames]}
                          </Label>
                          <span className="text-sm text-muted-foreground font-semibold">
                            {(numericValue * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="space-y-2">
                          <Slider
                            value={[numericValue * 100]}
                            onValueChange={([v]) => handleComplianceWeightChange(key, v)}
                            min={0}
                            max={100}
                            step={1}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>0%</span>
                            <span className="font-medium text-gray-700">{(numericValue * 100).toFixed(1)}%</span>
                            <span>100%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap gap-2 pt-3 border-t">
                    <span className="text-xs font-medium text-gray-600 mr-2">Quick presets:</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateComplianceWeights({ completion: 0.5, intensity: 0.3, duration: 0.2 })}
                      className="text-xs h-6 px-2"
                    >
                      Completion Focus (50/30/20)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateComplianceWeights({ completion: 0.2, intensity: 0.5, duration: 0.3 })}
                      className="text-xs h-6 px-2"
                    >
                      Intensity Focus (20/50/30)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateComplianceWeights({ completion: 0.25, intensity: 0.25, duration: 0.5 })}
                      className="text-xs h-6 px-2"
                    >
                      Duration Focus (25/25/50)
                    </Button>
                  </div>
                  
                  <Alert className="mt-3">
                    <InfoCircledIcon className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <strong>Clinical Note:</strong> Completion Rate ensures all exercises are done, 
                      Intensity Rate ensures therapeutic effectiveness (≥75% MVC), and Duration Rate 
                      ensures adequate muscle endurance training (≥2s holds).
                    </AlertDescription>
                  </Alert>
                </div>
              </div>

              {/* Clinical Parameters Section - Part of Performance Scoring */}
              {muscleChannels2.length > 0 && (
                <div className="border-t pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <HeartIcon className="h-4 w-4 text-red-600" />
                    <h4 className="text-base font-semibold text-gray-800">Clinical Parameters</h4>
                    <Badge variant="outline" className="bg-red-100 text-red-800 text-xs">Score Computation</Badge>
                    <InfoCircledIcon className="h-3 w-3 text-gray-500" />
                  </div>
                  
                  <div className="space-y-6">
                    {/* MVC Analysis Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <GearIcon className="h-4 w-4 text-red-600" />
                        <h5 className="text-sm font-semibold text-gray-800">MVC Analysis Settings</h5>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoCircledIcon className="h-4 w-4 text-gray-500" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-sm">
                              MVC values are computed from initial assessment sessions or imported from mobile app. These values represent the maximum voluntary contraction capacity for each muscle and are used to assess contraction quality.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 p-4 bg-red-50 rounded-lg border border-red-200">
                        {muscleChannels2.map((channel) => {
                          const mvcValue = sessionParams.session_mvc_values?.[channel];
                          const thresholdValue = sessionParams.session_mvc_threshold_percentages?.[channel] ?? 75;
                          
                          return (
                            <div key={channel} className="space-y-3">
                              <h6 className="text-sm font-semibold text-gray-800">
                                <MuscleNameDisplay channelName={channel} sessionParams={sessionParams} />
                              </h6>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-sm font-medium text-gray-700">MVC Value</Label>
                                  {isDebugMode ? (
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
                                      placeholder="Auto"
                                      step="0.0001"
                                      disabled={disabled}
                                      className="h-9 text-sm"
                                    />
                                  ) : (
                                    <div className="h-9 px-3 py-2 bg-white border rounded-md text-sm text-slate-500">
                                      {mvcValue ? `${mvcValue.toExponential(3)} mV` : 'Auto-computed'}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <Label className="text-sm font-medium text-gray-700">Threshold %</Label>
                                  <Input
                                    type="number"
                                    value={thresholdValue}
                                    onChange={(e) => {
                                      const value = parseInt(e.target.value) || 75;
                                      setSessionParams({
                                        ...sessionParams,
                                        session_mvc_threshold_percentages: {
                                          ...(sessionParams.session_mvc_threshold_percentages || {}),
                                          [channel]: value
                                        }
                                      });
                                    }}
                                    min="0" max="100"
                                    disabled={disabled}
                                    className="h-9 text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      <Alert>
                        <InfoCircledIcon className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          <strong>Note:</strong> MVC values are automatically computed from C3D files, mobile app data, or shared database. {isDebugMode && 'Values can be manually adjusted in debug mode for testing purposes.'}
                        </AlertDescription>
                      </Alert>
                    </div>

                    {/* Duration & Intensity Thresholds Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <GearIcon className="h-4 w-4 text-red-600" />
                        <h5 className="text-sm font-semibold text-gray-800">Duration & Intensity Thresholds</h5>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoCircledIcon className="h-4 w-4 text-gray-500" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-sm">
                              Configure the minimum duration and intensity thresholds for therapeutic effectiveness. These values determine what constitutes a valid contraction for scoring purposes.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      
                      <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">Minimum Duration (seconds)</Label>
                            <Input
                              type="number"
                              value={sessionParams.contraction_duration_threshold_ms ? (sessionParams.contraction_duration_threshold_ms / 1000) : 2}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 2;
                                setSessionParams({
                                  ...sessionParams,
                                  contraction_duration_threshold_ms: value * 1000
                                });
                              }}
                              min="0.5" max="10" step="0.5"
                              disabled={disabled}
                              className="h-9 text-sm"
                            />
                            <p className="text-xs text-gray-600">Minimum contraction duration for therapeutic effectiveness</p>
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">Minimum Intensity (% MVC)</Label>
                            <Input
                              type="number"
                              value={75} // Standard threshold
                              onChange={() => {}} // Read-only for now, could be made configurable
                              min="50" max="90" step="5"
                              disabled={true}
                              className="h-9 text-sm bg-gray-100"
                            />
                            <p className="text-xs text-gray-600">Standard therapeutic intensity threshold (≥75% MVC)</p>
                          </div>
                        </div>
                        
                        <Alert className="mt-3">
                          <InfoCircledIcon className="h-4 w-4" />
                          <AlertDescription className="text-sm">
                            <strong>Clinical Standards:</strong> Duration ≥2s ensures adequate muscle activation time, while intensity ≥75% MVC ensures therapeutic strength training benefit. These thresholds are based on GHOSTLY+ clinical protocol requirements.
                          </AlertDescription>
                        </Alert>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetToDefaults}
                >
                  Reset to Default
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset('quality_focused')}
                >
                  Quality Focus
                </Button>
              </div>
            </div>
          </div>
        </UnifiedSettingsCard>

        {/* 🧪 Experimental Features - Only show if experimental features are enabled */}
        {(weights.gameScore > 0 || isDebugMode) && (
          <UnifiedSettingsCard
            title="🧪 Experimental Features"
            description="Advanced features under development - use with caution in clinical settings"
            isOpen={isExperimentalOpen}
            onOpenChange={setIsExperimentalOpen}
            icon={<MixIcon className="h-5 w-5 text-amber-600" />}
            accentColor="amber-600"
            badge={<Badge variant="outline" className="bg-amber-100 text-amber-800">Experimental</Badge>}
          >
            <div className="space-y-4">
              <Alert className="border-amber-200 bg-amber-50">
                <ExclamationTriangleIcon className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm text-amber-800">
                  <strong>Warning:</strong> Game score normalization algorithm is under development. Use with caution in clinical settings.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <h4 className="text-base font-semibold text-gray-800">Game Score Normalization Settings</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Min Expected Score</Label>
                    <Input
                      type="number"
                      value={gameNormalization.min_score}
                      onChange={(e) => updateGameNormalization('min_score', Number(e.target.value))}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Max Expected Score</Label>
                    <Input
                      type="number"
                      value={gameNormalization.max_score}
                      onChange={(e) => updateGameNormalization('max_score', Number(e.target.value))}
                      className="h-9"
                    />
                  </div>
                </div>
                
                <Alert>
                  <InfoCircledIcon className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Contact GHOSTLY team for proper normalization parameters based on current difficulty adjustment algorithm.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          </UnifiedSettingsCard>
        )}
      </div>
    </TooltipProvider>
  );
};

export default ScoringWeightsSettings;