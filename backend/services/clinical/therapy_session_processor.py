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
from typing import Dict, Any, Optional, List, Union, Tuple
from uuid import UUID, uuid4

# Custom Exception Classes for Better Error Handling
class TherapySessionError(Exception):
    """Base exception for therapy session processing errors"""
    pass

class DatabaseOperationError(TherapySessionError):
    """Raised when database operations fail"""
    pass

class FileProcessingError(TherapySessionError):
    """Raised when C3D file processing fails"""
    pass

class SessionNotFoundError(TherapySessionError):
    """Raised when a session cannot be found"""
    pass

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
    DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS,
    PROCESSING_VERSION,
    # Clinical Constants
    DEFAULT_MVC_THRESHOLD_VALUE,
    MVC_PERCENTAGE_DIVISOR,
    EMG_HIGH_PASS_CUTOFF,
    RMS_OVERLAP_PERCENTAGE,
    MVC_WINDOW_SECONDS,
    NYQUIST_SAFETY_FACTOR,
    EXPECTED_CONTRACTIONS_PER_MUSCLE,
    # Development Defaults
    DevelopmentDefaults
)

# Note: All clinical constants now imported from config.py (Single Source of Truth)

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
    
    def __init__(self) -> None:
        """
        Initializes the processor with Supabase client and specialized services.
        - `use_service_key=True` grants admin privileges for backend operations.
        """
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
        Creates a new therapy session record, ensuring data integrity.

        This method generates a unique file hash to prevent duplicate session
        entries for the same C3D file, making the process idempotent.

        Args:
            file_path: Storage path to the C3D file (e.g., "bucket/file.c3d").
            file_metadata: Metadata from Supabase Storage (e.g., size).
            patient_id: Optional UUID of the patient.
            therapist_id: Optional UUID of the therapist.

        Returns:
            The UUID of the created or existing therapy session.

        Raises:
            DatabaseOperationError: If the session creation fails in the database.
            ValueError: If input parameters are invalid.
        """
        try:
            # Validate input parameters
            self._validate_session_creation_params(file_path, file_metadata, patient_id, therapist_id)
            
            # Generate a unique hash of the file content for deduplication.
            # This makes session creation idempotent.
            file_hash = await self._calculate_file_hash_from_path(file_path)
            
            # Check for an existing session to avoid reprocessing the same file.
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
                raise ValueError("Failed to create therapy session - no data returned from database")
            
            session_id = result.data[0]["id"]
            logger.info(f"✅ Created therapy session: {session_id}")
            
            return session_id
            
        except Exception as e:
            logger.error(f"Failed to create session: {str(e)}", exc_info=True)
            raise DatabaseOperationError(f"Session creation failed: {str(e)}") from e
    
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
            # Validate input parameters
            self._validate_processing_params(session_id, bucket, object_path)
            
            # Get session configuration
            session_info, patient_id, duration_threshold = await self._prepare_session_config(session_id)
            
            # Download and process file with resource management
            return await self._process_file_with_cleanup(session_id, bucket, object_path, duration_threshold)
                
        except FileProcessingError:
            raise  # Re-raise file processing errors
        except DatabaseOperationError:
            raise  # Re-raise database errors
                    
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
            raise DatabaseOperationError(f"Session status update failed: {str(e)}") from e
    
    def process_c3d_file_stateless(
        self,
        file_path: str,
        processing_opts: ProcessingOptions,
        session_params: GameSessionParameters
    ) -> Dict[str, Any]:
        """
        Process C3D file without database operations (for upload route)
        
        SINGLE SOURCE OF TRUTH: Uses same processing logic as webhook route
        but without database persistence.
        
        Args:
            file_path: Path to C3D file
            processing_opts: Processing options
            session_params: Session parameters
            
        Returns:
            Processing result dictionary
        """
        try:
            self._validate_stateless_processing_params(file_path, processing_opts, session_params)
            
            # Use SAME processor as webhook route (SINGLE SOURCE OF TRUTH)
            processor = GHOSTLYC3DProcessor(file_path)
            result = processor.process_file(
                processing_opts=processing_opts,
                session_game_params=session_params
            )
            
            return {
                "success": True,
                "processing_result": result,
                "channels_analyzed": len(result.get("analytics", {})),
                "overall_score": self._calculate_overall_score(result)
            }
            
        except Exception as e:
            logger.error(f"Stateless C3D processing failed: {str(e)}", exc_info=True)
            raise FileProcessingError(f"C3D processing failed: {str(e)}") from e
    
    def _validate_stateless_processing_params(
        self, 
        file_path: str, 
        processing_opts: ProcessingOptions, 
        session_params: GameSessionParameters
    ) -> None:
        """Validate parameters for stateless processing"""
        if not file_path or not file_path.strip():
            raise ValueError("File path cannot be empty")
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"C3D file not found: {file_path}")
        
        if not processing_opts:
            raise ValueError("Processing options are required")
        
        if not session_params:
            raise ValueError("Session parameters are required")
    
    async def get_session_status(self, session_id: str) -> Optional[Dict[str, Any]]:
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
    
    # Input Validation Methods
    def _validate_session_creation_params(
        self, 
        file_path: str, 
        file_metadata: Dict[str, Any], 
        patient_id: Optional[str], 
        therapist_id: Optional[str]
    ) -> None:
        """Validate session creation parameters"""
        if not file_path or not file_path.strip():
            raise ValueError("File path cannot be empty")
        
        if not isinstance(file_metadata, dict):
            raise ValueError("File metadata must be a dictionary")
        
        if patient_id is not None and not isinstance(patient_id, str):
            raise ValueError("Patient ID must be a string or None")
        
        if therapist_id is not None and not isinstance(therapist_id, str):
            raise ValueError("Therapist ID must be a string or None")
    
    def _validate_processing_params(self, session_id: str, bucket: str, object_path: str) -> None:
        """Validate C3D processing parameters"""
        if not session_id or not session_id.strip():
            raise ValueError("Session ID cannot be empty")
        
        if not bucket or not bucket.strip():
            raise ValueError("Bucket name cannot be empty")
        
        if not object_path or not object_path.strip():
            raise ValueError("Object path cannot be empty")
    
    # Session Configuration Methods
    async def _prepare_session_config(self, session_id: str) -> Tuple[Optional[Dict], Optional[str], float]:
        """
        Fetches all necessary configuration for a processing session.

        Retrieves the session record and determines the patient-specific
        therapeutic duration threshold, falling back to a system default if
        no specific configuration is found.

        Returns:
            A tuple containing the session info dictionary, patient ID, and
            the duration threshold in milliseconds.
        """
        session_info = await self.get_session_status(session_id)
        if not session_info:
            raise SessionNotFoundError(f"Session not found: {session_id}")
        
        patient_id = session_info.get("patient_id")
        duration_threshold = await self._get_patient_duration_threshold(patient_id)
        
        return session_info, patient_id, duration_threshold
    
    async def _process_file_with_cleanup(
        self, 
        session_id: str, 
        bucket: str, 
        object_path: str, 
        duration_threshold: float
    ) -> Dict[str, Any]:
        """Process C3D file with proper resource cleanup"""
        # Download C3D file
        file_data = await self._download_file(bucket, object_path)
        
        # Use context manager for temporary file handling
        with tempfile.NamedTemporaryFile(delete=False, suffix=".c3d") as tmp_file:
            tmp_file.write(file_data)
            tmp_file_path = tmp_file.name
        
        try:
            # Create processing configuration
            processing_opts, session_params = self._create_processing_config(duration_threshold)
            
            # Process C3D file
            processor = GHOSTLYC3DProcessor(tmp_file_path)
            result = processor.process_file(
                processing_opts=processing_opts,
                session_game_params=session_params
            )
            
            # Populate database tables
            await self._populate_database_tables(
                session_id=session_id,
                processing_result=result,
                file_data=file_data,
                processing_opts=processing_opts,
                session_params=session_params
            )
            
            # Update session with results
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
            self._cleanup_temp_file(tmp_file_path)
    
    def _create_processing_config(self, duration_threshold: float) -> Tuple[ProcessingOptions, GameSessionParameters]:
        """Create processing configuration objects"""
        processing_opts = ProcessingOptions(
            threshold_factor=DEFAULT_THRESHOLD_FACTOR,
            min_duration_ms=DEFAULT_MIN_DURATION_MS,
            smoothing_window=DEFAULT_SMOOTHING_WINDOW
        )
        
        session_params = GameSessionParameters(
            session_mvc_threshold_percentage=DEFAULT_MVC_THRESHOLD_PERCENTAGE,
            contraction_duration_threshold=duration_threshold  # Patient-specific from database
        )
        
        return processing_opts, session_params
    
    def _cleanup_temp_file(self, file_path: str) -> None:
        """Safely clean up temporary files"""
        try:
            if os.path.exists(file_path):
                os.unlink(file_path)
                logger.debug(f"🗑️ Cleaned up temporary file: {file_path}")
        except OSError as e:
            logger.warning(f"Failed to clean up temporary file {file_path}: {e}")
    
    async def _get_patient_duration_threshold(self, patient_id: Optional[str]) -> float:
        """
        Get patient-specific duration threshold from database
        
        Args:
            patient_id: Optional patient ID
            
        Returns:
            float: Duration threshold in milliseconds (patient-specific or config default)
        """
        try:
            if patient_id:
                # Query patient profile for custom duration threshold
                result = self.supabase.table("patient_profiles").select(
                    "therapeutic_duration_threshold_ms"
                ).eq("patient_id", patient_id).execute()
                
                if result.data and result.data[0].get("therapeutic_duration_threshold_ms"):
                    threshold = result.data[0]["therapeutic_duration_threshold_ms"]
                    logger.info(f"📊 Using patient-specific duration threshold: {threshold}ms for patient {patient_id}")
                    return float(threshold)
            
            # Fallback to config default
            logger.info(f"📊 Using config default duration threshold: {DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS}ms")
            return float(DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS)
            
        except Exception as e:
            logger.error(f"Error retrieving patient duration threshold: {str(e)}")
            logger.info(f"📊 Fallback to config default: {DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS}ms")
            return float(DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS)
    
    async def _calculate_file_hash_from_path(self, file_path: str) -> str:
        """Calculate SHA-256 hash of file from storage path"""
        try:
            # Extract bucket and object path from the full file_path string.
            parts = file_path.split("/", 1)
            if len(parts) != 2:
                raise ValueError(f"Invalid file path format: {file_path}")
            
            bucket, object_path = parts
            file_data = await self._download_file(bucket, object_path)
            
            return hashlib.sha256(file_data).hexdigest()
            
        except Exception as e:
            logger.error(f"Failed to calculate file hash: {str(e)}")
            # Fallback: If file download or hashing fails, hash the file path
            # itself. This provides a less robust but still unique identifier
            # to prevent duplicate processing from the same path.
            return hashlib.sha256(file_path.encode()).hexdigest()
    
    async def _download_file(self, bucket: str, object_path: str) -> bytes:
        """Download file from Supabase Storage"""
        try:
            response = self.supabase.storage.from_(bucket).download(object_path)
            
            if not response:
                raise FileProcessingError(f"Failed to download C3D file: {bucket}/{object_path}")
            
            return response
            
        except Exception as e:
            logger.error(f"Download failed: {str(e)}")
            raise FileProcessingError(f"Download operation failed: {str(e)}") from e
    
    async def _find_existing_session(self, file_hash: str) -> Optional[Dict[str, Any]]:
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
        processing_opts: ProcessingOptions,
        session_params: GameSessionParameters
    ) -> None:
        """
        Populate all related database tables using specialized methods with transaction-like error handling
        
        Tables populated:
        - c3d_technical_data
        - emg_statistics (per channel) - batch insert
        - processing_parameters  
        - performance_scores
        """
        metadata = processing_result.get("metadata", {})
        analytics = processing_result.get("analytics", {})
        
        # Validate required data
        if not metadata:
            raise ValueError(f"No metadata found in processing result for session {session_id}")
        if not analytics:
            raise ValueError(f"No analytics found in processing result for session {session_id}")
        
        try:
            # Populate tables with optimized order for performance
            await self._populate_c3d_technical_data(session_id, metadata, analytics)
            await self._populate_processing_parameters(session_id, metadata, processing_opts)
            await self._populate_emg_statistics(session_id, analytics, session_params)  # Batch insert
            await self._calculate_and_save_performance_scores(session_id, analytics, processing_result)
            
            logger.info(f"📊 Successfully populated all database tables for session: {session_id}")
            
        except Exception as e:
            logger.error(f"Failed to populate database tables for session {session_id}: {str(e)}", exc_info=True)
            raise DatabaseOperationError(f"Database population failed for session {session_id}: {str(e)}") from e
    
    async def _populate_c3d_technical_data(
        self, 
        session_id: str, 
        metadata: Dict[str, Any], 
        analytics: Dict[str, Any]
    ) -> None:
        """Populate C3D technical data table"""
        technical_data = {
            "session_id": session_id,
            "original_sampling_rate": metadata.get("sampling_rate", 1000.0),
            "original_duration_seconds": metadata.get("duration_seconds", 0.0),
            "original_sample_count": metadata.get("frame_count", 0),
            "channel_count": len(analytics),
            "channel_names": list(analytics.keys()),
            "sampling_rate": metadata.get("sampling_rate", 1000.0),
            "duration_seconds": metadata.get("duration_seconds", 0.0),
            "frame_count": metadata.get("frame_count", 0),
            "extracted_at": datetime.now(timezone.utc).isoformat()
        }
        await self._upsert_table("c3d_technical_data", technical_data, "session_id")
    
    async def _populate_emg_statistics(
        self, 
        session_id: str, 
        analytics: Dict[str, Any], 
        session_params: GameSessionParameters
    ) -> None:
        """Populate EMG statistics for each channel using batch insert"""
        if not analytics:
            logger.warning(f"No analytics data for session {session_id}")
            return
        
        # Build all statistics records for batch insert
        all_stats = []
        for channel_name, channel_data in analytics.items():
            stats_data = self._build_emg_stats_record(session_id, channel_name, channel_data, session_params)
            all_stats.append(stats_data)
        
        # Batch insert for better performance
        if all_stats:
            result = self.supabase.table("emg_statistics").insert(all_stats).execute()
            if not result.data:
                raise DatabaseOperationError(f"Failed to insert EMG statistics for session {session_id}")
            
            logger.debug(f"📊 Inserted {len(all_stats)} EMG statistics records for session {session_id}")
    
    def _build_emg_stats_record(
        self, 
        session_id: str, 
        channel_name: str, 
        channel_data: Dict[str, Any], 
        session_params: GameSessionParameters
    ) -> Dict[str, Any]:
        """Build EMG statistics record for a single channel"""
        # Use clinical constants for consistent values
        default_mvc_value = channel_data.get(
            "mvc_threshold", 
            DEFAULT_MVC_THRESHOLD_VALUE
        ) / MVC_PERCENTAGE_DIVISOR
        
        # Extract temporal statistics
        temporal_stats = self._extract_temporal_stats(channel_data)
        
        return {
            "session_id": session_id,
            "channel_name": channel_name,
            "total_contractions": channel_data.get("contraction_count", 0),
            "good_contractions": channel_data.get("good_contraction_count", 0),
            "mvc_contraction_count": channel_data.get("mvc_contraction_count", 0),
            "duration_contraction_count": channel_data.get("duration_contraction_count", 0),
            "compliance_rate": channel_data.get("compliance_rate", 0.0),
            "mvc_value": channel_data.get("mvc_value", default_mvc_value),
            "mvc_threshold": max(
                channel_data.get("mvc_threshold", DEFAULT_MVC_THRESHOLD_VALUE), 
                DEFAULT_MVC_THRESHOLD_VALUE
            ),
            "mvc_threshold_actual_value": DEFAULT_MVC_THRESHOLD_PERCENTAGE,
            "duration_threshold_actual_value": session_params.contraction_duration_threshold,
            "total_time_under_tension_ms": channel_data.get("total_time_under_tension_ms", 0.0),
            "avg_duration_ms": channel_data.get("avg_duration_ms", 0.0),
            "max_duration_ms": channel_data.get("max_duration_ms", 0.0),
            "min_duration_ms": channel_data.get("min_duration_ms", 0.0),
            "avg_amplitude": channel_data.get("avg_amplitude", 0.0),
            "max_amplitude": channel_data.get("max_amplitude", 0.0),
            **temporal_stats,
            "signal_quality_score": channel_data.get("signal_quality_score", 0.0),
            "processing_confidence": channel_data.get("processing_confidence", 0.0),
            "median_frequency_slope": None,  # Future implementation
            "estimated_fatigue_percentage": None,  # Future implementation
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    
    def _extract_temporal_stats(self, channel_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract temporal statistics from channel data"""
        rms_stats = channel_data.get("rms_temporal_stats", {})
        mav_stats = channel_data.get("mav_temporal_stats", {})
        mpf_stats = channel_data.get("mpf_temporal_stats", {})
        mdf_stats = channel_data.get("mdf_temporal_stats", {})
        fatigue_stats = channel_data.get("fatigue_index_temporal_stats", {})
        
        return {
            "rms_mean": rms_stats.get("mean_value", 0.0),
            "rms_std": rms_stats.get("std_value", 0.0),
            "mav_mean": mav_stats.get("mean_value"),
            "mav_std": mav_stats.get("std_value"),
            "mpf_mean": mpf_stats.get("mean_value"),
            "mpf_std": mpf_stats.get("std_value"),
            "mdf_mean": mdf_stats.get("mean_value"),
            "mdf_std": mdf_stats.get("std_value"),
            "fatigue_index_mean": fatigue_stats.get("mean_value"),
            "fatigue_index_std": fatigue_stats.get("std_value"),
            "fatigue_index_fi_nsm5": channel_data.get("fatigue_index_fi_nsm5"),
        }
    
    async def _populate_processing_parameters(
        self, 
        session_id: str, 
        metadata: Dict[str, Any], 
        processing_opts: ProcessingOptions
    ) -> None:
        """Populate processing parameters table with error handling"""
        sampling_rate = metadata.get("sampling_rate", 1000.0)
        nyquist_freq = sampling_rate / 2
        safe_high_cutoff = min(DEFAULT_LOWPASS_CUTOFF, nyquist_freq * NYQUIST_SAFETY_FACTOR)
        
        params_data = {
            "session_id": session_id,
            "sampling_rate_hz": sampling_rate,
            "filter_low_cutoff_hz": EMG_HIGH_PASS_CUTOFF,
            "filter_high_cutoff_hz": safe_high_cutoff,
            "filter_order": DEFAULT_FILTER_ORDER,
            "rms_window_ms": DEFAULT_RMS_WINDOW_MS,
            "rms_overlap_percent": RMS_OVERLAP_PERCENTAGE,
            "mvc_window_seconds": MVC_WINDOW_SECONDS,
            "mvc_threshold_percentage": processing_opts.threshold_factor * 100,
            "processing_version": PROCESSING_VERSION,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        result = self.supabase.table("processing_parameters").insert(params_data).execute()
        if not result.data:
            raise DatabaseOperationError(f"Failed to insert processing parameters for session {session_id}")
    
    async def _upsert_table(self, table_name: str, data: Dict[str, Any], unique_key: str) -> None:
        """Upsert data into table (insert or update if exists) with optimized error handling"""
        try:
            # Validate inputs to prevent downstream errors.
            if not table_name or not data or unique_key not in data:
                raise ValueError(f"Invalid upsert parameters: table={table_name}, key={unique_key}")
            
            # Optimization: Attempt to INSERT first, as this is the most common
            # case for new data and is more performant than a SELECT-then-UPDATE.
            result = self.supabase.table(table_name).insert(data).execute()
            
            # PostgREST returns data on successful insert. If it's empty, the
            # insert may have failed (e.g., due to a unique key constraint).
            if not result.data:
                # If insert failed, assume the record exists and attempt to UPDATE.
                unique_value = data[unique_key]
                update_result = self.supabase.table(table_name).update(data).eq(unique_key, unique_value).execute()
                
                # If both insert and update fail to return data, a problem exists.
                if not update_result.data:
                    raise DatabaseOperationError(f"Both insert and update failed for {table_name}")
                
        except Exception as e:
            # If the initial insert throws an exception (likely a unique key
            # violation), we catch it and try an update as the fallback strategy.
            try:
                unique_value = data[unique_key]
                update_result = self.supabase.table(table_name).update(data).eq(unique_key, unique_value).execute()
                
                if not update_result.data:
                    raise DatabaseOperationError(f"Update operation failed for {table_name}")
                    
            except Exception as update_error:
                # If the fallback update also fails, raise a comprehensive error.
                raise DatabaseOperationError(
                    f"Failed to upsert {table_name}: insert failed ({str(e)}), update failed ({str(update_error)})"
                ) from update_error
    
    async def _calculate_and_save_performance_scores(
        self, 
        session_id: str, 
        analytics: Dict[str, Any], 
        processing_result: Dict[str, Any]
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
                
                # Default clinical values using centralized configuration
                bfr_pressure_aop=DevelopmentDefaults.BFR_PRESSURE_AOP,
                bfr_compliant=True,
                rpe_post_session=DevelopmentDefaults.RPE_POST_SESSION,
                
                # Game data from C3D metadata (if available)
                game_points_achieved=processing_result.get("metadata", {}).get("game_points_achieved"),
                game_points_max=processing_result.get("metadata", {}).get("game_points_max"),
                
                expected_contractions_per_muscle=EXPECTED_CONTRACTIONS_PER_MUSCLE
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
    
    async def _update_session_cache(self, session_id: str, processing_result: Dict[str, Any]) -> None:
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
    
    async def _update_session_metadata(self, session_id: str, processing_result: Dict[str, Any]) -> None:
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
    
    def _calculate_overall_score(self, processing_result: Dict[str, Any]) -> float:
        """
        Calculate overall session score as weighted average of all muscle compliance
        
        Args:
            processing_result: Complete C3D processing result with analytics
            
        Returns:
            float: Overall compliance score (0.0 to 1.0)
        """
        try:
            analytics = processing_result.get("analytics", {})
            if not analytics:
                return 0.0
            
            total_score = 0.0
            muscle_count = 0
            
            for channel_name, channel_data in analytics.items():
                compliance_rate = channel_data.get("compliance_rate", 0.0)
                total_score += compliance_rate
                muscle_count += 1
            
            return total_score / muscle_count if muscle_count > 0 else 0.0
            
        except Exception as e:
            logger.error(f"Error calculating overall score: {str(e)}")
            return 0.0
    
    def _calculate_compliance_score(self, analytics: Dict[str, Any]) -> float:
        """
        Calculate compliance score across all channels
        
        Args:
            analytics: Dictionary of channel analytics
            
        Returns:
            float: Average compliance score (0.0 to 1.0)
        """
        try:
            if not analytics:
                return 0.0
            
            total_compliance = 0.0
            channel_count = 0
            
            for channel_name, channel_data in analytics.items():
                compliance_rate = channel_data.get("compliance_rate", 0.0)
                total_compliance += compliance_rate
                channel_count += 1
            
            return total_compliance / channel_count if channel_count > 0 else 0.0
            
        except Exception as e:
            logger.error(f"Error calculating compliance score: {str(e)}")
            return 0.0
    
