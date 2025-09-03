import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StarIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import { OverallPerformanceScoreTooltip, WeightedScoreTooltip } from '@/components/ui/clinical-tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useScoreColors } from '@/hooks/useScoreColors';
import { useSessionStore } from '@/store/sessionStore';
import { useScoringConfiguration } from '@/hooks/useScoringConfiguration';
import { PerformanceCalculationResult } from '@/lib/performanceUtils';
import { formatPercentage } from '@/lib/formatUtils';
import CircleDisplay from '@/components/shared/CircleDisplay';

/**
 * Props for the OverallPerformanceCard component
 */
interface OverallPerformanceCardProps {
  /** Performance calculation result from performanceUtils */
  performanceData: PerformanceCalculationResult | null;
  /** Label describing the score level (e.g., "Excellent", "Good") */
  scoreLabel: string;
  /** Tailwind text color class for the score */
  scoreTextColor: string;
  /** Tailwind background color class for the score */
  scoreBgColor: string;
  /** Hex color value for visual elements */
  scoreHexColor: string;
  /** Optional therapeutic compliance score for display */
  therapeuticComplianceScore?: number;
  /** Optional symmetry score for display */
  symmetryScore?: number;
  /** Optional game score for display */
  gameScore?: number;
}

/**
 * OverallPerformanceCard displays the comprehensive performance score
 * with a breakdown of contributing factors (compliance, symmetry, effort, game).
 * 
 * The component uses a weight hierarchy:
 * 1. Session weights (highest priority)
 * 2. Database weights from Supabase
 * 3. Default weights from backend config
 */
const OverallPerformanceCard: React.FC<OverallPerformanceCardProps> = ({
  performanceData,
  scoreLabel,
  scoreTextColor,
  scoreHexColor,
  therapeuticComplianceScore,
  symmetryScore,
  gameScore,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { sessionParams } = useSessionStore();
  const { weights: databaseWeights } = useScoringConfiguration();
  
  // Weight hierarchy: Session → Database → Defaults
  const weights = useMemo(() => 
    sessionParams.enhanced_scoring?.weights || databaseWeights || {
      compliance: 0.50,
      symmetry: 0.25,
      effort: 0.25,
      gameScore: 0.00,
      compliance_completion: 0.333,
      compliance_intensity: 0.333,
      compliance_duration: 0.334,
    }, [sessionParams.enhanced_scoring?.weights, databaseWeights]);
  
  const overallScore = performanceData?.totalScore || 0;
  const consistentColors = useScoreColors(overallScore);
  
  // Determine border color based on score - cyan for 70-84% range
  const cardBorderClass = useMemo(() => {
    if (overallScore >= 85) return 'border-green-500';
    if (overallScore >= 70) return 'border-cyan-500'; // Force cyan for 70-84% range
    if (overallScore >= 50) return 'border-yellow-500';
    return 'border-red-500';
  }, [overallScore]);
  
  // Early return for loading state
  if (!performanceData) {
    return (
      <Card className="bg-white shadow-sm p-4 text-center min-h-[400px] flex items-center justify-center">
        <span className="text-gray-500">Loading performance data...</span>
      </Card>
    );
  }

  const { totalScore, contributions, strongestDriver, weightedScores } = performanceData;

  return (
    <Card 
      className={cn(
        "bg-white shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden min-h-[400px] border-2",
        cardBorderClass
      )}
    >
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <div className="cursor-pointer group">
              <CardHeader className="flex flex-col items-center text-center pb-4 relative">
                <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                  <div className="w-5 h-5 mr-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                    <StarIcon className="h-3 w-3 text-white" />
                  </div>
                  Overall Performance
                  <OverallPerformanceScoreTooltip 
                    complianceWeight={weights.compliance}
                    symmetryWeight={weights.symmetry}
                    effortScoreWeight={weights.effort}
                    gameScoreWeight={weights.gameScore}
                  />
                </CardTitle>
                <p className={cn("text-sm font-bold mb-2", scoreTextColor || consistentColors.text)}>
                  {scoreLabel || consistentColors.label}
                </p>
                  
                  <WeightedScoreTooltip weights={weights}>
                    <div>
                      <CircleDisplay 
                        value={overallScore} 
                        label="" 
                        color={scoreHexColor || consistentColors.hex}
                        size="lg"
                        showPercentage={true}
                      />
                    </div>
                  </WeightedScoreTooltip>
                  <ChevronDownIcon className="absolute bottom-2 right-2 h-5 w-5 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CardHeader>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-6">
          {/* Performance Breakdown */}
          <div className="rounded-lg bg-slate-50 py-4 px-4 space-y-4 pb-10">
            <h4 className="text-sm font-semibold text-gray-700 text-center">Performance Breakdown</h4>

            {(() => {
              // Define contribution components with their styling and values
              const contributionData = [
                { 
                  key: 'C', 
                  color: 'bg-green-500', 
                  label: 'Compliance', 
                  value: contributions.compliance, 
                  weight: weights.compliance,
                  rawScore: therapeuticComplianceScore
                },
                { 
                  key: 'S', 
                  color: 'bg-purple-500', 
                  label: 'Symmetry', 
                  value: contributions.symmetry, 
                  weight: weights.symmetry,
                  rawScore: symmetryScore
                },
                { 
                  key: 'E', 
                  color: 'bg-orange-500', 
                  label: 'Effort', 
                  value: contributions.effort, 
                  weight: weights.effort,
                  rawScore: weightedScores.effort
                },
                ...(weights.gameScore > 0 ? [{ 
                  key: 'G' as const, 
                  color: 'bg-cyan-500', 
                  label: 'Game', 
                  value: contributions.game, 
                  weight: weights.gameScore,
                  rawScore: gameScore
                }] : []),
              ];
              
              const totalContribution = Object.values(contributions).reduce((sum, val) => sum + val, 0);

              return (
                <div className="space-y-6" data-testid="performance-breakdown">
                  {/* Visual progress bar showing component contributions */}
                  <div className="h-4 w-full rounded-full bg-slate-200 overflow-hidden" title={`Total Score: ${formatPercentage(totalScore)}`}>
                    <div className="flex h-full w-full">
                      {contributionData.map((c) => {
                        const widthPercentage = totalContribution > 0 ? (c.value / totalContribution) * 100 : 0;
                        return (
                          <div
                            key={`seg-${c.key}`}
                            className={cn(c.color, "transition-all duration-500")}
                            style={{ width: `${Math.max(0, Math.min(100, widthPercentage))}%` }}
                            title={`${c.label}: +${formatPercentage(c.value)}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Component breakdown with calculations */}
                  <div className="space-y-4">
                    {contributionData.map((c) => (
                      <div key={`row-${c.key}`} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={cn('inline-block w-3 h-3 rounded', c.color)} />
                          <span className="font-medium text-slate-700">{c.label}</span>
                          <span className="text-slate-400">({c.key})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600">
                            {formatPercentage(c.rawScore ?? 0)}
                          </span>
                          <span className="text-slate-400">×</span>
                          <span className="text-slate-600">{formatPercentage(c.weight * 100)}</span>
                          <span className="text-slate-400">=</span>
                          <span className="font-semibold text-slate-800 min-w-[3rem] text-right">
                            +{formatPercentage((c.rawScore ?? 0)*c.weight)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Summary section */}
                  <div className="pt-2 border-t border-slate-200/80 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium text-slate-700">Total Score:</span>
                      <span className="font-bold text-slate-800">{formatPercentage(totalScore)}</span>
                    </div>
                    <div className="text-center text-xs text-slate-500">
                      Key Factor: <span className="font-semibold text-slate-800">{strongestDriver}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>

            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
  );
};

export default OverallPerformanceCard; 