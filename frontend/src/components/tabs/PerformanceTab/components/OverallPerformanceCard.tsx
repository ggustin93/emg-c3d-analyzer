import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { StarIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import ClinicalTooltip from '@/components/ui/clinical-tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useScoreColors } from '@/hooks/useScoreColors';
import { useSessionStore } from '@/store/sessionStore';
import { DEFAULT_SCORING_WEIGHTS } from '@/hooks/useEnhancedPerformanceMetrics';
import SubjectiveFatigueCard from './SubjectiveFatigueCard';
import MuscleSymmetryCard from './MuscleSymmetryCard';
import GHOSTLYGameCard from './GHOSTLYGameCard';

interface OverallPerformanceCardProps {
  totalScore: number;
  scoreLabel: string;
  scoreTextColor: string;
  scoreBgColor: string;
  scoreHexColor: string;
  muscleCount: number;
  symmetryScore?: number;
  subjectiveFatigueLevel?: number;
  averageContractionTime?: number; // in milliseconds
  totalContractions?: number;
  goodContractions?: number;
  expectedContractions?: number;
  // GHOSTLY Game data
  gameScore?: number;
  gameLevel?: number;
  // Therapeutic Compliance data
  therapeuticComplianceScore?: number;
  leftMuscleScore?: number;
  rightMuscleScore?: number;
}

const OverallPerformanceCard: React.FC<OverallPerformanceCardProps> = ({
  totalScore,
  scoreLabel,
  scoreTextColor,
  scoreBgColor,
  scoreHexColor,
  muscleCount,
  symmetryScore,
  subjectiveFatigueLevel,
  averageContractionTime,
  totalContractions = 0,
  goodContractions = 0,
  expectedContractions,
  gameScore,
  gameLevel,
  therapeuticComplianceScore,
  leftMuscleScore,
  rightMuscleScore
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { sessionParams } = useSessionStore();
  
  // Get weights from session store or use defaults
  const weights = sessionParams.enhanced_scoring?.weights || DEFAULT_SCORING_WEIGHTS;
  
  // Map weight keys to our component values - use actual weights without fallbacks
  const complianceWeight = weights.compliance;
  const symmetryWeight = weights.symmetry;
  const effortWeight = weights.effort;
  const gameWeight = weights.gameScore;
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
                  <ClinicalTooltip
                    title="GHOSTLY+ Overall Performance Score"
                    description="Composite score (0–100). Higher is better. Weights are configurable by therapists."
                    sections={[
                      {
                        title: "Formula",
                        type: "formula" as const,
                        items: [
                          {
                            label: "P<sub>overall</sub> =",
                            value: `w<sub>c</sub>·S<sub>compliance</sub> + w<sub>s</sub>·S<sub>symmetry</sub> + w<sub>e</sub>·S<sub>effort</sub>${gameWeight > 0 ? ' + w<sub>g</sub>·S<sub>game</sub>' : ''}`,
                            color: "text-slate-800"
                          }
                        ]
                      },
                      {
                        title: "Weights",
                        type: "table" as const,
                        items: [
                          ...(complianceWeight > 0 ? [{ label: "Compliance (C)", value: `${Math.round(complianceWeight * 100)}%`, color: "text-green-700" }] : []),
                          ...(symmetryWeight > 0 ? [{ label: "Symmetry (S)", value: `${Math.round(symmetryWeight * 100)}%`, color: "text-purple-700" }] : []),
                          ...(effortWeight > 0 ? [{ label: "Effort (E)", value: `${Math.round(effortWeight * 100)}%`, color: "text-orange-700" }] : []),
                          ...(gameWeight > 0 ? [{ label: "Game (G)", value: `${Math.round(gameWeight * 100)}%`, color: "text-cyan-700" }] : [])
                        ]
                      },
                      {
                        title: "Notes",
                        type: "list" as const,
                        items: [
                          { label: "Interpretation", description: "Score aggregates weighted components; 100 = optimal therapeutic performance" },
                          { label: "Configuration", description: "Adjust weights in Settings → Performance" }
                        ]
                      }
                    ]}
                    triggerClassName="ml-1"
                  />
                  </CardTitle>
                  <p className={`text-sm font-bold ${scoreTextColor} mb-2`}>{scoreLabel}</p>
                  
                  <ClinicalTooltip
                    title="Weighted Score Calculation"
                    sections={[
                      {
                        type: "table",
                        items: [
                          ...(complianceWeight > 0 ? [{ label: "Therapeutic Compliance", percentage: `${Math.round(complianceWeight * 100)}`, color: "text-green-600" }] : []),
                          ...(symmetryWeight > 0 ? [{ label: "Muscle Symmetry", percentage: `${Math.round(symmetryWeight * 100)}`, color: "text-purple-600" }] : []),
                          ...(effortWeight > 0 ? [{ label: "Subjective Effort", percentage: `${Math.round(effortWeight * 100)}`, color: "text-orange-600" }] : []),
                          ...(gameWeight > 0 ? [{ label: "Game Performance", percentage: `${Math.round(gameWeight * 100)}`, color: "text-cyan-600" }] : [])
                        ]
                      }
                    ]}
                    variant="compact"
                  >
                    <div>
                      <CircleDisplay 
                        value={totalScore} 
                        label="" 
                        color={scoreHexColor}
                        size="lg"
                        showPercentage={true}
                      />
                    </div>
                  </ClinicalTooltip>
                  <ChevronDownIcon className="absolute bottom-2 right-2 h-5 w-5 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CardHeader>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-6">
          {/* Performance Equation Component */}
          <div className="rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 p-4 border border-slate-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 text-center">Performance Formula</h4>
            
            {/* Main Formula Display - Responsive */}
            <div className="bg-white rounded-lg p-3 shadow-sm mb-3 overflow-x-auto">
              <div className="font-mono text-center min-w-fit">
                <div className="text-sm sm:text-base lg:text-lg flex items-center justify-center flex-wrap gap-1">
                  <span className="text-blue-600 font-bold">P</span>
                  <span className="mx-1 text-gray-400">=</span>
                  {complianceWeight > 0 && (
                    <>
                      <span className="text-green-600 font-semibold">C</span>
                      <span className="mx-0.5 text-gray-500">×</span>
                      <span className="text-gray-700">{complianceWeight.toFixed(2)}</span>
                    </>
                  )}
                  {symmetryWeight > 0 && (
                    <>
                      {complianceWeight > 0 && <span className="mx-1 text-gray-400">+</span>}
                      <span className="text-purple-600 font-semibold">S</span>
                      <span className="mx-0.5 text-gray-500">×</span>
                      <span className="text-gray-700">{symmetryWeight.toFixed(2)}</span>
                    </>
                  )}
                  {effortWeight > 0 && (
                    <>
                      {(complianceWeight > 0 || symmetryWeight > 0) && <span className="mx-1 text-gray-400">+</span>}
                      <span className="text-orange-600 font-semibold">E</span>
                      <span className="mx-0.5 text-gray-500">×</span>
                      <span className="text-gray-700">{effortWeight.toFixed(2)}</span>
                    </>
                  )}
                  {gameWeight > 0 && (
                    <>
                      {(complianceWeight > 0 || symmetryWeight > 0 || effortWeight > 0) && <span className="mx-1 text-gray-400">+</span>}
                      <span className="text-cyan-600 font-semibold">G</span>
                      <span className="mx-0.5 text-gray-500">×</span>
                      <span className="text-gray-700">{gameWeight.toFixed(2)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Component Values Grid - Responsive - Only show components with non-zero weights */}
            <div className={`grid gap-2 ${
              [complianceWeight, symmetryWeight, effortWeight, gameWeight].filter(w => w > 0).length === 4 ? 'grid-cols-2 sm:grid-cols-4' :
              [complianceWeight, symmetryWeight, effortWeight, gameWeight].filter(w => w > 0).length === 3 ? 'grid-cols-3' :
              [complianceWeight, symmetryWeight, effortWeight, gameWeight].filter(w => w > 0).length === 2 ? 'grid-cols-2' :
              'grid-cols-1'
            }`}>
              {complianceWeight > 0 && (
                <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm border border-green-100">
                  <div className="text-green-600 font-bold text-lg sm:text-xl">{therapeuticComplianceScore ? Math.round(therapeuticComplianceScore) : '--'}%</div>
                  <div className="text-xs text-gray-600 mt-0.5">Compliance</div>
                  <div className="text-xs text-green-600 font-semibold">(C)</div>
                </div>
              )}
              {symmetryWeight > 0 && (
                <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm border border-purple-100">
                  <div className="text-purple-600 font-bold text-lg sm:text-xl">{symmetryScore ? Math.round(symmetryScore) : '--'}%</div>
                  <div className="text-xs text-gray-600 mt-0.5">Symmetry</div>
                  <div className="text-xs text-purple-600 font-semibold">(S)</div>
                </div>
              )}
              {effortWeight > 0 && (
                <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm border border-orange-100">
                  <div className="text-orange-600 font-bold text-lg sm:text-xl">{subjectiveFatigueLevel ? Math.round(subjectiveFatigueLevel * 10) : '--'}%</div>
                  <div className="text-xs text-gray-600 mt-0.5">Exertion</div>
                  <div className="text-xs text-orange-600 font-semibold">(E)</div>
                </div>
              )}
              {gameWeight > 0 && (
                <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm border border-cyan-100">
                  <div className="text-cyan-600 font-bold text-lg sm:text-xl">{gameScore ? Math.round((gameScore / 100) * 100) : '--'}%</div>
                  <div className="text-xs text-gray-600 mt-0.5">Game</div>
                  <div className="text-xs text-cyan-600 font-semibold">(G)</div>
                </div>
              )}
            </div>
          </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
  );
};

export default OverallPerformanceCard; 