"""C3D Reader Service - Lightweight Metadata Extractor.
===================================================

🎯 PURPOSE: Fast metadata extraction WITHOUT signal processing
- Quick extraction of technical info (channels, sampling rate, duration)
- Lightweight alternative when you don't need full EMG analysis
- Used for file validation and preview functionality

🔗 RESPONSIBILITIES:
- Parse C3D file headers and parameter blocks
- Extract basic game metadata from INFO parameters
- No signal processing or analytics (use c3d_processor.py for that)

📊 OUTPUT: Basic metadata dictionary for file preview/validation
"""

import logging
import struct
from typing import Any

logger = logging.getLogger(__name__)


class C3DReader:
    """Service for reading C3D file metadata without full processing."""

    def __init__(self):
        self.parameter_section_size = None
        self.data_section_size = None

    async def extract_metadata(self, file_data: bytes) -> dict[str, Any]:
        """Extract metadata from C3D file content.

        Args:
            file_data: Raw C3D file bytes

        Returns:
            Dict containing extracted metadata
        """
        try:
            # Initialize metadata dict
            metadata = {
                "channel_names": [],
                "channel_count": 0,
                "sampling_rate": None,
                "duration_seconds": None,
                "frame_count": 0,
                "game_metadata": {},
                "session_duration": None,
                "session_notes": None,
                "therapist_id": None,
                "player_name": None,
            }

            # Read C3D header and parameters
            header_info = self._read_header(file_data)
            metadata.update(header_info)

            # Extract parameter block
            parameter_info = self._read_parameters(file_data, header_info.get("parameter_start", 2))
            metadata.update(parameter_info)

            # Calculate derived values
            if metadata["sampling_rate"] and metadata["frame_count"]:
                metadata["duration_seconds"] = metadata["frame_count"] / metadata["sampling_rate"]

            logger.info(
                f"Extracted metadata from C3D file: {len(metadata['channel_names'])} channels, {metadata['duration_seconds']}s"
            )

            return metadata

        except Exception as e:
            logger.exception(f"Failed to extract C3D metadata: {e!s}")
            # Return minimal metadata on failure
            return {
                "channel_names": [],
                "channel_count": 0,
                "sampling_rate": None,
                "duration_seconds": None,
                "frame_count": 0,
                "game_metadata": {},
                "session_duration": None,
                "session_notes": None,
                "therapist_id": None,
                "player_name": None,
            }

    def _read_header(self, file_data: bytes) -> dict[str, Any]:
        """Read C3D file header.

        Args:
            file_data: Raw C3D file bytes

        Returns:
            Dict with header information
        """
        if len(file_data) < 512:  # Minimum C3D header size
            raise ValueError("File too small to be a valid C3D file")

        header = {}

        try:
            # Read first record (header)
            header_bytes = file_data[:512]

            # Read key header fields
            # Parameter section start (word 1, byte 1)
            header["parameter_start"] = struct.unpack("<H", header_bytes[0:2])[0]

            # Key flag (byte 3)
            key_flag = struct.unpack("<B", header_bytes[2:3])[0]
            header["key_flag"] = key_flag

            # Check if this is a valid C3D file
            if key_flag != 80:  # 0x50 = 80 decimal
                logger.warning(f"Unexpected key flag in C3D header: {key_flag} (expected 80)")

            # Number of 3D points (word 2)
            header["num_3d_points"] = struct.unpack("<H", header_bytes[2:4])[0] & 0x7FFF

            # Number of analog channels (word 3)
            header["num_analog_channels"] = struct.unpack("<H", header_bytes[4:6])[0]

            # First frame number (word 4)
            header["first_frame"] = struct.unpack("<H", header_bytes[6:8])[0]

            # Last frame number (word 5)
            header["last_frame"] = struct.unpack("<H", header_bytes[8:10])[0]

            # Calculate frame count
            if header["last_frame"] >= header["first_frame"]:
                header["frame_count"] = header["last_frame"] - header["first_frame"] + 1
            else:
                header["frame_count"] = 0

            # Maximum interpolation gap (word 6)
            header["max_interpolation_gap"] = struct.unpack("<H", header_bytes[10:12])[0]

            # 3D scale factor (float at word 7-8)
            header["scale_factor"] = struct.unpack("<f", header_bytes[12:16])[0]

            # Data section start (word 9)
            header["data_start"] = struct.unpack("<H", header_bytes[16:18])[0]

            # Analog samples per frame (word 10)
            header["analog_samples_per_frame"] = struct.unpack("<H", header_bytes[18:20])[0]

            # Frame rate (float at word 11-12)
            header["sampling_rate"] = struct.unpack("<f", header_bytes[20:24])[0]

            return header

        except Exception as e:
            logger.exception(f"Error reading C3D header: {e!s}")
            raise

    def _read_parameters(self, file_data: bytes, parameter_start: int) -> dict[str, Any]:
        """Read C3D parameter section.

        Args:
            file_data: Raw C3D file bytes
            parameter_start: Starting block of parameter section

        Returns:
            Dict with parameter information
        """
        if parameter_start <= 0:
            logger.warning("Invalid parameter section start")
            return {}

        try:
            # Calculate parameter section start in bytes (blocks are 512 bytes)
            param_offset = (parameter_start - 1) * 512

            if param_offset >= len(file_data):
                logger.warning("Parameter section beyond file end")
                return {}

            parameters = {}

            # Read parameter header
            param_header = file_data[param_offset : param_offset + 8]
            if len(param_header) < 8:
                return {}

            # First 4 bytes: reserved (should be 0x50, 0x00, 0x00, 0x00)
            # Bytes 5-6: Number of parameter blocks
            num_param_blocks = struct.unpack("<H", param_header[4:6])[0]

            # Bytes 7: Processor type (83=DEC, 84=Intel, 85=SGI)
            processor_type = struct.unpack("<B", param_header[6:7])[0]

            parameters["num_parameter_blocks"] = num_param_blocks
            parameters["processor_type"] = processor_type

            # Parse parameter groups
            offset = param_offset + 8
            channel_names = []

            try:
                # Look for ANALOG group for channel names
                analog_group = self._find_parameter_group(file_data, offset, "ANALOG")
                if analog_group:
                    # Look for LABELS parameter within ANALOG group
                    labels = analog_group.get("LABELS")
                    if labels and isinstance(labels, list):
                        channel_names = [label.strip() for label in labels if label.strip()]

                # Look for POINT group for 3D point labels
                point_group = self._find_parameter_group(file_data, offset, "POINT")
                if point_group:
                    point_labels = point_group.get("LABELS")
                    if point_labels and isinstance(point_labels, list):
                        # Add point labels as additional "channels" (though they're 3D points)
                        for label in point_labels:
                            if label.strip():
                                channel_names.append(f"POINT_{label.strip()}")

                # Look for SUBJECT group for clinical metadata
                subject_group = self._find_parameter_group(file_data, offset, "SUBJECT")
                if subject_group:
                    if "NAME" in subject_group:
                        parameters["player_name"] = subject_group["NAME"]
                    if "THERAPIST_ID" in subject_group:
                        parameters["therapist_id"] = subject_group["THERAPIST_ID"]
                    if "NOTES" in subject_group:
                        parameters["session_notes"] = subject_group["NOTES"]

                # Look for SESSION group for session metadata
                session_group = self._find_parameter_group(file_data, offset, "SESSION")
                if session_group:
                    if "DURATION" in session_group:
                        parameters["session_duration"] = session_group["DURATION"]
                    if "TYPE" in session_group:
                        parameters["session_type"] = session_group["TYPE"]

                # Store game metadata
                game_metadata = {}
                if parameters.get("player_name"):
                    game_metadata["player_name"] = parameters["player_name"]
                if parameters.get("therapist_id"):
                    game_metadata["therapist_id"] = parameters["therapist_id"]

                parameters["game_metadata"] = game_metadata

            except Exception as e:
                logger.warning(f"Error parsing parameter groups: {e!s}")

            # Set channel information
            parameters["channel_names"] = channel_names
            parameters["channel_count"] = len(channel_names)

            return parameters

        except Exception as e:
            logger.exception(f"Error reading C3D parameters: {e!s}")
            return {}

    def _find_parameter_group(
        self, file_data: bytes, start_offset: int, group_name: str
    ) -> dict[str, Any] | None:
        """Find and parse a specific parameter group.

        Args:
            file_data: Raw C3D file bytes
            start_offset: Starting offset in file
            group_name: Name of group to find (e.g., "ANALOG")

        Returns:
            Dict with group parameters or None if not found
        """
        try:
            # This is a simplified parameter parser
            # A full implementation would parse the entire parameter structure
            # For now, we'll look for common patterns and try to extract basic info

            # Look for the group name in the parameter section
            search_bytes = group_name.encode("ascii")

            # Search in a reasonable range (first 10KB of parameter section)
            search_end = min(start_offset + 10240, len(file_data))
            search_data = file_data[start_offset:search_end]

            group_pos = search_data.find(search_bytes)
            if group_pos == -1:
                return None

            # This is a basic implementation that looks for common parameter patterns
            # A full C3D parser would properly decode the parameter structure
            group_data = {}

            # Look for LABELS parameter (common in ANALOG and POINT groups)
            if group_name in ["ANALOG", "POINT"]:
                # Try to find channel/point labels
                labels = self._extract_labels_from_section(
                    file_data[start_offset + group_pos : start_offset + group_pos + 2048]
                )
                if labels:
                    group_data["LABELS"] = labels

            # Look for subject information
            elif group_name == "SUBJECT":
                # Look for common subject fields
                section_data = file_data[start_offset + group_pos : start_offset + group_pos + 1024]
                name = self._extract_string_parameter(section_data, "NAME")
                if name:
                    group_data["NAME"] = name

                therapist = self._extract_string_parameter(section_data, "THERAPIST")
                if therapist:
                    group_data["THERAPIST_ID"] = therapist

            return group_data if group_data else None

        except Exception as e:
            logger.warning(f"Error finding parameter group {group_name}: {e!s}")
            return None

    def _extract_labels_from_section(self, section_data: bytes) -> list[str]:
        """Extract channel/point labels from a parameter section.

        Args:
            section_data: Bytes from parameter section

        Returns:
            List of extracted labels
        """
        labels = []

        try:
            # Look for common EMG channel naming patterns
            common_patterns = [b"EMG", b"BicepsL", b"BicepsR", b"TricepsL", b"TricepsR", b"Channel"]

            # Simple extraction - look for ASCII strings
            text_data = section_data.decode("ascii", errors="ignore")

            # Split on null bytes and filter
            potential_labels = [s.strip() for s in text_data.split("\x00") if s.strip()]

            # Filter for likely channel names (3-20 characters, alphanumeric + underscore)
            for label in potential_labels:
                if 3 <= len(label) <= 20 and label.replace("_", "").replace("-", "").isalnum():
                    labels.append(label)

            # Limit to reasonable number of labels
            return labels[:50]

        except Exception as e:
            logger.warning(f"Error extracting labels: {e!s}")
            return []

    def _extract_string_parameter(self, section_data: bytes, param_name: str) -> str | None:
        """Extract a string parameter from a section.

        Args:
            section_data: Bytes from parameter section
            param_name: Name of parameter to extract

        Returns:
            Extracted string value or None
        """
        try:
            # Look for parameter name
            param_bytes = param_name.encode("ascii")
            param_pos = section_data.find(param_bytes)

            if param_pos == -1:
                return None

            # Look for string value after parameter name
            # This is a simplified extraction
            after_param = section_data[param_pos + len(param_bytes) :]

            # Try to extract ASCII string
            text_data = after_param[:100].decode("ascii", errors="ignore")

            # Find first reasonable string
            parts = text_data.split("\x00")
            for part in parts:
                cleaned = part.strip()
                if 1 <= len(cleaned) <= 50 and cleaned.isprintable():
                    return cleaned

            return None

        except Exception as e:
            logger.warning(f"Error extracting string parameter {param_name}: {e!s}")
            return None
