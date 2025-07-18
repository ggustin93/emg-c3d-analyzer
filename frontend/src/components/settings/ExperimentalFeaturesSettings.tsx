import React, { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ExclamationTriangleIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { useSessionStore } from '@/store/sessionStore';
import UnifiedSettingsCard from './UnifiedSettingsCard';

const ExperimentalFeaturesSettings: React.FC = () => {
  const { sessionParams, setSessionParams } = useSessionStore();
  const [isOpen, setIsOpen] = useState(false);
  
  const isExperimentalEnabled = sessionParams.experimental_features?.enabled || false;
  const allowGameScoreWeight = sessionParams.experimental_features?.allow_game_score_weight || false;
  const allowDetectionParams = sessionParams.experimental_features?.allow_detection_params || false;

  const toggleExperimentalFeatures = (enabled: boolean) => {
    setSessionParams({
      ...sessionParams,
      experimental_features: {
        enabled,
        allow_game_score_weight: enabled ? allowGameScoreWeight : false,
        allow_detection_params: enabled ? allowDetectionParams : false
      }
    });
  };

  const updateExperimentalSetting = (key: string, value: boolean) => {
    setSessionParams({
      ...sessionParams,
      experimental_features: {
        ...sessionParams.experimental_features,
        enabled: isExperimentalEnabled,
        [key]: value
      }
    });
  };

  return (
    <UnifiedSettingsCard
      title="Experimental Features"
      description="Advanced features under development - use with caution in clinical settings"
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      icon={<ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />}
      accentColor="amber-500"
      badge={<Badge variant="secondary" className="text-xs">Advanced</Badge>}
    >
      <div className="space-y-4">
        <Alert>
          <InfoCircledIcon className="h-4 w-4" />
          <AlertDescription>
            Experimental features are under development and may not be suitable for clinical use.
            Use with caution and validate results independently.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="experimental-enabled" className="text-sm font-medium">
              Enable Experimental Features
            </Label>
            <Switch
              id="experimental-enabled"
              checked={isExperimentalEnabled}
              onCheckedChange={toggleExperimentalFeatures}
            />
          </div>

          {isExperimentalEnabled && (
            <div className="space-y-3 pl-4 border-l-2 border-amber-200">
              <div className="flex items-center justify-between">
                <Label htmlFor="game-score-weight" className="text-sm">
                  Allow Game Score Weight Adjustment
                </Label>
                <Switch
                  id="game-score-weight"
                  checked={allowGameScoreWeight}
                  onCheckedChange={(checked) => updateExperimentalSetting('allow_game_score_weight', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="detection-params" className="text-sm">
                  Allow Detection Parameters Modification
                </Label>
                <Switch
                  id="detection-params"
                  checked={allowDetectionParams}
                  onCheckedChange={(checked) => updateExperimentalSetting('allow_detection_params', checked)}
                />
              </div>

              <Alert className="text-xs">
                <ExclamationTriangleIcon className="h-3 w-3" />
                <AlertDescription>
                  <strong>Warning:</strong> These features may affect scoring accuracy and clinical validity.
                  Document any changes made and validate results with established methods.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </div>
    </UnifiedSettingsCard>
  );
};

export default ExperimentalFeaturesSettings;