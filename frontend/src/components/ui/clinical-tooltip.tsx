import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';

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
  className?: string;
  triggerClassName?: string;
  variant?: 'default' | 'compact';
}

export const ClinicalTooltip: React.FC<ClinicalTooltipProps> = ({
  title,
  description,
  sections = [],
  children,
  side = 'right',
  className,
  triggerClassName,
  variant = 'default'
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
          sideOffset={10}
          className={cn(
            "max-w-sm z-[100] bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-100",
            "border border-amber-300 shadow-xl p-0 overflow-hidden",
            className
          )}
        >
          <div>
            {/* Header */}
            <div className="bg-amber-600 text-white px-3 py-2">
              <p className={cn(
                "font-semibold",
                variant === 'compact' ? "text-xs" : "text-sm"
              )}>{title}</p>
            </div>

            {/* Content */}
            <div className={cn(
              "px-3 py-2 space-y-2",
              variant === 'compact' && "px-2 py-1.5 space-y-1.5"
            )}>
              {/* Description */}
              {description && (
                <p className={cn(
                  "text-slate-700",
                  variant === 'compact' ? "text-xs" : "text-sm"
                )}>{description}</p>
              )}

              {/* Sections */}
              {sections.map((section, idx) => (
                <div 
                  key={idx} 
                  className="bg-white/80 rounded-md p-2 border border-amber-200"
                >
                  {section.title && (
                    <p className={cn(
                      "font-medium text-slate-800 mb-1",
                      variant === 'compact' ? "text-xs" : "text-sm"
                    )}>{section.title}</p>
                  )}

                  {/* List Type */}
                  {section.type === 'list' && (
                    <div className={cn(
                      "space-y-1 text-slate-700",
                      variant === 'compact' ? "text-xs space-y-0.5" : "text-sm"
                    )}>
                      {section.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="flex items-start">
                          {item.percentage && (
                            <span 
                              className={cn(
                                "font-semibold mr-1.5 tabular-nums",
                                item.color || "text-gray-600"
                              )}
                            >
                              {item.percentage}%
                            </span>
                          )}
                          {item.icon && (
                            <span className="mr-1.5">{item.icon}</span>
                          )}
                          <span>
                            {item.label && <strong>{item.label}:</strong>}
                            {item.description && ` ${item.description}`}
                            {item.value && !item.percentage && ` ${item.value}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Table Type */}
                  {(section.type === 'table' || !section.type) && (
                    <div className={cn(
                      "space-y-0.5 text-slate-700",
                      variant === 'compact' ? "text-xs" : "text-sm"
                    )}>
                      {section.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="flex items-center justify-between">
                          <span className="font-medium">{item.label}:</span>
                          <span 
                            className={cn(
                              "font-semibold tabular-nums",
                              item.color || "text-slate-800"
                            )}
                          >
                            {item.value || item.percentage}
                            {item.percentage && '%'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Formula Type */}
                  {section.type === 'formula' && (
                    <div className={cn(
                      "font-mono bg-white p-2 rounded border border-amber-100",
                      variant === 'compact' ? "text-xs p-1.5" : "text-sm"
                    )}>
                      {section.items.map((item, itemIdx) => (
                        <span key={itemIdx}>
                          {item.label && (
                            <span className={item.color || "text-slate-700"}>
                              {item.label}
                            </span>
                          )}
                          {item.value}
                        </span>
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

// Preset variants for common use cases
export const ComplianceTooltip: React.FC<{
  side?: 'top' | 'right' | 'bottom' | 'left';
  children?: React.ReactNode;
  completionWeight?: number;
  intensityWeight?: number;
  durationWeight?: number;
}> = ({ 
  side = 'right', 
  children,
  completionWeight = 1/3,
  intensityWeight = 1/3,
  durationWeight = 1/3
}) => {
  // Convert to percentages for display
  const completionPct = (completionWeight * 100).toFixed(1);
  const intensityPct = (intensityWeight * 100).toFixed(1);
  const durationPct = (durationWeight * 100).toFixed(1);
  
  return (
    <ClinicalTooltip
      title="Individual Muscle Compliance"
      description="Measures 'how well' exercises were performed for this specific muscle during the session"
      sections={[
        {
          title: "Clinical Formula:",
          type: "formula",
          items: [
            { label: "S", value: ` = ${completionPct}%×Completion + ${intensityPct}%×Intensity + ${durationPct}%×Duration` }
          ]
        },
        {
          title: "Clinical Components:",
          type: "list",
          items: [
            { label: `Completion (${completionPct}%)`, description: "Exercise adherence - 12 contractions expected per muscle" },
            { label: `Intensity (${intensityPct}%)`, description: "MVC threshold achievement - ≥75% required" },
            { label: `Duration (${durationPct}%)`, description: "Contraction time quality - ≥2.0s threshold" }
          ]
        },
        {
          title: "Clinical Interpretation:",
          type: "list",
          items: [
            { percentage: "≥90", description: "Excellent exercise execution", color: "text-emerald-600" },
            { percentage: "80-89", description: "Good protocol adherence", color: "text-green-600" },
            { percentage: "70-79", description: "Moderate - monitor for progression", color: "text-yellow-600" },
            { percentage: "<70", description: "Poor - protocol adjustments needed", color: "text-red-600" }
          ]
        }
      ]}
      side={side}
    >
      {children}
    </ClinicalTooltip>
  );
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
  // Convert to percentages for display
  const completionPct = (completionWeight * 100).toFixed(1);
  const intensityPct = (intensityWeight * 100).toFixed(1);
  const durationPct = (durationWeight * 100).toFixed(1);
  
  return (
    <ClinicalTooltip
      title="Therapeutic Compliance Score"
      description="Calculated as weighted average of three quality metrics (weights are adjustable in settings)"
      sections={[
        {
          type: "list",
          items: [
            { percentage: completionPct, label: "Completion rate", description: "contractions performed" },
            { percentage: intensityPct, label: "Intensity quality", description: "≥75% MVC" },
            { percentage: durationPct, label: "Duration quality", description: `≥${(contractionDurationThreshold / 1000).toFixed(1)}s` }
          ]
        }
      ]}
      side={side}
      variant="compact"
    >
      {children}
    </ClinicalTooltip>
  );
};

// Preset for completion rate
export const CompletionRateTooltip: React.FC<{
  side?: 'top' | 'right' | 'bottom' | 'left';
  children?: React.ReactNode;
}> = ({ side = 'top', children }) => (
  <ClinicalTooltip
    title="Exercise Completion Assessment"
    description="Measures exercise adherence within the session (33% weight in compliance score)"
    sections={[
      {
        title: "Clinical Formula:",
        type: "formula",
        items: [
          { value: "R_completion = contractions_performed / contractions_expected" }
        ]
      },
      {
        title: "GHOSTLY+ Protocol:",
        type: "list",
        items: [
          { description: "Expected: 12 contractions per muscle (6 short + 6 long)" },
          { description: "Detection: EMG amplitude & duration thresholds" },
          { description: "Target: ≥92% completion (≥11/12)" }
        ]
      }
    ]}
    side={side}
  >
    {children}
  </ClinicalTooltip>
);

// Preset for intensity quality
export const IntensityQualityTooltip: React.FC<{
  side?: 'top' | 'right' | 'bottom' | 'left';
  children?: React.ReactNode;
}> = ({ side = 'top', children }) => (
  <ClinicalTooltip
    title="Exercise Intensity Assessment"
    description="Measures therapeutic intensity effectiveness (34% weight in compliance score)"
    sections={[
      {
        title: "Clinical Formula:",
        type: "formula",
        items: [
          { value: "R_intensity = contractions_≥75%_MVC / total_contractions" }
        ]
      },
      {
        title: "Clinical Threshold:",
        type: "list",
        items: [
          { description: "MVC threshold: ≥75% of maximum voluntary contraction" },
          { description: "Target: ≥80% of contractions meet intensity requirement" }
        ]
      },
      {
        title: "Therapeutic Rationale:",
        type: "list",
        items: [
          { description: "Ensures sufficient muscle activation for strength adaptation" }
        ]
      }
    ]}
    side={side}
  >
    {children}
  </ClinicalTooltip>
);

// Preset for duration quality
export const DurationQualityTooltip: React.FC<{
  contractionDurationThreshold?: number;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children?: React.ReactNode;
}> = ({ contractionDurationThreshold = 2000, side = 'top', children }) => (
  <ClinicalTooltip
    title="Exercise Duration Assessment"
    description="Measures contraction endurance quality (33% weight in compliance score)"
    sections={[
      {
        title: "Clinical Formula:",
        type: "formula",
        items: [
          { value: `R_duration = contractions_≥${(contractionDurationThreshold / 1000).toFixed(1)}s / total_contractions` }
        ]
      },
      {
        title: "Clinical Parameters:",
        type: "list",
        items: [
          { description: `Duration threshold: ≥${(contractionDurationThreshold / 1000).toFixed(1)}s (adaptive)` },
          { description: "Target: ≥90% of contractions meet duration requirement" },
          { description: "Progressive increase: 2-10s over treatment course" }
        ]
      },
      {
        title: "Therapeutic Rationale:",
        type: "list",
        items: [
          { description: "Assesses muscle endurance and motor control quality for functional improvement" }
        ]
      }
    ]}
    side={side}
  >
    {children}
  </ClinicalTooltip>
);

// Preset for Muscle Symmetry
export const MuscleSymmetryTooltip: React.FC<{
  side?: 'top' | 'right' | 'bottom' | 'left';
  children?: React.ReactNode;
}> = ({ side = 'top', children }) => (
  <ClinicalTooltip
    title="Muscle Symmetry Score"
    description="Bilateral balance assessment to prevent compensation patterns and ensure equal therapeutic benefit"
    sections={[
      {
        title: "Clinical Formula:",
        type: "formula",
        items: [
          { value: "S = (1 - |Left - Right| / (Left + Right)) × 100" }
        ]
      },
      {
        title: "Clinical Interpretation:",
        type: "list",
        items: [
          { percentage: "90-100", description: "Excellent balance (healthy range)", color: "text-emerald-600" },
          { percentage: "70-89", description: "Minor imbalance - monitor for progression", color: "text-yellow-600" },
          { percentage: "<70", description: "Significant imbalance - intervention recommended", color: "text-red-600" }
        ]
      }
    ]}
    side={side}
  >
    {children}
  </ClinicalTooltip>
);

// Preset for RPE Score
export const RPEScoreTooltip: React.FC<{
  side?: 'top' | 'right' | 'bottom' | 'left';
  children?: React.ReactNode;
}> = ({ side = 'top', children }) => (
  <ClinicalTooltip
    title="Subjective Effort Score"
    description="Patient-reported exertion appropriateness based on RPE change during session"
    sections={[
      {
        title: "Clinical Formula:",
        type: "formula",
        items: [
          { value: "ΔRPE = RPE_post - RPE_pre" }
        ]
      },
      {
        title: "Therapeutic Window:",
        type: "list",
        items: [
          { label: "ΔRPE = +2 to +3", description: "Optimal therapeutic stimulus (100%)", color: "text-emerald-600" },
          { label: "ΔRPE = +1", description: "Minimal effort (60%)", color: "text-yellow-600" },
          { label: "ΔRPE = 0", description: "Insufficient stimulus (20%)", color: "text-orange-600" },
          { label: "ΔRPE ≥ +6", description: "Excessive - reduce intensity (40%)", color: "text-red-600" }
        ]
      },
      {
        title: "Clinical Rationale:",
        type: "list",
        items: [
          { description: "Ensures therapeutic stimulus without overexertion" },
          { description: "Post-exercise rating using Borg CR10 Scale (0-10)" },
          { description: "Optimal zone promotes adaptation and recovery" }
        ]
      }
    ]}
    side={side}
  >
    {children}
  </ClinicalTooltip>
);

// Preset for GHOSTLY Game Score
export const GHOSTLYScoreTooltip: React.FC<{
  gameScore?: number;
  gameLevel?: number;
  normalizedScore?: number;
  showExperimental?: boolean;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children?: React.ReactNode;
}> = ({ gameScore = 0, gameLevel, normalizedScore = 0, showExperimental = false, side = 'top', children }) => (
  <ClinicalTooltip
    title="Game Performance Score"
    description="Normalized engagement metric maintaining motivation with Dynamic Difficulty Adjustment"
    sections={[
      {
        title: "Clinical Formula:",
        type: "formula",
        items: [
          { value: "S_game = game_points / max_achievable_points × 100" }
        ]
      },
      {
        type: "table",
        items: [
          { label: "Raw Score", value: `${gameScore} pts` },
          ...(gameLevel ? [{ label: "Difficulty Level", value: gameLevel }] : []),
          { label: "Normalized", value: `${normalizedScore.toFixed(0)}%` }
        ]
      },
      {
        type: "list",
        items: [
          showExperimental 
            ? { description: "⚠️ Currently experimental - not included in Overall Performance", color: "text-amber-700" }
            : { description: "✓ Engagement metric with 15% weight in Overall Performance", color: "text-emerald-700" }
        ]
      }
    ]}
    side={side}
  >
    {children}
  </ClinicalTooltip>
);

// Export other preset tooltips as needed
export default ClinicalTooltip;