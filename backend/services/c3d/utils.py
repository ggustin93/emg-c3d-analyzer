"""Shared C3D utilities to eliminate code duplication
Simple, focused utility functions for C3D metadata extraction.
"""

import logging
from typing import Any, Dict, Optional

try:
    import ezc3d
except ImportError:
    ezc3d = None

logger = logging.getLogger(__name__)


class C3DUtils:
    """Shared utilities for C3D file operations.

    KISS Principle: Simple utility functions to eliminate duplication
    between c3d_processor.py and c3d_reader.py
    """

    @staticmethod
    def extract_game_metadata_from_c3d(c3d_data) -> dict[str, Any]:
        """Extract game metadata from loaded C3D data.

        Used by both c3d_processor.py and therapy_session_processor.py
        to eliminate duplicate field mapping logic

        Args:
            c3d_data: Loaded C3D data from ezc3d

        Returns:
            Dict with standardized game metadata fields
        """
        metadata = {}

        try:
            # Game information from INFO parameters
            if "INFO" in c3d_data["parameters"]:
                info_params = c3d_data["parameters"]["INFO"]

                # Standardized field mappings
                field_mappings = {
                    "GAME_NAME": "game_name",
                    "GAME_LEVEL": "level",
                    "DURATION": "duration",
                    "THERAPIST_ID": "therapist_id",
                    "GROUP_ID": "group_id",
                    "TIME": "time",
                }

                for c3d_field, output_field in field_mappings.items():
                    if c3d_field in info_params:
                        # Convert to string to prevent type errors
                        value = info_params[c3d_field]["value"][0]
                        metadata[output_field] = str(value)

            # Player information from SUBJECTS parameters
            if "SUBJECTS" in c3d_data["parameters"]:
                subject_params = c3d_data["parameters"]["SUBJECTS"]

                if "NAMES" in subject_params:
                    names = subject_params["NAMES"]["value"]
                    if names and len(names) > 0:
                        metadata["player_name"] = str(names[0])

            # Technical metadata
            if "ANALOG" in c3d_data["parameters"]:
                analog_params = c3d_data["parameters"]["ANALOG"]

                if "RATE" in analog_params:
                    metadata["sampling_rate"] = float(analog_params["RATE"]["value"][0])

                if "LABELS" in analog_params:
                    labels = analog_params["LABELS"]["value"]
                    metadata["channel_names"] = [str(label) for label in labels if label.strip()]
                    metadata["channel_count"] = len(metadata["channel_names"])

            # Frame information
            if "POINT" in c3d_data["parameters"]:
                point_params = c3d_data["parameters"]["POINT"]
                if "FRAMES" in point_params:
                    metadata["frame_count"] = int(point_params["FRAMES"]["value"][0])

            # Calculate duration if we have sampling rate and frame count
            if "sampling_rate" in metadata and "frame_count" in metadata:
                metadata["duration_seconds"] = metadata["frame_count"] / metadata["sampling_rate"]

            logger.debug(f"Extracted C3D metadata: {list(metadata.keys())}")
            return metadata

        except Exception as e:
            logger.exception(f"Failed to extract C3D metadata: {e!s}")
            return {}

    @staticmethod
    def load_c3d_file(file_path: str):
        """Load C3D file using ezc3d library.

        Args:
            file_path: Path to C3D file

        Returns:
            Loaded C3D data or None if failed
        """
        if ezc3d is None:
            logger.error("ezc3d library not available")
            return None

        try:
            return ezc3d.c3d(file_path)
        except Exception as e:
            logger.exception(f"Failed to load C3D file {file_path}: {e!s}")
            return None

    @staticmethod
    def get_technical_summary(metadata: dict[str, Any]) -> str:
        """Generate a technical summary string for logging.

        Args:
            metadata: C3D metadata dictionary

        Returns:
            Human-readable summary string
        """
        channel_count = metadata.get("channel_count", 0)
        duration = metadata.get("duration_seconds", 0)
        sampling_rate = metadata.get("sampling_rate", 0)

        return f"{channel_count} channels, {duration:.1f}s @ {sampling_rate}Hz"
