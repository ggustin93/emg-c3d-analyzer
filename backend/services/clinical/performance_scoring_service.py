"""Performance Scoring Service.
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
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from config import SessionDefaults, ScoringDefaults

from database.supabase_client import get_supabase_client
from services.clinical.repositories.scoring_configuration_repository import ScoringConfigurationRepository
from services.clinical.weight_manager import WeightManager

logger = logging.getLogger(__name__)


@dataclass
class RPEMapping:
    """Configurable RPE (Rating of Perceived Exertion) mapping for researcher customization."""

    # Default mapping from metricsDefinitions.md
    optimal_range: list[int] = None  # Default: [4, 5, 6] → 100%
    acceptable_range: list[int] = None  # Default: [3, 7] → 80%
    suboptimal_range: list[int] = None  # Default: [2, 8] → 60%
    poor_range: list[int] = None  # Default: [0, 1, 9, 10] → 20%

    optimal_score: float = 100.0
    acceptable_score: float = 80.0
    suboptimal_score: float = 60.0
    poor_score: float = 20.0
    default_score: float = 50.0  # For unexpected values

    def __post_init__(self):
        """Initialize default ranges if not provided."""
        if self.optimal_range is None:
            self.optimal_range = [4, 5, 6]
        if self.acceptable_range is None:
            self.acceptable_range = [3, 7]
        if self.suboptimal_range is None:
            self.suboptimal_range = [2, 8]
        if self.poor_range is None:
            self.poor_range = [0, 1, 9, 10]

    def get_effort_score(self, rpe: int) -> float:
        """Get effort score for given RPE value."""
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
    """Configurable weights for performance scoring (must sum to 1.0)."""

    # Use defaults from config.py (from metricsDefinitions.md)
    w_compliance: float = ScoringDefaults.WEIGHT_COMPLIANCE  # 0.50 - Therapeutic Compliance
    w_symmetry: float = ScoringDefaults.WEIGHT_SYMMETRY  # 0.25 - Muscle Symmetry
    w_effort: float = ScoringDefaults.WEIGHT_EFFORT  # 0.25 - Subjective Effort (RPE)
    w_game: float = ScoringDefaults.WEIGHT_GAME  # 0.00 - Game Performance

    # Sub-component weights for compliance (must sum to 1.0)
    w_completion: float = ScoringDefaults.WEIGHT_COMPLETION  # 0.333 - Completion rate weight
    w_intensity: float = ScoringDefaults.WEIGHT_INTENSITY  # 0.333 - Intensity rate weight
    w_duration: float = ScoringDefaults.WEIGHT_DURATION  # 0.334 - Duration rate weight

    def validate(self) -> bool:
        """Validate that weights sum to 1.0 (within tolerance)."""
        main_sum = self.w_compliance + self.w_symmetry + self.w_effort + self.w_game
        sub_sum = self.w_completion + self.w_intensity + self.w_duration
        return abs(main_sum - 1.0) < 0.01 and abs(sub_sum - 1.0) < 0.01


@dataclass
class SessionMetrics:
    """Metrics from a single therapy session."""

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
    bfr_pressure_aop: float | None = None
    bfr_compliant: bool = True

    # Subjective Data (may be None if not yet provided)
    rpe_post_session: int | None = None

    # Game Data (may be None if not yet available)
    game_points_achieved: int | None = None
    game_points_max: int | None = None

    # Expected contractions (from protocol)
    expected_contractions_per_muscle: int = 12


class PerformanceScoringService:
    """Service for calculating GHOSTLY+ performance scores.

    Implements the complete scoring algorithm from metricsDefinitions.md
    with support for partial data (some scores can be calculated later)
    """

    def __init__(self, supabase_client=None):
        self.client = supabase_client or get_supabase_client(use_service_key=True)
        self.scoring_repo = ScoringConfigurationRepository(supabase_client)  # Repository for scoring config
        self.weights = ScoringWeights()
        self.rpe_mapping = RPEMapping()  # Default RPE mapping
        self.weight_manager = WeightManager(base_weights=self.weights)  # Mathematical weight management

        logger.info("🎯 Performance Scoring Service initialized")

    def _load_scoring_weights_from_database(self, session_id: str) -> ScoringWeights:
        """Load configurable scoring weights from database using session-based lookup.
        Priority: Session config → Patient config → Global default → System defaults
        
        Args:
            session_id: Therapy session UUID
            
        Returns:
            ScoringWeights object with configured or default weights
            
        Raises:
            ValueError: If session_id is not a valid UUID format
        """
        # Validate session_id is a valid UUID format  
        try:
            if not isinstance(session_id, str):
                raise ValueError("session_id must be a string")
            uuid.UUID(session_id)
        except (ValueError, TypeError, AttributeError) as e:
            logger.error(f"🚨 Invalid session_id format in _load_scoring_weights_from_database: {session_id}")
            raise ValueError(f"Invalid session_id format. Expected valid UUID, got: {session_id}") from e
            
        try:
            # First, get the patient_id from the session
            session_query = (
                self.client.table("therapy_sessions")
                .select("patient_id, scoring_config_id")
                .eq("id", session_id)
                .limit(1)
                .execute()
            )
            
            patient_id = None
            direct_config_id = None
            if session_query.data:
                patient_id = session_query.data[0].get("patient_id")
                direct_config_id = session_query.data[0].get("scoring_config_id")
            
            # Get the appropriate scoring config ID using our intelligent function
            # If session already has scoring_config_id, it will be used (immutable)
            # Otherwise, falls back to patient's current config or global default
            scoring_config_id = self._get_session_scoring_config_id(session_id, patient_id)
            self.scoring_config_id = scoring_config_id  # Store for later use in result
            
            if not scoring_config_id:
                # This should not happen anymore with fallback, but handle gracefully
                logger.warning("📊 No scoring config ID available, using system defaults from config.py")
                self.scoring_config_id = None  # Explicitly set to None when using defaults
                return ScoringWeights()
            
            # Load the specific configuration
            weights_query = (
                self.client.table("scoring_configuration")
                .select("*")
                .eq("id", scoring_config_id)
                .limit(1)
                .execute()
            )

            if weights_query.data:
                config = weights_query.data[0]
                return ScoringWeights(
                    w_compliance=config.get("weight_compliance", 0.50),  # 50% default from metricsDefinitions.md
                    w_symmetry=config.get("weight_symmetry", 0.25),     # 25% default
                    w_effort=config.get("weight_effort", 0.25),         # 25% default
                    w_game=config.get("weight_game", 0.00),             # 0% default (game-dependent)
                    w_completion=config.get("weight_completion", 0.333),
                    w_intensity=config.get("weight_intensity", 0.333),
                    w_duration=config.get("weight_duration", 0.334),
                )
            else:
                logger.info("No custom scoring weights found, using defaults")
                return self.weights

        except Exception as e:
            logger.warning(f"Failed to load scoring weights from database: {e}, using defaults")
            return self.weights

    def _load_rpe_mapping_from_database(self, session_id: str) -> RPEMapping:
        """Load configurable RPE mapping from the scoring_configuration.rpe_mapping JSONB field.
        RPE mappings are stored per scoring configuration, not in a separate table.
        Fallback to defaults if not found.
        """
        try:
            # Get RPE mapping from the scoring configuration being used for this session
            scoring_config_id = getattr(self, 'scoring_config_id', None)
            if not scoring_config_id:
                logger.info("📊 No scoring config ID available, using default RPE mapping")
                return self.rpe_mapping

            # Load the scoring configuration's RPE mapping
            config_query = (
                self.client.table("scoring_configuration")
                .select("rpe_mapping")
                .eq("id", scoring_config_id)
                .limit(1)
                .execute()
            )

            if config_query.data and config_query.data[0].get("rpe_mapping"):
                rpe_data = config_query.data[0]["rpe_mapping"]
                logger.info("📊 Using RPE mapping from scoring configuration JSONB field")
                
                # The JSONB format can be used directly - create a simple lookup function
                def get_rpe_score(rpe_value: int) -> float:
                    return rpe_data.get(str(rpe_value), {}).get("score", 50.0)
                
                # Create a custom RPEMapping that uses the JSONB data directly
                custom_mapping = RPEMapping()
                custom_mapping.get_effort_score = get_rpe_score
                return custom_mapping
            else:
                logger.info("📊 No custom RPE mapping in scoring config, using metricsDefinitions.md defaults")
                return self.rpe_mapping

        except Exception as e:
            logger.warning(f"Failed to load RPE mapping from scoring configuration: {e}, using defaults")
            return self.rpe_mapping

    def calculate_performance_scores(
        self, session_id: str, session_metrics: SessionMetrics | None = None
    ) -> dict:
        """Calculate all available performance scores for a session.

        Args:
            session_id: Therapy session UUID
            session_metrics: Optional pre-collected metrics (if None, fetches from DB)

        Returns:
            Dictionary with calculated scores and sub-components
            
        Raises:
            ValueError: If session_id is not a valid UUID format
        """
        # Validate session_id is a valid UUID format
        try:
            if not isinstance(session_id, str):
                raise ValueError("session_id must be a string")
            uuid.UUID(session_id)
        except (ValueError, TypeError, AttributeError) as e:
            logger.error(f"🚨 Invalid session_id format: {session_id}")
            raise ValueError(f"Invalid session_id format. Expected valid UUID, got: {session_id}") from e
            
        logger.info(f"📊 Calculating performance scores for session: {session_id}")

        # Step 0: Load configurable weights and RPE mapping from database
        self.weights = self._load_scoring_weights_from_database(session_id)
        self.rpe_mapping = self._load_rpe_mapping_from_database(session_id)
        logger.info(
            f"📊 Using weights: Compliance={self.weights.w_compliance}, Symmetry={self.weights.w_symmetry}, Effort={self.weights.w_effort}, Game={self.weights.w_game}"
        )
        logger.info(
            f"📊 Using RPE mapping: Optimal={self.rpe_mapping.optimal_range}→{self.rpe_mapping.optimal_score}%"
        )

        # Step 1: Collect metrics if not provided
        if session_metrics is None:
            session_metrics = self._fetch_session_metrics(session_id)
            if not session_metrics:
                logger.error(f"❌ Could not fetch metrics for session: {session_id}")
                return {"error": "Session metrics not found"}

        # Step 2: Calculate sub-components
        compliance_components = self._calculate_compliance_components(session_metrics)
        symmetry_score = self._calculate_symmetry_score(
            compliance_components["left_muscle_compliance"],
            compliance_components["right_muscle_compliance"],
        )
        effort_score, rpe_source = self._calculate_effort_score(session_metrics.rpe_post_session)
        game_score = self._calculate_game_score(
            session_metrics.game_points_achieved, session_metrics.game_points_max
        )

        # Step 3: Apply BFR safety gate
        bfr_gate = self._calculate_bfr_gate(session_metrics.bfr_pressure_aop)

        # Step 4: Calculate overall compliance score
        compliance_score = compliance_components["overall_compliance"] * bfr_gate

        # Step 5: Calculate overall performance using WeightManager (guarantees weight sum = 1.0)
        overall_score = self.weight_manager.calculate_overall_score(
            compliance_score=compliance_score,
            symmetry_score=symmetry_score,
            effort_score=effort_score,
            game_score=game_score
        )

        # Step 6: Prepare result with frontend-compatible structure
        result = {
            "session_id": session_id,
            "scoring_config_id": getattr(self, 'scoring_config_id', None),  # Include the scoring config ID
            "overall_score": overall_score,
            "compliance_score": compliance_score,
            "symmetry_score": symmetry_score,
            "effort_score": effort_score if effort_score is not None else 0,  # Default to 0 instead of None
            "game_score": game_score if game_score is not None else 0,  # Default to 0 instead of None
            "bfr_compliant": bool(bfr_gate == 1.0),
            "bfr_pressure_aop": session_metrics.bfr_pressure_aop,
            "rpe_post_session": session_metrics.rpe_post_session,
            "rpe_value": session_metrics.rpe_post_session,  # Add rpe_value for CSV export
            "rpe_source": rpe_source,  # Source of RPE data for debugging
            
            # Keep compliance_components nested (not spread)
            "compliance_components": compliance_components,
            
            # Rename to "weights" for frontend compatibility
            "weights": {
                "w_compliance": self.weights.w_compliance,
                "w_symmetry": self.weights.w_symmetry,
                "w_effort": self.weights.w_effort,
                "w_game": self.weights.w_game,
                "w_completion": self.weights.w_completion,
                "w_intensity": self.weights.w_intensity,
                "w_duration": self.weights.w_duration,
            },
            
            # Keep weights_used for backward compatibility
            "weights_used": {
                "w_compliance": self.weights.w_compliance,
                "w_symmetry": self.weights.w_symmetry,
                "w_effort": self.weights.w_effort,
                "w_game": self.weights.w_game,
                "w_completion": self.weights.w_completion,
                "w_intensity": self.weights.w_intensity,
                "w_duration": self.weights.w_duration,
            },
            
            # Add RPE mapping for CSV export
            "rpe_mapping": {
                "optimal_range": self.rpe_mapping.optimal_range,
                "acceptable_range": self.rpe_mapping.acceptable_range,
                "suboptimal_range": self.rpe_mapping.suboptimal_range,
                "poor_range": self.rpe_mapping.poor_range,
                "optimal_score": self.rpe_mapping.optimal_score,
                "acceptable_score": self.rpe_mapping.acceptable_score,
                "suboptimal_score": self.rpe_mapping.suboptimal_score,
                "poor_score": self.rpe_mapping.poor_score
            },
            
            "data_completeness": {
                "has_emg_data": True,
                "has_rpe": session_metrics.rpe_post_session is not None,
                "has_game_data": session_metrics.game_points_achieved is not None,
                "has_bfr_data": session_metrics.bfr_pressure_aop is not None,
                "rpe_source": rpe_source,
            },
        }

        logger.info(
            f"✅ Scores calculated: Overall={overall_score:.1f}%"
            if overall_score
            else "⚠️ Partial scores calculated (waiting for RPE/game data)"
        )

        return result

    def _normalize_completion_rate(self, rate: float | None) -> float | None:
        """Normalize completion rate to 0.0-1.0 range for database storage.
        
        Caps completion rates at 100% to comply with database check constraints.
        Clinical interpretation: patients who exceed targets (>100%) are 
        considered to have achieved maximum compliance (100%).
        
        Args:
            rate: Raw completion rate (can exceed 1.0)
            
        Returns:
            Normalized rate capped at 1.0, or None if input is None
        """
        if rate is None:
            return None
        
        normalized_rate = min(float(rate), 1.0)  # Cap at 100% completion
        
        # Log when capping occurs for clinical awareness
        if rate > 1.0:
            logger.debug(f"📊 Completion rate normalized: {rate:.3f} → {normalized_rate:.3f} (exceeded target)")
        
        return normalized_rate

    def _calculate_compliance_components(self, metrics: SessionMetrics) -> dict:
        """Calculate per-muscle compliance and sub-components.

        S_comp^muscle = w_comp * R_comp + w_int * R_int + w_dur * R_dur
        """
        # Left muscle compliance - calculate rates and cap them for compliance calculation
        left_completion_rate = min(
            metrics.left_total_contractions / metrics.expected_contractions_per_muscle, 1.0
        )  # Cap at 100% for compliance scoring
        left_intensity_rate = (
            metrics.left_mvc_contractions / metrics.left_total_contractions
            if metrics.left_total_contractions > 0
            else 0.0
        )
        left_duration_rate = (
            metrics.left_duration_contractions / metrics.left_total_contractions
            if metrics.left_total_contractions > 0
            else 0.0
        )

        left_muscle_compliance = (
            self.weights.w_completion * left_completion_rate
            + self.weights.w_intensity * left_intensity_rate
            + self.weights.w_duration * left_duration_rate
        ) * 100  # Convert to percentage

        # Right muscle compliance - calculate rates and cap them for compliance calculation
        right_completion_rate = min(
            metrics.right_total_contractions / metrics.expected_contractions_per_muscle, 1.0
        )  # Cap at 100% for compliance scoring
        right_intensity_rate = (
            metrics.right_mvc_contractions / metrics.right_total_contractions
            if metrics.right_total_contractions > 0
            else 0.0
        )
        right_duration_rate = (
            metrics.right_duration_contractions / metrics.right_total_contractions
            if metrics.right_total_contractions > 0
            else 0.0
        )

        right_muscle_compliance = (
            self.weights.w_completion * right_completion_rate
            + self.weights.w_intensity * right_intensity_rate
            + self.weights.w_duration * right_duration_rate
        ) * 100  # Convert to percentage

        # Overall compliance (average of left and right)
        overall_compliance = (left_muscle_compliance + right_muscle_compliance) / 2

        return {
            "left_muscle_compliance": left_muscle_compliance,
            "right_muscle_compliance": right_muscle_compliance,
            "overall_compliance": overall_compliance,
            # Normalize all rates to 0.0-1.0 range for database constraints
            "completion_rate_left": self._normalize_completion_rate(left_completion_rate),
            "completion_rate_right": self._normalize_completion_rate(right_completion_rate),
            "intensity_rate_left": min(left_intensity_rate, 1.0),
            "intensity_rate_right": min(right_intensity_rate, 1.0),
            "duration_rate_left": min(left_duration_rate, 1.0),
            "duration_rate_right": min(right_duration_rate, 1.0),
        }

    def _calculate_symmetry_score(self, left_compliance: float, right_compliance: float) -> float:
        """Calculate muscle symmetry score.

        S_symmetry = (1 - |left - right| / (left + right)) × 100
        """
        if left_compliance + right_compliance == 0:
            return 0.0

        asymmetry = abs(left_compliance - right_compliance) / (left_compliance + right_compliance)
        symmetry_score = (1 - asymmetry) * 100

        return symmetry_score

    def _calculate_effort_score(self, rpe: int | None) -> tuple[float | None, str]:
        """Calculate subjective effort score based on RPE (Rating of Perceived Exertion).

        RPE Scale: 0-10 (Borg CR10)
        Uses configurable RPE mapping and development defaults when needed
        Returns: (effort_score, rpe_source)
        """
        # Return None if RPE is missing (don't use defaults in calculation)
        if rpe is None:
            return None, "no_rpe_data"
        
        rpe_source = "c3d_metadata"

        # Use configurable RPE mapping (loaded from database or default)
        effort_score = self.rpe_mapping.get_effort_score(rpe)

        # Log when using unexpected RPE values
        if effort_score == self.rpe_mapping.default_score:
            logger.warning(f"🔍 Unexpected RPE value: {rpe}, using default score: {effort_score}%")

        return effort_score, rpe_source

    def _calculate_game_score(
        self, points_achieved: int | None, points_max: int | None
    ) -> float | None:
        """Calculate game performance score.

        S_game = (points_achieved / points_max) × 100
        """
        if points_achieved is None or points_max is None:
            return None

        if points_max == 0:
            return 0.0

        return (points_achieved / points_max) * 100

    def _calculate_bfr_gate(self, pressure_aop: float | None) -> float:
        """Calculate BFR safety gate.

        C_BFR = 1.0 if pressure ∈ [45%, 55%] AOP, else 0.0
        When BFR data is missing, assume compliant (1.0) for non-BFR sessions
        """
        if pressure_aop is None:
            # No BFR data means this might be a non-BFR session - assume compliant
            return 1.0

        # BFR safety window: 45-55% AOP
        if 45.0 <= pressure_aop <= 55.0:
            return 1.0
        else:
            logger.warning(f"⚠️ BFR pressure outside safety window: {pressure_aop}% AOP")
            return 0.0

    def _fetch_session_metrics(self, session_id: str) -> SessionMetrics | None:
        """Fetch metrics from database tables.
        
        Args:
            session_id: Therapy session UUID
            
        Returns:
            SessionMetrics object with EMG data, or None if not found
            
        Raises:
            ValueError: If session_id is not a valid UUID format
        """
        # Validate session_id is a valid UUID format
        try:
            if not isinstance(session_id, str):
                raise ValueError("session_id must be a string")
            uuid.UUID(session_id)
        except (ValueError, TypeError, AttributeError) as e:
            logger.error(f"🚨 Invalid session_id format in _fetch_session_metrics: {session_id}")
            raise ValueError(f"Invalid session_id format. Expected valid UUID, got: {session_id}") from e
            
        try:
            # Fetch EMG statistics
            emg_stats = (
                self.client.table("emg_statistics")
                .select("*")
                .eq("session_id", session_id)
                .execute()
            )

            if not emg_stats.data:
                logger.error(f"No EMG statistics found for session: {session_id}")
                return None

            # Aggregate left/right metrics
            # Map CH1 to left and CH2 to right for compatibility
            left_stats = [s for s in emg_stats.data if "left" in s["channel_name"].lower() or s["channel_name"] == "CH1"]
            right_stats = [s for s in emg_stats.data if "right" in s["channel_name"].lower() or s["channel_name"] == "CH2"]

            if not left_stats or not right_stats:
                logger.error(f"Missing left/right channel data for session: {session_id}")
                logger.debug(f"Available channels: {[s['channel_name'] for s in emg_stats.data]}")
                return None

            # Use first channel for each side (assuming single muscle per side for MVP)
            left = left_stats[0]
            right = right_stats[0]

            # Fetch BFR monitoring data (if exists)
            bfr_data = (
                self.client.table("bfr_monitoring")
                .select("*")
                .eq("session_id", session_id)
                .execute()
            )
            bfr_pressure = bfr_data.data[0]["actual_pressure_aop"] if bfr_data.data else None
            bfr_compliant = bfr_data.data[0]["safety_compliant"] if bfr_data.data else True

            # Check if performance_scores already has RPE/game data
            perf_data = (
                self.client.table("performance_scores")
                .select("*")
                .eq("session_id", session_id)
                .execute()
            )
            rpe = perf_data.data[0]["rpe_post_session"] if perf_data.data else None
            game_points = perf_data.data[0]["game_points_achieved"] if perf_data.data else None
            game_max = perf_data.data[0]["game_points_max"] if perf_data.data else None

            return SessionMetrics(
                session_id=session_id,
                left_total_contractions=left["contraction_quality_metrics"]["total_contractions"],
                left_good_contractions=left["contraction_quality_metrics"]["overall_compliant_contractions"],
                left_mvc_contractions=left["contraction_quality_metrics"].get(
                    "mvc75_compliant_contractions", 
                    left["contraction_quality_metrics"]["overall_compliant_contractions"]
                ),
                left_duration_contractions=left["contraction_quality_metrics"].get(
                    "duration_compliant_contractions", 
                    left["contraction_quality_metrics"]["overall_compliant_contractions"]
                ),
                right_total_contractions=right["contraction_quality_metrics"]["total_contractions"],
                right_good_contractions=right["contraction_quality_metrics"]["overall_compliant_contractions"],
                right_mvc_contractions=right["contraction_quality_metrics"].get(
                    "mvc75_compliant_contractions",
                    right["contraction_quality_metrics"]["overall_compliant_contractions"]
                ),
                right_duration_contractions=right["contraction_quality_metrics"].get(
                    "duration_compliant_contractions",
                    right["contraction_quality_metrics"]["overall_compliant_contractions"]
                ),
                bfr_pressure_aop=bfr_pressure,
                bfr_compliant=bfr_compliant,
                rpe_post_session=rpe,
                game_points_achieved=game_points,
                game_points_max=game_max,
            )

        except Exception as e:
            logger.exception(f"Error fetching session metrics: {e!s}")
            return None

    def _ensure_default_scoring_config(self) -> str:
        """Ensure a default scoring configuration exists in the database.
        
        Creates the GHOSTLY+ Default configuration using values from config.py
        if it doesn't already exist.
        
        Returns:
            The UUID of the default scoring configuration
        """
        from config import ScoringDefaults
        import json
        
        defaults = ScoringDefaults()
        
        try:
            # Check if GHOSTLY-TRIAL-DEFAULT already exists
            existing = self.client.table("scoring_configuration").select("id").eq(
                "configuration_name", "GHOSTLY-TRIAL-DEFAULT"
            ).limit(1).execute()
            
            if existing.data:
                logger.debug("Found existing GHOSTLY-TRIAL-DEFAULT configuration")
                return existing.data[0]["id"]
            
            # Create the default configuration from config.py
            config_data = {
                "configuration_name": "GHOSTLY-TRIAL-DEFAULT",
                "description": "Default scoring configuration for GHOSTLY+ trial - auto-created from config.py",
                "weight_compliance": defaults.WEIGHT_COMPLIANCE,
                "weight_symmetry": defaults.WEIGHT_SYMMETRY,
                "weight_effort": defaults.WEIGHT_EFFORT,
                "weight_game": defaults.WEIGHT_GAME,
                "weight_completion": defaults.WEIGHT_COMPLETION,
                "weight_intensity": defaults.WEIGHT_INTENSITY,
                "weight_duration": defaults.WEIGHT_DURATION,
                "active": True,
                "rpe_mapping": defaults.DEFAULT_RPE_MAPPING  # Already a dict, no need for json.dumps
            }
            
            result = self.client.table("scoring_configuration").insert(config_data).execute()
            logger.info("✅ Created default scoring configuration from config.py")
            return result.data[0]["id"]
            
        except Exception as e:
            logger.exception(f"Failed to ensure default scoring config: {e!s}")
            # Return None to prevent crash, but log the issue
            return None
    
    def _get_session_scoring_config_id(self, session_id: str = None, patient_id: str = None) -> str | None:
        """Get the appropriate scoring configuration for a session.
        
        Priority hierarchy:
        1. Session's immutable scoring_config_id (preserves historical accuracy)
        2. Patient's current_scoring_config_id (for new sessions)
        3. Global GHOSTLY+ Default configuration (from database)
        4. Create default from config.py if none exists
        
        Args:
            session_id: The therapy session UUID. 
            patient_id: The patient's UUID (used if session doesn't have config).
            
        Returns:
            Scoring configuration ID (always returns a value, creating default if needed)
        """
        # Use repository pattern for cleaner database access
        from services.clinical.repositories.scoring_configuration_repository import ScoringConfigurationRepository
        
        try:
            repo = ScoringConfigurationRepository(self.client)
            config_id = repo.get_session_scoring_config(session_id, patient_id)
            
            if config_id:
                logger.debug(f"Using scoring config {config_id} for session {session_id or 'new'}")
                return config_id
            else:
                # No config found in database, create/get default from config.py
                logger.info("No scoring config found in database, creating default from config.py")
                return self._ensure_default_scoring_config()

        except Exception as e:
            logger.exception(f"Error fetching scoring configuration: {e!s}")
            # Try to create default as last resort
            return self._ensure_default_scoring_config()
    
    def _get_patient_scoring_config_id(self, patient_id: str = None) -> str | None:
        """Legacy method for backward compatibility. Calls session-based method with no session."""
        return self._get_session_scoring_config_id(session_id=None, patient_id=patient_id)
    
    def _get_default_scoring_config_id(self) -> str | None:
        """Legacy method for backward compatibility. Calls _get_patient_scoring_config_id with no patient."""
        return self._get_patient_scoring_config_id(patient_id=None)

    def save_performance_scores(self, scores: dict) -> bool:
        """Save calculated scores to performance_scores table
        Schema v2.1 compliance - uses session's scoring_config_id for audit trail.
        
        Scoring config hierarchy (handled by database):
        1. Session's immutable scoring_config_id (preserves what was actually used)
        2. Patient's current config (for new sessions)
        3. Global default
        4. System defaults from config.py if database unavailable
        """
        try:
            session_id = scores.get("session_id")
            
            # Get the scoring config that was actually used for this session
            # This is already set on the therapy_sessions table by the trigger
            session_query = (
                self.client.table("therapy_sessions")
                .select("scoring_config_id, patient_id")
                .eq("id", session_id)
                .limit(1)
                .execute()
            )
            
            scoring_config_id = None
            if session_query.data:
                scoring_config_id = session_query.data[0].get("scoring_config_id")
                patient_id = session_query.data[0].get("patient_id")
                
                # If session doesn't have config yet (shouldn't happen with trigger), get it
                if not scoring_config_id:
                    scoring_config_id = self._get_session_scoring_config_id(session_id, patient_id)
            
            if not scoring_config_id:
                logger.warning(
                    f"No scoring configuration found for session {session_id}. "
                    "Using system defaults from config.py"
                )
                scoring_config_id = None

            # Check if record exists
            existing = (
                self.client.table("performance_scores")
                .select("id")
                .eq("session_id", scores["session_id"])
                .execute()
            )

            # Prepare data for database - Schema v2.1 compliant
            # Apply normalization to completion and rate fields to comply with DB constraints
            db_data = {
                "session_id": scores["session_id"],
                "overall_score": scores.get("overall_score"),
                "compliance_score": scores.get("compliance_score"),
                "symmetry_score": scores.get("symmetry_score"),
                "effort_score": scores.get("effort_score"),
                "game_score": scores.get("game_score"),
                "left_muscle_compliance": scores.get("left_muscle_compliance"),
                "right_muscle_compliance": scores.get("right_muscle_compliance"),
                # Normalize completion rates to comply with database check constraints (cap at 100%)
                "completion_rate_left": self._normalize_completion_rate(scores.get("completion_rate_left")),
                "completion_rate_right": self._normalize_completion_rate(scores.get("completion_rate_right")),
                "intensity_rate_left": self._normalize_completion_rate(scores.get("intensity_rate_left")),
                "intensity_rate_right": self._normalize_completion_rate(scores.get("intensity_rate_right")),
                "duration_rate_left": self._normalize_completion_rate(scores.get("duration_rate_left")),
                "duration_rate_right": self._normalize_completion_rate(scores.get("duration_rate_right")),
                "bfr_compliant": scores.get("bfr_compliant"),
                "bfr_pressure_aop": scores.get("bfr_pressure_aop"),
                "rpe_post_session": scores.get(
                    "rpe_post_session", SessionDefaults.RPE_POST_SESSION
                ),
                # NOTE: weight_* fields removed - now in scoring_configuration table
            }
            
            # Only add scoring_config_id if it exists (not None)
            if scoring_config_id is not None:
                db_data["scoring_config_id"] = scoring_config_id

            if existing.data:
                # Update existing record
                result = (
                    self.client.table("performance_scores")
                    .update(db_data)
                    .eq("session_id", scores["session_id"])
                    .execute()
                )
            else:
                # Insert new record
                result = self.client.table("performance_scores").insert(db_data).execute()

            return bool(result.data)

        except Exception as e:
            logger.exception(f"Error saving performance scores: {e!s}")
            return False

    def update_subjective_data(
        self,
        session_id: str,
        rpe: int | None = None,
        game_points: int | None = None,
        game_max: int | None = None,
    ) -> dict:
        """Update RPE and/or game data for a session and recalculate scores.

        This method is called when subjective data becomes available after initial processing
        
        Args:
            session_id: Therapy session UUID
            rpe: Rating of Perceived Exertion (0-10 scale)
            game_points: Points achieved in game
            game_max: Maximum possible game points
            
        Returns:
            Dictionary with recalculated scores
            
        Raises:
            ValueError: If session_id is not a valid UUID format
        """
        # Validate session_id is a valid UUID format
        try:
            if not isinstance(session_id, str):
                raise ValueError("session_id must be a string")
            uuid.UUID(session_id)
        except (ValueError, TypeError, AttributeError) as e:
            logger.error(f"🚨 Invalid session_id format in update_subjective_data: {session_id}")
            raise ValueError(f"Invalid session_id format. Expected valid UUID, got: {session_id}") from e
            
        logger.info(f"📝 Updating subjective data for session: {session_id}")

        try:
            # Update performance_scores table with new data
            update_data = {}
            if rpe is not None:
                update_data["rpe_post_session"] = rpe
            if game_points is not None:
                update_data["game_points_achieved"] = game_points
            if game_max is not None:
                update_data["game_points_max"] = game_max

            if update_data:
                # Check if record exists
                existing = (
                    self.client.table("performance_scores")
                    .select("id")
                    .eq("session_id", session_id)
                    .execute()
                )

                if existing.data:
                    self.client.table("performance_scores").update(update_data).eq(
                        "session_id", session_id
                    ).execute()
                else:
                    update_data["session_id"] = session_id
                    self.client.table("performance_scores").insert(update_data).execute()

            # Recalculate scores with updated data
            scores = self.calculate_performance_scores(session_id)

            # Save updated scores
            if scores and "error" not in scores:
                self.save_performance_scores(scores)

            return scores

        except Exception as e:
            logger.exception(f"Error updating subjective data: {e!s}")
            return {"error": str(e)}

    def calculate_adherence_score(self, patient_id: str, protocol_day: int, sessions_completed: int = None) -> dict:
        """Calculate longitudinal adherence score.

        Adherence(t) = (Game Sessions completed by day t) / (Game Sessions expected by day t) × 100

        Default expected sessions: 30 (5 days × 3 sessions/day × 2 games/session)
        Can be overridden by database value if available.
        """
        if protocol_day < 3:
            return {
                "adherence_score": None,
                "message": "Minimum 3 days required for adherence calculation",
            }

        try:
            # Use provided sessions_completed if available
            if sessions_completed is None:
                # Try to count from storage or therapy_sessions table
                patient_result = (
                    self.client.table("patients")
                    .select("patient_code")
                    .eq("id", patient_id)
                    .execute()
                )
                
                if patient_result.data and patient_result.data[0].get("patient_code"):
                    patient_code = patient_result.data[0]["patient_code"]
                    
                    # Count C3D files from storage bucket
                    storage_files = self.client.storage.from_("c3d-examples").list()
                    
                    # Filter files for this patient
                    # C3D filenames pattern: GHOSTLY_[PatientCode]_[Date]_[Time].c3d
                    completed_sessions = sum(
                        1 for file in storage_files 
                        if file.get("name", "").endswith(".c3d") and 
                        f"_{patient_code}_" in file.get("name", "")
                    )
                else:
                    # Fallback to therapy_sessions table if patient_code not found
                    sessions = (
                        self.client.table("therapy_sessions")
                        .select("id, session_date, file_path")
                        .eq("patient_id", patient_id)
                        .not_.is_("file_path", "null")
                        .execute()
                    )
                    completed_sessions = len(sessions.data) if sessions.data else 0
            # else: Use the provided sessions_completed value
            
            # Check for custom expected sessions in patient_scoring_config or use default
            # For now, use default of 30 sessions (5 days × 3 sessions/day × 2 games/session)
            expected_sessions = 30  # Default therapeutic protocol
            
            # TODO: Future enhancement - check patient_scoring_config for custom value
            # scoring_config = (
            #     self.client.table("patient_scoring_config")
            #     .select("expected_sessions")
            #     .eq("patient_id", patient_id)
            #     .eq("active", True)
            #     .execute()
            # )
            # if scoring_config.data and scoring_config.data[0].get("expected_sessions"):
            #     expected_sessions = scoring_config.data[0]["expected_sessions"]

            adherence_score = (
                (completed_sessions / expected_sessions) * 100 if expected_sessions > 0 else 0
            )

            # Determine clinical threshold category
            if adherence_score >= 85:
                category = "Excellent"
                interpretation = "Meeting/exceeding frequency targets"
            elif adherence_score >= 70:
                category = "Good"
                interpretation = "Adequate with minor gaps"
            elif adherence_score >= 50:
                category = "Moderate"
                interpretation = "Suboptimal, intervention consideration"
            else:
                category = "Poor"
                interpretation = "Significant concern, support needed"

            return {
                "patient_id": patient_id,
                "protocol_day": protocol_day,
                "adherence_score": adherence_score,
                "completed_sessions": completed_sessions,
                "expected_sessions": expected_sessions,
                "category": category,
                "interpretation": interpretation,
            }

        except Exception as e:
            logger.exception(f"Error calculating adherence score: {e!s}")
            return {"error": str(e)}

# Removed unnecessary async wrapper - use calculate_performance_scores directly
    # This method was just an async wrapper around the synchronous calculate_performance_scores
    # which violates the project's synchronous Supabase architecture


# Service wrapper for webhook integration
class ScoringWebhookHandler:
    """Handler for scoring calculations triggered by webhooks."""

    def __init__(self):
        self.scoring_service = PerformanceScoringService()

    async def process_after_emg_analysis(self, session_id: str) -> dict:
        """Calculate initial scores after EMG analysis (without RPE/game data)
        Called by webhook after C3D processing.
        """
        logger.info(f"🎯 Webhook: Calculating initial scores for session {session_id}")

        # Calculate available scores
        scores = self.scoring_service.calculate_performance_scores(session_id)

        # Save to database
        if scores and "error" not in scores:
            self.scoring_service.save_performance_scores(scores)

        return scores

    async def process_subjective_update(
        self, session_id: str, rpe: int | None = None, game_data: dict | None = None
    ) -> dict:
        """Update scores when subjective data becomes available
        Called by API when therapist/patient provides RPE or game completes.
        """
        game_points = game_data.get("points_achieved") if game_data else None
        game_max = game_data.get("points_max") if game_data else None

        return self.scoring_service.update_subjective_data(session_id, rpe, game_points, game_max)
