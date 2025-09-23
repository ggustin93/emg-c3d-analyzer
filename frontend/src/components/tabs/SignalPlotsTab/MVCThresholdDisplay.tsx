/**
 * MVC Threshold Display Component
 * 
 * Visual MVC threshold display on top of EMG chart with:
 * - Comprehensive calculation tooltip with source transparency
 * - Integration with unified threshold system
 * - Clinical context display
 * 
 */

import React from 'react';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { InfoCircledIcon, TargetIcon, MixerHorizontalIcon, ActivityLogIcon, GearIcon, LightningBoltIcon, GlobeIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';
import { UnifiedThresholdData } from '@/hooks/useUnifiedThresholds';

interface MVCThresholdDisplayProps {
  unifiedThresholds: UnifiedThresholdData[];
  className?: string;
  compact?: boolean;
}

interface MVCSourceInfo {
  icon: React.ComponentType<any>;
  label: string;
  description: string;
  confidenceLevel: string;
  color: string;
  bgColor: string;
}

const MVC_SOURCE_INFO: Record<string, MVCSourceInfo> = {
  analytics: {
    icon: ActivityLogIcon,
    label: 'Backend Calibration',
    description: 'Automatically calibrated using clinical 95th percentile method from EMG signal analysis. The algorithm identifies peak muscle activity and calculates therapeutic thresholds.',
    confidenceLevel: 'Good',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200'
  },
  session_per_muscle: {
    icon: GearIcon,
    label: 'User Configured',
    description: 'Manually configured MVC value specific to this muscle - Verified by clinical expertise',
    confidenceLevel: 'Very High',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50 border-emerald-200'
  },
  session_global: {
    icon: GlobeIcon,
    label: 'Global Session',
    description: 'Global MVC value applied to all channels - General approximation for this session',
    confidenceLevel: 'Medium',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50 border-orange-200'
  },
  global_fallback: {
    icon: ExclamationTriangleIcon,
    label: 'System Fallback',
    description: 'Default fallback values - Consider manual configuration or backend estimation',
    confidenceLevel: 'Low',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50 border-yellow-200'
  },
  signal: {
    icon: LightningBoltIcon,
    label: 'Signal Estimation',
    description: 'MVC estimated directly from raw EMG signal characteristics',
    confidenceLevel: 'Good',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50 border-purple-200'
  }
};

/**
 * Utility functions for threshold formatting
 */
const formatThreshold = (value: number): string => {
  return value.toExponential(3);
};

const formatConfidence = (confidence: number): { label: string; color: string } => {
  if (confidence >= 0.8) return { label: 'High', color: 'text-emerald-600' };
  if (confidence >= 0.6) return { label: 'Good', color: 'text-cyan-600' };
  if (confidence >= 0.4) return { label: 'Medium', color: 'text-amber-600' };
  return { label: 'Low', color: 'text-red-600' };
};

/**
 * Professional MVC Threshold Display with calculation transparency
 */
export const MVCThresholdDisplay: React.FC<MVCThresholdDisplayProps> = ({
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
          <TargetIcon className="w-4 h-4" />
          <span className="font-medium">MVC Thresholds:</span>
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
                      {getShortLabel(threshold.muscleName)}: {formatThreshold(threshold.mvcThreshold)}V
                    </span>
                  </Badge>
                </TooltipTrigger>
                <MVCCalculationTooltip threshold={threshold} />
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
              <TargetIcon className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">MVC Thresholds</h3>
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
                          {formatThreshold(threshold.mvcThreshold)}V
                        </span>
                        <InfoCircledIcon className="w-3 h-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <MVCCalculationTooltip threshold={threshold} />
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
 * Comprehensive MVC Calculation Tooltip with professional transparency
 */
const MVCCalculationTooltip: React.FC<{ threshold: UnifiedThresholdData }> = ({ threshold }) => {
  const sourceInfo = MVC_SOURCE_INFO[threshold.source] || MVC_SOURCE_INFO.global_fallback;
  const confidenceInfo = formatConfidence(threshold.confidence);
  const IconComponent = sourceInfo.icon;

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
              <h4 className="font-medium text-sm text-foreground">MVC Calculation</h4>
              <p className="text-xs text-muted-foreground">{threshold.muscleName} ({threshold.channel})</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-3 space-y-3">
          {/* Calculation Formula */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TargetIcon className="w-3 h-3 text-muted-foreground" />
              <h5 className="font-medium text-xs text-foreground">Formula</h5>
            </div>
            
            <div className="font-mono text-xs bg-white px-3 py-2 rounded border text-center">
              <span className="text-muted-foreground">Threshold = </span>
              <span className="font-semibold text-foreground">
                {threshold.mvcBaseValue.toExponential(3)}V
              </span>
              <span className="text-muted-foreground"> × </span>
              <span className="font-semibold" style={{ color: threshold.color }}>{threshold.mvcPercentage}%</span>
              <span className="text-muted-foreground"> = </span>
              <span className="font-semibold" style={{ color: threshold.color }}>
                {threshold.mvcThreshold.toExponential(3)}V
              </span>
            </div>
          </div>

          {/* Data Source */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <IconComponent className="w-3 h-3 text-muted-foreground" />
              <h5 className="font-medium text-xs text-foreground">Source</h5>
            </div>
            
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Type:</span>
                <Badge variant="secondary" className="text-xs h-5">
                  {sourceInfo.label}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Confidence:</span>
                <span className={cn("text-xs font-medium", confidenceInfo.color)}>
                  {confidenceInfo.label} ({Math.round(threshold.confidence * 100)}%)
                </span>
              </div>
              
              <p className="text-xs text-muted-foreground leading-relaxed">
                {sourceInfo.description}
              </p>
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
                {threshold.mvcPercentage}% MVC threshold for therapeutic muscle activation assessment.
              </p>
            </div>
          </div>
        </div>
      </div>
    </TooltipContent>
  );
};

export default MVCThresholdDisplay;