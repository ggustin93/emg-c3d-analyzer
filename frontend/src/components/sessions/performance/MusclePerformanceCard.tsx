import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import ContractionTypeBreakdown from './ContractionTypeBreakdown';
import { GameSessionParameters } from '../../../types/emg';
import MuscleNameDisplay from '../../MuscleNameDisplay';

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
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const scoreData = [
    { name: 'Score', value: totalScore },
    { name: 'Remaining', value: 100 - totalScore },
  ];

  const COLORS = [scoreHexColor, '#e5e7eb'];
  
  // Create a custom progress bar class with lighter color
  const getProgressBarClass = () => {
    // Use a custom class for the indicator
    return "bg-opacity-70";
  };

  return (
    <Card className="bg-white shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
      <CardHeader>
        <div className="flex justify-between items-start gap-4">
          <div>
            <CardTitle className="text-lg font-semibold text-gray-800">
              {sessionParams ? (
                <MuscleNameDisplay channelName={channel} sessionParams={sessionParams} />
              ) : (
                channel
              )} Performance
            </CardTitle>
            <p className={`text-sm font-bold ${scoreTextColor}`}>{scoreLabel}</p>
          </div>
          <div className="relative w-24 h-24 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={scoreData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={45}
                  startAngle={90}
                  endAngle={450}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill={COLORS[0]} />
                  <Cell fill={COLORS[1]} />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-2xl font-bold ${scoreTextColor}`}>{totalScore}%</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          {/* Contraction Quality */}
          <div>
            <Collapsible>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center">
                  <h4 className="text-sm font-semibold text-gray-700">Contraction Quality</h4>
                  <CollapsibleTrigger className="ml-1">
                    <ChevronDownIcon className="h-4 w-4 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                </div>
                <span className={`text-sm font-bold ${scoreTextColor}`}>
                  {Math.round((goodContractionCount / totalContractions) * 100) || 0}%
                </span>
              </div>
              <Progress 
                value={totalContractions > 0 ? (goodContractionCount / totalContractions) * 100 : 0} 
                className="h-2.5" 
                indicatorClassName={`${scoreBgColor} opacity-70`}
              />
              <p className="text-xs text-gray-500 mt-1">{goodContractionCount} good out of {totalContractions} total</p>
              
              <CollapsibleContent className="pt-2 mt-2">
                <div className="p-4 bg-gray-50 border-t border-gray-100 text-sm">
                  <p className="text-xs text-gray-600">
                    Contraction quality is measured using Maximum Voluntary Contraction (MVC) as a reference. 
                    A contraction is considered "good" when it exceeds the MVC threshold percentage set in the session parameters.
                    The quality score represents the percentage of contractions that successfully met or exceeded this threshold.
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Contraction Count (Collapsible) */}
          <Collapsible onOpenChange={setIsDetailsOpen}>
            <CollapsibleTrigger className="w-full text-left group">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                    Contraction Count
                    <ChevronDownIcon className="ml-1 h-4 w-4 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </h4>
                  {contractionScore !== null ? (
                    <span className={`text-sm font-bold ${scoreTextColor}`}>{contractionScore}%</span>
                  ) : (
                    <span className="text-sm font-bold text-gray-400">N/A</span>
                  )}
                </div>
                {contractionScore !== null ? (
                  <Progress 
                    value={contractionScore} 
                    className="h-2.5" 
                    indicatorClassName={`${scoreBgColor} opacity-70`}
                  />
                ) : (
                  <div className="h-2.5 bg-gray-200 rounded-full w-full" />
                )}
                <p className="text-xs text-gray-500">
                  {expectedContractions ? `${totalContractions} of ${expectedContractions} expected` : 'No expected count set'}
                </p>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="p-4 bg-gray-50 border-t border-gray-100">
                <ContractionTypeBreakdown
                  shortContractions={shortContractions}
                  shortGoodContractions={shortGoodContractions}
                  longContractions={longContractions}
                  longGoodContractions={longGoodContractions}
                  expectedShortContractions={expectedShortContractions}
                  expectedLongContractions={expectedLongContractions}
                  durationThreshold={contractionDurationThreshold}
                  color={scoreHexColor}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>
    </Card>
  );
};

export default MusclePerformanceCard; 