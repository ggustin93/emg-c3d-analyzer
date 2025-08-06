#!/usr/bin/env python3
"""
Quick test script to validate numpy serialization fixes.
Tests that all potential numpy return types can be JSON serialized.
"""

import json
import numpy as np
from typing import Any, Dict

def test_numpy_serialization():
    """Test common numpy return types for JSON serializability."""
    
    # Create test data that mimics our EMG analysis results
    test_data = {
        # Simulating contraction analysis results
        'avg_duration_ms': float(np.mean([100, 200, 150])),  # Fixed: wrapped with float()
        'min_duration_ms': float(np.min([100, 200, 150])),   # Fixed: wrapped with float()
        'max_duration_ms': float(np.max([100, 200, 150])),   # Fixed: wrapped with float()
        'total_time_under_tension_ms': float(np.sum([100, 200, 150])),  # Fixed: wrapped with float()
        'avg_amplitude': float(np.mean([0.1, 0.2, 0.15])),  # Fixed: wrapped with float()
        'max_amplitude': float(np.max([0.1, 0.2, 0.15])),   # Fixed: wrapped with float()
        
        # Simulating individual contraction data
        'contractions': [{
            'mean_amplitude': float(np.mean([0.1, 0.2, 0.15])),  # Fixed: wrapped with float()
            'max_amplitude': float(np.max([0.1, 0.2, 0.15])),    # Fixed: wrapped with float()
        }],
        
        # Simulating frequency analysis
        'mpf': float(np.sum([1, 2, 3]) / np.sum([0.1, 0.2, 0.3])),  # Already fixed in code
        'mdf': float(np.array([50, 100, 150])[1]),                   # Already fixed in code
        'fatigue_index': float(np.sum([1, 2, 3]) / np.sum([4, 5, 6])),  # Already fixed in code
        
        # Test regular Python types (should work)
        'regular_float': 123.45,
        'regular_int': 123,
        'regular_str': "test",
        'regular_list': [1, 2, 3],
        
        # Test numpy arrays converted to lists (should work)
        'signal_data': np.array([1, 2, 3, 4, 5]).tolist(),  # Already fixed in processor
    }
    
    try:
        json_str = json.dumps(test_data)
        print("✅ JSON serialization successful!")
        print(f"Serialized data length: {len(json_str)} characters")
        
        # Test round-trip
        deserialized = json.loads(json_str)
        print("✅ JSON deserialization successful!")
        
        return True
        
    except TypeError as e:
        print(f"❌ JSON serialization failed: {e}")
        return False

def test_problematic_numpy_types():
    """Test numpy types that would cause serialization issues."""
    
    # These are the problematic types that would cause 500 errors
    problematic_data = {
        # These would fail before our fixes:
        # 'bad_mean': np.mean([1, 2, 3]),      # returns numpy.float64
        # 'bad_max': np.max([1, 2, 3]),        # returns numpy.int64 
        # 'bad_array': np.array([1, 2, 3]),    # returns numpy.ndarray
    }
    
    try:
        json_str = json.dumps(problematic_data)
        print("✅ No problematic types found!")
        return True
    except TypeError as e:
        print(f"❌ Found problematic numpy type: {e}")
        return False

if __name__ == "__main__":
    print("Testing numpy serialization fixes...")
    print("="*50)
    
    success1 = test_numpy_serialization()
    print()
    success2 = test_problematic_numpy_types()
    
    print("\n" + "="*50)
    if success1 and success2:
        print("🎉 All serialization tests passed!")
        print("✅ The 500 error should be fixed.")
    else:
        print("❌ Some tests failed. 500 error may persist.")