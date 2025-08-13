"""
Test Enhanced Webhook Service
=============================

Tests for the enhanced webhook service with processing parameters
and performance scoring integration.
"""
import pytest
import uuid
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timezone

# Import the service we're testing
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from ..services.enhanced_webhook_service import (
    EnhancedWebhookService,
    ProcessingParametersData,
    FutureC3DData
)


class TestProcessingParametersData:
    """Test the ProcessingParametersData dataclass"""
    
    def test_default_values(self):
        """Test that default values follow clinical standards"""
        session_id = str(uuid.uuid4())
        params = ProcessingParametersData(
            session_id=session_id,
            sampling_rate_hz=1000.0
        )
        
        # Check clinical defaults
        assert params.filter_low_cutoff_hz == 20.0  # EMG standard
        assert params.filter_high_cutoff_hz == 500.0  # EMG standard
        assert params.filter_order == 4  # Butterworth 4th order
        assert params.rms_window_ms == 50.0  # Clinical standard
        assert params.rms_overlap_percent == 50.0  # Clinical standard
        assert params.mvc_window_seconds == 3.0  # Clinical standard
        assert params.mvc_threshold_percentage == 75.0  # Clinical standard
        assert params.processing_version == "1.0"
    
    def test_custom_values(self):
        """Test that custom values can be set"""
        session_id = str(uuid.uuid4())
        params = ProcessingParametersData(
            session_id=session_id,
            sampling_rate_hz=2000.0,
            filter_low_cutoff_hz=25.0,
            filter_high_cutoff_hz=450.0,
            rms_window_ms=100.0,
            mvc_threshold_percentage=80.0
        )
        
        assert params.sampling_rate_hz == 2000.0
        assert params.filter_low_cutoff_hz == 25.0
        assert params.filter_high_cutoff_hz == 450.0
        assert params.rms_window_ms == 100.0
        assert params.mvc_threshold_percentage == 80.0


class TestFutureC3DData:
    """Test the FutureC3DData dataclass"""
    
    def test_default_none_values(self):
        """Test that future data starts with None values"""
        future_data = FutureC3DData()
        
        assert future_data.rpe_extracted is None
        assert future_data.bfr_pressure_mmhg is None
        assert future_data.bfr_systolic_bp is None
        assert future_data.bfr_diastolic_bp is None
        assert future_data.game_points_achieved is None
        assert future_data.game_points_max is None
        assert future_data.expected_contractions_override is None
        assert future_data.measurement_timestamp is None
    
    def test_future_data_with_values(self):
        """Test future data with actual values"""
        timestamp = datetime.now(timezone.utc)
        future_data = FutureC3DData(
            rpe_extracted=5,
            bfr_pressure_mmhg=120.0,
            bfr_systolic_bp=140.0,
            bfr_diastolic_bp=90.0,
            game_points_achieved=850,
            game_points_max=1000,
            expected_contractions_override=15,
            measurement_timestamp=timestamp
        )
        
        assert future_data.rpe_extracted == 5
        assert future_data.bfr_pressure_mmhg == 120.0
        assert future_data.bfr_systolic_bp == 140.0
        assert future_data.bfr_diastolic_bp == 90.0
        assert future_data.game_points_achieved == 850
        assert future_data.game_points_max == 1000
        assert future_data.expected_contractions_override == 15
        assert future_data.measurement_timestamp == timestamp


@pytest.mark.asyncio
class TestEnhancedWebhookService:
    """Test the EnhancedWebhookService main functionality"""
    
    @pytest.fixture
    def mock_supabase_client(self):
        """Mock Supabase client"""
        mock_client = Mock()
        mock_client.storage.from_.return_value.download.return_value = b"mock_c3d_data"
        mock_client.table.return_value.upsert.return_value.execute.return_value.data = [{"id": "test-id"}]
        mock_client.table.return_value.insert.return_value.execute.return_value.data = [{"id": "test-id"}]
        return mock_client
    
    @pytest.fixture
    def mock_scoring_handler(self):
        """Mock scoring webhook handler"""
        mock_handler = Mock()
        mock_handler.process_after_emg_analysis = AsyncMock(return_value={
            "overall_score": None,  # Pending RPE/game data
            "compliance_score": 75.5,
            "symmetry_score": 80.0,
            "bfr_compliant": True
        })
        return mock_handler
    
    def test_extract_processing_parameters(self, mock_supabase_client):
        """Test processing parameters extraction from C3D result"""
        service = EnhancedWebhookService()
        service.supabase = mock_supabase_client
        
        # Mock processing result with metadata
        processing_result = {
            "metadata": {
                "sampling_rate": 2000.0,
                "channel_names": ["CH1_LEFT", "CH2_RIGHT"]
            },
            "analytics": {
                "CH1_LEFT": {"mvc_peak_value": 0.001},
                "CH2_RIGHT": {"mvc_peak_value": 0.0008}
            }
        }
        
        session_id = str(uuid.uuid4())
        params = service._extract_processing_parameters(processing_result, session_id)
        
        assert params.session_id == session_id
        assert params.sampling_rate_hz == 2000.0
        assert params.filter_high_cutoff_hz <= 800.0  # 80% of Nyquist (1000Hz)
        assert params.processing_version == "1.0"
    
    def test_extract_processing_parameters_nyquist_validation(self, mock_supabase_client):
        """Test that filter high cutoff respects Nyquist frequency"""
        service = EnhancedWebhookService()
        service.supabase = mock_supabase_client
        
        # Low sampling rate that would make 500Hz exceed Nyquist
        processing_result = {
            "metadata": {"sampling_rate": 800.0},
            "analytics": {}
        }
        
        session_id = str(uuid.uuid4())
        params = service._extract_processing_parameters(processing_result, session_id)
        
        # Should be limited to 80% of Nyquist (400Hz * 0.8 = 320Hz)
        assert params.filter_high_cutoff_hz <= 320.0
        assert params.filter_high_cutoff_hz < params.sampling_rate_hz / 2
    
    def test_extract_future_c3d_data(self, mock_supabase_client):
        """Test future C3D data extraction (currently returns defaults)"""
        service = EnhancedWebhookService()
        service.supabase = mock_supabase_client
        
        processing_result = {
            "metadata": {},
            "analytics": {}
        }
        
        future_data = service._extract_future_c3d_data(processing_result)
        
        # Should return default None values (future enhancement placeholder)
        assert future_data.rpe_extracted is None
        assert future_data.bfr_pressure_mmhg is None
        assert future_data.game_points_achieved is None
        assert future_data.expected_contractions_override is None
    
    @patch('services.enhanced_webhook_service.GHOSTLYC3DProcessor')
    @patch('tempfile.NamedTemporaryFile')
    @patch('fastapi.concurrency.run_in_threadpool')
    async def test_process_c3d_from_storage(self, mock_threadpool, mock_tempfile, mock_processor, mock_supabase_client):
        """Test C3D processing from storage"""
        service = EnhancedWebhookService()
        service.supabase = mock_supabase_client
        
        # Setup mocks
        mock_temp_file = Mock()
        mock_temp_file.name = "/tmp/test.c3d"
        mock_tempfile.return_value.__enter__.return_value = mock_temp_file
        
        mock_processor_instance = Mock()
        mock_processor.return_value = mock_processor_instance
        
        mock_threadpool.return_value = {
            "metadata": {"sampling_rate": 1000.0},
            "analytics": {"CH1": {"rms": 0.1}},
            "available_channels": ["CH1"]
        }
        
        # Test processing
        result = await service._process_c3d_from_storage("test-bucket", "test.c3d")
        
        assert "metadata" in result
        assert "analytics" in result
        assert "file_data" in result
        assert "file_size_bytes" in result
        assert "original_filename" in result
        assert result["original_filename"] == "test.c3d"
    
    @patch('services.enhanced_webhook_service.hashlib')
    async def test_calculate_file_hash(self, mock_hashlib, mock_supabase_client):
        """Test file hash calculation"""
        service = EnhancedWebhookService()
        service.supabase = mock_supabase_client
        
        # Setup hash mock
        mock_hash = Mock()
        mock_hash.hexdigest.return_value = "test_hash_123"
        mock_hashlib.sha256.return_value = mock_hash
        
        # Mock storage download
        service.supabase.storage.from_.return_value.download.return_value = b"test_data"
        
        hash_result = await service.calculate_file_hash("test-bucket", "test.c3d")
        
        assert hash_result == "test_hash_123"
        mock_hash.update.assert_called_once_with(b"test_data")
    
    async def test_update_future_data_rpe_only(self, mock_supabase_client):
        """Test updating only RPE data"""
        service = EnhancedWebhookService()
        service.supabase = mock_supabase_client
        service.scoring_handler = Mock()
        service.scoring_handler.process_subjective_update = AsyncMock(return_value={
            "overall_score": 82.5,
            "effort_score": 100.0  # RPE 5 maps to 100%
        })
        
        # Mock database update
        service.supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = Mock()
        
        session_id = str(uuid.uuid4())
        result = await service.update_future_data(session_id=session_id, rpe=5)
        
        assert result["session_id"] == session_id
        assert "rpe_post_session" in result["updated_fields"]
        assert result["scoring_result"]["effort_score"] == 100.0
    
    async def test_update_future_data_game_only(self, mock_supabase_client):
        """Test updating only game data"""
        service = EnhancedWebhookService()
        service.supabase = mock_supabase_client
        service.scoring_handler = Mock()
        service.scoring_handler.process_subjective_update = AsyncMock(return_value={
            "overall_score": 85.0,
            "game_score": 85.0  # 850/1000 = 85%
        })
        
        session_id = str(uuid.uuid4())
        result = await service.update_future_data(
            session_id=session_id,
            game_data={"points_achieved": 850, "points_max": 1000}
        )
        
        assert result["session_id"] == session_id
        assert "game_points_achieved" in result["updated_fields"]
        assert result["scoring_result"]["game_score"] == 85.0
    
    async def test_update_future_data_bfr_only(self, mock_supabase_client):
        """Test updating only BFR data"""
        service = EnhancedWebhookService()
        service.supabase = mock_supabase_client
        service.scoring_handler = Mock()
        service.scoring_handler.process_subjective_update = AsyncMock(return_value={
            "bfr_compliant": True,
            "bfr_pressure_aop": 50.0
        })
        
        # Mock BFR table update
        service.supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = Mock()
        
        session_id = str(uuid.uuid4())
        result = await service.update_future_data(
            session_id=session_id,
            bfr_data={"pressure_aop": 50.0, "cuff_pressure_mmhg": 120.0}
        )
        
        assert result["session_id"] == session_id
        assert "bfr_pressure_aop" in result["updated_fields"]
        assert result["scoring_result"]["bfr_compliant"] is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])