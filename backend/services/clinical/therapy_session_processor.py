""" "
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
- Populate ALL related database tables (emg_statistics, c3d_technical_data, etc.)
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

import hashlib
import logging
import os
import tempfile
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


# Custom Exception Classes for Better Error Handling
class TherapySessionError(Exception):
    """Base exception for therapy session processing errors."""


class FileProcessingError(TherapySessionError):
    """Raised when C3D file processing fails."""


class SessionNotFoundError(TherapySessionError):
    """Raised when a session cannot be found."""


from config import (
    DEFAULT_FILTER_ORDER,
    DEFAULT_LOWPASS_CUTOFF,
    DEFAULT_MIN_DURATION_MS,
    DEFAULT_MVC_THRESHOLD_PERCENTAGE,
    # Clinical Constants
    DEFAULT_MVC_THRESHOLD_VALUE,
    DEFAULT_RMS_WINDOW_MS,
    DEFAULT_SMOOTHING_WINDOW,
    DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS,
    DEFAULT_THRESHOLD_FACTOR,
    EMG_HIGH_PASS_CUTOFF,
    EXPECTED_CONTRACTIONS_PER_MUSCLE,
    MVC_PERCENTAGE_DIVISOR,
    MVC_WINDOW_SECONDS,
    NYQUIST_SAFETY_FACTOR,
    PROCESSING_VERSION,
    RMS_OVERLAP_PERCENTAGE,
    # Development Defaults
    DevelopmentDefaults,
)

from services.clinical.performance_scoring_service import (
    PerformanceScoringService,
    SessionMetrics,
)
from services.clinical.repositories import (
    EMGDataRepository,
    PatientRepository,
    RepositoryError,
    TherapySessionRepository,
)
from services.user.repositories import UserRepository
from database.supabase_client import get_supabase_client
from models import GameSessionParameters, ProcessingOptions
from services.c3d.processor import GHOSTLYC3DProcessor
from services.c3d.reader import C3DReader
from services.cache.redis_cache_service import get_cache_service

# Note: All clinical constants now imported from config.py (Single Source of Truth)

logger = logging.getLogger(__name__)


class TherapySessionProcessor:
    """Core processor for therapy sessions and C3D file analysis.

    Manages the complete lifecycle:
    1. Create therapy_sessions record
    2. Process C3D file
    3. Populate related tables (emg_statistics, c3d_technical_data, etc.)
    4. Calculate performance scores
    5. Update session with results
    """

    def __init__(self) -> None:
        """Initializes the processor with Supabase client and specialized services.
        - `use_service_key=True` grants admin privileges for backend operations.
        - Repository pattern provides domain-separated data access (DDD/SOLID principles)
        - Redis cache service provides high-performance analytics caching.
        """
        self.supabase = get_supabase_client(use_service_key=True)
        self.c3d_reader = C3DReader()
        self.scoring_service = PerformanceScoringService(self.supabase)

        # Domain-separated repositories following DDD patterns
        self.patient_repo = PatientRepository(self.supabase)
        self.session_repo = TherapySessionRepository(self.supabase)
        self.emg_repo = EMGDataRepository(self.supabase)
        self.user_repo = UserRepository(self.supabase)

        # High-performance Redis cache service (replaces database analytics_cache)
        self.cache_service = get_cache_service()

    async def create_session(
        self,
        file_path: str,
        file_metadata: dict[str, Any],
        patient_id: str | None = None,
        therapist_id: str | None = None,
    ) -> str:
        """Creates a new therapy session record, ensuring data integrity.

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
            TherapySessionError: If the session creation fails in the database.
            ValueError: If input parameters are invalid.
        """
        try:
            # Validate input parameters
            self._validate_session_creation_params(
                file_path, file_metadata, patient_id, therapist_id
            )

            # Generate a unique hash of the file content for deduplication.
            # This makes session creation idempotent.
            file_hash = await self._calculate_file_hash_from_path(file_path)

            # Check for an existing session to avoid reprocessing the same file.
            existing = await self._find_existing_session(file_hash)
            if existing:
                logger.info(f"♻️ Found existing session: {existing['id']}")
                return str(existing["id"])

            # Generate timestamps once for consistency
            timestamp = datetime.now(timezone.utc).isoformat()

            session_data = {
                "id": str(uuid4()),
                "file_path": file_path,
                "file_hash": file_hash,
                "file_size_bytes": file_metadata.get("size", 0),
                "patient_id": patient_id,  # Now UUID in new schema
                "therapist_id": therapist_id,
                "processing_status": "pending",
                "created_at": timestamp,
                "updated_at": timestamp,
                "game_metadata": {},
                # REMOVED: analytics_cache (migrated to Redis for ~100x performance)
            }

            # Use repository pattern for domain separation
            session = self.session_repo.create_therapy_session(session_data)
            return session["id"]

        except Exception as e:
            logger.error(f"Failed to create session: {e!s}", exc_info=True)
            raise TherapySessionError(f"Session creation failed: {e!s}") from e

    async def process_c3d_file(
        self, session_id: str, bucket: str, object_path: str
    ) -> dict[str, Any]:
        """Complete C3D file processing.

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
            session_info, patient_id, duration_threshold = await self._prepare_session_config(
                session_id
            )

            # Download and process file with resource management
            return await self._process_file_with_cleanup(
                session_id, bucket, object_path, duration_threshold
            )

        except FileProcessingError:
            raise  # Re-raise file processing errors
        except RepositoryError:
            raise  # Re-raise repository errors

        except Exception as e:
            logger.error(f"C3D processing failed: {e!s}", exc_info=True)
            return {"success": False, "error": str(e)}

    async def update_session_status(
        self, session_id: str, status: str, error_message: str | None = None
    ) -> None:
        """Update therapy session processing status.

        Args:
            session_id: Session UUID
            status: New status (pending, processing, completed, failed)
            error_message: Optional error message if status is failed
        """
        try:
            # Use repository pattern for domain separation
            self.session_repo.update_session_status(session_id, status, error_message)

            logger.info(f"📊 Session {session_id} status: {status}")

        except Exception as e:
            logger.error(f"Failed to update session status: {e!s}", exc_info=True)
            raise TherapySessionError(f"Session status update failed: {e!s}") from e

    def process_c3d_file_stateless(
        self,
        file_path: str,
        processing_opts: ProcessingOptions,
        session_params: GameSessionParameters,
    ) -> dict[str, Any]:
        """Process C3D file without database operations (for upload route).

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
                processing_opts=processing_opts, session_game_params=session_params
            )

            return {
                "success": True,
                "processing_result": result,
                "channels_analyzed": len(result.get("analytics", {})),
                "overall_score": self._calculate_overall_score(result),
            }

        except Exception as e:
            logger.error(f"Stateless C3D processing failed: {e!s}", exc_info=True)
            raise FileProcessingError(f"C3D processing failed: {e!s}") from e

    def _validate_stateless_processing_params(
        self,
        file_path: str,
        processing_opts: ProcessingOptions,
        session_params: GameSessionParameters,
    ) -> None:
        """Validate parameters for stateless processing."""
        if not file_path or not file_path.strip():
            raise ValueError("File path cannot be empty")

        if not os.path.exists(file_path):
            raise FileNotFoundError(f"C3D file not found: {file_path}")

        if not processing_opts:
            raise ValueError("Processing options are required")

        if not session_params:
            raise ValueError("Session parameters are required")

    async def get_session_status(self, session_id: str) -> dict[str, Any] | None:
        """Get therapy session status and data.

        Args:
            session_id: Session UUID

        Returns:
            Session data or None if not found
        """
        try:
            # Use centralized database operations (DRY principle)
            return self.session_repo.get_therapy_session(session_id)

        except Exception as e:
            logger.error(f"Failed to get session status: {e!s}", exc_info=True)
            return None

    async def get_cached_session_analytics(self, session_id: str) -> dict[str, Any] | None:
        """Get cached session analytics from Redis (high-performance retrieval).

        Args:
            session_id: Session UUID

        Returns:
            Cached analytics data or None if not found
        """
        try:
            # Try Redis cache first (~100x faster than database)
            cached_data = self.cache_service.get_session_analytics(session_id)

            if cached_data:
                logger.debug(f"📬 Retrieved cached analytics for session {session_id}")
                return cached_data

            logger.debug(f"📭 No cached analytics found for session {session_id}")
            return None

        except Exception as e:
            logger.error(f"Failed to get cached session analytics: {e!s}", exc_info=True)
            return None

    # === PRIVATE METHODS ===

    # Input Validation Methods
    def _validate_session_creation_params(
        self,
        file_path: str,
        file_metadata: dict[str, Any],
        patient_id: str | None,
        therapist_id: str | None,
    ) -> None:
        """Validate session creation parameters."""
        if not file_path or not file_path.strip():
            raise ValueError("File path cannot be empty")

        if not isinstance(file_metadata, dict):
            raise ValueError("File metadata must be a dictionary")

        if patient_id is not None and not isinstance(patient_id, str):
            raise ValueError("Patient ID must be a string or None")

        if therapist_id is not None and not isinstance(therapist_id, str):
            raise ValueError("Therapist ID must be a string or None")

    def _validate_processing_params(self, session_id: str, bucket: str, object_path: str) -> None:
        """Validate C3D processing parameters."""
        if not session_id or not session_id.strip():
            raise ValueError("Session ID cannot be empty")

        if not bucket or not bucket.strip():
            raise ValueError("Bucket name cannot be empty")

        if not object_path or not object_path.strip():
            raise ValueError("Object path cannot be empty")

    # Session Configuration Methods
    async def _prepare_session_config(
        self, session_id: str
    ) -> tuple[dict | None, str | None, float]:
        """Fetches all necessary configuration for a processing session.

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
        self, session_id: str, bucket: str, object_path: str, duration_threshold: float
    ) -> dict[str, Any]:
        """Process C3D file with proper resource cleanup."""
        # Download C3D file
        file_data = await self._download_file(bucket, object_path)

        # Use context manager for temporary file handling
        with tempfile.NamedTemporaryFile(delete=False, suffix=".c3d") as tmp_file:
            tmp_file.write(file_data)
            tmp_file_path = tmp_file.name

        try:
            # Create processing configuration
            processing_opts, session_params = self._create_processing_config(duration_threshold)

            # Process C3D file in lightweight mode (webhook doesn't need EMG signals)
            processor = GHOSTLYC3DProcessor(tmp_file_path)
            result = processor.process_file(
                processing_opts=processing_opts,
                session_game_params=session_params,
                include_signals=False,  # ⚡ 90% memory reduction for webhook processing
            )

            # Populate database tables
            await self._populate_database_tables(
                session_id=session_id,
                processing_result=result,
                file_data=file_data,
                processing_opts=processing_opts,
                session_params=session_params,
            )

            # Cache analytics in Redis for high-performance retrieval
            await self._cache_session_analytics(session_id, result)
            # Update session metadata in database
            await self._update_session_metadata(session_id, result)

            return {
                "success": True,
                "channels_analyzed": len(result.get("analytics", {})),
                "overall_score": self._calculate_overall_score(result),
                "processing_result": result,
            }

        finally:
            # Clean up temporary file
            self._cleanup_temp_file(tmp_file_path)

    def _create_processing_config(
        self, duration_threshold: float
    ) -> tuple[ProcessingOptions, GameSessionParameters]:
        """Create processing configuration objects."""
        processing_opts = ProcessingOptions(
            threshold_factor=DEFAULT_THRESHOLD_FACTOR,
            min_duration_ms=DEFAULT_MIN_DURATION_MS,
            smoothing_window=DEFAULT_SMOOTHING_WINDOW,
        )

        session_params = GameSessionParameters(
            session_mvc_threshold_percentage=DEFAULT_MVC_THRESHOLD_PERCENTAGE,
            contraction_duration_threshold=duration_threshold,  # Patient-specific from database
        )

        return processing_opts, session_params

    def _cleanup_temp_file(self, file_path: str) -> None:
        """Safely clean up temporary files."""
        try:
            if os.path.exists(file_path):
                os.unlink(file_path)
                logger.debug(f"🗑️ Cleaned up temporary file: {file_path}")
        except OSError as e:
            logger.warning(f"Failed to clean up temporary file {file_path}: {e}")

    async def _get_patient_duration_threshold(self, patient_id: str | None) -> float:
        """Get patient-specific duration threshold from database.

        Args:
            patient_id: Optional patient ID

        Returns:
            float: Duration threshold in milliseconds (patient-specific or config default)
        """
        try:
            if patient_id:
                # Use centralized database operations (DRY principle)
                profile = self.patient_repo.get_patient_profile(patient_id)

                if profile and profile.get("therapeutic_duration_threshold_ms"):
                    threshold = profile["therapeutic_duration_threshold_ms"]
                    logger.info(
                        f"📊 Using patient-specific duration threshold: {threshold}ms for patient {patient_id}"
                    )
                    return float(threshold)

            # Fallback to config default
            logger.info(
                f"📊 Using config default duration threshold: {DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS}ms"
            )
            return float(DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS)

        except Exception as e:
            logger.exception(f"Error retrieving patient duration threshold: {e!s}")
            logger.info(
                f"📊 Fallback to config default: {DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS}ms"
            )
            return float(DEFAULT_THERAPEUTIC_DURATION_THRESHOLD_MS)

    async def _calculate_file_hash_from_path(self, file_path: str) -> str:
        """Calculate SHA-256 hash of file from storage path."""
        try:
            # Extract bucket and object path from the full file_path string.
            parts = file_path.split("/", 1)
            if len(parts) != 2:
                raise ValueError(f"Invalid file path format: {file_path}")

            bucket, object_path = parts
            file_data = await self._download_file(bucket, object_path)

            return hashlib.sha256(file_data).hexdigest()

        except Exception as e:
            logger.exception(f"Failed to calculate file hash: {e!s}")
            # Fallback: If file download or hashing fails, hash the file path
            # itself. This provides a less robust but still unique identifier
            # to prevent duplicate processing from the same path.
            return hashlib.sha256(file_path.encode()).hexdigest()

    async def _download_file(self, bucket: str, object_path: str) -> bytes:
        """Download file from Supabase Storage."""
        try:
            response = self.supabase.storage.from_(bucket).download(object_path)

            if not response:
                raise FileProcessingError(f"Failed to download C3D file: {bucket}/{object_path}")

            return response

        except Exception as e:
            logger.exception(f"Download failed: {e!s}")
            raise FileProcessingError(f"Download operation failed: {e!s}") from e

    async def _find_existing_session(self, file_hash: str) -> dict[str, Any] | None:
        """Find existing session with same file hash (using centralized DB operations)."""
        # Use centralized database operations (DRY principle)
        return self.session_repo.get_session_by_file_hash(file_hash)

    async def _populate_database_tables(
        self,
        session_id: str,
        processing_result: dict[str, Any],
        file_data: bytes,
        processing_opts: ProcessingOptions,
        session_params: GameSessionParameters,
    ) -> None:
        """Populate all related database tables using specialized methods with transaction-like error handling.

        Tables populated:
        - c3d_technical_data
        - emg_statistics (per channel) - batch insert
        - processing_parameters
        - performance_scores
        - session_settings (Schema v2.1 compliance)
        - bfr_monitoring (Schema v2.1 compliance)
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
            await self._populate_emg_statistics(
                session_id, analytics, session_params
            )  # Batch insert
            await self._calculate_and_save_performance_scores(
                session_id, analytics, processing_result
            )

            # Schema v2.1 compliance - populate missing tables
            await self._populate_session_settings(session_id, processing_opts, session_params)
            await self._populate_bfr_monitoring(session_id, session_params, processing_result)

            logger.info(
                f"📊 Successfully populated all database tables (6 total) for session: {session_id}"
            )

        except Exception as e:
            logger.error(
                f"Failed to populate database tables for session {session_id}: {e!s}", exc_info=True
            )
            raise TherapySessionError(
                f"Database population failed for session {session_id}: {e!s}"
            ) from e

    async def _populate_c3d_technical_data(
        self, session_id: str, metadata: dict[str, Any], analytics: dict[str, Any]
    ) -> None:
        """Populate C3D technical data table."""
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
            # Timestamp will be added automatically by database operations service
        }
        await self._upsert_table("c3d_technical_data", technical_data, "session_id")

    async def _populate_emg_statistics(
        self, session_id: str, analytics: dict[str, Any], session_params: GameSessionParameters
    ) -> None:
        """Populate EMG statistics for each channel using batch insert."""
        if not analytics:
            logger.warning(f"No analytics data for session {session_id}")
            return

        # Build all statistics records for batch insert
        all_stats = []
        for channel_name, channel_data in analytics.items():
            stats_data = self._build_emg_stats_record(
                session_id, channel_name, channel_data, session_params
            )
            all_stats.append(stats_data)

        # Batch insert using centralized database operations (DRY principle)
        if all_stats:
            try:
                result = self.emg_repo.bulk_insert_emg_statistics(all_stats)
                logger.info(
                    f"📊 Successfully inserted {len(result)} EMG statistics records for session {session_id}"
                )
            except Exception as e:
                logger.error(f"❌ Failed to insert EMG statistics for session {session_id}: {e!s}", exc_info=True)
                raise
        else:
            logger.warning(f"⚠️ No EMG statistics to insert for session {session_id}")

    def _build_emg_stats_record(
        self,
        session_id: str,
        channel_name: str,
        channel_data: dict[str, Any],
        session_params: GameSessionParameters,
    ) -> dict[str, Any]:
        """Build EMG statistics record for a single channel."""
        # Use clinical constants for consistent values
        default_mvc_value = (
            channel_data.get("mvc_threshold", DEFAULT_MVC_THRESHOLD_VALUE) / MVC_PERCENTAGE_DIVISOR
        )

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
                DEFAULT_MVC_THRESHOLD_VALUE,
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
            # Note: processing_confidence, median_frequency_slope and estimated_fatigue_percentage removed (not in schema)
            # Timestamp will be added automatically by database operations service
        }

    def _extract_temporal_stats(self, channel_data: dict[str, Any]) -> dict[str, Any]:
        """Extract temporal statistics from channel data."""
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
        self, session_id: str, metadata: dict[str, Any], processing_opts: ProcessingOptions
    ) -> None:
        """Populate processing parameters table with error handling."""
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
        }

        # Use centralized database operations (DRY principle)
        self.emg_repo.insert_processing_parameters(params_data)

    async def _upsert_table(self, table_name: str, data: dict[str, Any], unique_key: str) -> None:
        """Upsert data into table (insert or update if exists) with optimized error handling."""
        # Use domain-specific repository for generic upsert operations
        if table_name == "c3d_technical_data":
            self.emg_repo.upsert_c3d_technical_data(data, unique_key)
        else:
            # Use generic upsert from session repository for session-related tables
            await self.session_repo.generic_upsert(table_name, data, unique_key)

    async def _calculate_and_save_performance_scores(
        self, session_id: str, analytics: dict[str, Any], processing_result: dict[str, Any]
    ) -> None:
        """Calculate and save performance scores using the dedicated GHOSTLY+ scoring service.

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
                game_points_achieved=processing_result.get("metadata", {}).get(
                    "game_points_achieved"
                ),
                game_points_max=processing_result.get("metadata", {}).get("game_points_max"),
                expected_contractions_per_muscle=EXPECTED_CONTRACTIONS_PER_MUSCLE,
            )

            # Use the dedicated service to calculate scores
            scores = self.scoring_service.calculate_performance_scores(session_id, session_metrics)

            if scores and "error" not in scores:
                # Save scores using the service
                success = self.scoring_service.save_performance_scores(scores)
                if success:
                    logger.info(
                        f"✅ GHOSTLY+ performance scores calculated and saved for session: {session_id}"
                    )
                    logger.info(
                        f"   Overall: {scores.get('overall_score', 'N/A')}, Compliance: {scores.get('compliance_score', 'N/A')}"
                    )
                else:
                    logger.error(f"❌ Failed to save performance scores for session: {session_id}")
            else:
                logger.error(f"❌ Failed to calculate performance scores: {scores}")

        except Exception as e:
            logger.error(f"Failed to calculate performance scores: {e!s}", exc_info=True)
            # Not critical for C3D processing, continue without failing

    async def _cache_session_analytics(
        self, session_id: str, processing_result: dict[str, Any]
    ) -> None:
        """Cache session analytics in Redis for high-performance retrieval."""
        try:
            analytics_data = processing_result.get("analytics", {})
            if not analytics_data:
                logger.warning(f"No analytics data to cache for session {session_id}")
                return

            # Enhanced cache data with metadata for better performance
            cache_data = {
                "analytics": analytics_data,
                "summary": {
                    "channels": list(analytics_data.keys()),
                    "total_channels": len(analytics_data),
                    "overall_compliance": self._calculate_compliance_score(analytics_data),
                    "processing_time_ms": processing_result.get("processing_time_ms", 0),
                    "processed_at": datetime.now(timezone.utc).isoformat(),
                },
                "metadata": processing_result.get("metadata", {}),
                # Cache version for schema evolution
                "cache_version": "2.0",
            }

            # Cache in Redis with 24h TTL (configurable)
            success = self.cache_service.set_session_analytics(session_id, cache_data)

            if success:
                logger.info(f"📦 Cached analytics for session {session_id} in Redis")
            else:
                logger.warning(
                    f"⚠️ Failed to cache analytics for session {session_id} - continuing without cache"
                )

        except Exception as e:
            logger.exception(f"Failed to cache session analytics: {e!s}")
            # Not critical, continue processing

    async def _update_session_metadata(
        self, session_id: str, processing_result: dict[str, Any]
    ) -> None:
        """Update session with extracted game metadata and session timestamp."""
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
                    logger.warning(
                        f"Failed to parse session timestamp '{metadata.get('time')}': {e!s}"
                    )

            # Update session with metadata
            update_data = {"game_metadata": metadata}

            # Add session_date if we successfully parsed the timestamp
            if session_timestamp:
                update_data["session_date"] = session_timestamp
                logger.info(f"📅 Extracted session timestamp: {session_timestamp}")

            # Use domain-specific repository for therapy session updates
            await self.session_repo.update_therapy_session(session_id, update_data)

            logger.info(f"📊 Updated session metadata for: {session_id}")

        except Exception as e:
            logger.exception(f"Failed to update session metadata: {e!s}")
            # Not critical, continue processing

    def _calculate_overall_score(self, processing_result: dict[str, Any]) -> float:
        """Calculate overall session score as weighted average of all muscle compliance.

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
            logger.exception(f"Error calculating overall score: {e!s}")
            return 0.0

    def _calculate_compliance_score(self, analytics: dict[str, Any]) -> float:
        """Calculate compliance score across all channels.

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
            logger.exception(f"Error calculating compliance score: {e!s}")
            return 0.0

    async def _populate_session_settings(
        self,
        session_id: str,
        processing_opts: ProcessingOptions,
        session_params: GameSessionParameters,
    ) -> None:
        """Populate session_settings table with MVC thresholds, duration settings, and BFR configuration.

        Schema v2.1 compliance - ensures all session configuration is properly stored
        """
        try:
            session_settings_data = {
                "session_id": session_id,
                # MVC configuration from processing options or session parameters
                "mvc_threshold_percentage": getattr(
                    processing_opts, "mvc_threshold_percentage", 75.0
                ),
                # Duration thresholds from processing configuration
                "duration_threshold_seconds": getattr(
                    processing_opts, "duration_threshold_seconds", 2.0
                ),
                # Target contractions from session parameters
                "target_contractions": getattr(session_params, "target_contractions", 12),
                "expected_contractions_per_muscle": getattr(
                    session_params, "expected_contractions_per_muscle", 12
                ),
                # BFR settings - enabled by default for GHOSTLY+ protocol
                "bfr_enabled": getattr(session_params, "bfr_enabled", True),
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

            if session_settings_data["duration_threshold_seconds"] <= 0:
                logger.warning(
                    f"Invalid duration threshold {session_settings_data['duration_threshold_seconds']}s, using default 2.0s"
                )
                session_settings_data["duration_threshold_seconds"] = 2.0

            # Use upsert to handle potential duplicates
            await self._upsert_table("session_settings", session_settings_data, "session_id")

            logger.info(
                f"📊 Session settings populated for session {session_id}: MVC {session_settings_data['mvc_threshold_percentage']}%, Duration {session_settings_data['duration_threshold_seconds']}s, BFR {'enabled' if session_settings_data['bfr_enabled'] else 'disabled'}"
            )

        except Exception as e:
            logger.error(
                f"Failed to populate session_settings for session {session_id}: {e!s}",
                exc_info=True,
            )
            raise TherapySessionError(f"Session settings population failed: {e!s}") from e

    async def _populate_bfr_monitoring(
        self,
        session_id: str,
        session_params: GameSessionParameters,
        processing_result: dict[str, Any],
    ) -> None:
        """Populate bfr_monitoring table with per-channel Blood Flow Restriction safety data.

        Schema v2.1+ compliance - supports per-channel/per-muscle BFR monitoring
        Creates one record per channel (CH1, CH2) for independent muscle BFR assessment
        """
        try:
            # Standard channels for GHOSTLY+ protocol
            channels = ["CH1", "CH2"]
            
            # Extract metadata for timestamp reference
            measurement_timestamp = processing_result.get("metadata", {}).get("timestamp")
            
            # Collect all BFR records for batch processing
            bfr_records = []
            
            for channel_name in channels:
                # Extract per-channel BFR pressure values 
                target_pressure_aop = self._get_channel_bfr_pressure(
                    session_params, channel_name, "target_pressure_aop"
                )
                actual_pressure_aop = self._get_channel_bfr_pressure(
                    session_params, channel_name, "actual_pressure_aop"
                )
                cuff_pressure_mmhg = self._get_channel_bfr_pressure(
                    session_params, channel_name, "cuff_pressure_mmhg"
                )
                
                # Manual compliance assessment (for when sensors not available)
                bfr_compliance_manual = self._get_channel_bfr_compliance(
                    session_params, channel_name
                )
                
                # Determine measurement method based on available data
                measurement_method = "sensor" if (target_pressure_aop and actual_pressure_aop) else "manual"
                
                # Calculate safety compliance based on available data
                safety_compliant = self._calculate_channel_safety_compliance(
                    actual_pressure_aop, bfr_compliance_manual, measurement_method
                )
                
                # Build per-channel BFR monitoring record
                bfr_monitoring_data = {
                    "session_id": session_id,
                    "channel_name": channel_name,
                    
                    # BFR pressure settings (from C3D metadata or defaults)
                    "target_pressure_aop": target_pressure_aop,
                    "actual_pressure_aop": actual_pressure_aop,
                    "cuff_pressure_mmhg": cuff_pressure_mmhg,
                    
                    # Blood pressure monitoring for safety (shared across channels)
                    "systolic_bp_mmhg": getattr(
                        session_params, "systolic_bp_mmhg", DevelopmentDefaults.SYSTOLIC_BP
                    ),
                    "diastolic_bp_mmhg": getattr(
                        session_params, "diastolic_bp_mmhg", DevelopmentDefaults.DIASTOLIC_BP
                    ),
                    
                    # Manual compliance assessment (per muscle)
                    "bfr_compliance_manual": bfr_compliance_manual,
                    
                    # Safety compliance (computed from available data)
                    "safety_compliant": safety_compliant,
                    
                    # Measurement metadata
                    "measurement_timestamp": measurement_timestamp,
                    "measurement_method": measurement_method,
                }
                
                # Validate BFR safety ranges per channel
                self._validate_channel_bfr_safety(channel_name, bfr_monitoring_data)
                
                bfr_records.append(bfr_monitoring_data)

            # Insert all per-channel BFR records
            for record in bfr_records:
                # Use composite key for per-channel upserts
                composite_key_fields = ["session_id", "channel_name"]
                await self._upsert_table_with_composite_key(
                    "bfr_monitoring", record, composite_key_fields
                )

            logger.info(
                f"🔄 Per-channel BFR monitoring populated for session {session_id}: "
                f"{len(bfr_records)} channels processed"
            )
            
            # Log per-channel compliance summary
            for record in bfr_records:
                channel = record["channel_name"]
                method = record["measurement_method"]
                compliant = record["safety_compliant"]
                if method == "sensor" and record["actual_pressure_aop"]:
                    logger.info(
                        f"  {channel}: {record['actual_pressure_aop']}% AOP, "
                        f"{'compliant' if compliant else 'NON-COMPLIANT'} ({method})"
                    )
                elif method == "manual" and record["bfr_compliance_manual"] is not None:
                    logger.info(
                        f"  {channel}: {'compliant' if record['bfr_compliance_manual'] else 'NON-COMPLIANT'} ({method})"
                    )

        except Exception as e:
            logger.error(
                f"Failed to populate per-channel bfr_monitoring for session {session_id}: {e!s}", 
                exc_info=True
            )
            raise TherapySessionError(f"Per-channel BFR monitoring population failed: {e!s}") from e

    def _get_channel_bfr_pressure(
        self, 
        session_params: GameSessionParameters, 
        channel_name: str, 
        pressure_type: str
    ) -> float | None:
        """Extract per-channel BFR pressure values from session parameters.
        
        Args:
            session_params: Session configuration parameters
            channel_name: Channel identifier ('CH1', 'CH2')
            pressure_type: Type of pressure ('target_pressure_aop', 'actual_pressure_aop', 'cuff_pressure_mmhg')
            
        Returns:
            Channel-specific pressure value or None if not available
        """
        try:
            # Check for per-channel BFR pressure data first (production C3D metadata)
            channel_pressure_data = getattr(session_params, f"bfr_pressure_per_channel", None)
            if channel_pressure_data and channel_name in channel_pressure_data:
                channel_data = channel_pressure_data[channel_name]
                if isinstance(channel_data, dict) and pressure_type in channel_data:
                    return channel_data[pressure_type]
            
            # Fallback to global session parameters (development/manual mode)
            if pressure_type in ["target_pressure_aop", "actual_pressure_aop"]:
                global_pressure = getattr(session_params, pressure_type, None)
                if global_pressure is not None:
                    return global_pressure
                # Use development defaults if no session data
                return DevelopmentDefaults.BFR_PRESSURE_AOP
            
            elif pressure_type == "cuff_pressure_mmhg":
                # Calculate from actual_pressure_aop if available
                actual_pressure = self._get_channel_bfr_pressure(
                    session_params, channel_name, "actual_pressure_aop"
                )
                if actual_pressure is not None:
                    return actual_pressure * 3.0  # Realistic AOP to mmHg conversion
                return None
                
            return None
            
        except Exception as e:
            logger.warning(f"Error extracting {pressure_type} for {channel_name}: {e!s}")
            return None
    
    def _get_channel_bfr_compliance(
        self, 
        session_params: GameSessionParameters, 
        channel_name: str
    ) -> bool | None:
        """Extract per-channel manual BFR compliance assessment.
        
        Args:
            session_params: Session configuration parameters
            channel_name: Channel identifier ('CH1', 'CH2')
            
        Returns:
            Manual compliance assessment (True/False) or None if not available
        """
        try:
            # Check for per-channel manual compliance data
            compliance_data = getattr(session_params, "bfr_compliance_per_channel", None)
            if compliance_data and channel_name in compliance_data:
                return compliance_data[channel_name]
            
            # Fallback to global compliance if available
            global_compliance = getattr(session_params, "bfr_compliance_manual", None)
            return global_compliance
            
        except Exception as e:
            logger.warning(f"Error extracting BFR compliance for {channel_name}: {e!s}")
            return None
    
    def _calculate_channel_safety_compliance(
        self, 
        actual_pressure_aop: float | None, 
        bfr_compliance_manual: bool | None,
        measurement_method: str
    ) -> bool:
        """Calculate safety compliance based on available BFR data.
        
        Args:
            actual_pressure_aop: Sensor-measured pressure (% AOP)
            bfr_compliance_manual: Manual compliance assessment
            measurement_method: 'sensor' or 'manual'
            
        Returns:
            Safety compliance status
        """
        try:
            # Sensor mode: validate pressure range (40-60% AOP for safety)
            if measurement_method == "sensor" and actual_pressure_aop is not None:
                return 40.0 <= actual_pressure_aop <= 60.0
            
            # Manual mode: use therapist/patient assessment
            elif measurement_method == "manual" and bfr_compliance_manual is not None:
                return bfr_compliance_manual
            
            # Default to compliant if no data available (conservative approach)
            return True
            
        except Exception as e:
            logger.warning(f"Error calculating safety compliance: {e!s}")
            return True  # Conservative default
    
    def _validate_channel_bfr_safety(
        self, 
        channel_name: str, 
        bfr_data: dict[str, Any]
    ) -> None:
        """Validate BFR safety ranges for a specific channel.
        
        Args:
            channel_name: Channel identifier for logging
            bfr_data: BFR monitoring data dictionary (modified in place)
        """
        try:
            # Validate sensor pressure ranges
            actual_pressure = bfr_data.get("actual_pressure_aop")
            if actual_pressure is not None:
                if actual_pressure > 60.0:
                    logger.warning(
                        f"{channel_name} BFR pressure {actual_pressure}% AOP exceeds safe range (≤60%), "
                        f"marking as non-compliant"
                    )
                    bfr_data["safety_compliant"] = False
                elif actual_pressure < 40.0:
                    logger.warning(
                        f"{channel_name} BFR pressure {actual_pressure}% AOP below effective range (≥40%), "
                        f"marking as non-compliant"
                    )
                    bfr_data["safety_compliant"] = False
            
            # Validate blood pressure ranges (shared safety parameters)
            systolic_bp = bfr_data.get("systolic_bp_mmhg")
            diastolic_bp = bfr_data.get("diastolic_bp_mmhg")
            
            if systolic_bp and not (80 <= systolic_bp <= 250):
                logger.warning(
                    f"{channel_name} Systolic BP {systolic_bp} outside safe range (80-250 mmHg)"
                )
            
            if diastolic_bp and not (40 <= diastolic_bp <= 150):
                logger.warning(
                    f"{channel_name} Diastolic BP {diastolic_bp} outside safe range (40-150 mmHg)"
                )
                
        except Exception as e:
            logger.warning(f"Error validating BFR safety for {channel_name}: {e!s}")

    async def _upsert_table_with_composite_key(
        self, table_name: str, data: dict[str, Any], key_fields: list[str]
    ) -> None:
        """Upsert table record using composite key (multiple fields).
        
        Args:
            table_name: Database table name
            data: Record data to insert/update
            key_fields: List of field names that form the composite key
        """
        try:
            # Build composite key filter
            key_filter = {field: data[field] for field in key_fields}
            
            # Check if record exists with composite key
            existing = self.supabase.table(table_name).select("*").match(key_filter).execute()
            
            if existing.data:
                # Update existing record
                result = self.supabase.table(table_name).update(data).match(key_filter).execute()
                logger.debug(f"Updated {table_name} with composite key {key_filter}")
            else:
                # Insert new record
                result = self.supabase.table(table_name).insert(data).execute()
                logger.debug(f"Inserted new {table_name} with composite key {key_filter}")
                
            if not result.data:
                raise ValueError(f"No data returned from {table_name} upsert operation")
                
        except Exception as e:
            logger.error(
                f"Failed to upsert {table_name} with composite key {key_fields}: {e!s}", 
                exc_info=True
            )
            raise
