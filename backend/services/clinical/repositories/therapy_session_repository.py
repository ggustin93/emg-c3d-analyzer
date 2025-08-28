"""Therapy Session Repository
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
from typing import Any, Dict, List, Optional, Type, Union
from uuid import UUID

from models.clinical.session import TherapySession, TherapySessionCreate, TherapySessionUpdate
from ...shared.repositories.base.abstract_repository import AbstractRepository, RepositoryError

logger = logging.getLogger(__name__)


class TherapySessionRepository(AbstractRepository[TherapySessionCreate, TherapySessionUpdate, TherapySession]):
    """Repository for therapy session management and lifecycle tracking
    
    Handles session creation, status updates, metadata management,
    and integration with C3D file processing workflows.
    """

    def get_table_name(self) -> str:
        """Return primary table name for therapy sessions"""
        return "therapy_sessions"

    def get_create_model(self) -> Type[TherapySessionCreate]:
        """Return the Pydantic model class for create operations"""
        return TherapySessionCreate

    def get_update_model(self) -> Type[TherapySessionUpdate]:
        """Return the Pydantic model class for update operations"""
        return TherapySessionUpdate

    def get_response_model(self) -> Type[TherapySession]:
        """Return the Pydantic model class for response operations"""
        return TherapySession

    def create_therapy_session(self, session_data: dict[str, Any]) -> dict[str, Any]:
        """Create new therapy session with metadata
        
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
            result = (
                self.client
                .table("therapy_sessions")
                .insert(data)
                .execute()
            )

            created_session = self._handle_supabase_response(
                result, "create", "therapy session"
            )[0]

            self.logger.info(f"✅ Created therapy session: {created_session['id']}")
            return created_session

        except Exception as e:
            error_msg = f"Failed to create therapy session: {e!s}"
            self.logger.error(error_msg, exc_info=True)
            raise RepositoryError(error_msg) from e

    def get_therapy_session(self, session_id: str | UUID) -> dict[str, Any] | None:
        """Get therapy session by ID
        
        Args:
            session_id: Session UUID
            
        Returns:
            Optional[Dict]: Session data or None if not found
        """
        try:
            validated_id = self._validate_uuid(session_id, "session_id")

            result = (
                self.client
                .table("therapy_sessions")
                .select("*")
                .eq("id", validated_id)
                .limit(1)
                .execute()
            )

            data = self._handle_supabase_response(result, "get", "therapy session")
            return data[0] if data else None

        except Exception as e:
            self.logger.error(f"Failed to get therapy session {session_id}: {e!s}")
            raise RepositoryError(f"Failed to get therapy session: {e!s}") from e

    def get_session_by_file_hash(self, file_hash: str) -> dict[str, Any] | None:
        """Get therapy session by C3D file hash (duplicate detection)
        
        Args:
            file_hash: SHA-256 hash of C3D file
            
        Returns:
            Optional[Dict]: Session data or None if not found
        """
        try:
            if not file_hash or not isinstance(file_hash, str):
                raise RepositoryError("Invalid file_hash provided")

            result = (
                self.client
                .table("therapy_sessions")
                .select("*")
                .eq("file_hash", file_hash)
                .limit(1)
                .execute()
            )

            data = self._handle_supabase_response(result, "get", "session by file hash")
            return data[0] if data else None

        except Exception as e:
            self.logger.error(f"Failed to get session by file hash {file_hash}: {e!s}")
            raise RepositoryError(f"Failed to get session by file hash: {e!s}") from e

    def update_therapy_session(
        self,
        session_id: str | UUID,
        update_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Update therapy session data
        
        Args:
            session_id: Session UUID
            update_data: Data to update
            
        Returns:
            Dict: Updated session data
        """
        try:
            validated_id = self._validate_uuid(session_id, "session_id")
            update_data = self._prepare_timestamps(update_data, update=True)

            result = (
                self.client
                .table("therapy_sessions")
                .update(update_data)
                .eq("id", validated_id)
                .execute()
            )

            updated_data = self._handle_supabase_response(result, "update", "therapy session")

            if not updated_data:
                raise RepositoryError(f"Therapy session {session_id} not found for update")

            self.logger.info(f"✅ Updated therapy session: {session_id}")
            return updated_data[0]

        except Exception as e:
            error_msg = f"Failed to update therapy session {session_id}: {e!s}"
            self.logger.error(error_msg, exc_info=True)
            raise RepositoryError(error_msg) from e

    def update_session_status(
        self,
        session_id: str | UUID,
        status: str,
        error_message: str | None = None
    ) -> None:
        """Update session processing status
        
        Args:
            session_id: Session UUID
            status: New processing status (pending, processing, completed, failed)
            error_message: Optional error message if status is failed
        """
        try:
            validated_id = self._validate_uuid(session_id, "session_id")

            update_data = {
                "processing_status": status,
                "updated_at": datetime.now().isoformat()
            }

            if error_message:
                update_data["processing_error_message"] = error_message

            result = (
                self.client
                .table("therapy_sessions")
                .update(update_data)
                .eq("id", validated_id)
                .execute()
            )

            self._handle_supabase_response(result, "update status", "therapy session")
            self.logger.info(f"🔄 Session {session_id} status updated to: {status}")

        except Exception as e:
            error_msg = f"Failed to update session status {session_id}: {e!s}"
            self.logger.error(error_msg, exc_info=True)
            raise RepositoryError(error_msg) from e

    def get_sessions_by_patient(
        self,
        patient_id: str | UUID,
        limit: int | None = None
    ) -> list[dict[str, Any]]:
        """Get therapy sessions for a specific patient
        
        Args:
            patient_id: Patient UUID
            limit: Optional limit on results
            
        Returns:
            List[Dict]: List of therapy sessions
        """
        try:
            validated_id = self._validate_uuid(patient_id, "patient_id")

            query = (
                self.client
                .table("therapy_sessions")
                .select("*")
                .eq("patient_id", validated_id)
                .order("session_date", desc=True)
            )

            if limit:
                query = query.limit(limit)

            result = query.execute()

            return self._handle_supabase_response(result, "get", "sessions by patient")

        except Exception as e:
            self.logger.error(f"Failed to get sessions for patient {patient_id}: {e!s}")
            raise RepositoryError(f"Failed to get sessions for patient: {e!s}") from e

    def get_sessions_by_status(
        self,
        status: str,
        limit: int | None = None
    ) -> list[dict[str, Any]]:
        """Get therapy sessions by processing status
        
        Args:
            status: Processing status to filter by
            limit: Optional limit on results
            
        Returns:
            List[Dict]: List of therapy sessions
        """
        try:
            query = (
                self.client
                .table("therapy_sessions")
                .select("*")
                .eq("processing_status", status)
                .order("created_at", desc=True)
            )

            if limit:
                query = query.limit(limit)

            result = query.execute()

            return self._handle_supabase_response(result, "get", f"sessions with status {status}")

        except Exception as e:
            self.logger.error(f"Failed to get sessions by status {status}: {e!s}")
            raise RepositoryError(f"Failed to get sessions by status: {e!s}") from e
