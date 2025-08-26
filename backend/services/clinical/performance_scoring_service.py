"""
Performance Scoring Service
===========================

🎯 GHOSTLY+ Performance Metrics Calculation Service
Based on Clinical Trial Protocol (metricsDefinitions.md)

This service implements the complete scoring algorithm with:
- Real-time Performance Score (P_overall)
- Therapeutic Compliance Score (S_compliance)
- Muscle Symmetry Score (S_symmetry)
- Subjective Effort Score (S_effort)
- Game Performance Score (S_game)
- Longitudinal Adherence Score

Author: EMG C3D Analyzer Team
Date: 2025-08-12
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, List, Tuple
from dataclasses import dataclass
import numpy as np

from database.supabase_client import get_supabase_client
from config import DevelopmentDefaults

logger = logging.getLogger(__name__)


@dataclass
class RPEMapping:
    """Configurable RPE (Rating of Perceived Exertion) mapping for researcher customization"""
    # Default mapping from metricsDefinitions.md
    optimal_range: List[int] = None     # Default: [4, 5, 6] → 100%
    acceptable_range: List[int] = None  # Default: [3, 7] → 80%
    suboptimal_range: List[int] = None  # Default: [2, 8] → 60%
    poor_range: List[int] = None        # Default: [0, 1, 9, 10] → 20%
    
    optimal_score: float = 100.0
    acceptable_score: float = 80.0
    suboptimal_score: float = 60.0
    poor_score: float = 20.0
    default_score: float = 50.0  # For unexpected values
    
    def __post_init__(self):
        """Initialize default ranges if not provided"""
        if self.optimal_range is None:
            self.optimal_range = [4, 5, 6]
        if self.acceptable_range is None:
            self.acceptable_range = [3, 7]
        if self.suboptimal_range is None:
            self.suboptimal_range = [2, 8]
        if self.poor_range is None:
            self.poor_range = [0, 1, 9, 10]
    
    def get_effort_score(self, rpe: int) -> float:
        """Get effort score for given RPE value"""
        if rpe in self.optimal_range:
            return self.optimal_score
        elif rpe in self.acceptable_range:
            return self.acceptable_score
        elif rpe in self.suboptimal_range:
            return self.suboptimal_score
        elif rpe in self.poor_range:
            return self.poor_score
        else:
            return self.default_score


@dataclass
class ScoringWeights:
    """Configurable weights for performance scoring (must sum to 1.0)"""
    w_compliance: float = 0.40  # Therapeutic Compliance
    w_symmetry: float = 0.25    # Muscle Symmetry
    w_effort: float = 0.20      # Subjective Effort (RPE)
    w_game: float = 0.15        # Game Performance
    
    # Sub-component weights for compliance (must sum to 1.0)
    w_completion: float = 0.333  # Completion rate weight
    w_intensity: float = 0.333   # Intensity rate weight
    w_duration: float = 0.334    # Duration rate weight
    
    def validate(self) -> bool:
        """Validate that weights sum to 1.0 (within tolerance)"""
        main_sum = self.w_compliance + self.w_symmetry + self.w_effort + self.w_game
        sub_sum = self.w_completion + self.w_intensity + self.w_duration
        return abs(main_sum - 1.0) < 0.01 and abs(sub_sum - 1.0) < 0.01


@dataclass
class SessionMetrics:
    """Metrics from a single therapy session"""
    session_id: str
    
    # Per-muscle metrics (left/right)
    left_total_contractions: int
    left_good_contractions: int
    left_mvc_contractions: int
    left_duration_contractions: int
    
    right_total_contractions: int
    right_good_contractions: int
    right_mvc_contractions: int
    right_duration_contractions: int
    
    # BFR Data
    bfr_pressure_aop: Optional[float] = None
    bfr_compliant: bool = True
    
    # Subjective Data (may be None if not yet provided)
    rpe_post_session: Optional[int] = None
    
    # Game Data (may be None if not yet available)
    game_points_achieved: Optional[int] = None
    game_points_max: Optional[int] = None
    
    # Expected contractions (from protocol)
    expected_contractions_per_muscle: int = 12


class PerformanceScoringService:
    """
    Service for calculating GHOSTLY+ performance scores
    
    Implements the complete scoring algorithm from metricsDefinitions.md
    with support for partial data (some scores can be calculated later)
    """
    
    def __init__(self, supabase_client=None):
        self.client = supabase_client or get_supabase_client(use_service_key=True)
        self.weights = ScoringWeights()
        self.rpe_mapping = RPEMapping()  # Default RPE mapping
        
        logger.info("🎯 Performance Scoring Service initialized")
    
    def _load_scoring_weights_from_database(self, session_id: str) -> ScoringWeights:
        """
        Load configurable scoring weights from database
        Fallback to defaults if not found
        """
        try:
            # Check for session-specific or global scoring weights configuration
            weights_query = self.client.table('scoring_configuration').select('*').order('created_at', desc=True).limit(1).execute()
            
            if weights_query.data:
                config = weights_query.data[0]
                return ScoringWeights(
                    w_compliance=config.get('weight_compliance', 0.40),
                    w_symmetry=config.get('weight_symmetry', 0.25),
                    w_effort=config.get('weight_effort', 0.20),
                    w_game=config.get('weight_game', 0.15),
                    w_completion=config.get('weight_completion', 0.333),
                    w_intensity=config.get('weight_intensity', 0.333),
                    w_duration=config.get('weight_duration', 0.334)
                )
            else:
                logger.info("No custom scoring weights found, using defaults")
                return self.weights
                
        except Exception as e:
            logger.warning(f"Failed to load scoring weights from database: {e}, using defaults")
            return self.weights
    
    def _load_rpe_mapping_from_database(self, session_id: str) -> RPEMapping:
        """
        Load configurable RPE mapping from database (researcher role only)
        Fallback to defaults if not found
        """
        try:
            # Check for researcher-configured RPE mapping
            rpe_query = self.client.table('rpe_mapping_configuration').select('*').eq('active', True).order('created_at', desc=True).limit(1).execute()
            
            if rpe_query.data:
                config = rpe_query.data[0]
                logger.info(f"📊 Loading custom RPE mapping from researcher configuration")
                
                return RPEMapping(
                    optimal_range=config.get('optimal_range', [4, 5, 6]),
                    acceptable_range=config.get('acceptable_range', [3, 7]),
                    suboptimal_range=config.get('suboptimal_range', [2, 8]),
                    poor_range=config.get('poor_range', [0, 1, 9, 10]),
                    optimal_score=config.get('optimal_score', 100.0),
                    acceptable_score=config.get('acceptable_score', 80.0),
                    suboptimal_score=config.get('suboptimal_score', 60.0),
                    poor_score=config.get('poor_score', 20.0),
                    default_score=config.get('default_score', 50.0)
                )
            else:
                logger.info("📊 No custom RPE mapping found, using metricsDefinitions.md defaults")
                return self.rpe_mapping
                
        except Exception as e:
            logger.warning(f"Failed to load RPE mapping from database: {e}, using defaults")
            return self.rpe_mapping
    
    def calculate_performance_scores(self, 
                                    session_id: str,
                                    session_metrics: Optional[SessionMetrics] = None) -> Dict:
        """
        Calculate all available performance scores for a session
        
        Args:
            session_id: Therapy session UUID
            session_metrics: Optional pre-collected metrics (if None, fetches from DB)
            
        Returns:
            Dictionary with calculated scores and sub-components
        """
        logger.info(f"📊 Calculating performance scores for session: {session_id}")
        
        # Step 0: Load configurable weights and RPE mapping from database  
        self.weights = self._load_scoring_weights_from_database(session_id)
        self.rpe_mapping = self._load_rpe_mapping_from_database(session_id)
        logger.info(f"📊 Using weights: Compliance={self.weights.w_compliance}, Symmetry={self.weights.w_symmetry}, Effort={self.weights.w_effort}, Game={self.weights.w_game}")
        logger.info(f"📊 Using RPE mapping: Optimal={self.rpe_mapping.optimal_range}→{self.rpe_mapping.optimal_score}%")
        
        # Step 1: Collect metrics if not provided
        if session_metrics is None:
            session_metrics = self._fetch_session_metrics(session_id)
            if not session_metrics:
                logger.error(f"❌ Could not fetch metrics for session: {session_id}")
                return {'error': 'Session metrics not found'}
        
        # Step 2: Calculate sub-components
        compliance_components = self._calculate_compliance_components(session_metrics)
        symmetry_score = self._calculate_symmetry_score(
            compliance_components['left_muscle_compliance'],
            compliance_components['right_muscle_compliance']
        )
        effort_score, rpe_source = self._calculate_effort_score(session_metrics.rpe_post_session)
        game_score = self._calculate_game_score(
            session_metrics.game_points_achieved,
            session_metrics.game_points_max
        )
        
        # Step 3: Apply BFR safety gate
        bfr_gate = self._calculate_bfr_gate(session_metrics.bfr_pressure_aop)
        
        # Step 4: Calculate overall compliance score
        compliance_score = compliance_components['overall_compliance'] * bfr_gate
        
        # Step 5: Calculate overall performance (if all components available)
        overall_score = None
        if all(x is not None for x in [compliance_score, symmetry_score, effort_score, game_score]):
            overall_score = (
                self.weights.w_compliance * compliance_score +
                self.weights.w_symmetry * symmetry_score +
                self.weights.w_effort * effort_score +
                self.weights.w_game * game_score
            )
        
        # Step 6: Prepare result
        result = {
            'session_id': session_id,
            'overall_score': overall_score,
            'compliance_score': compliance_score,
            'symmetry_score': symmetry_score,
            'effort_score': effort_score,
            'game_score': game_score,
            'bfr_compliant': bool(bfr_gate == 1.0),
            'bfr_pressure_aop': session_metrics.bfr_pressure_aop,
            'rpe_post_session': session_metrics.rpe_post_session,
            'rpe_source': rpe_source,  # Source of RPE data for debugging
            **compliance_components,
            'weights_used': {
                'w_compliance': self.weights.w_compliance,
                'w_symmetry': self.weights.w_symmetry,
                'w_effort': self.weights.w_effort,
                'w_game': self.weights.w_game,
                'w_completion': self.weights.w_completion,
                'w_intensity': self.weights.w_intensity,
                'w_duration': self.weights.w_duration
            },
            'data_completeness': {
                'has_emg_data': True,
                'has_rpe': session_metrics.rpe_post_session is not None,
                'has_game_data': session_metrics.game_points_achieved is not None,
                'has_bfr_data': session_metrics.bfr_pressure_aop is not None,
                'rpe_source': rpe_source
            }
        }
        
        logger.info(f"✅ Scores calculated: Overall={overall_score:.1f}%" if overall_score else "⚠️ Partial scores calculated (waiting for RPE/game data)")
        
        return result
    
    def _calculate_compliance_components(self, metrics: SessionMetrics) -> Dict:
        """
        Calculate per-muscle compliance and sub-components
        
        S_comp^muscle = w_comp * R_comp + w_int * R_int + w_dur * R_dur
        """
        # Left muscle compliance
        left_completion_rate = metrics.left_total_contractions / metrics.expected_contractions_per_muscle
        left_intensity_rate = (metrics.left_mvc_contractions / metrics.left_total_contractions 
                              if metrics.left_total_contractions > 0 else 0.0)
        left_duration_rate = (metrics.left_duration_contractions / metrics.left_total_contractions
                             if metrics.left_total_contractions > 0 else 0.0)
        
        left_muscle_compliance = (
            self.weights.w_completion * left_completion_rate +
            self.weights.w_intensity * left_intensity_rate +
            self.weights.w_duration * left_duration_rate
        ) * 100  # Convert to percentage
        
        # Right muscle compliance
        right_completion_rate = metrics.right_total_contractions / metrics.expected_contractions_per_muscle
        right_intensity_rate = (metrics.right_mvc_contractions / metrics.right_total_contractions
                               if metrics.right_total_contractions > 0 else 0.0)
        right_duration_rate = (metrics.right_duration_contractions / metrics.right_total_contractions
                              if metrics.right_total_contractions > 0 else 0.0)
        
        right_muscle_compliance = (
            self.weights.w_completion * right_completion_rate +
            self.weights.w_intensity * right_intensity_rate +
            self.weights.w_duration * right_duration_rate
        ) * 100  # Convert to percentage
        
        # Overall compliance (average of left and right)
        overall_compliance = (left_muscle_compliance + right_muscle_compliance) / 2
        
        return {
            'left_muscle_compliance': left_muscle_compliance,
            'right_muscle_compliance': right_muscle_compliance,
            'overall_compliance': overall_compliance,
            'completion_rate_left': left_completion_rate,
            'completion_rate_right': right_completion_rate,
            'intensity_rate_left': left_intensity_rate,
            'intensity_rate_right': right_intensity_rate,
            'duration_rate_left': left_duration_rate,
            'duration_rate_right': right_duration_rate
        }
    
    def _calculate_symmetry_score(self, left_compliance: float, right_compliance: float) -> float:
        """
        Calculate muscle symmetry score
        
        S_symmetry = (1 - |left - right| / (left + right)) × 100
        """
        if left_compliance + right_compliance == 0:
            return 0.0
        
        asymmetry = abs(left_compliance - right_compliance) / (left_compliance + right_compliance)
        symmetry_score = (1 - asymmetry) * 100
        
        return symmetry_score
    
    def _calculate_effort_score(self, rpe: Optional[int]) -> Tuple[Optional[float], str]:
        """
        Calculate subjective effort score based on RPE (Rating of Perceived Exertion)
        
        RPE Scale: 0-10 (Borg CR10)
        Uses configurable RPE mapping and development defaults when needed
        Returns: (effort_score, rpe_source)
        """
        # Use development default if RPE is missing
        if rpe is None:
            rpe = DevelopmentDefaults.RPE_POST_SESSION
            rpe_source = "development_default"
            logger.info(f"💡 Using default RPE={rpe} for development - therapist can update later")
        else:
            rpe_source = "c3d_metadata"
        
        # Use configurable RPE mapping (loaded from database or default)
        effort_score = self.rpe_mapping.get_effort_score(rpe)
        
        # Log when using unexpected RPE values
        if effort_score == self.rpe_mapping.default_score:
            logger.warning(f"🔍 Unexpected RPE value: {rpe}, using default score: {effort_score}%")
        
        return effort_score, rpe_source
    
    def _calculate_game_score(self, 
                             points_achieved: Optional[int], 
                             points_max: Optional[int]) -> Optional[float]:
        """
        Calculate game performance score
        
        S_game = (points_achieved / points_max) × 100
        """
        if points_achieved is None or points_max is None:
            return None
        
        if points_max == 0:
            return 0.0
        
        return (points_achieved / points_max) * 100
    
    def _calculate_bfr_gate(self, pressure_aop: Optional[float]) -> float:
        """
        Calculate BFR safety gate
        
        C_BFR = 1.0 if pressure ∈ [45%, 55%] AOP, else 0.0
        CRITICAL: No BFR data = non-compliant (0.0) for safety
        """
        if pressure_aop is None:
            logger.warning("⚠️ No BFR pressure data - applying safety penalty (C_BFR = 0.0)")
            return 0.0  # Non-compliant if no BFR data (safety first)
        
        # BFR safety window: 45-55% AOP
        if 45.0 <= pressure_aop <= 55.0:
            return 1.0
        else:
            logger.warning(f"⚠️ BFR pressure outside safety window: {pressure_aop}% AOP")
            return 0.0
    
    def _fetch_session_metrics(self, session_id: str) -> Optional[SessionMetrics]:
        """
        Fetch metrics from database tables
        """
        try:
            # Fetch EMG statistics
            emg_stats = self.client.table('emg_statistics').select('*').eq('session_id', session_id).execute()
            
            if not emg_stats.data:
                logger.error(f"No EMG statistics found for session: {session_id}")
                return None
            
            # Aggregate left/right metrics
            left_stats = [s for s in emg_stats.data if 'left' in s['channel_name'].lower()]
            right_stats = [s for s in emg_stats.data if 'right' in s['channel_name'].lower()]
            
            if not left_stats or not right_stats:
                logger.error(f"Missing left/right channel data for session: {session_id}")
                return None
            
            # Use first channel for each side (assuming single muscle per side for MVP)
            left = left_stats[0]
            right = right_stats[0]
            
            # Fetch BFR monitoring data (if exists)
            bfr_data = self.client.table('bfr_monitoring').select('*').eq('session_id', session_id).execute()
            bfr_pressure = bfr_data.data[0]['actual_pressure_aop'] if bfr_data.data else None
            bfr_compliant = bfr_data.data[0]['safety_compliant'] if bfr_data.data else True
            
            # Check if performance_scores already has RPE/game data
            perf_data = self.client.table('performance_scores').select('*').eq('session_id', session_id).execute()
            rpe = perf_data.data[0]['rpe_post_session'] if perf_data.data else None
            game_points = perf_data.data[0]['game_points_achieved'] if perf_data.data else None
            game_max = perf_data.data[0]['game_points_max'] if perf_data.data else None
            
            return SessionMetrics(
                session_id=session_id,
                left_total_contractions=left['total_contractions'],
                left_good_contractions=left['good_contractions'],
                left_mvc_contractions=left.get('mvc_contraction_count', left['good_contractions']),
                left_duration_contractions=left.get('duration_contraction_count', left['good_contractions']),
                right_total_contractions=right['total_contractions'],
                right_good_contractions=right['good_contractions'],
                right_mvc_contractions=right.get('mvc_contraction_count', right['good_contractions']),
                right_duration_contractions=right.get('duration_contraction_count', right['good_contractions']),
                bfr_pressure_aop=bfr_pressure,
                bfr_compliant=bfr_compliant,
                rpe_post_session=rpe,
                game_points_achieved=game_points,
                game_points_max=game_max
            )
            
        except Exception as e:
            logger.error(f"Error fetching session metrics: {str(e)}")
            return None
    
    def save_performance_scores(self, scores: Dict) -> bool:
        """
        Save calculated scores to performance_scores table
        """
        try:
            # Check if record exists
            existing = self.client.table('performance_scores').select('id').eq('session_id', scores['session_id']).execute()
            
            # Prepare data for database
            db_data = {
                'session_id': scores['session_id'],
                'overall_score': scores.get('overall_score'),
                'compliance_score': scores.get('compliance_score'),
                'symmetry_score': scores.get('symmetry_score'),
                'effort_score': scores.get('effort_score'),
                'game_score': scores.get('game_score'),
                'left_muscle_compliance': scores.get('left_muscle_compliance'),
                'right_muscle_compliance': scores.get('right_muscle_compliance'),
                'completion_rate_left': scores.get('completion_rate_left'),
                'completion_rate_right': scores.get('completion_rate_right'),
                'intensity_rate_left': scores.get('intensity_rate_left'),
                'intensity_rate_right': scores.get('intensity_rate_right'),
                'duration_rate_left': scores.get('duration_rate_left'),
                'duration_rate_right': scores.get('duration_rate_right'),
                'bfr_compliant': scores.get('bfr_compliant'),
                'bfr_pressure_aop': scores.get('bfr_pressure_aop'),
                'weight_compliance': scores['weights_used']['w_compliance'],
                'weight_symmetry': scores['weights_used']['w_symmetry'],
                'weight_effort': scores['weights_used']['w_effort'],
                'weight_game': scores['weights_used']['w_game'],
                'weight_completion': scores['weights_used']['w_completion'],
                'weight_intensity': scores['weights_used']['w_intensity'],
                'weight_duration': scores['weights_used']['w_duration'],
                'rpe_post_session': scores.get('rpe_post_session', DevelopmentDefaults.RPE_POST_SESSION)
            }
            
            if existing.data:
                # Update existing record
                result = self.client.table('performance_scores').update(db_data).eq('session_id', scores['session_id']).execute()
            else:
                # Insert new record
                result = self.client.table('performance_scores').insert(db_data).execute()
            
            return bool(result.data)
            
        except Exception as e:
            logger.error(f"Error saving performance scores: {str(e)}")
            return False
    
    def update_subjective_data(self, 
                              session_id: str, 
                              rpe: Optional[int] = None,
                              game_points: Optional[int] = None,
                              game_max: Optional[int] = None) -> Dict:
        """
        Update RPE and/or game data for a session and recalculate scores
        
        This method is called when subjective data becomes available after initial processing
        """
        logger.info(f"📝 Updating subjective data for session: {session_id}")
        
        try:
            # Update performance_scores table with new data
            update_data = {}
            if rpe is not None:
                update_data['rpe_post_session'] = rpe
            if game_points is not None:
                update_data['game_points_achieved'] = game_points
            if game_max is not None:
                update_data['game_points_max'] = game_max
            
            if update_data:
                # Check if record exists
                existing = self.client.table('performance_scores').select('id').eq('session_id', session_id).execute()
                
                if existing.data:
                    self.client.table('performance_scores').update(update_data).eq('session_id', session_id).execute()
                else:
                    update_data['session_id'] = session_id
                    self.client.table('performance_scores').insert(update_data).execute()
            
            # Recalculate scores with updated data
            scores = self.calculate_performance_scores(session_id)
            
            # Save updated scores
            if scores and 'error' not in scores:
                self.save_performance_scores(scores)
            
            return scores
            
        except Exception as e:
            logger.error(f"Error updating subjective data: {str(e)}")
            return {'error': str(e)}
    
    def calculate_adherence_score(self, 
                                 patient_id: str,
                                 protocol_day: int) -> Dict:
        """
        Calculate longitudinal adherence score
        
        Adherence(t) = (Game Sessions completed by day t) / (Game Sessions expected by day t) × 100
        
        Expected rate: 15 Game Sessions per 7 days ≈ 2.14 × t
        """
        if protocol_day < 3:
            return {
                'adherence_score': None,
                'message': 'Minimum 3 days required for adherence calculation'
            }
        
        try:
            # Fetch all sessions for patient up to protocol_day
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=protocol_day)
            
            sessions = self.client.table('therapy_sessions').select('id, session_date').eq('patient_id', patient_id).gte('session_date', cutoff_date.isoformat()).execute()
            
            completed_sessions = len(sessions.data) if sessions.data else 0
            expected_sessions = 2.14 * protocol_day  # From protocol
            
            adherence_score = (completed_sessions / expected_sessions) * 100 if expected_sessions > 0 else 0
            
            # Determine clinical threshold category
            if adherence_score >= 85:
                category = 'Excellent'
                interpretation = 'Meeting/exceeding frequency targets'
            elif adherence_score >= 70:
                category = 'Good'
                interpretation = 'Adequate with minor gaps'
            elif adherence_score >= 50:
                category = 'Moderate'
                interpretation = 'Suboptimal, intervention consideration'
            else:
                category = 'Poor'
                interpretation = 'Significant concern, support needed'
            
            return {
                'patient_id': patient_id,
                'protocol_day': protocol_day,
                'adherence_score': adherence_score,
                'completed_sessions': completed_sessions,
                'expected_sessions': expected_sessions,
                'category': category,
                'interpretation': interpretation
            }
            
        except Exception as e:
            logger.error(f"Error calculating adherence score: {str(e)}")
            return {'error': str(e)}


# Service wrapper for webhook integration
class ScoringWebhookHandler:
    """
    Handler for scoring calculations triggered by webhooks
    """
    
    def __init__(self):
        self.scoring_service = PerformanceScoringService()
    
    async def process_after_emg_analysis(self, session_id: str) -> Dict:
        """
        Calculate initial scores after EMG analysis (without RPE/game data)
        Called by webhook after C3D processing
        """
        logger.info(f"🎯 Webhook: Calculating initial scores for session {session_id}")
        
        # Calculate available scores
        scores = self.scoring_service.calculate_performance_scores(session_id)
        
        # Save to database
        if scores and 'error' not in scores:
            self.scoring_service.save_performance_scores(scores)
        
        return scores
    
    async def process_subjective_update(self, 
                                       session_id: str,
                                       rpe: Optional[int] = None,
                                       game_data: Optional[Dict] = None) -> Dict:
        """
        Update scores when subjective data becomes available
        Called by API when therapist/patient provides RPE or game completes
        """
        game_points = game_data.get('points_achieved') if game_data else None
        game_max = game_data.get('points_max') if game_data else None
        
        return self.scoring_service.update_subjective_data(
            session_id, rpe, game_points, game_max
        )