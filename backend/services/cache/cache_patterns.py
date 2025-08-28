"""Advanced Caching Patterns for EMG Analysis
Implements cache-aside pattern with pipeline operations.
"""

import asyncio
import json
import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.services.cache.redis_cache import RedisCache, get_redis_cache

logger = logging.getLogger(__name__)


@dataclass
class CacheEntry:
    """Cache entry with metadata."""

    data: Any
    created_at: datetime
    hits: int = 0
    ttl: int | None = None


class CachePatterns:
    """Advanced caching patterns for EMG analysis.

    Patterns:
    - Cache-aside: Check cache first, load from source on miss
    - Pipeline operations: Batch multiple operations
    - Background refresh: Refresh popular items before expiration
    """

    def __init__(self, cache: RedisCache | None = None):
        self.cache = cache
        self._refresh_tasks: list[asyncio.Task] = []

    async def initialize(self):
        """Initialize with cache instance."""
        if not self.cache:
            self.cache = await get_redis_cache()

    async def cache_aside_get(
        self, key: str, loader_func: Callable[[], Any], ttl: int = 3600
    ) -> Any:
        """Cache-aside pattern: Check cache first, load from source on miss.

        Args:
            key: Cache key
            loader_func: Function to load data if cache miss
            ttl: Time to live in seconds

        Returns:
            Cached or freshly loaded data
        """
        try:
            # Try cache first
            cached_data = await self.cache.get(key)
            if cached_data:
                return cached_data.get("data")

            # Cache miss - load from source
            logger.debug(f"Loading data for key: {key}")
            data = await self._safe_call(loader_func)

            if data is not None:
                # Cache the result
                await self.cache.set(key, {"data": data}, ttl)

            return data

        except Exception as e:
            logger.exception(f"Cache-aside error for {key}: {e!s}")
            # Fallback to loader function
            return await self._safe_call(loader_func)

    async def batch_get(self, keys: list[str]) -> dict[str, Any]:
        """Get multiple keys efficiently."""
        if not self.cache or not self.cache.redis:
            return {}

        try:
            # Use pipeline for batch operations
            pipe = self.cache.redis.pipeline()
            cache_keys = [self.cache._cache_key(key) for key in keys]

            for cache_key in cache_keys:
                pipe.get(cache_key)

            results = await pipe.execute()

            # Parse results
            data = {}
            for i, (key, result) in enumerate(zip(keys, results)):
                if result:
                    try:
                        cached_data = json.loads(result)
                        data[key] = cached_data.get("data")
                    except (json.JSONDecodeError, TypeError):
                        logger.warning(f"Invalid cache data for key: {key}")

            return data

        except Exception as e:
            logger.exception(f"Batch get error: {e!s}")
            return {}

    async def batch_set(self, data: dict[str, Any], ttl: int = 3600) -> dict[str, bool]:
        """Set multiple keys efficiently."""
        if not self.cache or not self.cache.redis:
            return dict.fromkeys(data.keys(), False)

        try:
            # Use pipeline for batch operations
            pipe = self.cache.redis.pipeline()

            for key, value in data.items():
                cache_data = {
                    "data": value,
                    "cached_at": datetime.utcnow().isoformat(),
                    "cache_version": "1.0",
                }

                cache_key = self.cache._cache_key(key)
                cache_json = json.dumps(cache_data)
                pipe.setex(cache_key, ttl, cache_json)

            results = await pipe.execute()

            # Build result status
            return {key: result is True for key, result in zip(data.keys(), results)}

        except Exception as e:
            logger.exception(f"Batch set error: {e!s}")
            return dict.fromkeys(data.keys(), False)

    async def warm_cache(self, warming_configs: list[dict[str, Any]]) -> dict[str, bool]:
        """Pre-warm cache with frequently accessed data.

        Args:
            warming_configs: List of {key, loader_func, ttl, priority}

        Returns:
            Dictionary of key -> success status
        """
        results = {}

        # Sort by priority (higher first)
        sorted_configs = sorted(warming_configs, key=lambda x: x.get("priority", 0), reverse=True)

        for config in sorted_configs:
            key = config["key"]
            loader_func = config["loader_func"]
            ttl = config.get("ttl", 3600)

            try:
                # Check if already cached
                if await self.cache.exists(key):
                    results[key] = True
                    continue

                # Load and cache data
                data = await self._safe_call(loader_func)

                if data is not None:
                    success = await self.cache.set(key, {"data": data}, ttl)
                    results[key] = success

                    if success:
                        logger.info(f"🔥 Warmed cache for key: {key}")
                else:
                    results[key] = False

            except Exception as e:
                logger.exception(f"Cache warming failed for {key}: {e!s}")
                results[key] = False

        return results

    async def invalidate_by_pattern(self, pattern: str) -> int:
        """Invalidate keys matching pattern."""
        if not self.cache or not self.cache.redis:
            return 0

        try:
            # Find keys matching pattern
            full_pattern = f"{self.cache.config.key_prefix}:{pattern}"
            keys = await self.cache.redis.keys(full_pattern)

            if keys:
                deleted = await self.cache.redis.delete(*keys)
                logger.info(f"🗑️ Invalidated {deleted} keys matching: {pattern}")
                return deleted

            return 0

        except Exception as e:
            logger.exception(f"Pattern invalidation error: {e!s}")
            return 0

    async def refresh_ahead(self, key: str, loader_func: Callable, ttl: int = 3600):
        """Refresh cache entry before expiration."""
        try:
            # Schedule background refresh
            task = asyncio.create_task(self._background_refresh(key, loader_func, ttl))
            self._refresh_tasks.append(task)

            # Clean up completed tasks
            self._refresh_tasks = [t for t in self._refresh_tasks if not t.done()]

        except Exception as e:
            logger.exception(f"Refresh ahead error for {key}: {e!s}")

    async def _background_refresh(self, key: str, loader_func: Callable, ttl: int):
        """Background task to refresh cache entry."""
        try:
            data = await self._safe_call(loader_func)
            if data is not None:
                await self.cache.set(key, {"data": data}, ttl)
                logger.debug(f"🔄 Refreshed cache for key: {key}")

        except Exception as e:
            logger.exception(f"Background refresh error for {key}: {e!s}")

    async def _safe_call(self, func: Callable, *args, **kwargs) -> Any:
        """Safely call function with error handling."""
        try:
            if asyncio.iscoroutinefunction(func):
                return await func(*args, **kwargs)
            else:
                return func(*args, **kwargs)
        except Exception as e:
            logger.exception(f"Function call error: {e!s}")
            return None

    async def close(self):
        """Cleanup background tasks."""
        for task in self._refresh_tasks:
            task.cancel()
        self._refresh_tasks.clear()


# Singleton instance
_patterns_instance: CachePatterns | None = None


async def get_cache_patterns() -> CachePatterns:
    """Get singleton cache patterns instance."""
    global _patterns_instance

    if _patterns_instance is None:
        _patterns_instance = CachePatterns()
        await _patterns_instance.initialize()

    return _patterns_instance
