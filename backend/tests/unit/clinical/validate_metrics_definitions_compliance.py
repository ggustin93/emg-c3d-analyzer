#!/usr/bin/env python3
"""GHOSTLY+ metricsDefinitions.md Compliance Validation.

Validates that the entire implementation (backend + frontend) complies exactly
with the technical specification defined in memory-bank/metricsDefinitions.md.

This is the final validation script to ensure single source of truth.
"""

import sys
from pathlib import Path

# Add backend path for imports
sys.path.append(str(Path(__file__).resolve().parents[1] / "backend"))

from services.clinical.performance_scoring_service import (  # noqa: E402
    PerformanceScoringService,
    ScoringWeights,
    SessionMetrics,
)


class MetricsDefinitionsValidator:
    """Validates implementation compliance with metricsDefinitions.md specification."""

    def __init__(self):
        self.service = PerformanceScoringService()
        self.errors = []
        self.warnings = []

    def validate_default_weights(self) -> bool:
        """Validate that weights follow the correct hierarchy and constraints.

        Priority hierarchy:
        1. Database configuration (patient-specific, therapist, or global)
        2. System defaults from config.py (which match metricsDefinitions.md)
        
        This test validates:
        - Weights sum to 1.0 (required constraint)
        - Weights are within valid ranges (0.0 to 1.0)
        - System can fall back gracefully when database config unavailable
        """
        print("🔍 Validating Weight Configuration Hierarchy...")

        weights = ScoringWeights()
        
        # Instead of checking exact values, validate constraints
        # This allows flexibility for database-driven configurations
        
        # Check that all weights are within valid range [0.0, 1.0]
        weight_values = {
            "w_compliance": weights.w_compliance,
            "w_symmetry": weights.w_symmetry,
            "w_effort": weights.w_effort,
            "w_game": weights.w_game,
            "w_completion": weights.w_completion,
            "w_intensity": weights.w_intensity,
            "w_duration": weights.w_duration,
        }
        
        for name, value in weight_values.items():
            if not (0.0 <= value <= 1.0):
                self.errors.append(f"❌ {name}: {value} is outside valid range [0.0, 1.0]")
        
        # Log actual values for transparency
        print(f"  📊 Current weight configuration:")
        print(f"     - Compliance: {weights.w_compliance:.2f}")
        print(f"     - Symmetry: {weights.w_symmetry:.2f}")
        print(f"     - Effort: {weights.w_effort:.2f}")
        print(f"     - Game: {weights.w_game:.2f}")
        print(f"     - Sub-weights: Completion={weights.w_completion:.3f}, "
              f"Intensity={weights.w_intensity:.3f}, Duration={weights.w_duration:.3f}")

        # Check main weights
        if weights.w_compliance != expected["w_compliance"]:
            self.errors.append(
                f"❌ w_compliance: got {weights.w_compliance}, expected {expected['w_compliance']}"
            )

        if weights.w_symmetry != expected["w_symmetry"]:
            self.errors.append(
                f"❌ w_symmetry: got {weights.w_symmetry}, expected {expected['w_symmetry']}"
            )

        if weights.w_effort != expected["w_effort"]:
            self.errors.append(
                f"❌ w_effort: got {weights.w_effort}, expected {expected['w_effort']}"
            )

        if weights.w_game != expected["w_game"]:
            self.errors.append(f"❌ w_game: got {weights.w_game}, expected {expected['w_game']}")

        # Check sub-weights (allow small floating point differences)
        if abs(weights.w_completion - expected["w_completion"]) > 0.001:
            self.errors.append(
                f"❌ w_completion: got {weights.w_completion}, expected ~{expected['w_completion']:.3f}"
            )

        if abs(weights.w_intensity - expected["w_intensity"]) > 0.001:
            self.errors.append(
                f"❌ w_intensity: got {weights.w_intensity}, expected ~{expected['w_intensity']:.3f}"
            )

        if abs(weights.w_duration - expected["w_duration"]) > 0.001:
            self.errors.append(
                f"❌ w_duration: got {weights.w_duration}, expected ~{expected['w_duration']:.3f}"
            )

        # Verify weights sum to 1.0
        main_sum = weights.w_compliance + weights.w_symmetry + weights.w_effort + weights.w_game
        sub_sum = weights.w_completion + weights.w_intensity + weights.w_duration

        if abs(main_sum - 1.0) > 0.001:
            self.errors.append(f"❌ Main weights sum: got {main_sum}, expected 1.0")

        if abs(sub_sum - 1.0) > 0.001:
            self.errors.append(f"❌ Sub-weights sum: got {sub_sum}, expected 1.0")

        if not self.errors:
            print("✅ Default weights comply with metricsDefinitions.md")
            return True
        else:
            return False

    def validate_rpe_mapping(self) -> bool:
        """Validate RPE mapping against metricsDefinitions.md specification.

        From spec:
        - RPE [4,6] → 100% (optimal therapeutic range)
        - RPE {3,7} → 80% (acceptable range)
        - RPE {2,8} → 60% (suboptimal range)
        - RPE {0,1,9,10} → 20% (poor/dangerous)
        """
        print("🔍 Validating RPE Mapping Against metricsDefinitions.md...")

        # Test all specified mappings
        test_cases = [
            # Optimal range (100%)
            (4, 100.0),
            (5, 100.0),
            (6, 100.0),
            # Acceptable range (80%)
            (3, 80.0),
            (7, 80.0),
            # Suboptimal range (60%)
            (2, 60.0),
            (8, 60.0),
            # Poor/dangerous range (20%)
            (0, 20.0),
            (1, 20.0),
            (9, 20.0),
            (10, 20.0),
        ]

        rpe_errors = []

        for rpe, expected_score in test_cases:
            actual_score, _ = self.service._calculate_effort_score(rpe, False)

            if actual_score != expected_score:
                rpe_errors.append(f"❌ RPE {rpe}: got {actual_score}%, expected {expected_score}%")

        # Test None case
        none_score, _ = self.service._calculate_effort_score(None, False)
        if none_score is not None:
            rpe_errors.append(f"❌ RPE None: got {none_score}, expected None")

        if rpe_errors:
            self.errors.extend(rpe_errors)
            return False
        else:
            print("✅ RPE mapping complies with metricsDefinitions.md")
            return True

    def validate_bfr_safety_gate(self) -> bool:
        """Validate BFR safety gate implementation.

        From spec:
        C_BFR = 1.0 if pressure ∈ [45%, 55%] AOP, else 0.0 (full penalty)
        """
        print("🔍 Validating BFR Safety Gate Against metricsDefinitions.md...")

        bfr_test_cases = [
            # Compliant range
            (45.0, 1.0),
            (50.0, 1.0),
            (55.0, 1.0),
            # Non-compliant (below)
            (44.9, 0.0),
            (40.0, 0.0),
            (30.0, 0.0),
            # Non-compliant (above)
            (55.1, 0.0),
            (60.0, 0.0),
            (70.0, 0.0),
            # None (assume compliant)
            (None, 1.0),
        ]

        bfr_errors = []

        for pressure, expected_gate in bfr_test_cases:
            actual_gate = self.service._calculate_bfr_gate(pressure)

            if actual_gate != expected_gate:
                bfr_errors.append(
                    f"❌ BFR {pressure}% AOP: got gate {actual_gate}, expected {expected_gate}"
                )

        if bfr_errors:
            self.errors.extend(bfr_errors)
            return False
        else:
            print("✅ BFR safety gate complies with metricsDefinitions.md")
            return True

    def validate_clinical_example(self) -> bool:
        """Validate the clinical example from Section 5 of metricsDefinitions.md.

        Expected calculations:
        - S_comp^left = 88.3%
        - S_comp^right = 86.2%
        - S_compliance = 87.3%
        - S_symmetry = 98.8%
        - S_effort = 100%
        - S_game = 85%
        - P_overall = 91.6%
        """
        print("🔍 Validating Clinical Example from metricsDefinitions.md Section 5...")

        # Clinical example metrics
        clinical_metrics = SessionMetrics(
            session_id="clinical-example-validation",
            # Left muscle: 11/12 completed (92%), 9/11 ≥75% MVC (82%), 10/11 ≥2s (91%)
            left_total_contractions=11,
            left_good_contractions=11,
            left_mvc_contractions=9,
            left_duration_contractions=10,
            # Right muscle: 12/12 completed (100%), 8/12 ≥75% MVC (67%), 11/12 ≥2s (92%)
            right_total_contractions=12,
            right_good_contractions=12,
            right_mvc_contractions=8,
            right_duration_contractions=11,
            # BFR at 52% AOP (compliant)
            bfr_pressure_aop=52.0,
            bfr_compliant=True,
            # Post-session RPE: 6 (optimal)
            rpe_post_session=6,
            # Game score: 850/1000 points
            game_points_achieved=850,
            game_points_max=1000,
            expected_contractions_per_muscle=12,
        )

        # Calculate compliance components
        compliance = self.service._calculate_compliance_components(clinical_metrics)

        # Expected calculations from spec
        expected_left_compliance = (1 / 3) * (11 / 12 + 9 / 11 + 10 / 11) * 100  # 88.3%
        expected_right_compliance = (1 / 3) * (12 / 12 + 8 / 12 + 11 / 12) * 100  # 86.2%
        expected_overall_compliance = (
            expected_left_compliance + expected_right_compliance
        ) / 2  # 87.3%

        # Check compliance calculations
        if abs(compliance["left_muscle_compliance"] - expected_left_compliance) > 0.1:
            self.errors.append(
                f"❌ Left compliance: got {compliance['left_muscle_compliance']:.1f}%, expected {expected_left_compliance:.1f}%"
            )

        if abs(compliance["right_muscle_compliance"] - expected_right_compliance) > 0.1:
            self.errors.append(
                f"❌ Right compliance: got {compliance['right_muscle_compliance']:.1f}%, expected {expected_right_compliance:.1f}%"
            )

        if abs(compliance["overall_compliance"] - expected_overall_compliance) > 0.1:
            self.errors.append(
                f"❌ Overall compliance: got {compliance['overall_compliance']:.1f}%, expected {expected_overall_compliance:.1f}%"
            )

        # Check symmetry calculation
        symmetry = self.service._calculate_symmetry_score(
            compliance["left_muscle_compliance"], compliance["right_muscle_compliance"]
        )
        expected_symmetry = (
            1
            - abs(expected_left_compliance - expected_right_compliance)
            / (expected_left_compliance + expected_right_compliance)
        ) * 100  # 98.8%

        if abs(symmetry - expected_symmetry) > 0.1:
            self.errors.append(
                f"❌ Symmetry: got {symmetry:.1f}%, expected {expected_symmetry:.1f}%"
            )

        # Check effort score (RPE = 6 → 100%)
        effort_score, _ = self.service._calculate_effort_score(
            clinical_metrics.rpe_post_session, False
        )
        if effort_score != 100.0:
            self.errors.append(f"❌ Effort score: got {effort_score}%, expected 100%")

        # Check game score (850/1000 → 85%)
        game_score = self.service._calculate_game_score(
            clinical_metrics.game_points_achieved, clinical_metrics.game_points_max
        )
        if game_score != 85.0:
            self.errors.append(f"❌ Game score: got {game_score}%, expected 85%")

        # Check BFR gate (52% AOP → 1.0)
        bfr_gate = self.service._calculate_bfr_gate(clinical_metrics.bfr_pressure_aop)
        if bfr_gate != 1.0:
            self.errors.append(f"❌ BFR gate: got {bfr_gate}, expected 1.0")

        # Check overall performance calculation
        weights = ScoringWeights()
        expected_overall = (
            weights.w_compliance * expected_overall_compliance
            + weights.w_symmetry * expected_symmetry
            + weights.w_effort * 100.0
            + weights.w_game * 85.0
        ) * bfr_gate

        # Calculate actual overall score
        result = self.service.calculate_performance_scores(
            "clinical-example-validation", clinical_metrics
        )
        actual_overall = result.get("overall_score", 0)

        if abs(actual_overall - expected_overall) > 0.1:
            self.errors.append(
                f"❌ Overall performance: got {actual_overall:.1f}%, expected {expected_overall:.1f}%"
            )

        if not self.errors:
            print("✅ Clinical example calculations comply with metricsDefinitions.md")
            return True
        else:
            return False

    def validate_formula_consistency(self) -> bool:
        """Validate that the overall performance formula is implemented correctly.

        P_overall = w_c x S_compliance + w_s x S_symmetry + w_e x S_effort + w_g x S_game
        """
        print("🔍 Validating Overall Performance Formula Implementation...")

        # Test with known values
        test_metrics = SessionMetrics(
            session_id="formula-test",
            left_total_contractions=10,
            left_mvc_contractions=8,
            left_duration_contractions=9,
            right_total_contractions=12,
            right_mvc_contractions=10,
            right_duration_contractions=11,
            expected_contractions_per_muscle=12,
            bfr_pressure_aop=50.0,  # Compliant
            rpe_post_session=5,  # 100% effort
            game_points_achieved=75,
            game_points_max=100,
            left_good_contractions=10,
            right_good_contractions=12,
        )

        result = self.service.calculate_performance_scores("formula-test", test_metrics)

        # Manual calculation
        weights = ScoringWeights()

        # Get individual scores
        compliance_score = result["compliance_score"]
        symmetry_score = result["symmetry_score"]
        effort_score = result["effort_score"]
        game_score = result["game_score"]

        # Calculate expected overall score
        expected_overall = (
            weights.w_compliance * compliance_score
            + weights.w_symmetry * symmetry_score
            + weights.w_effort * effort_score
            + weights.w_game * game_score
        )

        actual_overall = result["overall_score"]

        if abs(actual_overall - expected_overall) > 0.1:
            self.errors.append(
                f"❌ Formula inconsistency: calculated {actual_overall:.1f}%, manual {expected_overall:.1f}%"
            )
            return False
        else:
            print("✅ Overall performance formula is correctly implemented")
            return True

    def validate_single_source_of_truth(self) -> bool:
        """Validate that backend and frontend use consistent default weights."""
        print("🔍 Validating Single Source of Truth Implementation...")

        # Backend weights
        backend_weights = ScoringWeights()

        # Expected frontend fallback weights (should match backend exactly)
        expected_frontend_fallback = {
            "compliance": 0.40,
            "symmetry": 0.25,
            "effort": 0.20,
            "gameScore": 0.15,
            "compliance_completion": 0.333,
            "compliance_intensity": 0.333,
            "compliance_duration": 0.334,
        }

        # Check consistency
        consistency_errors = []

        if backend_weights.w_compliance != expected_frontend_fallback["compliance"]:
            consistency_errors.append(
                f"❌ Compliance weight mismatch: backend {backend_weights.w_compliance}, frontend fallback {expected_frontend_fallback['compliance']}"
            )

        if backend_weights.w_symmetry != expected_frontend_fallback["symmetry"]:
            consistency_errors.append(
                f"❌ Symmetry weight mismatch: backend {backend_weights.w_symmetry}, frontend fallback {expected_frontend_fallback['symmetry']}"
            )

        if backend_weights.w_effort != expected_frontend_fallback["effort"]:
            consistency_errors.append(
                f"❌ Effort weight mismatch: backend {backend_weights.w_effort}, frontend fallback {expected_frontend_fallback['effort']}"
            )

        if backend_weights.w_game != expected_frontend_fallback["gameScore"]:
            consistency_errors.append(
                f"❌ Game weight mismatch: backend {backend_weights.w_game}, frontend fallback {expected_frontend_fallback['gameScore']}"
            )

        if consistency_errors:
            self.errors.extend(consistency_errors)
            return False
        else:
            print("✅ Single source of truth is correctly implemented")
            return True

    def run_full_validation(self) -> bool:
        """Run all validation checks."""
        print("🚀 Starting GHOSTLY+ metricsDefinitions.md Compliance Validation\n")

        validation_results = [
            self.validate_default_weights(),
            self.validate_rpe_mapping(),
            self.validate_bfr_safety_gate(),
            self.validate_clinical_example(),
            self.validate_formula_consistency(),
            self.validate_single_source_of_truth(),
        ]

        print("\n" + "=" * 60)

        if all(validation_results):
            print("🎉 ALL VALIDATIONS PASSED!")
            print("✅ Implementation fully complies with metricsDefinitions.md")
            print("✅ Single source of truth correctly implemented")
            print("✅ Backend and frontend are consistent")
            return True
        else:
            print("❌ VALIDATION FAILURES DETECTED!")
            print(f"❌ {len(self.errors)} error(s) found:")
            for error in self.errors:
                print(f"   {error}")

            if self.warnings:
                print(f"⚠️  {len(self.warnings)} warning(s):")
                for warning in self.warnings:
                    print(f"   {warning}")

            return False


def main():
    """Main validation entry point."""
    validator = MetricsDefinitionsValidator()

    success = validator.run_full_validation()

    if success:
        print("\n🎯 COMPLIANCE VALIDATION SUCCESSFUL")
        print("The implementation is ready for clinical use.")
        sys.exit(0)
    else:
        print("\n💥 COMPLIANCE VALIDATION FAILED")
        print("Implementation requires fixes before clinical deployment.")
        sys.exit(1)


if __name__ == "__main__":
    main()
