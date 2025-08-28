"""
Scoring & Performance Models
============================

Models for GHOSTLY+ performance scoring system including configuration and results.
Implements clinical trial compliance metrics and bilateral analysis.

Author: EMG C3D Analyzer Team
Date: 2025-08-28
"""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from ..shared.base import DatabaseBaseModel, TimestampMixin


# =============================================================================
# SCORING CONFIGURATION MODELS
# =============================================================================

class ScoringConfigurationBase(DatabaseBaseModel):
    """Base fields for scoring configuration"""
    configuration_name: str
    description: Optional[str] = None
    
    # GHOSTLY+ weights (0.0-1.0 scale)
    weight_compliance: float = Field(0.40, ge=0.0, le=1.0)
    weight_symmetry: float = Field(0.25, ge=0.0, le=1.0)
    weight_effort: float = Field(0.20, ge=0.0, le=1.0)
    weight_game: float = Field(0.15, ge=0.0, le=1.0)
    
    # Sub-weights for compliance calculation (should sum to ~1.0)
    weight_completion: float = Field(0.333, ge=0.0, le=1.0)
    weight_intensity: float = Field(0.333, ge=0.0, le=1.0)
    weight_duration: float = Field(0.334, ge=0.0, le=1.0)
    
    # Configuration status
    active: bool = False


class ScoringConfigurationCreate(ScoringConfigurationBase):
    """Model for creating scoring configurations"""
    therapist_id: Optional[UUID] = None  # NULL for global configurations
    is_global: bool = False


class ScoringConfigurationUpdate(BaseModel):
    """Model for updating scoring configurations"""
    description: Optional[str] = None
    weight_compliance: Optional[float] = Field(None, ge=0.0, le=1.0)
    weight_symmetry: Optional[float] = Field(None, ge=0.0, le=1.0)
    weight_effort: Optional[float] = Field(None, ge=0.0, le=1.0)
    weight_game: Optional[float] = Field(None, ge=0.0, le=1.0)
    weight_completion: Optional[float] = Field(None, ge=0.0, le=1.0)
    weight_intensity: Optional[float] = Field(None, ge=0.0, le=1.0)
    weight_duration: Optional[float] = Field(None, ge=0.0, le=1.0)
    active: Optional[bool] = None


class ScoringConfiguration(ScoringConfigurationBase, TimestampMixin):
    """Complete scoring configuration model"""
    id: UUID
    therapist_id: Optional[UUID] = None
    is_global: bool = False
    
    @model_validator(mode='after')
    def validate_weights_sum(self):
        """Validate that main weights sum to approximately 1.0"""
        main_weights = [
            self.weight_compliance,
            self.weight_symmetry,
            self.weight_effort,
            self.weight_game
        ]
        total = sum(main_weights)
        if abs(total - 1.0) > 0.01:  # Allow 1% tolerance
            raise ValueError(f"Main weights must sum to 1.0, got {total}")
        
        # Validate compliance sub-weights
        compliance_weights = [
            self.weight_completion,
            self.weight_intensity,
            self.weight_duration
        ]
        compliance_total = sum(compliance_weights)
        if abs(compliance_total - 1.0) > 0.01:  # Allow 1% tolerance
            raise ValueError(f"Compliance sub-weights must sum to 1.0, got {compliance_total}")
        
        return self


# =============================================================================
# PERFORMANCE SCORES MODELS
# =============================================================================

class PerformanceScoresBase(DatabaseBaseModel):
    """Base fields for performance scores"""
    session_id: UUID
    scoring_config_id: UUID  # Reference to scoring configuration
    
    # Main scores (0-100%)
    overall_score: float = Field(0.0, ge=0.0, le=100.0)
    compliance_score: float = Field(0.0, ge=0.0, le=100.0)
    symmetry_score: Optional[float] = Field(None, ge=0.0, le=100.0)
    effort_score: Optional[float] = Field(None, ge=0.0, le=100.0)
    game_score: Optional[float] = Field(None, ge=0.0, le=100.0)
    
    # Bilateral compliance (CH1=left, CH2=right)
    left_muscle_compliance: Optional[float] = Field(None, ge=0.0, le=100.0)
    right_muscle_compliance: Optional[float] = Field(None, ge=0.0, le=100.0)
    
    # Detailed performance rates (raw metrics before weight application)
    completion_rate_left: Optional[float] = Field(None, ge=0.0, le=1.0)
    completion_rate_right: Optional[float] = Field(None, ge=0.0, le=1.0)
    intensity_rate_left: Optional[float] = Field(None, ge=0.0, le=1.0)
    intensity_rate_right: Optional[float] = Field(None, ge=0.0, le=1.0)
    duration_rate_left: Optional[float] = Field(None, ge=0.0, le=1.0)
    duration_rate_right: Optional[float] = Field(None, ge=0.0, le=1.0)
    
    # BFR monitoring
    bfr_compliant: bool = True
    bfr_pressure_aop: Optional[float] = Field(None, ge=0.0, le=100.0)
    
    # Clinical metrics
    rpe_post_session: Optional[int] = Field(None, ge=0, le=10)
    game_points_achieved: Optional[int] = Field(None, ge=0)
    game_points_max: Optional[int] = Field(None, ge=0)


class PerformanceScoresCreate(PerformanceScoresBase):
    """Model for creating performance scores"""
    pass


class PerformanceScoresUpdate(BaseModel):
    """Model for updating performance scores"""
    overall_score: Optional[float] = Field(None, ge=0.0, le=100.0)
    compliance_score: Optional[float] = Field(None, ge=0.0, le=100.0)
    symmetry_score: Optional[float] = Field(None, ge=0.0, le=100.0)
    effort_score: Optional[float] = Field(None, ge=0.0, le=100.0)
    game_score: Optional[float] = Field(None, ge=0.0, le=100.0)
    bfr_compliant: Optional[bool] = None
    rpe_post_session: Optional[int] = Field(None, ge=0, le=10)


class PerformanceScores(PerformanceScoresBase):
    """Complete performance scores model"""
    id: UUID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =============================================================================
# COMPOSITE MODELS
# =============================================================================

class ScoringConfigurationWithScores(ScoringConfiguration):
    """Scoring configuration with related performance scores"""
    performance_scores: List[PerformanceScores] = Field(default_factory=list)
    usage_count: int = 0


__all__ = [
    'ScoringConfigurationBase', 'ScoringConfigurationCreate', 'ScoringConfigurationUpdate', 'ScoringConfiguration',
    'PerformanceScoresBase', 'PerformanceScoresCreate', 'PerformanceScoresUpdate', 'PerformanceScores',
    'ScoringConfigurationWithScores'
]