/**
 * Clinical Guidance Component
 * 
 * Provides clinical context and actionable recommendations when EMG analysis fails,
 * explaining clinical requirements and offering solutions to users.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ExclamationTriangleIcon, 
  CheckCircledIcon,
  CrossCircledIcon,
  ClockIcon,
  InfoCircledIcon
} from '@radix-ui/react-icons';

interface ClinicalRequirements {
  min_duration_seconds: number;
  max_duration_seconds: number;
  min_samples_required: number;
  actual_samples: number;
  reason: string;
}

interface UserGuidance {
  primary_recommendation: string;
  secondary_recommendations: string[];
  technical_note: string;
}

interface ClinicalGuidanceProps {
  requirements: ClinicalRequirements;
  guidance: UserGuidance;
  currentDuration: number;
  className?: string;
}

export const ClinicalGuidance: React.FC<ClinicalGuidanceProps> = ({
  requirements,
  guidance,
  currentDuration,
  className
}) => {
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} seconds`;
    }
    return `${Math.floor(seconds / 60)} minutes`;
  };

  const getDurationStatus = (duration: number) => {
    if (duration < requirements.min_duration_seconds) {
      return { status: 'too_short', color: 'destructive', icon: CrossCircledIcon };
    } else if (duration > requirements.max_duration_seconds) {
      return { status: 'too_long', color: 'destructive', icon: CrossCircledIcon };
    } else {
      return { status: 'valid', color: 'default', icon: CheckCircledIcon };
    }
  };

  const durationStatus = getDurationStatus(currentDuration);
  const StatusIcon = durationStatus.icon;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
          <ExclamationTriangleIcon className="h-5 w-5" />
          Clinical Requirements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Clinical Requirements Overview */}
        <Alert>
          <InfoCircledIcon className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {requirements.reason}
          </AlertDescription>
        </Alert>

        {/* Duration Requirements */}
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <ClockIcon className="h-4 w-4" />
            Duration Requirements
          </h4>

          {/* Current vs Required Duration */}
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">Current Duration</span>
              <div className="flex items-center gap-2">
                <StatusIcon className={`h-4 w-4 ${durationStatus.color === 'destructive' ? 'text-destructive' : 'text-green-600'}`} />
                <Badge variant={durationStatus.color as any}>
                  {formatDuration(currentDuration)}
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <span className="text-sm font-medium text-green-800 dark:text-green-300">Required Range</span>
              <Badge variant="outline" className="border-green-600 text-green-700 dark:text-green-300">
                {formatDuration(requirements.min_duration_seconds)} - {formatDuration(requirements.max_duration_seconds)}
              </Badge>
            </div>
          </div>

          {/* Sample Count Information */}
          <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
            <div className="text-center p-2 bg-muted/30 rounded">
              <div className="font-medium text-destructive">Current Samples</div>
              <div>{requirements.actual_samples.toLocaleString()}</div>
            </div>
            <div className="text-center p-2 bg-muted/30 rounded">
              <div className="font-medium text-green-600">Required Minimum</div>
              <div>{requirements.min_samples_required.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Primary Recommendation */}
        <div className="space-y-2">
          <h4 className="font-semibold flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <InfoCircledIcon className="h-4 w-4" />
            Primary Solution
          </h4>
          
          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
            <InfoCircledIcon className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 dark:text-blue-300 font-medium">
              {guidance.primary_recommendation}
            </AlertDescription>
          </Alert>
        </div>

        {/* Secondary Recommendations */}
        <div className="space-y-2">
          <h4 className="font-semibold">Additional Steps</h4>
          <ul className="space-y-2">
            {guidance.secondary_recommendations.map((recommendation, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <CheckCircledIcon className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>{recommendation}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Why These Requirements Exist */}
        <div className="space-y-2">
          <h4 className="font-semibold">Clinical Background</h4>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Minimum Duration ({formatDuration(requirements.min_duration_seconds)}):</strong> 
              {' '}Required for reliable muscle activation pattern analysis and therapeutic assessment.
            </p>
            <p>
              <strong>Maximum Duration ({formatDuration(requirements.max_duration_seconds)}):</strong> 
              {' '}Prevents muscle fatigue artifacts that could compromise analysis accuracy.
            </p>
          </div>
        </div>

        {/* Technical Note */}
        {guidance.technical_note && (
          <>
            <Separator />
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">
                <strong>Technical Note:</strong> {guidance.technical_note}
              </p>
            </div>
          </>
        )}

        {/* Next Steps Summary */}
        <div className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950/20 dark:to-green-950/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <h4 className="font-semibold text-sm mb-2 text-blue-800 dark:text-blue-200">
            Quick Action Summary
          </h4>
          <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <p>1. Record EMG sessions between {formatDuration(requirements.min_duration_seconds)} and {formatDuration(requirements.max_duration_seconds)}</p>
            <p>2. Verify EMG sensors are connected and recording during gameplay</p>
            <p>3. Check GHOSTLY game settings for EMG data capture</p>
            <p>4. Try uploading the file again with longer EMG recordings</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClinicalGuidance;