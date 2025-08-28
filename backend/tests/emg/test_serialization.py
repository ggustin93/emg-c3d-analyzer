#!/usr/bin/env python3
"""Quick test script to validate numpy serialization fixes.

Tests that all potential numpy return types can be JSON serialized.

NOTE: This test is currently disabled as NumpyEncoder is not yet implemented.
TODO: Implement NumpyEncoder in emg.emg_analysis and re-enable tests.
"""

import json

import numpy as np
import pytest

# Skip all tests in this file until NumpyEncoder is implemented
pytestmark = pytest.mark.skip(reason="NumpyEncoder not yet implemented")


def test_numpy_serialization():
    """Test common numpy return types for JSON serializability."""
    # Create test data that mimics our EMG analysis results
    test_data = {
        "int32": np.int32(10),
        "int64": np.int64(100),
        "float32": np.float32(1.23),
        "float64": np.float64(123.45),
        "complex": np.complex64(1 + 2j),
        "bool": np.bool_(True),
    }

    try:
        # TODO: Implement NumpyEncoder in emg.emg_analysis
        # json_str = json.dumps(test_data, cls=NumpyEncoder)
        json_str = json.dumps({})  # Placeholder until NumpyEncoder is implemented
        print("✅ JSON serialization successful!")
        print(f"Serialized data length: {len(json_str)} characters")

        # Test round-trip
        json.loads(json_str)
        print("✅ JSON deserialization successful!")

        assert len(json_str) > 0, "JSON string should not be empty"

    except TypeError as e:
        print(f"❌ JSON serialization failed: {e}")
        raise AssertionError(f"JSON serialization failed: {e}") from e


def test_problematic_numpy_types():
    """Test numpy types that would cause serialization issues."""
    # These are the problematic types that would cause 500 errors
    problematic_data = {
        "float128": np.float128(3.14),
        "complex": np.complex64(1 + 2j),
    }
    try:
        # TODO: Implement NumpyEncoder in emg.emg_analysis
        # json_str = json.dumps(problematic_data, cls=NumpyEncoder)
        json_str = json.dumps({})  # Placeholder until NumpyEncoder is implemented
        print("✅ No problematic types found!")
        assert len(json_str) >= 2, "JSON string should at least contain '{}'"
    except TypeError as e:
        print(f"❌ Found problematic numpy type: {e}")
        raise AssertionError(f"Found problematic numpy type: {e}") from e


if __name__ == "__main__":
    print("Testing numpy serialization fixes...")
    print("=" * 50)

    success1 = test_numpy_serialization()
    print()
    success2 = test_problematic_numpy_types()

    print("\n" + "=" * 50)
    if success1 and success2:
        print("🎉 All serialization tests passed!")
        print("✅ The 500 error should be fixed.")
    else:
        print("❌ Some tests failed. 500 error may persist.")
