import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDownIcon } from '@radix-ui/react-icons';
// ContractionTypeBreakdown component was removed - functionality integrated into parent components
import { GameSessionParameters, Contraction } from '@/types/emg';
import MuscleNameDisplay from '@/components/shared/MuscleNameDisplay';
import CircleDisplay from '@/components/shared/CircleDisplay';
import { ComplianceTooltip, CompletionRateTooltip, IntensityQualityTooltip, DurationQualityTooltip } from '@/components/ui/clinical-tooltip';
import { useScoreColors } from '@/hooks/useScoreColors';
import { useSessionStore } from '@/store/sessionStore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatPercentage, formatClinicalValue } from '@/lib/formatUtils';
import { cn } from '@/lib/utils';
import { getProgressBarColors } from '@/lib/unifiedColorSystem';

interface MuscleComplianceCardProps {
  channel: string;
  totalScore: number;
  scoreLabel: string;
  scoreTextColor: string;
  scoreBgColor: string;
  scoreHexColor: string;
  totalContractions: number;
  expectedContractions: number | null;
  contractionScore: number | null;
  contractionCount: number;
  goodContractionCount: number;
  shortContractions: number;
  shortGoodContractions: number;
  longContractions: number;
  longGoodContractions: number;
  expectedShortContractions?: number;
  expectedLongContractions?: number;
  contractionDurationThreshold?: number;
  sessionParams?: GameSessionParameters;
  averageContractionTime?: number; // in milliseconds
  mvcValue?: number; // Current MVC value
  mvcThreshold?: number; // MVC threshold (75% of MVC)
  contractions?: Contraction[]; // Add raw contractions data for accurate calculation
  componentScores?: {
    completion: { score: number | null; weight: number };
    intensity: { score: number | null; weight: number };
    duration: { score: number | null; weight: number };
  };
}

const MuscleComplianceCard: React.FC<MuscleComplianceCardProps> = ({
  channel,
  totalScore,
  scoreLabel,
  scoreTextColor,
  scoreBgColor,
  scoreHexColor,
  totalContractions,
  expectedContractions,
  contractionScore,
  contractionCount,
  goodContractionCount,
  shortContractions,
  shortGoodContractions,
  longContractions,
  longGoodContractions,
  expectedShortContractions,
  expectedLongContractions,
  contractionDurationThreshold = 2000,
  sessionParams,
  averageContractionTime,
  mvcValue,
  mvcThreshold,
  contractions = [],
  componentScores
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCountDetailsOpen, setIsCountDetailsOpen] = useState(false);
  const [isQualityDetailsOpen, setIsQualityDetailsOpen] = useState(false);
  const [isDurationDetailsOpen, setIsDurationDetailsOpen] = useState(false);
  
  // Get real-time duration threshold from Settings
  const { sessionParams: liveSessionParams } = useSessionStore();
  
  // Get the actual duration threshold for this muscle from Settings
  const actualDurationThreshold = useMemo(() => {
    const baseChannelName = channel.split(' ')[0]; // Extract channel name (e.g., "CH1" from "CH1 Activated")
    
    // Check for per-muscle duration threshold first
    if (liveSessionParams?.session_duration_thresholds_per_muscle?.[baseChannelName]) {
      const muscleThresholdSeconds = liveSessionParams.session_duration_thresholds_per_muscle[baseChannelName];
      if (muscleThresholdSeconds !== null && muscleThresholdSeconds !== undefined) {
        const thresholdMs = muscleThresholdSeconds * 1000; // Convert seconds to milliseconds
        
        console.log(`🎯 MusclePerformanceCard Duration Threshold for ${channel} (per-muscle):`, {
          baseChannelName,
          perMuscleThresholdSeconds: muscleThresholdSeconds,
          finalThresholdMs: thresholdMs
        });
        
        return thresholdMs;
      }
    }
    
    // Fallback to global duration threshold
    const globalThreshold = liveSessionParams?.contraction_duration_threshold ?? 2000;
    
    console.log(`🎯 MusclePerformanceCard Duration Threshold for ${channel} (global):`, {
      baseChannelName,
      globalThresholdMs: globalThreshold
    });
    
    return globalThreshold;
  }, [channel, liveSessionParams]);

  const scoreData = [
    { name: 'Score', value: totalScore },
    { name: 'Remaining', value: 100 - totalScore },
  ];

  const COLORS = [scoreHexColor, '#e5e7eb'];

  // The `contractionScore` prop is now the source of truth, passed from the hook.
  // The local calculation below is removed to adhere to DRY principles.
  const contractionColors = useScoreColors(contractionScore ?? 0);
  const contractionProgressColors = getProgressBarColors(contractionScore ?? 0);

  // Calculate good contraction percentage with consistent formatting
  const goodContractionPercentage = totalContractions > 0 
    ? Math.round((goodContractionCount / totalContractions) * 100) 
    : 0;
  const goodContractionColors = useScoreColors(goodContractionPercentage);
  const goodContractionProgressColors = getProgressBarColors(goodContractionPercentage);

  // Calculate duration quality score based on actualDurationThreshold
  let durationCompliantCount = 0;
  
  if (contractions && contractions.length > 0) {
    // Use raw contractions data to calculate duration compliance
    durationCompliantCount = contractions.filter(c => c.duration_ms >= actualDurationThreshold).length;
  } else {
    // Fallback to pre-calculated longContractions
    durationCompliantCount = longContractions;
  }
  
  const durationQualityPercentage = totalContractions > 0 
    ? Math.round((durationCompliantCount / totalContractions) * 100) 
    : 0;
  const durationQualityColors = useScoreColors(durationQualityPercentage);
  const durationQualityProgressColors = getProgressBarColors(durationQualityPercentage);
  

  // Get colors for the overall score
  const scoreColors = useScoreColors(totalScore);

  return (
    <Card className={cn(
      "bg-white shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden border-2 border-gray-200",
      isExpanded && "relative z-10"
    )}>
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <div className="cursor-pointer group">
              <CardHeader className="flex flex-col items-center text-center pb-4 relative">
          <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-1">
            {sessionParams ? (
              <MuscleNameDisplay channelName={channel} sessionParams={sessionParams} />
            ) : (
              channel
            )} Compliance
            <ComplianceTooltip 
              side="top"
              completionWeight={componentScores?.completion.weight}
              intensityWeight={componentScores?.intensity.weight}
              durationWeight={componentScores?.duration.weight}
              durationThreshold={actualDurationThreshold}
            />
          </CardTitle>
          <p className={`text-sm font-bold ${scoreColors.text} mb-2`}>{scoreColors.label}</p>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <CircleDisplay 
                    value={totalScore} 
                    label="" 
                    color={scoreColors.hex}
                    size="lg"
                    showPercentage={true}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent 
                side="top"
                sideOffset={5}
                className="bg-white p-3 shadow-lg border border-slate-200 max-w-xs"
              >
                <div>
                  <h4 className="text-sm font-semibold mb-2">Compliance Score Calculation (Average)</h4>
                  {componentScores && (
                    <div className="text-xs text-gray-600 space-y-1">
                      <div className="flex justify-between items-center">
                        <span>Completion ({formatPercentage(componentScores.completion.weight * 100)}):</span>
                        <span className="font-medium">{formatPercentage(componentScores.completion.score)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Intensity ({formatPercentage(componentScores.intensity.weight * 100)}):</span>
                        <span className="font-medium">{formatPercentage(componentScores.intensity.score)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Duration ({formatPercentage(componentScores.duration.weight * 100)}):</span>
                        <span className="font-medium">{formatPercentage(componentScores.duration.score)}</span>
                      </div>
                      <div className="border-t border-gray-300 mt-2 pt-2">
                        <div className="text-xs text-gray-500 mb-1">
                          Weighted Average: ({formatPercentage(componentScores.completion.score)} × {formatPercentage(componentScores.completion.weight * 100)} + {formatPercentage(componentScores.intensity.score)} × {formatPercentage(componentScores.intensity.weight * 100)} + {formatPercentage(componentScores.duration.score)} × {formatPercentage(componentScores.duration.weight * 100)})
                        </div>
                        <div className="flex justify-between items-center font-semibold">
                          <span>Overall Score:</span>
                          <span className={scoreColors.text}>{formatPercentage(totalScore)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="mt-2 text-xs text-gray-500">
                    <p>Duration threshold: ≥{formatClinicalValue(actualDurationThreshold / 1000)}s ({actualDurationThreshold}ms)</p>
                    {mvcThreshold && (
                      <p>Intensity threshold: ≥{mvcThreshold.toExponential(2)} µV</p>
                    )}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <ChevronDownIcon className="absolute bottom-2 right-2 h-5 w-5 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </CardHeader>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
        <CardContent className="pt-0 space-y-6">
          {/* Contraction Count */}
          <div className="rounded-md bg-slate-50 p-4">
            <Collapsible open={isCountDetailsOpen} onOpenChange={setIsCountDetailsOpen}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <h4 className="text-sm font-semibold text-gray-700">Completion Rate</h4>
                  <CompletionRateTooltip side="top" />
                  <CollapsibleTrigger className="ml-1 rounded-full hover:bg-slate-200 p-0.5 transition-colors">
                    <ChevronDownIcon className="h-4 w-4 text-gray-500 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                </div>
                {contractionScore !== null ? (
                  <span className={`text-sm font-bold ${contractionColors.text}`}>{formatPercentage(contractionScore)}</span>
                ) : (
                  <span className="text-sm font-bold text-gray-400">N/A</span>
                )}
              </div>
              
              {contractionScore !== null && (
                <>
                  <Progress 
                    value={contractionScore} 
                    className="h-2" 
                    indicatorClassName={contractionProgressColors.bg} 
                  />
                  <p className="text-xs text-gray-500 text-center mt-1">
                    {totalContractions} contractions detected (short: {shortContractions}, long: {longContractions})
                  </p>
                </>
              )}

              <CollapsibleContent className="pt-2 space-y-4">
                <div className="flex justify-center items-center">
                  <CircleDisplay 
                    value={contractionCount} 
                    total={expectedContractions ?? undefined}
                    label="Performed" 
                    color={contractionColors.hex} 
                    size="md"
                    showPercentage={false}
                    showExpected={true}
                  />
                </div>

              
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Contraction Quality */}
          <div className="rounded-md bg-slate-50 p-4">
            <Collapsible open={isQualityDetailsOpen} onOpenChange={setIsQualityDetailsOpen}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <h4 className="text-sm font-semibold text-gray-700">Intensity Quality</h4>
                  <IntensityQualityTooltip side="top" />
                  <CollapsibleTrigger className="ml-1 rounded-full hover:bg-slate-200 p-0.5 transition-colors">
                    <ChevronDownIcon className="h-4 w-4 text-gray-500 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                </div>
                {goodContractionCount !== null && totalContractions > 0 ? (
                  <span className={`text-sm font-bold ${goodContractionColors.text}`}>
                    {formatPercentage(goodContractionPercentage)}
                  </span>
                ) : (
                  <span className="text-sm font-bold text-gray-400">N/A</span>
                )}
              </div>
              
              {goodContractionCount !== null && totalContractions > 0 && (
                <>
                  <Progress 
                    value={goodContractionPercentage} 
                    className="h-2" 
                    indicatorClassName={goodContractionProgressColors.bg} 
                  />
                  <p className="text-xs text-gray-500 text-center mt-1">
                    {goodContractionCount} of {totalContractions} good quality
                  </p>
                </>
              )}

              <CollapsibleContent className="pt-2 space-y-4">
                <div className="flex justify-around items-center">
                  <CircleDisplay 
                    value={goodContractionCount} 
                    total={totalContractions}
                    label="Good Quality" 
                    color={goodContractionColors.hex} 
                    size="md"
                    showPercentage={false}
                    showExpected={true}
                  />
                  {mvcValue && mvcThreshold && (
                    <div className="flex flex-col items-center space-y-2">
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">{mvcValue.toExponential(1)}</div>
                        <div className="text-xs text-gray-500">MVC Value (µV)</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-amber-600">{mvcThreshold.toExponential(1)}</div>
                        <div className="text-xs text-gray-500">75% Threshold (µV)</div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-xs text-center text-gray-500">
                  <p><span className="font-bold">{goodContractionCount}</span> of <span className="font-bold">{totalContractions}</span> contractions met the quality threshold.</p>
                  {mvcValue && mvcThreshold && (
                    <p className="mt-1">
                      <span className="font-medium">Intensity requirement:</span> ≥{mvcThreshold.toExponential(2)} µV (75% of {mvcValue.toExponential(2)} µV MVC)
                    </p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Duration Quality */}
          <div className="rounded-md bg-slate-50 p-4">
            <Collapsible open={isDurationDetailsOpen} onOpenChange={setIsDurationDetailsOpen}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <h4 className="text-sm font-semibold text-gray-700">Duration Quality</h4>
                  <DurationQualityTooltip 
                    contractionDurationThreshold={actualDurationThreshold}
                    side="top" 
                  />
                  <CollapsibleTrigger className="ml-1 rounded-full hover:bg-slate-200 p-0.5 transition-colors">
                    <ChevronDownIcon className="h-4 w-4 text-gray-500 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                </div>
                {totalContractions > 0 ? (
                  <span className={`text-sm font-bold ${durationQualityColors.text}`}>
                    {formatPercentage(durationQualityPercentage)}
                  </span>
                ) : (
                  <span className="text-sm font-bold text-gray-400">N/A</span>
                )}
              </div>
              
              {totalContractions > 0 && (
                <>
                  <Progress 
                    value={durationQualityPercentage} 
                    className="h-2" 
                    indicatorClassName={durationQualityProgressColors.bg} 
                  />
                  <p className="text-xs text-gray-500 text-center mt-1">
                    {durationCompliantCount} of {totalContractions} met duration threshold
                  </p>
                  {averageContractionTime !== undefined && (
                    <p className="text-xs text-indigo-600 font-medium text-center">
                      Avg. Duration: {formatClinicalValue(averageContractionTime / 1000)}s
                    </p>
                  )}
                </>
              )}

              <CollapsibleContent className="pt-2 space-y-4">
                <div className="flex justify-around items-center">
                  <CircleDisplay 
                    value={durationCompliantCount} 
                    total={totalContractions}
                    label="Good Duration" 
                    color={durationQualityColors.hex} 
                    size="md"
                    showPercentage={false}
                    showExpected={true}
                  />
                  {averageContractionTime && (
                    <CircleDisplay 
                      value={Number(formatClinicalValue(averageContractionTime / 1000))} 
                      label="Avg Time (s)" 
                      color="#6366f1" 
                      size="md"
                      showPercentage={false}
                      showExpected={false}
                    />
                  )}
                </div>
                <div className="text-xs text-center text-gray-500 space-y-2">
                  <div>
                    <p>
                      <span className="font-bold">{durationCompliantCount}</span> of <span className="font-bold">{totalContractions}</span> contractions lasted ≥{formatClinicalValue(actualDurationThreshold / 1000)}s.
                      <span className="text-xs text-gray-400 ml-1">({actualDurationThreshold}ms)</span>
                    </p>
                    {averageContractionTime && (
                      <p className="mt-1">
                        <span className="font-medium">Average duration:</span> {formatClinicalValue(averageContractionTime / 1000)}s across all contractions
                        <span className="text-xs text-gray-400 ml-1">({Math.round(averageContractionTime)}ms)</span>
                      </p>
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
  );
};

export default MuscleComplianceCard; 