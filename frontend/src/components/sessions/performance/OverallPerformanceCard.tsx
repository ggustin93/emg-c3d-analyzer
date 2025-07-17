import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { StarIcon, MixerHorizontalIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import SubjectiveFatigueCard from './SubjectiveFatigueCard';
import MuscleSymmetryCard from './MuscleSymmetryCard';

interface OverallPerformanceCardProps {
  totalScore: number;
  scoreLabel: string;
  scoreTextColor: string;
  scoreBgColor: string;
  scoreHexColor: string;
  muscleCount: number;
  symmetryScore?: number;
  subjectiveFatigueLevel?: number;
}

const OverallPerformanceCard: React.FC<OverallPerformanceCardProps> = ({
  totalScore,
  scoreLabel,
  scoreTextColor,
  scoreBgColor,
  scoreHexColor,
  muscleCount,
  symmetryScore,
  subjectiveFatigueLevel
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
            
            {/* Additional metrics section */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Symmetry score now uses the dedicated component */}
              {symmetryScore !== undefined && (
                <MuscleSymmetryCard symmetryScore={symmetryScore} />
              )}
              
              {/* Subjective fatigue card */}
              {subjectiveFatigueLevel !== undefined && (
                <SubjectiveFatigueCard 
                  fatigueLevel={subjectiveFatigueLevel} 
                  showBadge={true}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default OverallPerformanceCard; 