import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { StarIcon, LayersIcon, ChevronDownIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  TooltipProvider,
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface OverallPerformanceCardProps {
  totalScore: number;
  scoreLabel: string;
  scoreTextColor: string;
  scoreBgColor: string;
  scoreHexColor: string;
  muscleCount: number;
  symmetryScore?: number;
}

const OverallPerformanceCard: React.FC<OverallPerformanceCardProps> = ({
  totalScore,
  scoreLabel,
  scoreTextColor,
  scoreBgColor,
  scoreHexColor,
  muscleCount,
  symmetryScore
}) => {
  const scoreData = [
    { name: 'Score', value: totalScore },
    { name: 'Remaining', value: 100 - totalScore },
  ];

  const symmetryData = symmetryScore !== undefined ? [
    { name: 'Symmetry', value: symmetryScore },
    { name: 'Remaining', value: 100 - symmetryScore },
  ] : [];

  const SCORE_COLORS = [scoreHexColor, '#e5e7eb'];
  const SYMMETRY_COLORS = ['#6366f1', '#e5e7eb']; // Indigo color for symmetry

  return (
    <Card className="bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="items-center">
        <CardTitle className="text-lg font-semibold flex items-center text-gray-800">
          <StarIcon className="h-5 w-5 mr-2 text-yellow-500" />
          Overall Performance Score
        </CardTitle>
        <CardDescription>Combined score based on all muscle performance</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Left column - Global score */}
          <div className="flex flex-col items-center">
            <div className="relative w-44 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={scoreData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={75}
                    startAngle={90}
                    endAngle={450}
                    paddingAngle={0}
                    dataKey="value"
                    stroke="none"
                  >
                    {scoreData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={SCORE_COLORS[index % SCORE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className={`text-4xl font-bold mb-1 ${scoreTextColor}`}>{totalScore}%</span>
                {scoreLabel === "Needs Improvement" ? (
                  <div className="flex flex-col items-center leading-tight">
                    <span className={`text-base font-semibold text-center ${scoreTextColor}`}>Needs</span>
                    <span className={`text-base font-semibold text-center ${scoreTextColor}`}>Improvement</span>
                  </div>
                ) : (
                  <span className={`${scoreLabel.length > 10 ? 'text-lg' : 'text-xl'} font-semibold text-center ${scoreTextColor}`}>{scoreLabel}</span>
                )}
              </div>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <div className="absolute top-0 right-0 cursor-help">
                      <InfoCircledIcon className="h-5 w-5 text-gray-400" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p>Overall performance score combines all muscle metrics into a single value, representing your overall muscle function quality.</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Based on {muscleCount} muscle{muscleCount !== 1 ? 's' : ''}
            </p>
          </div>
          
          {/* Right column - Symmetry */}
          <div className="flex items-center justify-center">
            {symmetryScore !== undefined && (
              <div className="w-full">
                <Collapsible className="w-full">
                  <CollapsibleTrigger asChild>
                    <div className="border border-gray-200 rounded-lg p-4 flex flex-col items-center cursor-pointer hover:bg-gray-50 transition-colors group w-full">
                      <div className="relative w-44 h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={symmetryData}
                              cx="50%"
                              cy="50%"
                              innerRadius={70}
                              outerRadius={75}
                              startAngle={90}
                              endAngle={450}
                              paddingAngle={0}
                              dataKey="value"
                              stroke="none"
                            >
                              {symmetryData.map((entry, index) => (
                                <Cell key={`sym-cell-${index}`} fill={SYMMETRY_COLORS[index % SYMMETRY_COLORS.length]} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                          <span className="text-4xl font-bold text-indigo-600">{symmetryScore}%</span>
                          <span className="text-xl font-semibold text-indigo-600 text-center">Symmetry</span>
                        </div>
                        <TooltipProvider>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <div className="absolute top-0 right-0 cursor-help">
                                <InfoCircledIcon className="h-5 w-5 text-gray-400" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p>Symmetry score measures the balance between left and right muscles. 100% indicates perfect symmetry between sides.</p>
                            </TooltipContent>
                          </UITooltip>
                        </TooltipProvider>
                      </div>
                      <div className="flex items-center mt-2">
                        <p className="text-sm text-gray-500 mr-1">More details</p>
                        <ChevronDownIcon className="h-4 w-4 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="p-3 text-sm bg-gray-50 rounded-b-lg border-x border-b border-gray-200">
                      <p className="font-semibold">Muscle Symmetry</p>
                      <p className="text-gray-600 mt-1">
                        Compares performance balance. 100% is perfect symmetry.
                      </p>
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500">Formula:</p>
                        <code className="text-xs font-mono bg-gray-100 p-1 rounded">
                          (weaker / stronger) * 100
                        </code>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OverallPerformanceCard; 