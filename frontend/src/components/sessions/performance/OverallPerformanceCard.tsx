import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { StarIcon, MixerHorizontalIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
    { name: 'Score', value: Math.min(totalScore, 100) },
    { name: 'Remaining', value: Math.max(0, 100 - totalScore) },
  ];

  const SCORE_COLORS = [scoreHexColor, '#e5e7eb'];

  return (
    <TooltipProvider>
      <Card className="bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader className="items-center">
          <CardTitle className="text-lg font-semibold flex items-center text-gray-800">
            <StarIcon className="h-5 w-5 mr-2 text-yellow-500" />
            Overall Performance Score
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoCircledIcon className="h-4 w-4 ml-1 text-gray-500 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Overall rehabilitation progress score:
                  <br /><br />
                  • Quality of Movement: How well muscles activate compared to your maximum capacity (MVC)
                  <br /><br />
                  • Exercise Completion: How many contractions you performed vs. the target
                  <br /><br />
                  This combined score helps track your progress and ensures exercises are both completed and performed correctly.
                </p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <CardDescription>Combined score based on all muscle performance</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col items-center space-y-8">
            {/* Overall score */}
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
              </div>
            </div>
            
            {/* Symmetry score as progress bar */}
            {symmetryScore !== undefined && (
              <div className="w-full max-w-md border border-gray-100 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center mb-2">
                  <div className="flex items-center gap-1.5">
                    <MixerHorizontalIcon className="h-5 w-5 text-gray-500" />
                    <h3 className="text-base font-semibold text-gray-700">Muscle Symmetry</h3>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InfoCircledIcon className="h-4 w-4 text-gray-500 ml-1 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>
                          Muscle symmetry is crucial for balanced rehabilitation:
                          <br /><br />
                          • 100%: Ideal balance - both sides working equally
                          <br />• 70-99%: Minor imbalance - typical during recovery
                          <br />• Below 70%: Significant imbalance - may need attention
                          <br /><br />
                          Based on comparing left vs. right muscle performance, considering both strength (MVC) and activation patterns.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="ml-auto text-lg font-bold text-gray-600">{symmetryScore}%</span>
                </div>
                
                <Progress 
                  value={symmetryScore} 
                  className="h-3" 
                  indicatorClassName="bg-gray-400"
                />
                
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Imbalanced</span>
                  <span>Perfect symmetry</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default OverallPerformanceCard; 