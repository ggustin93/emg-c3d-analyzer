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
  const [isExpanded, setIsExpanded] = useState(true);
  const { sessionParams } = useSessionStore();
  
  // Get weights from session store or use defaults
  const weights = sessionParams.enhanced_scoring?.weights || DEFAULT_SCORING_WEIGHTS;
  
  // Map weight keys to our component values
  const complianceWeight = weights.compliance || 0.40;
  const symmetryWeight = weights.symmetry || 0.25;
  const effortWeight = weights.effort || 0.20;
  const gameWeight = weights.gameScore || 0.15;
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
                    description="Real-time, objective assessment of rehabilitation effectiveness during game-based therapy sessions"
                    sections={[
                      {
                        title: "Evidence-Based Components:",
                        type: "list",
                        items: [
                          { percentage: `${Math.round(complianceWeight * 100)}`, label: "Therapeutic Compliance", description: "Exercise execution quality", color: "text-green-600" },
                          { percentage: `${Math.round(symmetryWeight * 100)}`, label: "Muscle Symmetry", description: "Bilateral balance assessment", color: "text-purple-600" },
                          { percentage: `${Math.round(effortWeight * 100)}`, label: "Subjective Effort", description: "RPE-based exertion evaluation", color: "text-orange-600" },
                          { percentage: `${Math.round(gameWeight * 100)}`, label: "Game Performance", description: "Normalized engagement metric", color: "text-cyan-600" }
                        ]
                      },
                    
                      ...(totalContractions > 0 || expectedContractions ? [{
                        title: "Current Session Data:",
                        type: "table" as const,
                        items: [
                          ...(expectedContractions ? [{ label: "Expected", value: `${expectedContractions} per muscle` }] : []),
                          { label: "Completed", value: `${totalContractions} total` },
                          { label: "MVC Quality", value: `${goodContractions}/${totalContractions} (≥75%)` },
                          ...(averageContractionTime ? [{ label: "Avg. Duration", value: `${(averageContractionTime / 1000).toFixed(1)}s` }] : [])
                        ]
                      }] : []),
                    
                      {
                        title: "Clinical Interpretation:",
                        type: "list",
                        items: [
                          { percentage: "≥90", description: "Excellent - Optimal therapeutic benefit", color: "text-emerald-600" },
                          { percentage: "80-89", description: "Good - Effective therapy", color: "text-green-600" },
                          { percentage: "70-79", description: "Moderate - Benefit achieved", color: "text-yellow-600" },
                          { percentage: "60-69", description: "Fair - Modifications needed", color: "text-orange-600" },
                          { percentage: "<60", description: "Poor - Review required", color: "text-red-600" }
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
                          { label: "Therapeutic Compliance", percentage: `${Math.round(complianceWeight * 100)}`, color: "text-green-600" },
                          { label: "Muscle Symmetry", percentage: `${Math.round(symmetryWeight * 100)}`, color: "text-purple-600" },
                          { label: "Subjective Effort", percentage: `${Math.round(effortWeight * 100)}`, color: "text-orange-600" },
                          { label: "Game Performance", percentage: `${Math.round(gameWeight * 100)}`, color: "text-cyan-600" }
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
                  <span className="text-green-600 font-semibold">C</span>
                  <span className="mx-0.5 text-gray-500">×</span>
                  <span className="text-gray-700">{complianceWeight.toFixed(2)}</span>
                  <span className="mx-1 text-gray-400">+</span>
                  <span className="text-purple-600 font-semibold">S</span>
                  <span className="mx-0.5 text-gray-500">×</span>
                  <span className="text-gray-700">{symmetryWeight.toFixed(2)}</span>
                  <span className="mx-1 text-gray-400">+</span>
                  <span className="text-orange-600 font-semibold">E</span>
                  <span className="mx-0.5 text-gray-500">×</span>
                  <span className="text-gray-700">{effortWeight.toFixed(2)}</span>
                  <span className="mx-1 text-gray-400">+</span>
                  <span className="text-cyan-600 font-semibold">G</span>
                  <span className="mx-0.5 text-gray-500">×</span>
                  <span className="text-gray-700">{gameWeight.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Component Values Grid - Responsive */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm border border-green-100">
                <div className="text-green-600 font-bold text-lg sm:text-xl">{therapeuticComplianceScore ? Math.round(therapeuticComplianceScore) : '--'}%</div>
                <div className="text-xs text-gray-600 mt-0.5">Compliance</div>
                <div className="text-xs text-green-600 font-semibold">(C)</div>
              </div>
              <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm border border-purple-100">
                <div className="text-purple-600 font-bold text-lg sm:text-xl">{symmetryScore ? Math.round(symmetryScore) : '--'}%</div>
                <div className="text-xs text-gray-600 mt-0.5">Symmetry</div>
                <div className="text-xs text-purple-600 font-semibold">(S)</div>
              </div>
              <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm border border-orange-100">
                <div className="text-orange-600 font-bold text-lg sm:text-xl">{subjectiveFatigueLevel ? Math.round(subjectiveFatigueLevel * 10) : '--'}%</div>
                <div className="text-xs text-gray-600 mt-0.5">Exertion</div>
                <div className="text-xs text-orange-600 font-semibold">(E)</div>
              </div>
              <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm border border-cyan-100">
                <div className="text-cyan-600 font-bold text-lg sm:text-xl">{gameScore ? Math.round((gameScore / 100) * 100) : '--'}%</div>
                <div className="text-xs text-gray-600 mt-0.5">Game</div>
                <div className="text-xs text-cyan-600 font-semibold">(G)</div>
              </div>
            </div>
          </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
  );
};

export default OverallPerformanceCard; 