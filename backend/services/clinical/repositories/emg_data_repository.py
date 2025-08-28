"""EMG Data Repository
===================

🎯 PURPOSE: EMG analysis data and processing parameters management
- EMG statistics bulk operations (channel data)
- Processing parameters storage
- C3D technical metadata
- Performance optimized batch operations

📊 SUPABASE PATTERNS:
- Bulk insert operations for EMG statistics
- Upsert patterns for technical data
- Indexed queries by session_id and channel_name
- Batch processing with proper error handling

Author: EMG C3D Analyzer Team
Date: 2025-08-27
"""

import logging
from typing import Any, Dict, List, Optional, Union
from uuid import UUID

from .base.abstract_repository import AbstractRepository, RepositoryError

logger = logging.getLogger(__name__)


class EMGDataRepository(AbstractRepository):
    """Repository for EMG analysis data and processing parameters
    
    Handles bulk EMG statistics, C3D technical data, and processing
    parameters with optimized batch operations for performance.
    """

    def get_table_name(self) -> str:
        """Return primary table name (EMG statistics)"""
        return "emg_statistics"

    def bulk_insert_emg_statistics(self, stats_data: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Bulk insert EMG statistics for multiple channels
        
        Args:
            stats_data: List of EMG statistics data
            
        Returns:
            List[Dict]: Inserted EMG statistics
            
        Raises:
            RepositoryError: If bulk insert fails
        """
        try:
            if not stats_data:
                raise RepositoryError("No EMG statistics data provided")

            # Validate and prepare each record
            prepared_data = []
            for stats in stats_data:
                data = self._prepare_timestamps(stats.copy())

                # Validate session_id
                if "session_id" in data:
                    data["session_id"] = self._validate_uuid(data["session_id"], "session_id")

                prepared_data.append(data)

            # Bulk insert
            result = (
                self.client
                .table("emg_statistics")
                .insert(prepared_data)
                .execute()
            )

            inserted_data = self._handle_supabase_response(result, "bulk insert", "EMG statistics")

            self.logger.info(f"✅ Bulk inserted {len(inserted_data)} EMG statistics records")
            return inserted_data

        except Exception as e:
            error_msg = f"Failed to bulk insert EMG statistics: {e!s}"
            self.logger.error(error_msg, exc_info=True)
            raise RepositoryError(error_msg) from e

    def get_emg_statistics_by_session(
        self,
        session_id: str | UUID
    ) -> list[dict[str, Any]]:
        """Get all EMG statistics for a session
        
        Args:
            session_id: Session UUID
            
        Returns:
            List[Dict]: EMG statistics data
        """
        try:
            validated_id = self._validate_uuid(session_id, "session_id")

            result = (
                self.client
                .table("emg_statistics")
                .select("*")
                .eq("session_id", validated_id)
                .order("channel_name")
                .execute()
            )

            return self._handle_supabase_response(result, "get", "EMG statistics by session")

        except Exception as e:
            self.logger.error(f"Failed to get EMG statistics for session {session_id}: {e!s}")
            raise RepositoryError(f"Failed to get EMG statistics: {e!s}") from e

    def insert_processing_parameters(self, params_data: dict[str, Any]) -> dict[str, Any]:
        """Insert processing parameters for a session
        
        Args:
            params_data: Processing parameters data
            
        Returns:
            Dict: Inserted processing parameters
        """
        try:
            data = self._prepare_timestamps(params_data.copy())

            # Validate session_id
            if "session_id" in data:
                data["session_id"] = self._validate_uuid(data["session_id"], "session_id")

            result = (
                self.client
                .table("processing_parameters")
                .insert(data)
                .execute()
            )

            inserted_data = self._handle_supabase_response(result, "insert", "processing parameters")[0]

            self.logger.info(f"✅ Inserted processing parameters for session: {data['session_id']}")
            return inserted_data

        except Exception as e:
            error_msg = f"Failed to insert processing parameters: {e!s}"
            self.logger.error(error_msg, exc_info=True)
            raise RepositoryError(error_msg) from e

    def upsert_c3d_technical_data(
        self,
        technical_data: dict[str, Any],
        unique_key: str = "session_id"
    ) -> dict[str, Any]:
        """Upsert C3D technical data (insert or update if exists)
        
        Args:
            technical_data: C3D technical metadata
            unique_key: Field to use for upsert matching
            
        Returns:
            Dict: Upserted technical data
        """
        try:
            data = self._prepare_timestamps(technical_data.copy())

            # Validate session_id
            if "session_id" in data:
                data["session_id"] = self._validate_uuid(data["session_id"], "session_id")

            # Check if record exists
            unique_value = data[unique_key]
            existing_result = (
                self.client
                .table("c3d_technical_data")
                .select("id")
                .eq(unique_key, unique_value)
                .limit(1)
                .execute()
            )

            existing_data = self._handle_supabase_response(
                existing_result, "check existing", "C3D technical data"
            )

            if existing_data:
                # Update existing record
                result = (
                    self.client
                    .table("c3d_technical_data")
                    .update(self._prepare_timestamps(data, update=True))
                    .eq(unique_key, unique_value)
                    .execute()
                )
                operation = "update"
            else:
                # Insert new record
                result = (
                    self.client
                    .table("c3d_technical_data")
                    .insert(data)
                    .execute()
                )
                operation = "insert"

            upserted_data = self._handle_supabase_response(result, operation, "C3D technical data")[0]

            self.logger.info(f"✅ {operation.title()}ed C3D technical data for session: {data['session_id']}")
            return upserted_data

        except Exception as e:
            error_msg = f"Failed to upsert C3D technical data: {e!s}"
            self.logger.error(error_msg, exc_info=True)
            raise RepositoryError(error_msg) from e

    def get_processing_parameters_by_session(
        self,
        session_id: str | UUID
    ) -> dict[str, Any] | None:
        """Get processing parameters for a session
        
        Args:
            session_id: Session UUID
            
        Returns:
            Optional[Dict]: Processing parameters or None if not found
        """
        try:
            validated_id = self._validate_uuid(session_id, "session_id")

            result = (
                self.client
                .table("processing_parameters")
                .select("*")
                .eq("session_id", validated_id)
                .limit(1)
                .execute()
            )

            data = self._handle_supabase_response(result, "get", "processing parameters")
            return data[0] if data else None

        except Exception as e:
            self.logger.error(f"Failed to get processing parameters for session {session_id}: {e!s}")
            raise RepositoryError(f"Failed to get processing parameters: {e!s}") from e

    def get_c3d_technical_data_by_session(
        self,
        session_id: str | UUID
    ) -> dict[str, Any] | None:
        """Get C3D technical data for a session
        
        Args:
            session_id: Session UUID
            
        Returns:
            Optional[Dict]: C3D technical data or None if not found
        """
        try:
            validated_id = self._validate_uuid(session_id, "session_id")

            result = (
                self.client
                .table("c3d_technical_data")
                .select("*")
                .eq("session_id", validated_id)
                .limit(1)
                .execute()
            )

            data = self._handle_supabase_response(result, "get", "C3D technical data")
            return data[0] if data else None

        except Exception as e:
            self.logger.error(f"Failed to get C3D technical data for session {session_id}: {e!s}")
            raise RepositoryError(f"Failed to get C3D technical data: {e!s}") from e
