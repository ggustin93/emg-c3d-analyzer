"""Simple export service for EMG data."""

import json
from datetime import datetime
from typing import Any, Dict, Optional


class EMGDataExporter:
    """Simple EMG data export service."""

    def __init__(self, processor: Any):
        self.processor = processor

    def export_data(
        self, channels_to_export: list[str], file_name: str, export_options: dict[str, Any]
    ) -> dict[str, Any]:
        """Export EMG data in requested format.

        Args:
            channels_to_export: List of channel names to export
            file_name: Name for the export file
            export_options: Export configuration options

        Returns:
            Export result with data
        """
        try:
            # Get the processed data from processor
            if not hasattr(self.processor, "latest_analysis_result"):
                raise ValueError("No analysis data available for export")

            analysis_result = self.processor.latest_analysis_result

            # Build export data
            export_data = {
                "metadata": {
                    "export_timestamp": datetime.now().isoformat(),
                    "file_name": file_name,
                    "channels_exported": channels_to_export,
                    "export_options": export_options,
                },
                "data": {},
            }

            # Add requested channels
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
