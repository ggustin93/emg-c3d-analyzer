#!/usr/bin/env python3
"""Test script for date extraction utility."""

from datetime import datetime
import sys
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).resolve().parents[1]))

from utils.date_extraction import (
    extract_session_date_from_filename,
    extract_patient_code_from_path,
    generate_session_code,
    parse_session_code,
)


def test_date_extraction():
    """Test date extraction from various filename formats."""
    test_cases = [
        ("Ghostly_Emg_20230321_17-23-09-0409.c3d", datetime(2023, 3, 21, 17, 23, 9, 40900)),
        ("P039/Ghostly_Emg_20230321_17-23-09-0409.c3d", datetime(2023, 3, 21, 17, 23, 9, 40900)),
        ("Ghostly_Emg_20230321_17-23-09-0409 (1).c3d", datetime(2023, 3, 21, 17, 23, 9, 40900)),
        ("ghostly_emg_20231204_13-18-43-0464.c3d", datetime(2023, 12, 4, 13, 18, 43, 46400)),
        ("GHOSTLY_EMG_20250101_00-00-00-0000.c3d", datetime(2025, 1, 1, 0, 0, 0, 0)),
    ]
    
    print("Testing date extraction from filenames:")
    print("-" * 60)
    
    for filename, expected in test_cases:
        result = extract_session_date_from_filename(filename)
        if result == expected:
            print(f"✅ PASS: {filename}")
            print(f"   Extracted: {result}")
        else:
            print(f"❌ FAIL: {filename}")
            print(f"   Expected: {expected}")
            print(f"   Got: {result}")
        print()


def test_patient_code_extraction():
    """Test patient code extraction from paths."""
    test_cases = [
        ("P039/Ghostly_Emg_20230321_17-23-09-0409.c3d", "P039"),
        ("c3d-examples/P001/test.c3d", "P001"),
        ("bucket/P123/file.c3d", "P123"),
        ("no_patient_code.c3d", None),
        ("p005/lowercase.c3d", "P005"),  # Case insensitive
    ]
    
    print("\nTesting patient code extraction from paths:")
    print("-" * 60)
    
    for path, expected in test_cases:
        result = extract_patient_code_from_path(path)
        if result == expected:
            print(f"✅ PASS: {path}")
            print(f"   Extracted: {result}")
        else:
            print(f"❌ FAIL: {path}")
            print(f"   Expected: {expected}")
            print(f"   Got: {result}")
        print()


def test_session_code_generation():
    """Test session code generation."""
    test_cases = [
        (("P039", 1), "P039S001"),
        (("039", 15), "P039S015"),
        (("P001", 123), "P001S123"),
        (("P999", 999), "P999S999"),
    ]
    
    print("\nTesting session code generation:")
    print("-" * 60)
    
    for (patient_code, session_num), expected in test_cases:
        try:
            result = generate_session_code(patient_code, session_num)
            if result == expected:
                print(f"✅ PASS: generate_session_code('{patient_code}', {session_num})")
                print(f"   Generated: {result}")
            else:
                print(f"❌ FAIL: generate_session_code('{patient_code}', {session_num})")
                print(f"   Expected: {expected}")
                print(f"   Got: {result}")
        except Exception as e:
            print(f"❌ ERROR: generate_session_code('{patient_code}', {session_num})")
            print(f"   Error: {e}")
        print()


def test_session_code_parsing():
    """Test session code parsing."""
    test_cases = [
        ("P039S001", ("P039", 1)),
        ("P001S123", ("P001", 123)),
        ("P999S999", ("P999", 999)),
        ("invalid", None),
        ("P00S001", None),  # Invalid format (need 3 digits)
    ]
    
    print("\nTesting session code parsing:")
    print("-" * 60)
    
    for session_code, expected in test_cases:
        result = parse_session_code(session_code)
        if result == expected:
            print(f"✅ PASS: parse_session_code('{session_code}')")
            print(f"   Parsed: {result}")
        else:
            print(f"❌ FAIL: parse_session_code('{session_code}')")
            print(f"   Expected: {expected}")
            print(f"   Got: {result}")
        print()


if __name__ == "__main__":
    print("=" * 60)
    print("Date Extraction Utility Test Suite")
    print("=" * 60)
    
    test_date_extraction()
    test_patient_code_extraction()
    test_session_code_generation()
    test_session_code_parsing()
    
    print("\n" + "=" * 60)
    print("Test suite completed!")
    print("=" * 60)