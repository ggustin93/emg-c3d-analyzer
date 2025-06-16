import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { StarIcon, LayersIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  const data = [
    { name: 'Score', value: totalScore },
    { name: 'Remaining', value: 100 - totalScore },
  ];

  const COLORS = [scoreHexColor, '#e5e7eb'];

  return (
    <Card className="bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="items-center">
        <CardTitle className="text-lg font-semibold flex items-center text-gray-800">
          <StarIcon className="h-5 w-5 mr-2 text-yellow-500" />
          Overall Performance Score
        </CardTitle>
        <CardDescription>Combined score based on all muscle performance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-x-12 gap-y-6">
          <div className="relative w-32 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={60}
                  startAngle={90}
                  endAngle={450}
                  paddingAngle={0}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-3xl font-bold ${scoreTextColor}`}>{totalScore}%</span>
            </div>
          </div>
          <div className="text-center sm:text-left">
            <h3 className={`text-2xl font-bold ${scoreTextColor}`}>{scoreLabel}</h3>
            <p className="text-sm text-gray-500">
              Based on {muscleCount} muscle{muscleCount !== 1 ? 's' : ''}
            </p>
            {symmetryScore !== undefined && (
              <Collapsible className="mt-4">
                <CollapsibleTrigger asChild>
                  <div className="border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-x-3 cursor-pointer hover:bg-gray-50 transition-colors group w-full">
                    <div className="flex items-center gap-x-3">
                      <LayersIcon className="h-6 w-6 text-gray-500" />
                      <div>
                        <p className="font-semibold text-gray-700">{symmetryScore}%</p>
                        <p className="text-xs text-gray-500 text-left">Symmetry</p>
                      </div>
                    </div>
                    <ChevronDownIcon className="h-4 w-4 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
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
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OverallPerformanceCard; 