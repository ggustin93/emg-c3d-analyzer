"""
Weight Management Service for Performance Scoring
=================================================

Provides mathematically precise weight normalization and validation for the GHOSTLY+
performance scoring system, ensuring weights always sum to 1.0 ± tolerance.

Key Features:
- Mathematical precision using Python Decimal
- Component availability assessment
- Robust weight redistribution algorithms
- Comprehensive validation pipeline
- Default value integration from config.py
"""

from dataclasses import dataclass
from decimal import Decimal, getcontext
from typing import Dict, List, Optional, Tuple
import logging

from config import ScoringDefaults, SessionDefaults

# Set high precision for financial-grade calculations
getcontext().prec = 10

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ComponentAvailability:
    """
    Tracks which scoring components are available for calculation.
    
    Core EMG components (compliance, symmetry) are always available.
    Optional components (effort, game) depend on data availability.
    """
    compliance: bool = True    # Always available (core EMG data)
    symmetry: bool = True      # Always available (core EMG data)  
    effort: bool = False       # RPE-dependent
    game: bool = False         # Game metadata-dependent
    
    @property
    def available_components(self) -> List[str]:
        """Get list of available component names."""
        components = []
        if self.compliance:
            components.append("compliance")
        if self.symmetry:
            components.append("symmetry")
        if self.effort:
            components.append("effort")
        if self.game:
            components.append("game")
        return components
    
    @property
    def component_count(self) -> int:
        """Get count of available components."""
        return len(self.available_components)
    
    def requires_redistribution(self) -> bool:
        """Check if weight redistribution is needed due to missing components."""
        return not (self.compliance and self.symmetry and self.effort and self.game)


@dataclass(frozen=True)
class WeightValidationResult:
    """Result of weight validation with detailed information."""
    is_valid: bool
    total_sum: float
    tolerance: float
    deviation: float
    components: List[str]
    error_message: Optional[str] = None
    
    @property
    def within_tolerance(self) -> bool:
        """Check if deviation is within acceptable tolerance."""
        return abs(self.deviation) <= self.tolerance


class WeightManager:
    """
    Manages weight normalization and validation for performance scoring.
    
    Ensures mathematical precision and consistent weight distribution
    across all scoring scenarios with proper fallback mechanisms.
    """
    
    def __init__(self, base_weights: Optional[object] = None, tolerance: float = 0.001):
        """
        Initialize WeightManager with base weights and tolerance.
        
        Args:
            base_weights: Base scoring weights (defaults to ScoringDefaults)
            tolerance: Acceptable deviation from 1.0 for weight sum validation
        """
        self.base_weights = base_weights or self._load_default_weights()
        self.tolerance = tolerance
        self.scoring_defaults = ScoringDefaults()
        self.session_defaults = SessionDefaults()
        
        # Validate base weights on initialization
        self._validate_base_weights()
        
        logger.info(f"🎯 WeightManager initialized with tolerance: ±{tolerance}")
    
    def _load_default_weights(self) -> object:
        """Load default weights from config.py ScoringDefaults."""
        defaults = ScoringDefaults()
        
        # Create a simple object to hold the weights
        class DefaultWeights:
            def __init__(self):
                self.w_compliance = defaults.WEIGHT_COMPLIANCE
                self.w_symmetry = defaults.WEIGHT_SYMMETRY
                self.w_effort = defaults.WEIGHT_EFFORT
                self.w_game = defaults.WEIGHT_GAME
                self.w_completion = defaults.WEIGHT_COMPLETION
                self.w_intensity = defaults.WEIGHT_INTENSITY
                self.w_duration = defaults.WEIGHT_DURATION
        
        return DefaultWeights()
    
    def _validate_base_weights(self):
        """Validate base weights sum to 1.0 within tolerance."""
        main_sum = (
            self.base_weights.w_compliance + 
            self.base_weights.w_symmetry + 
            self.base_weights.w_effort + 
            self.base_weights.w_game
        )
        
        sub_sum = (
            self.base_weights.w_completion + 
            self.base_weights.w_intensity + 
            self.base_weights.w_duration
        )
        
        if abs(main_sum - 1.0) > self.tolerance:
            raise ValueError(f"Invalid base main weights sum: {main_sum} (expected 1.0 ± {self.tolerance})")
        
        if abs(sub_sum - 1.0) > self.tolerance:
            raise ValueError(f"Invalid base sub weights sum: {sub_sum} (expected 1.0 ± {self.tolerance})")
    
    def assess_component_availability(self, 
                                    compliance_score: Optional[float],
                                    symmetry_score: Optional[float], 
                                    effort_score: Optional[float],
                                    game_score: Optional[float]) -> ComponentAvailability:
        """
        Assess which components are available for scoring.
        
        Args:
            compliance_score: Compliance score (None if unavailable)
            symmetry_score: Symmetry score (None if unavailable)
            effort_score: Effort score (None if unavailable)  
            game_score: Game score (None if unavailable)
            
        Returns:
            ComponentAvailability with availability flags
        """
        return ComponentAvailability(
            compliance=compliance_score is not None,
            symmetry=symmetry_score is not None,
            effort=effort_score is not None,
            game=game_score is not None
        )
    
    def normalize_weights(self, availability: ComponentAvailability) -> Dict[str, float]:
        """
        Normalize weights based on component availability.
        
        GUARANTEE: sum(returned_weights.values()) == 1.0 ± tolerance
        
        Args:
            availability: Component availability assessment
            
        Returns:
            Dictionary of normalized weights that sum to 1.0
            
        Raises:
            ValueError: If normalization cannot achieve valid weights
        """
        if availability.component_count < 2:
            raise ValueError("Insufficient components for scoring (minimum: 2)")
        
        if not (availability.compliance and availability.symmetry):
            raise ValueError("Core EMG components (compliance, symmetry) required for scoring")
        
        # Use high-precision Decimal arithmetic
        weights = {}
        total_weight = Decimal('0')
        
        # Add available component weights
        if availability.compliance:
            weight = Decimal(str(self.base_weights.w_compliance))
            weights['compliance'] = weight
            total_weight += weight
            
        if availability.symmetry:
            weight = Decimal(str(self.base_weights.w_symmetry))
            weights['symmetry'] = weight
            total_weight += weight
            
        if availability.effort:
            weight = Decimal(str(self.base_weights.w_effort))
            weights['effort'] = weight
            total_weight += weight
            
        if availability.game:
            weight = Decimal(str(self.base_weights.w_game))
            weights['game'] = weight
            total_weight += weight
        
        # Normalize to sum = 1.0 with high precision
        if total_weight == 0:
            raise ValueError("Total weight cannot be zero")
            
        normalized_weights = {}
        for component, weight in weights.items():
            normalized_weight = float(weight / total_weight)
            normalized_weights[component] = normalized_weight
        
        # Final validation
        validation = self.validate_weights(normalized_weights)
        if not validation.is_valid:
            raise ValueError(f"Weight normalization failed: {validation.error_message}")
        
        logger.debug(f"✅ Normalized weights: {normalized_weights} (sum: {validation.total_sum})")
        return normalized_weights
    
    def validate_weights(self, weights: Dict[str, float]) -> WeightValidationResult:
        """
        Validate weight dictionary for mathematical consistency.
        
        Args:
            weights: Dictionary of component weights
            
        Returns:
            WeightValidationResult with validation details
        """
        if not weights:
            return WeightValidationResult(
                is_valid=False,
                total_sum=0.0,
                tolerance=self.tolerance,
                deviation=-1.0,
                components=[],
                error_message="Empty weights dictionary"
            )
        
        total_sum = sum(weights.values())
        deviation = total_sum - 1.0
        is_valid = abs(deviation) <= self.tolerance
        
        components = list(weights.keys())
        error_message = None if is_valid else f"Weight sum {total_sum} exceeds tolerance ±{self.tolerance}"
        
        return WeightValidationResult(
            is_valid=is_valid,
            total_sum=total_sum,
            tolerance=self.tolerance,
            deviation=deviation,
            components=components,
            error_message=error_message
        )
    
    def get_default_rpe_score(self) -> float:
        """
        Get default RPE effort score from SessionDefaults.
        
        Uses SessionDefaults.RPE_POST_SESSION (default: 4) which maps to
        100% effort score via ScoringDefaults.DEFAULT_RPE_MAPPING.
        
        Returns:
            Default effort score percentage (0-100)
        """
        default_rpe = self.session_defaults.RPE_POST_SESSION
        rpe_str = str(default_rpe)
        
        # Get score from DEFAULT_RPE_MAPPING in ScoringDefaults
        rpe_mapping = self.scoring_defaults.DEFAULT_RPE_MAPPING
        
        if rpe_str in rpe_mapping:
            score = rpe_mapping[rpe_str]["score"]
            logger.debug(f"🎯 Using default RPE {default_rpe} → {score}% effort score")
            return float(score)
        else:
            # Fallback to 100% for optimal intensity
            logger.warning(f"⚠️ Default RPE {default_rpe} not in mapping, using 100%")
            return 100.0
    
    def calculate_overall_score(self,
                              compliance_score: Optional[float],
                              symmetry_score: Optional[float],
                              effort_score: Optional[float],
                              game_score: Optional[float]) -> Optional[float]:
        """
        Calculate overall performance score with normalized weights.
        
        Args:
            compliance_score: Compliance score (0-100)
            symmetry_score: Symmetry score (0-100)
            effort_score: Effort score (0-100, None uses default)
            game_score: Game score (0-100, None if unavailable)
            
        Returns:
            Overall performance score (0-100) or None if insufficient data
        """
        try:
            # Use default RPE if effort_score is None
            if effort_score is None:
                effort_score = self.get_default_rpe_score()
                logger.info(f"🎯 Using default RPE effort score: {effort_score}%")
            
            # Assess component availability
            availability = self.assess_component_availability(
                compliance_score, symmetry_score, effort_score, game_score
            )
            
            # Check minimum requirements
            if availability.component_count < 2:
                logger.warning("⚠️ Insufficient components for overall score calculation")
                return None
            
            if not (availability.compliance and availability.symmetry):
                logger.warning("⚠️ Core EMG components missing for overall score")
                return None
            
            # Normalize weights
            normalized_weights = self.normalize_weights(availability)
            
            # Calculate weighted score
            total_score = 0.0
            
            if availability.compliance and compliance_score is not None:
                total_score += compliance_score * normalized_weights['compliance']
                
            if availability.symmetry and symmetry_score is not None:
                total_score += symmetry_score * normalized_weights['symmetry']
                
            if availability.effort and effort_score is not None:
                total_score += effort_score * normalized_weights['effort']
                
            if availability.game and game_score is not None:
                total_score += game_score * normalized_weights['game']
            
            logger.info(f"✅ Overall score calculated: {total_score:.1f}% with {availability.component_count} components")
            return total_score
            
        except Exception as e:
            logger.error(f"❌ Overall score calculation failed: {e}")
            return None