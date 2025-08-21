"""
Therapy Session Processor - Workflow Orchestrator
================================================

🎯 PURPOSE: Complete C3D processing pipeline orchestration
- Manages end-to-end therapy session lifecycle from upload to analytics
- Coordinates file download, C3D processing, and database population
- Orchestrates multiple services to create complete session records

🔗 RESPONSIBILITIES:
- Create therapy session database records
- Download C3D files from Supabase Storage
- Orchestrate EMG analysis via c3d_processor.py
- Populate ALL related database tables (emg_statistics, c3d_technical_data, etc.)
- Update session status and analytics cache
- Extract and store session timestamps (C3D TIME field)

📊 OUTPUT: Complete therapy session with full database population

⚠️ NOTE: This service is intentionally comprehensive for webhook processing.
For individual operations, use the specific services directly.

Author: EMG C3D Analyzer Team
Date: 2025-08-14
"""

import hashlib
import logging
import tempfile
import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from uuid import UUID, uuid4

from database.supabase_client import get_supabase_client
from services.c3d.processor import GHOSTLYC3DProcessor
from services.c3d.reader import C3DReader
from .performance_scoring_service import PerformanceScoringService, SessionMetrics
from models.models import ProcessingOptions, GameSessionParameters
from config import (
    DEFAULT_THRESHOLD_FACTOR,
    DEFAULT_MIN_DURATION_MS, 
    DEFAULT_SMOOTHING_WINDOW,
    DEFAULT_MVC_THRESHOLD_PERCENTAGE,
    DEFAULT_LOWPASS_CUTOFF,
    DEFAULT_FILTER_ORDER,
    DEFAULT_RMS_WINDOW_MS,
    PROCESSING_VERSION
)

logger = logging.getLogger(__name__)


class TherapySessionProcessor:
    """
    Core processor for therapy sessions and C3D file analysis.
    
    Manages the complete lifecycle:
    1. Create therapy_sessions record
    2. Process C3D file 
    3. Populate related tables (emg_statistics, c3d_technical_data, etc.)
    4. Calculate performance scores
    5. Update session with results
    """
    
    def __init__(self):
        self.supabase = get_supabase_client(use_service_key=True)
        self.c3d_reader = C3DReader()
        self.scoring_service = PerformanceScoringService(self.supabase)
    
    async def create_session(
        self,
        file_path: str,
        file_metadata: Dict[str, Any],
        patient_id: Optional[str] = None,
        therapist_id: Optional[str] = None
    ) -> str:
        """
        Create new therapy session record
        
        Args:
            file_path: Storage path to C3D file
            file_metadata: File metadata from storage
            patient_id: Optional patient ID
            therapist_id: Optional therapist ID
            
        Returns:
            str: Created session UUID
        """
        try:
            # Generate file hash for deduplication
            file_hash = await self._calculate_file_hash_from_path(file_path)
            
            # Check for existing session with same file hash
            existing = await self._find_existing_session(file_hash)
            if existing:
                logger.info(f"♻️ Found existing session: {existing['id']}")
                return str(existing['id'])
            
            session_data = {
                "id": str(uuid4()),
                "file_path": file_path,
                "file_hash": file_hash,
                "file_size_bytes": file_metadata.get("size", 0),
                "patient_id": patient_id,
                "therapist_id": therapist_id,
                "processing_status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "analytics_cache": {},
                "game_metadata": {}
            }
            
            result = self.supabase.table("therapy_sessions").insert(session_data).execute()
            
            if not result.data:
                raise Exception("Failed to create therapy session")
            
            session_id = result.data[0]["id"]
            logger.info(f"✅ Created therapy session: {session_id}")
            
            return session_id
            
        except Exception as e:
            logger.error(f"Failed to create session: {str(e)}", exc_info=True)
            raise
    
    async def process_c3d_file(
        self,
        session_id: str,
        bucket: str,
        object_path: str
    ) -> Dict[str, Any]:
        """
        Complete C3D file processing
        
        Args:
            session_id: Therapy session UUID
            bucket: Storage bucket name  
            object_path: Path to C3D file in storage
            
        Returns:
            Dict with processing results
        """
        try:
            # Download C3D file
            file_data = await self._download_file(bucket, object_path)
            
            # Save to temporary file for processing
            with tempfile.NamedTemporaryFile(delete=False, suffix=".c3d") as tmp_file:
                tmp_file.write(file_data)
                tmp_file_path = tmp_file.name
            
            try:
                # Process C3D file
                processor = GHOSTLYC3DProcessor(tmp_file_path)
                
                # Default processing options
                processing_opts = ProcessingOptions(
                    threshold_factor=DEFAULT_THRESHOLD_FACTOR,
                    min_duration_ms=DEFAULT_MIN_DURATION_MS,
                    smoothing_window=DEFAULT_SMOOTHING_WINDOW
                )
                
                session_params = GameSessionParameters(
                    session_mvc_threshold_percentage=DEFAULT_MVC_THRESHOLD_PERCENTAGE
                )
                
                # Process file
                result = processor.process_file(
                    processing_opts=processing_opts,
                    session_game_params=session_params
                )
                
                # Populate database tables
                await self._populate_database_tables(
                    session_id=session_id,
                    processing_result=result,
                    file_data=file_data,
                    processing_opts=processing_opts
                )
                
                # Update session with analytics cache and game metadata
                await self._update_session_cache(session_id, result)
                await self._update_session_metadata(session_id, result)
                
                return {
                    "success": True,
                    "channels_analyzed": len(result.get("analytics", {})),
                    "overall_score": self._calculate_overall_score(result),
                    "processing_result": result
                }
                
            finally:
                # Clean up temporary file
                if os.path.exists(tmp_file_path):
                    os.unlink(tmp_file_path)
                    
        except Exception as e:
            logger.error(f"C3D processing failed: {str(e)}", exc_info=True)
            return {"success": False, "error": str(e)}
    
    async def update_session_status(
        self,
        session_id: str,
        status: str,
        error_message: Optional[str] = None
    ) -> None:
        """
        Update therapy session processing status
        
        Args:
            session_id: Session UUID
            status: New status (pending, processing, completed, failed)
            error_message: Optional error message if status is failed
        """
        try:
            update_data = {
                "processing_status": status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            if status == "completed":
                update_data["processed_at"] = datetime.now(timezone.utc).isoformat()
            elif status == "failed" and error_message:
                update_data["processing_error_message"] = error_message
            
            self.supabase.table("therapy_sessions").update(update_data).eq("id", session_id).execute()
            
            logger.info(f"📊 Session {session_id} status: {status}")
            
        except Exception as e:
            logger.error(f"Failed to update session status: {str(e)}", exc_info=True)
            raise
    
    async def get_session_status(self, session_id: str) -> Optional[Dict]:
        """
        Get therapy session status and data
        
        Args:
            session_id: Session UUID
            
        Returns:
            Session data or None if not found
        """
        try:
            result = self.supabase.table("therapy_sessions").select("*").eq("id", session_id).execute()
            
            if result.data:
                return result.data[0]
            return None
            
        except Exception as e:
            logger.error(f"Failed to get session status: {str(e)}", exc_info=True)
            return None
    
    # === PRIVATE METHODS ===
    
    async def _calculate_file_hash_from_path(self, file_path: str) -> str:
        """Calculate SHA-256 hash of file from storage path"""
        try:
            # Extract bucket and object path
            parts = file_path.split("/", 1)
            if len(parts) != 2:
                raise ValueError(f"Invalid file path format: {file_path}")
            
            bucket, object_path = parts
            file_data = await self._download_file(bucket, object_path)
            
            return hashlib.sha256(file_data).hexdigest()
            
        except Exception as e:
            logger.error(f"Failed to calculate file hash: {str(e)}")
            # Fallback to path-based hash for uniqueness
            return hashlib.sha256(file_path.encode()).hexdigest()
    
    async def _download_file(self, bucket: str, object_path: str) -> bytes:
        """Download file from Supabase Storage"""
        try:
            response = self.supabase.storage.from_(bucket).download(object_path)
            
            if not response:
                raise ValueError(f"Failed to download: {bucket}/{object_path}")
            
            return response
            
        except Exception as e:
            logger.error(f"Download failed: {str(e)}")
            raise
    
    async def _find_existing_session(self, file_hash: str) -> Optional[Dict]:
        """Find existing session with same file hash"""
        try:
            result = self.supabase.table("therapy_sessions").select("*").eq("file_hash", file_hash).execute()
            
            if result.data:
                return result.data[0]
            return None
            
        except Exception as e:
            logger.error(f"Error finding existing session: {str(e)}")
            return None
    
    async def _populate_database_tables(
        self,
        session_id: str,
        processing_result: Dict[str, Any],
        file_data: bytes,
        processing_opts: ProcessingOptions
    ) -> None:
        """
        Populate all related database tables
        
        Tables populated:
        - c3d_technical_data
        - emg_statistics (per channel)
        - processing_parameters  
        - performance_scores
        """
        try:
            # C3D Technical Data
            metadata = processing_result.get("metadata", {})
            technical_data = {
                "session_id": session_id,
                "original_sampling_rate": metadata.get("sampling_rate", 1000.0),
                "original_duration_seconds": metadata.get("duration_seconds", 0.0),
                "original_sample_count": metadata.get("frame_count", 0),
                "channel_count": len(processing_result.get("analytics", {})),
                "channel_names": list(processing_result.get("analytics", {}).keys()),
                "sampling_rate": metadata.get("sampling_rate", 1000.0),
                "duration_seconds": metadata.get("duration_seconds", 0.0),
                "frame_count": metadata.get("frame_count", 0),
                "extracted_at": datetime.now(timezone.utc).isoformat()
            }
            
            await self._upsert_table("c3d_technical_data", technical_data, "session_id")
            
            # EMG Statistics (per channel)
            analytics = processing_result.get("analytics", {})
            for channel_name, channel_data in analytics.items():
                # Use default clinical values when not available from C3D metadata
                DEFAULT_MVC_THRESHOLD_VALUE = 1e-5  # 10μV - reasonable EMG threshold
                DEFAULT_MVC_VALUE = channel_data.get("mvc_threshold", DEFAULT_MVC_THRESHOLD_VALUE) / 0.75  # Reverse calculate from 75%
                
                # Extract temporal statistics from nested data structures
                rms_stats = channel_data.get("rms_temporal_stats", {})
                mav_stats = channel_data.get("mav_temporal_stats", {})
                mpf_stats = channel_data.get("mpf_temporal_stats", {})
                mdf_stats = channel_data.get("mdf_temporal_stats", {})
                fatigue_stats = channel_data.get("fatigue_index_temporal_stats", {})
                
                stats_data = {
                    "session_id": session_id,
                    "channel_name": channel_name,
                    "total_contractions": channel_data.get("contraction_count", 0),
                    "good_contractions": channel_data.get("good_contraction_count", 0),
                    "mvc_contraction_count": channel_data.get("mvc_contraction_count", 0),
                    "duration_contraction_count": channel_data.get("duration_contraction_count", 0),
                    "compliance_rate": channel_data.get("compliance_rate", 0.0),
                    "mvc_value": channel_data.get("mvc_value", DEFAULT_MVC_VALUE),
                    "mvc_threshold": max(channel_data.get("mvc_threshold", DEFAULT_MVC_THRESHOLD_VALUE), DEFAULT_MVC_THRESHOLD_VALUE),
                    "mvc_threshold_actual_value": 75.0,  # Default 75% MVC threshold
                    "duration_threshold_actual_value": 2000.0,  # Default 2 seconds duration threshold  
                    "total_time_under_tension_ms": channel_data.get("total_time_under_tension_ms", 0.0),
                    "avg_duration_ms": channel_data.get("avg_duration_ms", 0.0),
                    "max_duration_ms": channel_data.get("max_duration_ms", 0.0),
                    "min_duration_ms": channel_data.get("min_duration_ms", 0.0),
                    "avg_amplitude": channel_data.get("avg_amplitude", 0.0),
                    "max_amplitude": channel_data.get("max_amplitude", 0.0),
                    
                    # RMS temporal statistics
                    "rms_mean": rms_stats.get("mean_value", 0.0),
                    "rms_std": rms_stats.get("std_value", 0.0),
                    
                    # MAV temporal statistics 
                    "mav_mean": mav_stats.get("mean_value"),
                    "mav_std": mav_stats.get("std_value"),
                    
                    # MPF temporal statistics
                    "mpf_mean": mpf_stats.get("mean_value"),
                    "mpf_std": mpf_stats.get("std_value"),
                    
                    # MDF temporal statistics  
                    "mdf_mean": mdf_stats.get("mean_value"),
                    "mdf_std": mdf_stats.get("std_value"),
                    
                    # Fatigue index temporal statistics
                    "fatigue_index_mean": fatigue_stats.get("mean_value"),
                    "fatigue_index_std": fatigue_stats.get("std_value"),
                    
                    # Individual fatigue metrics (from single-window analysis)
                    "fatigue_index_fi_nsm5": channel_data.get("fatigue_index_fi_nsm5"),
                    
                    # Quality metrics
                    "signal_quality_score": channel_data.get("signal_quality_score", 0.0),
                    "processing_confidence": channel_data.get("processing_confidence", 0.0),
                    
                    # Additional clinical metrics (placeholders for future implementation)
                    "median_frequency_slope": None,  # Requires trend analysis across time windows
                    "estimated_fatigue_percentage": None,  # Requires baseline comparison
                    
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                
                # Insert EMG statistics record
                self.supabase.table("emg_statistics").insert(stats_data).execute()
            
            # Processing Parameters - Use config values
            # Get actual sampling rate from metadata
            sampling_rate = metadata.get("sampling_rate", 1000.0)
            
            # Calculate Nyquist-compliant high cutoff (must be < sampling_rate/2)
            # Use 90% of Nyquist frequency to safely satisfy the constraint
            nyquist_freq = sampling_rate / 2
            safe_high_cutoff = min(DEFAULT_LOWPASS_CUTOFF, nyquist_freq * 0.9)
            
            params_data = {
                "session_id": session_id,
                "sampling_rate_hz": sampling_rate,
                "filter_low_cutoff_hz": 20.0,  # Standard EMG high-pass
                "filter_high_cutoff_hz": safe_high_cutoff,  # Nyquist-compliant
                "filter_order": DEFAULT_FILTER_ORDER,  # From config.py
                "rms_window_ms": DEFAULT_RMS_WINDOW_MS,  # From config.py
                "rms_overlap_percent": 50.0,
                "mvc_window_seconds": 3.0,
                "mvc_threshold_percentage": processing_opts.threshold_factor * 100,
                "processing_version": PROCESSING_VERSION,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            self.supabase.table("processing_parameters").insert(params_data).execute()
            
            # Performance Scores using dedicated service (GHOSTLY+ compliant)
            await self._calculate_and_save_performance_scores(session_id, analytics, processing_result)
            
            logger.info(f"📊 Populated all database tables for session: {session_id}")
            
        except Exception as e:
            logger.error(f"Failed to populate database tables: {str(e)}", exc_info=True)
            raise
    
    async def _upsert_table(self, table_name: str, data: Dict, unique_key: str) -> None:
        """Upsert data into table (insert or update if exists)"""
        try:
            # Try insert first
            result = self.supabase.table(table_name).insert(data).execute()
            
            if not result.data:
                # If insert failed, try update
                unique_value = data[unique_key]
                self.supabase.table(table_name).update(data).eq(unique_key, unique_value).execute()
                
        except Exception as e:
            # If insert failed due to unique constraint, try update
            unique_value = data[unique_key]
            self.supabase.table(table_name).update(data).eq(unique_key, unique_value).execute()
    
    async def _calculate_and_save_performance_scores(
        self, 
        session_id: str, 
        analytics: Dict, 
        processing_result: Dict
    ) -> None:
        """
        Calculate and save performance scores using the dedicated GHOSTLY+ scoring service
        
        This method properly uses the existing performance_scoring_service.py to maintain
        DRY, SOLID, and KISS principles.
        """
        try:
            # Extract metrics from analytics for CH1 (left) and CH2 (right)
            left_data = analytics.get("CH1", {})
            right_data = analytics.get("CH2", {})
            
            # Create SessionMetrics object for the scoring service
            session_metrics = SessionMetrics(
                session_id=session_id,
                
                # Left muscle (CH1) metrics
                left_total_contractions=left_data.get("contraction_count", 0),
                left_good_contractions=left_data.get("good_contraction_count", 0),
                left_mvc_contractions=left_data.get("mvc_contraction_count", 0),
                left_duration_contractions=left_data.get("duration_contraction_count", 0),
                
                # Right muscle (CH2) metrics  
                right_total_contractions=right_data.get("contraction_count", 0),
                right_good_contractions=right_data.get("good_contraction_count", 0),
                right_mvc_contractions=right_data.get("mvc_contraction_count", 0),
                right_duration_contractions=right_data.get("duration_contraction_count", 0),
                
                # Default clinical values (can be updated later via API)
                bfr_pressure_aop=50.0,  # Default 50% AOP
                bfr_compliant=True,
                rpe_post_session=4,  # Default RPE=4 (optimal range) with FAKE flag
                
                # Game data from C3D metadata (if available)
                game_points_achieved=processing_result.get("metadata", {}).get("game_points_achieved"),
                game_points_max=processing_result.get("metadata", {}).get("game_points_max"),
                
                expected_contractions_per_muscle=12  # GHOSTLY+ protocol expectation
            )
            
            # Use the dedicated service to calculate scores
            scores = self.scoring_service.calculate_performance_scores(
                session_id, session_metrics
            )
            
            if scores and 'error' not in scores:
                # Save scores using the service
                success = self.scoring_service.save_performance_scores(scores)
                if success:
                    logger.info(f"✅ GHOSTLY+ performance scores calculated and saved for session: {session_id}")
                    logger.info(f"   Overall: {scores.get('overall_score', 'N/A')}, Compliance: {scores.get('compliance_score', 'N/A')}")
                else:
                    logger.error(f"❌ Failed to save performance scores for session: {session_id}")
            else:
                logger.error(f"❌ Failed to calculate performance scores: {scores}")
                
        except Exception as e:
            logger.error(f"Failed to calculate performance scores: {str(e)}", exc_info=True)
            # Not critical for C3D processing, continue without failing
    
    async def _update_session_cache(self, session_id: str, processing_result: Dict) -> None:
        """Update session analytics cache"""
        try:
            cache_data = {
                "analytics_cache": {
                    "channels": list(processing_result.get("analytics", {}).keys()),
                    "summary": {
                        "total_channels": len(processing_result.get("analytics", {})),
                        "overall_compliance": self._calculate_compliance_score(processing_result.get("analytics", {})),
                        "cached_at": datetime.now(timezone.utc).isoformat()
                    }
                },
                "processing_time_ms": processing_result.get("processing_time_ms", 0),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            self.supabase.table("therapy_sessions").update(cache_data).eq("id", session_id).execute()
            
        except Exception as e:
            logger.error(f"Failed to update session cache: {str(e)}")
            # Not critical, continue processing
    
    async def _update_session_metadata(self, session_id: str, processing_result: Dict) -> None:
        """Update session with extracted game metadata and session timestamp"""
        try:
            metadata = processing_result.get("metadata", {})
            
            # Extract session timestamp from C3D metadata
            session_timestamp = None
            if "time" in metadata:
                try:
                    # Parse the timestamp from C3D (format: 'YYYY-MM-DD HH:MM:SS')
                    parsed_dt = datetime.strptime(metadata["time"], "%Y-%m-%d %H:%M:%S")
                    # Convert to UTC timezone for consistency
                    session_timestamp = parsed_dt.replace(tzinfo=timezone.utc).isoformat()
                except (ValueError, TypeError) as e:
                    logger.warning(f"Failed to parse session timestamp '{metadata.get('time')}': {str(e)}")
            
            # Update session with metadata
            update_data = {
                "game_metadata": metadata,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Add session_date if we successfully parsed the timestamp
            if session_timestamp:
                update_data["session_date"] = session_timestamp
                logger.info(f"📅 Extracted session timestamp: {session_timestamp}")
            
            self.supabase.table("therapy_sessions").update(update_data).eq("id", session_id).execute()
            
            logger.info(f"📊 Updated session metadata for: {session_id}")
            
        except Exception as e:
            logger.error(f"Failed to update session metadata: {str(e)}")
            # Not critical, continue processing
    
