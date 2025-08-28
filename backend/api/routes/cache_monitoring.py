"""Simple Cache Monitoring API
Basic cache health, stats, and management endpoints.
"""

import logging
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.cache import get_cache_patterns, get_redis_cache

router = APIRouter(prefix="/api/cache", tags=["Cache"])
logger = logging.getLogger(__name__)


class CacheHealthResponse(BaseModel):
    healthy: bool
    message: str
    error: str | None = None
    timestamp: str


class CacheStatsResponse(BaseModel):
    status: str
    memory_mb: float
    hit_rate: float
    hits: int
    misses: int
    total_requests: int
    config: dict[str, Any]


@router.get("/health", response_model=CacheHealthResponse)
async def get_cache_health():
    """Check Redis cache health."""
    try:
        cache = await get_redis_cache()
        health = await cache.health_check()

        return CacheHealthResponse(
            healthy=health["healthy"],
            message=health.get("message", "Health check completed"),
            error=health.get("error"),
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        logger.exception("Health check failed: %s", e)
        return CacheHealthResponse(
            healthy=False,
            message="Health check failed",
            error=str(e),
            timestamp=datetime.utcnow().isoformat(),
        )


@router.get("/stats", response_model=CacheStatsResponse)
async def get_cache_stats():
    """Get cache statistics."""
    try:
        cache = await get_redis_cache()
        stats = await cache.get_stats()

        if stats.get("status") == "error":
            raise HTTPException(status_code=500, detail=stats.get("error"))

        return CacheStatsResponse(
            status=stats.get("status", "unknown"),
            memory_mb=stats.get("memory_mb", 0.0),
            hit_rate=stats.get("hit_rate", 0.0),
            hits=stats.get("hits", 0),
            misses=stats.get("misses", 0),
            total_requests=stats.get("total_requests", 0),
            config=stats.get("config", {}),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get cache stats: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/invalidate")
async def invalidate_cache_pattern(
    pattern: str = Query(..., description="Cache key pattern to invalidate"),
):
    """Invalidate cache keys matching pattern."""
    try:
        patterns = await get_cache_patterns()
        count = await patterns.invalidate_by_pattern(pattern)

        return {
            "status": "completed",
            "invalidated_keys": count,
            "pattern": pattern,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.exception("Cache invalidation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard")
async def get_cache_dashboard():
    """Get cache dashboard data."""
    try:
        cache = await get_redis_cache()
        health = await cache.health_check()
        stats = await cache.get_stats()

        return {
            "timestamp": datetime.utcnow().isoformat(),
            "health": {
                "status": "healthy" if health["healthy"] else "unhealthy",
                "message": health.get("message", ""),
                "error": health.get("error"),
            },
            "performance": {
                "memory_mb": stats.get("memory_mb", 0),
                "hit_rate": stats.get("hit_rate", 0),
                "total_requests": stats.get("total_requests", 0),
                "hits": stats.get("hits", 0),
                "misses": stats.get("misses", 0),
            },
            "config": stats.get("config", {}),
        }

    except Exception as e:
        logger.exception("Dashboard error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
