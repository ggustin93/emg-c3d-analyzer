"""Enhanced export service for EMG data with performance scores.

Following MVP approach: extend existing system with missing performance data.
Architecture follows backend CLAUDE.md: Repository pattern, DRY principle, synchronous Supabase.
"""

import logging
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)


class EnhancedEMGDataExporter:
    """Enhanced EMG data export service with performance scores and configuration.
    
    Following MVP approach: extend existing system with missing performance data.
    Architecture follows backend CLAUDE.md: Repository pattern, DRY principle.
    """

    def __init__(self, processor: Any, supabase_client=None):
        self.processor = processor
        self.supabase = supabase_client  # Synchronous client (CLAUDE.md #14)

    def export_data(
        self, channels_to_export: list[str], file_name: str, export_options: dict[str, Any]
    ) -> dict[str, Any]:
        """Export EMG data in requested format with enhanced performance data."""
        try:
            # Get the processed data from processor  
            if not hasattr(self.processor, "latest_analysis_result"):
                raise ValueError("No analysis data available for export")

            analysis_result = self.processor.latest_analysis_result

            # Build export data (keep existing structure - DRY principle)
            export_data = {
                "metadata": {
                    "export_timestamp": datetime.now().isoformat(),
                    "file_name": file_name,
                    "channels_exported": channels_to_export,
                    "export_options": export_options,
                },
                "data": {},
            }

            # Add requested channels (existing functionality)
            for channel in channels_to_export:
                if (
                    hasattr(analysis_result, "emg_signals")
                    and channel in analysis_result.emg_signals
                ):
                    export_data["data"][channel] = {
                        "signal_data": analysis_result.emg_signals[channel].data,
                        "time_axis": analysis_result.emg_signals[channel].time_axis,
                        "analytics": getattr(analysis_result, "analytics", {}).get(channel, {}),
                    }

            return {
                "success": True,
                "export_data": export_data,
                "message": f"Successfully exported {len(channels_to_export)} channels",
            }

        except Exception as e:
            return {"success": False, "error": str(e), "message": "Export failed"}

    def get_comprehensive_export_data(self, session_id: str) -> dict[str, Any]:
        """Get comprehensive export data including performance scores and configuration.
        
        MVP implementation: Add missing performance data to existing export.
        Following KISS principle - simple extension of existing functionality.
        
        Args:
            session_id: Session UUID to export data for
            
        Returns:
            Complete export data with performance scores and scoring configuration
        """
        try:
            # Get existing export data (DRY - reuse existing logic)
            base_export = self._get_base_export_data()
            
            # Add missing performance data (MVP requirement)
            if self.supabase:
                performance_scores = self._get_performance_scores(session_id)
                scoring_config = self._get_scoring_configuration(session_id)
                
                # Extend existing structure
                base_export.update({
                    'performance_scores': performance_scores,
                    'scoring_configuration': scoring_config
                })
                
            return base_export
            
        except Exception as e:
            # Fallback to base export if performance data unavailable
            logger.warning(f"Failed to get performance data: {e}, returning base export")
            return self._get_base_export_data()

    def _get_base_export_data(self) -> dict[str, Any]:
        """Get base export data from existing processor."""
        if not hasattr(self.processor, "latest_analysis_result"):
            return {"session_metadata": {"export_timestamp": datetime.now().isoformat()}}
            
        analysis_result = self.processor.latest_analysis_result
        
        # Convert analysis_result to JSON-serializable format
        analysis_data = {}
        if hasattr(analysis_result, '__dict__'):
            for key, value in analysis_result.__dict__.items():
                # Only include JSON-serializable attributes
                try:
                    import json
                    json.dumps(value)  # Test if serializable
                    analysis_data[key] = value
                except (TypeError, ValueError):
                    # Skip non-serializable attributes
                    continue
        
        return {
            "session_metadata": {
                "export_timestamp": datetime.now().isoformat(),
                "analysis_data": analysis_data,
                "emg_signals": getattr(analysis_result, "emg_signals", {}),
                "analytics": getattr(analysis_result, "analytics", {})
            }
        }

    def _get_performance_scores(self, session_id: str) -> dict[str, Any]:
        """Get performance scores from database (Repository pattern)."""
        try:
            # Query performance_scores table (17+ fields as per database schema)
            result = (
                self.supabase
                .table('performance_scores')
                .select('*')
                .eq('session_id', session_id)
                .limit(1)
                .execute()
            )
            
            if result.data and len(result.data) > 0:
                return result.data[0]
            else:
                return {"note": "No performance scores found for this session"}
                
        except Exception as e:
            logger.error(f"Failed to fetch performance scores: {e}")
            return {"error": "Failed to fetch performance scores"}

    def _get_scoring_configuration(self, session_id: str) -> dict[str, Any]:
        """Get scoring configuration for reproducibility."""
        try:
            # Get session's scoring configuration
            session_result = (
                self.supabase
                .table('therapy_sessions')
                .select('scoring_config_id')
                .eq('id', session_id)
                .limit(1)
                .execute()
            )
            
            if not session_result.data or not session_result.data[0].get('scoring_config_id'):
                return {"note": "No scoring configuration found for this session"}
                
            config_id = session_result.data[0]['scoring_config_id']
            
            # Get scoring configuration details
            config_result = (
                self.supabase
                .table('scoring_configuration')
                .select('*')
                .eq('id', config_id)
                .limit(1)
                .execute()
            )
            
            if config_result.data and len(config_result.data) > 0:
                return config_result.data[0]
            else:
                return {"note": "Scoring configuration not found"}
                
        except Exception as e:
            logger.error(f"Failed to fetch scoring configuration: {e}")
            return {"error": "Failed to fetch scoring configuration"}


# Keep backward compatibility alias
EMGDataExporter = EnhancedEMGDataExporter