import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { InfoCircledIcon, GearIcon, ExclamationTriangleIcon, StarIcon, HeartIcon } from '@radix-ui/react-icons';
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
    completion: 'Session Completion',
    mvcQuality: 'Muscle Activation Quality',
    qualityThreshold: 'Duration Quality',
    symmetry: 'Bilateral Balance',
    effort: 'Perceived Exertion',
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
  const [showGameScoreSettings, setShowGameScoreSettings] = useState(false);
  const [showClinicalParameters, setShowClinicalParameters] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const isEnhancedScoringEnabled = sessionParams.enhanced_scoring?.enabled || false;
  const isExperimentalEnabled = sessionParams.experimental_features?.enabled || false;
  const weights = sessionParams.enhanced_scoring?.weights || DEFAULT_SCORING_WEIGHTS;
  const gameNormalization = sessionParams.enhanced_scoring?.game_score_normalization || {
    algorithm: 'linear' as const,
    min_score: 0,
    max_score: 1000
  };

  const toggleEnhancedScoring = (enabled: boolean) => {
    setSessionParams({
      ...sessionParams,
      enhanced_scoring: {
        enabled,
        weights: enabled ? DEFAULT_SCORING_WEIGHTS : weights,
        game_score_normalization: gameNormalization
      }
    });
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
        enabled: isEnhancedScoringEnabled,
        weights: normalizedWeights,
        game_score_normalization: gameNormalization
      }
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
        enabled: isEnhancedScoringEnabled,
        weights,
        game_score_normalization: newNormalization
      }
    });
  };

  const resetToDefaults = () => {
    updateWeights(DEFAULT_SCORING_WEIGHTS);
  };

  const muscleChannels2 = muscleChannels.filter(ch => !ch.includes(' ')).slice(0, 2);

  if (!isEnhancedScoringEnabled) {
    return (
      <UnifiedSettingsCard
        title="Enhanced Performance Scoring"
        description="Enable advanced scoring system with weighted performance metrics"
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        icon={<StarIcon className="h-5 w-5 text-yellow-500" />}
        accentColor="yellow-500"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="enhanced-scoring-enable" className="text-sm font-medium">
              Enable Enhanced Scoring
            </Label>
            <Switch
              id="enhanced-scoring-enable"
              checked={false}
              onCheckedChange={toggleEnhancedScoring}
            />
          </div>
          <Alert>
            <InfoCircledIcon className="h-4 w-4" />
            <AlertDescription>
              Enable enhanced scoring to access weighted performance metrics with detailed component breakdown.
            </AlertDescription>
          </Alert>
        </div>
      </UnifiedSettingsCard>
    );
  }

  return (
    <TooltipProvider>
      <UnifiedSettingsCard
        title="Enhanced Performance Scoring"
        description="Advanced rehabilitation scoring system with weighted components for comprehensive therapeutic assessment"
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        icon={<StarIcon className="h-5 w-5 text-yellow-500" />}
        accentColor="yellow-500"
        badge={<Badge variant="outline" className="bg-green-100 text-green-800">Active</Badge>}
      >
        <div className="space-y-6">
          {/* Activation toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="enhanced-scoring-toggle" className="text-sm font-medium">
              Enable Enhanced Scoring
            </Label>
            <Switch
              id="enhanced-scoring-toggle"
              checked={isEnhancedScoringEnabled}
              onCheckedChange={toggleEnhancedScoring}
            />
          </div>

          {/* Performance Equation */}
          <PerformanceEquation weights={weights} compact={false} />

          {/* Configuration des poids */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700">Scoring Weights Configuration</h4>
              <Select onValueChange={(value) => {
                if (value !== 'custom') {
                  applyPreset(value as keyof typeof SCORING_PRESETS);
                }
              }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default (Balanced)</SelectItem>
                  <SelectItem value="quality_focused">Quality Focused</SelectItem>
                  <SelectItem value="experimental_with_game">With Game Score</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            
            {Object.entries(weights)
              .filter(([key]) => key !== 'compliance') // Exclude compliance from weight configuration
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
                
                <Slider
                  value={[value * 100]}
                  onValueChange={([v]) => handleWeightChange(key as keyof ScoringWeights, v)}
                  min={0}
                  max={key === 'gameScore' ? 50 : 100}
                  step={5}
                  disabled={key === 'gameScore' && !isExperimentalEnabled}
                />
                
                {key === 'gameScore' && !isExperimentalEnabled && (
                  <p className="text-xs text-muted-foreground">
                    Enable experimental features to adjust game score weight
                  </p>
                )}
              </div>
            ))}
            
            {/* Paramètres de normalisation du score de jeu */}
            {weights.gameScore > 0 && (
              <Collapsible 
                open={showGameScoreSettings} 
                onOpenChange={setShowGameScoreSettings}
              >
                <CollapsibleTrigger className="text-sm underline">
                  Game Score Normalization Settings
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Min Expected Score</Label>
                      <Input
                        type="number"
                        value={gameNormalization.min_score}
                        onChange={(e) => updateGameNormalization('min_score', Number(e.target.value))}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Max Expected Score</Label>
                      <Input
                        type="number"
                        value={gameNormalization.max_score}
                        onChange={(e) => updateGameNormalization('max_score', Number(e.target.value))}
                        className="h-8"
                      />
                    </div>
                  </div>
                  <Alert className="text-xs">
                    <InfoCircledIcon className="h-3 w-3" />
                    <AlertDescription>
                      Contact GHOSTLY team for proper normalization parameters
                    </AlertDescription>
                  </Alert>
                </CollapsibleContent>
              </Collapsible>
            )}
            
            {/* Boutons d'action */}
            <div className="flex justify-end gap-2 pt-4">
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

          {/* Clinical Parameters Section */}
          {muscleChannels2.length > 0 && (
            <Collapsible 
              open={showClinicalParameters} 
              onOpenChange={setShowClinicalParameters}
            >
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900">
                <HeartIcon className="h-4 w-4 text-red-500" />
                Clinical Parameters
                <InfoCircledIcon className="h-3 w-3 text-gray-500" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 mt-4 p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-gray-700">MVC Analysis</h4>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InfoCircledIcon className="h-3 w-3 text-gray-500" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">
                        MVC values are computed from initial assessment sessions or imported from mobile app. These values represent the maximum voluntary contraction capacity for each muscle and are used to assess contraction quality.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {muscleChannels2.map((channel) => {
                    const mvcValue = sessionParams.session_mvc_values?.[channel];
                    const thresholdValue = sessionParams.session_mvc_threshold_percentages?.[channel] ?? 75;
                    
                    return (
                      <div key={channel} className="space-y-2">
                        <h5 className="text-sm font-medium">
                          <MuscleNameDisplay channelName={channel} sessionParams={sessionParams} />
                        </h5>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <Label className="text-xs text-slate-600">MVC Value</Label>
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
                                className="h-8 text-xs"
                              />
                            ) : (
                              <div className="h-8 px-3 py-2 bg-white border rounded-md text-xs text-slate-500">
                                {mvcValue ? `${mvcValue.toExponential(3)} mV` : 'Auto-computed'}
                              </div>
                            )}
                          </div>
                          <div>
                            <Label className="text-xs text-slate-600">Threshold</Label>
                            {isDebugMode ? (
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
                                className="h-8 text-xs"
                              />
                            ) : (
                              <div className="h-8 px-3 py-2 bg-white border rounded-md text-xs text-slate-500">
                                {thresholdValue}%
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {!isDebugMode && (
                  <Alert>
                    <InfoCircledIcon className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>Note:</strong> MVC values are automatically computed from C3D files, mobile app data, or shared database. Enable Debug Mode to manually adjust these values.
                    </AlertDescription>
                  </Alert>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </UnifiedSettingsCard>
    </TooltipProvider>
  );
};

export default ScoringWeightsSettings;