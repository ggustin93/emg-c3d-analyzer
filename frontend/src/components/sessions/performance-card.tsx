import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GameSession } from '@/types/session';
import { EMGAnalysisResult } from '@/types/emg';
import { CombinedChartDataPoint } from '@/components/EMGChart';
import { StarIcon, ClockIcon, BarChartIcon, LightningBoltIcon, CodeIcon } from '@radix-ui/react-icons';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as PieTooltip } from 'recharts';
import MetricCard from './metric-card';
import { Progress } from '../ui/progress';

interface PerformanceCardProps {
  selectedGameSession: GameSession;
  emgTimeSeriesData: CombinedChartDataPoint[];
  mvcPercentage: number;
  leftQuadChannelName: string | null;
  rightQuadChannelName: string | null;
  analysisResult: EMGAnalysisResult | null;
}

const calculatePerformanceScore = (goodCount: number, expectedCount: number | null): number => {
  if (!expectedCount || expectedCount <= 0) return 0;
  const ratio = goodCount / expectedCount;
  return Math.min(Math.round(ratio * 100), 100);
};

const getScoreLabel = (score: number): { label: string; color: string } => {
  if (score >= 90) return { label: "Excellent", color: "text-green-600" };
  if (score >= 75) return { label: "Good", color: "text-emerald-500" };
  if (score >= 60) return { label: "Satisfactory", color: "text-amber-500" };
  if (score >= 40) return { label: "Needs Improvement", color: "text-orange-500" };
  return { label: "Insufficient", color: "text-red-500" };
};

export default function PerformanceCard({
  selectedGameSession,
  emgTimeSeriesData,
  mvcPercentage,
  leftQuadChannelName,
  rightQuadChannelName,
  analysisResult,
}: PerformanceCardProps) {
  const goodContractions = analysisResult?.analytics[leftQuadChannelName || '']?.good_contraction_count ?? 0;
  const expectedContractions = analysisResult?.metadata.session_parameters_used?.session_expected_contractions ?? null;
  const performanceScore = calculatePerformanceScore(goodContractions, expectedContractions);
  const scoreDetails = getScoreLabel(performanceScore);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center">
            <StarIcon className="h-4 w-4 mr-2" /> Performance Score
          </CardTitle>
          <CardDescription>Score based on good contractions vs. expected contractions.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
            <div className="mb-3 md:mb-0">
              <h4 className="text-lg font-semibold">{scoreDetails.label}</h4>
              <p className="text-sm text-muted-foreground">
                {goodContractions} good contractions out of {expectedContractions} expected
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="text-3xl font-bold">{performanceScore}%</div>
            </div>
          </div>
          <Progress value={performanceScore} className="h-2" />
        </CardContent>
      </Card>

      <div className="lg:col-span-1 space-y-4">
        <MetricCard
          title="Good Contractions"
          value={goodContractions}
          unit={`/ ${expectedContractions}`}
          isInteger={true}
          description="Contractions meeting MVC threshold"
          icon={<LightningBoltIcon className="h-4 w-4" />}
        />
        <MetricCard
          title="Duration"
          value={(selectedGameSession.statistics?.duration || 0) / 60}
          unit="min"
          description="Total gameplay time"
          icon={<ClockIcon className="h-4 w-4" />}
        />
        <MetricCard
          title="Level"
          value={selectedGameSession.statistics?.levelsCompleted || 0}
          description="Game progression"
          icon={<BarChartIcon className="h-4 w-4" />}
          unit=""
          isInteger
        />
      </div>
    </div>
  );
} 