import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { StarIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import { OverallPerformanceScoreTooltip, WeightedScoreTooltip } from '@/components/ui/clinical-tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useScoreColors } from '@/hooks/useScoreColors';
import { useSessionStore } from '@/store/sessionStore';
import { ScoringWeights } from '@/types/emg';
import { DEFAULT_SCORING_WEIGHTS } from '@/hooks/useEnhancedPerformanceMetrics';
import { PerformanceCalculationResult } from '@/lib/performanceUtils';


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
  
  const weights = sessionParams.enhanced_scoring?.weights || DEFAULT_SCORING_WEIGHTS;
  
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
  
  // Common component for circle displays (same as MusclePerformanceCard)
  const CircleDisplay = ({ 
    value, 
    total, 
    label, 
    color, 
    size = "md",
    showPercentage = true,
    showExpected = false
  }: { 
    value: number, 
    total?: number, 
    label?: string, 
    color: string,
    size?: "sm" | "md" | "lg",
    showPercentage?: boolean,
    showExpected?: boolean
  }) => {
    const sizeClass = {
      sm: "w-16 h-16",
      md: "w-24 h-24",
      lg: "w-32 h-32"
    };
    
    const textSizeClass = {
      sm: "text-base",
      md: "text-xl",
      lg: "text-3xl"
    };
    
    const fillPercentage = total && total > 0 
      ? (value >= total ? 100 : Math.round((value / total) * 100))
      : 100;
    
    return (
      <div className="flex flex-col items-center">
        <div className={cn("relative", sizeClass[size])}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[{ value: fillPercentage }, { value: 100 - fillPercentage }]}
                cx="50%"
                cy="50%"
                innerRadius={size === "sm" ? 28 : size === "md" ? 38 : 48}
                outerRadius={size === "sm" ? 30 : size === "md" ? 42 : 52}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none"
              >
                <Cell fill={color} />
                <Cell fill="#e5e7eb" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("font-bold", textSizeClass[size])} style={{ color }}>
              {showPercentage ? `${value}%` : value}
            </span>
            {total && showExpected && (
              <span className="text-xs text-gray-500">of {total}</span>
            )}
          </div>
        </div>
        {label && (
          <p className="text-xs text-gray-500 mt-2">
            {label}
          </p>
        )}
      </div>
    );
  };

  return (
    <Card className="bg-white shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
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
                    muscleComplianceWeight={weights.compliance}
                    effortScoreWeight={weights.effort}
                    gameScoreWeight={weights.gameScore}
                  />
                  </CardTitle>
                  <p className={`text-sm font-bold ${scoreTextColor} mb-2`}>{scoreLabel}</p>
                  
                  <WeightedScoreTooltip weights={weights}>
                    <div>
                      <CircleDisplay 
                        value={totalScore} 
                        label="" 
                        color={scoreHexColor}
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
          {/* Performance Breakdown - Simplified for Clinical UX */}
          <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 space-y-4">
            <h4 className="text-sm font-semibold text-gray-700 text-center">Performance Breakdown</h4>

            {(() => {
              const contributionData = [
                { key: 'C', color: 'bg-green-500', label: 'Compliance', value: contributions.compliance, weight: weights.compliance },
                { key: 'S', color: 'bg-purple-500', label: 'Symmetry', value: contributions.symmetry, weight: weights.symmetry },
                { key: 'E', color: 'bg-orange-500', label: 'Effort', value: contributions.effort, weight: weights.effort },
                ...(weights.gameScore > 0 ? [{ key: 'G' as const, color: 'bg-cyan-500', label: 'Game', value: contributions.game, weight: weights.gameScore }] : []),
              ];
              
              const totalContribution = Object.values(contributions).reduce((s, c) => s + c, 0);

              return (
                <div className="space-y-3">
                  {/* Contributions bar */}
                  <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden" title={`Total Score: ${Math.round(totalContribution)}%`}>
                    <div className="flex h-full w-full">
                      {contributionData.map((c) => (
                        <div
                          key={`seg-${c.key}`}
                          className={cn(c.color, "transition-all duration-500")}
                          style={{ width: `${Math.max(0, Math.min(100, (c.value / 100) * 100))}%` }}
                          title={`${c.label}: +${Math.round(c.value)} pts (Score: ${Math.round(weightedScores[c.key.toLowerCase() as keyof typeof weightedScores])}%, Weight: ${Math.round(c.weight * 100)}%)`}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Simplified legend */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                    {contributionData.map((c) => (
                      <div key={`lbl-${c.key}`} className="flex items-center gap-1.5">
                        <span className={cn('inline-block w-2.5 h-2.5 rounded-sm', c.color)} />
                        <span className="font-medium">{c.label}</span>
                        <span className="text-slate-400 ml-auto">=</span>
                        <span className="font-semibold text-slate-700 w-8 text-right">+{Math.round(c.value)} pts</span>
                      </div>
                    ))}
                  </div>
                   {/* Insight: top driver */}
                  <div className="text-center text-sm text-slate-500 pt-2 border-t border-slate-200/80">
                    Key Factor: <span className="font-semibold text-slate-800">{strongestDriver}</span>
                  </div>
                </div>
              );
            })()}

          </div>

            {/* Component Values Grid - Responsive - Only show components with non-zero weights */}
            <div className={`mt-4 grid gap-3 ${
              [weights.compliance, weights.symmetry, weights.effort, weights.gameScore].filter(w => w > 0).length >= 3 ? 'grid-cols-3' : 'grid-cols-2'
            }`}>
              {weights.compliance > 0 && (
                <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm border border-green-100">
                  <div className="text-green-600 font-bold text-lg sm:text-xl">{typeof therapeuticComplianceScore === 'number' ? Math.round(therapeuticComplianceScore) : '--'}%</div>
                  <div className="text-xs text-gray-600 mt-0.5">Compliance</div>
                  <div className="text-xs text-green-600 font-semibold">(C)</div>
                </div>
              )}
              {weights.symmetry > 0 && (
                <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm border border-purple-100">
                  <div className="text-purple-600 font-bold text-lg sm:text-xl">{typeof symmetryScore === 'number' ? Math.round(symmetryScore) : '--'}%</div>
                  <div className="text-xs text-gray-600 mt-0.5">Symmetry</div>
                  <div className="text-xs text-purple-600 font-semibold">(S)</div>
                </div>
              )}
              {weights.effort > 0 && (
                <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm border border-orange-100">
                  <div className="text-orange-600 font-bold text-lg sm:text-xl">{typeof weightedScores.effort === 'number' ? Math.round(weightedScores.effort) : '--'}%</div>
                  <div className="text-xs text-gray-600 mt-0.5">Exertion</div>
                  <div className="text-xs text-orange-600 font-semibold">(E)</div>
                </div>
              )}
              {weights.gameScore > 0 && (
                <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm border border-cyan-100">
                  <div className="text-cyan-600 font-bold text-lg sm:text-xl">{typeof gameScore === 'number' ? Math.round(gameScore) : '--'}%</div>
                  <div className="text-xs text-gray-600 mt-0.5">Game</div>
                  <div className="text-xs text-cyan-600 font-semibold">(G)</div>
                </div>
              )}
            </div>
          
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
  );
};

export default OverallPerformanceCard; 