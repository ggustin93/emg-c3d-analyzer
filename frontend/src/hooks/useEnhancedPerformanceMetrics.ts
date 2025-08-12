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

// Presets par défaut - Based on GHOSTLY+ TBM Clinical Trial
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  completion: 0.00,  // Not used in P_overall
  mvcQuality: 0.00,  // Part of compliance score
  qualityThreshold: 0.00,  // Part of compliance score
  symmetry: 0.30,  // Muscle Symmetry (increased from 0.25)
  effort: 0.25,    // Subjective Effort (RPE) (increased from 0.20)
  compliance: 0.45,  // Therapeutic Compliance (composite) (increased from 0.40)
  gameScore: 0.00   // Game Performance (default to 0 as requested)
};

export const QUALITY_FOCUSED_WEIGHTS: ScoringWeights = {
  completion: 0.00,
  mvcQuality: 0.00,
  qualityThreshold: 0.00,
  symmetry: 0.30,  // Higher emphasis on bilateral balance
  effort: 0.15,    // Lower emphasis on subjective effort
  compliance: 0.55,  // Much higher emphasis on execution quality
  gameScore: 0.00   // No game score
};

export const EXPERIMENTAL_WITH_GAME_WEIGHTS: ScoringWeights = {
  completion: 0.00,
  mvcQuality: 0.00,
  qualityThreshold: 0.00,
  symmetry: 0.20,  // Slightly lower symmetry
  effort: 0.15,    // Lower effort weight
  compliance: 0.35,  // Lower compliance weight
  gameScore: 0.30   // Higher game score weight
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

// Fonction pour normaliser le score du jeu
const normalizeGameScore = (
  rawScore: number | null | undefined,
  normalizationParams?: GameScoreNormalization
): number => {
  if (!rawScore) return 0;
  
  // TODO: Implémenter la vraie normalisation quand l'algorithme sera défini
  // Pour l'instant, simple mapping linéaire
  const min = normalizationParams?.min_score || 0;
  const max = normalizationParams?.max_score || 100;
  
  const normalized = ((rawScore - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, normalized));
};

// Subjective effort score per clinical spec (post-session RPE only)
const calculateEffortScore = (_preRPE?: number | null, postRPE?: number | null): number => {
  return getEffortScoreFromRPE(postRPE);
};

// Fonction pour calculer le score de compliance BFR
const calculateComplianceScore = (bfrParameters?: any): number => {
  if (!bfrParameters) return 50; // Score neutre si pas de données BFR
  
  // Handle new left/right structure
  if (bfrParameters.left && bfrParameters.right) {
    const leftCompliant = bfrParameters.left.is_compliant === true;
    const rightCompliant = bfrParameters.right.is_compliant === true;
    
    if (leftCompliant && rightCompliant) return 100;
    if (!leftCompliant && !rightCompliant) return 0;
    return 75; // Partial compliance (one side compliant)
  }
  
  // Legacy structure fallback
  if (bfrParameters.is_compliant === true) return 100;
  if (bfrParameters.is_compliant === false) return 0;
  
  return 50; // Fallback pour données incertaines
};

// Fonction pour calculer les métriques d'un muscle
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
    const mvcThresholdValue = channelData.mvc_threshold_actual_value || 0;
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
  
  const enhancedData = useMemo(() => {
    if (!analysisResult?.analytics || !sessionParams) {
      return null;
    }
    
    // Récupération des paramètres
    const weights = sessionParams.enhanced_scoring?.weights || DEFAULT_SCORING_WEIGHTS;
    const detectionParams = sessionParams.contraction_detection || DEFAULT_DETECTION_PARAMS;
    const isDebugMode = sessionParams.experimental_features?.enabled || false;
    
    // Paramètres d'analyse
    const durationThreshold = sessionParams.contraction_duration_threshold || detectionParams.quality_threshold_ms;
    const mvcThreshold = sessionParams.session_mvc_threshold_percentage || detectionParams.mvc_threshold_percentage;
    
    // Récupération des données des muscles
    const channelNames = Object.keys(analysisResult.analytics).sort();
    
    if (channelNames.length < 2) {
      return null; // Nous avons besoin de deux muscles (L/R)
    }
    
    // Calcul des métriques pour chaque muscle avec leurs objectifs spécifiques
    const leftChannelData = analysisResult.analytics[channelNames[0]];
    const rightChannelData = analysisResult.analytics[channelNames[1]];
    
    // Get per-channel expected contractions, fallback to split total
    const leftExpectedContractions = sessionParams.session_expected_contractions_ch1 || 
      Math.ceil((sessionParams.session_expected_contractions || 36) / 2);
    const rightExpectedContractions = sessionParams.session_expected_contractions_ch2 || 
      Math.floor((sessionParams.session_expected_contractions || 36) / 2);
    
    let leftMuscle = calculateMuscleMetrics(leftChannelData, leftExpectedContractions, durationThreshold, mvcThreshold);
    let rightMuscle = calculateMuscleMetrics(rightChannelData, rightExpectedContractions, durationThreshold, mvcThreshold);
    
    leftMuscle.muscleName = "Left";
    rightMuscle.muscleName = "Right";
    
    // Calcul des scores totaux par muscle (sans symétrie ni effort)
    const calculateMuscleScore = (muscle: MusclePerformanceData): number => {
      const componentSum = weights.completion + weights.mvcQuality + weights.qualityThreshold;
      if (componentSum === 0) return 0;
      
      return (
        muscle.components.completion.value * weights.completion +
        muscle.components.mvcQuality.value * weights.mvcQuality +
        muscle.components.qualityThreshold.value * weights.qualityThreshold
      ) / componentSum;
    };
    
    leftMuscle.totalScore = Math.round(calculateMuscleScore(leftMuscle));
    rightMuscle.totalScore = Math.round(calculateMuscleScore(rightMuscle));
    
    // Calcul de la symétrie
    const symmetryScore = leftMuscle.totalScore > 0 && rightMuscle.totalScore > 0
      ? Math.round((Math.min(leftMuscle.totalScore, rightMuscle.totalScore) / 
                   Math.max(leftMuscle.totalScore, rightMuscle.totalScore)) * 100)
      : 100;
    
    // Calcul de l'effort subjectif
    const effortScore = calculateEffortScore(
      sessionParams.pre_session_rpe,
      sessionParams.post_session_rpe
    );
    
    // Calcul du score de compliance BFR
    const complianceScore = calculateComplianceScore(sessionParams.bfr_parameters);
    
    // Calcul du score de jeu normalisé
    const gameScoreNormalized = normalizeGameScore(
      analysisResult.metadata?.score,
      sessionParams.enhanced_scoring?.game_score_normalization
    );
    
    // Calcul du score global
    const muscleAverage = (leftMuscle.totalScore + rightMuscle.totalScore) / 2;
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    
    const overallScore = totalWeight > 0 ? Math.round(
      (muscleAverage * (weights.completion + weights.mvcQuality + weights.qualityThreshold) +
       symmetryScore * weights.symmetry +
       effortScore * weights.effort +
       gameScoreNormalized * weights.gameScore) / totalWeight
    ) : 0;
    
    return {
      overallScore,
      leftMuscle,
      rightMuscle,
      symmetryScore,
      effortScore,
      complianceScore,
      gameScoreNormalized,
      weights,
      isDebugMode
    };
    
  }, [analysisResult, sessionParams]);
  
  return enhancedData;
};