"""Utility functions for extracting dates from C3D filenames.

This module provides robust date extraction from GHOSTLY C3D filenames
following the pattern: Ghostly_Emg_YYYYMMDD_HH-MM-SS-SSSS.c3d
"""

import re
from datetime import datetime
from pathlib import Path
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def extract_session_date_from_filename(filename: str) -> Optional[datetime]:
    """Extract session date from C3D filename.
    
    Supports multiple filename patterns:
    1. Standard GHOSTLY format: Ghostly_Emg_YYYYMMDD_HH-MM-SS-SSSS.c3d
    2. With patient folder: P###/Ghostly_Emg_YYYYMMDD_HH-MM-SS-SSSS.c3d  
    3. With duplicates: Ghostly_Emg_YYYYMMDD_HH-MM-SS-SSSS (1).c3d
    4. Case variations: ghostly_emg, GHOSTLY_EMG, etc.
    
    Args:
        filename: The C3D filename or full path
        
    Returns:
        datetime object if date extracted successfully, None otherwise
        
    Examples:
        >>> extract_session_date_from_filename("Ghostly_Emg_20230321_17-23-09-0409.c3d")
        datetime(2023, 3, 21, 17, 23, 9, 409000)
        
        >>> extract_session_date_from_filename("P039/Ghostly_Emg_20230321_17-23-09-0409.c3d")
        datetime(2023, 3, 21, 17, 23, 9, 409000)
        
        >>> extract_session_date_from_filename("Ghostly_Emg_20230321_17-23-09-0409 (1).c3d")
        datetime(2023, 3, 21, 17, 23, 9, 409000)
    """
    if not filename:
        logger.warning("Empty filename provided for date extraction")
        return None
        
    try:
        # Extract just the filename if a path was provided
        base_filename = Path(filename).name
        
        # Pattern for GHOSTLY filename format: Ghostly_Emg_YYYYMMDD_HH-MM-SS-SSSS
        # Case-insensitive matching and handles optional spaces/underscores
        pattern = r'(?i)ghostly[_\s]*emg[_\s]*(\d{8})[_\s]*(\d{2})-(\d{2})-(\d{2})-(\d{4})'
        
        match = re.search(pattern, base_filename)
        if not match:
            # Try alternative patterns for edge cases
            # Pattern without milliseconds: Ghostly_Emg_YYYYMMDD_HH-MM-SS
            alt_pattern = r'(?i)ghostly[_\s]*emg[_\s]*(\d{8})[_\s]*(\d{2})-(\d{2})-(\d{2})'
            match = re.search(alt_pattern, base_filename)
            
            if match:
                date_str = match.group(1)  # YYYYMMDD
                hour = int(match.group(2))  # HH
                minute = int(match.group(3))  # MM
                second = int(match.group(4))  # SS
                millisecond = 0  # No milliseconds in this format
            else:
                logger.debug(f"No date pattern found in filename: {base_filename}")
                return None
        else:
            date_str = match.group(1)  # YYYYMMDD
            hour = int(match.group(2))  # HH
            minute = int(match.group(3))  # MM
            second = int(match.group(4))  # SS
            # Convert 4-digit milliseconds to microseconds (multiply by 100)
            millisecond = int(match.group(5)) * 100  # SSSS -> microseconds
        
        # Parse the date components
        year = int(date_str[0:4])
        month = int(date_str[4:6])
        day = int(date_str[6:8])
        
        # Validate date components
        if not (1900 <= year <= 2100):
            logger.warning(f"Invalid year {year} in filename: {base_filename}")
            return None
            
        if not (1 <= month <= 12):
            logger.warning(f"Invalid month {month} in filename: {base_filename}")
            return None
            
        if not (1 <= day <= 31):
            logger.warning(f"Invalid day {day} in filename: {base_filename}")
            return None
            
        if not (0 <= hour <= 23):
            logger.warning(f"Invalid hour {hour} in filename: {base_filename}")
            return None
            
        if not (0 <= minute <= 59):
            logger.warning(f"Invalid minute {minute} in filename: {base_filename}")
            return None
            
        if not (0 <= second <= 59):
            logger.warning(f"Invalid second {second} in filename: {base_filename}")
            return None
        
        # Create datetime object
        session_datetime = datetime(year, month, day, hour, minute, second, millisecond)
        
        logger.debug(f"Extracted date {session_datetime} from filename: {base_filename}")
        return session_datetime
        
    except ValueError as e:
        logger.warning(f"Invalid date components in filename {filename}: {e}")
        return None
    except Exception as e:
        logger.exception(f"Unexpected error extracting date from filename {filename}: {e}")
        return None


def extract_patient_code_from_path(file_path: str) -> Optional[str]:
    """Extract patient code from file path.
    
    Looks for patient code pattern (P###) in the file path.
    
    Args:
        file_path: Full or relative file path
        
    Returns:
        Patient code (e.g., "P039") if found, None otherwise
        
    Examples:
        >>> extract_patient_code_from_path("P039/Ghostly_Emg_20230321_17-23-09-0409.c3d")
        "P039"
        
        >>> extract_patient_code_from_path("c3d-examples/P001/test.c3d")
        "P001"
    """
    if not file_path:
        return None
        
    # Pattern for patient code: P followed by 3 digits
    pattern = r'P(\d{3})'
    
    match = re.search(pattern, file_path, re.IGNORECASE)
    if match:
        # Return in uppercase format
        return f"P{match.group(1)}"
    
    return None


def generate_session_code(patient_code: str, session_number: int) -> str:
    """Generate a session code in format P###S###.
    
    Args:
        patient_code: Patient code (e.g., "P039" or just "039")
        session_number: Session number (1-999)
        
    Returns:
        Session code in format P###S### (e.g., "P039S001")
        
    Raises:
        ValueError: If inputs are invalid
        
    Examples:
        >>> generate_session_code("P039", 1)
        "P039S001"
        
        >>> generate_session_code("039", 15)
        "P039S015"
        
        >>> generate_session_code("P001", 123)
        "P001S123"
    """
    if not patient_code:
        raise ValueError("Patient code is required")
        
    if session_number < 1 or session_number > 999:
        raise ValueError("Session number must be between 1 and 999")
    
    # Extract numeric part from patient code
    if patient_code.upper().startswith('P'):
        patient_num = patient_code[1:]
    else:
        patient_num = patient_code
        
    # Validate patient number is numeric and in range
    try:
        patient_int = int(patient_num)
        if patient_int < 1 or patient_int > 999:
            raise ValueError("Patient number must be between 1 and 999")
    except ValueError as e:
        raise ValueError(f"Invalid patient code format: {patient_code}") from e
    
    # Format as P###S###
    return f"P{patient_int:03d}S{session_number:03d}"


def parse_session_code(session_code: str) -> Optional[tuple[str, int]]:
    """Parse a session code to extract patient code and session number.
    
    Args:
        session_code: Session code in format P###S### (e.g., "P039S001")
        
    Returns:
        Tuple of (patient_code, session_number) if valid, None otherwise
        
    Examples:
        >>> parse_session_code("P039S001")
        ("P039", 1)
        
        >>> parse_session_code("P001S123")
        ("P001", 123)
    """
    if not session_code:
        return None
        
    # Pattern for session code: P###S###
    pattern = r'^P(\d{3})S(\d{3})$'
    
    match = re.match(pattern, session_code, re.IGNORECASE)
    if match:
        patient_code = f"P{match.group(1)}"
        session_number = int(match.group(2))
        return (patient_code, session_number)
    
    return None