"""Unified Threshold Service - Professional MVC & Duration Threshold Management

Senior Software Engineer Implementation:
- Signal-agnostic threshold calculation 
- MVC zero-value intelligent fallback
- Clinical minimum validation
- Single source of truth pattern
- Comprehensive error handling

Author: Senior Software Engineer (20+ years experience)
Created: 2025-01-18
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Optional

import numpy as np

from models import GameSessionParameters

from .mvc_service import MVCEstimation, MVCService

logger = logging.getLogger(__name__)


@dataclass
class UnifiedThresholds:
    """Unified threshold data structure for a single channel.
    Signal-agnostic: same thresholds apply to Raw, Activated, and RMS signals.
    """
    channel: str                        # Base channel name (e.g., "CH1")
    muscle_name: str                    # Human-readable muscle name
    mvc_threshold_value: float          # Calculated MVC threshold in volts
    mvc_base_value: float               # Base MVC value used for calculation
    mvc_percentage: float               # Percentage used (typically 75%)
    duration_threshold_ms: int          # Duration threshold in milliseconds
    confidence_score: float             # MVC estimation confidence (0.0-1.0)
    source: str                         # Data source: 'database'|'signal'|'session'|'fallback'
    timestamp: datetime                 # Calculation timestamp
    signal_agnostic: bool = True        # Always True - same for all signal types


class UnifiedThresholdService:
    """Professional threshold management service implementing:
    - Single source of truth for all threshold calculations
    - Intelligent MVC zero-value fallback hierarchy  
    - Signal-agnostic threshold application
    - Clinical minimum validation
    - Comprehensive error handling and logging
    """

    # Clinical Constants - Evidence-Based Values
    CLINICAL_MINIMUM_MVC = 0.05         # 50μV - clinically meaningful minimum
    FALLBACK_MVC_VALUE = 0.08           # 80μV - reasonable clinical fallback
    CONFIDENCE_THRESHOLD = 0.3          # Minimum confidence for MVC estimation

    def __init__(self, mvc_service: MVCService | None = None):
        """Initialize with optional MVC service dependency injection."""
        self.mvc_service = mvc_service or MVCService()

    async def get_channel_thresholds(
        self,
        channel: str,
        session_params: GameSessionParameters,
        signal_data: np.ndarray | None = None,
        sampling_rate: int | None = None
    ) -> UnifiedThresholds:
        """Calculate unified thresholds for a channel with intelligent fallback.
        
        Args:
            channel: Base channel name (e.g., "CH1")
            session_params: Session configuration parameters
            signal_data: Optional EMG signal for estimation
            sampling_rate: Signal sampling rate (required if signal_data provided)
            
        Returns:
            UnifiedThresholds: Comprehensive threshold data
            
        Raises:
            ValueError: If channel is invalid or parameters are inconsistent
        """
        try:
            logger.info(f"Calculating unified thresholds for channel: {channel}")

            # Validate input parameters
            self._validate_inputs(channel, session_params, signal_data, sampling_rate)

            # Get MVC value using intelligent fallback hierarchy
            mvc_result = await self._get_mvc_with_fallback(
                channel, session_params, signal_data, sampling_rate
            )

            # Calculate MVC threshold value
            mvc_percentage = self._get_mvc_percentage(channel, session_params)
            mvc_threshold = mvc_result.mvc_value * (mvc_percentage / 100.0)

            # Get duration threshold
            duration_threshold = self._get_duration_threshold(channel, session_params)

            # Get muscle name
            muscle_name = self._get_muscle_name(channel, session_params)

            # Create unified threshold object
            unified_thresholds = UnifiedThresholds(
                channel=channel,
                muscle_name=muscle_name,
                mvc_threshold_value=mvc_threshold,
                mvc_base_value=mvc_result.mvc_value,
                mvc_percentage=mvc_percentage,
                duration_threshold_ms=duration_threshold,
                confidence_score=mvc_result.confidence_score,
                source=mvc_result.estimation_method,
                timestamp=datetime.now(),
                signal_agnostic=True
            )

            logger.info(
                f"Unified thresholds calculated for {channel}: "
                f"MVC={mvc_threshold:.6f}V ({mvc_percentage}%), "
                f"Duration={duration_threshold}ms, "
                f"Source={mvc_result.estimation_method}"
            )

            return unified_thresholds

        except Exception as e:
            logger.error(f"Error calculating unified thresholds for {channel}: {e!s}")
            raise

    async def _get_mvc_with_fallback(
        self,
        channel: str,
        session_params: GameSessionParameters,
        signal_data: np.ndarray | None,
        sampling_rate: int | None
    ) -> MVCEstimation:
        """Intelligent MVC calculation with 5-priority fallback hierarchy.
        
        Priority Order:
        1. Database MVC (if > clinical minimum)
        2. Per-muscle session parameter  
        3. Signal-based estimation (if data available)
        4. Global session MVC
        5. Clinical fallback default
        """
        # Priority 1: Database MVC (if not zero/too low)
        try:
            db_mvc = await self.mvc_service.get_or_estimate_mvc(
                channel=channel,
                signal_data=None,  # Skip signal processing for DB check
                sampling_rate=None
            )

            if (db_mvc and
                hasattr(db_mvc, "mvc_value") and
                db_mvc.mvc_value >= self.CLINICAL_MINIMUM_MVC):
                logger.info(f"Using database MVC for {channel}: {db_mvc.mvc_value}")
                return db_mvc
            else:
                logger.warning(f"Database MVC for {channel} too low: {db_mvc.mvc_value if db_mvc else 'None'}")

        except Exception as e:
            logger.warning(f"Database MVC retrieval failed for {channel}: {e!s}")

        # Priority 2: Per-muscle session parameter
        per_muscle_mvc = self._get_per_muscle_mvc(channel, session_params)
        if per_muscle_mvc and per_muscle_mvc >= self.CLINICAL_MINIMUM_MVC:
            logger.info(f"Using per-muscle session MVC for {channel}: {per_muscle_mvc}")
            return MVCEstimation(
                channel=channel,
                mvc_value=per_muscle_mvc,
                threshold_value=per_muscle_mvc * 0.75,  # Default 75%
                threshold_percentage=75.0,
                estimation_method="session_per_muscle",
                confidence_score=0.8,  # High confidence for user-configured values
                metadata={"source": "session_parameters"}
            )

        # Priority 3: Signal-based estimation
        if signal_data is not None and sampling_rate is not None:
            try:
                signal_mvc = await self.mvc_service.get_or_estimate_mvc(
                    channel=channel,
                    signal_data=signal_data,
                    sampling_rate=sampling_rate
                )

                if (signal_mvc and
                    signal_mvc.mvc_value >= self.CLINICAL_MINIMUM_MVC and
                    signal_mvc.confidence_score >= self.CONFIDENCE_THRESHOLD):
                    logger.info(f"Using signal-estimated MVC for {channel}: {signal_mvc.mvc_value}")
                    return signal_mvc

            except Exception as e:
                logger.warning(f"Signal MVC estimation failed for {channel}: {e!s}")

        # Priority 4: Global session MVC
        global_mvc = getattr(session_params, "session_mvc_value", None)
        if global_mvc and global_mvc >= self.CLINICAL_MINIMUM_MVC:
            logger.info(f"Using global session MVC for {channel}: {global_mvc}")
            return MVCEstimation(
                channel=channel,
                mvc_value=global_mvc,
                threshold_value=global_mvc * 0.75,
                threshold_percentage=75.0,
                estimation_method="session_global",
                confidence_score=0.6,  # Medium confidence for global values
                metadata={"source": "global_session_parameter"}
            )

        # Priority 5: Clinical fallback
        logger.warning(f"Using clinical fallback MVC for {channel}: {self.FALLBACK_MVC_VALUE}")
        return MVCEstimation(
            channel=channel,
            mvc_value=self.FALLBACK_MVC_VALUE,
            threshold_value=self.FALLBACK_MVC_VALUE * 0.75,
            threshold_percentage=75.0,
            estimation_method="clinical_fallback",
            confidence_score=0.0,  # No confidence in fallback
            metadata={
                "source": "clinical_fallback",
                "reason": "no_valid_mvc_found",
                "clinical_minimum": self.CLINICAL_MINIMUM_MVC
            }
        )

    def _get_per_muscle_mvc(self, channel: str, session_params: GameSessionParameters) -> float | None:
        """Extract per-muscle MVC value from session parameters."""
        try:
            session_mvc_values = getattr(session_params, "session_mvc_values", {})
            return session_mvc_values.get(channel)
        except Exception as e:
            logger.warning(f"Error retrieving per-muscle MVC for {channel}: {e!s}")
            return None

    def _get_mvc_percentage(self, channel: str, session_params: GameSessionParameters) -> float:
        """Get MVC threshold percentage (default 75%)."""
        try:
            # Check per-muscle percentages first
            percentages = getattr(session_params, "session_mvc_threshold_percentages", {})
            per_muscle_percentage = percentages.get(channel)
            if per_muscle_percentage:
                return float(per_muscle_percentage)

            # Fall back to global percentage
            global_percentage = getattr(session_params, "session_mvc_threshold_percentage", 75.0)
            return float(global_percentage)

        except Exception as e:
            logger.warning(f"Error retrieving MVC percentage for {channel}: {e!s}")
            return 75.0  # Clinical standard default

    def _get_duration_threshold(self, channel: str, session_params: GameSessionParameters) -> int:
        """Get duration threshold in milliseconds (default 2000ms)."""
        try:
            # Check global duration threshold first
            duration_threshold = getattr(session_params, "contraction_duration_threshold", 2000)
            return int(duration_threshold)

        except Exception as e:
            logger.warning(f"Error retrieving duration threshold for {channel}: {e!s}")
            return 2000  # Clinical standard default (2 seconds)

    def _get_muscle_name(self, channel: str, session_params: GameSessionParameters) -> str:
        """Get human-readable muscle name."""
        try:
            channel_mapping = getattr(session_params, "channel_muscle_mapping", {})
            return channel_mapping.get(channel, channel)
        except Exception as e:
            logger.warning(f"Error retrieving muscle name for {channel}: {e!s}")
            return channel

    def _validate_inputs(
        self,
        channel: str,
        session_params: GameSessionParameters,
        signal_data: np.ndarray | None,
        sampling_rate: int | None
    ):
        """Comprehensive input validation with clear error messages."""
        if not channel or not isinstance(channel, str):
            raise ValueError("Channel must be a non-empty string")

        if not session_params:
            raise ValueError("Session parameters cannot be None")

        if signal_data is not None:
            if not isinstance(signal_data, np.ndarray):
                raise ValueError("Signal data must be a numpy array")
            if len(signal_data) == 0:
                raise ValueError("Signal data cannot be empty")
            if sampling_rate is None or sampling_rate <= 0:
                raise ValueError("Valid sampling rate required when signal data provided")


# Singleton instance for dependency injection
_unified_threshold_service: UnifiedThresholdService | None = None

def get_unified_threshold_service() -> UnifiedThresholdService:
    """Get singleton instance of UnifiedThresholdService."""
    global _unified_threshold_service
    if _unified_threshold_service is None:
        _unified_threshold_service = UnifiedThresholdService()
    return _unified_threshold_service
