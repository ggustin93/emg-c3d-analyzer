import { useMemo } from 'react';
import { 
  EMGAnalysisResult, 
  ScoringWeights, 
  ContractionDetectionParameters, 
  GameScoreNormalization,
  EnhancedPerformanceData,
  MusclePerformanceData,
  ComponentScore,
  ChannelAnalyticsData,
  Contraction 
} from '../types/emg';
import { useSessionStore } from '@/store/sessionStore';
import { getEffortScoreFromRPE } from '@/lib/effortScore';
import { useScoringConfiguration } from './useScoringConfiguration';
import { useBackendDefaults } from './useBackendDefaults';

// UI Presets for scoring configuration settings (user-facing features)
// These are used in SettingsTab for preset selection, not as fallback defaults
// All presets must sum to 1.0 per metricsDefinitions.md specification

export const QUALITY_FOCUSED_WEIGHTS: ScoringWeights = {
  compliance: 0.60,  // Higher emphasis on execution quality (w_c increased)
  symmetry: 0.25,    // Standard bilateral balance (w_s per spec)
  effort: 0.15,      // Lower emphasis on subjective effort (w_e reduced)
  gameScore: 0.00,   // No game score (w_g = 0 per spec)
  // Sub-weights for compliance (w_comp, w_int, w_dur must sum to 1.0)
  compliance_completion: 0.25, // Less focus on completion quantity
  compliance_intensity: 0.40,  // More focus on MVC quality  
  compliance_duration: 0.35,   // More focus on duration compliance
};

export const EXPERIMENTAL_WITH_GAME_WEIGHTS: ScoringWeights = {
  compliance: 0.40,  // Reduced compliance weight to accommodate game
  symmetry: 0.20,    // Slightly lower symmetry (w_s)
  effort: 0.15,      // Lower effort weight (w_e)
  gameScore: 0.25,   // Game score weight (w_g), experimental
  // Sub-weights for compliance (w_comp, w_int, w_dur must sum to 1.0)
  compliance_completion: 0.333, // Standard distribution per metricsDefinitions.md
  compliance_intensity: 0.333,  // Standard distribution per metricsDefinitions.md
  compliance_duration: 0.334,   // Standard distribution per metricsDefinitions.md
};

// Research-Optimized Contraction Detection Parameters (2024)
// Based on biomedical engineering literature and clinical validation studies
export const DEFAULT_DETECTION_PARAMS: ContractionDetectionParameters = {
  threshold_factor: 0.20,        // Balanced at 20% for optimal sensitivity/specificity
  min_duration_ms: 100,          // Increased from 50ms to 100ms for clinical relevance
  smoothing_window_ms: 100,      // Increased from 25ms to 100ms for better stability  
  merge_threshold_ms: 200,       // Reduced from 500ms to 200ms for better temporal resolution
  refractory_period_ms: 50,      // Increased from 0ms to 50ms to prevent artifacts
  quality_threshold_ms: 2000,    // Maintained for therapeutic compliance
  mvc_threshold_percentage: 75   // Maintained for clinical standards
};

// Game Score Normalization per metricsDefinitions.md: S_game = (points achieved / max achievable points) × 100
const normalizeGameScore = (
  rawScore: number | null | undefined,
  normalizationParams?: GameScoreNormalization
): number => {
  if (!rawScore) return 0;
  
  // Linear mapping per metricsDefinitions.md specification
  // Note: Max achievable points adapt via Dynamic Difficulty Adjustment (DDA) system
  const min = normalizationParams?.min_score || 0;
  const max = normalizationParams?.max_score || 100;
  
  const normalized = ((rawScore - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, normalized));
};

// Subjective effort score per clinical spec (post-session RPE only)
const calculateEffortScore = (_preRPE?: number | null, postRPE?: number | null): number => {
  return getEffortScoreFromRPE(postRPE);
};

// BFR Safety Gate per metricsDefinitions.md: C_BFR = 1.0 if pressure ∈ [45%, 55%] AOP, 0.0 otherwise
const calculateComplianceScore = (bfrParameters?: any): number => {
  if (!bfrParameters) return 100; // No BFR penalty when data unavailable
  
  // Handle bilateral BFR compliance structure
  if (bfrParameters.left && bfrParameters.right) {
    const leftCompliant = bfrParameters.left.is_compliant === true;
    const rightCompliant = bfrParameters.right.is_compliant === true;
    
    // metricsDefinitions.md: BFR violations result in 0.0 penalty (full penalty)
    if (leftCompliant && rightCompliant) return 100; // C_BFR = 1.0
    return 0; // C_BFR = 0.0 (any non-compliance triggers full penalty)
  }
  
  // Legacy structure fallback
  if (bfrParameters.is_compliant === true) return 100; // C_BFR = 1.0
  if (bfrParameters.is_compliant === false) return 0;  // C_BFR = 0.0
  
  return 100; // Default: no penalty when compliance status unclear
};

// Per-Muscle Compliance Calculation per metricsDefinitions.md: S_comp^muscle = w_comp × R_comp + w_int × R_int + w_dur × R_dur
// SINGLE SOURCE OF TRUTH: Uses backend flags (meets_mvc, meets_duration) when available
// This ensures consistency with useContractionAnalysis, useLiveAnalytics, and StatsPanel
const calculateMuscleMetrics = (
  channelData: ChannelAnalyticsData,
  expectedContractions: number,
  durationThreshold: number,
  mvcThreshold: number
): MusclePerformanceData => {
  const contractions = channelData.contractions || [];
  const totalContractions = contractions.length;
  
  // 1. Completion Score
  const completionScore: ComponentScore = {
    value: Math.min((totalContractions / expectedContractions) * 100, 100),
    count: totalContractions,
    total: expectedContractions,
    formula: "min(actual/expected × 100, 100)"
  };
  
  // 2. MVC Quality Score (SINGLE SOURCE OF TRUTH: Trust backend flags)
  // Use backend meets_mvc flag when available, fallback to calculation only if needed
  const goodMVCCount = contractions.filter(c => {
    // TRUST backend meets_mvc flag when available
    if (c.meets_mvc !== null && c.meets_mvc !== undefined) {
      return c.meets_mvc === true;
    }
    // Fallback calculation only if backend flag is missing
    const mvcThresholdValue = channelData.mvc75_threshold || 0;
    const dynamicMvcThreshold = mvcThresholdValue * (mvcThreshold / 100);
    return c.max_amplitude >= dynamicMvcThreshold;
  }).length;
  
  const mvcQualityScore: ComponentScore = {
    value: totalContractions > 0 ? (goodMVCCount / totalContractions) * 100 : 0,
    count: goodMVCCount,
    total: totalContractions,
    formula: `contractions ≥${mvcThreshold}% MVC / total × 100`
  };
  
  // 3. Quality Threshold Score (SINGLE SOURCE OF TRUTH: Trust backend flags)
  // Use backend meets_duration flag when available, fallback to calculation only if needed
  const qualityThresholdCount = contractions.filter(c => {
    // TRUST backend meets_duration flag when available
    if (c.meets_duration !== null && c.meets_duration !== undefined) {
      return c.meets_duration === true;
    }
    // Fallback calculation only if backend flag is missing
    return c.duration_ms >= durationThreshold;
  }).length;
  const qualityThresholdScore: ComponentScore = {
    value: totalContractions > 0 ? (qualityThresholdCount / totalContractions) * 100 : 0,
    count: qualityThresholdCount,
    total: totalContractions,
    formula: `contractions ≥${durationThreshold}ms / total × 100`
  };
  
  return {
    muscleName: '',
    totalScore: 0, // Calculé plus tard avec les poids
    components: {
      completion: completionScore,
      mvcQuality: mvcQualityScore,
      qualityThreshold: qualityThresholdScore
    }
  };
};

export const useEnhancedPerformanceMetrics = (
  analysisResult: EMGAnalysisResult | null
): EnhancedPerformanceData | null => {
  const { sessionParams } = useSessionStore();
  const { weights: databaseWeights, isLoading: isWeightsLoading } = useScoringConfiguration();
  const { defaults: backendDefaults, loading: defaultsLoading } = useBackendDefaults();
  
  const enhancedData = useMemo(() => {
    if (!analysisResult?.analytics || !sessionParams || isWeightsLoading || defaultsLoading || !backendDefaults) {
      return null;
    }
    
    // SINGLE SOURCE OF TRUTH: Priority for simplified system
    // Single Source of Truth: Database weights only (no fallback)
    // Session params are now only for local simulation (doesn't affect database results)
    const weights = databaseWeights;
    
    if (!weights) {
      console.warn('No scoring weights available from database, hook will return null (SSoT)');
      return null;
    }
    
    // For local simulation, we can use session params if available
    const simulationWeights = sessionParams.enhanced_scoring?.enabled && sessionParams.enhanced_scoring?.weights
      ? sessionParams.enhanced_scoring.weights
      : weights;
    const detectionParams = sessionParams.contraction_detection || DEFAULT_DETECTION_PARAMS;
    const isDebugMode = sessionParams.experimental_features?.enabled || false;
    
    // Analysis parameters from session configuration
    const durationThreshold = sessionParams.contraction_duration_threshold || detectionParams.quality_threshold_ms;
    const mvcThreshold = sessionParams.session_mvc_threshold_percentage || detectionParams.mvc_threshold_percentage;
    
    // Retrieve muscle data from analytics
    const channelNames = Object.keys(analysisResult.analytics).sort();
    
    if (channelNames.length < 2) {
      return null; // Bilateral analysis requires both left and right muscles
    }
    
    // Calculate metrics for each muscle with specific targets
    const leftChannelData = analysisResult.analytics[channelNames[0]];
    const rightChannelData = analysisResult.analytics[channelNames[1]];
    
    // Get per-channel expected contractions
    // Use database values if available, otherwise use backend defaults from API
    const leftExpectedContractions = sessionParams.session_expected_contractions_ch1 || backendDefaults.target_contractions_ch1;
    const rightExpectedContractions = sessionParams.session_expected_contractions_ch2 || backendDefaults.target_contractions_ch2;
    
    let leftMuscle = calculateMuscleMetrics(leftChannelData, leftExpectedContractions, durationThreshold, mvcThreshold);
    let rightMuscle = calculateMuscleMetrics(rightChannelData, rightExpectedContractions, durationThreshold, mvcThreshold);
    
    leftMuscle.muscleName = "Left";
    rightMuscle.muscleName = "Right";
    
    // Per-muscle total scores (individual compliance scores without symmetry/effort)
    const calculateMuscleScore = (muscle: MusclePerformanceData): number => {
      const componentSum = weights.compliance_completion + weights.compliance_intensity + weights.compliance_duration;
      if (componentSum === 0) return 0;
      
      return (
        muscle.components.completion.value * weights.compliance_completion +
        muscle.components.mvcQuality.value * weights.compliance_intensity +
        muscle.components.qualityThreshold.value * weights.compliance_duration
      ) / componentSum;
    };
    
    leftMuscle.totalScore = Math.round(calculateMuscleScore(leftMuscle));
    rightMuscle.totalScore = Math.round(calculateMuscleScore(rightMuscle));
    
    // Symmetry Score per metricsDefinitions.md - Medical Standard Asymmetry Index Formula
    // S_symmetry = (1 - |S_comp^left - S_comp^right| / (S_comp^left + S_comp^right)) × 100
    // This formula is standard in rehabilitation medicine and provides clinically meaningful results
    const symmetryScore = leftMuscle.totalScore + rightMuscle.totalScore > 0
      ? Math.round((1 - Math.abs(leftMuscle.totalScore - rightMuscle.totalScore) / 
                   (leftMuscle.totalScore + rightMuscle.totalScore)) * 100)
      : 100;
    
    // Subjective Effort Score per metricsDefinitions.md (post-session RPE only)
    const effortScore = calculateEffortScore(
      sessionParams.pre_session_rpe,
      sessionParams.post_session_rpe
    );
    
    // BFR Safety Gate Score per metricsDefinitions.md
    const complianceScore = calculateComplianceScore(sessionParams.bfr_parameters);
    
    // Game Performance Score per metricsDefinitions.md (normalized)
    const gameScoreNormalized = normalizeGameScore(
      analysisResult.metadata?.score,
      sessionParams.enhanced_scoring?.game_score_normalization
    );
    
    // Overall Score per metricsDefinitions.md: P_overall = w_c × S_compliance + w_s × S_symmetry + w_e × S_effort + w_g × S_game
    // BFR Safety Gate: P_overall = (...) × C_BFR (applied as final multiplier)
    const therapeuticComplianceScore = (leftMuscle.totalScore + rightMuscle.totalScore) / 2;
    
    // Calculate base score using simulation weights (for UI display)
    // Note: Database results use 'weights', UI simulation uses 'simulationWeights'
    const baseOverallScore = Math.round(
      simulationWeights.compliance * therapeuticComplianceScore +
      simulationWeights.symmetry * symmetryScore +
      simulationWeights.effort * effortScore +
      simulationWeights.gameScore * gameScoreNormalized
    );
    
    // Apply BFR Safety Gate (C_BFR): multiply by compliance score (0.0-1.0 range)
    // metricsDefinitions.md: C_BFR = 1.0 if compliant, 0.0 if non-compliant
    const bfrSafetyGate = complianceScore / 100; // Convert percentage to multiplier
    const overallScore = Math.round(baseOverallScore * bfrSafetyGate);
    
    return {
      overallScore,
      leftMuscle,
      rightMuscle,
      symmetryScore,
      effortScore,
      complianceScore,
      gameScoreNormalized,
      weights: simulationWeights,  // Return simulation weights for UI display
      isDebugMode
    };
    
  }, [analysisResult, sessionParams, databaseWeights, isWeightsLoading, backendDefaults, defaultsLoading]);
  
  return enhancedData;
};