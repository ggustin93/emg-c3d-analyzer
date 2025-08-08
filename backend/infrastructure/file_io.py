"""
File I/O Infrastructure

Handles file operations for C3D files and data persistence.
Abstracts file system operations from business logic.
"""

import os
import json
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional, BinaryIO
import ezc3d
import numpy as np
from ..core.constants import SUPPORTED_FILE_EXTENSIONS, MAX_FILE_SIZE_MB


class C3DFileHandler:
    """Handles C3D file reading and validation."""
    
    @staticmethod
    def validate_file(file_path: str) -> bool:
        """
        Validate C3D file format and size.
        
        Args:
            file_path: Path to the C3D file
            
        Returns:
            True if file is valid, False otherwise
        """
        try:
            # Check file extension
            if not any(file_path.lower().endswith(ext) for ext in SUPPORTED_FILE_EXTENSIONS):
                return False
                
            # Check file size
            file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
            if file_size_mb > MAX_FILE_SIZE_MB:
                return False
                
            # Try to read C3D header
            c3d_file = ezc3d.c3d(file_path)
            return True
            
        except Exception:
            return False
    
    @staticmethod
    def read_c3d_file(file_path: str) -> ezc3d.c3d:
        """
        Read C3D file and return c3d object.
        
        Args:
            file_path: Path to the C3D file
            
        Returns:
            Parsed C3D file object
            
        Raises:
            FileNotFoundError: If file doesn't exist
            ValueError: If file format is invalid
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"C3D file not found: {file_path}")
            
        if not C3DFileHandler.validate_file(file_path):
            raise ValueError(f"Invalid C3D file: {file_path}")
            
        return ezc3d.c3d(file_path)
    
    @staticmethod
    def extract_metadata(c3d_file: ezc3d.c3d) -> Dict[str, Any]:
        """
        Extract metadata from C3D file.
        
        Args:
            c3d_file: Parsed C3D file object
            
        Returns:
            Dictionary containing file metadata
        """
        try:
            header = c3d_file['header']
            parameters = c3d_file['parameters']
            
            metadata = {
                'sampling_rate': float(parameters['ANALOG']['RATE']['value'][0]),
                'num_frames': int(header['points']['last_frame'][0] - header['points']['first_frame'][0] + 1),
                'num_analog_channels': int(header['analogs']['size'][0]),
                'frame_rate': float(parameters['POINT']['RATE']['value'][0]),
                'analog_labels': [label.strip() for label in parameters['ANALOG']['LABELS']['value']],
            }
            
            # Add optional metadata if available
            if 'SUBJECTS' in parameters:
                metadata['subject_info'] = parameters['SUBJECTS']
            
            return metadata
            
        except Exception as e:
            # Return minimal metadata on error
            return {
                'sampling_rate': 1000.0,  # Default
                'error': str(e)
            }


class FileSystemManager:
    """Manages file system operations and temporary files."""
    
    def __init__(self, temp_dir: Optional[str] = None):
        self.temp_dir = temp_dir or tempfile.gettempdir()
        
    def create_temp_file(self, suffix: str = '.tmp') -> str:
        """
        Create a temporary file and return its path.
        
        Args:
            suffix: File extension/suffix
            
        Returns:
            Path to temporary file
        """
        fd, temp_path = tempfile.mkstemp(suffix=suffix, dir=self.temp_dir)
        os.close(fd)  # Close file descriptor
        return temp_path
    
    def write_json(self, data: Dict[str, Any], file_path: str) -> None:
        """
        Write data to JSON file.
        
        Args:
            data: Data to write
            file_path: Output file path
        """
        with open(file_path, 'w') as f:
            json.dump(data, f, indent=2, default=self._json_serializer)
    
    def read_json(self, file_path: str) -> Dict[str, Any]:
        """
        Read data from JSON file.
        
        Args:
            file_path: Input file path
            
        Returns:
            Loaded data dictionary
        """
        with open(file_path, 'r') as f:
            return json.load(f)
    
    @staticmethod
    def _json_serializer(obj):
        """JSON serializer for numpy arrays and other objects."""
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.integer):
            return int(obj)
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
    
    def cleanup_temp_files(self, file_paths: list) -> None:
        """
        Clean up temporary files.
        
        Args:
            file_paths: List of file paths to remove
        """
        for file_path in file_paths:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception:
                pass  # Ignore cleanup errors
    
    def ensure_directory(self, dir_path: str) -> None:
        """
        Ensure directory exists, create if necessary.
        
        Args:
            dir_path: Directory path to ensure
        """
        Path(dir_path).mkdir(parents=True, exist_ok=True)