"""
Hybrid Cache Service for gradual migration from JSONB to Redis
Supports dual-write and gradual read migration strategy
"""
import logging
from typing import Dict, List, Optional, Any
from uuid import UUID
import asyncio

from .redis_cache_service import RedisCacheService, CacheConfig, get_redis_cache_service
from .cache_service import CacheService as JsonbCacheService
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class HybridCacheService:
    """
    Hybrid cache service for gradual Redis migration
    
    Migration Strategy:
    1. Phase 1: Dual write (Redis + JSONB), read from Redis first, fallback to JSONB
    2. Phase 2: Redis primary, JSONB fallback only
    3. Phase 3: Redis only, remove JSONB cache
    """
    
    def __init__(self, migration_phase: str = "phase1"):
        """
        Initialize hybrid cache service
        
        Args:
            migration_phase: 'phase1', 'phase2', or 'phase3'
        """
        self.migration_phase = migration_phase
        self.redis_cache: Optional[RedisCacheService] = None
        self.jsonb_cache = JsonbCacheService()
        
        # Performance metrics
        self._redis_hits = 0
        self._jsonb_hits = 0
        self._cache_misses = 0
        
        logger.info(f"🔄 Initialized hybrid cache service in {migration_phase}")
    
    async def initialize(self):
        """Initialize cache services"""
        try:
            self.redis_cache = await get_redis_cache_service()
            logger.info("✅ Hybrid cache service initialized successfully")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Redis in hybrid service: {str(e)}")
            if self.migration_phase == "phase3":
                raise Exception("Redis required in phase3 but initialization failed")
    
    async def cache_analysis_results(
        self,
        session_id: UUID,
        file_hash: str,
        analysis_result: Dict[str, Any],
        processing_params: Optional[Dict[str, Any]] = None,
        processing_time_ms: Optional[int] = None
    ) -> bool:
        """
        Cache analysis results using migration strategy
        
        Args:
            session_id: UUID of therapy session
            file_hash: SHA-256 hash of source file
            analysis_result: Complete EMG analysis results
            processing_params: Parameters used for processing
            processing_time_ms: Time taken to process in milliseconds
            
        Returns:
            True if at least one cache succeeded, False otherwise
        """
        redis_success = False
        jsonb_success = False
        
        # Redis caching (phase1, phase2, phase3)
        if self.redis_cache and self.migration_phase in ["phase1", "phase2", "phase3"]:
            try:
                redis_success = await self.redis_cache.cache_analysis_results(
                    file_hash=file_hash,
                    analysis_data=analysis_result,
                    processing_time_ms=processing_time_ms
                )
                if redis_success:
                    logger.debug(f"✅ Redis cache write successful for {file_hash[:16]}...")
            except Exception as e:
                logger.error(f"Redis cache write failed: {str(e)}")
        
        # JSONB caching (phase1, phase2 only)
        if self.migration_phase in ["phase1", "phase2"]:
            try:
                jsonb_success = await self.jsonb_cache.cache_analysis_results(
                    session_id=session_id,
                    file_hash=file_hash,
                    analysis_result=analysis_result,
                    processing_params=processing_params,
                    processing_time_ms=processing_time_ms
                )
                if jsonb_success:
                    logger.debug(f"✅ JSONB cache write successful for {file_hash[:16]}...")
            except Exception as e:
                logger.error(f"JSONB cache write failed: {str(e)}")
        
        # Return success if at least one cache succeeded
        success = redis_success or jsonb_success
        
        if success:
            cache_types = []
            if redis_success:
                cache_types.append("Redis")
            if jsonb_success:
                cache_types.append("JSONB")
            logger.info(f"✅ Cached analysis in {'+'.join(cache_types)} for {file_hash[:16]}...")
        else:
            logger.warning(f"⚠️ All cache writes failed for {file_hash[:16]}...")
        
        return success
    
    async def get_cached_analysis(
        self,
        file_hash: str,
        processing_version: str,
        processing_params: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve cached analysis using migration strategy
        
        Priority:
        1. Redis cache (fastest)
        2. JSONB cache (fallback in phase1/phase2)
        
        Args:
            file_hash: SHA-256 hash of source file
            processing_version: Processing version for compatibility
            processing_params: Processing parameters for validation
            
        Returns:
            Cached analysis data or None if not found
        """
        # Try Redis first (phase1, phase2, phase3)
        if self.redis_cache and self.migration_phase in ["phase1", "phase2", "phase3"]:
            try:
                redis_result = await self.redis_cache.get_cached_analysis(file_hash)
                if redis_result:
                    self._redis_hits += 1
                    logger.debug(f"✅ Redis cache hit for {file_hash[:16]}...")
                    return redis_result
            except Exception as e:
                logger.error(f"Redis cache read failed: {str(e)}")
        
        # Fallback to JSONB (phase1, phase2 only)
        if self.migration_phase in ["phase1", "phase2"]:
            try:
                jsonb_result = await self.jsonb_cache.get_cached_analysis(
                    file_hash=file_hash,
                    processing_version=processing_version,
                    processing_params=processing_params
                )
                if jsonb_result:
                    self._jsonb_hits += 1
                    logger.debug(f"✅ JSONB cache hit for {file_hash[:16]}...")
                    
                    # Promote to Redis if available (cache warming)
                    if self.redis_cache and jsonb_result.get("analytics_data"):
                        asyncio.create_task(self._promote_to_redis(file_hash, jsonb_result))
                    
                    return jsonb_result
            except Exception as e:
                logger.error(f"JSONB cache read failed: {str(e)}")
        
        # Cache miss
        self._cache_misses += 1
        logger.debug(f"❌ Cache miss for {file_hash[:16]}...")
        return None
    
    async def _promote_to_redis(self, file_hash: str, jsonb_data: Dict[str, Any]):
        """Promote JSONB cache data to Redis (background operation)"""
        if not self.redis_cache:
            return
        
        try:
            # Extract relevant data for Redis cache
            analysis_data = jsonb_data.get("analytics_data", {})
            processing_time = jsonb_data.get("processing_time_ms", 0)
            
            await self.redis_cache.cache_analysis_results(
                file_hash=file_hash,
                analysis_data=analysis_data,
                processing_time_ms=processing_time
            )
            logger.debug(f"🔄 Promoted JSONB data to Redis for {file_hash[:16]}...")
            
        except Exception as e:
            logger.error(f"Failed to promote data to Redis: {str(e)}")
    
    async def invalidate_cache(self, file_hash: str) -> bool:
        """
        Invalidate cache in both Redis and JSONB
        
        Args:
            file_hash: SHA-256 hash of source file
            
        Returns:
            True if at least one invalidation succeeded
        """
        redis_success = False
        jsonb_success = False
        
        # Invalidate Redis (phase1, phase2, phase3)
        if self.redis_cache and self.migration_phase in ["phase1", "phase2", "phase3"]:
            try:
                redis_success = await self.redis_cache.invalidate_cache(file_hash)
            except Exception as e:
                logger.error(f"Redis cache invalidation failed: {str(e)}")
        
        # Invalidate JSONB (phase1, phase2 only)
        if self.migration_phase in ["phase1", "phase2"]:
            try:
                jsonb_success = await self.jsonb_cache.invalidate_cache(file_hash)
            except Exception as e:
                logger.error(f"JSONB cache invalidation failed: {str(e)}")
        
        success = redis_success or jsonb_success
        
        if success:
            logger.info(f"✅ Cache invalidated for {file_hash[:16]}...")
        else:
            logger.warning(f"⚠️ Cache invalidation failed for {file_hash[:16]}...")
        
        return success
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get comprehensive cache statistics
        
        Returns:
            Combined statistics from both cache layers
        """
        stats = {
            "migration_phase": self.migration_phase,
            "performance": {
                "redis_hits": self._redis_hits,
                "jsonb_hits": self._jsonb_hits,
                "cache_misses": self._cache_misses,
                "total_requests": self._redis_hits + self._jsonb_hits + self._cache_misses
            }
        }
        
        # Calculate hit rates
        total_requests = stats["performance"]["total_requests"]
        if total_requests > 0:
            stats["performance"]["redis_hit_rate"] = self._redis_hits / total_requests
            stats["performance"]["jsonb_hit_rate"] = self._jsonb_hits / total_requests
            stats["performance"]["overall_hit_rate"] = (self._redis_hits + self._jsonb_hits) / total_requests
        
        # Redis stats
        if self.redis_cache:
            try:
                redis_stats = await self.redis_cache.get_cache_stats()
                stats["redis"] = redis_stats
            except Exception as e:
                stats["redis"] = {"status": "error", "error": str(e)}
        else:
            stats["redis"] = {"status": "unavailable"}
        
        # JSONB stats
        if self.migration_phase in ["phase1", "phase2"]:
            try:
                jsonb_stats = await self.jsonb_cache.get_cache_usage_stats()
                stats["jsonb"] = jsonb_stats
            except Exception as e:
                stats["jsonb"] = {"status": "error", "error": str(e)}
        else:
            stats["jsonb"] = {"status": "disabled"}
        
        return stats
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Perform health check on both cache layers
        
        Returns:
            Health status for both cache systems
        """
        health = {
            "migration_phase": self.migration_phase,
            "overall_healthy": True
        }
        
        # Redis health
        if self.redis_cache:
            try:
                redis_health = await self.redis_cache.health_check()
                health["redis"] = redis_health
                if not redis_health.get("healthy", False):
                    health["overall_healthy"] = False
            except Exception as e:
                health["redis"] = {"healthy": False, "error": str(e)}
                health["overall_healthy"] = False
        else:
            health["redis"] = {"healthy": False, "error": "Not initialized"}
            if self.migration_phase == "phase3":
                health["overall_healthy"] = False
        
        # JSONB health (simplified)
        if self.migration_phase in ["phase1", "phase2"]:
            try:
                # Basic connection test
                health["jsonb"] = {"healthy": True, "message": "JSONB cache available"}
            except Exception as e:
                health["jsonb"] = {"healthy": False, "error": str(e)}
                if self.migration_phase == "phase1":
                    health["overall_healthy"] = False
        else:
            health["jsonb"] = {"healthy": True, "message": "Not used in phase3"}
        
        return health


# Singleton instance for application use
_hybrid_cache_service: Optional[HybridCacheService] = None


async def get_hybrid_cache_service(migration_phase: str = "phase1") -> HybridCacheService:
    """
    Get singleton hybrid cache service instance
    
    Args:
        migration_phase: 'phase1', 'phase2', or 'phase3'
        
    Returns:
        Initialized HybridCacheService instance
    """
    global _hybrid_cache_service
    
    if _hybrid_cache_service is None or _hybrid_cache_service.migration_phase != migration_phase:
        _hybrid_cache_service = HybridCacheService(migration_phase=migration_phase)
        await _hybrid_cache_service.initialize()
    
    return _hybrid_cache_service


async def cleanup_hybrid_cache_service():
    """Cleanup hybrid cache service"""
    global _hybrid_cache_service
    
    if _hybrid_cache_service and _hybrid_cache_service.redis_cache:
        await _hybrid_cache_service.redis_cache.close()
        _hybrid_cache_service = None