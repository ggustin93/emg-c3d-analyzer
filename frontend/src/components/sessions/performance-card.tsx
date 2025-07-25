import { EMGAnalysisResult, GameSessionParameters } from '../../types/emg';
import MusclePerformanceCard from './performance/MusclePerformanceCard';
import OverallPerformanceCard from './performance/OverallPerformanceCard';
import MuscleSymmetryCard from './performance/MuscleSymmetryCard';
import SubjectiveFatigueCard from './performance/SubjectiveFatigueCard';
import GHOSTLYGameCard from './performance/GHOSTLYGameCard';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import { useSessionStore } from '@/store/sessionStore';
import ClinicalTooltip from '@/components/ui/clinical-tooltip';

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
    durationThreshold,
    averageContractionTime,
    totalContractions,
    totalGoodContractions,
    totalExpectedContractions
  } = usePerformanceMetrics(analysisResult, contractionDurationThreshold);

  // Calculate therapeutic compliance from muscle data
  const therapeuticComplianceScore = muscleData.length > 0 
    ? (muscleData as any[]).reduce((sum: number, muscle: any) => sum + (muscle.totalScore || 0), 0) / muscleData.length
    : undefined;
  
  const leftMuscleScore = muscleData.length > 0 ? muscleData[0]?.totalScore : undefined;
  const rightMuscleScore = muscleData.length > 1 ? muscleData[1]?.totalScore : undefined;

  // Extract game data
  const gameScore = analysisResult?.metadata?.score ?? undefined;
  const gameLevel = analysisResult?.metadata?.level ? Number(analysisResult.metadata.level) : undefined;
  
  // Debug: Log game metadata
  console.log('Performance Card Game Metadata:', {
    score: analysisResult?.metadata?.score,
    level: analysisResult?.metadata?.level,
    gameScore,
    gameLevel,
    fullMetadata: analysisResult?.metadata
  });

  // Extract RPE data - use post-exercise RPE (Borg CR10 scale 0-10)
  const rpeLevel = sessionParams?.post_session_rpe ?? undefined;

  // Unified Grid Layout: Everything in a single, cohesive grid system
  return (
    <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-6 shadow-sm border border-slate-200">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center justify-center gap-2">
          Performance Analysis
          <ClinicalTooltip
            title="Performance Analysis Dashboard"
            description="Multi-dimensional rehabilitation assessment combining compliance, symmetry, effort, and engagement."
            sections={[
              {
                title: "Performance Formula:",
                type: "formula",
                items: [
                  { 
                    label: "P", 
                    value: " = w<sub>c</sub>·S<sub>comp</sub> + w<sub>s</sub>·S<sub>sym</sub> + w<sub>e</sub>·S<sub>effort</sub> + w<sub>g</sub>·S<sub>game</sub>" 
                  }
                ]
              },
              {
                title: "Components:",
                type: "list",
                items: [
                  { label: "Compliance", description: "Exercise quality: completion, intensity ≥75% MVC, duration" },
                  { label: "Symmetry", description: "Bilateral muscle balance assessment" },
                  { label: "Effort", description: "Patient exertion (Borg CR10 scale)" },
                  { label: "Game", description: "GHOSTLY+ engagement metrics" }
                ]
              },
              {
                title: "Applications:",
                type: "list",
                items: [
                  { description: "Real-time session monitoring" },
                  { description: "Progress tracking across sessions" },
                  { description: "Evidence-based treatment optimization" },
                  { description: "Patient motivation through gamification" }
                ]
              }
            ]}
            side="top"
            triggerClassName="ml-1"
          />
        </h2>
        <p className="text-slate-600 text-sm">Comprehensive rehabilitation session assessment</p>
      </div>
      
      {/* UNIFIED GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
        {/* Overall Performance - Takes 2 columns */}
        <div className="lg:col-span-2 relative hover:z-10">
          <OverallPerformanceCard
            totalScore={overallScore}
            scoreLabel={overallScoreLabel?.label}
            scoreTextColor={overallScoreLabel?.text}
            scoreBgColor={overallScoreLabel?.bg}
            scoreHexColor={overallScoreLabel?.hex}
            muscleCount={muscleData.length}
            symmetryScore={symmetryScore}
            subjectiveFatigueLevel={rpeLevel as number | undefined}
            averageContractionTime={averageContractionTime}
            totalContractions={totalContractions}
            goodContractions={totalGoodContractions}
            expectedContractions={totalExpectedContractions}
            gameScore={gameScore}
            gameLevel={gameLevel}
            therapeuticComplianceScore={therapeuticComplianceScore}
            leftMuscleScore={leftMuscleScore}
            rightMuscleScore={rightMuscleScore}
          />
        </div>
        
        {/* Left Quadriceps Compliance */}
        {analysisResult && muscleData.length > 0 && muscleData[0] && (
          <div className="lg:col-span-2 transform hover:scale-[1.01] transition-all duration-300 hover:shadow-lg hover:z-10 relative">
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
              contractionDurationThreshold={durationThreshold}
              averageContractionTime={muscleData[0].averageContractionTime}
              mvcValue={muscleData[0].mvcValue}
              mvcThreshold={muscleData[0].mvcThreshold}
            />
          </div>
        )}
        
        {/* Right Quadriceps Compliance */}
        {analysisResult && muscleData.length > 1 && muscleData[1] && (
          <div className="lg:col-span-2 transform hover:scale-[1.01] transition-all duration-300 hover:shadow-lg hover:z-10 relative">
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
              contractionDurationThreshold={durationThreshold}
              averageContractionTime={muscleData[1].averageContractionTime}
              mvcValue={muscleData[1].mvcValue}
              mvcThreshold={muscleData[1].mvcThreshold}
            />
          </div>
        )}
      </div>
      
      {/* SECOND ROW: Supporting Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-6 mt-6">
        {/* Muscle Symmetry */}
        {symmetryScore !== undefined && (
          <div className="lg:col-span-2 transform hover:scale-[1.02] transition-transform duration-200 hover:z-10 relative">
            <MuscleSymmetryCard symmetryScore={symmetryScore} />
          </div>
        )}
        
        {/* RPE Score */}
        {rpeLevel !== undefined && (
          <div className="lg:col-span-2 transform hover:scale-[1.02] transition-transform duration-200 hover:z-10 relative">
            <SubjectiveFatigueCard 
              fatigueLevel={rpeLevel} 
              showBadge={true}
            />
          </div>
        )}
        
        {/* GHOSTLY Game Score */}
        {(gameScore !== undefined || gameLevel !== undefined) && (
          <div className="lg:col-span-2 transform hover:scale-[1.02] transition-transform duration-200 hover:z-10 relative">
            <GHOSTLYGameCard 
              gameScore={gameScore}
              gameLevel={gameLevel}
              normalizedScore={gameScore !== undefined ? Math.min(100, (gameScore / Math.max(gameScore || 1, 100)) * 100) : 0}
              showExperimental={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceCard; 