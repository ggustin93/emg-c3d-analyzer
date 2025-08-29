"""JSON Encoder for NumPy Types.

Provides JSON serialization support for NumPy data types commonly used
in EMG analysis results. This encoder ensures that numpy arrays and scalars
can be safely serialized for API responses and data storage.

Usage:
    import json
    from utils.numpy_encoder import NumpyEncoder
    
    data = {"result": np.float32(1.23), "array": np.array([1, 2, 3])}
    json_string = json.dumps(data, cls=NumpyEncoder)

Author: EMG C3D Analyzer Team
Date: 2025-08-28
"""

import json
import numpy as np


class NumpyEncoder(json.JSONEncoder):
    """JSON encoder that handles NumPy data types.
    
    Converts NumPy arrays and scalars to native Python types that
    can be JSON serialized safely.
    """
    
    def default(self, obj):
        """Convert NumPy types to JSON-serializable types.
        
        Args:
            obj: Object to encode
            
        Returns:
            JSON-serializable representation of the object
        """
        # Handle NumPy arrays
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        
        # Handle NumPy scalar types
        if isinstance(obj, np.integer):
            return int(obj)
        
        if isinstance(obj, np.floating):
            return float(obj)
        
        if isinstance(obj, np.complexfloating):
            return {"real": float(obj.real), "imag": float(obj.imag)}
        
        if isinstance(obj, np.bool_):
            return bool(obj)
            
        # Handle NumPy string types
        if isinstance(obj, (np.str_, np.unicode_)):
            return str(obj)
        
        # Handle bytes
        if isinstance(obj, np.bytes_):
            return obj.decode('utf-8')
            
        # Let the base class handle other types
        return super().default(obj)


def serialize_numpy_data(data):
    """Convenience function to serialize data containing NumPy types.
    
    Args:
        data: Data structure potentially containing NumPy types
        
    Returns:
        JSON string with NumPy types properly serialized
    """
    return json.dumps(data, cls=NumpyEncoder, indent=2)


def safe_json_dumps(data, **kwargs):
    """Safe JSON dumps that handles NumPy types automatically.
    
    Args:
        data: Data to serialize
        **kwargs: Additional arguments for json.dumps
        
    Returns:
        JSON string with NumPy types handled
    """
    # Set NumpyEncoder as default if no cls specified
    if 'cls' not in kwargs:
        kwargs['cls'] = NumpyEncoder
        
    return json.dumps(data, **kwargs)