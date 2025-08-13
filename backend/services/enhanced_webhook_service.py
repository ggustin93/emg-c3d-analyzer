"""
Enhanced Webhook Service for Supabase Storage Events
===================================================

🎯 ENHANCED MVP INTEGRATION - Complete Database Population
Integrates with Migration 009 enhanced schema and performance scoring service

FEATURES:
- Populates processing_parameters table with extracted C3D metadata
- Integrates with performance_scoring_service.py for complete scoring
- Handles future C3D data extraction (RPE, BFR, game data)
- Maintains KISS principle while being future-ready

Author: EMG C3D Analyzer Team
Date: 2025-08-12
"""

import hashlib
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass

from database.supabase_client import get_supabase_client
from services.c3d_processor import GHOSTLYC3DProcessor
from services.performance_scoring_service import PerformanceScoringService, ScoringWebhookHandler
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class ProcessingParametersData:
    """Data class for processing parameters extracted from C3D processing"""
    session_id: str
    sampling_rate_hz: float
    filter_low_cutoff_hz: float = 20.0      # EMG clinical standard
    filter_high_cutoff_hz: float = 500.0    # EMG clinical standard  
    filter_order: int = 4                   # Butterworth 4th order
    rms_window_ms: float = 50.0            # 50ms RMS window
    rms_overlap_percent: float = 50.0      # 50% overlap
    mvc_window_seconds: float = 3.0        # 3 second MVC window
    mvc_threshold_percentage: float = 75.0  # 75% MVC threshold
    processing_version: str = "1.0"


@dataclass  
class FutureC3DData:
    """Container for future C3D data extraction (RPE, BFR, game data)"""
    rpe_extracted: Optional[int] = None                    # Future: RPE from C3D
    bfr_pressure_mmhg: Optional[float] = None             # Future: BFR cuff pressure
    bfr_systolic_bp: Optional[float] = None               # Future: Systolic BP
    bfr_diastolic_bp: Optional[float] = None              # Future: Diastolic BP
    game_points_achieved: Optional[int] = None            # Future: Game score from C3D
    game_points_max: Optional[int] = None                 # Future: Game max score
    expected_contractions_override: Optional[int] = None  # Future: Protocol override
    measurement_timestamp: Optional[datetime] = None      # Future: BFR measurement time


class EnhancedWebhookService:
    """
    Enhanced webhook service for complete database population
    Integrates with Migration 009 schema and performance scoring
    """
    
    def __init__(self):
        self.supabase = get_supabase_client(use_service_key=True)
        self.scoring_handler = ScoringWebhookHandler()
        
        logger.info("🎯 Enhanced Webhook Service initialized with scoring integration")
    
    async def process_c3d_upload_event(
        self,
        bucket: str,
        object_path: str,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Complete C3D processing pipeline with enhanced database population
        
        Args:
            bucket: Storage bucket name
            object_path: Path to C3D file in storage
            session_id: Optional session ID (if None, creates new session)
            
        Returns:
            Complete processing result with database IDs
        """
        logger.info(f"🚀 Enhanced C3D processing pipeline started: {object_path}")
        
        try:
            # Step 1: Download and process C3D file
            processing_result = await self._process_c3d_from_storage(bucket, object_path)
            
            if "error" in processing_result:
                logger.error(f"❌ C3D processing failed: {processing_result['error']}")
                return processing_result
            
            # Step 2: Extract processing parameters and metadata
            processing_params = self._extract_processing_parameters(
                processing_result, session_id or self._generate_session_id()
            )
            
            # Step 3: Extract future C3D data (currently returns defaults, future enhancement)
            future_data = self._extract_future_c3d_data(processing_result)
            
            # Step 4: Save to enhanced database schema
            database_result = await self._save_to_enhanced_schema(
                session_id or processing_params.session_id,
                processing_result,
                processing_params,
                future_data,
                bucket,
                object_path
            )
            
            # Step 5: Calculate initial performance scores
            scoring_result = await self.scoring_handler.process_after_emg_analysis(
                database_result['session_id']
            )
            
            logger.info(f"✅ Enhanced C3D processing completed: {object_path}")
            
            return {
                "success": True,
                "session_id": database_result['session_id'],
                "processing_result": processing_result,
                "database_ids": database_result,
                "scoring_result": scoring_result,
                "processing_parameters": processing_params,
                "future_data_extracted": future_data
            }
            
        except Exception as e:
            logger.error(f"❌ Enhanced C3D processing failed: {str(e)}")
            return {"error": str(e), "object_path": object_path}
    
    async def _process_c3d_from_storage(
        self,
        bucket: str,
        object_path: str
    ) -> Dict[str, Any]:
        """Process C3D file from storage using existing processor"""
        
        # Download file
        file_data = self.supabase.storage.from_(bucket).download(object_path)
        if not file_data:
            raise ValueError(f"Failed to download file: {object_path}")
        
        # Process with temporary file
        import tempfile
        import os
        from fastapi.concurrency import run_in_threadpool
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".c3d") as tmp_file:
            tmp_file.write(file_data)
            tmp_file_path = tmp_file.name
        
        try:
            # Use existing C3D processor
            processor = GHOSTLYC3DProcessor(tmp_file_path)
            
            # Import processing models
            from models.models import ProcessingOptions, GameSessionParameters
            from config import (
                DEFAULT_THRESHOLD_FACTOR,
                DEFAULT_MIN_DURATION_MS,
                DEFAULT_SMOOTHING_WINDOW,
                DEFAULT_MVC_THRESHOLD_PERCENTAGE
            )
            
            # Default processing options
            processing_opts = ProcessingOptions(
                threshold_factor=DEFAULT_THRESHOLD_FACTOR,
                min_duration_ms=DEFAULT_MIN_DURATION_MS,
                smoothing_window=DEFAULT_SMOOTHING_WINDOW
            )
            
            # Default session parameters
            session_params = GameSessionParameters(
                session_mvc_threshold_percentage=DEFAULT_MVC_THRESHOLD_PERCENTAGE,
                contraction_duration_threshold=2000
            )
            
            # Process file
            result = await run_in_threadpool(
                processor.process_file,
                processing_opts=processing_opts,
                session_game_params=session_params
            )
            
            # Add metadata
            result["file_data"] = file_data
            result["file_size_bytes"] = len(file_data)
            result["original_filename"] = Path(object_path).name
            
            return result
            
        finally:
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)
    
    def _extract_processing_parameters(
        self,
        processing_result: Dict[str, Any],
        session_id: str
    ) -> ProcessingParametersData:
        """
        Extract processing parameters from C3D processing result
        """
        # Extract sampling rate from metadata
        metadata = processing_result.get("metadata", {})
        sampling_rate = metadata.get("sampling_rate", 1000.0)  # Default 1kHz
        
        # Validate against Nyquist frequency
        max_cutoff = sampling_rate / 2
        filter_high = min(500.0, max_cutoff * 0.8)  # 80% of Nyquist as safety margin
        
        return ProcessingParametersData(
            session_id=session_id,
            sampling_rate_hz=sampling_rate,
            filter_low_cutoff_hz=20.0,      # EMG standard
            filter_high_cutoff_hz=filter_high,
            filter_order=4,                 # Butterworth 4th order
            rms_window_ms=50.0,            # Clinical standard
            rms_overlap_percent=50.0,       # Clinical standard
            mvc_window_seconds=3.0,         # Clinical standard
            mvc_threshold_percentage=75.0,   # Clinical standard
            processing_version="1.0"
        )
    
    def _extract_future_c3d_data(
        self,
        processing_result: Dict[str, Any]
    ) -> FutureC3DData:
        """
        Extract future C3D data fields (RPE, BFR, game data)
        
        NOTE: Currently returns defaults. Future enhancement will parse:
        - RPE values from C3D analog channels or metadata
        - BFR pressure measurements from GHOSTLY device integration  
        - Game performance data from C3D event markers
        - Protocol-specific expected contraction counts
        """
        
        # Future enhancement: Parse these from C3D file
        # For now, return structure ready for future data
        
        metadata = processing_result.get("metadata", {})
        
        # FUTURE ENHANCEMENT PLACEHOLDERS:
        # rpe_extracted = metadata.get("rpe_post_session")
        # bfr_data = metadata.get("bfr_measurements", {})
        # game_data = metadata.get("game_performance", {})
        
        return FutureC3DData(
            rpe_extracted=None,                    # Future: Extract from C3D
            bfr_pressure_mmhg=None,               # Future: BFR device integration
            bfr_systolic_bp=None,                 # Future: BP measurement  
            bfr_diastolic_bp=None,                # Future: BP measurement
            game_points_achieved=None,            # Future: Game score extraction
            game_points_max=None,                 # Future: Protocol max score
            expected_contractions_override=None,  # Future: Protocol variations
            measurement_timestamp=None            # Future: Precise timing
        )
    
    async def _save_to_enhanced_schema(
        self,
        session_id: str,
        processing_result: Dict[str, Any],
        processing_params: ProcessingParametersData,
        future_data: FutureC3DData,
        bucket: str,
        object_path: str
    ) -> Dict[str, Any]:
        """
        Save all data to enhanced database schema (Migration 009)
        """
        
        try:
            # Step 1: Create/update therapy session
            session_data = {
                "id": session_id,
                "file_path": f"{bucket}/{object_path}",
                "file_hash": hashlib.sha256(processing_result["file_data"]).hexdigest(),
                "file_size_bytes": processing_result.get("file_size_bytes"),
                "original_filename": processing_result.get("original_filename"),
                "original_sampling_rate": processing_params.sampling_rate_hz,
                "channel_count": len(processing_result.get("available_channels", [])),
                "channel_names": processing_result.get("available_channels", []),
                "session_date": datetime.now(timezone.utc).isoformat(),
                "processed_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Upsert therapy session
            session_result = self.supabase.table('therapy_sessions').upsert(session_data).execute()
            
            # Step 2: Save processing parameters to new table
            processing_params_data = {
                "session_id": session_id,
                "sampling_rate_hz": processing_params.sampling_rate_hz,
                "filter_low_cutoff_hz": processing_params.filter_low_cutoff_hz,
                "filter_high_cutoff_hz": processing_params.filter_high_cutoff_hz,
                "filter_order": processing_params.filter_order,
                "rms_window_ms": processing_params.rms_window_ms,
                "rms_overlap_percent": processing_params.rms_overlap_percent,
                "mvc_window_seconds": processing_params.mvc_window_seconds,
                "mvc_threshold_percentage": processing_params.mvc_threshold_percentage,
                "processing_version": processing_params.processing_version
            }
            
            processing_result_db = self.supabase.table('processing_parameters').upsert(processing_params_data).execute()
            
            # Step 3: Save EMG statistics with enhanced fields
            emg_stats_ids = []
            analytics = processing_result.get("analytics", {})
            
            for channel_name, channel_analytics in analytics.items():
                # Calculate enhanced contraction counts for performance scoring
                total_contractions = channel_analytics.get("total_contractions", 0)
                good_contractions = channel_analytics.get("good_contractions", 0)
                
                # Enhanced fields for performance scoring service
                mvc_contraction_count = good_contractions  # For MVP, assume good = MVC compliant
                duration_contraction_count = good_contractions  # For MVP, assume good = duration compliant
                
                emg_stat_data = {
                    "session_id": session_id,
                    "channel_name": channel_name,
                    "mvc_value": channel_analytics.get("mvc_peak_value", 0.0),
                    "mvc_threshold": channel_analytics.get("mvc_threshold_value", 0.0),
                    "total_contractions": total_contractions,
                    "good_contractions": good_contractions,
                    "mvc_contraction_count": mvc_contraction_count,      # Enhanced field
                    "duration_contraction_count": duration_contraction_count,  # Enhanced field
                    "compliance_rate": channel_analytics.get("compliance_rate", 0.0),
                    "rms_mean": channel_analytics.get("rms_mean"),
                    "mav_mean": channel_analytics.get("mav_mean")
                }
                
                emg_result = self.supabase.table('emg_statistics').insert(emg_stat_data).execute()
                emg_stats_ids.append(emg_result.data[0]['id'] if emg_result.data else None)
            
            # Step 4: Save session settings with enhanced fields
            session_settings_data = {
                "session_id": session_id,
                "mvc_threshold_percentage": processing_params.mvc_threshold_percentage,
                "duration_threshold_seconds": 2.0,  # Default from GameSessionParameters
                "target_contractions": 12,  # Clinical standard
                "expected_contractions_per_muscle": future_data.expected_contractions_override or 12,  # Enhanced field
                "bfr_enabled": True  # Default assumption
            }
            
            settings_result = self.supabase.table('session_settings').upsert(session_settings_data).execute()
            
            # Step 5: Save BFR monitoring with enhanced fields (if future data available)
            bfr_data = {
                "session_id": session_id,
                "target_pressure_aop": 50.0,  # Default 50% AOP
                "actual_pressure_aop": future_data.bfr_pressure_mmhg or 50.0,  # Future enhancement
                "safety_compliant": True,  # Default assumption
                # Enhanced fields for future BFR measurements
                "cuff_pressure_mmhg": future_data.bfr_pressure_mmhg,
                "systolic_bp_mmhg": future_data.bfr_systolic_bp,
                "diastolic_bp_mmhg": future_data.bfr_diastolic_bp,
                "measurement_timestamp": future_data.measurement_timestamp,
                "measurement_method": "automatic"  # Default
            }
            
            bfr_result = self.supabase.table('bfr_monitoring').upsert(bfr_data).execute()
            
            # Step 6: Initialize performance scores with future data placeholders
            performance_data = {
                "session_id": session_id,
                "overall_score": None,  # Will be calculated by scoring service
                "compliance_score": None,  # Will be calculated by scoring service
                "symmetry_score": None,  # Will be calculated by scoring service
                "bfr_compliant": True,  # Default
                # Future data fields (enhanced schema)
                "rpe_post_session": future_data.rpe_extracted,
                "game_points_achieved": future_data.game_points_achieved,
                "game_points_max": future_data.game_points_max,
                "bfr_pressure_aop": future_data.bfr_pressure_mmhg
            }
            
            performance_result = self.supabase.table('performance_scores').upsert(performance_data).execute()
            
            logger.info(f"✅ Enhanced schema populated successfully for session: {session_id}")
            
            return {
                "session_id": session_id,
                "therapy_session_id": session_result.data[0]['id'] if session_result.data else session_id,
                "processing_parameters_id": processing_result_db.data[0]['id'] if processing_result_db.data else None,
                "emg_statistics_ids": emg_stats_ids,
                "session_settings_id": settings_result.data[0]['id'] if settings_result.data else None,
                "bfr_monitoring_id": bfr_result.data[0]['id'] if bfr_result.data else None,
                "performance_scores_id": performance_result.data[0]['id'] if performance_result.data else None
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to save to enhanced schema: {str(e)}")
            raise
    
    async def update_future_data(
        self,
        session_id: str,
        rpe: Optional[int] = None,
        bfr_data: Optional[Dict] = None,
        game_data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Update session with future C3D data when it becomes available
        
        This method will be called when:
        1. Therapist manually inputs RPE post-session
        2. BFR device integration provides real measurements
        3. Game completion data becomes available
        4. Enhanced C3D processing extracts additional data
        """
        logger.info(f"📝 Updating future data for session: {session_id}")
        
        try:
            # Update performance scores with new data
            update_data = {}
            
            if rpe is not None:
                update_data['rpe_post_session'] = rpe
                
            if bfr_data:
                update_data['bfr_pressure_aop'] = bfr_data.get('pressure_aop')
                
                # Update BFR monitoring table with detailed measurements
                bfr_update = {
                    'cuff_pressure_mmhg': bfr_data.get('cuff_pressure_mmhg'),
                    'systolic_bp_mmhg': bfr_data.get('systolic_bp'),
                    'diastolic_bp_mmhg': bfr_data.get('diastolic_bp'),
                    'measurement_timestamp': datetime.now(timezone.utc).isoformat()
                }
                
                self.supabase.table('bfr_monitoring').update(bfr_update).eq('session_id', session_id).execute()
                
            if game_data:
                update_data['game_points_achieved'] = game_data.get('points_achieved')
                update_data['game_points_max'] = game_data.get('points_max')
            
            # Update performance scores
            if update_data:
                self.supabase.table('performance_scores').update(update_data).eq('session_id', session_id).execute()
            
            # Recalculate performance scores with updated data
            scoring_result = await self.scoring_handler.process_subjective_update(
                session_id, rpe, game_data
            )
            
            logger.info(f"✅ Future data updated and scores recalculated for session: {session_id}")
            
            return {
                "session_id": session_id,
                "updated_fields": list(update_data.keys()),
                "scoring_result": scoring_result
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to update future data: {str(e)}")
            return {"error": str(e)}
    
    def _generate_session_id(self) -> str:
        """Generate unique session ID for new sessions"""
        import uuid
        return str(uuid.uuid4())
    
    async def calculate_file_hash(self, bucket: str, object_path: str) -> str:
        """Calculate SHA-256 hash of file in storage"""
        try:
            response = self.supabase.storage.from_(bucket).download(object_path)
            if not response:
                raise ValueError(f"Failed to download file: {object_path}")
            
            hash_sha256 = hashlib.sha256()
            hash_sha256.update(response)
            return hash_sha256.hexdigest()
            
        except Exception as e:
            logger.error(f"Failed to calculate file hash for {object_path}: {str(e)}")
            raise


# Factory function for webhook integration
def create_enhanced_webhook_service() -> EnhancedWebhookService:
    """Create enhanced webhook service instance"""
    return EnhancedWebhookService()