import { EMGAnalysisResult, GameSessionParameters } from '@/types/emg';
import MusclePerformanceCard from '../PerformanceTab/components/MusclePerformanceCard';
import OverallPerformanceCard from '../PerformanceTab/components/OverallPerformanceCard';
import MuscleSymmetryCard from '../PerformanceTab/components/MuscleSymmetryCard';
import SubjectiveFatigueCard from '../PerformanceTab/components/SubjectiveFatigueCard';
import GHOSTLYGameCard from '../PerformanceTab/components/GHOSTLYGameCard';
import { useEnhancedPerformanceMetrics } from '@/hooks/useEnhancedPerformanceMetrics';
import { useSessionStore } from '@/store/sessionStore';
import ClinicalTooltip from '@/components/ui/clinical-tooltip';

export interface PerformanceCardProps {
  analysisResult: EMGAnalysisResult | null;
  contractionDurationThreshold?: number;
  sessionParams?: GameSessionParameters;
}

const PerformanceCard: React.FC<PerformanceCardProps> = ({
  analysisResult,
  contractionDurationThreshold = 2000,
  sessionParams,
}) => {
  const { sessionParams: storeSessionParams } = useSessionStore();
  const isEnhancedScoringEnabled = storeSessionParams?.enhanced_scoring?.enabled || false;
  
  const enhancedPerformanceData = useEnhancedPerformanceMetrics(analysisResult);
  
  // Adapt enhanced metrics to legacy component interface
  const gameScoreWeight = enhancedPerformanceData?.weights?.gameScore ?? 0;
  const overallScore = enhancedPerformanceData?.overallScore ?? 0;
  const symmetryScore = enhancedPerformanceData?.symmetryScore ?? undefined;
  const therapeuticComplianceScore = enhancedPerformanceData?.complianceScore ?? 50;

  // Extract game data
  const gameScore = analysisResult?.metadata?.score ?? undefined;
  const gameLevel = analysisResult?.metadata?.level ? Number(analysisResult.metadata.level) : undefined;
  
  // Extract RPE data - use post-exercise RPE (Borg CR10 scale 0-10)
  const rpeLevel = sessionParams?.post_session_rpe ?? storeSessionParams?.rpe_level ?? 5; // Default to 5 for demo

  // Create adapted data structures for legacy component interface
  const leftMuscle = enhancedPerformanceData?.leftMuscle;
  const rightMuscle = enhancedPerformanceData?.rightMuscle;
  
  // Map enhanced muscle data to legacy muscleData format
  const muscleData = [leftMuscle, rightMuscle].filter(Boolean).map((muscle, index) => {
    if (!muscle) return null;
    
    const channelNames = analysisResult ? Object.keys(analysisResult.analytics).sort() : [];
    const channelName = channelNames[index] || `Channel ${index + 1}`;
    const channelData = analysisResult?.analytics?.[channelName];
    
    return {
      channelName,
      totalScore: muscle.totalScore,
      scoreLabel: muscle.totalScore >= 80 ? 'Excellent' : 
                  muscle.totalScore >= 60 ? 'Good' :
                  muscle.totalScore >= 40 ? 'Fair' : 'Poor',
      scoreTextColor: muscle.totalScore >= 80 ? 'text-emerald-700' :
                      muscle.totalScore >= 60 ? 'text-blue-700' :
                      muscle.totalScore >= 40 ? 'text-amber-700' : 'text-red-700',
      scoreBgColor: muscle.totalScore >= 80 ? 'bg-emerald-100' :
                    muscle.totalScore >= 60 ? 'bg-blue-100' :
                    muscle.totalScore >= 40 ? 'bg-amber-100' : 'bg-red-100',
      scoreHexColor: muscle.totalScore >= 80 ? '#10b981' :
                     muscle.totalScore >= 60 ? '#3b82f6' :
                     muscle.totalScore >= 40 ? '#f59e0b' : '#ef4444',
      totalContractions: muscle.components.completion.count,
      expectedContractions: muscle.components.completion.total,
      contractionScore: muscle.components.completion.value,
      goodContractions: muscle.components.mvcQuality.count,
      shortContractions: 0, // Not available in enhanced metrics
      shortGoodContractions: 0,
      longContractions: muscle.components.qualityThreshold.count,
      longGoodContractions: muscle.components.qualityThreshold.count,
      expectedShortContractions: 0,
      expectedLongContractions: muscle.components.completion.total,
      averageContractionTime: channelData?.contractions?.reduce((sum, c) => sum + c.duration_ms, 0) / (channelData?.contractions?.length || 1) || 0,
      mvcValue: channelData?.mvc_threshold_actual_value || 0,
      mvcThreshold: 75, // Default from enhanced metrics
      componentScores: {
        completion: {
          score: muscle.components.completion.value,
          weight: enhancedPerformanceData?.weights?.compliance_completion || 0.333
        },
        intensity: {
          score: muscle.components.mvcQuality.value,
          weight: enhancedPerformanceData?.weights?.compliance_intensity || 0.333
        },
        duration: {
          score: muscle.components.qualityThreshold.value,
          weight: enhancedPerformanceData?.weights?.compliance_duration || 0.334
        }
      }
    };
  }).filter(Boolean);

  // Create overall performance data with proper interface
  const overallPerformance = {
    totalScore: overallScore,
    durationThreshold: contractionDurationThreshold,
    contributions: {
      compliance: enhancedPerformanceData?.weights?.compliance || 0.50,
      symmetry: enhancedPerformanceData?.weights?.symmetry || 0.20,
      effort: enhancedPerformanceData?.weights?.effort || 0.30,
      game: enhancedPerformanceData?.weights?.gameScore || 0.00,
    },
    strongestDriver: 'compliance', // Default strongest driver
    weightedScores: {
      compliance: ((leftMuscle?.totalScore || 0) + (rightMuscle?.totalScore || 0)) / 2 * (enhancedPerformanceData?.weights?.compliance || 0.50),
      symmetry: (enhancedPerformanceData?.symmetryScore || 0) * (enhancedPerformanceData?.weights?.symmetry || 0.20),
      effort: (enhancedPerformanceData?.effortScore || 0) * (enhancedPerformanceData?.weights?.effort || 0.30),
      game: (enhancedPerformanceData?.gameScoreNormalized || 0) * (enhancedPerformanceData?.weights?.gameScore || 0.00),
    }
  };

  // Create overall score label
  const overallScoreLabel = {
    label: overallScore >= 80 ? 'Excellent' : 
            overallScore >= 60 ? 'Good' :
            overallScore >= 40 ? 'Fair' : 'Poor',
    text: overallScore >= 80 ? 'text-emerald-700' :
          overallScore >= 60 ? 'text-blue-700' :
          overallScore >= 40 ? 'text-amber-700' : 'text-red-700',
    bg: overallScore >= 80 ? 'bg-emerald-100' :
        overallScore >= 60 ? 'bg-blue-100' :
        overallScore >= 40 ? 'bg-amber-100' : 'bg-red-100',
    hex: overallScore >= 80 ? '#10b981' :
         overallScore >= 60 ? '#3b82f6' :
         overallScore >= 40 ? '#f59e0b' : '#ef4444'
  };

  // Render a loading state or placeholder if data isn't ready
  if (!enhancedPerformanceData || !overallPerformance) {
    return (
      <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-6 shadow-sm border border-slate-200 text-center">
        <p className="text-slate-500">Calculating performance metrics...</p>
      </div>
    );
  }

  // Unified Grid Layout: Everything in a single, cohesive grid system
  return (
    <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-6 shadow-sm border border-slate-200">
      {/* Compact header removed; tab already provides context */}
      
      {/* UNIFIED GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Quadriceps Compliance */}
        {analysisResult && muscleData.length > 0 && muscleData[0] && (
          <div className="lg:col-span-4 xl:col-span-4 transform hover:scale-[1.01] transition-all duration-300 hover:shadow-lg hover:z-10 relative">
            <MusclePerformanceCard
              channel={muscleData[0].channelName}
              totalScore={muscleData[0].totalScore}
              scoreLabel={muscleData[0].scoreLabel}
              scoreTextColor={muscleData[0].scoreTextColor}
              scoreBgColor={muscleData[0].scoreBgColor}
              scoreHexColor={muscleData[0].scoreHexColor}
              totalContractions={muscleData[0].totalContractions}
              expectedContractions={muscleData[0].expectedContractions}
              contractionScore={muscleData[0].contractionScore}
              contractionCount={muscleData[0].totalContractions}
              goodContractionCount={muscleData[0].goodContractions}
              shortContractions={muscleData[0].shortContractions}
              shortGoodContractions={muscleData[0].shortGoodContractions}
              longContractions={muscleData[0].longContractions}
              longGoodContractions={muscleData[0].longGoodContractions}
              expectedShortContractions={muscleData[0].expectedShortContractions}
              expectedLongContractions={muscleData[0].expectedLongContractions}
              sessionParams={sessionParams}
              contractionDurationThreshold={overallPerformance.durationThreshold}
              averageContractionTime={muscleData[0].averageContractionTime}
              mvcValue={muscleData[0].mvcValue}
              mvcThreshold={muscleData[0].mvcThreshold}
              contractions={analysisResult.analytics[muscleData[0].channelName]?.contractions}
              componentScores={muscleData[0].componentScores}
            />
          </div>
        )}
        
        {/* Overall Performance - centered between left and right, same width with accented border */}
        <div
          className="lg:col-span-4 xl:col-span-4 col-span-1 relative hover:z-10 rounded-xl border-2 shadow-md"
          style={{ borderColor: overallScoreLabel?.hex || '#e5e7eb' }}
        >
          <OverallPerformanceCard
            performanceData={overallPerformance}
            scoreLabel={overallScoreLabel?.label || 'N/A'}
            scoreTextColor={overallScoreLabel?.text || 'text-slate-800'}
            scoreBgColor={overallScoreLabel?.bg || 'bg-slate-200'}
            scoreHexColor={overallScoreLabel?.hex || '#e5e7eb'}
            therapeuticComplianceScore={therapeuticComplianceScore}
            symmetryScore={symmetryScore}
            gameScore={gameScore}
          />
        </div>

        {/* Right Quadriceps Compliance */}
        {analysisResult && muscleData.length > 1 && muscleData[1] && (
          <div className="lg:col-span-4 xl:col-span-4 transform hover:scale-[1.01] transition-all duration-300 hover:shadow-lg hover:z-10 relative">
            <MusclePerformanceCard
              channel={muscleData[1].channelName}
              totalScore={muscleData[1].totalScore}
              scoreLabel={muscleData[1].scoreLabel}
              scoreTextColor={muscleData[1].scoreTextColor}
              scoreBgColor={muscleData[1].scoreBgColor}
              scoreHexColor={muscleData[1].scoreHexColor}
              totalContractions={muscleData[1].totalContractions}
              expectedContractions={muscleData[1].expectedContractions}
              contractionScore={muscleData[1].contractionScore}
              contractionCount={muscleData[1].totalContractions}
              goodContractionCount={muscleData[1].goodContractions}
              shortContractions={muscleData[1].shortContractions}
              shortGoodContractions={muscleData[1].shortGoodContractions}
              longContractions={muscleData[1].longContractions}
              longGoodContractions={muscleData[1].longGoodContractions}
              expectedShortContractions={muscleData[1].expectedShortContractions}
              expectedLongContractions={muscleData[1].expectedLongContractions}
              sessionParams={sessionParams}
              contractionDurationThreshold={overallPerformance.durationThreshold}
              averageContractionTime={muscleData[1].averageContractionTime}
              mvcValue={muscleData[1].mvcValue}
              mvcThreshold={muscleData[1].mvcThreshold}
              contractions={analysisResult.analytics[muscleData[1].channelName]?.contractions}
              componentScores={muscleData[1].componentScores}
            />
          </div>
        )}
      </div>
      
      {/* SECOND ROW: Supporting Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Muscle Symmetry */}
        {symmetryScore !== undefined && (
          <div className="lg:col-span-4 transform hover:scale-[1.02] transition-transform duration-200 hover:z-10 relative">
            <MuscleSymmetryCard symmetryScore={symmetryScore} />
          </div>
        )}
        
        {/* RPE Score */}
        {rpeLevel !== undefined && (
          <div className="lg:col-span-4 transform hover:scale-[1.02] transition-transform duration-200 hover:z-10 relative">
            <SubjectiveFatigueCard 
              fatigueLevel={rpeLevel}
            />
          </div>
        )}
        
        {/* GHOSTLY Game Score */}
        {(gameScore !== undefined) && (
          <div className="lg:col-span-4 transform hover:scale-[1.02] transition-transform duration-200 hover:z-10 relative">
            <GHOSTLYGameCard 
              gameScore={gameScore}
              gameLevel={gameLevel}
              normalizedScore={gameScore !== undefined ? Math.min(100, (gameScore / Math.max(gameScore || 1, 100)) * 100) : 0}
              gameScoreWeight={gameScoreWeight}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceCard; 