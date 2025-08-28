"""Metadata Service - Database Metadata Manager.
============================================

🎯 PURPOSE: Database CRUD operations for therapy session metadata
- Manages therapy session records in the database
- Handles metadata storage and retrieval operations
- Implements frontend-consistent patient/therapist ID resolution

🔗 RESPONSIBILITIES:
- Create/update therapy session database records
- Extract and resolve patient/therapist IDs from file paths
- Store C3D technical metadata in database
- Bridge between file storage and database persistence

📊 OUTPUT: Database session IDs and metadata persistence
"""

import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from database.supabase_client import get_supabase_client
from services.c3d.reader import C3DReader

logger = logging.getLogger(__name__)


class MetadataService:
    """Service for managing C3D file metadata with frontend-consistent resolution patterns."""

    def __init__(self):
        self.supabase = get_supabase_client(
            use_service_key=True
        )  # Use service key for admin operations
        self.c3d_reader = C3DReader()

    async def create_metadata_entry(
        self,
        file_path: str,
        file_hash: str,
        file_size_bytes: int,
        patient_id: str | None = None,
        session_id: str | None = None,
        metadata: dict | None = None,
    ) -> UUID:
        """Create therapy session entry with basic file information (KISS: Phase 1 - Metadata Only).

        Following the DATABASE_IMPROVEMENT_PROPOSAL.md two-phase pattern:
        Phase 1: Create session with metadata only (this method)
        Phase 2: Add technical data via update_technical_metadata() after C3D processing

        Args:
            file_path: Path to C3D file in storage
            file_hash: SHA-256 hash of file content
            file_size_bytes: File size in bytes
            patient_id: Optional patient ID from storage path
            session_id: Optional session ID from storage path
            metadata: Optional additional metadata from webhook

        Returns:
            UUID: ID of created therapy session
        """
        session_id = uuid4()

        # KISS: Phase 1 - Create session with metadata ONLY (no technical fields)
        entry = {
            "id": str(session_id),
            "file_path": file_path,
            "file_hash": file_hash,
            "file_size_bytes": file_size_bytes,
            "patient_id": patient_id,
            "processing_status": "pending",
            "original_filename": Path(file_path).name,
            "game_metadata": metadata or {},
        }

        try:
            result = self.supabase.table("therapy_sessions").insert(entry).execute()
            logger.info(
                "✅ Created therapy session (Phase 1 - Metadata): %s (session_id: %s)", file_path, session_id
            )
            return session_id

        except Exception as e:
            logger.exception("❌ Failed to create therapy session: %s", e)
            logger.exception("Entry data: %s", entry)
            raise

    async def extract_c3d_metadata(self, file_data: bytes) -> dict[str, Any]:
        """Extract technical metadata from C3D file content.

        Args:
            file_data: Raw C3D file bytes

        Returns:
            Dict containing C3D technical metadata
        """
        try:
            # Use C3D reader to extract metadata
            c3d_info = await self.c3d_reader.extract_metadata(file_data)

            return {
                "channel_names": c3d_info.get("channel_names", []),
                "channel_count": len(c3d_info.get("channel_names", [])),
                "sampling_rate": c3d_info.get("sampling_rate"),
                "duration_seconds": c3d_info.get("duration_seconds"),
                "frame_count": c3d_info.get("frame_count"),
                "game_metadata": c3d_info.get("game_metadata", {}),
                "session_duration": c3d_info.get("session_duration"),
                "session_notes": c3d_info.get("session_notes"),
                "therapist_id": c3d_info.get("therapist_id"),
                "player_name": c3d_info.get("player_name"),
            }

        except Exception as e:
            logger.exception("Failed to extract C3D metadata: %s", e)
            raise

    async def update_technical_metadata(self, session_id: UUID, file_data: bytes) -> None:
        """Phase 2: Add technical C3D data to existing therapy session.

        Creates entry in c3d_technical_data table with extracted technical metadata.
        This implements the two-phase pattern from DATABASE_IMPROVEMENT_PROPOSAL.md

        Args:
            session_id: UUID of existing therapy session
            file_data: Raw C3D file bytes for metadata extraction
        """
        try:
            # Extract technical metadata from C3D file
            c3d_metadata = await self.extract_c3d_metadata(file_data)

            # Prepare technical data entry (nullable by design)
            technical_entry = {
                "session_id": str(session_id),
                "original_sampling_rate": c3d_metadata.get("sampling_rate"),
                "original_duration_seconds": c3d_metadata.get("duration_seconds"),
                "original_sample_count": c3d_metadata.get("frame_count"),
                "channel_count": len(c3d_metadata.get("channel_names", [])),
                "channel_names": c3d_metadata.get("channel_names", []),
                "sampling_rate": c3d_metadata.get("sampling_rate"),
                "duration_seconds": c3d_metadata.get("duration_seconds"),
                "frame_count": c3d_metadata.get("frame_count"),
            }

            # Insert technical data into separate table
            result = self.supabase.table("c3d_technical_data").insert(technical_entry).execute()

            # Update session metadata with resolved information
            resolved_fields = self._resolve_metadata_fields(
                file_path="",  # Will be fetched from session if needed
                file_size_bytes=0,  # Will be fetched from session if needed
                c3d_metadata=c3d_metadata,
                storage_metadata={},
            )

            # Update therapy session with resolved fields and game metadata
            session_update = {
                "processing_status": "completed",
                "updated_at": datetime.utcnow().isoformat(),
                "processed_at": datetime.utcnow().isoformat(),
            }

            # Add game metadata if available
            if c3d_metadata.get("game_metadata"):
                session_update["game_metadata"] = c3d_metadata["game_metadata"]

            # Add resolved fields
            session_update.update(resolved_fields)

            self.supabase.table("therapy_sessions").update(session_update).eq(
                "id", str(session_id)
            ).execute()

            logger.info("✅ Updated technical metadata (Phase 2): %s", session_id)

        except Exception as e:
            logger.exception("❌ Failed to update technical metadata: %s", e)
            # Update session status to failed
            self.supabase.table("therapy_sessions").update(
                {
                    "processing_status": "failed",
                    "processing_error_message": str(e),
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).eq("id", str(session_id)).execute()
            raise

    async def update_metadata(
        self,
        metadata_id: UUID,
        channel_names: list[str],
        channel_count: int,
        sampling_rate: float,
        duration_seconds: float,
        frame_count: int,
        **kwargs,
    ) -> None:
        """Update metadata entry with extracted C3D information and resolved fields.

        Args:
            metadata_id: UUID of metadata entry
            channel_names: List of EMG channel names
            channel_count: Number of channels
            sampling_rate: Sampling rate in Hz
            duration_seconds: Duration in seconds
            frame_count: Total frame count
            **kwargs: Additional metadata fields
        """
        try:
            # Get current session data for resolution (KISS: single table)
            current = (
                self.supabase.table("therapy_sessions")
                .select("*")
                .eq("id", str(metadata_id))
                .execute()
            )

            if not current.data:
                raise ValueError(f"Therapy session not found: {metadata_id}")

            current_data = current.data[0]

            # Prepare update with technical metadata
            update_data = {
                "channel_names": channel_names,
                "channel_count": channel_count,
                "sampling_rate": sampling_rate,
                "duration_seconds": duration_seconds,
                "frame_count": frame_count,
                "updated_at": datetime.utcnow().isoformat(),
            }

            # Add any additional metadata
            for key, value in kwargs.items():
                if value is not None:
                    update_data[key] = value

            # Apply frontend-consistent resolution patterns
            resolved_fields = self._resolve_metadata_fields(
                file_path=current_data["file_path"],
                file_size_bytes=current_data["file_size_bytes"],
                c3d_metadata=kwargs,
                storage_metadata={
                    "patient_id": current_data.get("patient_id"),
                    "therapist_id": current_data.get("therapist_id"),
                },
            )

            update_data.update(resolved_fields)

            # Update therapy session (KISS: single table)
            result = (
                self.supabase.table("therapy_sessions")
                .update(update_data)
                .eq("id", str(metadata_id))
                .execute()
            )

            logger.info("Updated therapy session: %s", metadata_id)

        except Exception as e:
            logger.exception("Failed to update therapy session: %s", e)
            raise

    def _resolve_metadata_fields(
        self,
        file_path: str,
        file_size_bytes: int,
        c3d_metadata: dict[str, Any],
        storage_metadata: dict[str, Any],
    ) -> dict[str, Any]:
        """Apply frontend-consistent metadata resolution patterns.

        Args:
            file_path: Path to C3D file
            file_size_bytes: File size in bytes
            c3d_metadata: Extracted C3D metadata
            storage_metadata: Storage-level metadata

        Returns:
            Dict with resolved metadata fields
        """
        resolved = {}

        # Patient ID resolution (consistent with FileMetadataBar and C3DFileDataResolver)
        # Priority: 1) Subfolder pattern, 2) C3D metadata.player_name, 3) storage metadata
        resolved_patient_id = self._resolve_patient_id(file_path, c3d_metadata, storage_metadata)
        resolved["resolved_patient_id"] = resolved_patient_id

        # Therapist ID resolution
        # Priority: 1) C3D metadata.therapist_id, 2) storage metadata.therapist_id
        resolved_therapist_id = self._resolve_therapist_id(c3d_metadata, storage_metadata)
        resolved["resolved_therapist_id"] = resolved_therapist_id

        # Session date resolution (consistent with FileMetadataBar and C3DFileDataResolver)
        # Priority: 1) Filename pattern, 2) C3D metadata.session_date, 3) C3D metadata.time
        resolved_session_date = self._resolve_session_date(file_path, c3d_metadata)
        if resolved_session_date:
            resolved["resolved_session_date"] = resolved_session_date

        # Update game metadata with resolved information
        game_metadata = c3d_metadata.get("game_metadata", {})
        if c3d_metadata.get("player_name"):
            game_metadata["player_name"] = c3d_metadata["player_name"]
        if c3d_metadata.get("therapist_id"):
            game_metadata["therapist_id"] = c3d_metadata["therapist_id"]

        if game_metadata:
            resolved["game_metadata"] = game_metadata

        return resolved

    def _resolve_patient_id(
        self, file_path: str, c3d_metadata: dict, storage_metadata: dict
    ) -> str:
        """Resolve patient ID using frontend-consistent priority system
        Priority: 1) Subfolder pattern (P005/), 2) C3D metadata.player_name, 3) storage metadata.
        """
        # Priority 1: Storage subfolder pattern
        subfolder_match = re.match(r"^(P\d{3})/", file_path)
        if subfolder_match:
            return subfolder_match.group(1)

        # Priority 2: C3D metadata player_name
        if c3d_metadata.get("player_name"):
            return str(c3d_metadata["player_name"])

        # Priority 3: Storage metadata patient_id
        if storage_metadata.get("patient_id"):
            return str(storage_metadata["patient_id"])

        # Priority 4: Filename pattern extraction
        filename_match = re.search(r"[_-](P\d{3})[_-]", file_path, re.IGNORECASE)
        if filename_match:
            return filename_match.group(1).upper()

        return "Unknown"

    def _resolve_therapist_id(self, c3d_metadata: dict, storage_metadata: dict) -> str:
        """Resolve therapist ID using frontend-consistent priority system
        Priority: 1) C3D metadata.therapist_id, 2) storage metadata.therapist_id.
        """
        # Priority 1: C3D metadata
        if c3d_metadata.get("therapist_id"):
            return str(c3d_metadata["therapist_id"])

        # Priority 2: Storage metadata
        if storage_metadata.get("therapist_id"):
            return str(storage_metadata["therapist_id"])

        return "Unknown"

    def _resolve_session_date(self, file_path: str, c3d_metadata: dict) -> str | None:
        """Resolve session date using frontend-consistent priority system
        Priority: 1) Filename extraction, 2) C3D metadata.session_date, 3) C3D metadata.time.
        """
        # Priority 1: Filename extraction (consistent with C3DFileDataResolver)
        extracted_date = self._extract_date_from_filename(file_path)
        if extracted_date:
            return extracted_date

        # Priority 2: C3D metadata session_date
        if c3d_metadata.get("session_date"):
            return str(c3d_metadata["session_date"])

        # Priority 3: C3D metadata time field
        if c3d_metadata.get("time"):
            return str(c3d_metadata["time"])

        return None

    def _extract_date_from_filename(self, filename: str) -> str | None:
        """Extract date from filename using patterns from C3DFileDataResolver
        Patterns: YYYYMMDD, YYYY-MM-DD, DD-MM-YYYY.
        """
        # Pattern 1 & 2: YYYYMMDD format
        yyyymmdd = re.search(r"(\d{4})(\d{2})(\d{2})", filename)
        if yyyymmdd:
            year, month, day = yyyymmdd.groups()
            year_num = int(year)
            if 2020 <= year_num <= 2030:
                return f"{year}-{month}-{day}"

        # Pattern 3: YYYY-MM-DD format
        iso_date = re.search(r"(\d{4})-(\d{2})-(\d{2})", filename)
        if iso_date:
            year, month, day = iso_date.groups()
            year_num = int(year)
            if 2020 <= year_num <= 2030:
                return f"{year}-{month}-{day}"

        # Pattern 4: DD-MM-YYYY format
        ddmmyyyy = re.search(r"(\d{2})-(\d{2})-(\d{4})", filename)
        if ddmmyyyy:
            day, month, year = ddmmyyyy.groups()
            year_num = int(year)
            if 2020 <= year_num <= 2030:
                return f"{year}-{month}-{day}"

        return None

    async def get_by_file_hash(self, file_hash: str) -> dict | None:
        """Get therapy session by file hash (KISS: single table)."""
        try:
            result = (
                self.supabase.table("therapy_sessions")
                .select("*")
                .eq("file_hash", file_hash)
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            logger.exception("Failed to get session by hash: %s", e)
            return None

    async def get_by_id(self, session_id: UUID) -> dict | None:
        """Get therapy session by ID (KISS: single table)."""
        try:
            result = (
                self.supabase.table("therapy_sessions")
                .select("*")
                .eq("id", str(session_id))
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            logger.exception("Failed to get session by ID: %s", e)
            return None

    async def update_processing_status(
        self,
        session_id: UUID,
        status: str,
        error_message: str | None = None,
        enhanced_session_id: str | None = None,
    ) -> None:
        """Update processing status (KISS: single table)."""
        try:
            update_data = {"processing_status": status, "updated_at": datetime.utcnow().isoformat()}

            if status == "completed":
                update_data["processed_at"] = datetime.utcnow().isoformat()
            elif status == "failed" and error_message:
                update_data["processing_error_message"] = error_message

            if enhanced_session_id:
                update_data["enhanced_session_id"] = enhanced_session_id

            self.supabase.table("therapy_sessions").update(update_data).eq(
                "id", str(session_id)
            ).execute()

            logger.info("Updated processing status to %s for session: %s", status, session_id)

        except Exception as e:
            logger.exception("Failed to update processing status: %s", e)
            raise
