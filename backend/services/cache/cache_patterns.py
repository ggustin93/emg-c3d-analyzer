"""
Advanced Caching Patterns for EMG Analysis
Implements cache-aside pattern with pipeline operations
"""
import json
import logging
import asyncio
from datetime import datetime
from typing import Dict, Optional, Any, List, Callable
from dataclasses import dataclass

from .redis_cache import get_redis_cache, RedisCache

logger = logging.getLogger(__name__)


@dataclass
class CacheEntry:
    """Cache entry with metadata"""
    data: Any
    created_at: datetime
    hits: int = 0
    ttl: Optional[int] = None


class CachePatterns:
    """
    Advanced caching patterns for EMG analysis
    
    Patterns:
    - Cache-aside: Check cache first, load from source on miss
    - Pipeline operations: Batch multiple operations
    - Background refresh: Refresh popular items before expiration
    """
    
    def __init__(self, cache: Optional[RedisCache] = None):
        self.cache = cache
        self._refresh_tasks: List[asyncio.Task] = []
    
    async def initialize(self):
        """Initialize with cache instance"""
        if not self.cache:
            self.cache = await get_redis_cache()
    
    async def cache_aside_get(
        self,
        key: str,
        loader_func: Callable[[], Any],
        ttl: int = 3600
    ) -> Any:
        """
        Cache-aside pattern: Check cache first, load from source on miss
        
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
                return cached_data.get('data')
            
            # Cache miss - load from source
            logger.debug(f"Loading data for key: {key}")
            data = await self._safe_call(loader_func)
            
            if data is not None:
                # Cache the result
                await self.cache.set(key, {"data": data}, ttl)
            
            return data
            
        except Exception as e:
            logger.error(f"Cache-aside error for {key}: {str(e)}")
            # Fallback to loader function
            return await self._safe_call(loader_func)
    
    async def batch_get(self, keys: List[str]) -> Dict[str, Any]:
        """Get multiple keys efficiently"""
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
                        data[key] = cached_data.get('data')
                    except (json.JSONDecodeError, TypeError):
                        logger.warning(f"Invalid cache data for key: {key}")
            
            return data
            
        except Exception as e:
            logger.error(f"Batch get error: {str(e)}")
            return {}
    
    async def batch_set(self, data: Dict[str, Any], ttl: int = 3600) -> Dict[str, bool]:
        """Set multiple keys efficiently"""
        if not self.cache or not self.cache.redis:
            return {key: False for key in data.keys()}
        
        try:
            # Use pipeline for batch operations
            pipe = self.cache.redis.pipeline()
            
            for key, value in data.items():
                cache_data = {
                    "data": value,
                    "cached_at": datetime.utcnow().isoformat(),
                    "cache_version": "1.0"
                }
                
                cache_key = self.cache._cache_key(key)
                cache_json = json.dumps(cache_data)
                pipe.setex(cache_key, ttl, cache_json)
            
            results = await pipe.execute()
            
            # Build result status
            return {
                key: result is True 
                for key, result in zip(data.keys(), results)
            }
            
        except Exception as e:
            logger.error(f"Batch set error: {str(e)}")
            return {key: False for key in data.keys()}
    
    async def warm_cache(
        self,
        warming_configs: List[Dict[str, Any]]
    ) -> Dict[str, bool]:
        """
        Pre-warm cache with frequently accessed data
        
        Args:
            warming_configs: List of {key, loader_func, ttl, priority}
            
        Returns:
            Dictionary of key -> success status
        """
        results = {}
        
        # Sort by priority (higher first)
        sorted_configs = sorted(
            warming_configs,
            key=lambda x: x.get('priority', 0),
            reverse=True
        )
        
        for config in sorted_configs:
            key = config['key']
            loader_func = config['loader_func']
            ttl = config.get('ttl', 3600)
            
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
                logger.error(f"Cache warming failed for {key}: {str(e)}")
                results[key] = False
        
        return results
    
    async def invalidate_by_pattern(self, pattern: str) -> int:
        """Invalidate keys matching pattern"""
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
            logger.error(f"Pattern invalidation error: {str(e)}")
            return 0
    
    async def refresh_ahead(self, key: str, loader_func: Callable, ttl: int = 3600):
        """Refresh cache entry before expiration"""
        try:
            # Schedule background refresh
            task = asyncio.create_task(self._background_refresh(key, loader_func, ttl))
            self._refresh_tasks.append(task)
            
            # Clean up completed tasks
            self._refresh_tasks = [t for t in self._refresh_tasks if not t.done()]
            
        except Exception as e:
            logger.error(f"Refresh ahead error for {key}: {str(e)}")
    
    async def _background_refresh(self, key: str, loader_func: Callable, ttl: int):
        """Background task to refresh cache entry"""
        try:
            data = await self._safe_call(loader_func)
            if data is not None:
                await self.cache.set(key, {"data": data}, ttl)
                logger.debug(f"🔄 Refreshed cache for key: {key}")
                
        except Exception as e:
            logger.error(f"Background refresh error for {key}: {str(e)}")
    
    async def _safe_call(self, func: Callable, *args, **kwargs) -> Any:
        """Safely call function with error handling"""
        try:
            if asyncio.iscoroutinefunction(func):
                return await func(*args, **kwargs)
            else:
                return func(*args, **kwargs)
        except Exception as e:
            logger.error(f"Function call error: {str(e)}")
            return None
    
    async def close(self):
        """Cleanup background tasks"""
        for task in self._refresh_tasks:
            task.cancel()
        self._refresh_tasks.clear()


# Singleton instance
_patterns_instance: Optional[CachePatterns] = None


async def get_cache_patterns() -> CachePatterns:
    """Get singleton cache patterns instance"""
    global _patterns_instance
    
    if _patterns_instance is None:
        _patterns_instance = CachePatterns()
        await _patterns_instance.initialize()
    
    return _patterns_instance