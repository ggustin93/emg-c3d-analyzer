import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GameSession } from '@/types/session';
import { EMGAnalysisResult, ChannelAnalyticsData } from '@/types/emg';
import { CombinedChartDataPoint } from '@/components/EMGChart';
import { StarIcon, BarChartIcon, LightningBoltIcon } from '@radix-ui/react-icons';
import MetricCard from './metric-card';
import { Progress } from '../ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface PerformanceCardProps {
  selectedGameSession: GameSession;
  emgTimeSeriesData: CombinedChartDataPoint[];
  mvcPercentage: number;
  leftQuadChannelName: string | null;
  rightQuadChannelName: string | null;
  analysisResult: EMGAnalysisResult | null;
  contractionDurationThreshold?: number;
}

// Function to calculate score based on contractions vs expected
const calculateContractionScore = (count: number, expected: number | null): number => {
  if (!expected || expected <= 0) return 0;
  const ratio = Math.min(count / expected, 1.5); // Cap at 150%
  return Math.min(Math.round(ratio * 100), 100); // Cap at 100%
};

// Function to calculate score based on good contractions vs total
const calculateGoodContractionScore = (goodCount: number, totalCount: number): number => {
  if (totalCount <= 0) return 0;
  const ratio = goodCount / totalCount;
  return Math.round(ratio * 100);
};

// Calculate total score: average of the two subscores
const calculateTotalScore = (subscore1: number, subscore2: number): number => {
  return Math.round((subscore1 + subscore2) / 2);
};

// Calculate overall performance score: average of all muscle scores
const calculateOverallScore = (muscleScores: number[]): number => {
  if (muscleScores.length === 0) return 0;
  const sum = muscleScores.reduce((a, b) => a + b, 0);
  return Math.round(sum / muscleScores.length);
};

// Function to get score label based on percentage
const getScoreLabel = (score: number): { label: string; color: string } => {
  if (score >= 90) return { label: "Excellent", color: "text-green-600" };
  if (score >= 75) return { label: "Good", color: "text-emerald-500" };
  if (score >= 60) return { label: "Satisfactory", color: "text-amber-500" };
  if (score >= 40) return { label: "Needs Improvement", color: "text-orange-500" };
  return { label: "Insufficient", color: "text-red-500" };
};

interface MuscleScoreProps {
  channelName: string;
  channelData?: ChannelAnalyticsData;
  expectedContractions: number | null;
  contractionDurationThreshold: number;
}

const MuscleScoreCard: React.FC<MuscleScoreProps> = ({ 
  channelName, 
  channelData, 
  expectedContractions,
  contractionDurationThreshold 
}) => {
  if (!channelData) return null;
  
  const totalContractions = channelData.contraction_count || 0;
  const goodContractions = channelData.good_contraction_count || 0;
  
  // Calculate scores
  const contractionScore = calculateContractionScore(totalContractions, expectedContractions);
  const goodContractionScore = calculateGoodContractionScore(goodContractions, totalContractions);
  const totalScore = calculateTotalScore(contractionScore, goodContractionScore);
  const scoreDetails = getScoreLabel(totalScore);
  
  // Count short and long contractions
  let shortContractions = 0;
  let longContractions = 0;
  let shortGoodContractions = 0;
  let longGoodContractions = 0;

  if (channelData.contractions && Array.isArray(channelData.contractions)) {
    channelData.contractions.forEach(contraction => {
      if (contraction.duration_ms < contractionDurationThreshold) {
        shortContractions++;
        if (contraction.is_good) shortGoodContractions++;
      } else {
        longContractions++;
        if (contraction.is_good) longGoodContractions++;
      }
    });
  }

  const hasContractionTypeData = shortContractions > 0 || longContractions > 0;
  
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">
          {channelName} Performance: {totalScore}% <span className={scoreDetails.color}>({scoreDetails.label})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Subscore 1: Contraction Count */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-medium">Contraction Count</div>
              <div className="text-sm font-bold">{contractionScore}%</div>
            </div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-muted-foreground">
                {totalContractions} contractions out of {expectedContractions ?? 'N/A'} expected
              </div>
            </div>
            <Progress value={contractionScore} className="h-1.5" />
          </div>
          
          {/* Subscore 2: Contraction Quality */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-medium">Contraction Quality</div>
              <div className="text-sm font-bold">{goodContractionScore}%</div>
            </div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-muted-foreground">
                {goodContractions} good contractions out of {totalContractions} total
              </div>
            </div>
            <Progress value={goodContractionScore} className="h-1.5" />
          </div>

          {/* Contraction Type Breakdown */}
          {hasContractionTypeData && (
            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100">
              <div className="p-2 bg-slate-50 rounded text-xs">
                <div className="font-medium mb-1">Short (&lt;{contractionDurationThreshold}ms)</div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total: {shortContractions}</span>
                  <span className="text-muted-foreground">Good: {shortGoodContractions}</span>
                </div>
              </div>
              <div className="p-2 bg-slate-50 rounded text-xs">
                <div className="font-medium mb-1">Long (≥{contractionDurationThreshold}ms)</div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total: {longContractions}</span>
                  <span className="text-muted-foreground">Good: {longGoodContractions}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default function PerformanceCard({
  selectedGameSession,
  emgTimeSeriesData,
  mvcPercentage,
  leftQuadChannelName,
  rightQuadChannelName,
  analysisResult,
  contractionDurationThreshold = 1000,
}: PerformanceCardProps) {
  if (!analysisResult) return null;
  
  // Get data for each channel
  const leftChannelData = leftQuadChannelName ? analysisResult.analytics[leftQuadChannelName] : undefined;
  const rightChannelData = rightQuadChannelName ? analysisResult.analytics[rightQuadChannelName] : undefined;
  
  // Get expected contractions for each channel
  const leftExpectedContractions = analysisResult?.metadata.session_parameters_used?.session_expected_contractions_ch1 ?? 
                                  analysisResult?.metadata.session_parameters_used?.session_expected_contractions ?? null;
                                  
  const rightExpectedContractions = analysisResult?.metadata.session_parameters_used?.session_expected_contractions_ch2 ?? 
                                   analysisResult?.metadata.session_parameters_used?.session_expected_contractions ?? null;
  
  // Calculate individual muscle scores
  const muscleScores: number[] = [];
  
  if (leftChannelData) {
    const leftContractionScore = calculateContractionScore(
      leftChannelData.contraction_count || 0, 
      leftExpectedContractions
    );
    const leftGoodContractionScore = calculateGoodContractionScore(
      leftChannelData.good_contraction_count || 0, 
      leftChannelData.contraction_count || 0
    );
    muscleScores.push(calculateTotalScore(leftContractionScore, leftGoodContractionScore));
  }
  
  if (rightChannelData) {
    const rightContractionScore = calculateContractionScore(
      rightChannelData.contraction_count || 0, 
      rightExpectedContractions
    );
    const rightGoodContractionScore = calculateGoodContractionScore(
      rightChannelData.good_contraction_count || 0, 
      rightChannelData.contraction_count || 0
    );
    muscleScores.push(calculateTotalScore(rightContractionScore, rightGoodContractionScore));
  }
  
  // Calculate overall performance score
  const overallScore = calculateOverallScore(muscleScores);
  const overallScoreDetails = getScoreLabel(overallScore);

  // Get the contraction duration threshold from session parameters
  const durationThreshold = analysisResult?.metadata.session_parameters_used?.contraction_duration_threshold ?? contractionDurationThreshold;

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Overall Performance Score */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center">
            <StarIcon className="h-4 w-4 mr-2" /> Overall Performance Score
          </CardTitle>
          <CardDescription>Combined score based on all muscle performance</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
            <div className="mb-3 md:mb-0">
              <h4 className="text-lg font-semibold">{overallScoreDetails.label}</h4>
              <p className="text-sm text-muted-foreground">
                Based on {muscleScores.length} muscle{muscleScores.length !== 1 ? 's' : ''}
              </p>
            </div>
            {/* Circular progress indicator */}
            <div className="relative w-24 h-24">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle 
                  cx="50" cy="50" r="40" 
                  fill="transparent" 
                  stroke="#e5e7eb" 
                  strokeWidth="8"
                />
                {/* Progress circle */}
                <circle 
                  cx="50" cy="50" r="40" 
                  fill="transparent" 
                  stroke="currentColor" 
                  strokeWidth="8" 
                  strokeDasharray={2 * Math.PI * 40}
                  strokeDashoffset={2 * Math.PI * 40 - (overallScore / 100) * 2 * Math.PI * 40}
                  strokeLinecap="round"
                  className={overallScoreDetails.color}
                  transform="rotate(-90 50 50)"
                />
                {/* Percentage text */}
                <text 
                  x="50" y="45" 
                  textAnchor="middle" 
                  fontSize="18" 
                  fontWeight="bold"
                  fill="currentColor"
                >
                  {overallScore}%
                </text>
                <text 
                  x="50" y="65" 
                  textAnchor="middle" 
                  fontSize="12"
                  className={overallScoreDetails.color}
                >
                  {overallScoreDetails.label}
                </text>
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Muscle Scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Muscle */}
        {leftQuadChannelName && (
          <div>
            <MuscleScoreCard 
              channelName={leftQuadChannelName}
              channelData={leftChannelData}
              expectedContractions={leftExpectedContractions}
              contractionDurationThreshold={durationThreshold}
            />
          </div>
        )}
        
        {/* Right Muscle */}
        {rightQuadChannelName && (
          <div>
            <MuscleScoreCard 
              channelName={rightQuadChannelName}
              channelData={rightChannelData}
              expectedContractions={rightExpectedContractions}
              contractionDurationThreshold={durationThreshold}
            />
          </div>
        )}
      </div>

      {/* Contraction Metrics */}
      <Collapsible>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-2 bg-slate-50 rounded-md hover:bg-slate-100 transition-colors">
            <span className="text-sm font-medium">Detailed Contraction Metrics</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="chevron-down">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {leftChannelData && (
              <MetricCard
                title={`${leftQuadChannelName} Contractions`}
                value={leftChannelData.contraction_count}
                unit=""
                isInteger={true}
                description={`${leftChannelData.good_contraction_count || 0} good out of ${leftChannelData.contraction_count} total`}
                icon={<BarChartIcon className="h-4 w-4" />}
              />
            )}
            
            {rightChannelData && (
              <MetricCard
                title={`${rightQuadChannelName} Contractions`}
                value={rightChannelData.contraction_count}
                unit=""
                isInteger={true}
                description={`${rightChannelData.good_contraction_count || 0} good out of ${rightChannelData.contraction_count} total`}
                icon={<LightningBoltIcon className="h-4 w-4" />}
              />
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
} 