"""Comprehensive Tests for Performance Scoring Service.

Tests the complete GHOSTLY+ performance scoring algorithm implementation
against metricsDefinitions.md specification with single source of truth validation.
"""

from unittest.mock import Mock, patch

import pytest

from services.clinical.performance_scoring_service import (
    PerformanceScoringService,
    RPEMapping,
    ScoringWebhookHandler,
    ScoringWeights,
    SessionMetrics,
)


class TestRPEMapping:
    """Test RPEMapping dataclass and configurable mapping"""

    def test_default_rpe_mapping_matches_metrics_definitions(self):
        """Test that default RPE mapping matches metricsDefinitions.md exactly"""
        mapping = RPEMapping()

        # Test default ranges
        assert mapping.optimal_range == [4, 5, 6], "Optimal RPE range must be 4-6"
        assert mapping.acceptable_range == [3, 7], "Acceptable RPE range must be 3, 7"
        assert mapping.suboptimal_range == [2, 8], "Suboptimal RPE range must be 2, 8"
        assert mapping.poor_range == [0, 1, 9, 10], "Poor RPE range must be 0-1, 9-10"

        # Test default scores
        assert mapping.optimal_score == 100.0, "Optimal score must be 100%"
        assert mapping.acceptable_score == 80.0, "Acceptable score must be 80%"
        assert mapping.suboptimal_score == 60.0, "Suboptimal score must be 60%"
        assert mapping.poor_score == 20.0, "Poor score must be 20%"

    def test_rpe_mapping_get_effort_score_defaults(self):
        """Test RPE mapping with default values"""
        mapping = RPEMapping()

        # Test optimal range
        for rpe in [4, 5, 6]:
            assert mapping.get_effort_score(rpe) == 100.0, f"RPE {rpe} should be 100%"

        # Test acceptable range
        for rpe in [3, 7]:
            assert mapping.get_effort_score(rpe) == 80.0, f"RPE {rpe} should be 80%"

        # Test suboptimal range
        for rpe in [2, 8]:
            assert mapping.get_effort_score(rpe) == 60.0, f"RPE {rpe} should be 60%"

        # Test poor range
        for rpe in [0, 1, 9, 10]:
            assert mapping.get_effort_score(rpe) == 20.0, f"RPE {rpe} should be 20%"

        # Test unexpected value
        assert mapping.get_effort_score(11) == 50.0, "Unexpected RPE should return default score"

    def test_custom_rpe_mapping_researcher_configuration(self):
        """Test custom RPE mapping for researcher role"""
        # Custom researcher configuration
        custom_mapping = RPEMapping(
            optimal_range=[3, 4, 5],  # Shifted optimal range
            acceptable_range=[2, 6],
            suboptimal_range=[1, 7],
            poor_range=[0, 8, 9, 10],
            optimal_score=90.0,       # Different scores
            acceptable_score=70.0,
            suboptimal_score=50.0,
            poor_score=10.0
        )

        # Test custom ranges
        assert custom_mapping.get_effort_score(3) == 90.0, "Custom optimal range RPE 3 should be 90%"
        assert custom_mapping.get_effort_score(4) == 90.0, "Custom optimal range RPE 4 should be 90%"
        assert custom_mapping.get_effort_score(5) == 90.0, "Custom optimal range RPE 5 should be 90%"

        assert custom_mapping.get_effort_score(2) == 70.0, "Custom acceptable range RPE 2 should be 70%"
        assert custom_mapping.get_effort_score(6) == 70.0, "Custom acceptable range RPE 6 should be 70%"

        assert custom_mapping.get_effort_score(1) == 50.0, "Custom suboptimal range RPE 1 should be 50%"
        assert custom_mapping.get_effort_score(7) == 50.0, "Custom suboptimal range RPE 7 should be 50%"

        assert custom_mapping.get_effort_score(0) == 10.0, "Custom poor range RPE 0 should be 10%"
        assert custom_mapping.get_effort_score(8) == 10.0, "Custom poor range RPE 8 should be 10%"

    def test_rpe_mapping_edge_cases(self):
        """Test RPE mapping edge cases and validation"""
        mapping = RPEMapping()

        # Test boundary values
        assert mapping.get_effort_score(-1) == 50.0, "Negative RPE should return default"
        assert mapping.get_effort_score(15) == 50.0, "High RPE should return default"

        # Test empty ranges (should use defaults)
        empty_mapping = RPEMapping(
            optimal_range=[],
            acceptable_range=[],
            suboptimal_range=[],
            poor_range=[]
        )

        # All values should return default score when ranges are empty
        for rpe in range(11):
            assert empty_mapping.get_effort_score(rpe) == 50.0, f"Empty ranges: RPE {rpe} should return default"


class TestScoringWeights:
    """Test ScoringWeights dataclass and validation"""

    def test_default_weights_match_metrics_definitions(self):
        """Test that default weights match metricsDefinitions.md exactly"""
        weights = ScoringWeights()

        # Main component weights (from metricsDefinitions.md)
        assert weights.w_compliance == 0.40, "Compliance weight must be 40%"
        assert weights.w_symmetry == 0.25, "Symmetry weight must be 25%"
        assert weights.w_effort == 0.20, "Effort weight must be 20%"
        assert weights.w_game == 0.15, "Game weight must be 15%"

        # Sub-component weights for compliance
        assert abs(weights.w_completion - 0.333) < 0.001, "Completion weight must be ~33.3%"
        assert abs(weights.w_intensity - 0.333) < 0.001, "Intensity weight must be ~33.3%"
        assert abs(weights.w_duration - 0.334) < 0.001, "Duration weight must be ~33.4%"

    def test_weights_validation_main_components(self):
        """Test main component weights validation (must sum to 1.0)"""
        # Valid weights
        valid_weights = ScoringWeights(
            w_compliance=0.40, w_symmetry=0.25, w_effort=0.20, w_game=0.15
        )
        assert valid_weights.validate()

        # Invalid weights (sum > 1.0)
        invalid_weights = ScoringWeights(
            w_compliance=0.50, w_symmetry=0.30, w_effort=0.25, w_game=0.20
        )
        assert not invalid_weights.validate()

        # Invalid weights (sum < 1.0)
        invalid_weights2 = ScoringWeights(
            w_compliance=0.30, w_symmetry=0.20, w_effort=0.15, w_game=0.10
        )
        assert invalid_weights2.validate() == False

    def test_weights_validation_sub_components(self):
        """Test compliance sub-component weights validation (must sum to 1.0)"""
        # Valid sub-weights
        valid_weights = ScoringWeights(
            w_completion=0.333, w_intensity=0.333, w_duration=0.334
        )
        assert valid_weights.validate()

        # Invalid sub-weights
        invalid_weights = ScoringWeights(
            w_completion=0.5, w_intensity=0.3, w_duration=0.3
        )
        assert not invalid_weights.validate()


class TestSessionMetrics:
    """Test SessionMetrics dataclass"""

    def test_session_metrics_creation(self):
        """Test creating SessionMetrics with required fields"""
        metrics = SessionMetrics(
            session_id="test-session-123",
            left_total_contractions=20,
            left_good_contractions=18,
            left_mvc_contractions=15,
            left_duration_contractions=16,
            right_total_contractions=22,
            right_good_contractions=20,
            right_mvc_contractions=17,
            right_duration_contractions=19,
            expected_contractions_per_muscle=12
        )

        assert metrics.session_id == "test-session-123"
        assert metrics.left_total_contractions == 20
        assert metrics.right_total_contractions == 22
        assert metrics.expected_contractions_per_muscle == 12

    def test_session_metrics_optional_fields(self):
        """Test SessionMetrics with optional BFR, RPE, and game data"""
        metrics = SessionMetrics(
            session_id="test-session-123",
            left_total_contractions=20, left_good_contractions=18,
            left_mvc_contractions=15, left_duration_contractions=16,
            right_total_contractions=22, right_good_contractions=20,
            right_mvc_contractions=17, right_duration_contractions=19,
            bfr_pressure_aop=50.0,
            bfr_compliant=True,
            rpe_post_session=5,
            game_points_achieved=85,
            game_points_max=100
        )

        assert metrics.bfr_pressure_aop == 50.0
        assert metrics.rpe_post_session == 5
        assert metrics.game_points_achieved == 85


class TestPerformanceScoringService:
    """Comprehensive tests for the main scoring service"""

    @pytest.fixture
    def mock_supabase_client(self):
        """Mock Supabase client for testing"""
        mock_client = Mock()
        mock_table = Mock()
        mock_client.table.return_value = mock_table
        return mock_client, mock_table

    @pytest.fixture
    def scoring_service(self, mock_supabase_client):
        """Create scoring service with mocked database"""
        mock_client, _ = mock_supabase_client
        return PerformanceScoringService(supabase_client=mock_client)

    @pytest.fixture
    def sample_session_metrics(self):
        """Sample session metrics for testing"""
        return SessionMetrics(
            session_id="test-session-123",
            left_total_contractions=20,    # 167% completion (20/12)
            left_good_contractions=18,
            left_mvc_contractions=15,      # 75% intensity (15/20)
            left_duration_contractions=16, # 80% duration (16/20)
            right_total_contractions=18,   # 150% completion (18/12)
            right_good_contractions=16,
            right_mvc_contractions=14,     # 78% intensity (14/18)
            right_duration_contractions=15, # 83% duration (15/18)
            bfr_pressure_aop=50.0,         # Compliant (45-55% AOP)
            bfr_compliant=True,
            rpe_post_session=5,            # Optimal RPE (100% effort score)
            game_points_achieved=85,       # 85% game score
            game_points_max=100,
            expected_contractions_per_muscle=12
        )

    def test_load_scoring_weights_from_database_success(self, scoring_service, mock_supabase_client):
        """Test successful loading of weights from database"""
        _, mock_table = mock_supabase_client

        # Mock database response with custom weights
        mock_response = Mock()
        mock_response.data = [{
            "weight_compliance": 0.45,
            "weight_symmetry": 0.30,
            "weight_effort": 0.15,
            "weight_game": 0.10,
            "weight_completion": 0.40,
            "weight_intensity": 0.35,
            "weight_duration": 0.25
        }]

        mock_table.select.return_value.order.return_value.limit.return_value.execute.return_value = mock_response

        weights = scoring_service._load_scoring_weights_from_database("test-session")

        assert weights.w_compliance == 0.45
        assert weights.w_symmetry == 0.30
        assert weights.w_effort == 0.15
        assert weights.w_game == 0.10

    def test_load_scoring_weights_from_database_fallback(self, scoring_service, mock_supabase_client):
        """Test fallback to default weights when database query fails"""
        _, mock_table = mock_supabase_client

        # Mock empty database response
        mock_response = Mock()
        mock_response.data = []

        mock_table.select.return_value.order.return_value.limit.return_value.execute.return_value = mock_response

        weights = scoring_service._load_scoring_weights_from_database("test-session")

        # Should use default weights from metricsDefinitions.md
        assert weights.w_compliance == 0.40
        assert weights.w_symmetry == 0.25
        assert weights.w_effort == 0.20
        assert weights.w_game == 0.15

    def test_calculate_compliance_components_perfect_performance(self, scoring_service):
        """Test compliance calculation with perfect performance scenario"""
        # Modify metrics for perfect performance
        perfect_metrics = SessionMetrics(
            session_id="perfect-session",
            left_total_contractions=12,    # 100% completion
            left_mvc_contractions=12,      # 100% intensity
            left_duration_contractions=12, # 100% duration
            right_total_contractions=12,   # 100% completion
            right_mvc_contractions=12,     # 100% intensity
            right_duration_contractions=12, # 100% duration
            expected_contractions_per_muscle=12,
            left_good_contractions=12,
            right_good_contractions=12
        )

        components = scoring_service._calculate_compliance_components(perfect_metrics)

        # Both muscles should have 100% compliance
        assert components["left_muscle_compliance"] == 100.0
        assert components["right_muscle_compliance"] == 100.0
        assert components["overall_compliance"] == 100.0

        # All sub-components should be perfect
        assert components["completion_rate_left"] == 1.0
        assert components["intensity_rate_left"] == 1.0
        assert components["duration_rate_left"] == 1.0

    def test_calculate_compliance_components_realistic_scenario(self, scoring_service, sample_session_metrics):
        """Test compliance calculation with realistic clinical data"""
        components = scoring_service._calculate_compliance_components(sample_session_metrics)

        # Left muscle: 167% completion, 75% intensity, 80% duration
        # Compliance = (0.333 * 1.67 + 0.333 * 0.75 + 0.334 * 0.80) * 100
        expected_left = (0.333 * (20/12) + 0.333 * (15/20) + 0.334 * (16/20)) * 100
        assert abs(components["left_muscle_compliance"] - expected_left) < 0.1

        # Right muscle: 150% completion, 78% intensity, 83% duration
        expected_right = (0.333 * (18/12) + 0.333 * (14/18) + 0.334 * (15/18)) * 100
        assert abs(components["right_muscle_compliance"] - expected_right) < 0.1

        # Overall compliance should be average of left and right
        expected_overall = (expected_left + expected_right) / 2
        assert abs(components["overall_compliance"] - expected_overall) < 0.1

    def test_calculate_symmetry_score(self, scoring_service):
        """Test muscle symmetry score calculation"""
        # Perfect symmetry
        symmetry_perfect = scoring_service._calculate_symmetry_score(80.0, 80.0)
        assert symmetry_perfect == 100.0

        # Good asymmetry (10% difference)
        symmetry_good = scoring_service._calculate_symmetry_score(90.0, 80.0)
        expected = (1 - abs(90-80)/(90+80)) * 100  # = (1 - 10/170) * 100 ≈ 94.1%
        assert abs(symmetry_good - expected) < 0.1

        # Poor asymmetry (50% difference)
        symmetry_poor = scoring_service._calculate_symmetry_score(100.0, 50.0)
        expected = (1 - abs(100-50)/(100+50)) * 100  # = (1 - 50/150) * 100 ≈ 66.7%
        assert abs(symmetry_poor - expected) < 0.1

        # Zero performance (edge case)
        symmetry_zero = scoring_service._calculate_symmetry_score(0.0, 0.0)
        assert symmetry_zero == 0.0

    def test_calculate_effort_score_all_rpe_values(self, scoring_service):
        """Test effort score calculation for all RPE values according to metricsDefinitions.md"""
        # Test all RPE mappings from specification
        test_cases = [
            # Optimal range (RPE 4-6): 100%
            (4, 100.0, "c3d_metadata"), (5, 100.0, "c3d_metadata"), (6, 100.0, "c3d_metadata"),
            # Acceptable range (RPE 3, 7): 80%
            (3, 80.0, "c3d_metadata"), (7, 80.0, "c3d_metadata"),
            # Suboptimal range (RPE 2, 8): 60%
            (2, 60.0, "c3d_metadata"), (8, 60.0, "c3d_metadata"),
            # Poor range (RPE 0-1, 9-10): 20%
            (0, 20.0, "c3d_metadata"), (1, 20.0, "c3d_metadata"), (9, 20.0, "c3d_metadata"), (10, 20.0, "c3d_metadata"),
            # None value uses development default
            (None, 100.0, "development_default")  # DevelopmentDefaults.RPE_POST_SESSION = 4 → 100%
        ]

        for rpe, expected_score, expected_source in test_cases:
            effort_score, rpe_source = scoring_service._calculate_effort_score(rpe)
            if expected_score is None:
                assert effort_score is None
            else:
                assert effort_score == expected_score, f"RPE {rpe} should give effort score {expected_score}"
                assert rpe_source == expected_source, f"RPE {rpe} should have source {expected_source}"

    def test_calculate_game_score(self, scoring_service):
        """Test game performance score calculation"""
        # Perfect game performance
        game_perfect = scoring_service._calculate_game_score(100, 100)
        assert game_perfect == 100.0

        # Good game performance
        game_good = scoring_service._calculate_game_score(85, 100)
        assert game_good == 85.0

        # Poor game performance
        game_poor = scoring_service._calculate_game_score(30, 100)
        assert game_poor == 30.0

        # Edge cases
        game_zero_max = scoring_service._calculate_game_score(50, 0)
        assert game_zero_max == 0.0

        game_none = scoring_service._calculate_game_score(None, 100)
        assert game_none is None

        game_max_none = scoring_service._calculate_game_score(50, None)
        assert game_max_none is None

    def test_calculate_bfr_gate(self, scoring_service):
        """Test BFR safety gate calculation"""
        # Compliant BFR pressure (45-55% AOP)
        assert scoring_service._calculate_bfr_gate(45.0) == 1.0
        assert scoring_service._calculate_bfr_gate(50.0) == 1.0
        assert scoring_service._calculate_bfr_gate(55.0) == 1.0

        # Non-compliant BFR pressure (outside 45-55% AOP)
        assert scoring_service._calculate_bfr_gate(44.9) == 0.0
        assert scoring_service._calculate_bfr_gate(55.1) == 0.0
        assert scoring_service._calculate_bfr_gate(30.0) == 0.0
        assert scoring_service._calculate_bfr_gate(70.0) == 0.0

        # No BFR data (non-compliant for safety)
        assert scoring_service._calculate_bfr_gate(None) == 0.0

    @patch("services.clinical.performance_scoring_service.PerformanceScoringService._fetch_session_metrics")
    @patch("services.clinical.performance_scoring_service.PerformanceScoringService._load_scoring_weights_from_database")
    @patch("services.clinical.performance_scoring_service.PerformanceScoringService._load_rpe_mapping_from_database")
    def test_calculate_performance_scores_complete(self, mock_load_rpe, mock_load_weights, mock_fetch_metrics, scoring_service, sample_session_metrics):
        """Test complete performance score calculation with all components"""
        # Setup mocks
        mock_load_weights.return_value = ScoringWeights()  # Use default weights
        mock_load_rpe.return_value = RPEMapping()  # Use default RPE mapping
        mock_fetch_metrics.return_value = sample_session_metrics

        # Calculate scores
        result = scoring_service.calculate_performance_scores("test-session-123")

        # Verify all components are calculated
        assert "overall_score" in result
        assert "compliance_score" in result
        assert "symmetry_score" in result
        assert "effort_score" in result
        assert "game_score" in result
        assert "bfr_compliant" in result

        # Verify score ranges (allowing over-performance scenarios >100% for compliance)
        assert 0 <= result["overall_score"] <= 150, "Overall score should be reasonable (allowing over-performance)"
        assert 0 <= result["compliance_score"] <= 200, "Compliance score can exceed 100% for over-performance (167% completion in sample)"
        assert 0 <= result["symmetry_score"] <= 100, "Symmetry score should be 0-100%"
        assert 0 <= result["effort_score"] <= 100, "Effort score should be 0-100%"
        assert 0 <= result["game_score"] <= 100, "Game score should be 0-100%"

        # Verify BFR compliance
        assert result["bfr_compliant"], "BFR should be compliant with 50% AOP"

        # Verify weights are included for transparency
        assert "weights_used" in result
        weights = result["weights_used"]
        assert weights["w_compliance"] == 0.40
        assert weights["w_symmetry"] == 0.25
        assert weights["w_effort"] == 0.20
        assert weights["w_game"] == 0.15

    def test_calculate_performance_scores_formula_validation(self, scoring_service):
        """Test that the overall performance formula matches metricsDefinitions.md exactly"""
        # Create controlled scenario with known values
        controlled_metrics = SessionMetrics(
            session_id="formula-test",
            left_total_contractions=12, left_mvc_contractions=12, left_duration_contractions=12,
            right_total_contractions=12, right_mvc_contractions=12, right_duration_contractions=12,
            expected_contractions_per_muscle=12,
            bfr_pressure_aop=50.0,  # Compliant
            rpe_post_session=5,     # 100% effort score
            game_points_achieved=80, game_points_max=100,  # 80% game score
            left_good_contractions=12, right_good_contractions=12
        )

        # Mock the methods to return controlled values
        with patch.object(scoring_service, "_fetch_session_metrics", return_value=controlled_metrics):
            with patch.object(scoring_service, "_load_scoring_weights_from_database", return_value=ScoringWeights()):
                with patch.object(scoring_service, "_load_rpe_mapping_from_database", return_value=RPEMapping()):
                    result = scoring_service.calculate_performance_scores("formula-test")

                # Manual calculation according to metricsDefinitions.md:
                # P_overall = w_c × S_compliance + w_s × S_symmetry + w_e × S_effort + w_g × S_game
                #
                # Expected values:
                # S_compliance = 100% (perfect performance) × 1.0 (BFR gate) = 100%
                # S_symmetry = 100% (perfect symmetry)
                # S_effort = 100% (RPE = 5)
                # S_game = 80% (80/100 points)
                #
                # P_overall = 0.40 × 100 + 0.25 × 100 + 0.20 × 100 + 0.15 × 80
                #           = 40 + 25 + 20 + 12 = 97%

                expected_overall = 0.40 * 100 + 0.25 * 100 + 0.20 * 100 + 0.15 * 80
                assert abs(result["overall_score"] - expected_overall) < 0.1, \
                    f"Overall score {result['overall_score']} should match formula calculation {expected_overall}"


class TestScoringWebhookHandler:
    """Test webhook integration for scoring calculations"""

    @pytest.fixture
    def webhook_handler(self):
        """Create webhook handler for testing"""
        return ScoringWebhookHandler()

    @pytest.mark.asyncio
    async def test_process_after_emg_analysis(self, webhook_handler):
        """Test webhook processing after EMG analysis"""
        session_id = "webhook-test-session"

        # Mock the scoring service
        with patch.object(webhook_handler.scoring_service, "calculate_performance_scores") as mock_calculate:
            with patch.object(webhook_handler.scoring_service, "save_performance_scores") as mock_save:
                mock_calculate.return_value = {
                    "session_id": session_id,
                    "overall_score": 85.0,
                    "compliance_score": 90.0,
                    "symmetry_score": 88.0,
                    "effort_score": None,  # Not yet available
                    "game_score": None,    # Not yet available
                }
                mock_save.return_value = True

                result = await webhook_handler.process_after_emg_analysis(session_id)

                assert result["session_id"] == session_id
                assert result["overall_score"] == 85.0
                mock_calculate.assert_called_once_with(session_id)
                mock_save.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_subjective_update(self, webhook_handler):
        """Test webhook processing when subjective data becomes available"""
        session_id = "subjective-test-session"

        with patch.object(webhook_handler.scoring_service, "update_subjective_data") as mock_update:
            mock_update.return_value = {
                "session_id": session_id,
                "overall_score": 92.0,
                "effort_score": 100.0,
                "game_score": 85.0
            }

            result = await webhook_handler.process_subjective_update(
                session_id,
                rpe=5,
                game_data={"points_achieved": 85, "points_max": 100}
            )

            assert result["session_id"] == session_id
            assert result["overall_score"] == 92.0
            mock_update.assert_called_once_with(session_id, 5, 85, 100)


class TestSingleSourceOfTruthValidation:
    """Test that single source of truth is properly implemented"""

    def test_frontend_backend_weight_consistency(self):
        """Test that frontend and backend use same fallback weights"""
        # Backend default weights
        backend_weights = ScoringWeights()

        # These should match the FALLBACK_WEIGHTS in useScoringConfiguration.ts
        expected_weights = {
            "compliance": 0.40,
            "symmetry": 0.25,
            "effort": 0.20,
            "gameScore": 0.15,
            "compliance_completion": 0.333,
            "compliance_intensity": 0.333,
            "compliance_duration": 0.334
        }

        assert backend_weights.w_compliance == expected_weights["compliance"]
        assert backend_weights.w_symmetry == expected_weights["symmetry"]
        assert backend_weights.w_effort == expected_weights["effort"]
        assert backend_weights.w_game == expected_weights["gameScore"]
        assert abs(backend_weights.w_completion - expected_weights["compliance_completion"]) < 0.001
        assert abs(backend_weights.w_intensity - expected_weights["compliance_intensity"]) < 0.001
        assert abs(backend_weights.w_duration - expected_weights["compliance_duration"]) < 0.001

    def test_metrics_definitions_compliance(self):
        """Test that implementation matches metricsDefinitions.md specification exactly"""
        # Create scoring service
        service = PerformanceScoringService()

        # Test RPE mappings match specification
        rpe_mappings = [
            ([4, 5, 6], 100.0),    # Optimal: "comfortable effort"
            ([3, 7], 80.0),        # Acceptable: "slightly too easy/hard"
            ([2, 8], 60.0),        # Suboptimal: "too easy/hard"
            ([0, 1, 9, 10], 20.0)  # Poor: "way too easy/extremely hard"
        ]

        for rpe_values, expected_score in rpe_mappings:
            for rpe in rpe_values:
                score, rpe_source = service._calculate_effort_score(rpe)
                assert score == expected_score, \
                    f"RPE {rpe} should map to {expected_score}% according to metricsDefinitions.md"
                assert rpe_source == "c3d_metadata", f"RPE {rpe} should have c3d_metadata source"

        # Test BFR safety window matches specification
        assert service._calculate_bfr_gate(44.9) == 0.0  # Just outside lower bound
        assert service._calculate_bfr_gate(45.0) == 1.0  # Lower bound inclusive
        assert service._calculate_bfr_gate(55.0) == 1.0  # Upper bound inclusive
        assert service._calculate_bfr_gate(55.1) == 0.0  # Just outside upper bound

        # Test default weights match specification exactly
        default_weights = ScoringWeights()
        assert default_weights.w_compliance == 0.40, "Compliance weight: 40%"
        assert default_weights.w_symmetry == 0.25, "Symmetry weight: 25%"
        assert default_weights.w_effort == 0.20, "Effort weight: 20%"
        assert default_weights.w_game == 0.15, "Game weight: 15%"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
