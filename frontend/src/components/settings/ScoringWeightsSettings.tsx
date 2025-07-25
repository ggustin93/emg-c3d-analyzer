import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { InfoCircledIcon, GearIcon, ExclamationTriangleIcon, TargetIcon, MixerHorizontalIcon } from '@radix-ui/react-icons';
import { ScoringWeights, GameScoreNormalization, EMGAnalysisResult } from '@/types/emg';
import { useSessionStore } from '@/store/sessionStore';
import { 
  DEFAULT_SCORING_WEIGHTS, 
  QUALITY_FOCUSED_WEIGHTS, 
  EXPERIMENTAL_WITH_GAME_WEIGHTS 
} from '@/hooks/useEnhancedPerformanceMetrics';
import UnifiedSettingsCard from './UnifiedSettingsCard';
import PerformanceEquation from '../sessions/performance/PerformanceEquation';
import { cn } from '@/lib/utils';

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
  isDebugMode?: boolean;
  analysisResult?: EMGAnalysisResult | null;
}

const ScoringWeightsSettings: React.FC<ScoringWeightsSettingsProps> = ({ 
  muscleChannels = [], 
  disabled = false,
  isDebugMode = false,
  analysisResult = null
}) => {
  const { sessionParams, setSessionParams } = useSessionStore();
  const [isPerformanceOpen, setIsPerformanceOpen] = useState(true);
  const [isGameNormalizationOpen, setIsGameNormalizationOpen] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<string>('custom');
  
  const isExperimentalEnabled = sessionParams.experimental_features?.enabled || false;
  const weights = sessionParams.enhanced_scoring?.weights || DEFAULT_SCORING_WEIGHTS;
  const gameNormalization = sessionParams.enhanced_scoring?.game_score_normalization || {
    algorithm: 'linear' as const,
    min_score: 0,
    max_score: 100
  };
  
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
    return sessionParams.contraction_duration_threshold_ms 
      ? sessionParams.contraction_duration_threshold_ms / 1000
      : 2.0;
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
    return sessionParams.contraction_duration_threshold_ms 
      ? (sessionParams.contraction_duration_threshold_ms / 1000).toFixed(1)
      : '2.0';
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
                <Select value={currentPreset} onValueChange={(value) => {
                  setCurrentPreset(value);
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
                      disabled={key === 'gameScore' && !isExperimentalEnabled && currentPreset !== 'custom'}
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
                    <div className="mt-4 p-3 bg-gray-50/30 rounded-lg border border-gray-200">
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
                                className="w-full [&>*:nth-child(1)>*:nth-child(1)]:bg-green-600 [&>*:nth-child(2)]:border-green-600"
                                disabled={disabled}
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
                            disabled={disabled}
                          >
                            Equal (33.3% each)
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateComplianceWeights({ completion: 0.5, intensity: 0.3, duration: 0.2 })}
                            className="text-xs h-6 px-2"
                            disabled={disabled}
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



        {/* Game Score Normalization - Always visible for configuration */}
        <UnifiedSettingsCard
            title="Game Score Normalization"
            description="Configure how raw game scores are normalized for performance calculation"
            isOpen={isGameNormalizationOpen}
            onOpenChange={setIsGameNormalizationOpen}
            icon={<MixerHorizontalIcon className="h-5 w-5 text-amber-600" />}
            accentColor="amber-600"
            badge={<Badge variant="outline" className="bg-amber-100 text-amber-800 text-xs">Optional</Badge>}
          >
            <div className="space-y-6">
              {/* Game Scoring Context from Research Team */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-amber-800">Game Scoring Mechanics</h4>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InfoCircledIcon className="h-4 w-4 text-amber-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md p-4">
                      <div className="space-y-3 text-xs">
                        <div>
                          <p className="font-semibold text-amber-900 mb-1">Current Game Scoring Systems:</p>
                        </div>
                        
                        <div className="space-y-2">
                          <div>
                            <p className="font-medium text-amber-800">🎯 Maze Game:</p>
                            <p>• Score = Stars collected - Enemy collision penalties</p>
                            <p>• 20 stars per level (mandatory collection)</p>
                            <p>• 2 enemies per level, 3-point penalty each</p>
                            <p>• <em>Indicates gameplay "smoothness/speed"</em></p>
                          </div>
                          
                          <div>
                            <p className="font-medium text-amber-800">🚀 Original Ghostly & Space Games:</p>
                            <p>• Different scoring mechanisms</p>
                            <p>• Originally gamification/fun elements</p>
                            <p>• <em>No direct correlation with exercise performance</em></p>
                          </div>
                        </div>
                        
                        <div className="pt-2 border-t border-amber-200">
                          <p className="font-medium text-amber-800 mb-1">Clinical Recommendation:</p>
                          <p>Set weight to <strong>0%</strong> unless game score directly correlates with therapeutic objectives. Future versions may redesign scoring to reflect contraction performance.</p>
                        </div>
                        
                        <div className="pt-1 text-xs text-amber-700 italic">
                          — Research insight from Katarina Kostkova, GHOSTLY+ Team
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                
                <Alert className="border-amber-200 bg-amber-50">
                  <ExclamationTriangleIcon className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-sm text-amber-800">
                    <strong>Clinical Context:</strong> Game scores vary significantly across GHOSTLY games and were originally designed as gamification elements, not exercise performance indicators. In Maze game, scores reflect gameplay smoothness (stars collected minus collision penalties), while other games use different mechanics. <strong>Recommendation:</strong> Set weight to 0% unless clinically relevant for your specific use case.
                  </AlertDescription>
                </Alert>
              </div>
              
              {/* Game Metadata from C3D */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-800">Game Metadata (from C3D)</h4>
                <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
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
                      disabled={disabled}
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
                      disabled={disabled}
                      className="h-9 text-sm"
                    />
                    <p className="text-xs text-gray-500">Expected maximum (typically 100)</p>
                  </div>
                </div>
              </div>
            </div>
          </UnifiedSettingsCard>
      </div>
    </TooltipProvider>
  );
};

export default ScoringWeightsSettings;