"""EMG Data Repository.
===================

🎯 PURPOSE: EMG analysis data and processing parameters management
- EMG statistics bulk operations (channel data)
- Processing parameters storage
- Performance optimized batch operations

📊 SUPABASE PATTERNS:
- Bulk insert operations for EMG statistics
- Game metadata operations
- Indexed queries by session_id and channel_name
- Batch processing with proper error handling

"""

import logging
from typing import Any
from uuid import UUID

from services.shared.repositories.base.abstract_repository import (
    AbstractRepository,
    RepositoryError,
)
from models.clinical.session import (
    EMGStatistics,
    EMGStatisticsCreate,
    EMGStatisticsUpdate,
)

logger = logging.getLogger(__name__)


class EMGDataRepository(
    AbstractRepository[EMGStatisticsCreate, EMGStatisticsUpdate, EMGStatistics]
):
    """Repository for EMG analysis data and processing parameters.

    Handles bulk EMG statistics and processing parameters with
    optimized batch operations for performance.
    """

    def get_table_name(self) -> str:
        """Return primary table name (EMG statistics)."""
        return "emg_statistics"

    def get_create_model(self) -> type[EMGStatisticsCreate]:
        """Return the Pydantic model class for create operations."""
        return EMGStatisticsCreate

    def get_update_model(self) -> type[EMGStatisticsUpdate]:
        """Return the Pydantic model class for update operations."""
        return EMGStatisticsUpdate

    def get_response_model(self) -> type[EMGStatistics]:
        """Return the Pydantic model class for response operations."""
        return EMGStatistics

    def bulk_insert_emg_statistics(self, stats_data: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Bulk insert EMG statistics for multiple channels.

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
            result = self.client.table("emg_statistics").insert(prepared_data).execute()

            inserted_data = self._handle_supabase_response(result, "bulk insert", "EMG statistics")

            self.logger.info(f"✅ Bulk inserted {len(inserted_data)} EMG statistics records")
            return inserted_data

        except Exception as e:
            error_msg = f"Failed to bulk insert EMG statistics: {e!s}"
            self.logger.error(error_msg, exc_info=True)
            raise RepositoryError(error_msg) from e

    def get_emg_statistics_by_session(self, session_id: str | UUID) -> list[dict[str, Any]]:
        """Get all EMG statistics for a session.

        Args:
            session_id: Session UUID

        Returns:
            List[Dict]: EMG statistics data
        """
        try:
            validated_id = self._validate_uuid(session_id, "session_id")

            result = (
                self.client.table("emg_statistics")
                .select("*")
                .eq("session_id", validated_id)
                .order("channel_name")
                .execute()
            )

            return self._handle_supabase_response(result, "get", "EMG statistics by session")

        except Exception as e:
            self.logger.exception(f"Failed to get EMG statistics for session {session_id}: {e!s}")
            raise RepositoryError(f"Failed to get EMG statistics: {e!s}") from e


    def get_clinical_quality_summary(self, session_id: str | UUID) -> dict[str, Any]:
        """Get clinical quality summary for a session using JSONB queries.
        
        Extracts key quality metrics from contraction_quality_metrics JSONB field
        for clinical assessment and reporting.

        Args:
            session_id: Session UUID

        Returns:
            Dict: Clinical quality summary with aggregated metrics
        """
        try:
            validated_id = self._validate_uuid(session_id, "session_id")

            # Query using JSONB operators for efficient filtering
            result = (
                self.client.table("emg_statistics")
                .select(
                    "channel_name, "
                    "contraction_quality_metrics->>'total_contractions' as total_contractions, "
                    "contraction_quality_metrics->>'overall_compliant_contractions' as overall_compliant, "
                    "contraction_quality_metrics->>'overall_compliance_percentage' as compliance_rate, "
                    "contraction_quality_metrics->>'mvc75_compliance_percentage' as mvc75_rate, "
                    "contraction_quality_metrics->>'duration_compliance_percentage' as duration_rate"
                )
                .eq("session_id", validated_id)
                .order("channel_name")
                .execute()
            )

            data = self._handle_supabase_response(result, "get", "clinical quality summary")
            
            # Aggregate summary statistics
            summary = {
                "session_id": validated_id,
                "channel_count": len(data),
                "total_contractions": sum(int(row.get("total_contractions", 0)) for row in data),
                "overall_compliant": sum(int(row.get("overall_compliant", 0)) for row in data),
                "channels": data
            }
            
            # Calculate average compliance rates
            if summary["total_contractions"] > 0:
                summary["overall_compliance_rate"] = round(
                    (summary["overall_compliant"] / summary["total_contractions"]) * 100, 2
                )
            else:
                summary["overall_compliance_rate"] = 0.0
            
            return summary

        except Exception as e:
            self.logger.exception(f"Failed to get clinical quality summary for session {session_id}: {e!s}")
            raise RepositoryError(f"Failed to get clinical quality summary: {e!s}") from e

    def find_sessions_by_compliance_threshold(self, min_compliance_rate: float) -> list[dict[str, Any]]:
        """Find sessions meeting minimum compliance threshold using JSONB queries.
        
        Uses PostgreSQL JSONB operators to efficiently query compliance rates
        without needing to parse entire JSONB structures.

        Args:
            min_compliance_rate: Minimum compliance rate (0-100)

        Returns:
            List[Dict]: Sessions meeting compliance criteria
        """
        try:
            if not (0 <= min_compliance_rate <= 100):
                raise ValueError("Compliance rate must be between 0 and 100")

            result = (
                self.client.table("emg_statistics")
                .select(
                    "session_id, channel_name, "
                    "contraction_quality_metrics->>'overall_compliance_percentage' as compliance_rate"
                )
                .gte("contraction_quality_metrics->>'overall_compliance_percentage'", str(min_compliance_rate))
                .order("session_id, channel_name")
                .execute()
            )

            return self._handle_supabase_response(result, "get", "sessions by compliance threshold")

        except Exception as e:
            self.logger.exception(f"Failed to find sessions by compliance threshold {min_compliance_rate}: {e!s}")
            raise RepositoryError(f"Failed to find sessions by compliance: {e!s}") from e

    def update_clinical_metrics(
        self, 
        emg_stats_id: str | UUID, 
        clinical_updates: dict[str, dict[str, Any]]
    ) -> dict[str, Any]:
        """Update specific clinical JSONB groups for an EMG statistics record.
        
        Allows partial updates of JSONB clinical groups without affecting other groups.
        Uses JSONB merge operations for efficient partial updates.

        Args:
            emg_stats_id: EMG statistics record ID
            clinical_updates: Dict with keys matching clinical group names
                             (contraction_quality_metrics, contraction_timing_metrics, etc.)

        Returns:
            Dict: Updated EMG statistics record
        """
        try:
            validated_id = self._validate_uuid(emg_stats_id, "emg_stats_id")
            
            if not clinical_updates:
                raise ValueError("No clinical updates provided")
            
            # Validate that update keys match known clinical groups
            valid_groups = {
                "contraction_quality_metrics",
                "contraction_timing_metrics", 
                "muscle_activation_metrics",
                "fatigue_assessment_metrics"
            }
            
            invalid_keys = set(clinical_updates.keys()) - valid_groups
            if invalid_keys:
                raise ValueError(f"Invalid clinical group keys: {invalid_keys}")

            # Perform update with JSONB merge
            update_data = {}
            for group_name, group_data in clinical_updates.items():
                update_data[group_name] = group_data

            result = (
                self.client.table("emg_statistics")
                .update(update_data)
                .eq("id", validated_id)
                .execute()
            )

            updated_data = self._handle_supabase_response(result, "update", "clinical metrics")
            
            self.logger.info(f"✅ Updated clinical metrics for EMG statistics {validated_id}")
            return updated_data[0] if updated_data else {}

        except Exception as e:
            self.logger.exception(f"Failed to update clinical metrics for {emg_stats_id}: {e!s}")
            raise RepositoryError(f"Failed to update clinical metrics: {e!s}") from e

    # Processing parameters functionality removed - now stored as JSONB in emg_statistics.processing_config

    def upsert_c3d_technical_data(
        self, technical_data: dict[str, Any], unique_key: str = "session_id"
    ) -> dict[str, Any]:
        """DEPRECATED: C3D technical data now stored in therapy_sessions.game_metadata.
        
        Use session_repository.update_session_game_metadata() instead.
        """
        self.logger.warning("upsert_c3d_technical_data is deprecated - use therapy_sessions.game_metadata")
        return {}

    def get_processing_parameters_by_session(self, session_id: str | UUID) -> dict[str, Any] | None:
        """DEPRECATED: Processing parameters now stored in emg_statistics.processing_config JSONB field.
        
        Use get_emg_statistics_by_session() and access processing_config field instead.

        Args:
            session_id: Session UUID

        Returns:
            Optional[Dict]: Processing parameters or None if not found
        """
        try:
            validated_id = self._validate_uuid(session_id, "session_id")

            result = (
                self.client.table("processing_parameters")
                .select("*")
                .eq("session_id", validated_id)
                .limit(1)
                .execute()
            )

            data = self._handle_supabase_response(result, "get", "processing parameters")
            return data[0] if data else None

        except Exception as e:
            self.logger.exception(
                f"Failed to get processing parameters for session {session_id}: {e!s}"
            )
            raise RepositoryError(f"Failed to get processing parameters: {e!s}") from e

    def get_c3d_technical_data_by_session(self, session_id: str | UUID) -> dict[str, Any] | None:
        """DEPRECATED: C3D technical data now in therapy_sessions.game_metadata.technical_data.
        
        Use session_repository to get game_metadata instead.
        """
        self.logger.warning("get_c3d_technical_data_by_session is deprecated - use game_metadata.technical_data")
        return None
