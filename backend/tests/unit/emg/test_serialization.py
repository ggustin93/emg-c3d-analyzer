#!/usr/bin/env python3
"""Numpy Serialization Tests.

Tests that all potential numpy return types can be JSON serialized
using the NumpyEncoder for EMG analysis results.

Author: EMG C3D Analyzer Team
Date: 2025-08-28
"""

import json
import sys
from pathlib import Path

import numpy as np
import pytest

# Add backend directory to path for imports
backend_dir = Path(__file__).resolve().parents[2]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from utils.numpy_encoder import NumpyEncoder, serialize_numpy_data, safe_json_dumps


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
        "array": np.array([1, 2, 3]),
        "string": np.str_("test"),
    }
    
    # Test that all numpy types can be serialized
    json_string = json.dumps(test_data, cls=NumpyEncoder)
    
    # Verify we can deserialize it back
    deserialized = json.loads(json_string)
    
    # Verify basic types are converted correctly
    assert deserialized["int32"] == 10
    assert deserialized["int64"] == 100
    assert abs(deserialized["float32"] - 1.23) < 1e-6
    assert abs(deserialized["float64"] - 123.45) < 1e-10
    assert deserialized["bool"] is True
    assert deserialized["array"] == [1, 2, 3]
    assert deserialized["string"] == "test"
    
    # Complex numbers are serialized as objects
    assert deserialized["complex"]["real"] == 1.0
    assert deserialized["complex"]["imag"] == 2.0


def test_problematic_numpy_types():
    """Test numpy types that would cause serialization issues."""
    # These are the problematic types that would cause 500 errors
    problematic_data = {
        "float128": np.float128(3.14) if hasattr(np, 'float128') else np.float64(3.14),
        "complex": np.complex64(1 + 2j),
        "large_array": np.random.random((5, 5)),
        "nested_structure": {
            "values": np.array([1.0, 2.0, 3.0]),
            "metadata": {
                "mean": np.float32(2.0),
                "std": np.float32(0.816)
            }
        }
    }
    
    # Test that all problematic types can be serialized with NumpyEncoder
    json_str = json.dumps(problematic_data, cls=NumpyEncoder)
    
    # Verify deserialization works
    deserialized = json.loads(json_str)
    
    # Verify complex structures are handled
    assert isinstance(deserialized["large_array"], list)
    assert len(deserialized["large_array"]) == 5
    assert len(deserialized["large_array"][0]) == 5
    
    assert isinstance(deserialized["nested_structure"]["values"], list)
    assert len(deserialized["nested_structure"]["values"]) == 3
    assert abs(deserialized["nested_structure"]["metadata"]["mean"] - 2.0) < 1e-6


def test_convenience_functions():
    """Test convenience functions for numpy serialization."""
    test_data = {
        "metrics": {
            "rms": np.float32(1.23),
            "mav": np.float64(2.45),
            "channels": np.array(['EMG1', 'EMG2', 'EMG3'])
        }
    }
    
    # Test serialize_numpy_data
    json_string = serialize_numpy_data(test_data)
    assert isinstance(json_string, str)
    assert "1.23" in json_string
    
    # Test safe_json_dumps
    safe_json = safe_json_dumps(test_data)
    assert isinstance(safe_json, str)
    
    # Both should produce the same result
    deserialized1 = json.loads(json_string)
    deserialized2 = json.loads(safe_json)
    
    assert deserialized1 == deserialized2


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
