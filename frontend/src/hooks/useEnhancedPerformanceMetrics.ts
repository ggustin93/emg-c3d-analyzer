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

// Presets par défaut
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  completion: 0.20,
  mvcQuality: 0.25,
  qualityThreshold: 0.15,
  symmetry: 0.15,
  effort: 0.15,
  compliance: 0.10,
  gameScore: 0.00
};

export const QUALITY_FOCUSED_WEIGHTS: ScoringWeights = {
  completion: 0.15,
  mvcQuality: 0.35,
  qualityThreshold: 0.20,
  symmetry: 0.15,
  effort: 0.10,
  compliance: 0.05,
  gameScore: 0.00
};

export const EXPERIMENTAL_WITH_GAME_WEIGHTS: ScoringWeights = {
  completion: 0.15,
  mvcQuality: 0.20,
  qualityThreshold: 0.10,
  symmetry: 0.15,
  effort: 0.10,
  compliance: 0.05,
  gameScore: 0.25
};

export const DEFAULT_DETECTION_PARAMS: ContractionDetectionParameters = {
  threshold_factor: 0.3,
  min_duration_ms: 50,
  smoothing_window_ms: 25,
  merge_threshold_ms: 500,
  refractory_period_ms: 0,
  quality_threshold_ms: 2000,
  mvc_threshold_percentage: 75
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
  const max = normalizationParams?.max_score || 1000;
  
  const normalized = ((rawScore - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, normalized));
};

// Fonction pour calculer le score d'effort subjectif
const calculateEffortScore = (preRPE?: number | null, postRPE?: number | null): number => {
  if (!preRPE || !postRPE) return 50; // Score neutre si pas de données
  
  const change = postRPE - preRPE;
  
  // Optimal: changement de +2 à +4
  if (change >= 2 && change <= 4) return 100;
  if (change === 1 || change === 5) return 80;
  if (change === 0 || change === 6) return 60;
  if (change < 0 || change > 6) return 40;
  
  return 50; // Fallback
};

// Fonction pour calculer le score de compliance BFR
const calculateComplianceScore = (bfrParameters?: any): number => {
  if (!bfrParameters) return 50; // Score neutre si pas de données BFR
  
  // BFR compliance basé sur is_compliant du système BFR
  if (bfrParameters.is_compliant === true) return 100;
  if (bfrParameters.is_compliant === false) return 0;
  
  return 50; // Fallback pour données incertaines
};

// Fonction pour calculer les métriques d'un muscle
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
  
  // 2. MVC Quality Score (recalculé avec seuil dynamique)
  const mvcThresholdValue = channelData.mvc_threshold_actual_value || 0;
  const dynamicMvcThreshold = mvcThresholdValue * (mvcThreshold / 100);
  
  const goodMVCCount = contractions.filter(c => 
    c.max_amplitude >= dynamicMvcThreshold
  ).length;
  
  const mvcQualityScore: ComponentScore = {
    value: totalContractions > 0 ? (goodMVCCount / totalContractions) * 100 : 0,
    count: goodMVCCount,
    total: totalContractions,
    formula: `contractions ≥${mvcThreshold}% MVC / total × 100`
  };
  
  // 3. Quality Threshold Score (adaptatif pour la réhabilitation)
  const qualityThresholdCount = contractions.filter(c => c.duration_ms >= durationThreshold).length;
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
      gameScoreNormalized,
      weights,
      isDebugMode
    };
    
  }, [analysisResult, sessionParams]);
  
  return enhancedData;
};