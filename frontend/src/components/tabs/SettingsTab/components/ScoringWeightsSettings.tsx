import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { TherapistBadge, LockedBadge } from '@/components/ui/StatusBadges';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { InfoCircledIcon, GearIcon, ExclamationTriangleIcon, TargetIcon, MixerHorizontalIcon, LockClosedIcon, PersonIcon } from '@radix-ui/react-icons';
import { ScoringWeights, GameScoreNormalization, EMGAnalysisResult } from '@/types/emg';

// RPE Mapping interface for researcher configuration
interface RPEMapping {
  optimal_range: number[];      // Default: [4, 5, 6] → 100%
  acceptable_range: number[];   // Default: [3, 7] → 80%
  suboptimal_range: number[];   // Default: [2, 8] → 60%
  poor_range: number[];         // Default: [0, 1, 9, 10] → 20%
  optimal_score: number;        // Default: 100.0
  acceptable_score: number;     // Default: 80.0
  suboptimal_score: number;     // Default: 60.0
  poor_score: number;           // Default: 20.0
}
import { useSessionStore } from '@/store/sessionStore';
import { 
  DEFAULT_SCORING_WEIGHTS, 
  QUALITY_FOCUSED_WEIGHTS, 
  EXPERIMENTAL_WITH_GAME_WEIGHTS 
} from '@/hooks/useEnhancedPerformanceMetrics';
import UnifiedSettingsCard from './UnifiedSettingsCard';
import PerformanceEquation from '@/components/tabs/PerformanceTab/components/PerformanceEquation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

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

const getVariableName = (key: string): React.ReactNode => {
  const variables = {
    compliance: <span className="text-green-600 font-mono italic">S<sub className="text-xs">compliance</sub></span>,
    symmetry: <span className="text-purple-600 font-mono italic">S<sub className="text-xs">symmetry</sub></span>,
    effort: <span className="text-red-600 font-mono italic">S<sub className="text-xs">effort</sub></span>,
    gameScore: <span className="text-gray-600 font-mono italic">S<sub className="text-xs">game</sub></span>
  };
  return variables[key as keyof typeof variables] || null;
};

interface ScoringWeightsSettingsProps {
  muscleChannels?: string[];
  disabled?: boolean;
  isTherapistMode?: boolean;
  analysisResult?: EMGAnalysisResult | null;
}

const ScoringWeightsSettings: React.FC<ScoringWeightsSettingsProps> = ({ 
  muscleChannels = [], 
  disabled = false,
  isTherapistMode = false,
  analysisResult = null
}) => {
  const { authState } = useAuth();
  const { sessionParams, setSessionParams } = useSessionStore();
  const [isPerformanceOpen, setIsPerformanceOpen] = useState(false);
  const [isGameNormalizationOpen, setIsGameNormalizationOpen] = useState(false);
  const [isRPEMappingOpen, setIsRPEMappingOpen] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<string>('custom');
  
  // Default RPE mapping matching metricsDefinitions.md specification
  const [rpeMapping, setRpeMapping] = useState<RPEMapping>({
    optimal_range: [4, 5, 6],
    acceptable_range: [3, 7],
    suboptimal_range: [2, 8],
    poor_range: [0, 1, 9, 10],
    optimal_score: 100.0,
    acceptable_score: 80.0,
    suboptimal_score: 60.0,
    poor_score: 20.0
  });
  
  const isExperimentalEnabled = sessionParams.experimental_features?.enabled || false;
  const weights = sessionParams.enhanced_scoring?.weights || DEFAULT_SCORING_WEIGHTS;
  
  // Calculate total of main components for display validation
  const calculateMainComponentsTotal = (weightsObj: ScoringWeights) => {
    const mainComponents = ['compliance', 'symmetry', 'effort', 'gameScore'] as const;
    return mainComponents.reduce((sum, key) => sum + (weightsObj[key] || 0), 0);
  };
  
  const mainTotal = calculateMainComponentsTotal(weights);
  const gameNormalization = sessionParams.enhanced_scoring?.game_score_normalization || {
    algorithm: 'linear' as const,
    min_score: 0,
    max_score: 100
  };
  const isGameWeightZero = (weights as any)?.gameScore === 0;

  // Role-based editability: Therapist (clinical_specialist) or admin; Debug Mode unlocks
  const canTherapistEdit = useMemo(() => {
    const role = authState?.profile?.role;
    return role === 'clinical_specialist' || role === 'admin';
  }, [authState?.profile?.role]);

  const canEdit = (isTherapistMode || canTherapistEdit) && !disabled;
  
  // Compliance Score sub-component weights (default: equal weighting)
  const complianceWeights = (sessionParams.enhanced_scoring as any)?.compliance_weights || {
    completion: 1/3,    // Completion Rate
    intensity: 1/3,     // Intensity Rate (≥75% MVC)
    duration: 1/3       // Duration Rate (muscle-specific threshold)
  };
  
  // Helper functions to calculate average thresholds
  const getAverageDurationThreshold = () => {
    const thresholds = sessionParams.session_duration_thresholds_per_muscle;
    if (thresholds && Object.keys(thresholds).length > 0) {
      const values = Object.values(thresholds).filter((val): val is number => typeof val === 'number');
      if (values.length > 0) {
        const average = values.reduce((sum, val) => sum + val, 0) / values.length;
        return average;
      }
    }
    // Fallback to global threshold in ms if present; otherwise default 2.0s
    if (sessionParams.contraction_duration_threshold_ms != null) {
      return sessionParams.contraction_duration_threshold_ms / 1000;
    }
    if (sessionParams.contraction_duration_threshold != null) {
      return sessionParams.contraction_duration_threshold / 1000;
    }
    return 2.0;
  };

  const getAverageMvcThreshold = () => {
    const thresholds = sessionParams.session_mvc_threshold_percentages;
    if (thresholds && Object.keys(thresholds).length > 0) {
      const values = Object.values(thresholds).filter((val): val is number => typeof val === 'number');
      if (values.length > 0) {
        const average = values.reduce((sum, val) => sum + val, 0) / values.length;
        return average;
      }
    }
    return sessionParams.session_mvc_threshold_percentage || 75;
  };

  // Get clinically appropriate duration threshold display
  const getDurationThresholdDisplay = () => {
    const thresholds = sessionParams.session_duration_thresholds_per_muscle;
    if (thresholds && Object.keys(thresholds).length > 0) {
      const values = Object.values(thresholds).filter((val): val is number => typeof val === 'number');
      const uniqueValues = Array.from(new Set(values));
      
      if (uniqueValues.length === 1) {
        // All muscles have same threshold
        return uniqueValues[0].toFixed(1);
      } else if (uniqueValues.length > 1) {
        // Different thresholds per muscle - show both average and range
        const avg = getAverageDurationThreshold();
        const min = Math.min(...uniqueValues).toFixed(1);
        const max = Math.max(...uniqueValues).toFixed(1);
        return `${avg.toFixed(1)} (${min}-${max})`;
      }
    }
    // Prefer explicit ms field when provided; otherwise use global threshold
    if (sessionParams.contraction_duration_threshold_ms != null) {
      return (sessionParams.contraction_duration_threshold_ms / 1000).toFixed(1);
    }
    if (sessionParams.contraction_duration_threshold != null) {
      return (sessionParams.contraction_duration_threshold / 1000).toFixed(1);
    }
    return '2.0';
  };

  // Get clinically appropriate MVC threshold display
  const getMvcThresholdDisplay = () => {
    const thresholds = sessionParams.session_mvc_threshold_percentages;
    if (thresholds && Object.keys(thresholds).length > 0) {
      const values = Object.values(thresholds).filter((val): val is number => typeof val === 'number');
      const uniqueValues = Array.from(new Set(values));
      
      if (uniqueValues.length === 1) {
        // All muscles have same threshold
        return Math.round(uniqueValues[0]);
      } else if (uniqueValues.length > 1) {
        // Different thresholds per muscle - show both average and range
        const avg = getAverageMvcThreshold();
        const min = Math.min(...uniqueValues);
        const max = Math.max(...uniqueValues);
        return `${Math.round(avg)} (${Math.round(min)}-${Math.round(max)})`;
      }
    }
    return sessionParams.session_mvc_threshold_percentage || 75;
  };

  const updateWeights = (newWeights: ScoringWeights) => {
    // Normalize only the main four scoring components to ensure they sum to 1.0
    const mainComponents = ['compliance', 'symmetry', 'effort', 'gameScore'] as const;
    const mainComponentsTotal = mainComponents.reduce((sum, key) => {
      return sum + (newWeights[key] || 0);
    }, 0);
    
    const normalizedWeights = { ...newWeights };
    
    if (mainComponentsTotal > 0) {
      // Normalize only the main four components
      mainComponents.forEach(key => {
        if (newWeights[key] !== undefined) {
          normalizedWeights[key] = newWeights[key] / mainComponentsTotal;
        }
      });
    } else {
      // Fallback: set equal weights if all are zero
      const equalWeight = 1 / mainComponents.length;
      mainComponents.forEach(key => {
        normalizedWeights[key] = equalWeight;
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
    // Automatically switch to custom when user manually adjusts weights
    setCurrentPreset('custom');
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

  const updateRPEMapping = (newMapping: RPEMapping) => {
    setRpeMapping(newMapping);
    // TODO: Send to backend when API routes are implemented
    // POST /api/scoring/rpe-mapping with therapist_id
    console.info('RPE Mapping updated (would save to database):', newMapping);
  };

  const resetRPEMappingToDefaults = () => {
    const defaultMapping: RPEMapping = {
      optimal_range: [4, 5, 6],
      acceptable_range: [3, 7],
      suboptimal_range: [2, 8],
      poor_range: [0, 1, 9, 10],
      optimal_score: 100.0,
      acceptable_score: 80.0,
      suboptimal_score: 60.0,
      poor_score: 20.0
    };
    updateRPEMapping(defaultMapping);
  };


  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* 🎯 Performance Scoring System - Always visible but collapsible */}
        <UnifiedSettingsCard
          title="Performance Scoring System"
          description="Mathematical model, component weights, and clinical parameters for performance assessment"
          isOpen={isPerformanceOpen}
          onOpenChange={setIsPerformanceOpen}
          icon={<TargetIcon className="h-5 w-5 text-blue-600" />}
          accentColor="blue-600"
          muted={!canEdit}
          badge={
            <div className="flex items-center gap-2">
              <TherapistBadge />
              {!canEdit && !isTherapistMode && <LockedBadge />}
              {isTherapistMode && (
                <Badge variant="warning" className="text-xs">Demo (C3D)</Badge>
              )}
            </div>
          }
        >
          <div className="space-y-6">
            {/* Performance Equation Display */}
            <div className="p-4">
              <PerformanceEquation weights={weights} compact={false} />
            </div>

            {/* Component Weights Configuration */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h4 className="text-base font-semibold text-gray-800">Component Weights</h4>
                  <Badge 
                    variant={Math.abs(mainTotal - 1.0) < 0.001 ? "outline" : "warning"}
                    className={cn(
                      "text-xs font-mono",
                      Math.abs(mainTotal - 1.0) < 0.001 
                        ? "bg-green-50 text-green-700 border-green-300" 
                        : "bg-orange-50 text-orange-700 border-orange-300"
                    )}
                  >
                    Total: {(mainTotal * 100).toFixed(1)}%
                  </Badge>
                </div>
                <Select value={currentPreset} onValueChange={(value) => {
                  setCurrentPreset(value);
                  if (value !== 'custom') {
                    applyPreset(value as keyof typeof SCORING_PRESETS);
                  }
                }}>
                  <SelectTrigger className="w-40" disabled={!canEdit}>
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
                .sort(([a], [b]) => {
                  // Put compliance first, then others in original order
                  const order = ['compliance', 'symmetry', 'effort', 'gameScore'];
                  return order.indexOf(a) - order.indexOf(b);
                })
                .map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="flex items-center gap-2">
                      {formatWeightName(key)}
                      <span className="ml-1">({getVariableName(key)})</span>
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
                      disabled={!canEdit || (key === 'gameScore' && !isExperimentalEnabled && currentPreset !== 'custom')}
                      className={cn(
                        "w-full",
                        key === 'compliance' && "[&>*:nth-child(1)>*:nth-child(1)]:bg-green-500 [&>*:nth-child(2)]:border-green-500",
                        key === 'symmetry' && "[&>*:nth-child(1)>*:nth-child(1)]:bg-purple-500 [&>*:nth-child(2)]:border-purple-500",
                        key === 'effort' && "[&>*:nth-child(1)>*:nth-child(1)]:bg-orange-500 [&>*:nth-child(2)]:border-orange-500",
                        key === 'gameScore' && "[&>*:nth-child(1)>*:nth-child(1)]:bg-cyan-500 [&>*:nth-child(2)]:border-cyan-500"
                      )}
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>0%</span>
                      <span className="font-medium text-gray-700">{(value * 100).toFixed(0)}%</span>
                      <span>{key === 'gameScore' ? '50%' : '100%'}</span>
                    </div>
                  </div>
                  
                  {key === 'gameScore' && !isExperimentalEnabled && currentPreset !== 'custom' && (
                    <p className="text-xs text-muted-foreground">
                      Select "Custom" preset or enable experimental features to adjust game score weight
                    </p>
                  )}
                  
                  {/* Sub-component weights for Therapeutic Compliance */}
                  {key === 'compliance' && (
                    <div className="mt-4 p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <GearIcon className="h-4 w-4 text-green-600" />
                        <h5 className="text-sm font-semibold text-green-800">Compliance Sub-Components</h5>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoCircledIcon className="h-4 w-4 text-green-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-sm">
                              Configure the internal weighting of therapeutic compliance components: completion rate, intensity rate (≥{getMvcThresholdDisplay()}% MVC), and duration rate (≥{getDurationThresholdDisplay()}s).
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      
                      <div className="space-y-3">
                        {Object.entries(complianceWeights).map(([subKey, subValue]) => {
                          const numericValue = Number(subValue);
                          const componentNames = {
                            completion: 'Completion Rate',
                            intensity: `Intensity Rate (≥${getMvcThresholdDisplay()}% MVC)`,
                            duration: `Duration Rate (≥${getDurationThresholdDisplay()}s)`
                          };
                          
                          return (
                            <div key={subKey} className="space-y-2">
                              <div className="flex justify-between items-center">
                                <Label className="text-xs font-medium text-green-700">
                                  {componentNames[subKey as keyof typeof componentNames]}
                                </Label>
                                <span className="text-xs text-green-600 font-semibold">
                                  {(numericValue * 100).toFixed(1)}%
                                </span>
                              </div>
                              <Slider
                                value={[numericValue * 100]}
                                onValueChange={([v]) => handleComplianceWeightChange(subKey, v)}
                                min={0}
                                max={100}
                                step={1}
                                className="w-full [&>*:nth-child(1)>*:nth-child(1)]:bg-gray-500 [&>*:nth-child(2)]:border-gray-500"
                                disabled={!canEdit}
                              />
                            </div>
                          );
                        })}
                        
                        <div className="flex gap-2 pt-2 border-t border-green-300">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateComplianceWeights({ completion: 1/3, intensity: 1/3, duration: 1/3 })}
                            className="text-xs h-6 px-2"
                            disabled={!canEdit}
                          >
                            Equal (33.3% each)
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateComplianceWeights({ completion: 0.5, intensity: 0.3, duration: 0.2 })}
                            className="text-xs h-6 px-2"
                            disabled={!canEdit}
                          >
                            Completion Focus
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}


              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetToDefaults}
                  disabled={!canEdit}
                >
                  Reset to Default
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset('quality_focused')}
                  disabled={!canEdit}
                >
                  Quality Focus
                </Button>
              </div>
            </div>
          </div>
        </UnifiedSettingsCard>



        {/* Game Score Normalization - Always visible for configuration */}
        <UnifiedSettingsCard
            title="Game Score Normalization"
            description="Normalization maps raw game points to a percentage (S_game) contributing to overall performance. It is level- and game-type specific. Disabled if S_game weight is 0%."
            isOpen={isGameNormalizationOpen}
            onOpenChange={setIsGameNormalizationOpen}
            icon={<MixerHorizontalIcon className="h-5 w-5 text-amber-600" />}
            accentColor="amber-600"
            muted={!canEdit || isGameWeightZero}
            badge={
              <div className="flex items-center gap-2">
                {(!canEdit || isGameWeightZero) && !isTherapistMode && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="bg-slate-100 text-slate-800 flex items-center gap-1">
                        <LockClosedIcon className="h-3.5 w-3.5" /> {isGameWeightZero ? 'Disabled' : 'Locked'}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">{isGameWeightZero ? 'Increase S_game weight to enable normalization editing.' : 'Therapist-only. Enable Demo Mode to edit temporarily.'}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {isTherapistMode && (
                  <Badge variant="warning" className="text-xs">Demo (C3D)</Badge>
                )}
              </div>
            }
          >
            <div className="space-y-6">
              
              {/* Game Metadata from C3D */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-800">Game Metadata (from C3D)</h4>
                <div className="grid grid-cols-2 gap-4 p-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-gray-600">Level</Label>
                    <div className="px-2 py-1 bg-white border rounded text-sm text-gray-700">
                      {analysisResult?.metadata?.level ? `Level ${analysisResult.metadata.level}` : 'No level data'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-gray-600">Points</Label>
                    <div className="px-2 py-1 bg-white border rounded text-sm text-gray-700">
                      {analysisResult?.metadata?.score !== undefined ? `${analysisResult.metadata.score} pts` : 'No score data'}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 italic">
                  Metadata extracted from C3D file during processing
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-800">Normalization Parameters</h4>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Min Score</Label>
                    <Input
                      type="number"
                      value={gameNormalization.min_score}
                      onChange={(e) => updateGameNormalization('min_score', Number(e.target.value))}
                      disabled={!canEdit || isGameWeightZero}
                      className="h-9 text-sm"
                    />
                    <p className="text-xs text-gray-500">Baseline (typically 0)</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Max Score</Label>
                    <Input
                      type="number"
                      value={gameNormalization.max_score}
                      onChange={(e) => updateGameNormalization('max_score', Number(e.target.value))}
                      disabled={!canEdit || isGameWeightZero}
                      className="h-9 text-sm"
                    />
                    <p className="text-xs text-gray-500">Expected maximum (typically 100)</p>
                  </div>
                </div>
              </div>
            </div>
          </UnifiedSettingsCard>

        {/* RPE Mapping Configuration - Researcher Role Only */}
        <UnifiedSettingsCard
          title="RPE Mapping Configuration"
          description="Configure Rating of Perceived Exertion (RPE) scoring ranges for subjective effort assessment. This affects how post-session RPE values are converted to effort scores (S_effort)."
          isOpen={isRPEMappingOpen}
          onOpenChange={setIsRPEMappingOpen}
          icon={<PersonIcon className="h-5 w-5 text-emerald-600" />}
          accentColor="emerald-600"
          muted={!canEdit}
          badge={
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs">
                Researcher
              </Badge>
              {!canEdit && !isTherapistMode && <LockedBadge />}
              {isTherapistMode && (
                <Badge variant="warning" className="text-xs">Demo (C3D)</Badge>
              )}
            </div>
          }
        >
          <div className="space-y-6">
            
            {/* Current RPE Scale Overview */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-800">Current RPE Scale (0-10)</h4>
              <div className="grid grid-cols-1 gap-3">
                
                {/* Optimal Range */}
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-emerald-800">Optimal (Comfortable Effort)</span>
                    <Badge className="bg-emerald-600 text-white text-xs">
                      {rpeMapping.optimal_score}%
                    </Badge>
                  </div>
                  <div className="text-sm text-emerald-700">
                    RPE: {rpeMapping.optimal_range.join(', ')}
                  </div>
                </div>

                {/* Acceptable Range */}
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-yellow-800">Acceptable (Slightly too easy/hard)</span>
                    <Badge className="bg-yellow-600 text-white text-xs">
                      {rpeMapping.acceptable_score}%
                    </Badge>
                  </div>
                  <div className="text-sm text-yellow-700">
                    RPE: {rpeMapping.acceptable_range.join(', ')}
                  </div>
                </div>

                {/* Suboptimal Range */}
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-orange-800">Suboptimal (Too easy/hard)</span>
                    <Badge className="bg-orange-600 text-white text-xs">
                      {rpeMapping.suboptimal_score}%
                    </Badge>
                  </div>
                  <div className="text-sm text-orange-700">
                    RPE: {rpeMapping.suboptimal_range.join(', ')}
                  </div>
                </div>

                {/* Poor Range */}
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-red-800">Poor (Way too easy/extremely hard)</span>
                    <Badge className="bg-red-600 text-white text-xs">
                      {rpeMapping.poor_score}%
                    </Badge>
                  </div>
                  <div className="text-sm text-red-700">
                    RPE: {rpeMapping.poor_range.join(', ')}
                  </div>
                </div>
              </div>
            </div>

            {/* Configuration Interface */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-800">Customize RPE Mapping</h4>
              
              {Object.entries(rpeMapping).map(([key, value]) => {
                if (key.endsWith('_range')) {
                  const rangeKey = key as keyof RPEMapping;
                  const scoreKey = key.replace('_range', '_score') as keyof RPEMapping;
                  const ranges = value as number[];
                  const score = rpeMapping[scoreKey] as number;
                  
                  const labels = {
                    optimal_range: 'Optimal Range',
                    acceptable_range: 'Acceptable Range', 
                    suboptimal_range: 'Suboptimal Range',
                    poor_range: 'Poor Range'
                  };
                  
                  const colors = {
                    optimal_range: 'emerald',
                    acceptable_range: 'yellow',
                    suboptimal_range: 'orange',
                    poor_range: 'red'
                  };
                  
                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label className="text-sm font-medium">
                          {labels[rangeKey as keyof typeof labels]}
                        </Label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Score:</span>
                          <Input
                            type="number"
                            value={score}
                            onChange={(e) => {
                              const newScore = Number(e.target.value);
                              updateRPEMapping({
                                ...rpeMapping,
                                [scoreKey]: newScore
                              });
                            }}
                            disabled={!canEdit}
                            className="w-16 h-6 text-xs"
                            min={0}
                            max={100}
                          />
                          <span className="text-xs text-gray-500">%</span>
                        </div>
                      </div>
                      <Input
                        type="text"
                        value={ranges.join(', ')}
                        onChange={(e) => {
                          const newRanges = e.target.value
                            .split(',')
                            .map(s => parseInt(s.trim()))
                            .filter(n => !isNaN(n) && n >= 0 && n <= 10);
                          updateRPEMapping({
                            ...rpeMapping,
                            [rangeKey]: newRanges
                          });
                        }}
                        disabled={!canEdit}
                        className="text-sm"
                        placeholder="e.g., 4, 5, 6"
                      />
                      <p className="text-xs text-gray-500">
                        Enter RPE values (0-10) separated by commas
                      </p>
                    </div>
                  );
                }
                return null;
              })}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetRPEMappingToDefaults}
                  disabled={!canEdit}
                >
                  Reset to Defaults
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // TODO: Save to database with API call
                    alert('RPE mapping would be saved to database (API not yet implemented)');
                  }}
                  disabled={!canEdit}
                >
                  Save Configuration
                </Button>
              </div>
            </div>

            {/* Clinical Note */}
            <Alert className="bg-blue-50 border-blue-200">
              <InfoCircledIcon className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-800">
                <strong>Clinical Note:</strong> RPE mapping changes affect how patient subjective effort is scored. 
                Ensure mappings align with your clinical protocols and patient population characteristics.
              </AlertDescription>
            </Alert>
          </div>
        </UnifiedSettingsCard>
      </div>
    </TooltipProvider>
  );
};

export default ScoringWeightsSettings;