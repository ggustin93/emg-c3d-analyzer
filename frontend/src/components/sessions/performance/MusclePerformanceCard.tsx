import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDownIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import ContractionTypeBreakdown from './ContractionTypeBreakdown';
import { GameSessionParameters } from '../../../types/emg';
import MuscleNameDisplay from '../../MuscleNameDisplay';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MusclePerformanceCardProps {
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
}

const getScoreColors = (score: number) => {
  if (score >= 100) {
    return {
      text: 'text-green-700',
      bg: 'bg-green-600',
      hex: '#16a34a'
    };
  } else if (score >= 80) {
    return {
      text: 'text-blue-700',
      bg: 'bg-blue-600',
      hex: '#2563eb'
    };
  } else if (score >= 60) {
    return {
      text: 'text-yellow-700',
      bg: 'bg-yellow-600',
      hex: '#ca8a04'
    };
  } else {
    return {
      text: 'text-red-700',
      bg: 'bg-red-600',
      hex: '#dc2626'
    };
  }
};

const MusclePerformanceCard: React.FC<MusclePerformanceCardProps> = ({
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
  contractionDurationThreshold = 250,
  sessionParams
}) => {
  const [isCountDetailsOpen, setIsCountDetailsOpen] = useState(false);
  const [isQualityDetailsOpen, setIsQualityDetailsOpen] = useState(false);

  const scoreData = [
    { name: 'Score', value: totalScore },
    { name: 'Remaining', value: 100 - totalScore },
  ];

  const COLORS = [scoreHexColor, '#e5e7eb'];
  
  // Common component for circle displays
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
    
    // For display purposes
    const calculatedPercentage = total && total > 0 ? Math.round((value / total) * 100) : value;
    const displayValue = showPercentage ? `${calculatedPercentage}%` : value.toString();
    
    // For filling the gauge - if no total, fill to 100%
    const fillPercentage = total && total > 0 
      ? (value >= total ? 100 : Math.round((value / total) * 100))
      : 100;
    
    const data = [
      { name: 'Value', value: fillPercentage },
      { name: 'Remaining', value: Math.max(0, 100 - fillPercentage) },
    ];
    
    return (
      <div className="flex flex-col items-center">
        <div className={cn("relative", sizeClass[size])}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[{ value: fillPercentage }, { value: 100 - fillPercentage }]}
                cx="50%"
                cy="50%"
                innerRadius={size === "sm" ? 25 : size === "md" ? 35 : 45}
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
              {showPercentage ? displayValue : value}
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

  // Calculate contraction count score
  const contractionCountScore = expectedContractions ? Math.min(Math.round((totalContractions / expectedContractions) * 100), 100) : 0;
  const contractionColors = getScoreColors(contractionCountScore);

  return (
    <TooltipProvider>
      <Card className="bg-white shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
        <CardHeader className="flex flex-col items-center text-center pb-4">
          <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-1">
            {sessionParams ? (
              <MuscleNameDisplay channelName={channel} sessionParams={sessionParams} />
            ) : (
              channel
            )} Performance
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoCircledIcon className="h-4 w-4 text-gray-500 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p>Performance score for this specific muscle, combining contraction count and quality metrics</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <p className={`text-sm font-bold ${scoreTextColor} mb-2`}>{scoreLabel}</p>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <CircleDisplay 
                  value={totalScore} 
                  label="" 
                  color={scoreHexColor} 
                  size="lg"
                  showPercentage={true}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p>Overall score calculated as the average between:
                <br />• Contraction count subscore
                <br />• Contraction quality subscore (based on MVC)
              </p>
            </TooltipContent>
          </Tooltip>
        </CardHeader>
        <CardContent className="pt-0 space-y-6">
          {/* Contraction Count */}
          <div className="rounded-md bg-slate-50 p-4">
            <Collapsible open={isCountDetailsOpen} onOpenChange={setIsCountDetailsOpen}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <h4 className="text-sm font-semibold text-gray-700">Contraction Count</h4>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InfoCircledIcon className="h-4 w-4 text-gray-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p>Number of muscle contractions detected during the session compared to expected count</p>
                    </TooltipContent>
                  </Tooltip>
                  <CollapsibleTrigger className="ml-1 rounded-full hover:bg-slate-200 p-0.5 transition-colors">
                    <ChevronDownIcon className="h-4 w-4 text-gray-500 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                </div>
                {contractionScore !== null ? (
                  <span className={`text-sm font-bold ${contractionColors.text}`}>{contractionScore}%</span>
                ) : (
                  <span className="text-sm font-bold text-gray-400">N/A</span>
                )}
              </div>
              
              {contractionScore !== null && (
                <>
                  <Progress 
                    value={contractionScore} 
                    className="h-2" 
                    indicatorClassName={`${contractionColors.bg} opacity-80`} 
                  />
                  <p className="text-xs text-gray-500 text-center mt-1">
                    {totalContractions} of {expectedContractions ?? 'N/A'} expected
                  </p>
                </>
              )}

              <CollapsibleContent className="pt-2 space-y-4">
                <div className="flex justify-around items-center">
                  <CircleDisplay 
                    value={contractionCount} 
                    total={expectedContractions ?? undefined}
                    label="Performed" 
                    color={contractionColors.hex} 
                    size="md"
                    showPercentage={false}
                    showExpected={true}
                  />
                  
                  <div className="flex flex-col items-center">
                    <span className={`text-2xl font-bold ${contractionColors.text}`}>{contractionScore}%</span>
                  </div>
                </div>

                {/* Breakdown of contraction count */}
                <div className="text-xs text-center text-gray-500">
                  <p>Performed <span className="font-bold">{contractionCount}</span> out of <span className="font-bold">{expectedContractions ?? 'N/A'}</span> expected contractions.</p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Contraction Quality */}
          <div className="rounded-md bg-slate-50 p-4">
            <Collapsible open={isQualityDetailsOpen} onOpenChange={setIsQualityDetailsOpen}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <h4 className="text-sm font-semibold text-gray-700">Contraction Quality</h4>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InfoCircledIcon className="h-4 w-4 text-gray-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p>Percentage of contractions that met the required MVC threshold, indicating good quality.</p>
                    </TooltipContent>
                  </Tooltip>
                  <CollapsibleTrigger className="ml-1 rounded-full hover:bg-slate-200 p-0.5 transition-colors">
                    <ChevronDownIcon className="h-4 w-4 text-gray-500 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                </div>
                {goodContractionCount !== null && totalContractions > 0 ? (
                  <span className={`text-sm font-bold ${getScoreColors(Math.round((goodContractionCount / totalContractions) * 100)).text}`}>
                    {Math.round((goodContractionCount / totalContractions) * 100)}%
                  </span>
                ) : (
                  <span className="text-sm font-bold text-gray-400">N/A</span>
                )}
              </div>
              
              {goodContractionCount !== null && totalContractions > 0 && (
                <>
                  <Progress 
                    value={(goodContractionCount / totalContractions) * 100} 
                    className="h-2" 
                    indicatorClassName={`${getScoreColors(Math.round((goodContractionCount / totalContractions) * 100)).bg} opacity-80`} 
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
                    color={getScoreColors(Math.round((goodContractionCount / totalContractions) * 100)).hex} 
                    size="md"
                    showPercentage={false}
                    showExpected={true}
                  />
                </div>
                <div className="text-xs text-center text-gray-500">
                  <p><span className="font-bold">{goodContractionCount}</span> of <span className="font-bold">{totalContractions}</span> contractions met the quality threshold.</p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
          
          {/* Contraction Type Breakdown */}
          <div className="rounded-md bg-slate-50 p-4">
            <ContractionTypeBreakdown
              shortContractions={shortContractions}
              shortGoodContractions={shortGoodContractions}
              longContractions={longContractions}
              longGoodContractions={longGoodContractions}
              expectedShortContractions={expectedShortContractions}
              expectedLongContractions={expectedLongContractions}
              contractionDurationThreshold={contractionDurationThreshold}
              color={scoreHexColor}
            />
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default MusclePerformanceCard; 