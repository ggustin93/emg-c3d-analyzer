"""
Therapy Session Processor - Workflow Orchestrator.
================================================

🎯 PURPOSE: Complete C3D processing pipeline orchestration
- Manages end-to-end therapy session lifecycle from upload to analytics
- Coordinates file download, C3D processing, and database population
- Orchestrates multiple services to create complete session records

🔗 RESPONSIBILITIES:
- Create therapy session database records
- Download C3D files from Supabase Storage
- Orchestrate EMG analysis via c3d_processor.py
- Populate ALL related database tables (emg_statistics with processing_config JSONB, etc.)
- Update session status and analytics cache
- Extract and store session timestamps (C3D TIME field)

📊 OUTPUT: Complete therapy session with full database population

⚠️ NOTE: This service is intentionally comprehensive for webhook processing.
For individual operations, use the specific services directly.

🏗️ ARCHITECTURE:
- Uses repository pattern for domain-separated data access (DDD principles)
- Timestamps managed automatically by database triggers
- SOLID principles with dependency injection and service composition

Author: EMG C3D Analyzer Team
Date: 2025-08-14 | Refactored: 2025-08-26
"""

import asyncio
import hashlib
import logging
import os
import tempfile
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4
import numpy as np

# ezc3d import removed - metadata extraction handled by GHOSTLYC3DProcessor

from config import (
    EMG_HIGH_PASS_CUTOFF,
    DEFAULT_FILTER_ORDER,
    DEFAULT_LOWPASS_CUTOFF,
    DEFAULT_RMS_WINDOW_MS,
    RMS_OVERLAP_PERCENTAGE,
    MVC_WINDOW_SECONDS,
    NYQUIST_SAFETY_FACTOR,
    PROCESSING_VERSION,
    DEFAULT_MVC_THRESHOLD_PERCENTAGE,
    DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS,
    DEFAULT_TARGET_CONTRACTIONS_CH1,
    DEFAULT_TARGET_CONTRACTIONS_CH2,
    MAX_FILE_SIZE,
    SessionDefaults
)
from models.api.request_response import ProcessingOptions, GameSessionParameters
from services.c3d.processor import GHOSTLYC3DProcessor
# C3DUtils import removed - metadata extraction handled internally by GHOSTLYC3DProcessor


# Custom Exception Classes for Better Error Handling
class TherapySessionError(Exception):
    """Base exception for therapy session processing errors."""


class FileProcessingError(TherapySessionError):
    """Raised when C3D file processing fails."""


class SessionNotFoundError(TherapySessionError):
    """Raised when a session cannot be found."""


class DatabaseError(TherapySessionError):
    """Raised when database operations fail."""


# Configuration Constants - sourced from config.py (single source of truth)
class ProcessingConstants:
    """Centralized configuration constants for therapy session processing.
    
    Values sourced from backend/config.py to maintain single source of truth.
    """
    # Core clinical parameters from config.py
    DEFAULT_MVC_THRESHOLD_PERCENTAGE = DEFAULT_MVC_THRESHOLD_PERCENTAGE  # 75.0
    DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS = DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS  # 2000.0
    DEFAULT_TARGET_CONTRACTIONS_CH1 = DEFAULT_TARGET_CONTRACTIONS_CH1  # 12
    DEFAULT_TARGET_CONTRACTIONS_CH2 = DEFAULT_TARGET_CONTRACTIONS_CH2  # 12
    
    # Session code generation - prevent infinite loops
    SESSION_CODE_MAX_ATTEMPTS = 10  # Prevent infinite loops in unique code generation
    SESSION_CODE_RETRY_DELAY = 0.1  # Seconds between retry attempts
    
    # MVC fallback value when none exists (physiologically reasonable minimum)
    DEFAULT_MVC_FALLBACK = 0.001  # 1mV - minimum MVC value for threshold calculations
    
    # Database operation timeouts
    DB_OPERATION_TIMEOUT = 30.0  # Seconds for database operations
    
    # File processing limits - converted from config.py MAX_FILE_SIZE (20MB)
    MAX_FILE_SIZE_MB = MAX_FILE_SIZE // (1024 * 1024)  # Convert bytes to MB
    
    # BFR defaults from SessionDefaults
    TARGET_PRESSURE_AOP = SessionDefaults.TARGET_PRESSURE_AOP  # 50.0% AOP

logger = logging.getLogger(__name__)


class TherapySessionProcessor:
    """Complete therapy session processing orchestrator.
    
    Coordinates the entire pipeline from file upload to complete analytics:
    1. Therapy session record creation
    2. File download from Supabase Storage  
    3. C3D processing with EMG analysis
    4. Database population across all tables
    5. Analytics cache updates
    6. Session status management
    """

    def __init__(
        self, 
        c3d_processor, 
        emg_data_repo, 
        session_repo, 
        cache_service, 
        performance_service,
        supabase_client
    ):
        """Initialize with required services using dependency injection."""
        self.c3d_processor = c3d_processor
        self.emg_data_repo = emg_data_repo
        self.session_repo = session_repo
        self.cache_service = cache_service
        self.performance_service = performance_service
        self.supabase_client = supabase_client
        logger.info("🏗️ TherapySessionProcessor initialized with dependencies")

    @property
    def scoring_service(self):
        """Alias for performance_service for backward compatibility with tests."""
        return self.performance_service

    async def create_session(
        self,
        file_path: str,
        file_metadata: dict[str, Any],
        patient_id: str | None = None,
        therapist_id: str | None = None,
    ) -> str:
        """Creates a new therapy session record following DRY/SOLID principles.

        This method properly delegates to the repository layer for session creation,
        implementing proper separation of concerns (SOLID - Single Responsibility).
        The repository handles database operations, while this processor coordinates.

        Args:
            file_path: Storage path to the C3D file (e.g., "bucket/file.c3d").
            file_metadata: Metadata from Supabase Storage (e.g., size).
            patient_id: Optional UUID of the patient.
            therapist_id: Optional UUID of the therapist.

        Returns:
            The session_code of the created or existing therapy session.

        Raises:
            TherapySessionError: If the session creation fails in the database.
        """
        try:
            # Extract patient code from file path
            patient_code = self._extract_patient_code(file_path)
            if not patient_code:
                patient_code = "P000"  # Default fallback (per user request)
            
            # Generate file hash for deduplication  
            file_hash = self._generate_file_hash(file_path, file_metadata)
            
            # Check for existing session (idempotency)
            existing = self.session_repo.get_session_by_file_hash(file_hash)
            if existing:
                # Extract human-readable code from game_metadata JSONB
                game_metadata = existing.get('game_metadata', {})
                session_code_existing = game_metadata.get('session_code', 'Unknown')
                logger.info(f"♻️ Found existing session: {session_code_existing}")
                return session_code_existing

            # Delegate session creation to repository (proper separation of concerns)
            # Repository returns: (human_readable_code, uuid_for_fk, full_record)
            session_code, session_uuid, _ = self.session_repo.create_session_with_code(
                patient_code=patient_code,
                file_path=file_path,
                file_metadata=file_metadata,
                patient_id=patient_id,
                therapist_id=therapist_id
            )
            
            # Store UUID for webhook response
            self._last_session_uuid = session_uuid
            
            logger.info(f"✅ Created therapy session: {session_code} (UUID: {session_uuid})")
            return session_code  # Return human-readable code

        except Exception as e:
            logger.error(f"Failed to create session: {e!s}", exc_info=True)
            raise TherapySessionError(f"Session creation failed: {e!s}") from e

    async def process_c3d_file(
        self, session_code: str, bucket: str, object_path: str
    ) -> dict[str, Any]:
        """Complete C3D file processing for an existing session.

        Args:
            session_code: Therapy session code (format: P###S###)
            bucket: Storage bucket name
            object_path: Path to C3D file in storage

        Returns:
            Dict with processing results
        """
        temp_file_path = None
        
        try:
            # Get existing session details
            session = self.session_repo.get_therapy_session(session_code)
            if not session:
                raise DatabaseError(f"Session {session_code} not found")

            session_uuid = session.get("id")
            if not session_uuid:
                raise DatabaseError(f"Session UUID not found for {session_code}")

            # Download file from Supabase Storage to temp location
            temp_file_path = await self._download_file_from_storage(f"{bucket}/{object_path}")
            
            # Process C3D file with complete analysis
            from models.api.request_response import GameSessionParameters, ProcessingOptions
            
            session_params = GameSessionParameters(
                contraction_duration_threshold=DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS
            )
            
            processing_opts = ProcessingOptions(
                mvc_threshold_percentage=DEFAULT_MVC_THRESHOLD_PERCENTAGE
            )
            
            # Read file data for database storage
            with open(temp_file_path, 'rb') as f:
                file_data = f.read()
            
            # Metadata extraction will be handled by GHOSTLYC3DProcessor
            # No need to load C3D file twice (DRY principle)
            
            # Ensure C3D processor is instantiated
            if self.c3d_processor is None:
                self.c3d_processor = GHOSTLYC3DProcessor(temp_file_path)
            
            # Run the complete C3D processing pipeline
            # The processor already extracts all metadata via C3DUtils
            processing_result = self.c3d_processor.process_file(
                processing_opts, session_params, include_signals=False
            )
            
            # Populate all database tables with processing results
            await self._populate_database_tables(
                session_code, session_uuid, processing_result, file_data, processing_opts, session_params
            )
            
            # Update session status and metadata
            await self._update_session_metadata(session_code, processing_result)
            self.session_repo.update_therapy_session(
                session_code, {"processing_status": "completed"}
            )
            
            # Cache analytics for performance
            await self._cache_session_analytics(session_uuid, processing_result)
            
            logger.info(f"🎉 Completed C3D file processing: {session_code}")
            
            return {
                "success": True,
                "session_code": session_code, 
                "session_id": session_uuid,  # For backward compatibility
                "session_uuid": session_uuid,
                "processing_status": "completed",
                "analytics": processing_result.get("analytics", {}),
                "metadata": processing_result.get("metadata", {})
            }
            
        except Exception as e:
            logger.exception(f"❌ Processing failed for {session_code}: {e!s}")
            
            # Update session status to failed if session exists
            try:
                error_message = str(e)[:500]  # Truncate long error messages
                self.session_repo.update_therapy_session(
                    session_code, {
                        "processing_status": "failed",
                        "processing_error_message": error_message
                    }
                )
            except Exception as update_error:
                logger.error(f"Failed to update session status to failed: {update_error!s}")
            
            raise TherapySessionError(f"Processing failed: {e!s}") from e
            
        finally:
            # Cleanup temporary files
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                    logger.info(f"🧹 Cleaned up temporary file: {temp_file_path}")
                except Exception as cleanup_error:
                    logger.warning(f"⚠️ Failed to cleanup temp file: {cleanup_error!s}")

    async def process_uploaded_file(
        self,
        file_path: str,
        file_metadata: dict[str, Any],
        patient_id: str | None = None,
        therapist_id: str | None = None
    ) -> dict[str, Any]:
        """Complete processing workflow from file upload to analytics.
        
        This method coordinates the complete therapy session lifecycle:
        1. Create session record
        2. Download C3D file from storage
        3. Process EMG data with analytics
        4. Populate all database tables
        5. Update session status and cache
        
        Args:
            file_path: Storage path to uploaded C3D file (bucket/object format)
            file_metadata: File metadata from Supabase Storage
            patient_id: Optional patient UUID
            therapist_id: Optional therapist UUID
            
        Returns:
            Dict containing session results and analytics
        """
        session_code = None
        session_uuid = None
        temp_file_path = None
        
        try:
            # Step 1: Create therapy session record
            session_code = await self.create_session(
                file_path, file_metadata, patient_id, therapist_id
            )
            
            # Step 2: Get session UUID from the created session
            if hasattr(self, '_last_session_uuid'):
                session_uuid = self._last_session_uuid
            else:
                # Fallback: look up session by code
                session = self.session_repo.get_therapy_session(session_code)
                session_uuid = session.get("id") if session else None
            
            if not session_uuid:
                raise DatabaseError(f"Failed to extract session UUID from session creation")
            
            logger.info(f"✅ Created therapy session record: {session_code} (UUID: {session_uuid})")
            
            # Step 3: Download file from Supabase Storage to temp location
            temp_file_path = await self._download_file_from_storage(file_path)
            
            # Step 4: Process C3D file with complete analysis
            from models.api.request_response import GameSessionParameters, ProcessingOptions
            
            session_params = GameSessionParameters(
                patient_id=patient_id,
                therapist_id=therapist_id,
                contraction_duration_threshold=DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS
            )
            
            processing_opts = ProcessingOptions(
                mvc_threshold_percentage=DEFAULT_MVC_THRESHOLD_PERCENTAGE
            )
            
            # Metadata extraction will be handled by GHOSTLYC3DProcessor
            # No need to load C3D file twice (DRY principle)
            
            # Ensure C3D processor is instantiated
            if self.c3d_processor is None:
                self.c3d_processor = GHOSTLYC3DProcessor(temp_file_path)
            
            # Run the complete C3D processing pipeline
            # The processor already extracts all metadata via C3DUtils
            processing_result = self.c3d_processor.process_file(
                processing_opts, session_params, include_signals=False
            )
            
            # Step 5: Populate all database tables with processing results
            await self._populate_all_database_tables(
                session_code, session_uuid, processing_result, processing_opts, session_params
            )
            
            # Step 6: Update session status and metadata
            await self._update_session_metadata(session_code, processing_result)
            self.session_repo.update_therapy_session(
                session_code, {"processing_status": "completed"}
            )
            
            # Step 7: Cache analytics for performance
            await self._cache_session_analytics(session_code, processing_result)
            
            logger.info(f"🎉 Completed therapy session processing: {session_code}")
            
            return {
                "success": True,
                "session_code": session_code, 
                "session_id": session_uuid,  # For backward compatibility
                "session_uuid": session_uuid,
                "processing_status": "completed",
                "analytics": processing_result.get("analytics", {}),
                "metadata": processing_result.get("metadata", {})
            }
            
        except Exception as e:
            logger.exception(f"❌ Processing failed for {file_path}: {e!s}")
            
            # Update session status to failed if session was created
            if session_code:
                try:
                    error_message = str(e)[:500]  # Truncate long error messages
                    self.session_repo.update_therapy_session(
                        session_code, {
                            "processing_status": "failed",
                            "processing_error_message": error_message
                        }
                    )
                except Exception as update_error:
                    logger.error(f"Failed to update session status to failed: {update_error!s}")
            
            raise TherapySessionError(f"Processing failed: {e!s}") from e
            
        finally:
            # Cleanup temporary files
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                    logger.info(f"🧹 Cleaned up temporary file: {temp_file_path}")
                except Exception as cleanup_error:
                    logger.warning(f"⚠️ Failed to cleanup temp file: {cleanup_error!s}")

    def _extract_patient_code(self, file_path: str) -> str | None:
        """Extract patient code from file path.
        
        Helper method following DRY principle - reusable patient code extraction.
        
        Args:
            file_path: Storage path like "bucket/P001/file.c3d"
            
        Returns:
            Optional[str]: Patient code (P###) or None if not found
        """
        try:
            # Extract patient code from file path
            path_parts = file_path.split("/")
            
            if len(path_parts) >= 2:
                # Look for patient code pattern (P### or similar)
                for part in path_parts:
                    if part.startswith("P") and len(part) >= 4:
                        return part[:4]  # Take P001, P002, etc.
            
            return None
        except Exception as e:
            logger.warning(f"Failed to extract patient code from '{file_path}': {e!s}")
            return None

    def _generate_session_code(self, patient_code: str) -> str:
        """Generate unique session code for patient.
        
        Args:
            patient_code: Patient identifier (e.g., P001)
            
        Returns:
            str: Session code (e.g., P001S001)
            
        Raises:
            TherapySessionError: If unable to generate unique code after max attempts
        """
        import time
        
        try:
            session_num = 1
            attempts = 0
            
            while attempts < ProcessingConstants.SESSION_CODE_MAX_ATTEMPTS:
                session_code = f"{patient_code}S{session_num:03d}"
                
                try:
                    # Check if this session code already exists
                    existing = self.supabase_client.table("therapy_sessions").select("session_code").eq("session_code", session_code).execute()
                    if not existing.data or len(existing.data) == 0:
                        logger.info(f"Generated unique session code: {session_code} (attempt {attempts + 1})")
                        return session_code
                        
                except Exception as db_error:
                    logger.warning(f"Database check failed for session code {session_code}: {db_error!s}")
                    # If we can't check the database, assume it's unique to avoid hanging
                    if attempts >= ProcessingConstants.SESSION_CODE_MAX_ATTEMPTS // 2:
                        logger.info(f"Using session code {session_code} due to DB check failures")
                        return session_code
                
                # Increment and retry with delay
                session_num = (session_num + 1) % 1000
                attempts += 1
                
                if attempts < ProcessingConstants.SESSION_CODE_MAX_ATTEMPTS:
                    time.sleep(ProcessingConstants.SESSION_CODE_RETRY_DELAY)
            
            # Max attempts reached - use UUID fallback
            fallback_code = f"{patient_code}S{uuid4().hex[:6].upper()}"
            logger.warning(
                f"Failed to generate session code for '{patient_code}' after {ProcessingConstants.SESSION_CODE_MAX_ATTEMPTS} attempts. "
                f"Using fallback: {fallback_code}"
            )
            return fallback_code
            
        except Exception as e:
            # Ultimate fallback
            fallback_code = f"P001S{uuid4().hex[:6].upper()}"
            logger.error(f"Session code generation failed for '{patient_code}': {e!s}. Using fallback: {fallback_code}")
            return fallback_code

    def _generate_file_hash(self, file_path: str, file_metadata: dict[str, Any]) -> str:
        """Generate consistent file hash for duplicate detection.
        
        Uses combination of path and metadata for deterministic hashing.
        """
        hash_input = f"{file_path}:{file_metadata.get('size', 0)}"
        return hashlib.sha256(hash_input.encode()).hexdigest()[:16]

    async def _download_file(self, bucket: str, object_path: str) -> bytes:
        """Download file from Supabase Storage (test-compatible method signature).
        
        Args:
            bucket: Storage bucket name
            object_path: Path to object in storage
            
        Returns:
            bytes: File content as bytes
            
        Raises:
            FileProcessingError: If download fails
        """
        try:
            logger.info(f"📥 Downloading from bucket '{bucket}': {object_path}")
            
            # Download file content directly
            response = self.supabase_client.storage.from_(bucket).download(object_path)
            
            if not response:
                raise FileProcessingError(f"Empty response from storage download: {bucket}/{object_path}")
            
            logger.info(f"✅ Downloaded {len(response)} bytes from {bucket}/{object_path}")
            return response
                
        except Exception as e:
            logger.exception(f"Failed to download file '{bucket}/{object_path}': {e!s}")
            raise FileProcessingError(f"Storage download failed: {e!s}") from e

    async def _download_file_from_storage(self, file_path: str) -> str:
        """Download file from Supabase Storage to temporary location.
        
        Args:
            file_path: Storage path (bucket/object format)
            
        Returns:
            str: Path to downloaded temporary file
            
        Raises:
            FileProcessingError: If download fails or path validation fails
        """
        try:
            # Validate and parse file path to prevent path traversal attacks
            if not file_path or not isinstance(file_path, str):
                raise FileProcessingError(f"Invalid file path: {file_path}")
            
            # Check for path traversal attempts
            if ".." in file_path or file_path.startswith("/") or "\\" in file_path:
                raise FileProcessingError(f"Invalid file path - potential path traversal: {file_path}")
            
            # Parse bucket and object path
            path_parts = file_path.split("/", 1)
            if len(path_parts) != 2:
                raise FileProcessingError(f"Invalid file path format (expected: bucket/object): {file_path}")
            
            bucket_name, object_path = path_parts
            
            # Validate bucket and object names
            if not bucket_name or not object_path:
                raise FileProcessingError(f"Empty bucket or object name in path: {file_path}")
            
            # Additional validation for suspicious characters (security hardening)
            suspicious_chars = ['<', '>', '"', '|', '?', '*', ':', ';', '`', '$', '&']
            if any(char in file_path for char in suspicious_chars):
                raise FileProcessingError(f"Invalid characters in file path: {file_path}")
            
            # Validate bucket and object names match expected patterns (prevent injection)
            import re
            if not re.match(r'^[a-zA-Z0-9][a-zA-Z0-9\-_]*[a-zA-Z0-9]$', bucket_name):
                if len(bucket_name) == 1 and bucket_name.isalnum():
                    pass  # Single character buckets are ok
                else:
                    raise FileProcessingError(f"Invalid bucket name format: {bucket_name}")
            
            if not re.match(r'^[a-zA-Z0-9][a-zA-Z0-9\-_./]*[a-zA-Z0-9]$', object_path):
                if len(object_path) == 1 and object_path.isalnum():
                    pass  # Single character object names are ok
                else:
                    raise FileProcessingError(f"Invalid object path format: {object_path}")
            
            logger.info(f"📥 Downloading validated path from bucket '{bucket_name}': {object_path}")
            
            # Download file content
            response = self.supabase_client.storage.from_(bucket_name).download(object_path)
            
            if not response:
                raise FileProcessingError(f"Empty response from storage download: {file_path}")
            
            # Create temporary file
            temp_fd, temp_path = tempfile.mkstemp(suffix=".c3d", prefix="session_")
            
            try:
                with open(temp_path, "wb") as temp_file:
                    temp_file.write(response)
                
                # Verify file was written and is reasonable size
                file_size = os.path.getsize(temp_path)
                if file_size == 0:
                    raise FileProcessingError(f"Downloaded file is empty: {file_path}")
                
                # Check file size is within reasonable limits (prevent DoS)
                max_size = ProcessingConstants.MAX_FILE_SIZE_MB * 1024 * 1024  # Convert MB to bytes
                if file_size > max_size:
                    os.unlink(temp_path)  # Clean up large file immediately
                    raise FileProcessingError(
                        f"Downloaded file too large: {file_size} bytes (max: {max_size} bytes) for {file_path}"
                    )
                
                logger.info(f"✅ Downloaded {file_size} bytes to: {temp_path}")
                return temp_path
                
            finally:
                os.close(temp_fd)  # Close the file descriptor
                
        except Exception as e:
            logger.exception(f"Failed to download file '{file_path}': {e!s}")
            raise FileProcessingError(f"Storage download failed: {e!s}") from e

    async def _populate_all_database_tables(
        self, 
        session_code: str, 
        session_uuid: str,
        processing_result: dict[str, Any], 
        processing_opts, 
        session_params
    ) -> None:
        """Populate all database tables with processing results.
        
        Comprehensive database population including:
        - emg_statistics (with clinical JSONB groups)
        - processing_parameters
        - performance_scores
        - game_metadata (stored in therapy_sessions)
        - session_settings (Schema v2.1 compliance)
        - bfr_monitoring (Schema v2.1 compliance)
        """
        # Validate required data
        if "metadata" not in processing_result:
            raise ValueError("No metadata found in processing result")
        if "analytics" not in processing_result:
            raise ValueError("No analytics found in processing result")
            
        metadata = processing_result["metadata"]
        analytics = processing_result["analytics"]
        
        # Validate that analytics is not empty
        if not analytics:
            logger.warning(f"Empty analytics data for session {session_code}")
        
        try:
            # Parallel execution of independent database operations for better performance
            # Following asyncio.gather best practices from aiohttp documentation
            
            # Step 1: Independent operations that can run in parallel
            parallel_tasks = []
            
            if analytics:
                emg_task = self._populate_emg_statistics(
                    session_uuid, analytics, session_params, {}
                )
                parallel_tasks.append(emg_task)
            
            # Session settings and BFR monitoring are independent
            settings_task = self._populate_session_settings(
                session_code, session_uuid, processing_opts, session_params
            )
            bfr_task = self._populate_bfr_monitoring(
                session_code, session_uuid, session_params, processing_result
            )
            parallel_tasks.extend([settings_task, bfr_task])
            
            # Execute independent operations in parallel
            logger.info(f"🔄 Starting {len(parallel_tasks)} parallel database operations for session {session_code}")
            await asyncio.gather(*parallel_tasks)
            logger.info(f"✅ Completed parallel database operations for session {session_code}")
            
            # Step 2: Dependent operation (needs EMG data) - run after parallel tasks complete
            if analytics:
                overall_score = self._calculate_overall_score(processing_result)
                await self._calculate_and_save_performance_scores(
                    session_code, session_uuid, analytics, processing_result
                )
                logger.info(f"🏆 Performance scores calculated for session {session_code} (overall: {overall_score:.1%})")
            else:
                logger.info(f"📊 EMG statistics populated for session {session_code}")

            logger.info(
                f"✅ All database tables populated for session {session_code}"
            )
            
        except Exception as e:
            logger.exception(f"Database population failed for session {session_code}: {e!s}")
            raise DatabaseError(f"Database population failed for session {session_code}: {e!s}") from e

    async def _populate_emg_statistics(
        self, 
        session_uuid: str, 
        analytics: dict[str, Any], 
        session_params,
        processing_config: dict[str, Any]
    ) -> None:
        """Populate emg_statistics table with comprehensive EMG analysis data.
        
        Uses optimized clinical JSONB groups for Schema 2.0 compliance:
        - temporal_metrics: RMS, MAV, MPF, MDF with statistical summaries
        - muscle_activation_metrics: Activation patterns and amplitudes
        - contraction_quality_metrics: Duration, amplitude, and compliance assessment
        - contraction_timing_metrics: Onset, offset, and interval analysis
        - fatigue_assessment_metrics: Progression and decline indicators
        - signal_quality_metrics: SNR, baseline noise, and artifact detection
        """
        try:
            emg_statistics_records = []
            
            for channel_name, channel_data in analytics.items():
                emg_record = self._build_emg_statistics_record(
                    session_uuid, channel_name, channel_data, analytics, session_params
                )
                emg_statistics_records.append(emg_record)

            # Bulk insert for performance
            await self._bulk_insert_table("emg_statistics", emg_statistics_records)
            
            logger.info(
                f"📊 Inserted {len(emg_statistics_records)} EMG statistics records for session {session_uuid}"
            )
            
        except Exception as e:
            logger.exception(f"EMG statistics population failed: {e!s}")
            raise DatabaseError(f"EMG statistics population failed: {e!s}") from e

    def _build_emg_statistics_record(
        self, 
        session_uuid: str, 
        channel_name: str, 
        channel_data: dict[str, Any], 
        full_analytics: dict[str, Any],
        session_params
    ) -> dict[str, Any]:
        """Build complete EMG statistics record with clinical JSONB groups.
        
        Consolidates all EMG analysis into structured clinical metrics optimized
        for therapist workflows and compliance assessment.
        """
        
        # MVC value handling - flexible based on sensor and muscle
        # Don't make assumptions - NULL is valid when no MVC baseline exists
        default_mvc_value = channel_data.get("mvc_value")
        if default_mvc_value is not None and default_mvc_value <= 0:
            default_mvc_value = None  # NULL when invalid/missing
        
        # For threshold calculations, use value if present, otherwise the configured fallback
        channel_mvc_default = default_mvc_value if default_mvc_value and default_mvc_value > 0 else ProcessingConstants.DEFAULT_MVC_FALLBACK

        # Extract temporal statistics (preserve existing structure)
        temporal_stats = self._extract_temporal_stats(channel_data)
        
        # Build contractions detail JSONB (preserve existing structure)
        contractions_detail = []
        contractions = channel_data.get("contractions", [])
        for contraction in contractions:
            contractions_detail.append({
                "start_time_ms": contraction.get("start_time_ms", 0),
                "end_time_ms": contraction.get("end_time_ms", 0),
                "peak_amplitude": contraction.get("peak_amplitude", 0.0),
                "mean_amplitude": contraction.get("mean_amplitude", 0.0),
                "meets_mvc": contraction.get("meets_mvc", False),
                "meets_duration": contraction.get("meets_duration", False)
            })
        
        # Build signal quality metrics JSONB (preserve existing structure)
        signal_quality_metrics = {
            "snr_db": channel_data.get("snr_db", 0.0),
            "baseline_noise_uv": channel_data.get("baseline_noise_uv", 0.0),
            "artifact_percentage": channel_data.get("artifact_percentage", 0.0),
            "saturation_percentage": channel_data.get("saturation_percentage", 0.0)
        }

        # Build processing config JSONB
        processing_config = {
            "contraction_duration_threshold_ms": session_params.contraction_duration_threshold if session_params else 2000.0,
            "mvc_threshold_percentage": DEFAULT_MVC_THRESHOLD_PERCENTAGE,
            "smoothing_window_ms": getattr(session_params, 'smoothing_window_ms', 25) if session_params else 25,
            "min_duration_ms": getattr(session_params, 'min_duration_ms', 50) if session_params else 50,
            "threshold_factor": getattr(session_params, 'threshold_factor', 0.3) if session_params else 0.3
        }
        
        # Build new clinical JSONB groups
        contraction_quality_metrics = self._build_contraction_quality_metrics(channel_data)
        contraction_timing_metrics = self._build_contraction_timing_metrics(channel_data, session_params)
        muscle_activation_metrics = self._build_muscle_activation_metrics(channel_data)
        fatigue_assessment_metrics = self._build_fatigue_assessment_metrics(channel_data, temporal_stats)

        # Start with minimal core fields that should definitely exist
        base_record = {
            "session_id": session_uuid,
            "channel_name": channel_name,
            
            # Core MVC fields (should exist in all schema versions)
            "mvc_value": default_mvc_value,
            "mvc75_threshold": channel_data.get("mvc_threshold", channel_mvc_default * DEFAULT_MVC_THRESHOLD_PERCENTAGE / 100.0),
            "signal_quality_score": channel_data.get("signal_quality_score", 0.0),
        }
        
        # Try to add JSONB groups if they exist in the schema
        try:
            base_record.update({
                "temporal_metrics": temporal_stats,
                "muscle_activation_metrics": muscle_activation_metrics, 
                "contraction_quality_metrics": contraction_quality_metrics,
                "contraction_timing_metrics": contraction_timing_metrics,
                "fatigue_assessment_metrics": fatigue_assessment_metrics,
                "signal_quality_metrics": signal_quality_metrics,
                "processing_config": processing_config,
                "contractions_detail": contractions_detail,
            })
        except Exception as e:
            logger.warning(f"Could not add JSONB fields to EMG record: {e}")
            # Fall back to basic record
        
        return base_record

    def _extract_temporal_stats(self, channel_data: dict[str, Any]) -> dict[str, Any]:
        """Extract temporal statistics (RMS, MAV, MPF, MDF) from channel data."""
        # Initialize with default structure required by database schema
        temporal_stats = {
            "rms": {"mean": 0.0, "std": 0.0},
            "mav": {"mean": 0.0, "std": 0.0},
            "mpf": {"mean": 0.0, "std": 0.0},
            "mdf": {"mean": 0.0, "std": 0.0},
            "fatigue_index": {"mean": 0.0, "std": 0.0, "fi_nsm5": 0.0}
        }
        
        # RMS (Root Mean Square)
        rms_values = channel_data.get("rms_values", [])
        if rms_values:
            temporal_stats["rms"] = {
                "mean": float(sum(rms_values) / len(rms_values)),
                "std": float(self._calculate_std(rms_values)),
                "min": float(min(rms_values)),
                "max": float(max(rms_values)),
                "count": len(rms_values)
            }
        
        # Also check for temporal_stats format from processing result
        if "rms_temporal_stats" in channel_data:
            rms_temp = channel_data["rms_temporal_stats"]
            temporal_stats["rms"]["mean"] = rms_temp.get("mean_value", 0.0)
            temporal_stats["rms"]["std"] = rms_temp.get("std_value", 0.0)
        
        # MAV (Mean Absolute Value) 
        mav_values = channel_data.get("mav_values", [])
        if mav_values:
            temporal_stats["mav"] = {
                "mean": float(sum(mav_values) / len(mav_values)),
                "std": float(self._calculate_std(mav_values)),
                "min": float(min(mav_values)),
                "max": float(max(mav_values)),
                "count": len(mav_values)
            }
        
        # Also check for temporal_stats format
        if "mav_temporal_stats" in channel_data:
            mav_temp = channel_data["mav_temporal_stats"]
            temporal_stats["mav"]["mean"] = mav_temp.get("mean_value", 0.0)
            temporal_stats["mav"]["std"] = mav_temp.get("std_value", 0.0)
        
        # MPF (Mean Power Frequency)
        mpf_values = channel_data.get("mpf_values", [])
        if mpf_values:
            temporal_stats["mpf"] = {
                "mean": float(sum(mpf_values) / len(mpf_values)),
                "std": float(self._calculate_std(mpf_values)),
                "min": float(min(mpf_values)),
                "max": float(max(mpf_values)),
                "count": len(mpf_values)
            }
        
        # Also check for temporal_stats format
        if "mpf_temporal_stats" in channel_data:
            mpf_temp = channel_data["mpf_temporal_stats"]
            temporal_stats["mpf"]["mean"] = mpf_temp.get("mean_value", 0.0)
            temporal_stats["mpf"]["std"] = mpf_temp.get("std_value", 0.0)
        
        # MDF (Median Power Frequency)
        mdf_values = channel_data.get("mdf_values", [])
        if mdf_values:
            temporal_stats["mdf"] = {
                "mean": float(sum(mdf_values) / len(mdf_values)),
                "std": float(self._calculate_std(mdf_values)),
                "min": float(min(mdf_values)),
                "max": float(max(mdf_values)),
                "count": len(mdf_values)
            }
        
        # Also check for temporal_stats format
        if "mdf_temporal_stats" in channel_data:
            mdf_temp = channel_data["mdf_temporal_stats"]
            temporal_stats["mdf"]["mean"] = mdf_temp.get("mean_value", 0.0)
            temporal_stats["mdf"]["std"] = mdf_temp.get("std_value", 0.0)

        # Fatigue index
        if "fatigue_index_temporal_stats" in channel_data:
            fatigue_temp = channel_data["fatigue_index_temporal_stats"]
            temporal_stats["fatigue_index"]["mean"] = fatigue_temp.get("mean_value", 0.0)
            temporal_stats["fatigue_index"]["std"] = fatigue_temp.get("std_value", 0.0)
        
        if "fatigue_index_fi_nsm5" in channel_data:
            temporal_stats["fatigue_index"]["fi_nsm5"] = channel_data["fatigue_index_fi_nsm5"]
        
        return temporal_stats

    def _calculate_std(self, values: list[float]) -> float:
        """Calculate standard deviation of values."""
        if len(values) < 2:
            return 0.0
        mean = sum(values) / len(values)
        variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)
        return variance ** 0.5

    def _build_contraction_quality_metrics(self, channel_data: dict[str, Any]) -> dict[str, Any]:
        """Build contraction quality metrics with explicit clinical naming."""
        contractions = channel_data.get("contractions", [])
        total = len(contractions)
        
        if total == 0:
            return {
                "total_contractions": 0,
                "mvc75_compliant_contractions": 0,
                "duration_compliant_contractions": 0,
                "overall_compliant_contractions": 0,
                "mvc75_compliance_percentage": 0.0,
                "duration_compliance_percentage": 0.0,
                "overall_compliance_percentage": 0.0
            }
        
        # Calculate compliance counts with explicit names
        mvc75_compliant = sum(1 for c in contractions if c.get("meets_mvc", False))
        duration_compliant = sum(1 for c in contractions if c.get("meets_duration", False))
        overall_compliant = sum(1 for c in contractions 
                              if c.get("meets_mvc", False) and c.get("meets_duration", False))
        
        return {
            "total_contractions": total,
            "mvc75_compliant_contractions": mvc75_compliant,  # Explicit 75% threshold
            "duration_compliant_contractions": duration_compliant,
            "overall_compliant_contractions": overall_compliant,
            "mvc75_compliance_percentage": round((mvc75_compliant / total) * 100, 2),
            "duration_compliance_percentage": round((duration_compliant / total) * 100, 2),
            "overall_compliance_percentage": round((overall_compliant / total) * 100, 2),
            # Add the compliance_rate field that was removed from top-level
            "compliance_rate": round((overall_compliant / total) * 100, 2) if total > 0 else 0.0,
            # Add therapeutic_work_percentage
            "therapeutic_work_percentage": channel_data.get("therapeutic_work_percentage", 0.0)
        }

    def _build_contraction_timing_metrics(self, channel_data: dict[str, Any], session_params) -> dict[str, Any]:
        """Build timing metrics with clinical duration thresholds."""
        contractions = channel_data.get("contractions", [])
        
        # Extract durations from contractions
        durations = []
        for c in contractions:
            duration = c.get("end_time_ms", 0) - c.get("start_time_ms", 0)
            if duration > 0:
                durations.append(duration)
        
        # Get duration threshold from session params or use default
        duration_threshold = DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS
        if session_params:
            # Try to get channel-specific threshold
            if hasattr(session_params, 'contraction_duration_threshold'):
                duration_threshold = session_params.contraction_duration_threshold
        
        # Calculate timing statistics
        if durations:
            mean_duration = sum(durations) / len(durations)
            std_duration = self._calculate_std(durations)
            
            return {
                "mean_contraction_duration_ms": round(mean_duration, 2),
                "std_contraction_duration_ms": round(std_duration, 2),
                "min_contraction_duration_ms": min(durations),
                "max_contraction_duration_ms": max(durations),
                "duration_threshold_ms": duration_threshold,
                "contractions_meeting_duration": sum(1 for d in durations if d >= duration_threshold),
                "duration_compliance_rate": round((sum(1 for d in durations if d >= duration_threshold) / len(durations)) * 100, 2)
            }
        else:
            return {
                "mean_contraction_duration_ms": 0.0,
                "std_contraction_duration_ms": 0.0,
                "min_contraction_duration_ms": 0.0,
                "max_contraction_duration_ms": 0.0,
                "duration_threshold_ms": duration_threshold,
                "contractions_meeting_duration": 0,
                "duration_compliance_rate": 0.0
            }

    def _build_muscle_activation_metrics(self, channel_data: dict[str, Any]) -> dict[str, Any]:
        """Build muscle activation and amplitude metrics."""
        contractions = channel_data.get("contractions", [])
        
        amplitudes = [c.get("peak_amplitude", 0.0) for c in contractions if c.get("peak_amplitude", 0.0) > 0]
        mean_amplitudes = [c.get("mean_amplitude", 0.0) for c in contractions if c.get("mean_amplitude", 0.0) > 0]
        
        return {
            "peak_amplitude_mean": round(sum(amplitudes) / len(amplitudes), 4) if amplitudes else 0.0,
            "peak_amplitude_std": round(self._calculate_std(amplitudes), 4) if len(amplitudes) > 1 else 0.0,
            "peak_amplitude_max": max(amplitudes) if amplitudes else 0.0,
            "mean_amplitude_mean": round(sum(mean_amplitudes) / len(mean_amplitudes), 4) if mean_amplitudes else 0.0,
            "mean_amplitude_std": round(self._calculate_std(mean_amplitudes), 4) if len(mean_amplitudes) > 1 else 0.0,
            "activation_efficiency": channel_data.get("activation_efficiency", 0.0),
            "mvc_value": channel_data.get("mvc_value", 0.0),
            "mvc_threshold": channel_data.get("mvc_threshold", 0.0),
            "total_time_under_tension_ms": channel_data.get("total_time_under_tension_ms", 0.0)
        }

    def _build_fatigue_assessment_metrics(self, channel_data: dict[str, Any], temporal_stats: dict[str, Any]) -> dict[str, Any]:
        """Build fatigue assessment metrics using temporal analysis."""
        return {
            "fatigue_index_initial": temporal_stats.get("fatigue_index", {}).get("mean", 0.0),
            "fatigue_index_final": temporal_stats.get("fatigue_index", {}).get("fi_nsm5", 0.0),
            "fatigue_progression_rate": 0.0,  # Could be calculated from time series data
            "mpf_decline_percentage": 0.0,  # Could be calculated from MPF trend
            "mdf_decline_percentage": 0.0,  # Could be calculated from MDF trend
            "endurance_index": channel_data.get("endurance_index", 0.0),
            "recovery_potential": channel_data.get("recovery_potential", 0.0)
        }

    def _calculate_overall_score(self, processing_result: dict[str, Any]) -> float:
        """Calculate overall performance score from processing result."""
        analytics = processing_result.get("analytics", {})
        if not analytics:
            return 0.0
        
        # Simple scoring based on average compliance rate
        total_compliance = 0.0
        channel_count = 0
        
        for channel_data in analytics.values():
            compliance = channel_data.get("compliance_rate", 0.0)
            total_compliance += compliance
            channel_count += 1
        
        if channel_count == 0:
            return 0.0
        
        return total_compliance / channel_count

    async def _calculate_and_save_performance_scores(
        self,
        session_code: str,
        session_id: str,
        analytics: dict[str, Any],
        processing_result: dict[str, Any]
    ) -> None:
        """Calculate and save performance scores (test-compatible method).
        
        This method provides compatibility with tests that expect this signature.
        """
        try:
            overall_score = self._calculate_overall_score(processing_result)
            await self._populate_performance_scores(session_id, overall_score, analytics)
            
        except Exception as e:
            logger.exception(f"Failed to calculate and save performance scores: {e!s}")
            raise DatabaseError(f"Performance scores calculation failed: {e!s}") from e

    def _create_session_metrics_from_analytics(
        self, 
        session_uuid: str, 
        analytics: dict[str, Any]
    ):
        """Create SessionMetrics object directly from analytics data.
        
        This avoids database fetch timing issues by using the in-memory analytics data
        that was just processed.
        """
        try:
            from services.clinical.performance_scoring_service import SessionMetrics
            
            # Map CH1 to left and CH2 to right for compatibility
            left_channel = analytics.get("CH1", {})
            right_channel = analytics.get("CH2", {})
            
            # Check if we have the required channels
            if not left_channel or not right_channel:
                logger.warning(f"Missing CH1 or CH2 channel data for session {session_uuid}")
                logger.debug(f"Available channels: {list(analytics.keys())}")
                return None
            
            # Validate data quality before creating metrics
            self._validate_analytics_data_quality(left_channel, "CH1", session_uuid)
            self._validate_analytics_data_quality(right_channel, "CH2", session_uuid)
            
            # Create SessionMetrics with data from analytics
            # IMPORTANT: No fallbacks - each metric uses its specific field only
            # mvc_contraction_count = contractions meeting MVC/intensity threshold
            # duration_contraction_count = contractions meeting duration threshold  
            # good_contraction_count = contractions meeting BOTH thresholds
            return SessionMetrics(
                session_id=session_uuid,
                # Left muscle (CH1) metrics
                left_total_contractions=left_channel.get("contraction_count", 0),
                left_good_contractions=left_channel.get("good_contraction_count", 0),
                left_mvc_contractions=left_channel.get("mvc_compliant_count", 0),  # No fallback
                left_duration_contractions=left_channel.get("duration_compliant_count", 0),  # No fallback
                # Right muscle (CH2) metrics  
                right_total_contractions=right_channel.get("contraction_count", 0),
                right_good_contractions=right_channel.get("good_contraction_count", 0),
                right_mvc_contractions=right_channel.get("mvc_compliant_count", 0),  # No fallback
                right_duration_contractions=right_channel.get("duration_compliant_count", 0),  # No fallback
                # BFR and subjective data (not available at this stage)
                bfr_pressure_aop=None,
                bfr_compliant=True,
                rpe_post_session=None,
                game_points_achieved=None,
                game_points_max=None,
                # Expected contractions (from config)
                expected_contractions_per_muscle=12  # Default from config
            )
            
        except Exception as e:
            logger.error(f"Failed to create SessionMetrics from analytics: {e!s}")
            return None
    
    def _validate_analytics_data_quality(
        self, 
        channel_data: dict[str, Any], 
        channel_name: str,
        session_uuid: str
    ) -> None:
        """Validate analytics data quality and log warnings for missing/inconsistent data.
        
        This method detects common data quality issues that could affect performance scoring:
        - Missing mvc_contraction_count when contractions exist
        - Missing duration_contraction_count when contractions exist
        - Inconsistent count relationships (e.g., mvc_count > total_count)
        - Missing critical fields for scoring calculations
        
        Args:
            channel_data: Analytics data for a single channel
            channel_name: Name of the channel (e.g., "CH1", "CH2")
            session_uuid: UUID of the session for logging context
        """
        contraction_count = channel_data.get("contraction_count", 0)
        mvc_count = channel_data.get("mvc_compliant_count", 0)
        duration_count = channel_data.get("duration_compliant_count", 0)
        good_count = channel_data.get("good_contraction_count", 0)
        
        # Check for missing MVC count when contractions exist
        if contraction_count > 0 and mvc_count == 0:
            if "mvc_compliant_count" not in channel_data:
                logger.warning(
                    f"⚠️ Data quality issue in {channel_name} for session {session_uuid}: "
                    f"Found {contraction_count} contractions but mvc_compliant_count is missing. "
                    "This will result in intensity_rate=0. Check EMG processing for MVC threshold detection."
                )
        
        # Check for missing duration count when contractions exist
        if contraction_count > 0 and duration_count == 0:
            if "duration_compliant_count" not in channel_data:
                logger.warning(
                    f"⚠️ Data quality issue in {channel_name} for session {session_uuid}: "
                    f"Found {contraction_count} contractions but duration_compliant_count is missing. "
                    "This will result in duration_rate=0. Check EMG processing for duration threshold detection."
                )
        
        # Check for logical inconsistencies
        if mvc_count > contraction_count:
            logger.error(
                f"❌ Data integrity error in {channel_name} for session {session_uuid}: "
                f"mvc_contraction_count ({mvc_count}) > total contraction_count ({contraction_count}). "
                "This indicates a processing error."
            )
        
        if duration_count > contraction_count:
            logger.error(
                f"❌ Data integrity error in {channel_name} for session {session_uuid}: "
                f"duration_contraction_count ({duration_count}) > total contraction_count ({contraction_count}). "
                "This indicates a processing error."
            )
        
        if good_count > mvc_count or good_count > duration_count:
            logger.warning(
                f"⚠️ Data consistency issue in {channel_name} for session {session_uuid}: "
                f"good_contraction_count ({good_count}) exceeds mvc ({mvc_count}) or duration ({duration_count}) counts. "
                "Good contractions should be the intersection of both thresholds."
            )
        
        # Check for expected relationships
        if mvc_count > 0 and duration_count > 0 and good_count == 0:
            logger.info(
                f"ℹ️ Performance pattern in {channel_name} for session {session_uuid}: "
                f"Found contractions meeting MVC ({mvc_count}) and duration ({duration_count}) separately, "
                f"but none meeting both thresholds (good_count=0). This is clinically valid."
            )
        
        # Log summary for debugging
        logger.debug(
            f"📊 {channel_name} contraction summary for session {session_uuid}: "
            f"total={contraction_count}, mvc={mvc_count}, duration={duration_count}, good={good_count}"
        )
    
    async def _populate_performance_scores(
        self,
        session_uuid: str,
        overall_score: float,
        analytics: dict[str, Any]
    ) -> None:
        """Calculate and store performance scores."""
        try:
            logger.info(f"📊 Starting performance score calculation for session {session_uuid}")
            
            # Use the synchronous performance service (follows project's sync Supabase architecture)
            score_result = self.performance_service.calculate_performance_scores(session_uuid)
            
            logger.info(f"📊 Performance service returned: {list(score_result.keys())}")
            
            # Check for error in result
            if "error" in score_result:
                logger.error(f"❌ Performance service error: {score_result['error']}")
                return

            # Get scoring config ID - will use fallback from config.py if needed
            scoring_config_id = score_result.get("scoring_config_id")
            if not scoring_config_id:
                # This should rarely happen now that we have fallback, but handle gracefully
                logger.error(
                    f"Failed to get scoring configuration for session {session_uuid}. "
                    "This indicates a database connectivity issue. Performance scores will be skipped."
                )
                return  # Skip only if we truly can't get any config (DB error)
            
            logger.info(f"📊 Using scoring_config_id: {scoring_config_id}")

            # Create performance record matching actual database schema
            # Schema has: overall_score, compliance_score, symmetry_score, effort_score, game_score
            performance_data = {
                "session_id": session_uuid,
                "overall_score": score_result.get("overall_score", overall_score),
                "compliance_score": score_result.get("compliance_score", 0.0),
                "symmetry_score": score_result.get("symmetry_score", 0.0),
                "effort_score": score_result.get("effort_score", 0.0),
                "game_score": score_result.get("game_score", 0.0),
                "scoring_config_id": scoring_config_id,
                # Channel-specific compliance scores
                "left_muscle_compliance": score_result.get("left_muscle_compliance", 0.0),
                "right_muscle_compliance": score_result.get("right_muscle_compliance", 0.0),
                # Detailed rate metrics
                "completion_rate_left": score_result.get("completion_rate_left", 0.0),
                "completion_rate_right": score_result.get("completion_rate_right", 0.0),
                "intensity_rate_left": score_result.get("intensity_rate_left", 0.0),
                "intensity_rate_right": score_result.get("intensity_rate_right", 0.0),
                "duration_rate_left": score_result.get("duration_rate_left", 0.0),
                "duration_rate_right": score_result.get("duration_rate_right", 0.0),
                # BFR and game data
                "bfr_compliant": score_result.get("bfr_compliant", True),
                "bfr_pressure_aop": score_result.get("bfr_pressure_aop"),
                "rpe_post_session": score_result.get("rpe_post_session"),
                "game_points_achieved": score_result.get("game_points_achieved"),
                "game_points_max": score_result.get("game_points_max"),
            }

            # Store in database
            logger.info(f"📊 Attempting to upsert performance_scores with {len(performance_data)} fields")
            logger.debug(f"📊 Performance data keys: {list(performance_data.keys())}")
            
            await self._upsert_table("performance_scores", performance_data, "session_id")

            logger.info(
                f"🏆 Performance scores calculated and saved for session {session_uuid}: "
                f"Overall={performance_data['overall_score']:.1%}, "
                f"Compliance={performance_data['compliance_score']:.1%}"
            )

        except Exception as e:
            logger.exception(f"Failed to populate performance scores: {e!s}")
            raise DatabaseError(f"Performance scores population failed: {e!s}") from e

    async def _populate_database_tables(
        self, 
        session_code: str,
        session_uuid: str,
        processing_result: dict[str, Any],
        file_data: bytes,
        processing_opts,
        session_params
    ) -> None:
        """Populate all database tables with session and EMG data.
        
        Alternative method name for _populate_all_database_tables to support tests.
        This method signature matches what tests expect.
        
        Args:
            session_code: Session code (e.g., P001S001)
            session_uuid: Session UUID
            processing_result: Complete processing result with analytics and metadata
            file_data: Raw file data (not used but expected by tests)
            processing_opts: Processing options
            session_params: Session parameters
        """
        try:
            # Validate required data (for test compatibility)
            if "metadata" not in processing_result:
                raise ValueError("No metadata found in processing result")
            if "analytics" not in processing_result:
                raise ValueError("No analytics found in processing result")
                
            logger.info(f"💾 Starting database population for session {session_code}")
            
            # Simply delegate to the main population method (now with parallel execution)
            await self._populate_all_database_tables(
                session_code, session_uuid, processing_result, processing_opts, session_params
            )
            
            logger.info(f"✅ All database tables populated successfully for session {session_code}")
            
        except Exception as e:
            logger.exception(f"Database population failed: {e!s}")
            raise TherapySessionError(f"Database population failed: {e!s}") from e

    async def _cache_session_analytics(
        self, 
        session_uuid: str, 
        processing_result: dict[str, Any]
    ) -> None:
        """Cache session analytics in Redis for fast access."""
        try:
            # Calculate summary statistics
            analytics = processing_result.get("analytics", {})
            summary = {
                "channels": list(analytics.keys()),
                "total_channels": len(analytics),
                "overall_compliance": 0.0,
                "processed_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Calculate average compliance across channels
            if analytics:
                total_compliance = sum(
                    channel.get("compliance_rate", 0.0) 
                    for channel in analytics.values()
                )
                summary["overall_compliance"] = total_compliance / len(analytics)
            
            cache_data = {
                "session_id": session_uuid,
                "analytics": analytics,
                "summary": summary,
                "metadata": processing_result.get("metadata", {}),
                "cache_version": "2.1"
            }
            
            # Note: Caching disabled - method not implemented in CacheService
            # This is non-critical for the workflow as noted in the exception handler
            # await self.cache_service.set_session_analytics(session_uuid, cache_data)
            
            logger.info(
                f"📊 Session analytics processed for {session_uuid}: "
                f"{len(analytics)} channels, {summary['overall_compliance']:.1%} overall compliance"
            )
            
        except Exception as e:
            logger.exception(f"Failed to cache session analytics: {e!s}")
            # Don't raise - caching is not critical for the workflow

    async def _update_session_metadata(
        self,
        session_code: str,
        processing_result: dict[str, Any]
    ) -> None:
        """Update session metadata with processing results."""
        try:
            metadata = processing_result.get("metadata", {})
            
            # Extract game session date from metadata
            session_date = None
            if "time" in metadata:
                try:
                    # Parse the time string and convert to ISO format with timezone
                    time_str = metadata["time"]
                    # Assuming the time is in format "2025-08-28 15:30:00"
                    if "T" not in time_str and " " in time_str:
                        # Convert to ISO format
                        date_part, time_part = time_str.split(" ")
                        session_date = f"{date_part}T{time_part}+00:00"
                    else:
                        session_date = time_str
                except Exception as date_error:
                    logger.warning(f"Failed to parse session date from metadata: {date_error!s}")
            
            update_data = {
                "game_metadata": metadata,
                "processing_time_ms": processing_result.get("processing_time_ms", 0)
            }
            
            if session_date:
                update_data["session_date"] = session_date
            
            self.session_repo.update_therapy_session(session_code, update_data)
            
            logger.info(f"📊 Session metadata updated for {session_code}")
            
        except Exception as e:
            logger.exception(f"Failed to update session metadata: {e!s}")
            # Don't raise - metadata update is not critical

    async def _get_patient_duration_targets(self, patient_id: str) -> tuple[float, float] | None:
        """Get patient-specific duration targets from database."""
        try:
            response = self.supabase_client.table("patients").select(
                "current_mvc75_ch1, current_mvc75_ch2, current_target_ch1_ms, current_target_ch2_ms"
            ).eq("id", patient_id).execute()
            
            if response.data and len(response.data) > 0:
                patient = response.data[0]
                duration_ch1 = patient.get("current_target_ch1_ms")
                duration_ch2 = patient.get("current_target_ch2_ms")
                
                if duration_ch1 is not None or duration_ch2 is not None:
                    return (duration_ch1, duration_ch2)
            
            return None
            
        except Exception as e:
            logger.warning(f"Failed to get patient duration targets for {patient_id}: {e!s}")
            return None

    # Database Helper Methods
    async def _upsert_table(self, table_name: str, data: dict[str, Any], conflict_column: str) -> None:
        """Upsert data into table with conflict resolution."""
        try:
            logger.debug(f"📝 Upserting to {table_name} with conflict on {conflict_column}")
            response = self.supabase_client.table(table_name).upsert(data).execute()
            if hasattr(response, 'error') and response.error:
                logger.error(f"❌ Upsert error for {table_name}: {response.error}")
                raise DatabaseError(f"Upsert failed for {table_name}: {response.error}")
            logger.debug(f"✅ Successfully upserted to {table_name}")
        except Exception as e:
            logger.exception(f"Database upsert failed for {table_name}: {e!s}")
            raise DatabaseError(f"Database upsert failed for {table_name}: {e!s}") from e

    async def _bulk_insert_table(self, table_name: str, records: list[dict[str, Any]]) -> None:
        """Bulk insert records into table."""
        try:
            response = self.supabase_client.table(table_name).insert(records).execute()
            if hasattr(response, 'error') and response.error:
                raise DatabaseError(f"Bulk insert failed for {table_name}: {response.error}")
        except Exception as e:
            logger.exception(f"Database bulk insert failed for {table_name}: {e!s}")
            raise DatabaseError(f"Database bulk insert failed for {table_name}: {e!s}") from e

    # Session Status Management
    async def get_session_status(self, session_code: str) -> dict[str, Any] | None:
        """Get current session status and details.
        
        Args:
            session_code: Session code (e.g., P001S001)
            
        Returns:
            dict: Session details or None if not found
        """
        try:
            session = self.session_repo.get_therapy_session(session_code)
            if not session:
                return None
            
            return {
                "id": session.get("id"),
                "session_code": session_code,
                "patient_id": session.get("patient_id"),
                "file_path": session.get("file_path"),
                "processing_status": session.get("processing_status"),
                "created_at": session.get("created_at"),
                "updated_at": session.get("updated_at")
            }
            
        except Exception as e:
            logger.exception(f"Failed to get session status for {session_code}: {e!s}")
            return None

    async def update_session_status(
        self, session_code: str, status: str, error_message: str | None = None
    ) -> None:
        """Update therapy session processing status.
        Args:
            session_code: Session code (format: P###S###)
            status: New status (pending, processing, completed, failed)
            error_message: Optional error message if status is failed
        """
        try:
            # Use repository pattern for domain separation
            self.session_repo.update_session_status(session_code, status, error_message)
            logger.info(f"📊 Session {session_code} status: {status}")
        except Exception as e:
            logger.error(f"Failed to update session status: {e!s}", exc_info=True)
            raise TherapySessionError(f"Session status update failed: {e!s}") from e

    async def process_c3d_from_storage(
        self,
        session_uuid: str,
        file_path: str,
        duration_threshold: float = DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS
    ) -> dict[str, Any]:
        """Process C3D file from storage for existing session (test-compatible signature).
        
        Args:
            session_uuid: Session UUID
            file_path: Storage path to C3D file
            duration_threshold: Duration threshold in milliseconds
            
        Returns:
            dict: Processing result
        """
        try:
            # Get session code from UUID
            session = self.session_repo.get_therapy_session_by_uuid(session_uuid)
            if not session:
                raise SessionNotFoundError(f"Session {session_uuid} not found")
            
            session_code = session.get("session_code", "UNKNOWN")
            
            # Parse bucket and object path from file_path
            if "/" in file_path:
                bucket, object_path = file_path.split("/", 1)
            else:
                raise ValueError(f"Invalid file path format: {file_path}")
            
            # Use the standard process_c3d_file method
            return await self.process_c3d_file(session_code, bucket, object_path)
            
        except Exception as e:
            logger.exception(f"Failed to process C3D from storage: {e!s}")
            raise TherapySessionError(f"Processing failed: {e!s}") from e

    async def _populate_session_settings(
        self,
        session_code: str,
        session_uuid: str,
        processing_opts: ProcessingOptions,
        session_params: GameSessionParameters,
    ) -> None:
        """Populate session_settings table with MVC thresholds, duration settings, and BFR configuration.

        Schema v2.1 compliance - ensures all session configuration is properly stored
        """
        try:
            # Determine therapeutic targets with per-channel flexibility
            # Priority: C3D metadata > session parameters > development defaults
            target_ch1 = DEFAULT_TARGET_CONTRACTIONS_CH1
            target_ch2 = DEFAULT_TARGET_CONTRACTIONS_CH2
            
            if hasattr(session_params, 'c3d_metadata') and session_params.c3d_metadata:
                metadata = session_params.c3d_metadata
                target_ch1 = metadata.get('target_contractions_ch1') or target_ch1
                target_ch2 = metadata.get('target_contractions_ch2') or target_ch2
            
            # Session parameters can override defaults (graceful fallback for missing attributes)
            if session_params:
                target_ch1 = getattr(session_params, 'target_contractions_ch1', target_ch1) or target_ch1
                target_ch2 = getattr(session_params, 'target_contractions_ch2', target_ch2) or target_ch2

            # Determine per-channel duration targets with priority cascade
            # Priority 1: Session parameters (if available)
            # Priority 2: Patient profile from database
            # Priority 3: Config default from ProcessingConstants
            target_duration_ch1 = ProcessingConstants.DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS
            target_duration_ch2 = ProcessingConstants.DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS
            
            # Priority 1: Check session parameters for duration targets
            # Note: c3d_metadata attribute may not exist in current GameSessionParameters
            # This is handled gracefully with getattr fallback
            if session_params:
                c3d_metadata = getattr(session_params, 'c3d_metadata', None)
                if c3d_metadata:
                    target_duration_ch1 = c3d_metadata.get('target_duration_ch1', target_duration_ch1)
                    target_duration_ch2 = c3d_metadata.get('target_duration_ch2', target_duration_ch2)
                    if c3d_metadata.get('target_duration_ch1') or c3d_metadata.get('target_duration_ch2'):
                        logger.info(f"📊 Using duration targets from session metadata: CH1={target_duration_ch1}ms, CH2={target_duration_ch2}ms")
            
            # Priority 2: Check patient profile if not found in C3D
            patient_id = getattr(session_params, 'patient_id', None)
            if not patient_id:
                # Try to get patient_id from session
                session_info = await self.get_session_status(session_code)
                if session_info:
                    patient_id = session_info.get('patient_id')
            
            if patient_id and (target_duration_ch1 is None or target_duration_ch2 is None):
                patient_durations = await self._get_patient_duration_targets(patient_id)
                if patient_durations:
                    duration_ch1_from_patient, duration_ch2_from_patient = patient_durations
                    if target_duration_ch1 is None and duration_ch1_from_patient is not None:
                        target_duration_ch1 = duration_ch1_from_patient
                        logger.info(f"📊 Using CH1 duration from patient profile: {target_duration_ch1}ms")
                    if target_duration_ch2 is None and duration_ch2_from_patient is not None:
                        target_duration_ch2 = duration_ch2_from_patient
                        logger.info(f"📊 Using CH2 duration from patient profile: {target_duration_ch2}ms")
            
            # Priority 3: Ensure values are valid (already set to defaults above)
            if target_duration_ch1 <= 0:
                target_duration_ch1 = ProcessingConstants.DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS
                logger.info(f"📊 Using default CH1 duration from config: {target_duration_ch1}ms")
            if target_duration_ch2 <= 0:
                target_duration_ch2 = ProcessingConstants.DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS
                logger.info(f"📊 Using default CH2 duration from config: {target_duration_ch2}ms")

            session_settings_data = {
                "session_id": session_uuid,
                # Therapeutic targets (flexible per-channel)
                "target_contractions_ch1": target_ch1,
                "target_contractions_ch2": target_ch2,
                # Per-channel duration targets in milliseconds
                "target_duration_ch1_ms": float(target_duration_ch1),
                "target_duration_ch2_ms": float(target_duration_ch2),
                # Note: therapist_id removed from session_settings as per schema optimization
                # MVC configuration from processing options
                "mvc_threshold_percentage": getattr(
                    processing_opts, "mvc_threshold_percentage", 75.0
                ),
                # BFR settings - enabled by default for GHOSTLY+ protocol
                "bfr_enabled": getattr(session_params, "bfr_enabled", True) if session_params else True,
                # Note: Removed deprecated fields:
                # - duration_threshold_seconds (replaced by per-channel targets)
                # - target_contractions (redundant sum)
                # - expected_contractions_per_muscle (redundant average)
            }

            # Validate critical thresholds
            if (
                session_settings_data["mvc_threshold_percentage"] <= 0
                or session_settings_data["mvc_threshold_percentage"] > 100
            ):
                logger.warning(
                    f"Invalid MVC threshold {session_settings_data['mvc_threshold_percentage']}%, using default 75%"
                )
                session_settings_data["mvc_threshold_percentage"] = 75.0

            # Validate duration targets
            if session_settings_data["target_duration_ch1_ms"] <= 0:
                logger.warning(
                    f"Invalid CH1 duration target {session_settings_data['target_duration_ch1_ms']}ms, using default 2000ms"
                )
                session_settings_data["target_duration_ch1_ms"] = 2000.0
            
            if session_settings_data["target_duration_ch2_ms"] <= 0:
                logger.warning(
                    f"Invalid CH2 duration target {session_settings_data['target_duration_ch2_ms']}ms, using default 2000ms"
                )
                session_settings_data["target_duration_ch2_ms"] = 2000.0

            # Use upsert to handle potential duplicates
            await self._upsert_table("session_settings", session_settings_data, "session_id")

            logger.info(
                f"📊 Session settings populated for session {session_code}: "
                f"MVC {session_settings_data['mvc_threshold_percentage']}%, "
                f"Duration CH1={session_settings_data['target_duration_ch1_ms']}ms CH2={session_settings_data['target_duration_ch2_ms']}ms, "
                f"BFR {'enabled' if session_settings_data['bfr_enabled'] else 'disabled'}"
            )
            
        except Exception as e:
            logger.exception(f"Session settings population failed: {e!s}")
            raise DatabaseError(f"Session settings population failed: {e!s}") from e

    async def _upsert_table_with_composite_key(
        self, 
        table_name: str, 
        data: dict[str, Any], 
        composite_keys: list[str]
    ) -> None:
        """Upsert data into table with composite key conflict resolution.
        
        For tables like bfr_monitoring that use composite primary keys (session_id, channel_name).
        """
        try:
            # Build query to check for existing record with all composite key values
            query = self.supabase_client.table(table_name).select("*")
            for key in composite_keys:
                if key in data:
                    query = query.eq(key, data[key])
            
            # Check if record exists
            response = query.execute()
            
            if response.data and len(response.data) > 0:
                # Record exists, update it
                update_query = self.supabase_client.table(table_name).update(data)
                for key in composite_keys:
                    if key in data:
                        update_query = update_query.eq(key, data[key])
                
                update_response = update_query.execute()
                if hasattr(update_response, 'error') and update_response.error:
                    raise DatabaseError(f"Update failed for {table_name}: {update_response.error}")
                    
                logger.info(f"📝 Updated existing record in {table_name}")
            else:
                # Record doesn't exist, insert it
                insert_response = self.supabase_client.table(table_name).insert(data).execute()
                if hasattr(insert_response, 'error') and insert_response.error:
                    raise DatabaseError(f"Insert failed for {table_name}: {insert_response.error}")
                    
                logger.info(f"➕ Inserted new record into {table_name}")
                
        except Exception as e:
            logger.exception(f"Composite key upsert failed for {table_name}: {e!s}")
            raise DatabaseError(f"Composite key upsert failed for {table_name}: {e!s}") from e

    async def _populate_bfr_monitoring(
        self,
        session_code: str,
        session_uuid: str,
        session_params: GameSessionParameters,
        processing_result: dict[str, Any]
    ) -> None:
        """Populate BFR monitoring table with per-channel safety data.
        
        Creates separate records for CH1 and CH2 with composite key (session_id, channel_name).
        Uses development defaults when BFR data not available from C3D metadata.
        """
        try:
            # Import SessionDefaults here to avoid circular imports
            from config import SessionDefaults
            
            analytics = processing_result.get("analytics", {})
            
            # Create BFR monitoring records for each channel
            for channel_name in ["CH1", "CH2"]:
                # Get channel-specific BFR data from session parameters or use defaults
                target_pressure_aop = ProcessingConstants.TARGET_PRESSURE_AOP  # 50.0% from config
                actual_pressure_aop = ProcessingConstants.TARGET_PRESSURE_AOP  # 50.0% from config
                
                # Check if session_params has per-channel BFR data (graceful fallback)
                if session_params:
                    bfr_pressure_per_channel = getattr(session_params, 'bfr_pressure_per_channel', None)
                    if bfr_pressure_per_channel and channel_name in bfr_pressure_per_channel:
                        channel_bfr = bfr_pressure_per_channel[channel_name]
                        target_pressure_aop = channel_bfr.get('target_pressure_aop', target_pressure_aop)
                        actual_pressure_aop = channel_bfr.get('actual_pressure_aop', actual_pressure_aop)
                
                # Calculate cuff pressure from AOP percentage (conversion factor: AOP * 3.0)
                cuff_pressure_mmhg = actual_pressure_aop * 3.0
                
                # Determine safety compliance (40-60% AOP is considered safe range)
                safety_compliant = 40.0 <= actual_pressure_aop <= 60.0
                
                # Determine measurement method (sensor if both values present, calculated otherwise)
                measurement_method = "sensor" if target_pressure_aop and actual_pressure_aop else "calculated"
                
                bfr_data = {
                    "session_id": session_uuid,
                    "channel_name": channel_name,
                    "target_pressure_aop": target_pressure_aop,
                    "actual_pressure_aop": actual_pressure_aop,
                    "cuff_pressure_mmhg": cuff_pressure_mmhg,
                    "safety_compliant": safety_compliant,
                    "measurement_method": measurement_method,
                    # Blood pressure fields removed per user request - no longer computed
                    # "systolic_bp_mmhg": None,
                    # "diastolic_bp_mmhg": None,
                    # Note: compliance_score and safety_alert_triggered are calculated fields in the database
                }
                
                # Use composite key upsert for proper per-channel handling
                await self._upsert_table_with_composite_key(
                    "bfr_monitoring", bfr_data, ["session_id", "channel_name"]
                )
            
            logger.info(
                f"🩸 BFR monitoring populated for session {session_code}: "
                f"CH1 AOP={target_pressure_aop}%, CH2 AOP={target_pressure_aop}%"
            )
            
        except Exception as e:
            logger.exception(f"BFR monitoring population failed: {e!s}")
            raise DatabaseError(f"BFR monitoring population failed: {e!s}") from e

    def _cleanup_temp_file(self, file_path: str) -> None:
        """Clean up temporary file with comprehensive error handling.
        
        Args:
            file_path: Path to temporary file to clean up
        """
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"🧹 Cleaned up temporary file: {file_path}")
            else:
                logger.warning(f"⚠️ Temporary file not found during cleanup: {file_path}")
        except Exception as e:
            logger.warning(f"⚠️ Failed to clean up temporary file {file_path}: {e!s}")

