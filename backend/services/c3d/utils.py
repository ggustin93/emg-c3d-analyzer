"""Shared C3D utilities to eliminate code duplication
Simple, focused utility functions for C3D metadata extraction.
"""

import logging
from typing import Any

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

                # Extended field mappings to capture all available metadata
                field_mappings = {
                    "SYSTEM": "system",
                    "EVENT": "event",
                    "GAME_NAME": "game_name",
                    "GAME_LEVEL": "level",
                    "GAME_LEVEL_NAME": "level_name",
                    "VERSION": "version",
                    "DURATION": "duration",
                    "THERAPIST_ID": "therapist_id",
                    "GROUP_ID": "group_id",
                    "TIME": "time",
                }

                for c3d_field, output_field in field_mappings.items():
                    if c3d_field in info_params:
                        # Handle empty value lists gracefully
                        value_list = info_params[c3d_field].get("value", [])
                        if value_list and len(value_list) > 0 and value_list[0] is not None:
                            value = value_list[0]
                            # Special handling for DURATION field - convert to float
                            if output_field == "duration":
                                try:
                                    metadata[output_field] = float(value)
                                except (ValueError, TypeError):
                                    metadata[output_field] = str(value)
                            else:
                                metadata[output_field] = str(value)

            # Player information from SUBJECTS parameters
            if "SUBJECTS" in c3d_data["parameters"]:
                subject_params = c3d_data["parameters"]["SUBJECTS"]

                # Check for PLAYER_NAME first (as seen in the actual data)
                if "PLAYER_NAME" in subject_params:
                    value_list = subject_params["PLAYER_NAME"].get("value", [])
                    if value_list and len(value_list) > 0 and value_list[0]:
                        metadata["player_name"] = str(value_list[0])
                elif "NAMES" in subject_params:
                    names = subject_params["NAMES"].get("value", [])
                    if names and len(names) > 0 and names[0]:
                        metadata["player_name"] = str(names[0])
                
                # Extract game score if available
                if "GAME_SCORE" in subject_params:
                    value_list = subject_params["GAME_SCORE"].get("value", [])
                    if value_list and len(value_list) > 0 and value_list[0] is not None:
                        try:
                            metadata["game_score"] = float(value_list[0])
                        except (ValueError, TypeError):
                            metadata["game_score"] = str(value_list[0])
                
                # Extract marker set information
                if "MARKER_SET" in subject_params:
                    value_list = subject_params["MARKER_SET"].get("value", [])
                    if value_list and len(value_list) > 0 and value_list[0]:
                        metadata["marker_set"] = str(value_list[0])

            # Technical metadata from ANALOG
            if "ANALOG" in c3d_data["parameters"]:
                analog_params = c3d_data["parameters"]["ANALOG"]

                if "RATE" in analog_params:
                    value_list = analog_params["RATE"].get("value", [])
                    if value_list and len(value_list) > 0 and value_list[0] is not None:
                        try:
                            metadata["sampling_rate"] = float(value_list[0])
                        except (ValueError, TypeError):
                            pass

                if "LABELS" in analog_params:
                    labels = analog_params["LABELS"].get("value", [])
                    if labels:
                        # Filter out empty strings and None values
                        metadata["channel_names"] = [str(label) for label in labels if label and str(label).strip()]
                        metadata["channel_count"] = len(metadata["channel_names"])
                
                if "GEN_SCALE" in analog_params:
                    value_list = analog_params["GEN_SCALE"].get("value", [])
                    if value_list and len(value_list) > 0 and value_list[0] is not None:
                        try:
                            metadata["gen_scale"] = float(value_list[0])
                        except (ValueError, TypeError):
                            pass

            # Frame information from POINT
            if "POINT" in c3d_data["parameters"]:
                point_params = c3d_data["parameters"]["POINT"]
                
                if "FRAMES" in point_params:
                    value_list = point_params["FRAMES"].get("value", [])
                    if value_list and len(value_list) > 0 and value_list[0] is not None:
                        try:
                            metadata["frame_count"] = int(value_list[0])
                        except (ValueError, TypeError):
                            pass
                
                if "RATE" in point_params:
                    value_list = point_params["RATE"].get("value", [])
                    if value_list and len(value_list) > 0 and value_list[0] is not None:
                        try:
                            metadata["point_rate"] = float(value_list[0])
                        except (ValueError, TypeError):
                            pass
                
                if "DATA_TYPE_LABELS" in point_params:
                    value_list = point_params["DATA_TYPE_LABELS"].get("value", [])
                    if value_list and len(value_list) > 0 and value_list[0]:
                        metadata["data_type_labels"] = str(value_list[0])

            # Calculate duration if we have sampling rate and frame count
            if "sampling_rate" in metadata and "frame_count" in metadata:
                metadata["duration_seconds"] = metadata["frame_count"] / metadata["sampling_rate"]

            logger.debug(f"Extracted C3D metadata: {list(metadata.keys())}")
            return metadata

        except Exception as e:
            logger.exception(f"Failed to extract C3D metadata: {e!s}")
            return {}

    @staticmethod
    def load_c3d_file(file_path):
        """Load C3D file using ezc3d library.

        Args:
            file_path: Path to C3D file (str or pathlib.Path)

        Returns:
            Loaded C3D data or None if failed
        """
        if ezc3d is None:
            logger.error("ezc3d library not available")
            return None

        try:
            # Convert pathlib.Path to string if needed
            file_path_str = str(file_path)
            return ezc3d.c3d(file_path_str)
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
