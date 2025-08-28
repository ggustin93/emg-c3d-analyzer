"""Cache Services for EMG C3D Analyzer
Simple, fast, reliable caching with Redis
"""

from .cache_patterns import CachePatterns, get_cache_patterns
from .redis_cache import RedisCache, cleanup_redis_cache, get_redis_cache

__all__ = [
    "CachePatterns",
    "RedisCache",
    "cleanup_redis_cache",
    "get_cache_patterns",
    "get_redis_cache"
]
