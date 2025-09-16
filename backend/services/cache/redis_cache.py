"""Simple Redis Cache Service for EMG C3D Analyzer
Fast, reliable caching with graceful fallback.
"""

import json
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any

try:
    import redis.asyncio as redis
    HAS_REDIS = True
except ImportError:
    redis = None  # type: ignore
    HAS_REDIS = False

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class CacheConfig:
    """Simple cache configuration."""

    ttl_seconds: int = 3600  # 1 hour default
    key_prefix: str = "emg_analysis"


class RedisCache:
    """Simple Redis cache service.

    Features:
    - Fast memory-based cache operations
    - Automatic TTL management
    - Graceful fallback when Redis unavailable
    - Connection pooling for performance
    """

    def __init__(self, config: CacheConfig | None = None):
        self.config = config or CacheConfig()
        self.redis: redis.Redis | None = None
        self._connection_pool = None

    async def initialize(self):
        """Initialize Redis connection with graceful fallback."""
        if not HAS_REDIS:
            logger.warning("⚠️ Redis module not installed - cache disabled")
            self.redis = None
            return
            
        try:
            # Create connection pool
            self._connection_pool = redis.ConnectionPool.from_url(
                settings.REDIS_URL, decode_responses=True, max_connections=10, retry_on_timeout=True
            )

            # Create Redis client
            self.redis = redis.Redis(connection_pool=self._connection_pool)

            # Test connection
            await self.redis.ping()
            logger.info("✅ Redis cache connected")

        except Exception as e:
            logger.warning(f"⚠️ Redis unavailable: {e!s} - cache disabled")
            self.redis = None

    async def close(self):
        """Close Redis connections."""
        if self.redis:
            await self.redis.close()
        if self._connection_pool:
            await self._connection_pool.disconnect()

    def _cache_key(self, key: str) -> str:
        """Generate cache key with prefix."""
        return f"{self.config.key_prefix}:{key}"

    async def get(self, key: str) -> dict[str, Any] | None:
        """Get cached data."""
        if not self.redis:
            return None

        try:
            cache_key = self._cache_key(key)
            cached_json = await self.redis.get(cache_key)

            if cached_json:
                data = json.loads(cached_json)
                logger.debug(f"Cache hit: {key}")
                return data

            logger.debug(f"Cache miss: {key}")
            return None

        except Exception as e:
            logger.exception(f"Cache get error: {e!s}")
            return None

    async def set(self, key: str, data: dict[str, Any], ttl: int | None = None) -> bool:
        """Set cached data with TTL."""
        if not self.redis:
            return False

        try:
            # Prepare cache data
            cache_data = {
                **data,
                "cached_at": datetime.utcnow().isoformat(),
                "cache_version": "1.0",
            }

            # Validate size (100MB limit)
            data_json = json.dumps(cache_data)
            size_mb = len(data_json.encode("utf-8")) / (1024 * 1024)
            if size_mb > 100:
                logger.warning(f"Data too large: {size_mb:.2f}MB")
                return False

            # Store with TTL
            cache_key = self._cache_key(key)
            ttl_seconds = ttl or self.config.ttl_seconds

            result = await self.redis.setex(cache_key, ttl_seconds, data_json)

            if result:
                logger.debug(f"Cache set: {key}")
                return True

        except Exception as e:
            logger.exception(f"Cache set error: {e!s}")

        return False

    async def delete(self, key: str) -> bool:
        """Delete cached data."""
        if not self.redis:
            return False

        try:
            cache_key = self._cache_key(key)
            result = await self.redis.delete(cache_key)

            if result > 0:
                logger.debug(f"Cache deleted: {key}")
                return True

        except Exception as e:
            logger.exception(f"Cache delete error: {e!s}")

        return False

    async def exists(self, key: str) -> bool:
        """Check if key exists in cache."""
        if not self.redis:
            return False

        try:
            cache_key = self._cache_key(key)
            return await self.redis.exists(cache_key) > 0

        except Exception as e:
            logger.exception(f"Cache exists error: {e!s}")
            return False

    async def get_stats(self) -> dict[str, Any]:
        """Get cache statistics."""
        if not self.redis:
            return {"status": "unavailable"}

        try:
            info = await self.redis.info()

            memory_mb = info.get("used_memory", 0) / (1024 * 1024)
            hits = info.get("keyspace_hits", 0)
            misses = info.get("keyspace_misses", 0)
            total = hits + misses
            hit_rate = hits / total if total > 0 else 0

            return {
                "status": "connected",
                "memory_mb": round(memory_mb, 2),
                "hit_rate": round(hit_rate, 3),
                "hits": hits,
                "misses": misses,
                "total_requests": total,
                "config": {
                    "ttl_seconds": self.config.ttl_seconds,
                    "key_prefix": self.config.key_prefix,
                },
            }

        except Exception as e:
            logger.exception(f"Cache stats error: {e!s}")
            return {"status": "error", "error": str(e)}

    async def health_check(self) -> dict[str, Any]:
        """Health check with test operation."""
        if not self.redis:
            return {"healthy": False, "error": "Redis not available"}

        try:
            # Test set/get/delete cycle
            test_key = f"{self.config.key_prefix}:health_test"

            await self.redis.setex(test_key, 10, "test_value")
            result = await self.redis.get(test_key)
            await self.redis.delete(test_key)

            if result == "test_value":
                return {"healthy": True, "message": "All operations working"}
            else:
                return {"healthy": False, "error": "Test operation failed"}

        except Exception as e:
            return {"healthy": False, "error": str(e)}


# Singleton instance
_cache_instance: RedisCache | None = None


async def get_redis_cache() -> RedisCache:
    """Get singleton cache instance."""
    global _cache_instance

    if _cache_instance is None:
        _cache_instance = RedisCache()
        await _cache_instance.initialize()

    return _cache_instance


async def cleanup_redis_cache():
    """Cleanup cache connections."""
    global _cache_instance

    if _cache_instance:
        await _cache_instance.close()
        _cache_instance = None
