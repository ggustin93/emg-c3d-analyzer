import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { StarIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import ClinicalTooltip from '@/components/ui/clinical-tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useScoreColors } from '@/hooks/useScoreColors';
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
                          { percentage: "40", label: "Therapeutic Compliance", description: "Exercise execution quality", color: "text-green-600" },
                          { percentage: "25", label: "Muscle Symmetry", description: "Bilateral balance assessment", color: "text-purple-600" },
                          { percentage: "20", label: "Subjective Effort", description: "RPE-based exertion evaluation", color: "text-orange-600" },
                          { percentage: "15", label: "Game Performance", description: "Normalized engagement metric", color: "text-cyan-600" }
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
                          { label: "Therapeutic Compliance", percentage: "40", color: "text-green-600" },
                          { label: "Muscle Symmetry", percentage: "25", color: "text-purple-600" },
                          { label: "Subjective Effort", percentage: "20", color: "text-orange-600" },
                          { label: "Game Performance", percentage: "15", color: "text-cyan-600" }
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
          {/* Expandable Performance Equation Component */}
          <div className="rounded-md bg-slate-50 p-4">
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <h4 className="text-sm font-semibold text-gray-700">Performance Formula</h4>
                  <CollapsibleTrigger className="ml-1 rounded-full hover:bg-slate-200 p-0.5 transition-colors">
                    <ChevronDownIcon className="h-4 w-4 text-gray-500 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                </div>
                <div className="font-mono text-sm text-slate-800">
                  <span className="text-blue-600">P</span> = 
                  <span className="text-green-600 mx-1">C</span> × 0.4 + 
                  <span className="text-purple-600 mx-1">S</span> × 0.25 + 
                  <span className="text-orange-600 mx-1">E</span> × 0.2 + 
                  <span className="text-cyan-600 mx-1">G</span> × 0.15
                </div>
              </div>
              
              <CollapsibleContent className="pt-2 space-y-4">
                <div className="text-xs text-slate-500 space-y-2">
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div className="bg-white p-3 rounded border">
                      <div className="text-green-600 font-bold text-lg">{therapeuticComplianceScore ? Math.round(therapeuticComplianceScore) : '--'}%</div>
                      <div className="text-xs mt-1">Compliance (C)</div>
                    </div>
                    <div className="bg-white p-3 rounded border">
                      <div className="text-purple-600 font-bold text-lg">{symmetryScore ? Math.round(symmetryScore) : '--'}%</div>
                      <div className="text-xs mt-1">Symmetry (S)</div>
                    </div>
                    <div className="bg-white p-3 rounded border">
                      <div className="text-orange-600 font-bold text-lg">{subjectiveFatigueLevel ? Math.round(subjectiveFatigueLevel * 10) : '--'}%</div>
                      <div className="text-xs mt-1">Exertion (E)</div>
                    </div>
                    <div className="bg-white p-3 rounded border">
                      <div className="text-cyan-600 font-bold text-lg">{gameScore ? Math.round((gameScore / 100) * 100) : '--'}%</div>
                      <div className="text-xs mt-1">Game (G)</div>
                    </div>
                  </div>
                  
                  <div className="pt-3 border-t border-slate-300 mt-3">
                    <div className="text-center text-slate-600 font-medium mb-2">Calculation Breakdown</div>
                    <div className="font-mono text-xs bg-white p-3 rounded border text-center">
                      <span className="text-blue-600 font-bold">{Math.round((therapeuticComplianceScore || 0) * 0.4 + (symmetryScore || 0) * 0.25 + (subjectiveFatigueLevel ? subjectiveFatigueLevel * 10 : 0) * 0.2 + (gameScore ? (gameScore / 100) * 100 : 0) * 0.15)}%</span> = 
                      <span className="text-green-600">{therapeuticComplianceScore ? Math.round(therapeuticComplianceScore) : '--'}</span> × 0.4 + 
                      <span className="text-purple-600">{symmetryScore ? Math.round(symmetryScore) : '--'}</span> × 0.25 + 
                      <span className="text-orange-600">{subjectiveFatigueLevel ? Math.round(subjectiveFatigueLevel * 10) : '--'}</span> × 0.2 + 
                      <span className="text-cyan-600">{gameScore ? Math.round((gameScore / 100) * 100) : '--'}</span> × 0.15
                    </div>
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

export default OverallPerformanceCard; 