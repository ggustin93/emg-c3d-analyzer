"""
Storage Infrastructure

Provides data persistence abstractions and caching mechanisms.
Separates storage concerns from business logic.
"""

import hashlib
import json
import time
from typing import Dict, Any, Optional, Union
from pathlib import Path
from ..core.constants import CACHE_TIMEOUT_SECONDS, MAX_CACHE_SIZE


class CacheManager:
    """In-memory cache for analysis results."""
    
    def __init__(self, max_size: int = MAX_CACHE_SIZE, timeout: int = CACHE_TIMEOUT_SECONDS):
        self.max_size = max_size
        self.timeout = timeout
        self._cache: Dict[str, Dict[str, Any]] = {}
    
    def get(self, key: str) -> Optional[Dict[str, Any]]:
        """
        Get cached result by key.
        
        Args:
            key: Cache key
            
        Returns:
            Cached data or None if not found/expired
        """
        if key not in self._cache:
            return None
            
        entry = self._cache[key]
        if time.time() - entry['timestamp'] > self.timeout:
            # Entry expired
            del self._cache[key]
            return None
            
        return entry['data']
    
    def put(self, key: str, data: Dict[str, Any]) -> None:
        """
        Store data in cache.
        
        Args:
            key: Cache key
            data: Data to cache
        """
        # Evict oldest entries if cache is full
        if len(self._cache) >= self.max_size:
            oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k]['timestamp'])
            del self._cache[oldest_key]
        
        self._cache[key] = {
            'data': data,
            'timestamp': time.time()
        }
    
    def clear(self) -> None:
        """Clear all cached entries."""
        self._cache.clear()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return {
            'size': len(self._cache),
            'max_size': self.max_size,
            'timeout': self.timeout
        }


class DataStore:
    """Abstract data storage interface."""
    
    def __init__(self, base_path: Union[str, Path]):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
    
    def store(self, key: str, data: Dict[str, Any]) -> str:
        """
        Store data with given key.
        
        Args:
            key: Storage key
            data: Data to store
            
        Returns:
            Storage path or identifier
        """
        file_path = self.base_path / f"{key}.json"
        
        with open(file_path, 'w') as f:
            json.dump(data, f, indent=2, default=self._json_serializer)
            
        return str(file_path)
    
    def retrieve(self, key: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve data by key.
        
        Args:
            key: Storage key
            
        Returns:
            Stored data or None if not found
        """
        file_path = self.base_path / f"{key}.json"
        
        if not file_path.exists():
            return None
            
        try:
            with open(file_path, 'r') as f:
                return json.load(f)
        except Exception:
            return None
    
    def delete(self, key: str) -> bool:
        """
        Delete stored data by key.
        
        Args:
            key: Storage key
            
        Returns:
            True if deleted, False if not found
        """
        file_path = self.base_path / f"{key}.json"
        
        try:
            file_path.unlink()
            return True
        except FileNotFoundError:
            return False
    
    def list_keys(self) -> list:
        """List all stored keys."""
        return [f.stem for f in self.base_path.glob("*.json")]
    
    @staticmethod
    def _json_serializer(obj):
        """JSON serializer for complex objects."""
        import numpy as np
        
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.integer):
            return int(obj)
        elif hasattr(obj, '__dict__'):
            return obj.__dict__
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


class HashKeyGenerator:
    """Generates consistent hash keys for data."""
    
    @staticmethod
    def generate_file_hash(file_content: bytes) -> str:
        """
        Generate hash for file content.
        
        Args:
            file_content: File binary content
            
        Returns:
            SHA-256 hash string
        """
        return hashlib.sha256(file_content).hexdigest()
    
    @staticmethod
    def generate_params_hash(params: Dict[str, Any]) -> str:
        """
        Generate hash for parameters dictionary.
        
        Args:
            params: Parameters dictionary
            
        Returns:
            SHA-256 hash string
        """
        # Create consistent string representation
        params_str = json.dumps(params, sort_keys=True, default=str)
        return hashlib.sha256(params_str.encode()).hexdigest()
    
    @staticmethod
    def generate_cache_key(file_hash: str, params_hash: str) -> str:
        """
        Generate cache key from file and parameters hashes.
        
        Args:
            file_hash: File content hash
            params_hash: Parameters hash
            
        Returns:
            Combined cache key
        """
        return f"{file_hash}_{params_hash}"