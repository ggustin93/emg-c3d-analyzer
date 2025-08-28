"""Cache Service for EMG analysis results
Manages caching of processed analysis data to avoid reprocessing identical files.
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from config import get_settings

from database.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)
settings = get_settings()


class CacheService:
    """Service for caching EMG analysis results in therapy_sessions (KISS: single table)."""

    def __init__(self):
        self.supabase = get_supabase_client(
            use_service_key=True
        )  # Use service key for admin operations
        self.default_expiry_days = 30  # Configurable cache expiry

    async def cache_analysis_results(
        self,
        session_id: UUID,
        file_hash: str,
        analysis_result: dict[str, Any],
        processing_params: dict[str, Any] | None = None,
        processing_time_ms: int | None = None,
    ) -> UUID:
        """Cache processed analysis results in therapy_sessions (KISS: single table).

        Args:
            session_id: UUID of therapy session
            file_hash: SHA-256 hash of source file
            analysis_result: Complete EMG analysis results
            processing_params: Parameters used for processing (MVC values, thresholds)
            processing_time_ms: Time taken to process in milliseconds

        Returns:
            UUID of session with cached data
        """
        try:
            # Prepare cached data for therapy_sessions
            cache_data = {
                "analytics": analysis_result,
                "processing_params": processing_params or {},
                "processing_version": settings.PROCESSING_VERSION,
                "cached_at": datetime.utcnow().isoformat(),
            }

            update_data = {
                "analytics_cache": cache_data,
                "processing_time_ms": processing_time_ms,
                "cache_hits": 0,
                "last_accessed_at": datetime.utcnow().isoformat(),
            }

            # Update therapy session with cached data (KISS: single table)
            result = (
                self.supabase.table("therapy_sessions")
                .update(update_data)
                .eq("id", str(session_id))
                .execute()
            )

            logger.info(f"Cached analysis results in session for file hash: {file_hash[:16]}...")
            return session_id

        except Exception as e:
            logger.exception(f"Failed to cache analysis results: {e!s}")
            raise

    async def get_cached_analysis(
        self,
        file_hash: str,
        processing_version: str,
        processing_params: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        """Retrieve cached analysis results from therapy_sessions (KISS: single table).

        Args:
            file_hash: SHA-256 hash of source file
            processing_version: Processing version to ensure compatibility
            processing_params: Parameters used for processing (optional for exact match)

        Returns:
            Cached analysis results or None if not found
        """
        try:
            # Query therapy_sessions for cached data
            result = (
                self.supabase.table("therapy_sessions")
                .select("*")
                .eq("file_hash", file_hash)
                .execute()
            )

            if not result.data:
                logger.debug(f"No session found for file hash: {file_hash[:16]}...")
                return None

            session = result.data[0]

            # Check if we have cached analytics and version matches
            analytics_cache = session.get("analytics_cache")
            if (
                not analytics_cache
                or analytics_cache.get("processing_version") != processing_version
            ):
                logger.debug(
                    f"No compatible cache version for file hash: {file_hash[:16]}... (need: {processing_version})"
                )
                return None

            # If specific processing params provided, validate they match
            if processing_params and analytics_cache.get("processing_params"):
                if not self._params_match(processing_params, analytics_cache["processing_params"]):
                    logger.debug(f"Processing params mismatch for file hash: {file_hash[:16]}...")
                    return None

            logger.info(f"Retrieved cached results for file hash: {file_hash[:16]}...")

            # Return in expected format
            return {
                "id": session["id"],
                "analytics_data": analytics_cache.get("analytics", {}),
                "processing_time_ms": session.get("processing_time_ms", 0),
                "cache_hits": session.get("cache_hits", 0),
            }

        except Exception as e:
            logger.exception(f"Failed to retrieve cached analysis: {e!s}")
            return None

    async def increment_cache_hits(self, session_id: str) -> None:
        """Increment cache hit counter in therapy_sessions (KISS: single table).

        Args:
            session_id: UUID of session
        """
        try:
            # Get current hit count
            result = (
                self.supabase.table("therapy_sessions")
                .select("cache_hits")
                .eq("id", session_id)
                .execute()
            )

            if result.data:
                current_hits = result.data[0].get("cache_hits", 0)

                # Update hit count and last accessed time (trigger will update last_accessed_at)
                update_data = {"cache_hits": current_hits + 1}

                self.supabase.table("therapy_sessions").update(update_data).eq(
                    "id", session_id
                ).execute()

                logger.debug(f"Incremented cache hits for session: {session_id}")

        except Exception as e:
            logger.warning(f"Failed to increment cache hits: {e!s}")

    async def invalidate_cache_by_hash(self, file_hash: str) -> int:
        """Invalidate cached data for a specific file hash (KISS: clear analytics_cache in session).

        Args:
            file_hash: SHA-256 hash of source file

        Returns:
            Number of sessions invalidated
        """
        try:
            # Clear analytics_cache for sessions with this file hash
            result = (
                self.supabase.table("therapy_sessions")
                .update({"analytics_cache": {}, "cache_hits": 0})
                .eq("file_hash", file_hash)
                .execute()
            )

            count = len(result.data) if result.data else 0
            logger.info(
                f"Invalidated cache for {count} sessions with file hash: {file_hash[:16]}..."
            )

            return count

        except Exception as e:
            logger.exception(f"Failed to invalidate cache: {e!s}")
            return 0

    async def cleanup_expired_cache(self) -> int:
        """Remove expired cache data (KISS: clear old analytics_cache in sessions).

        Returns:
            Number of sessions cleaned
        """
        try:
            # Find sessions with old cached data (> 30 days)
            cutoff_date = (datetime.utcnow() - timedelta(days=self.default_expiry_days)).isoformat()

            # Clear analytics_cache for old sessions
            result = (
                self.supabase.table("therapy_sessions")
                .update({"analytics_cache": {}, "cache_hits": 0})
                .lt("last_accessed_at", cutoff_date)
                .execute()
            )

            count = len(result.data) if result.data else 0
            logger.info(f"Cleaned up cache for {count} old sessions")

            return count

        except Exception as e:
            logger.exception(f"Failed to cleanup expired cache: {e!s}")
            return 0

    async def get_cache_statistics(self) -> dict[str, Any]:
        """Get cache usage statistics from therapy_sessions (KISS: single table).

        Returns:
            Dict with cache statistics
        """
        try:
            # Get sessions with cached data
            result = (
                self.supabase.table("therapy_sessions")
                .select("id,cache_hits,analytics_cache,last_accessed_at")
                .execute()
            )

            sessions_with_cache = [
                s for s in result.data if s.get("analytics_cache") and s["analytics_cache"] != {}
            ]
            total_sessions_with_cache = len(sessions_with_cache)

            # Calculate statistics
            total_hits = sum(s.get("cache_hits", 0) for s in sessions_with_cache)
            avg_hits = (
                total_hits / max(1, total_sessions_with_cache)
                if total_sessions_with_cache > 0
                else 0
            )

            # Recent activity (last 7 days)
            recent_cutoff = (datetime.utcnow() - timedelta(days=7)).isoformat()
            recent_sessions = [
                s for s in sessions_with_cache if s.get("last_accessed_at", "") > recent_cutoff
            ]

            return {
                "total_sessions": len(result.data),
                "sessions_with_cache": total_sessions_with_cache,
                "total_hits": total_hits,
                "average_hits_per_session": round(avg_hits, 2),
                "recent_activity_7d": len(recent_sessions),
            }

        except Exception as e:
            logger.exception(f"Failed to get cache statistics: {e!s}")
            return {
                "total_sessions": 0,
                "sessions_with_cache": 0,
                "total_hits": 0,
                "average_hits_per_session": 0,
                "recent_activity_7d": 0,
            }

    def _params_match(self, params1: dict[str, Any], params2: dict[str, Any]) -> bool:
        """Check if processing parameters match (allowing for minor differences).

        Args:
            params1: First set of parameters
            params2: Second set of parameters

        Returns:
            True if parameters are considered matching
        """
        try:
            # For now, do simple equality check
            # In future, could add tolerance for floating point values
            return params1 == params2

        except Exception as e:
            logger.warning(f"Error comparing parameters: {e!s}")
            return False
