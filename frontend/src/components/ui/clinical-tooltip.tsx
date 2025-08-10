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
  type TooltipData
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
  className?: string;
  triggerClassName?: string;
  variant?: 'default' | 'compact';
  /** When true, force tooltip content to appear centered in the viewport */
  centered?: boolean;
}

export const ClinicalTooltip: React.FC<ClinicalTooltipProps> = ({
  title,
  description,
  sections = [],
  children,
  side = 'right',
  className,
  triggerClassName,
  variant = 'default',
  centered = true
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
          side={centered ? undefined : side}
          sideOffset={centered ? 0 : 8}
          align={centered ? undefined : 'center'}
          avoidCollisions={!centered}
          className={cn(
            "z-[999]",
            centered ? "bg-transparent border-none shadow-none p-0 rounded-none" : "bg-amber-50 border-2 border-amber-300 shadow-2xl p-0 rounded-lg",
            className
          )}
        >
          {centered ? (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none">
              <div className={cn(
                "pointer-events-auto bg-amber-50 border-2 border-amber-300 shadow-2xl p-0 rounded-lg",
                "max-w-[95vw] sm:max-w-[36rem] w-[min(95vw,36rem)] max-h-[80vh] overflow-auto overscroll-contain"
              )}>
                <div>
                  {/* Elegant Header */}
                  <div className="bg-amber-500 px-4 py-3">
                    <p className={cn(
                      "font-bold tracking-tight text-white drop-shadow-sm",
                      variant === 'compact' ? "text-sm" : "text-base"
                    )}>{title}</p>
                  </div>

                  {/* Content */}
                  <div className={cn(
                    "px-4 py-3 space-y-3",
                    variant === 'compact' && "px-3 py-2 space-y-2"
                  )}>
                    {/* Description */}
                    {description && (
                      <p className={cn(
                        "text-slate-700 leading-relaxed font-medium",
                        variant === 'compact' ? "text-xs" : "text-sm"
                      )}>{description}</p>
                    )}

                    {/* Sections */}
                    {sections.map((section, idx) => (
                      <div 
                        key={idx} 
                        className="bg-white rounded-lg p-3 border border-amber-200 shadow-sm"
                      >
                        {section.title && (
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-1 h-4 bg-amber-500 rounded-full"></div>
                            <h4 className={cn(
                              "font-bold text-slate-800",
                              variant === 'compact' ? "text-xs" : "text-sm"
                            )}>{section.title}</h4>
                          </div>
                        )}
                        {/* Enhanced List Type */}
                        {section.type === 'list' && (
                          <div className={cn(
                            "space-y-2 text-slate-700",
                            variant === 'compact' ? "text-xs space-y-1" : "text-sm"
                          )}>
                            {section.items.map((item, itemIdx) => (
                              <div key={itemIdx} className="flex items-start gap-2 text-left">
                                {item.percentage ? (
                                  <div className="flex items-start gap-2 w-full">
                                    <span 
                                      className={cn(
                                        "font-bold text-xs px-2 py-0.5 rounded-full bg-opacity-20 border flex-shrink-0",
                                        item.color === "text-emerald-600" && "text-emerald-700 bg-emerald-100 border-emerald-300",
                                        item.color === "text-green-600" && "text-green-700 bg-green-100 border-green-300",
                                        item.color === "text-yellow-600" && "text-yellow-700 bg-yellow-100 border-yellow-300",
                                        item.color === "text-red-600" && "text-red-700 bg-red-100 border-red-300",
                                        !item.color && "text-slate-700 bg-slate-100 border-slate-300"
                                      )}
                                    >
                                      {item.percentage}
                                    </span>
                                    <div className="flex-1">
                                      <span className="font-medium">{item.label}</span>
                                      <span className="text-slate-600 leading-relaxed ml-1">{item.description}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
                                    <div className="flex-1">
                                      {item.label && <span className="font-medium">{item.label}: </span>}
                                      <span className="text-slate-600 leading-relaxed">
                                        {item.description}
                                        {item.value && !item.percentage && ` ${item.value}`}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Enhanced Table Type */}
                        {(section.type === 'table' || !section.type) && (
                          <div className={cn(
                            "space-y-1.5 text-slate-700",
                            variant === 'compact' ? "text-xs" : "text-sm"
                          )}>
                            {section.items.map((item, itemIdx) => (
                              <div key={itemIdx} className="flex items-center justify-between py-1 border-b border-amber-100 last:border-b-0">
                                <span className="font-semibold text-slate-800">{item.label}</span>
                                <span 
                                  className={cn(
                                    "font-bold tabular-nums px-2 py-0.5 rounded text-xs",
                                    item.color || "text-slate-800 bg-slate-100"
                                  )}
                                >
                                  {item.value || item.percentage}
                                  {item.percentage && '%'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Enhanced Formula Type */}
                        {section.type === 'formula' && (
                          <div className={cn(
                            "bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-lg p-3 text-center",
                            variant === 'compact' ? "text-sm p-2" : "text-base"
                          )}>
                            {section.items.map((item, itemIdx) => (
                              <div key={itemIdx} className="font-serif italic">
                                {item.label && (
                                  <span 
                                    className={cn("font-bold text-xl mr-2", item.color || "text-slate-800")}
                                    dangerouslySetInnerHTML={{ __html: String(item.label) }}
                                  />
                                )}
                                <span 
                                  className="text-slate-700 font-medium" 
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
              </div>
            </div>
          ) : (
          <div>
            {/* Elegant Header */}
            <div className="bg-amber-500 px-4 py-3">
              <p className={cn(
                "font-bold tracking-tight text-white drop-shadow-sm",
                variant === 'compact' ? "text-sm" : "text-base"
              )}>{title}</p>
            </div>

            {/* Content */}
            <div className={cn(
              "px-4 py-3 space-y-3",
              variant === 'compact' && "px-3 py-2 space-y-2"
            )}>
              {/* Description */}
              {description && (
                <p className={cn(
                  "text-slate-700 leading-relaxed font-medium",
                  variant === 'compact' ? "text-xs" : "text-sm"
                )}>{description}</p>
              )}

              {/* Sections */}
              {sections.map((section, idx) => (
                <div 
                  key={idx} 
                  className="bg-white rounded-lg p-3 border border-amber-200 shadow-sm"
                >
                  {section.title && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 bg-amber-500 rounded-full"></div>
                      <h4 className={cn(
                        "font-bold text-slate-800",
                        variant === 'compact' ? "text-xs" : "text-sm"
                      )}>{section.title}</h4>
                    </div>
                  )}

                  {/* Enhanced List Type */}
                  {section.type === 'list' && (
                    <div className={cn(
                      "space-y-2 text-slate-700",
                      variant === 'compact' ? "text-xs space-y-1" : "text-sm"
                    )}>
                      {section.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="flex items-start gap-2 text-left">
                          {item.percentage ? (
                            <div className="flex items-start gap-2 w-full">
                              <span 
                                className={cn(
                                  "font-bold text-xs px-2 py-0.5 rounded-full bg-opacity-20 border flex-shrink-0",
                                  item.color === "text-emerald-600" && "text-emerald-700 bg-emerald-100 border-emerald-300",
                                  item.color === "text-green-600" && "text-green-700 bg-green-100 border-green-300",
                                  item.color === "text-yellow-600" && "text-yellow-700 bg-yellow-100 border-yellow-300",
                                  item.color === "text-red-600" && "text-red-700 bg-red-100 border-red-300",
                                  !item.color && "text-slate-700 bg-slate-100 border-slate-300"
                                )}
                              >
                                {item.percentage}
                              </span>
                              <div className="flex-1">
                                <span className="font-medium">{item.label}</span>
                                <span className="text-slate-600 leading-relaxed ml-1">{item.description}</span>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
                              <div className="flex-1">
                                {item.label && <span className="font-medium">{item.label}: </span>}
                                <span className="text-slate-600 leading-relaxed">
                                  {item.description}
                                  {item.value && !item.percentage && ` ${item.value}`}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Enhanced Table Type */}
                  {(section.type === 'table' || !section.type) && (
                    <div className={cn(
                      "space-y-1.5 text-slate-700",
                      variant === 'compact' ? "text-xs" : "text-sm"
                    )}>
                      {section.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="flex items-center justify-between py-1 border-b border-amber-100 last:border-b-0">
                          <span className="font-semibold text-slate-800">{item.label}</span>
                          <span 
                            className={cn(
                              "font-bold tabular-nums px-2 py-0.5 rounded text-xs",
                              item.color || "text-slate-800 bg-slate-100"
                            )}
                          >
                            {item.value || item.percentage}
                            {item.percentage && '%'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Enhanced Formula Type */}
                  {section.type === 'formula' && (
                    <div className={cn(
                      "bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-lg p-3 text-center",
                      variant === 'compact' ? "text-sm p-2" : "text-base"
                    )}>
                      {section.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="font-serif italic">
                          {item.label && (
                            <span 
                              className={cn("font-bold text-xl mr-2", item.color || "text-slate-800")}
                              dangerouslySetInnerHTML={{ __html: String(item.label) }}
                            />
                          )}
                          <span 
                            className="text-slate-700 font-medium" 
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
          )}
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
  showExperimental?: boolean;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children?: React.ReactNode;
}> = ({ gameScore = 0, gameLevel, normalizedScore = 0, showExperimental = false, side = 'top', children }) => {
  const data = getGhostlyScoreTooltipData(gameScore, gameLevel, normalizedScore, showExperimental);
  
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

// Export other preset tooltips as needed
export default ClinicalTooltip;