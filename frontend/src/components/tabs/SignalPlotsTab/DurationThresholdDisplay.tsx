/**
 * Duration Threshold Display Component
 * 
 * Visual duration threshold display that:
 * - Complements MVC thresholds
 * - Provides calculation tooltip with clinical context
 * - Integrates with unified threshold system
 * - Matches MVC display design
 * 
 */

import React from 'react';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { InfoCircledIcon, ClockIcon, MixerHorizontalIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';
import { UnifiedThresholdData } from '@/hooks/useUnifiedThresholds';

interface DurationThresholdDisplayProps {
  unifiedThresholds: UnifiedThresholdData[];
  className?: string;
  compact?: boolean;
}

/**
 * Utility functions for threshold formatting
 */
const formatDuration = (ms: number): string => {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${ms}ms`;
};

/**
 * Duration Threshold Display with clinical transparency
 */
export const DurationThresholdDisplay: React.FC<DurationThresholdDisplayProps> = ({
  unifiedThresholds,
  className,
  compact = false
}) => {
  // Don't render if no thresholds available
  if (unifiedThresholds.length === 0) {
    return null;
  }

  const getShortLabel = (muscleName: string): string => {
    if (muscleName.toLowerCase().includes('left')) return 'L';
    if (muscleName.toLowerCase().includes('right')) return 'R';
    return muscleName.substring(0, 1).toUpperCase();
  };

  if (compact) {
    return (
      <div className={cn("flex items-center justify-center gap-3 py-3 px-4 bg-background border-b", className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ClockIcon className="w-4 h-4" />
          <span className="font-medium">Duration:</span>
        </div>
        <div className="flex items-center gap-2">
          {unifiedThresholds.map((threshold) => (
            <TooltipProvider key={threshold.channel}>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="outline" 
                    className="cursor-help hover:bg-accent transition-colors font-mono text-xs"
                    style={{ borderColor: threshold.color }}
                  >
                    <span style={{ color: threshold.color }} className="font-medium">
                      {getShortLabel(threshold.muscleName)}: {formatDuration(threshold.durationThreshold)}
                    </span>
                  </Badge>
                </TooltipTrigger>
                <DurationCalculationTooltip threshold={threshold} />
              </UITooltip>
            </TooltipProvider>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-card border-b", className)}>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <ClockIcon className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Duration Thresholds</h3>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {unifiedThresholds.map((threshold) => (
              <TooltipProvider key={threshold.channel}>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-md border hover:bg-accent/50 transition-colors cursor-help group">
                      <div className="flex items-center gap-1.5">
                        <div 
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: threshold.color }}
                        />
                        <span className="text-xs font-medium text-muted-foreground">
                          {threshold.muscleName}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <span 
                          className="text-sm font-mono font-semibold"
                          style={{ color: threshold.color }}
                        >
                          {formatDuration(threshold.durationThreshold)}
                        </span>
                        <InfoCircledIcon className="w-3 h-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <DurationCalculationTooltip threshold={threshold} />
                </UITooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Comprehensive Duration Calculation Tooltip with clinical transparency
 */
const DurationCalculationTooltip: React.FC<{ threshold: UnifiedThresholdData }> = ({ threshold }) => {
  return (
    <TooltipContent 
      side="bottom"
      sideOffset={8}
      align="center"
      className="w-80 p-0 overflow-hidden rounded-lg shadow-lg border"
    >
      <div>
        {/* Header */}
        <div className="bg-muted px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <MixerHorizontalIcon className="w-4 h-4 text-muted-foreground" />
            <div>
              <h4 className="font-medium text-sm text-foreground">Duration Threshold</h4>
              <p className="text-xs text-muted-foreground">{threshold.muscleName} ({threshold.channel})</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-3 space-y-3">
          {/* Threshold Value */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ClockIcon className="w-3 h-3 text-muted-foreground" />
              <h5 className="font-medium text-xs text-foreground">Minimum Duration</h5>
            </div>
            
            <div className="font-mono text-xs bg-white px-3 py-2 rounded border text-center">
              <span className="text-muted-foreground">Required ≥ </span>
              <span className="font-semibold" style={{ color: threshold.color }}>
                {formatDuration(threshold.durationThreshold)}
              </span>
              <span className="text-muted-foreground"> for valid contraction</span>
            </div>
          </div>

          {/* Clinical Context */}
          <div className="space-y-2 p-2 bg-muted/30 rounded">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="w-3 h-3 text-muted-foreground" />
              <h5 className="font-medium text-xs text-foreground">Clinical</h5>
            </div>
            
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="leading-relaxed">
                Minimum contraction duration for therapeutic effectiveness. Contractions shorter than this threshold are excluded from performance scoring.
              </p>
              <p className="leading-relaxed">
                <strong>Clinical Standard:</strong> Duration thresholds are muscle-specific to optimize therapeutic outcomes (2s-10s range).
              </p>
            </div>
          </div>
        </div>
      </div>
    </TooltipContent>
  );
};

export default DurationThresholdDisplay;