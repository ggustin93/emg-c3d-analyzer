import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';
import { 
  getComplianceTooltipData,
  completionRateTooltipData,
  intensityQualityTooltipData,
  getDurationQualityTooltipData,
  muscleSymmetryTooltipData,
  rpeScoreTooltipData,
  getGhostlyScoreTooltipData,
  getAppliedPressureTooltipData,
  getAOPTooltipData,
  type TooltipData,
  getOverallPerformanceScoreTooltipData,
  getWeightedScoreTooltipData
} from '@/data/tooltipData';

interface ClinicalTooltipProps {
  title: string;
  description?: string;
  sections?: Array<{
    title?: string;
    items: Array<{
      label?: string;
      value?: string | number;
      percentage?: string | number;
      color?: string;
      description?: string;
      icon?: React.ReactNode;
    }>;
    type?: 'list' | 'table' | 'formula';
  }>;
  children?: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  className?: string;
  triggerClassName?: string;
  variant?: 'default' | 'compact';
}

export const ClinicalTooltip: React.FC<ClinicalTooltipProps> = ({
  title,
  description,
  sections = [],
  children,
  side = 'top',
  align = 'center',
  className,
  triggerClassName,
  variant = 'default',
}) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children || (
            <InfoCircledIcon 
              className={cn(
                "h-4 w-4 text-gray-500 cursor-help hover:text-gray-700 transition-colors",
                triggerClassName
              )} 
            />
          )}
        </TooltipTrigger>
        <TooltipContent 
          side={side}
          align={align}
          className={cn(
            "max-w-sm w-auto p-4", // Simplified sizing
            className
          )}
        >
          <div>
            <p className={cn(
              "font-bold mb-2",
              variant === 'compact' ? "text-sm" : "text-base"
            )}>{title}</p>

            {description && (
              <p className={cn(
                "text-muted-foreground mb-3",
                variant === 'compact' ? "text-xs" : "text-sm"
              )}>{description}</p>
            )}

            <div className="space-y-3">
              {sections.map((section, idx) => (
                <div key={idx} className="border-t pt-3 first:border-t-0 first:pt-0">
                  {section.title && (
                    <h4 className={cn(
                      "font-semibold text-foreground mb-2",
                      variant === 'compact' ? "text-xs" : "text-sm"
                    )}>{section.title}</h4>
                  )}

                  {section.type === 'list' && (
                    <ul className={cn(
                      "space-y-2 text-muted-foreground list-disc pl-4",
                      variant === 'compact' ? "text-xs space-y-1" : "text-sm"
                    )}>
                      {section.items.map((item, itemIdx) => (
                        <li key={itemIdx}>
                          {item.label && <span className="font-medium text-foreground">{item.label}: </span>}
                          <span>{item.description}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  
                  {(section.type === 'table' || !section.type) && (
                    <div className={cn(
                      "space-y-1.5 text-foreground",
                      variant === 'compact' ? "text-xs" : "text-sm"
                    )}>
                      {section.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="flex items-center justify-between">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className={cn("font-semibold", item.color)}>
                            {item.value || item.percentage}
                            {item.percentage && '%'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {section.type === 'formula' && (
                     <div className={cn(
                      "bg-white rounded-md p-3 text-center border border-amber-200",
                      variant === 'compact' ? "text-sm p-2" : "text-base"
                    )}>
                      {section.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="font-serif italic text-muted-foreground">
                           {item.label && (
                            <span 
                              className={cn("font-bold text-lg mr-2 text-foreground", item.color)}
                              dangerouslySetInnerHTML={{ __html: String(item.label) }}
                            />
                          )}
                          <span 
                            className="font-medium" 
                            dangerouslySetInnerHTML={{ __html: String(item.value || '') }} 
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Data-driven tooltip renderer
export const DataDrivenTooltip: React.FC<{
  data: TooltipData;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  triggerClassName?: string;
  variant?: 'default' | 'compact';
  children?: React.ReactNode;
}> = ({ data, side = 'right', className, triggerClassName, variant = 'default', children }) => {
  return (
    <ClinicalTooltip
      title={data.title}
      description={data.description}
      sections={data.sections}
      side={side}
      className={className}
      triggerClassName={triggerClassName}
      variant={variant}
    >
      {children}
    </ClinicalTooltip>
  );
};

// Preset variants for common use cases (now using data constants)
export const ComplianceTooltip: React.FC<{
  side?: 'top' | 'right' | 'bottom' | 'left';
  children?: React.ReactNode;
  completionWeight?: number;
  intensityWeight?: number;
  durationWeight?: number;
  durationThreshold?: number;
}> = ({ 
  side = 'right', 
  children,
  completionWeight = 1/3,
  intensityWeight = 1/3,
  durationWeight = 1/3,
  durationThreshold = 2000
}) => {
  const data = getComplianceTooltipData(completionWeight, intensityWeight, durationWeight, durationThreshold);
  return <DataDrivenTooltip data={data} side={side} children={children} />;
};

// Preset for muscle compliance score gauge
export const MuscleComplianceScoreTooltip: React.FC<{
  contractionDurationThreshold?: number;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children?: React.ReactNode;
  completionWeight?: number;
  intensityWeight?: number;
  durationWeight?: number;
}> = ({ 
  contractionDurationThreshold = 2000, 
  side = 'top', 
  children,
  completionWeight = 1/3,
  intensityWeight = 1/3,
  durationWeight = 1/3
}) => {
  const completionPct = (completionWeight * 100).toFixed(1);
  const intensityPct = (intensityWeight * 100).toFixed(1);
  const durationPct = (durationWeight * 100).toFixed(1);
  
  return (
    <ClinicalTooltip
      title="Muscle Compliance Score"
      description="Calculated as weighted average of three quality metrics (weights are adjustable in settings)"
      sections={[
        {
          title: "Formula:",
          type: "formula",
          items: [
            { 
              label: "S", 
              value: ` = ${completionPct}%·R<sub>completion</sub> + ${intensityPct}%·R<sub>intensity</sub> + ${durationPct}%·R<sub>duration</sub>` 
            }
          ]
        },
        {
          title: "Components:",
          type: "list",
          items: [
            { label: "Completion", description: `${completionPct}% weight · Contractions done/expected (12)` },
            { label: "Intensity", description: `${intensityPct}% weight · Contractions ≥75% MVC` },
            { label: "Duration", description: `${durationPct}% weight · Contractions ≥${(contractionDurationThreshold / 1000).toFixed(1)}s (${contractionDurationThreshold}ms)` }
          ]
        }
      ]}
      side={side}
      children={children}
    />
  );
};

// Preset for completion rate
export const CompletionRateTooltip: React.FC<{
  side?: 'top' | 'right' | 'bottom' | 'left';
  children?: React.ReactNode;
}> = ({ side = 'top', children }) => (
  <DataDrivenTooltip
    data={completionRateTooltipData}
    side={side}
  >
    {children}
  </DataDrivenTooltip>
);

// Preset for intensity quality
export const IntensityQualityTooltip: React.FC<{
  side?: 'top' | 'right' | 'bottom' | 'left';
  children?: React.ReactNode;
}> = ({ side = 'top', children }) => (
  <DataDrivenTooltip
    data={intensityQualityTooltipData}
    side={side}
  >
    {children}
  </DataDrivenTooltip>
);

// Preset for duration quality
export const DurationQualityTooltip: React.FC<{
  contractionDurationThreshold?: number;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children?: React.ReactNode;
}> = ({ contractionDurationThreshold = 2000, side = 'top', children }) => {
  const data = getDurationQualityTooltipData(contractionDurationThreshold);
  
  return (
    <DataDrivenTooltip
      data={data}
      side={side}
    >
      {children}
    </DataDrivenTooltip>
  );
};

// Preset for Muscle Symmetry
export const MuscleSymmetryTooltip: React.FC<{
  side?: 'top' | 'right' | 'bottom' | 'left';
  children?: React.ReactNode;
}> = ({ side = 'top', children }) => (
  <DataDrivenTooltip
    data={muscleSymmetryTooltipData}
    side={side}
  >
    {children}
  </DataDrivenTooltip>
);

// Preset for RPE Score
export const RPEScoreTooltip: React.FC<{
  side?: 'top' | 'right' | 'bottom' | 'left';
  children?: React.ReactNode;
}> = ({ side = 'top', children }) => (
  <DataDrivenTooltip
    data={rpeScoreTooltipData}
    side={side}
  >
    {children}
  </DataDrivenTooltip>
);

// Preset for GHOSTLY Game Score
export const GHOSTLYScoreTooltip: React.FC<{
  gameScore?: number;
  gameLevel?: number;
  normalizedScore?: number;
  gameScoreWeight?: number; // Changed from showExperimental
  side?: 'top' | 'right' | 'bottom' | 'left';
  children?: React.ReactNode;
}> = ({ gameScore = 0, gameLevel, normalizedScore = 0, gameScoreWeight = 0, side = 'top', children }) => {
  const data = getGhostlyScoreTooltipData(gameScore, gameLevel, normalizedScore, gameScoreWeight);
  
  return (
    <DataDrivenTooltip
      data={data}
      side={side}
    >
      {children}
    </DataDrivenTooltip>
  );
};

// Preset for Applied Pressure explanation
export const AppliedPressureTooltip: React.FC<{
  pressureValue?: number;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children?: React.ReactNode;
}> = ({ pressureValue, side = 'top', children }) => {
  const data = getAppliedPressureTooltipData(pressureValue);
  
  return (
    <DataDrivenTooltip
      data={data}
      side={side}
      variant="compact"
    >
      {children}
    </DataDrivenTooltip>
  );
};

// Preset for AOP (Arterial Occlusion Pressure) explanation
export const AOPTooltip: React.FC<{
  aopValue?: number;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children?: React.ReactNode;
}> = ({ aopValue, side = 'top', children }) => {
  const data = getAOPTooltipData(aopValue);
  
  return (
    <DataDrivenTooltip
      data={data}
      side={side}
      variant="compact"
    >
      {children}
    </DataDrivenTooltip>
  );
};


// NEW: Preset for the overall performance score
export const OverallPerformanceScoreTooltip: React.FC<{
  side?: 'top' | 'right' | 'bottom' | 'left';
  children?: React.ReactNode;
  muscleComplianceWeight?: number;
  effortScoreWeight?: number;
  gameScoreWeight?: number;
}> = ({ 
  side = 'top', 
  children,
  muscleComplianceWeight,
  effortScoreWeight,
  gameScoreWeight
}) => {
  const data = getOverallPerformanceScoreTooltipData(
    muscleComplianceWeight,
    effortScoreWeight,
    gameScoreWeight
  );
  return <DataDrivenTooltip data={data} side={side} children={children} />;
};

// NEW: Preset for the weighted score breakdown
export const WeightedScoreTooltip: React.FC<{
  side?: 'top' | 'right' | 'bottom' | 'left';
  children?: React.ReactNode;
  weights: {
    compliance: number;
    symmetry: number;
    effort: number;
    gameScore: number;
  };
}> = ({ side = 'top', children, weights }) => {
  const data = getWeightedScoreTooltipData(weights);
  return <DataDrivenTooltip data={data} side={side} children={children} variant="compact" />;
};


// Export other preset tooltips as needed
export default ClinicalTooltip;