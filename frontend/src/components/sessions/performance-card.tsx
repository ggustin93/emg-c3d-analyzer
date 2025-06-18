import { GameSession } from '@/types/session';
import { EMGAnalysisResult, GameSessionParameters } from '../../types/emg';
// import OverallPerformanceCard from './performance/OverallPerformanceCard';
import MusclePerformanceCard from './performance/MusclePerformanceCard';
import MuscleNameDisplay from '../MuscleNameDisplay';
import { getScoreColors } from '@/hooks/useScoreColors';

export interface PerformanceCardProps {
  analysisResult: EMGAnalysisResult | null;
  contractionDurationThreshold?: number;
  sessionParams?: GameSessionParameters;
}

const calculateContractionScore = (count: number, expected: number | null): number => {
  if (!expected || expected <= 0) return 100;
  const ratio = count / expected;
  return Math.min(Math.round(ratio * 100), 100);
};

const calculateGoodContractionScore = (goodCount: number, totalCount: number): number | null => {
  if (totalCount <= 0) return null;
  return Math.round((goodCount / totalCount) * 100);
};

const calculateTotalScore = (subscore1: number | null, subscore2: number | null): number => {
  const scores = [subscore1, subscore2].filter(s => s !== null) as number[];
  if (scores.length === 0) return 0;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round(sum / scores.length);
};

/*
const calculateOverallScore = (muscleScores: number[]): number => {
  if (muscleScores.length === 0) return 0;
  const sum = muscleScores.reduce((a, b) => a + b, 0);
  return Math.round(sum / muscleScores.length);
};
*/

const getScoreLabel = (score: number): { label: string; textColor: string; bgColor: string; hexColor: string } => {
  if (score >= 90) return { label: "Excellent", textColor: "text-emerald-500", bgColor: "bg-emerald-500", hexColor: "#10b981" };
  if (score >= 75) return { label: "Good", textColor: "text-green-500", bgColor: "bg-green-500", hexColor: "#22c55e" };
  if (score >= 60) return { label: "Satisfactory", textColor: "text-sky-500", bgColor: "bg-sky-500", hexColor: "#0ea5e9" };
  if (score >= 40) return { label: "Needs Improvement", textColor: "text-amber-500", bgColor: "bg-amber-500", hexColor: "#f59e0b" };
  return { label: "Insufficient", textColor: "text-red-500", bgColor: "bg-red-500", hexColor: "#ef4444" };
};

const PerformanceCard: React.FC<PerformanceCardProps> = ({
  analysisResult,
  contractionDurationThreshold = 250,
  sessionParams,
}) => {
  if (!analysisResult) return null;

  const muscleScores: number[] = [];
  const muscleData: any[] = [];

  const channelNames = analysisResult.analytics && typeof analysisResult.analytics === 'object' ? 
    Object.keys(analysisResult.analytics).sort() : [];

  channelNames.forEach((channelName, index) => {
    const channelData = analysisResult.analytics[channelName];
    if (!channelData) return;

    let expectedContractions: number | null = null;
    let expectedShortContractions: number | undefined;
    let expectedLongContractions: number | undefined;
    const params = analysisResult.metadata.session_parameters_used;

    if (params) {
      // Keys are 1-indexed (ch1, ch2), so we use `index + 1`
      const perChannelKey = `session_expected_contractions_ch${index + 1}`;
      if (params.hasOwnProperty(perChannelKey)) {
        expectedContractions = (params as any)[perChannelKey] ?? null;
      } else {
        // Fallback to the overall session value if per-channel is not defined
        expectedContractions = params.session_expected_contractions ?? null;
      }
      
      // Extract expected short/long contractions based on channel
      if (index === 0) { // Left channel (ch1)
        expectedShortContractions = typeof params.session_expected_short_left === 'number' ? 
          params.session_expected_short_left : undefined;
        expectedLongContractions = typeof params.session_expected_long_left === 'number' ? 
          params.session_expected_long_left : undefined;
      } else if (index === 1) { // Right channel (ch2)
        expectedShortContractions = typeof params.session_expected_short_right === 'number' ? 
          params.session_expected_short_right : undefined;
        expectedLongContractions = typeof params.session_expected_long_right === 'number' ? 
          params.session_expected_long_right : undefined;
      }
    }
    
    const totalContractions = channelData.contraction_count || 0;
    const goodContractions = channelData.good_contraction_count || 0;

    const contractionScore = calculateContractionScore(totalContractions, expectedContractions);
    const goodContractionScore = calculateGoodContractionScore(goodContractions, totalContractions);
    const totalScore = calculateTotalScore(contractionScore, goodContractionScore);
    const scoreColors = getScoreColors(totalScore);
    
    muscleScores.push(totalScore);

    let shortContractions = 0, longContractions = 0;
    let shortGoodContractions = 0, longGoodContractions = 0;

    if (channelData.contractions && Array.isArray(channelData.contractions)) {
      channelData.contractions.forEach(c => {
        if (c.duration_ms < contractionDurationThreshold) {
          shortContractions++;
          if (c.is_good) shortGoodContractions++;
        } else {
          longContractions++;
          if (c.is_good) longGoodContractions++;
        }
      });
    }

    muscleData.push({
      channelName,
      totalScore,
      scoreLabel: scoreColors.label,
      scoreTextColor: scoreColors.text,
      scoreBgColor: scoreColors.bg,
      scoreHexColor: scoreColors.hex,
      totalContractions,
      expectedContractions,
      contractionScore,
      goodContractions,
      goodContractionScore,
      shortContractions,
      shortGoodContractions,
      longContractions,
      longGoodContractions,
      expectedShortContractions,
      expectedLongContractions,
    });
  });

  /*
  const overallScore = calculateOverallScore(muscleScores);
  const overallScoreLabel = getScoreLabel(overallScore);

  let symmetryScore: number | undefined;
  if (muscleScores.length === 2) {
    const [score1, score2] = muscleScores;
    if (score1 > 0 || score2 > 0) {
      symmetryScore = Math.round((Math.min(score1, score2) / Math.max(score1, score2)) * 100);
    } else {
      symmetryScore = 100; // Both are 0, perfect symmetry
    }
  }
  */

  const durationThreshold = analysisResult?.metadata.session_parameters_used?.contraction_duration_threshold ?? contractionDurationThreshold;

  return (
    <div className="space-y-6">
      {/* <OverallPerformanceCard
        totalScore={overallScore}
        scoreLabel={overallScoreLabel.label}
        scoreTextColor={overallScoreLabel.textColor}
        scoreBgColor={overallScoreLabel.bgColor}
        scoreHexColor={overallScoreLabel.hexColor}
        muscleCount={muscleScores.length}
        symmetryScore={symmetryScore}
      /> */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {muscleData.map(data => (
          <MusclePerformanceCard
            key={data.channelName}
            channel={data.channelName}
            totalScore={data.totalScore}
            scoreLabel={data.scoreLabel}
            scoreTextColor={data.scoreTextColor}
            scoreBgColor={data.scoreBgColor}
            scoreHexColor={data.scoreHexColor}
            totalContractions={data.totalContractions}
            expectedContractions={data.expectedContractions}
            contractionScore={data.contractionScore}
            contractionCount={data.totalContractions}
            goodContractionCount={data.goodContractions}
            shortContractions={data.shortContractions}
            shortGoodContractions={data.shortGoodContractions}
            longContractions={data.longContractions}
            longGoodContractions={data.longGoodContractions}
            expectedShortContractions={data.expectedShortContractions}
            expectedLongContractions={data.expectedLongContractions}
            sessionParams={sessionParams}
            contractionDurationThreshold={durationThreshold}
          />
        ))}
      </div>
    </div>
  );
};

export default PerformanceCard; 