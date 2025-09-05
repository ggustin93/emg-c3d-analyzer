"""Therapy Session Repository.
==========================

🎯 PURPOSE: Therapy session lifecycle and metadata management
- Session CRUD operations with processing status tracking
- File hash-based duplicate detection
- Session metadata and configuration management
- Integration with C3D file processing workflow

📊 SUPABASE PATTERNS:
- Optimized queries with proper indexing (session_date, patient_id, therapist_id)
- UUID foreign key relationships
- Processing status enum handling
- File hash uniqueness constraints

Author: EMG C3D Analyzer Team
Date: 2025-08-27
"""

import logging
from datetime import datetime
from typing import Any
from uuid import UUID

from services.shared.repositories.base.abstract_repository import (
    AbstractRepository,
    RepositoryError,
)
from models.clinical.session import (
    TherapySession,
    TherapySessionCreate,
    TherapySessionUpdate,
)

logger = logging.getLogger(__name__)


class TherapySessionRepository(
    AbstractRepository[TherapySessionCreate, TherapySessionUpdate, TherapySession]
):
    """Repository for therapy session management and lifecycle tracking.

    Handles session creation, status updates, metadata management,
    and integration with C3D file processing workflows.
    """

    def get_table_name(self) -> str:
        """Return primary table name for therapy sessions."""
        return "therapy_sessions"

    def get_create_model(self) -> type[TherapySessionCreate]:
        """Return the Pydantic model class for create operations."""
        return TherapySessionCreate

    def get_update_model(self) -> type[TherapySessionUpdate]:
        """Return the Pydantic model class for update operations."""
        return TherapySessionUpdate

    def get_response_model(self) -> type[TherapySession]:
        """Return the Pydantic model class for response operations."""
        return TherapySession

    def create_therapy_session(self, session_data: dict[str, Any]) -> dict[str, Any]:
        """Create new therapy session with metadata.

        Args:
            session_data: Session data including patient_id, therapist_id, etc.

        Returns:
            Dict: Created session data

        Raises:
            RepositoryError: If creation fails
        """
        try:
            # Prepare session data with timestamps
            data = self._prepare_timestamps(session_data.copy())

            # Validate required UUID fields
            if "patient_id" in data:
                data["patient_id"] = self._validate_uuid(data["patient_id"], "patient_id")
            if "therapist_id" in data:
                data["therapist_id"] = self._validate_uuid(data["therapist_id"], "therapist_id")

            # Set default processing status
            if "processing_status" not in data:
                data["processing_status"] = "pending"

            # Create session
            result = self.client.table("therapy_sessions").insert(data).execute()

            created_session = self._handle_supabase_response(result, "create", "therapy session")[0]

            self.logger.info(f"✅ Created therapy session: {created_session['id']}")
            return created_session

        except Exception as e:
            error_msg = f"Failed to create therapy session: {e!s}"
            self.logger.error(error_msg, exc_info=True)
            raise RepositoryError(error_msg) from e

    def get_therapy_session(self, session_code: str) -> dict[str, Any] | None:
        """Get therapy session by session code.

        Args:
            session_code: Session code (format: P###S###)

        Returns:
            Optional[Dict]: Session data or None if not found
        """
        try:
            if not session_code or not isinstance(session_code, str):
                raise RepositoryError("Invalid session_code provided")

            # Query by session_code column (primary key)
            result = (
                self.client.table("therapy_sessions")
                .select("*")
                .eq("session_code", session_code)
                .limit(1)
                .execute()
            )

            data = self._handle_supabase_response(result, "get", "therapy session")
            return data[0] if data else None

        except Exception as e:
            self.logger.exception(f"Failed to get therapy session {session_code}: {e!s}")
            raise RepositoryError(f"Failed to get therapy session: {e!s}") from e

    def get_therapy_session_by_id(self, session_id: str | UUID) -> dict[str, Any] | None:
        """Get therapy session by UUID (for foreign key relationships).

        Args:
            session_id: Session UUID

        Returns:
            Optional[Dict]: Session data or None if not found
        """
        try:
            validated_id = self._validate_uuid(session_id, "session_id")

            result = (
                self.client.table("therapy_sessions")
                .select("*")
                .eq("id", validated_id)
                .limit(1)
                .execute()
            )

            data = self._handle_supabase_response(result, "get", "therapy session by id")
            return data[0] if data else None

        except Exception as e:
            self.logger.exception(f"Failed to get therapy session by id {session_id}: {e!s}")
            raise RepositoryError(f"Failed to get therapy session by id: {e!s}") from e

    def get_session_by_file_hash(self, file_hash: str) -> dict[str, Any] | None:
        """Get therapy session by C3D file hash (duplicate detection).

        Args:
            file_hash: SHA-256 hash of C3D file

        Returns:
            Optional[Dict]: Session data or None if not found
        """
        try:
            if not file_hash or not isinstance(file_hash, str):
                raise RepositoryError("Invalid file_hash provided")

            result = (
                self.client.table("therapy_sessions")
                .select("*")
                .eq("file_hash", file_hash)
                .limit(1)
                .execute()
            )

            data = self._handle_supabase_response(result, "get", "session by file hash")
            return data[0] if data else None

        except Exception as e:
            self.logger.exception(f"Failed to get session by file hash {file_hash}: {e!s}")
            raise RepositoryError(f"Failed to get session by file hash: {e!s}") from e

    def update_therapy_session(
        self, session_code: str, update_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Update therapy session data.

        Args:
            session_code: Session code (format: P###S###)
            update_data: Data to update

        Returns:
            Dict: Updated session data
        """
        try:
            if not session_code or not isinstance(session_code, str):
                raise RepositoryError("Invalid session_code provided")
            
            update_data = self._prepare_timestamps(update_data, update=True)

            # Update by session_code column (primary key)
            result = (
                self.client.table("therapy_sessions")
                .update(update_data)
                .eq("session_code", session_code)
                .execute()
            )

            updated_data = self._handle_supabase_response(result, "update", "therapy session")

            if not updated_data:
                raise RepositoryError(f"Therapy session {session_code} not found for update")

            self.logger.info(f"✅ Updated therapy session: {session_code}")
            return updated_data[0]

        except Exception as e:
            error_msg = f"Failed to update therapy session {session_code}: {e!s}"
            self.logger.error(error_msg, exc_info=True)
            raise RepositoryError(error_msg) from e

    def generate_next_session_code(self, patient_code: str) -> str:
        """Generate the next sequential session code for a patient.
        
        Args:
            patient_code: Patient code (format: P###)
            
        Returns:
            str: Next sequential session code (format: P###S###)
            
        Raises:
            RepositoryError: If generation fails
        """
        try:
            # Validate patient code format
            if not patient_code or not patient_code.startswith('P'):
                raise RepositoryError(f"Invalid patient code format: {patient_code}")
            
            # Query for the highest existing session number for this patient
            result = (
                self.client.table("therapy_sessions")
                .select("session_code")
                .like("session_code", f"{patient_code}S%")
                .order("session_code", desc=True)
                .limit(1)
                .execute()
            )
            
            if result.data:
                # Extract the last session number and increment
                last_code = result.data[0]["session_code"]
                # Extract number from P###S### format
                last_num = int(last_code.split('S')[1])
                next_num = last_num + 1
            else:
                # First session for this patient
                next_num = 1
            
            # Format with zero-padding
            session_code = f"{patient_code}S{next_num:03d}"
            
            self.logger.info(f"Generated session code: {session_code}")
            return session_code
            
        except Exception as e:
            error_msg = f"Failed to generate session code for {patient_code}: {e!s}"
            self.logger.error(error_msg, exc_info=True)
            raise RepositoryError(error_msg) from e
    
    def create_session_with_code(
        self, 
        patient_code: str, 
        file_path: str,
        file_metadata: dict[str, Any] | None = None,
        patient_id: str | None = None,
        therapist_id: str | None = None
    ) -> tuple[str, str, dict[str, Any]]:
        """Create a new therapy session with auto-generated chronological code.
        
        This method implements proper DRY/SOLID principles by encapsulating
        all session creation logic in the repository layer.
        
        Args:
            patient_code: Patient code (format: P###)
            file_path: Path to the C3D file
            file_metadata: Optional file metadata
            patient_id: Optional patient UUID
            therapist_id: Optional therapist UUID
            
        Returns:
            tuple: (session_code, session_data)
            
        Raises:
            RepositoryError: If creation fails
        """
        try:
            # Generate next sequential session code for human readability
            session_code = self.generate_next_session_code(patient_code)
            
            # Generate file hash for deduplication
            import hashlib
            file_hash_input = f"{file_path}:{file_metadata.get('size', 0) if file_metadata else 0}"
            file_hash = hashlib.sha256(file_hash_input.encode()).hexdigest()
            
            # Prepare session data with session_code as primary key column
            session_data = {
                "session_code": session_code,  # Primary key column
                "file_path": file_path,
                "file_hash": file_hash,
                "file_size_bytes": file_metadata.get("size", 0) if file_metadata else 0,
                "processing_status": "processing",  # Start as processing
                "game_metadata": file_metadata or {},  # Store file metadata only
                "patient_id": patient_id,
                "therapist_id": therapist_id,
            }
            
            # Create the session
            created_session = self.create_therapy_session(session_data)
            
            # Return both human-readable code and UUID
            # session_code: For display/logging (P###S###)
            # session_uuid: For foreign key references (UUID)
            session_uuid = created_session.get("id")  # The UUID for FK references
            
            return session_code, session_uuid, created_session
            
        except Exception as e:
            error_msg = f"Failed to create session with code: {e!s}"
            self.logger.error(error_msg, exc_info=True)
            raise RepositoryError(error_msg) from e

    def update_session_status(
        self, session_code: str, status: str, error_message: str | None = None
    ) -> None:
        """Update session processing status.

        Args:
            session_code: Session code (format: P###S###)
            status: New processing status (pending, processing, completed, failed)
            error_message: Optional error message if status is failed
        """
        try:
            if not session_code or not isinstance(session_code, str):
                raise RepositoryError("Invalid session_code provided")

            update_data = {"processing_status": status, "updated_at": datetime.now().isoformat()}

            if error_message:
                update_data["processing_error_message"] = error_message

            # Update by session_code column (primary key)
            result = (
                self.client.table("therapy_sessions")
                .update(update_data)
                .eq("session_code", session_code)
                .execute()
            )

            self._handle_supabase_response(result, "update status", "therapy session")
            self.logger.info(f"🔄 Session {session_code} status updated to: {status}")

        except Exception as e:
            error_msg = f"Failed to update session status {session_code}: {e!s}"
            self.logger.error(error_msg, exc_info=True)
            raise RepositoryError(error_msg) from e
    
    def get_sessions_by_patient_code(self, patient_code: str) -> list[dict[str, Any]]:
        """Get all sessions for a patient by patient code.
        
        Args:
            patient_code: Patient code (e.g., "P039")
            
        Returns:
            List of session records for the patient
        """
        try:
            if not patient_code or not isinstance(patient_code, str):
                raise RepositoryError("Invalid patient_code provided")
            
            # Use LIKE operator to match session codes starting with the patient code
            # For example, P039% will match P039S001, P039S002, etc.
            result = (
                self.client.table("therapy_sessions")
                .select("*")
                .like("session_code", f"{patient_code}S%")
                .order("session_code")
                .execute()
            )
            
            data = self._handle_supabase_response(result, "get", "sessions by patient code")
            return data if data else []
            
        except Exception as e:
            self.logger.exception(f"Failed to get sessions for patient {patient_code}: {e!s}")
            raise RepositoryError(f"Failed to get sessions by patient code: {e!s}") from e

    def get_sessions_by_patient(
        self, patient_id: str | UUID, limit: int | None = None
    ) -> list[dict[str, Any]]:
        """Get therapy sessions for a specific patient.

        Args:
            patient_id: Patient UUID
            limit: Optional limit on results

        Returns:
            List[Dict]: List of therapy sessions
        """
        try:
            validated_id = self._validate_uuid(patient_id, "patient_id")

            query = (
                self.client.table("therapy_sessions")
                .select("*")
                .eq("patient_id", validated_id)
                .order("session_date", desc=True)
            )

            if limit:
                query = query.limit(limit)

            result = query.execute()

            return self._handle_supabase_response(result, "get", "sessions by patient")

        except Exception as e:
            self.logger.exception(f"Failed to get sessions for patient {patient_id}: {e!s}")
            raise RepositoryError(f"Failed to get sessions for patient: {e!s}") from e

    def get_sessions_by_status(self, status: str, limit: int | None = None) -> list[dict[str, Any]]:
        """Get therapy sessions by processing status.

        Args:
            status: Processing status to filter by
            limit: Optional limit on results

        Returns:
            List[Dict]: List of therapy sessions
        """
        try:
            query = (
                self.client.table("therapy_sessions")
                .select("*")
                .eq("processing_status", status)
                .order("created_at", desc=True)
            )

            if limit:
                query = query.limit(limit)

            result = query.execute()

            return self._handle_supabase_response(result, "get", f"sessions with status {status}")

        except Exception as e:
            self.logger.exception(f"Failed to get sessions by status {status}: {e!s}")
            raise RepositoryError(f"Failed to get sessions by status: {e!s}") from e
