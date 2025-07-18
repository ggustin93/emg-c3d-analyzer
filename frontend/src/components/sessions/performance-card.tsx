import { EMGAnalysisResult, GameSessionParameters } from '../../types/emg';
import MusclePerformanceCard from './performance/MusclePerformanceCard';
import OverallPerformanceCard from './performance/OverallPerformanceCard';
import EnhancedPerformanceCard from './performance/EnhancedPerformanceCard';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import { useSessionStore } from '@/store/sessionStore';

export interface PerformanceCardProps {
  analysisResult: EMGAnalysisResult | null;
  contractionDurationThreshold?: number;
  sessionParams?: GameSessionParameters;
}

const PerformanceCard: React.FC<PerformanceCardProps> = ({
  analysisResult,
  contractionDurationThreshold = 250,
  sessionParams,
}) => {
  const { sessionParams: storeSessionParams } = useSessionStore();
  const isEnhancedScoringEnabled = storeSessionParams?.enhanced_scoring?.enabled || false;
  
  const { 
    muscleData, 
    overallScore, 
    overallScoreLabel, 
    symmetryScore, 
    durationThreshold 
  } = usePerformanceMetrics(analysisResult, contractionDurationThreshold);

  // Si le scoring avancé est activé, utiliser le nouveau composant
  if (isEnhancedScoringEnabled) {
    return <EnhancedPerformanceCard analysisResult={analysisResult} />;
  }

  // Sinon, utiliser l'ancien système
  return (
    <div className="space-y-6">
      <OverallPerformanceCard
        totalScore={overallScore}
        scoreLabel={overallScoreLabel?.label}
        scoreTextColor={overallScoreLabel?.text}
        scoreBgColor={overallScoreLabel?.bg}
        scoreHexColor={overallScoreLabel?.hex}
        muscleCount={muscleData.length}
        symmetryScore={symmetryScore}
        subjectiveFatigueLevel={sessionParams?.post_session_rpe as number | undefined}
      />
      {analysisResult && muscleData.length > 0 && (
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
      )}
    </div>
  );
};

export default PerformanceCard; 