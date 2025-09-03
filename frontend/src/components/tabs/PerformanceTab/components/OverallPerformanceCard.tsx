import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StarIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import { OverallPerformanceScoreTooltip, WeightedScoreTooltip } from '@/components/ui/clinical-tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useScoreColors } from '@/hooks/useScoreColors';
import { useSessionStore } from '@/store/sessionStore';
import { ScoringWeights } from '@/types/emg';
import { useScoringConfiguration } from '@/hooks/useScoringConfiguration';
import { PerformanceCalculationResult } from '@/lib/performanceUtils';
import { formatPercentage, formatPoints } from '@/lib/formatUtils';
import CircleDisplay from '@/components/shared/CircleDisplay';


interface OverallPerformanceCardProps {
  performanceData: PerformanceCalculationResult | null;
  scoreLabel: string;
  scoreTextColor: string;
  scoreBgColor: string;
  scoreHexColor: string;
  // Keep props that are not part of the calculation but are needed for display context
  therapeuticComplianceScore?: number;
  symmetryScore?: number;
  // subjectiveFatigueLevel is now derived from performanceData
  gameScore?: number;
}

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
  
  // Use proper scoring configuration weights from API first, then backend config.py defaults
  const weights = sessionParams.enhanced_scoring?.weights || databaseWeights || {
    compliance: 0.50,  // 50% - Therapeutic Compliance (from backend config.py ScoringDefaults)
    symmetry: 0.25,    // 25% - Muscle Symmetry (from backend config.py ScoringDefaults)
    effort: 0.25,      // 25% - Subjective Effort (RPE) (from backend config.py ScoringDefaults)
    gameScore: 0.00,   // 0% - Game Performance (from backend config.py ScoringDefaults)
    compliance_completion: 0.333,
    compliance_intensity: 0.333,
    compliance_duration: 0.334,
  };
  
  // Use consistent color system like MusclePerformance cards
  const overallScore = performanceData?.totalScore || 0;
  const consistentColors = useScoreColors(overallScore);
  
  // Map hex colors to border classes to match CircleDisplay
  const getBorderClass = (hex: string): string => {
    switch (hex) {
      case '#22c55e': return 'border-green-500';
      case '#06b6d4': return 'border-cyan-500';
      case '#eab308': return 'border-yellow-500';
      case '#ef4444': return 'border-red-500';
      default: return 'border-gray-300';
    }
  };
  
  // If performanceData is not available, show a loading/default state
  if (!performanceData) {
    // You can return a loading spinner or a placeholder card here
    return <Card className="bg-white shadow-sm p-4 text-center">Loading performance data...</Card>;
  }

  const { totalScore, contributions, strongestDriver, weightedScores } = performanceData;

  const scoreData = [
    { name: 'Score', value: Math.min(totalScore, 100) },
    { name: 'Remaining', value: Math.max(0, 100 - totalScore) },
  ];

  const SCORE_COLORS = [scoreHexColor, '#e5e7eb'];

  return (
    <Card className={`bg-white shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden border-2 min-h-[400px] ${getBorderClass(consistentColors.hex)}`}>
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
                  <p className={`text-sm font-bold ${consistentColors.text} mb-2`}>{consistentColors.label}</p>
                  
                  <WeightedScoreTooltip weights={weights}>
                    <div>
                      <CircleDisplay 
                        value={overallScore} 
                        label="" 
                        color={consistentColors.hex}
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
          {/* Performance Breakdown - Improved Clinical UX */}
          <div className="rounded-lg bg-slate-50 py-6 px-4 space-y-6">
            <h4 className="text-sm font-semibold text-gray-700 text-center">Performance Breakdown</h4>

            {(() => {
              const contributionData = [
                { key: 'C', color: 'bg-green-500', label: 'Compliance', value: contributions.compliance, weight: weights.compliance },
                { key: 'S', color: 'bg-purple-500', label: 'Symmetry', value: contributions.symmetry, weight: weights.symmetry },
                { key: 'E', color: 'bg-orange-500', label: 'Effort', value: contributions.effort, weight: weights.effort },
                ...(weights.gameScore > 0 ? [{ key: 'G' as const, color: 'bg-cyan-500', label: 'Game', value: contributions.game, weight: weights.gameScore }] : []),
              ];
              
              const totalContribution = Object.values(contributions).reduce((s, c) => s + c, 0);
              const maxContribution = Math.max(...Object.values(contributions));

              return (
                <div className="space-y-3">
                  {/* Progress bar showing relative contribution */}
                  <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden" title={`Total Score: ${formatPercentage(totalContribution)}`}>
                    <div className="flex h-full w-full">
                      {contributionData.map((c) => {
                        const widthPercentage = totalContribution > 0 ? (c.value / totalContribution) * 100 : 0;
                        return (
                          <div
                            key={`seg-${c.key}`}
                            className={cn(c.color, "transition-all duration-500")}
                            style={{ width: `${Math.max(0, Math.min(100, widthPercentage))}%` }}
                            title={`${c.label}: ${formatPoints(c.value)} (${formatPercentage(c.value)})`}
                          />
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Single-line layout per metric - improved readability */}
                  <div className="space-y-3">
                    {contributionData.map((c) => (
                      <div key={`row-${c.key}`} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={cn('inline-block w-3 h-3 rounded', c.color)} />
                          <span className="font-medium text-slate-700">{c.label}</span>
                          <span className="text-slate-400">({c.key})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600">
                            {c.key === 'C' && therapeuticComplianceScore !== undefined ? formatPercentage(therapeuticComplianceScore) :
                             c.key === 'S' && symmetryScore !== undefined ? formatPercentage(symmetryScore) :
                             c.key === 'E' ? formatPercentage(weightedScores.effort) :
                             c.key === 'G' && gameScore !== undefined ? formatPercentage(gameScore) :
                             formatPercentage(weightedScores[c.key.toLowerCase() as keyof typeof weightedScores] || 0)}
                          </span>
                          <span className="text-slate-400">×</span>
                          <span className="text-slate-600">{formatPercentage(c.weight * 100)}</span>
                          <span className="text-slate-400">=</span>
                          <span className="font-semibold text-slate-800 min-w-[3rem] text-right">{formatPoints(c.value)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Total and key insight */}
                  <div className="pt-2 border-t border-slate-200/80 space-y-1">
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

            {/* Component Values Grid removed - redundant with breakdown above */}
          
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
  );
};

export default OverallPerformanceCard; 