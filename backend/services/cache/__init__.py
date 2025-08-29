"""Cache Services for EMG C3D Analyzer
Simple, fast, reliable caching with Redis.
"""

from services.cache.cache_patterns import CachePatterns, get_cache_patterns
from services.cache.redis_cache import RedisCache, cleanup_redis_cache, get_redis_cache

__all__ = [
    "CachePatterns",
    "RedisCache",
    "cleanup_redis_cache",
    "get_cache_patterns",
    "get_redis_cache",
]
