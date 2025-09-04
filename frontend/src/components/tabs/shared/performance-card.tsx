import React, { useMemo, useEffect, useState, Suspense } from 'react';
import { EMGAnalysisResult, GameSessionParameters } from '@/types/emg';
import MuscleComplianceCard from '../PerformanceTab/components/MuscleComplianceCard';
import OverallPerformanceCard from '../PerformanceTab/components/OverallPerformanceCard';
import MuscleSymmetryCard from '../PerformanceTab/components/MuscleSymmetryCard';
import SubjectiveFatigueCard from '../PerformanceTab/components/SubjectiveFatigueCard';
import GHOSTLYGameCard from '../PerformanceTab/components/GHOSTLYGameCard';
import { useEnhancedPerformanceMetrics } from '@/hooks/useEnhancedPerformanceMetrics';
import { useSessionStore } from '@/store/sessionStore';
import { PerformanceCalculationResult } from '@/lib/performanceUtils';
import { perfMonitor } from '@/lib/performanceMonitoring';
import { getScoreStyle } from '@/lib/scoringSystem';


/**
 * Default weight values from backend configuration
 */
const DEFAULT_WEIGHTS = {
  compliance: 0.50,
  symmetry: 0.25,
  effort: 0.25,
  gameScore: 0.00,
  compliance_completion: 0.333,
  compliance_intensity: 0.333,
  compliance_duration: 0.334,
} as const;

/**
 * Muscle data structure for component rendering
 */
interface MuscleCardData {
  channelName: string;
  totalScore: number;
  scoreLabel: string;
  scoreTextColor: string;
  scoreBgColor: string;
  scoreHexColor: string;
  totalContractions: number;
  expectedContractions: number;
  contractionScore: number;
  goodContractions: number;
  shortContractions: number;
  shortGoodContractions: number;
  longContractions: number;
  longGoodContractions: number;
  expectedShortContractions: number;
  expectedLongContractions: number;
  averageContractionTime: number;
  mvcValue: number;
  mvcThreshold: number;
  componentScores: {
    completion: { score: number; weight: number };
    intensity: { score: number; weight: number };
    duration: { score: number; weight: number };
  };
}

/**
 * Score label configuration
 */
interface ScoreLabel {
  label: string;
  text: string;
  bg: string;
  hex: string;
}

export interface PerformanceCardProps {
  /** EMG analysis result data */
  analysisResult: EMGAnalysisResult | null;
  /** Duration threshold for contractions in milliseconds */
  contractionDurationThreshold?: number;
  /** Session parameters */
  sessionParams?: GameSessionParameters;
}

// Enhanced loading states components
const LoadingSpinner = () => (
  <div className="w-16 h-16 mb-4">
    <svg className="w-full h-full animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="60" strokeLinecap="round" />
    </svg>
  </div>
);

const ProgressBar = ({ progress }: { progress: number }) => (
  <div className="w-48 h-2 bg-slate-200 rounded-full overflow-hidden">
    <div 
      className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300 ease-out"
      style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
    />
  </div>
);

const EnhancedLoadingState = ({ phase, progress }: { phase: string; progress: number }) => (
  <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-6 shadow-sm border border-slate-200 text-center min-h-[400px] flex flex-col items-center justify-center">
    <LoadingSpinner />
    <p className="text-slate-700 font-medium mb-2">{phase}</p>
    <ProgressBar progress={progress} />
    <p className="text-slate-500 text-sm mt-2">{progress}% complete</p>
    {progress > 70 && (
      <p className="text-xs text-slate-500 mt-2 animate-pulse">
        Almost ready... finalizing calculations
      </p>
    )}
  </div>
);

// Skeleton components for progressive loading
const CardSkeleton = ({ variant = 'muscle' }: { variant?: 'muscle' | 'overall' }) => (
  <div className="lg:col-span-4 xl:col-span-4">
    <div className={`${variant === 'muscle' ? 'bg-gradient-to-br from-slate-100 to-slate-50' : 'bg-gradient-to-br from-blue-50 to-indigo-50'} rounded-xl p-6 animate-pulse border ${variant === 'muscle' ? 'border-slate-200' : 'border-blue-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`h-4 ${variant === 'muscle' ? 'bg-slate-200' : 'bg-blue-200'} rounded w-20`}></div>
        <div className={`h-6 ${variant === 'muscle' ? 'bg-slate-200' : 'bg-blue-200'} rounded w-16`}></div>
      </div>
      <div className="flex justify-center mb-4">
        <div className={`h-16 w-16 ${variant === 'muscle' ? 'bg-slate-200' : 'bg-blue-200'} rounded-full`}></div>
      </div>
      <div className="space-y-2">
        <div className={`h-3 ${variant === 'muscle' ? 'bg-slate-200' : 'bg-blue-200'} rounded w-full`}></div>
        <div className={`h-3 ${variant === 'muscle' ? 'bg-slate-200' : 'bg-blue-200'} rounded w-5/6`}></div>
        <div className={`h-3 ${variant === 'muscle' ? 'bg-slate-200' : 'bg-blue-200'} rounded w-4/6`}></div>
      </div>
    </div>
  </div>
);


/**
 * Calculate average contraction time from channel data
 */
function calculateAverageContractionTime(contractions: Array<{ duration_ms: number }> | undefined): number {
  if (!contractions?.length) return 0;
  const totalTime = contractions.reduce((sum, c) => sum + c.duration_ms, 0);
  return totalTime / contractions.length;
}

/**
 * Supporting metrics component for secondary performance indicators
 */
interface SupportingMetricsProps {
  symmetryScore?: number;
  rpeLevel?: number;
  gameScore?: number;
  gameLevel?: number;
  gameScoreWeight: number;
}

const SupportingMetrics: React.FC<SupportingMetricsProps> = ({
  symmetryScore,
  rpeLevel,
  gameScore,
  gameLevel,
  gameScoreWeight,
}) => {
  const normalizedGameScore = useMemo(() => {
    if (gameScore === undefined) return 0;
    return Math.min(100, (gameScore / Math.max(gameScore || 1, 100)) * 100);
  }, [gameScore]);

  return (
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
          <SubjectiveFatigueCard fatigueLevel={rpeLevel} />
        </div>
      )}
      
      {/* GHOSTLY Game Score */}
      {gameScore !== undefined && (
        <div className="lg:col-span-4 transform hover:scale-[1.02] transition-transform duration-200 hover:z-10 relative">
          <GHOSTLYGameCard 
            gameScore={gameScore}
            gameLevel={gameLevel}
            normalizedScore={normalizedGameScore}
            gameScoreWeight={gameScoreWeight}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Main PerformanceCard component that displays comprehensive EMG performance metrics
 * in a unified grid layout with muscle compliance cards, overall performance, and supporting metrics.
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * - Progressive loading states with better UX
 * - Reduced re-renders through optimized useMemo dependencies
 * - Performance monitoring integration
 * - Lazy loading with Suspense boundaries
 */
const PerformanceCard: React.FC<PerformanceCardProps> = ({
  analysisResult,
  contractionDurationThreshold = 2000,
  sessionParams,
}) => {
  const { sessionParams: storeSessionParams } = useSessionStore();
  const [loadingPhase, setLoadingPhase] = useState<'initial' | 'weights' | 'metrics' | 'complete'>('initial');
  
  // Performance monitoring
  useEffect(() => {
    if (analysisResult && loadingPhase === 'initial') {
      perfMonitor.mark('performance-card-load');
      setLoadingPhase('weights');
    }
  }, [analysisResult, loadingPhase]);

  const enhancedPerformanceData = useEnhancedPerformanceMetrics(analysisResult);
  
  // Progressive loading state management
  useEffect(() => {
    if (enhancedPerformanceData && loadingPhase === 'weights') {
      setLoadingPhase('metrics');
      // Micro-task for UI update
      setTimeout(() => {
        setLoadingPhase('complete');
        const duration = perfMonitor.measure('performance-card-load');
        if (process.env.NODE_ENV === 'development' && duration) {
          console.log(`PerformanceCard loaded in ${duration.toFixed(2)}ms`);
        }
      }, 16);
    }
  }, [enhancedPerformanceData, loadingPhase]);
  
  // Extract performance metrics with optimized memoization (reduced dependencies)
  const performanceMetrics = useMemo(() => {
    if (!enhancedPerformanceData) return null;
    
    return {
      gameScoreWeight: enhancedPerformanceData.weights?.gameScore ?? 0,
      overallScore: enhancedPerformanceData.overallScore ?? 0,
      symmetryScore: enhancedPerformanceData.symmetryScore,
      therapeuticComplianceScore: enhancedPerformanceData.complianceScore ?? 50,
      gameScore: analysisResult?.metadata?.score,
      gameLevel: analysisResult?.metadata?.level ? Number(analysisResult.metadata.level) : undefined,
      rpeLevel: sessionParams?.post_session_rpe ?? storeSessionParams?.rpe_level ?? 5,
    };
  }, [
    enhancedPerformanceData?.overallScore,
    enhancedPerformanceData?.weights?.gameScore,
    enhancedPerformanceData?.symmetryScore,
    enhancedPerformanceData?.complianceScore,
    analysisResult?.metadata?.score,
    analysisResult?.metadata?.level,
    sessionParams?.post_session_rpe,
    storeSessionParams?.rpe_level
  ]);

  // Extract muscle data with reduced re-computation
  const leftMuscle = enhancedPerformanceData?.leftMuscle;
  const rightMuscle = enhancedPerformanceData?.rightMuscle;
  
  // Transform muscle data with optimized memoization - Fixed type inference
  const muscleData = useMemo((): MuscleCardData[] => {
    if (!leftMuscle && !rightMuscle) return [];
    
    const muscles = [leftMuscle, rightMuscle].filter((muscle): muscle is NonNullable<typeof muscle> => muscle !== null && muscle !== undefined);
    
    return muscles.map((muscle, index) => {
      const channelNames = analysisResult ? Object.keys(analysisResult.analytics).sort() : [];
      const channelName = channelNames[index] || `Channel ${index + 1}`;
      const channelData = analysisResult?.analytics?.[channelName];
      const scoreStyle = getScoreStyle(muscle.totalScore);
      
      return {
        channelName,
        totalScore: muscle.totalScore,
        scoreLabel: scoreStyle.label,
        scoreTextColor: scoreStyle.text,
        scoreBgColor: scoreStyle.bg,
        scoreHexColor: scoreStyle.hex,
        totalContractions: muscle.components.completion.count,
        expectedContractions: muscle.components.completion.total,
        contractionScore: muscle.components.completion.value,
        goodContractions: muscle.components.mvcQuality.count,
        shortContractions: 0,
        shortGoodContractions: 0,
        longContractions: muscle.components.qualityThreshold.count,
        longGoodContractions: muscle.components.qualityThreshold.count,
        expectedShortContractions: 0,
        expectedLongContractions: muscle.components.completion.total,
        averageContractionTime: calculateAverageContractionTime(channelData?.contractions),
        mvcValue: channelData?.mvc75_threshold || 0,
        mvcThreshold: 75,
        componentScores: {
          completion: {
            score: muscle.components.completion.value,
            weight: enhancedPerformanceData?.weights?.compliance_completion || DEFAULT_WEIGHTS.compliance_completion
          },
          intensity: {
            score: muscle.components.mvcQuality.value,
            weight: enhancedPerformanceData?.weights?.compliance_intensity || DEFAULT_WEIGHTS.compliance_intensity
          },
          duration: {
            score: muscle.components.qualityThreshold.value,
            weight: enhancedPerformanceData?.weights?.compliance_duration || DEFAULT_WEIGHTS.compliance_duration
          }
        }
      };
    });
  }, [leftMuscle?.totalScore, rightMuscle?.totalScore, analysisResult, enhancedPerformanceData?.weights]);

  // Create overall performance data with memoization
  const overallPerformance = useMemo((): PerformanceCalculationResult | null => {
    if (!performanceMetrics) return null;
    
    return {
      totalScore: performanceMetrics.overallScore,
      durationThreshold: contractionDurationThreshold,
      contributions: {
        compliance: enhancedPerformanceData?.weights?.compliance || DEFAULT_WEIGHTS.compliance,
        symmetry: enhancedPerformanceData?.weights?.symmetry || DEFAULT_WEIGHTS.symmetry,
        effort: enhancedPerformanceData?.weights?.effort || DEFAULT_WEIGHTS.effort,
        game: enhancedPerformanceData?.weights?.gameScore || DEFAULT_WEIGHTS.gameScore,
      },
      strongestDriver: 'compliance',
      weightedScores: {
        compliance: ((leftMuscle?.totalScore || 0) + (rightMuscle?.totalScore || 0)) / 2 * 
          (enhancedPerformanceData?.weights?.compliance || DEFAULT_WEIGHTS.compliance),
        symmetry: (enhancedPerformanceData?.symmetryScore || 0) * 
          (enhancedPerformanceData?.weights?.symmetry || DEFAULT_WEIGHTS.symmetry),
        effort: (enhancedPerformanceData?.effortScore || 0) * 
          (enhancedPerformanceData?.weights?.effort || DEFAULT_WEIGHTS.effort),
        game: (enhancedPerformanceData?.gameScoreNormalized || 0) * 
          (enhancedPerformanceData?.weights?.gameScore || DEFAULT_WEIGHTS.gameScore),
      }
    };
  }, [performanceMetrics?.overallScore, contractionDurationThreshold, enhancedPerformanceData, leftMuscle?.totalScore, rightMuscle?.totalScore]);

  // Create overall score label with memoization
  const overallScoreLabel = useMemo((): ScoreLabel | null => {
    if (!performanceMetrics) return null;
    
    const scoreStyle = getScoreStyle(performanceMetrics.overallScore);
    return {
      label: scoreStyle.label,
      text: scoreStyle.text,
      bg: scoreStyle.bg,
      hex: scoreStyle.hex,
    };
  }, [performanceMetrics?.overallScore]);

  // Render muscle compliance card with proper error handling
  const renderMuscleCard = (muscleCardData: MuscleCardData | undefined, index: number) => {
    if (!muscleCardData || !analysisResult) return null;

    return (
      <div 
        key={`muscle-${index}`}
        className="lg:col-span-4 xl:col-span-4 transform hover:scale-[1.01] transition-all duration-300 hover:shadow-lg hover:z-10 relative"
      >
        <Suspense fallback={<CardSkeleton variant="muscle" />}>
          <MuscleComplianceCard
            channel={muscleCardData.channelName}
            totalScore={muscleCardData.totalScore}
            scoreLabel={muscleCardData.scoreLabel}
            scoreTextColor={muscleCardData.scoreTextColor}
            scoreBgColor={muscleCardData.scoreBgColor}
            scoreHexColor={muscleCardData.scoreHexColor}
            totalContractions={muscleCardData.totalContractions}
            expectedContractions={muscleCardData.expectedContractions}
            contractionScore={muscleCardData.contractionScore}
            contractionCount={muscleCardData.totalContractions}
            goodContractionCount={muscleCardData.goodContractions}
            shortContractions={muscleCardData.shortContractions}
            shortGoodContractions={muscleCardData.shortGoodContractions}
            longContractions={muscleCardData.longContractions}
            longGoodContractions={muscleCardData.longGoodContractions}
            expectedShortContractions={muscleCardData.expectedShortContractions}
            expectedLongContractions={muscleCardData.expectedLongContractions}
            sessionParams={sessionParams}
            contractionDurationThreshold={overallPerformance?.durationThreshold || contractionDurationThreshold}
            averageContractionTime={muscleCardData.averageContractionTime}
            mvcValue={muscleCardData.mvcValue}
            mvcThreshold={muscleCardData.mvcThreshold}
            contractions={analysisResult.analytics[muscleCardData.channelName]?.contractions}
            componentScores={muscleCardData.componentScores}
          />
        </Suspense>
      </div>
    );
  };

  // Progressive loading states
  if (loadingPhase === 'initial' || loadingPhase === 'weights') {
    const progress = loadingPhase === 'initial' ? 20 : 60;
    const message = loadingPhase === 'initial' ? 'Initializing analysis...' : 'Loading scoring configuration...';
    
    return <EnhancedLoadingState phase={message} progress={progress} />;
  }

  if (loadingPhase === 'metrics') {
    // Show skeleton UI while final calculations complete
    return (
      <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <CardSkeleton variant="muscle" />
          <CardSkeleton variant="overall" />
          <CardSkeleton variant="muscle" />
        </div>
      </div>
    );
  }

  // Error states
  if (!enhancedPerformanceData || !performanceMetrics || !overallPerformance || !overallScoreLabel) {
    return (
      <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-6 shadow-sm border border-slate-200 text-center min-h-[400px] flex items-center justify-center">
        <p className="text-slate-500">Unable to calculate performance metrics</p>
      </div>
    );
  }

  // Main render with optimized structure
  return (
    <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-6 shadow-sm border border-slate-200">
      {/* MAIN PERFORMANCE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Muscle Compliance */}
        {renderMuscleCard(muscleData[0], 0)}
        
        {/* Overall Performance */}
        <div className="lg:col-span-4 xl:col-span-4 col-span-1 relative hover:z-10">
          <Suspense fallback={<CardSkeleton variant="overall" />}>
            <OverallPerformanceCard
              performanceData={overallPerformance}
              scoreLabel={overallScoreLabel.label}
              scoreTextColor={overallScoreLabel.text}
              scoreBgColor={overallScoreLabel.bg}
              scoreHexColor={overallScoreLabel.hex}
              therapeuticComplianceScore={performanceMetrics.therapeuticComplianceScore}
              symmetryScore={performanceMetrics.symmetryScore ?? undefined}
              gameScore={performanceMetrics.gameScore ?? undefined}
            />
          </Suspense>
        </div>

        {/* Right Muscle Compliance */}
        {renderMuscleCard(muscleData[1], 1)}
      </div>
      
      {/* SUPPORTING METRICS */}
      <Suspense fallback={<div className="h-32 bg-slate-100 rounded-xl mt-6 animate-pulse" />}>
        <SupportingMetrics
          symmetryScore={performanceMetrics.symmetryScore ?? undefined}
          rpeLevel={performanceMetrics.rpeLevel ?? undefined}
          gameScore={performanceMetrics.gameScore ?? undefined}
          gameLevel={performanceMetrics.gameLevel ?? undefined}
          gameScoreWeight={performanceMetrics.gameScoreWeight}
        />
      </Suspense>
    </div>
  );
};

export default PerformanceCard;