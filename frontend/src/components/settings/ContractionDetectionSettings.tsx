import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { InfoCircledIcon, ActivityLogIcon, GearIcon } from '@radix-ui/react-icons';
import { ContractionDetectionParameters } from '@/types/emg';
import { useSessionStore } from '@/store/sessionStore';
import { DEFAULT_DETECTION_PARAMS } from '@/hooks/useEnhancedPerformanceMetrics';
import UnifiedSettingsCard from './UnifiedSettingsCard';

interface ParameterSliderProps {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  tooltip: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const DETECTION_PRESETS = {
  default: {
    threshold_factor: 0.3,
    min_duration_ms: 50,
    smoothing_window_ms: 25,
    merge_threshold_ms: 500,
    refractory_period_ms: 0,
    quality_threshold_ms: 2000,
    mvc_threshold_percentage: 75
  },
  sensitive: {
    threshold_factor: 0.2,
    min_duration_ms: 30,
    smoothing_window_ms: 20,
    merge_threshold_ms: 300,
    refractory_period_ms: 0,
    quality_threshold_ms: 1500,
    mvc_threshold_percentage: 75
  },
  conservative: {
    threshold_factor: 0.4,
    min_duration_ms: 80,
    smoothing_window_ms: 40,
    merge_threshold_ms: 800,
    refractory_period_ms: 100,
    quality_threshold_ms: 2500,
    mvc_threshold_percentage: 80
  }
};

const ParameterSlider: React.FC<ParameterSliderProps> = ({
  name,
  value,
  min,
  max,
  step,
  format,
  tooltip,
  onChange,
  disabled = false
}) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center">
      <Label className="flex items-center gap-2">
        {name}
        <Tooltip>
          <TooltipTrigger>
            <InfoCircledIcon className="h-3 w-3" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </Label>
      <span className="text-sm font-medium min-w-16 text-right">
        {format(value)}
      </span>
    </div>
    <Slider
      value={[value]}
      onValueChange={([v]) => onChange(v)}
      min={min}
      max={max}
      step={step}
      className="w-full"
      disabled={disabled}
    />
  </div>
);

const ContractionDetectionSettings: React.FC = () => {
  const { sessionParams, setSessionParams } = useSessionStore();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const params = sessionParams.contraction_detection || DEFAULT_DETECTION_PARAMS;
  
  const updateParam = (key: keyof ContractionDetectionParameters, value: number) => {
    const newParams = {
      ...params,
      [key]: value
    };
    
    setSessionParams({
      ...sessionParams,
      contraction_detection: newParams
    });
  };

  const applyPreset = (presetName: keyof typeof DETECTION_PRESETS) => {
    const preset = DETECTION_PRESETS[presetName];
    setSessionParams({
      ...sessionParams,
      contraction_detection: preset
    });
  };

  const resetToDefaults = () => {
    setSessionParams({
      ...sessionParams,
      contraction_detection: DEFAULT_DETECTION_PARAMS
    });
  };

  const getImpactDescription = (params: ContractionDetectionParameters) => {
    const sensitivity = params.threshold_factor < 0.25 ? 'High sensitivity' : 
                      params.threshold_factor > 0.35 ? 'Low sensitivity' : 'Moderate sensitivity';
    
    const duration = params.min_duration_ms < 40 ? 'Detects brief contractions' : 'Filters short contractions';
    
    const merge = params.merge_threshold_ms > 400 ? 'Combines related contractions' : 'Keeps contractions separate';
    
    return { sensitivity, duration, merge };
  };

  const impact = getImpactDescription(params);

  return (
    <TooltipProvider>
      <UnifiedSettingsCard
        title="Quality Thresholds & Detection Parameters"
        description="Configure therapeutic quality thresholds and signal detection parameters"
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        icon={<ActivityLogIcon className="h-5 w-5 text-blue-500" />}
        accentColor="blue-500"
      >
        <div className="space-y-6">
          {/* Control Header */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Select onValueChange={(value) => {
                if (value !== 'custom') {
                  applyPreset(value as keyof typeof DETECTION_PRESETS);
                }
              }}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="sensitive">Sensitive</SelectItem>
                  <SelectItem value="conservative">Conservative</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? "Hide" : "Show"} Advanced
              </Button>
            </div>
          </div>
          {/* Paramètres modifiables */}
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700">Modifiable Quality Thresholds</h4>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-xs text-gray-500">Real-time scoring</span>
                </div>
              </div>
              <ParameterSlider
                name="Quality Threshold"
                value={params.quality_threshold_ms}
                min={500}
                max={5000}
                step={100}
                format={(v) => `${(v/1000).toFixed(1)}s`}
                tooltip="Adaptive quality threshold for rehabilitation. Patient-specific threshold that adapts as patient improves. Changes update scores in real-time."
                onChange={(v) => updateParam('quality_threshold_ms', v)}
              />
              
              <ParameterSlider
                name="MVC Threshold"
                value={params.mvc_threshold_percentage}
                min={50}
                max={100}
                step={5}
                format={(v) => `${v}%`}
                tooltip="Minimum percentage of Maximum Voluntary Contraction (MVC) required for therapeutic effectiveness. Higher values ensure adequate muscle activation for rehabilitation. Changes update scores in real-time."
                onChange={(v) => updateParam('mvc_threshold_percentage', v)}
              />
            </div>
            
            <div className="space-y-3 pt-4 border-t">
              <h4 className="text-sm font-medium text-gray-500">Detection Parameters (Backend processed)</h4>
              <ParameterSlider
                name="Detection Threshold"
                value={params.threshold_factor}
                min={0.1}
                max={0.5}
                step={0.05}
                format={(v) => `${(v * 100).toFixed(0)}%`}
                tooltip="Percentage of maximum signal amplitude to trigger detection. Lower = more sensitive, Higher = fewer detections (Backend processed)"
                onChange={(v) => updateParam('threshold_factor', v)}
                disabled={true}
              />
            </div>
          </div>
          
          {/* Paramètres avancés */}
          {showAdvanced && (
            <div className="space-y-4 pt-4 border-t">
              <h4 className="text-sm font-medium text-gray-500">Advanced Detection Parameters (Information Only)</h4>
              <Alert>
                <InfoCircledIcon className="h-4 w-4" />
                <AlertDescription>
                  <strong>Information only:</strong> These parameters are processed by the backend during C3D file analysis. 
                  They cannot be modified from the frontend but are shown for reference.
                </AlertDescription>
              </Alert>
              
              <ParameterSlider
                name="Minimum Duration"
                value={params.min_duration_ms}
                min={10}
                max={200}
                step={10}
                format={(v) => `${v}ms`}
                tooltip="Minimum duration for a valid contraction. Filters out brief spikes/noise (Backend processed)"
                onChange={(v) => updateParam('min_duration_ms', v)}
                disabled={true}
              />
              
              <ParameterSlider
                name="Merge Threshold"
                value={params.merge_threshold_ms}
                min={100}
                max={1000}
                step={100}
                format={(v) => `${v}ms`}
                tooltip="Maximum gap between contractions to merge them. Prevents splitting sustained contractions (Backend processed)"
                onChange={(v) => updateParam('merge_threshold_ms', v)}
                disabled={true}
              />
              
              <ParameterSlider
                name="Smoothing Window"
                value={params.smoothing_window_ms}
                min={10}
                max={100}
                step={5}
                format={(v) => `${v}ms`}
                tooltip="Signal smoothing window size. Reduces noise in detection (Backend processed)"
                onChange={(v) => updateParam('smoothing_window_ms', v)}
                disabled={true}
              />
              
              <ParameterSlider
                name="Refractory Period"
                value={params.refractory_period_ms}
                min={0}
                max={500}
                step={50}
                format={(v) => `${v}ms`}
                tooltip="Minimum time after contraction before detecting new one. 0 = disabled (Backend processed)"
                onChange={(v) => updateParam('refractory_period_ms', v)}
                disabled={true}
              />
            </div>
          )}
          
          {/* Impact preview */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-sm">Detection Impact Preview</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              <p>• Threshold: {impact.sensitivity}</p>
              <p>• Duration: {impact.duration}</p>
              <p>• Merge: {impact.merge}</p>
            </CardContent>
          </Card>
          
          {/* Bouton reset */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefaults}
            >
              Reset to Defaults
            </Button>
          </div>
        </div>
      </UnifiedSettingsCard>
    </TooltipProvider>
  );
};

export default ContractionDetectionSettings;