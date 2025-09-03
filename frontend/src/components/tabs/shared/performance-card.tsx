import React, { useMemo } from 'react';
import { EMGAnalysisResult, GameSessionParameters } from '@/types/emg';
import MuscleComplianceCard from '../PerformanceTab/components/MuscleComplianceCard';
import OverallPerformanceCard from '../PerformanceTab/components/OverallPerformanceCard';
import MuscleSymmetryCard from '../PerformanceTab/components/MuscleSymmetryCard';
import SubjectiveFatigueCard from '../PerformanceTab/components/SubjectiveFatigueCard';
import GHOSTLYGameCard from '../PerformanceTab/components/GHOSTLYGameCard';
import { useEnhancedPerformanceMetrics } from '@/hooks/useEnhancedPerformanceMetrics';
import { useSessionStore } from '@/store/sessionStore';
import { PerformanceCalculationResult } from '@/lib/performanceUtils';

/**
 * Score ranges for performance classification
 */
const SCORE_RANGES = {
  EXCELLENT: 80,
  GOOD: 60,
  FAIR: 40,
} as const;

/**
 * Score styling configuration for different performance levels
 */
const SCORE_STYLES = {
  excellent: {
    label: 'Excellent',
    textColor: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
    hexColor: '#10b981',
  },
  good: {
    label: 'Good',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-100',
    hexColor: '#3b82f6',
  },
  fair: {
    label: 'Fair',
    textColor: 'text-amber-700',
    bgColor: 'bg-amber-100',
    hexColor: '#f59e0b',
  },
  poor: {
    label: 'Poor',
    textColor: 'text-red-700',
    bgColor: 'bg-red-100',
    hexColor: '#ef4444',
  },
} as const;

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

/**
 * Get score styling based on performance score
 */
function getScoreStyle(score: number) {
  if (score >= SCORE_RANGES.EXCELLENT) return SCORE_STYLES.excellent;
  if (score >= SCORE_RANGES.GOOD) return SCORE_STYLES.good;
  if (score >= SCORE_RANGES.FAIR) return SCORE_STYLES.fair;
  return SCORE_STYLES.poor;
}

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
 */
const PerformanceCard: React.FC<PerformanceCardProps> = ({
  analysisResult,
  contractionDurationThreshold = 2000,
  sessionParams,
}) => {
  const { sessionParams: storeSessionParams } = useSessionStore();
  const enhancedPerformanceData = useEnhancedPerformanceMetrics(analysisResult);
  
  // Extract performance metrics with memoization
  const performanceMetrics = useMemo(() => ({
    gameScoreWeight: enhancedPerformanceData?.weights?.gameScore ?? 0,
    overallScore: enhancedPerformanceData?.overallScore ?? 0,
    symmetryScore: enhancedPerformanceData?.symmetryScore,
    therapeuticComplianceScore: enhancedPerformanceData?.complianceScore ?? 50,
    gameScore: analysisResult?.metadata?.score,
    gameLevel: analysisResult?.metadata?.level ? Number(analysisResult.metadata.level) : undefined,
    rpeLevel: sessionParams?.post_session_rpe ?? storeSessionParams?.rpe_level ?? 5,
  }), [enhancedPerformanceData, analysisResult, sessionParams, storeSessionParams]);

  const { 
    gameScoreWeight, 
    overallScore, 
    symmetryScore, 
    therapeuticComplianceScore,
    gameScore,
    gameLevel,
    rpeLevel 
  } = performanceMetrics;

  // Extract muscle data
  const leftMuscle = enhancedPerformanceData?.leftMuscle;
  const rightMuscle = enhancedPerformanceData?.rightMuscle;
  
  // Transform muscle data with memoization
  const muscleData = useMemo((): MuscleCardData[] => {
    if (!leftMuscle && !rightMuscle) return [];
    
    return [leftMuscle, rightMuscle].filter(Boolean).map((muscle, index) => {
      if (!muscle) return null;
      
      const channelNames = analysisResult ? Object.keys(analysisResult.analytics).sort() : [];
      const channelName = channelNames[index] || `Channel ${index + 1}`;
      const channelData = analysisResult?.analytics?.[channelName];
      const scoreStyle = getScoreStyle(muscle.totalScore);
      
      return {
        channelName,
        totalScore: muscle.totalScore,
        scoreLabel: scoreStyle.label,
        scoreTextColor: scoreStyle.textColor,
        scoreBgColor: scoreStyle.bgColor,
        scoreHexColor: scoreStyle.hexColor,
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
    }).filter((data): data is MuscleCardData => data !== null);
  }, [leftMuscle, rightMuscle, analysisResult, enhancedPerformanceData?.weights]);

  // Create overall performance data with memoization
  const overallPerformance = useMemo((): PerformanceCalculationResult => ({
    totalScore: overallScore,
    durationThreshold: contractionDurationThreshold,
    contributions: {
      compliance: enhancedPerformanceData?.weights?.compliance || DEFAULT_WEIGHTS.compliance,
      symmetry: enhancedPerformanceData?.weights?.symmetry || DEFAULT_WEIGHTS.symmetry,
      effort: enhancedPerformanceData?.weights?.effort || DEFAULT_WEIGHTS.effort,
      game: enhancedPerformanceData?.weights?.gameScore || DEFAULT_WEIGHTS.gameScore,
    },
    strongestDriver: 'compliance', // Default strongest driver
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
  }), [overallScore, contractionDurationThreshold, enhancedPerformanceData, leftMuscle, rightMuscle]);

  // Create overall score label with memoization
  const overallScoreLabel = useMemo((): ScoreLabel => {
    const scoreStyle = getScoreStyle(overallScore);
    return {
      label: scoreStyle.label,
      text: scoreStyle.textColor,
      bg: scoreStyle.bgColor,
      hex: scoreStyle.hexColor,
    };
  }, [overallScore]);

  // Render muscle compliance card with proper error handling
  const renderMuscleCard = (muscleCardData: MuscleCardData | undefined, index: number) => {
    if (!muscleCardData || !analysisResult) return null;

    return (
      <div 
        key={`muscle-${index}`}
        className="lg:col-span-4 xl:col-span-4 transform hover:scale-[1.01] transition-all duration-300 hover:shadow-lg hover:z-10 relative"
      >
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
          contractionDurationThreshold={overallPerformance.durationThreshold}
          averageContractionTime={muscleCardData.averageContractionTime}
          mvcValue={muscleCardData.mvcValue}
          mvcThreshold={muscleCardData.mvcThreshold}
          contractions={analysisResult.analytics[muscleCardData.channelName]?.contractions}
          componentScores={muscleCardData.componentScores}
        />
      </div>
    );
  };

  // Early return for loading state
  if (!enhancedPerformanceData) {
    return (
      <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-6 shadow-sm border border-slate-200 text-center min-h-[400px] flex items-center justify-center">
        <p className="text-slate-500">Calculating performance metrics...</p>
      </div>
    );
  }

  // Unified Grid Layout: Everything in a single, cohesive grid system
  return (
    <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-6 shadow-sm border border-slate-200">
      
      {/* MAIN PERFORMANCE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Muscle Compliance */}
        {renderMuscleCard(muscleData[0], 0)}
        
        {/* Overall Performance */}
        <div className="lg:col-span-4 xl:col-span-4 col-span-1 relative hover:z-10">
          <OverallPerformanceCard
            performanceData={overallPerformance}
            scoreLabel={overallScoreLabel.label}
            scoreTextColor={overallScoreLabel.text}
            scoreBgColor={overallScoreLabel.bg}
            scoreHexColor={overallScoreLabel.hex}
            therapeuticComplianceScore={therapeuticComplianceScore}
            symmetryScore={symmetryScore}
            gameScore={gameScore}
          />
        </div>

        {/* Right Muscle Compliance */}
        {renderMuscleCard(muscleData[1], 1)}
      </div>
      
      {/* SUPPORTING METRICS */}
      <SupportingMetrics
        symmetryScore={symmetryScore}
        rpeLevel={rpeLevel}
        gameScore={gameScore}
        gameLevel={gameLevel}
        gameScoreWeight={gameScoreWeight}
      />
    </div>
  );
};

export default PerformanceCard; 